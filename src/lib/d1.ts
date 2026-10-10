// D1 データアクセス層。binding 型は構造的ミニマム（@cloudflare/workers-types 非依存で単体検証可能）。
import { modelCatalog, type CatalogItem, type FeatureRow, type MusicRow } from "./catalog";
import type { ChatTurn } from "./recommender";

export interface D1PreparedStatement {
  bind(...params: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number; last_row_id?: number; changed_db?: boolean } }>;
}
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

export async function getMusicRows(db: D1Database): Promise<MusicRow[]> {
  const { results } = await db
    .prepare(
      `SELECT message_id, url, user_name, timestamp, title, dopamine
         FROM music_catalog ORDER BY timestamp DESC`,
    )
    .all<MusicRow>();
  return results;
}

export async function getFeatureMap(db: D1Database): Promise<Map<string, FeatureRow>> {
  const { results } = await db
    .prepare(
      `SELECT message_id, fingerprint, status, source, title, artist, tags, source_url, confidence
         FROM music_features`,
    )
    .all<FeatureRow>();
  return new Map(results.map((r) => [r.message_id, r]));
}

export async function getModelCatalog(db: D1Database): Promise<CatalogItem[]> {
  const [rows, features] = await Promise.all([getMusicRows(db), getFeatureMap(db)]);
  return modelCatalog(rows, features);
}

export async function resolveCatalogRecords(
  db: D1Database,
  ids: string[],
): Promise<Pick<MusicRow, "message_id" | "url" | "title" | "dopamine">[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `SELECT message_id, url, title, dopamine
         FROM music_catalog WHERE message_id IN (${placeholders})`,
    )
    .bind(...ids)
    .all<Pick<MusicRow, "message_id" | "url" | "title" | "dopamine">>();
  return results;
}

export async function seedSession(db: D1Database, sessionId: string, now: number): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO music_chat_session(session_id, history, updated_at)
       VALUES(?, '[]', ?)`,
    )
    .bind(sessionId, now)
    .run();
}

// 原子条件付きでロック取得。busy / 直前 2 秒以内の再送は false（429 相当）。
export async function acquireSessionLock(
  db: D1Database,
  sessionId: string,
  now: number,
  lockId: string,
): Promise<boolean> {
  const busyUntil = now + 90;
  const recent = now - 2;
  const res = await db
    .prepare(
      `UPDATE music_chat_session
          SET busy_until = ?, lock_id = ?, last_request = ?, updated_at = ?
        WHERE session_id = ?
          AND (busy_until IS NULL OR busy_until < ?)
          AND (last_request IS NULL OR last_request < ?)`,
    )
    .bind(busyUntil, lockId, now, now, sessionId, now, recent)
    .run();
  return res.meta.changes === 1;
}

export async function getSessionHistory(db: D1Database, sessionId: string): Promise<ChatTurn[]> {
  const row = await db
    .prepare(`SELECT history FROM music_chat_session WHERE session_id = ?`)
    .bind(sessionId)
    .first<{ history: string }>();
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.history);
    return Array.isArray(parsed) ? (parsed as ChatTurn[]) : [];
  } catch {
    return [];
  }
}

export async function setSessionHistory(
  db: D1Database,
  sessionId: string,
  history: ChatTurn[],
  lockId: string,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE music_chat_session SET history = ?, updated_at = ?
        WHERE session_id = ? AND lock_id = ?`,
    )
    .bind(JSON.stringify(history), now, sessionId, lockId)
    .run();
}

export async function clearSessionHistory(
  db: D1Database,
  sessionId: string,
  lockId: string,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE music_chat_session SET history = '[]', updated_at = ?
        WHERE session_id = ? AND lock_id = ?`,
    )
    .bind(now, sessionId, lockId)
    .run();
}

export async function releaseSessionLock(
  db: D1Database,
  sessionId: string,
  lockId: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE music_chat_session SET busy_until = NULL, lock_id = NULL
        WHERE session_id = ? AND lock_id = ?`,
    )
    .bind(sessionId, lockId)
    .run();
}

// アトミックに加算し新しい count を返す。caller が daily_limit と比較する。
export async function incrementBudget(db: D1Database, day: string): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO music_chat_budget(day, count) VALUES(?, 1)
       ON CONFLICT(day) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(day)
    .first<{ count: number }>();
  return row?.count ?? 1;
}