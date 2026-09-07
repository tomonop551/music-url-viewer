"""Resolve registered links against MusicBrainz without sending provider metadata to an LLM."""
import json
import os
import re
import time
import unicodedata
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from catalog import canonical_url, fingerprint, scan_all

_last_request = 0.0


def mb_get(path, params):
    global _last_request
    time.sleep(max(0, 1.1 - (time.monotonic() - _last_request)))
    _last_request = time.monotonic()
    request = Request("https://musicbrainz.org/ws/2/" + path + "?" + urlencode({**params, "fmt": "json"}), headers={"User-Agent": os.environ["MUSICBRAINZ_USER_AGENT"], "Accept": "application/json"})
    try:
        with urlopen(request, timeout=8) as response:
            return json.loads(response.read(1_000_000))
    except HTTPError as error:
        if error.code == 404:
            return {}
        raise


def normalized(value):
    return re.sub(r"[^\w]", "", unicodedata.normalize("NFKC", value).casefold())


def choose_recording(records, original_title):
    source = normalized(original_title)
    matches = []
    for record in records:
        title = normalized(record.get("title", ""))
        artists = [normalized(credit.get("artist", {}).get("name", "")) for credit in record.get("artist-credit", []) if isinstance(credit, dict)]
        if int(record.get("score", 0)) >= 95 and len(title) >= 3 and title in source and any(len(artist) >= 3 and artist in source for artist in artists):
            matches.append(record)
    # Multiple recordings (including alternate versions) remain unresolved.
    unique = {record["id"]: record for record in matches}
    return next(iter(unique.values())) if len(unique) == 1 else None


def resolve(record):
    url = canonical_url(record.get("url"))
    if not url:
        return None
    linked = mb_get("url", {"resource": url, "inc": "recording-rels"})
    targets = {rel["recording"]["id"] for rel in linked.get("relations", []) if "recording" in rel}
    match_method = "url_relation"
    if len(targets) == 1:
        recording_id = next(iter(targets))
    elif len(targets) > 1:
        return None
    else:
        title = str(record.get("title", ""))[:300]
        if title in {"", "Error", "No Title Found"}:
            return None
        # This deterministic lookup is not an AI request. Only independent MusicBrainz results are retained.
        cleaned = re.sub(r"\s*(?:\| Spotify|[-|] YouTube)$", "", title, flags=re.I)
        cleaned = re.sub(r"song and lyrics by|official (?:music )?video|official audio", " ", cleaned, flags=re.I)
        query = " ".join(re.findall(r"\w+", cleaned))
        found = choose_recording(mb_get("recording", {"query": query, "limit": 10}).get("recordings", []), title)
        if not found:
            return None
        recording_id = found["id"]
        match_method = "title_and_artist"
    details = mb_get("recording/" + recording_id, {"inc": "artist-credits+tags"})
    if not details.get("title"):
        return None
    artists = " / ".join(credit.get("artist", {}).get("name", "") for credit in details.get("artist-credit", []) if isinstance(credit, dict))
    tags = [str(tag["name"])[:60] for tag in sorted(details.get("tags", []), key=lambda tag: int(tag.get("count", 0)), reverse=True) if int(tag.get("count", 0)) > 0][:12]
    return {"status": "matched", "source": "musicbrainz", "source_url": "https://musicbrainz.org/recording/" + recording_id, "title": details["title"], "artist": artists, "tags": tags, "match_method": match_method, "confidence": "high" if match_method == "url_relation" else "medium", "version": 1}


def handler(event, context):
    import boto3
    db = boto3.resource("dynamodb")
    catalog = db.Table(os.environ["MUSIC_TABLE_NAME"])
    features = db.Table(os.environ["FEATURES_TABLE_NAME"])
    saved = {item["message_id"]: item for item in scan_all(features)}
    now = int(time.time())
    processed = 0
    failed = 0
    for record in scan_all(catalog):
        if processed >= 25 or (context and context.get_remaining_time_in_millis() < 45000):
            break
        if not record.get("message_id") or not canonical_url(record.get("url")):
            continue
        old = saved.get(record["message_id"], {})
        digest = fingerprint(record)
        if old.get("retry_after", 0) > now:
            continue
        if old.get("fingerprint") == digest and old.get("refresh_after", 0) > now:
            continue
        try:
            result = resolve(record) or {"status": "unknown", "version": 1}
            features.put_item(Item={"message_id": record["message_id"], "fingerprint": digest, "updated_at": now, "refresh_after": now + (604800 if result["status"] == "matched" else 86400), **result})
        except Exception:
            # Do not replace known metadata on a transient upstream failure or log catalog contents.
            features.put_item(Item={**old, "message_id": record["message_id"], "fingerprint": old.get("fingerprint", digest), "retry_after": now + 3600})
            failed += 1
        processed += 1
    print(json.dumps({"processed": processed, "failed": failed}))
    if failed:
        raise RuntimeError("Metadata refresh had upstream failures")
    return {"processed": processed}
