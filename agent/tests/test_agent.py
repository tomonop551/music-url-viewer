import json
import unittest
from decimal import Decimal
from unittest.mock import Mock, patch

from catalog import canonical_url, fingerprint, model_catalog, scan_all, score
from enrich import choose_recording, resolve
from recommender import filter_catalog, recommend, validate_reply


class CatalogTests(unittest.TestCase):
    def test_provider_content_is_excluded_and_stale_metadata_is_ignored(self):
        record = {"message_id": "demo", "url": "https://open.spotify.com/track/demo", "title": "PRIVATE_PROVIDER_TITLE", "user_name": "PRIVATE_NAME", "dopamine": Decimal(0)}
        unknown = model_catalog([record], {})
        self.assertNotIn("PRIVATE", json.dumps(unknown))
        self.assertEqual(unknown[0]["dopamine"], 0)
        feature = {"status": "matched", "source": "musicbrainz", "fingerprint": fingerprint(record), "title": "Independent title", "artist": "Demo artist", "tags": ["ambient"], "source_url": "https://musicbrainz.org/recording/demo"}
        self.assertEqual(model_catalog([record], {"demo": feature})[0]["title"], "Independent title")
        record["url"] = "https://open.spotify.com/track/changed"
        self.assertEqual(model_catalog([record], {"demo": feature})[0]["metadata_status"], "unknown")

    def test_zero_is_not_missing_or_boolean(self):
        self.assertEqual(score(Decimal(0)), 0)
        for value in [None, True, -1, 11, "10", float("nan")]:
            self.assertIsNone(score(value))
        self.assertEqual(filter_catalog([{"id": "zero", "dopamine": 0}, {"id": "missing", "dopamine": None}], {"max_dopamine": 0}), [{"id": "zero", "dopamine": 0}])

    def test_scan_reads_all_pages(self):
        table = Mock()
        table.scan.side_effect = [{"Items": [{"id": "first"}], "LastEvaluatedKey": {"id": "cursor"}}, {"Items": [{"id": "second"}]}]
        self.assertEqual(len(scan_all(table)), 2)
        table.scan.assert_called_with(ExclusiveStartKey={"id": "cursor"})

    def test_unsafe_urls_are_rejected(self):
        for value in [None, "javascript:alert(1)", "https://youtube.com.evil.example/watch", "https://user:pass@youtube.com/watch"]:
            self.assertIsNone(canonical_url(value))
        self.assertEqual(canonical_url("https://youtu.be/demo?si=tracking"), "https://www.youtube.com/watch?v=demo")


class EnrichmentTests(unittest.TestCase):
    def test_ambiguous_and_artistless_matches_remain_unknown(self):
        recording = {"id": "demo", "title": "Dream Road", "score": 100, "artist-credit": [{"artist": {"name": "Example Artist"}}]}
        self.assertEqual(choose_recording([recording], "Example Artist - Dream Road"), recording)
        self.assertIsNone(choose_recording([recording], "Dream Road"))
        self.assertIsNone(choose_recording([recording, {**recording, "id": "alternate"}], "Example Artist - Dream Road"))

    @patch("enrich.mb_get")
    def test_exact_url_match_fetches_independent_metadata(self, get):
        get.side_effect = [{"relations": [{"recording": {"id": "demo"}}]}, {"title": "Independent title", "artist-credit": [{"artist": {"name": "Example Artist"}}], "tags": [{"name": "ambient", "count": 3}]}]
        result = resolve({"url": "https://youtu.be/demo", "title": "PRIVATE_PROVIDER_TITLE"})
        self.assertEqual(result["tags"], ["ambient"])
        self.assertNotIn("PRIVATE", json.dumps(result))
        self.assertEqual(result["match_method"], "url_relation")


class RecommendationTests(unittest.TestCase):
    def test_unregistered_ids_fail_closed(self):
        with self.assertRaises(ValueError):
            validate_reply({"message": "候補です", "recommendations": [{"id": "invented", "reason": "理由"}]}, {"registered"})

    def test_tool_loop_selects_only_retrieved_candidates(self):
        client = Mock()
        def output(name, args):
            return {"output": {"message": {"role": "assistant", "content": [{"toolUse": {"toolUseId": name, "name": name, "input": args}}]}}}
        client.converse.side_effect = [output("search_catalog", {"min_dopamine": 7}), output("submit_recommendations", {"message": "中毒性で選びました", "recommendations": [{"id": "demo", "reason": "中毒性8/10です"}]})]
        result = recommend({"message": "クセになる曲", "history": []}, [{"id": "demo", "dopamine": 8}], client, "example-model")
        self.assertEqual(result["recommendations"][0]["id"], "demo")
        self.assertEqual(client.converse.call_count, 2)

    def test_can_ask_without_selecting_tracks(self):
        client = Mock()
        client.converse.return_value = {"output": {"message": {"role": "assistant", "content": [{"toolUse": {"toolUseId": "ask", "name": "submit_recommendations", "input": {"message": "落ち着きたいですか？", "recommendations": []}}}]}}}
        self.assertEqual(recommend({"message": "疲れた"}, [], client, "example-model")["recommendations"], [])

    def test_repeated_search_is_bounded(self):
        client = Mock()
        client.converse.return_value = {"output": {"message": {"role": "assistant", "content": [{"toolUse": {"toolUseId": "search", "name": "search_catalog", "input": {}}}]}}}
        with self.assertRaises(ValueError):
            recommend({"message": "曲を探して"}, [], client, "example-model")
        self.assertEqual(client.converse.call_count, 3)


if __name__ == "__main__":
    unittest.main()
