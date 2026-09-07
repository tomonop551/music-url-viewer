"""AgentCore HTTP runtime. Conversation state is supplied by the trusted API."""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import boto3
from botocore.config import Config
from catalog import scan_all, model_catalog
from recommender import recommend


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def respond(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/ping":
            self.respond(200, {"status": "Healthy"})
        else:
            self.respond(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/invocations":
            self.respond(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 65536:
                self.respond(400, {"error": "Invalid payload size"})
                return
            payload = json.loads(self.rfile.read(length))
            config = Config(connect_timeout=3, read_timeout=12, retries={"max_attempts": 0})
            db = boto3.resource("dynamodb", config=config)
            records = scan_all(db.Table(os.environ["MUSIC_TABLE_NAME"]))
            features = {item["message_id"]: item for item in scan_all(db.Table(os.environ["FEATURES_TABLE_NAME"]))}
            catalog = model_catalog(records, features)
            if len(catalog) > 300 or len(json.dumps(catalog)) > 120000:
                raise ValueError("Catalog capacity exceeded")
            bedrock = boto3.client("bedrock-runtime", config=config)
            self.respond(200, recommend(payload, catalog, bedrock, os.environ["BEDROCK_MODEL_ID"]))
        except Exception as error:
            print(json.dumps({"event": "invocation_failed", "type": type(error).__name__}), flush=True)
            self.respond(500, {"error": "Recommendation unavailable"})


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
