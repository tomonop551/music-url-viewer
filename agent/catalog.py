"""Catalog boundaries shared by the runtime and metadata worker."""
import hashlib
import json
import math
from decimal import Decimal
from urllib.parse import urlparse, parse_qs, urlencode

HOSTS = {"youtube.com", "www.youtube.com", "music.youtube.com", "youtu.be", "open.spotify.com", "music.apple.com"}


def canonical_url(value):
    try:
        url = urlparse(value)
        if url.scheme != "https" or url.hostname not in HOSTS or url.username or url.password:
            return None
        if url.hostname == "youtu.be":
            return "https://www.youtube.com/watch?" + urlencode({"v": url.path.strip("/")})
        if url.hostname in {"youtube.com", "www.youtube.com", "music.youtube.com"}:
            video = parse_qs(url.query).get("v", [None])[0]
            if video:
                return "https://www.youtube.com/watch?" + urlencode({"v": video})
        return url._replace(query="", fragment="").geturl()
    except (TypeError, ValueError):
        return None


def fingerprint(record):
    value = json.dumps([record.get("url"), record.get("title")], ensure_ascii=False)
    return hashlib.sha256(value.encode()).hexdigest()


def scan_all(table):
    items = []
    args = {}
    while True:
        page = table.scan(**args)
        items.extend(page.get("Items", []))
        if not page.get("LastEvaluatedKey"):
            return items
        args["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def score(value):
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        return None
    number = float(value)
    return number if math.isfinite(number) and 0 <= number <= 10 else None


def model_catalog(records, features):
    result = []
    for record in records:
        if not record.get("message_id") or not canonical_url(record.get("url")):
            continue
        item = {"id": record["message_id"], "dopamine": score(record.get("dopamine")), "metadata_status": "unknown"}
        feature = features.get(record["message_id"], {})
        if feature.get("fingerprint") == fingerprint(record) and feature.get("status") == "matched" and feature.get("source") == "musicbrainz":
            item.update({"metadata_status": "matched", "title": str(feature["title"])[:200], "artist": str(feature["artist"])[:200], "tags": feature.get("tags", [])[:12], "source_url": feature["source_url"], "match_confidence": feature.get("confidence", "medium")})
        # Provider titles, URLs, contributor names, and timestamps never enter the model catalog.
        result.append(item)
    return result
