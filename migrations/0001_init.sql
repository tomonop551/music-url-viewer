-- D1 migration: music-url-viewer Cloudflare 移行スキーマ
-- 対象 issue #1。データ移行方針は issue コメント参照。
--
-- 設計メモ:
--  * DynamoDB `MusicUrls`・`${name}-features`・`${name}-chat` は全て message_id/session/day で
--    関連し合うため、単一の D1 データベース（binding `DB`）に同居させる。DB を跨ぐ join は不可。
--  * chat のセッションロック（busy_until）と日次枠の加算は「原子条件付き更新」が必須。
--    KV は compare-and-set 不可のため再現できない → chat は D1 に置く（TTL は定期 cleanup Worker）。
--  * `dopamine` は 0–10、NULL = 未評価。bool や範囲外は不正値として扱う。
--  * `music_features.tags` は JSON 文字列（配列）で保存し、json1 関数で操作。

-- 旧 DynamoDB `MusicUrls`: 登録済み音楽カタログ
CREATE TABLE IF NOT EXISTS music_catalog (
  message_id TEXT PRIMARY KEY,               -- PK（登録 ID）
  url        TEXT NOT NULL,                  -- 正規化済み https 音源 URL
  user_name  TEXT NOT NULL,                  -- 投稿者名
  timestamp  TEXT NOT NULL,                  -- ISO-8601（一覧はこれで降順ソート）
  title      TEXT,                           -- 投稿時タイトル（任意）
  dopamine   REAL CHECK (dopamine IS NULL OR (dopamine >= 0 AND dopamine <= 10)) -- 0–10 嗜好性
);

-- 一覧表示: 最新順
CREATE INDEX IF NOT EXISTS idx_music_catalog_ts ON music_catalog(timestamp DESC);

-- 旧 DynamoDB `${name}-features`: MusicBrainz 独立メタデータ（取り込み Worker が更新）
CREATE TABLE IF NOT EXISTS music_features (
  message_id    TEXT PRIMARY KEY,            -- music_catalog.message_id と対応（FK は使わずアプリ整合）
  fingerprint   TEXT NOT NULL,               -- sha256([url, title]) … url/title 変更検知
  status        TEXT NOT NULL DEFAULT 'unknown', -- 'matched' | 'unknown'
  source        TEXT,                        -- 'musicbrainz'
  title         TEXT,                        -- MusicBrainz タイトル（≤200）
  artist        TEXT,                        -- 参加者名 "a / b"（≤200）
  tags          TEXT,                        -- JSON 配列（≤12、各≤60）※json1 で参照
  source_url    TEXT,                        -- MusicBrainz recording URL
  match_method  TEXT,                        -- 'url_relation' | 'title_and_artist'
  confidence    TEXT,                        -- 'high' | 'medium'
  version       INTEGER NOT NULL DEFAULT 1,
  updated_at    INTEGER NOT NULL,            -- epoch 秒
  refresh_after INTEGER NOT NULL DEFAULT 0,  -- epoch 秒…ここを過ぎたら再チェック
  retry_after   INTEGER NOT NULL DEFAULT 0   -- epoch 秒…一時失敗時の再試行ホールド
);

-- 取り込み Worker の「期限切れレコード抽出」用
CREATE INDEX IF NOT EXISTS idx_music_features_refresh ON music_features(refresh_after);

-- 旧 `${name}-chat` のセッション（会話履歴・並行ロック）。原子条件付き更新で制御し、
-- クリーンアップ Worker が更新時刻から TTL（既定 24h）を過ぎた行を削除する。
CREATE TABLE IF NOT EXISTS music_chat_session (
  session_id   TEXT PRIMARY KEY,             -- cookie で識別する UUID
  history      TEXT NOT NULL DEFAULT '[]',   -- JSON 配列 [ {role, text} … ]（最大 12 要素）
  busy_until   INTEGER,                      -- epoch 秒…処理中の排他ロック
  lock_id      TEXT,                         -- ロック取得者の token（解放確認用）
  last_request INTEGER,                      -- epoch 秒…直近リクエスト（重複抑制）
  updated_at   INTEGER NOT NULL              -- ロールが古い行の TTL 撤去に使う
);

-- 旧 `${name}-chat` のうち key-value 用途（汎用）。クリーンアップ Worker が key 単位で
-- 期限切れを削除しても良い。
CREATE TABLE IF NOT EXISTS music_chat_kv (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 旧 `${name}-chat` の日次枠: 原子インクリメント（加算と上限判定が一貫）。
CREATE TABLE IF NOT EXISTS music_chat_budget (
  day   TEXT PRIMARY KEY,      -- 'YYYY-MM-DD'
  count INTEGER NOT NULL DEFAULT 0
);

-- 日次枠はアトミックに加算し、その値を返す:
--   INSERT INTO music_chat_budget(day,count) VALUES(?,1)
--   ON CONFLICT(day) DO UPDATE SET count = count + 1
--   RETURNING count;
-- 返り値 > :daily_limit の場合は 429 相当を返す。