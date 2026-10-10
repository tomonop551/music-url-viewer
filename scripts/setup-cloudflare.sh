#!/usr/bin/env bash
# Cloudflare アカウント層の一度きり初期化: music-url-viewer 用 IaC。
#
# やること:
#   1. D1 database 作成 (music_url_viewer: catalog + features + chat session/budget/kv)
#   2. 作成された ID を wrangler.toml のプレースホルダへ自動反映
#
# 前提: `wrangler` が利用可能（`mise exec -- wrangler ...` 等）。ログイン済み
#       （`wrangler login`）。D1 は有料プラントークンが推奨（Workers Paid）。
# 実行: scripts/setup-cloudflare.sh
# 以後: `wrangler d1 migrations apply music_url_viewer` でスキーマ適用してから
#       `wrangler secret put <NAME>` でシークレットを設定し、デプロイ。

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
TOML="$ROOT/wrangler.toml"
W="wrangler"   # 必要なら `W="mise exec -- wrangler"` 等に差し替え

echo "==> create D1: music_url_viewer"
OUT_D1=$("$W" d1 create music_url_viewer --json)
D1_ID=$(printf '%s' "$OUT_D1" | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['database_id'])" 2>/dev/null || printf '%s' "$OUT_D1" | grep -oE '[0-9a-f-]{36}')
echo "     database_id=$D1_ID"

# ---- wrangler.toml のプレースホルダを置換 ----
python3 - "$TOML" "$D1_ID" <<'PY'
import sys
path, d1 = sys.argv[1], sys.argv[2]
s = open(path).read()
if "{MUSIC_URL_VIEWER_D1_ID}" not in s:
    print("WARN: placeholder {MUSIC_URL_VIEWER_D1_ID} not found"); sys.exit(1)
open(path, "w").write(s.replace("{MUSIC_URL_VIEWER_D1_ID}", d1))
print("==> wrangler.toml placeholder filled")
PY

echo ""
echo "次の手順:"
echo "  wrangler d1 migrations apply music_url_viewer   # スキーマ (migrations/0001_init.sql)"
echo "  wrangler secret put MUSICBRAINZ_USER_AGENT"
echo "  wrangler deploy"