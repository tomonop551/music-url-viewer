import importlib.util
import json
import os
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen


@unittest.skipUnless(importlib.util.find_spec("boto3"), "Run in the agent container with boto3 installed")
class RuntimeHTTPTests(unittest.TestCase):
    def setUp(self):
        from main import Handler, ThreadingHTTPServer
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = "http://127.0.0.1:" + str(self.server.server_port)

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def test_ping_does_not_extend_session_lifetime(self):
        with urlopen(self.base + "/ping") as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(json.load(response), {"status": "Healthy"})

    def test_invocation_serializes_validated_reply(self):
        with patch.dict(os.environ, {"MUSIC_TABLE_NAME": "example", "FEATURES_TABLE_NAME": "features", "BEDROCK_MODEL_ID": "example"}), patch("main.boto3.resource"), patch("main.boto3.client"), patch("main.scan_all", return_value=[]), patch("main.recommend", return_value={"message": "どんな気分ですか？", "recommendations": []}):
            request = Request(self.base + "/invocations", data=json.dumps({"message": "hello"}).encode(), headers={"Content-Type": "application/json"})
            with urlopen(request) as response:
                self.assertEqual(json.load(response)["message"], "どんな気分ですか？")

    def test_invalid_payload_and_unknown_paths_fail(self):
        with self.assertRaises(HTTPError) as context:
            urlopen(Request(self.base + "/invocations", data=b""))
        self.assertEqual(context.exception.code, 400)
        with self.assertRaises(HTTPError) as context:
            urlopen(self.base + "/unknown")
        self.assertEqual(context.exception.code, 404)


@unittest.skipUnless(importlib.util.find_spec("boto3"), "Run in the agent container with boto3 installed")
class WorkerFailureTests(unittest.TestCase):
    def test_failure_preserves_metadata_and_backs_off(self):
        from unittest.mock import Mock
        from catalog import fingerprint
        from enrich import handler
        record = {"message_id": "demo", "url": "https://youtu.be/demo", "title": "Example title"}
        old = {"message_id": "demo", "fingerprint": fingerprint(record), "status": "matched", "title": "Independent title", "refresh_after": 0}
        catalog, features = Mock(), Mock()
        catalog.scan.return_value = {"Items": [record]}
        features.scan.return_value = {"Items": [old]}
        with patch.dict(os.environ, {"MUSIC_TABLE_NAME": "example", "FEATURES_TABLE_NAME": "features"}), patch("boto3.resource") as resource, patch("enrich.resolve", side_effect=TimeoutError), patch("enrich.time.time", return_value=1000):
            resource.return_value.Table.side_effect = [catalog, features]
            with self.assertRaises(RuntimeError):
                handler({}, None)
        saved = features.put_item.call_args.kwargs["Item"]
        self.assertEqual(saved["title"], "Independent title")
        self.assertEqual(saved["status"], "matched")
        self.assertEqual(saved["retry_after"], 4600)
        features.scan.return_value = {"Items": [saved]}
        with patch.dict(os.environ, {"MUSIC_TABLE_NAME": "example", "FEATURES_TABLE_NAME": "features"}), patch("boto3.resource") as resource, patch("enrich.resolve") as resolve, patch("enrich.time.time", return_value=1100):
            resource.return_value.Table.side_effect = [catalog, features]
            self.assertEqual(handler({}, None), {"processed": 0})
            resolve.assert_not_called()
