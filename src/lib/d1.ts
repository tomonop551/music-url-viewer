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
  const requested = options.page === undefined || !Number.isFinite(options.page) ? 1 : Math.trunc(options.page);
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
