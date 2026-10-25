// D1 データアクセス層。binding 型は構造的ミニマム（@cloudflare/workers-types 非依存で単体検証可能）。
import { z } from "zod";
import { parseMusicRows, type MusicRow } from "./catalog";

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

// バインディングは env から型アサーションで取り出されがちだが、欠落したまま進むと
// 「DB は繋がっているが 0 件」として静かに正常終了する。形を確かめ、欠落はログに残す。
const d1BindingSchema = z.custom<D1Database>(
  (value) => {
    const candidate = value as D1Database | undefined;
    return typeof candidate?.prepare === "function" && typeof candidate.batch === "function";
  },
  { error: "getCloudflareContext().env.DB に D1 バインディングが見つかりません" },
);

export function getD1Binding(env: unknown): D1Database | undefined {
  const parsed = z.object({ DB: d1BindingSchema }).safeParse(env);
  if (parsed.success) return parsed.data.DB;
  console.warn(`[d1] ${parsed.error.issues.map((issue) => issue.message).join(" / ")}`);
  return undefined;
}

// 一覧の 1 ページあたりの件数。毎回全件を取らずに済ませるための既定値。
export const MUSIC_PAGE_SIZE = 50;

const likeEscape = /[\\%_]/g;

// LIKE のワイルドカードを打ち消し、入力を「ただの文字列」として検索する
// （% や _ を含む検索語が意図せず全件一致になるのを防ぐ）。
function escapeLike(value: string): string {
  return value.replace(likeEscape, "\\$&");
}

const totalSchema = z.object({ total: z.number().int().nonnegative() });

export interface MusicPage {
  rows: MusicRow[];
  total: number; // 絞り込み後の総件数（ページ番号の算出と「N〜M 件目」の表示に使う）
  page: number;
  pageSize: number;
  lastPage: number;
}

// 一覧表示用。検索語とページ番号を受け取り、その範囲だけを D1 から取る。
// 検索はタイトルと URL の部分一致（タイトル未取得の行も URL で辿れるようにするため）。
export async function getMusicPage(
  db: D1Database,
  options: { query?: string; page?: number; pageSize?: number } = {},
): Promise<MusicPage> {
  const pageSize = options.pageSize ?? MUSIC_PAGE_SIZE;
  const query = (options.query ?? "").trim();
  const filter = query ? "WHERE (title LIKE ? ESCAPE '\\' OR url LIKE ? ESCAPE '\\')" : "";
  const pattern = `%${escapeLike(query)}%`;
  const filterParams = query ? [pattern, pattern] : [];

  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM music_catalog ${filter}`)
    .bind(...filterParams)
    .first<unknown>();
  const total = totalSchema.safeParse(totalRow).data?.total ?? 0;

  // 件数を超えるページ番号は最終ページへ丸める（URL を直接叩かれても空のページに落とさない）
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const requested =
    options.page === undefined || !Number.isFinite(options.page) ? 1 : Math.trunc(options.page);
  const page = Math.min(Math.max(1, requested), lastPage);

  const { results } = await db
    .prepare(
      `SELECT message_id, url, timestamp, title, dopamine
         FROM music_catalog ${filter}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?`,
    )
    .bind(...filterParams, pageSize, (page - 1) * pageSize)
    .all<unknown>();

  return { rows: parseMusicRows(results), total, page, pageSize, lastPage };
}

// 濃縮対象の選別に使う全行取得。一覧（ページング）とは別に、全件の title 有無を判定するため。
export async function getMusicRows(db: D1Database): Promise<MusicRow[]> {
  const { results } = await db
    .prepare(
      `SELECT message_id, url, timestamp, title, dopamine
         FROM music_catalog ORDER BY timestamp DESC`,
    )
    .all<unknown>();
  return parseMusicRows(results);
}

// ---- AI タグ（music_ai_tags）----
// テーブル定義は公開リポジトリに載せないため、migration ファイルは持たない。
// 列構成は aiTagRowSchema が唯一の情報源。

export interface AiTagRow {
  message_id: string;
  artist?: string;
  genres?: string[];
  moods?: string[];
  languages?: string[];
  era?: string;
  ai_dopamine?: number;
  model: string;
  created_at: string;
  input_fingerprint: string;
}

// D1 から読んだ行の検証。配列列（genres 等）は JSON 文字列で保存しているため、
// 読み出し時にパースする。壊れた行は落とさず「未取得」に倒す（1 行の破損で一覧を失わないため）。
function parseJsonArray(raw: unknown): string[] | undefined {
  if (typeof raw !== "string" || raw === "") return undefined;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;
  } catch {
    return undefined;
  }
}

export async function upsertAiTags(db: D1Database, row: AiTagRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO music_ai_tags
         (message_id, artist, genres, moods, languages, era, ai_dopamine, model, created_at, input_fingerprint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(message_id) DO UPDATE SET
         artist = excluded.artist,
         genres = excluded.genres,
         moods = excluded.moods,
         languages = excluded.languages,
         era = excluded.era,
         ai_dopamine = excluded.ai_dopamine,
         model = excluded.model,
         created_at = excluded.created_at,
         input_fingerprint = excluded.input_fingerprint`,
    )
    .bind(
      row.message_id,
      row.artist ?? null,
      row.genres ? JSON.stringify(row.genres) : null,
      row.moods ? JSON.stringify(row.moods) : null,
      row.languages ? JSON.stringify(row.languages) : null,
      row.era ?? null,
      row.ai_dopamine ?? null,
      row.model,
      row.created_at,
      row.input_fingerprint,
    )
    .run();
}

// AI 呼び出しの当日回数を原子的に加算し、新しい count を返す（1 リクエスト = 1 回）。
// テーブルは古いチャットの予算テーブルを転用せず、新しい用途として music_ai_budget を作る
// （列の意味が変わる転用は、後から読む人が誤解するため）。
export async function incrementAiBudget(db: D1Database, day: string): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO music_ai_budget(day, count) VALUES(?, 1)
       ON CONFLICT(day) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(day)
    .first<{ count: number }>();
  return row?.count ?? 1;
}

// 指定した曲のタグを1件だけ読む（個別の参照に使う）。無ければ null。
export async function getAiTags(db: D1Database, messageId: string): Promise<AiTagRow | null> {
  const row = await db
    .prepare(
      `SELECT message_id, artist, genres, moods, languages, era, ai_dopamine, model, created_at, input_fingerprint
         FROM music_ai_tags WHERE message_id = ?`,
    )
    .bind(messageId)
    .first<Record<string, unknown>>();
  return row ? rowToAiTag(row) : null;
}

// タグの一括取得。候補の組み立てで曲ごとに D1 を叩かないため
// （ Workers のサブリクエスト上限があり、曲数分のクエリは上限を超える）。
export async function getAiTagsMap(
  db: D1Database,
  messageIds: string[],
): Promise<Map<string, AiTagRow>> {
  if (messageIds.length === 0) return new Map();
  const placeholders = messageIds.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `SELECT message_id, artist, genres, moods, languages, era, ai_dopamine, model, created_at, input_fingerprint
         FROM music_ai_tags WHERE message_id IN (${placeholders})`,
    )
    .bind(...messageIds)
    .all<Record<string, unknown>>();
  return new Map(results.map((row) => [String(row.message_id), rowToAiTag(row)]));
}

function rowToAiTag(row: Record<string, unknown>): AiTagRow {
  const arr = (k: string) => parseJsonArray(row[k]);
  return {
    message_id: String(row.message_id),
    artist: typeof row.artist === "string" ? row.artist : undefined,
    genres: arr("genres"),
    moods: arr("moods"),
    languages: arr("languages"),
    era: typeof row.era === "string" ? row.era : undefined,
    ai_dopamine: typeof row.ai_dopamine === "number" ? row.ai_dopamine : undefined,
    model: String(row.model),
    created_at: String(row.created_at),
    input_fingerprint: String(row.input_fingerprint),
  };
}
