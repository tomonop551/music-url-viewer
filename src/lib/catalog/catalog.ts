// カタログ境界。D1 から読んだ行の検証と、URL の表示用正規化を担う。
// かつては LLM へ渡すカタログ生成（modelCatalog / featureRowSchema）もここにあったが、
// チャット機能の削除（issue なし・2026-10）に合わせて除いてある。
import { z } from "zod";

// 0–10 の有限数だけを嗜好性として通す。boolean・範囲外・NaN は「未評価」に倒す。
// ここで null に寄せるのは、値が壊れた 1 行のせいで曲ごと一覧から消えるのを避けるため。
export function score(value: unknown): number | null {
  if (typeof value === "boolean" || typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >= 0 && value <= 10 ? value : null;
}

// D1 の all<T>() は型アサーションで中身を検証しないため、信頼の起点をこのスキーマに置く。
// 空文字・null は「未取得」に寄せる（表示側は値の有無だけで判断できる）。
const optionalText = z
  .string()
  .nullish()
  .transform((v) => v || undefined)
  .optional();

export const musicRowSchema = z.object({
  message_id: z.string().min(1),
  url: z.string().min(1),
  timestamp: z.string().min(1),
  title: optionalText,
  // 0–10 の有限数以外は「未評価」に倒す。値が壊れた 1 行のせいで曲ごと消えるのを避ける。
  dopamine: z
    .unknown()
    .transform((v) => score(v) ?? undefined)
    .optional(),
});

export type MusicRow = z.infer<typeof musicRowSchema>;

const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "open.spotify.com",
  "music.apple.com",
]);

// https + ホワイトリストホスト以外は拒否（SSRF 予防）。youtube 系は watch?v=<id> へ正規化。
export function canonicalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return null;
  }
  if (
    u.protocol !== "https:" ||
    !HOSTS.has(u.hostname) ||
    u.username !== "" ||
    u.password !== ""
  ) {
    return null;
  }
  if (u.hostname === "youtu.be") {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(u.pathname.replace(/^\/+/, ""))}`;
  }
  if (u.hostname === "youtube.com" || u.hostname === "www.youtube.com" || u.hostname === "music.youtube.com") {
    const video = u.searchParams.get("v");
    if (video) return `https://www.youtube.com/watch?v=${encodeURIComponent(video)}`;
  }
  return u.origin + u.pathname;
}

// 形の合わない行はその行だけ落とす。1 行の破損で一覧全体を失わないため。
// 落としたことはログに残す（黙って欠けると「データが消えた」と誤解される）。
function parseRows<T>(schema: z.ZodType<T>, values: unknown[], label: string): T[] {
  const rows: T[] = [];
  let dropped = 0;
  for (const value of values) {
    const parsed = schema.safeParse(value);
    if (parsed.success) rows.push(parsed.data);
    else dropped += 1;
  }
  if (dropped > 0) console.warn(`[catalog] ${label} の ${dropped} 行を検証で除外しました`);
  return rows;
}

export function parseMusicRows(values: unknown[]): MusicRow[] {
  return parseRows(musicRowSchema, values, "music_catalog");
}
