// カタログ境界。Provider 由来の未信頼フィールドは catalog 出力に含めない（LLM に渡さない）。
import { z } from "zod";
import { Sha256 } from "./sha256";

// 0–10 の有限数だけを嗜好性として通す。boolean・範囲外・NaN は「未評価」に倒す。
// ここで null に寄せるのは、値が壊れた 1 行のせいで曲ごと一覧から消えるのを避けるため。
export function score(value: unknown): number | null {
  if (typeof value === "boolean" || typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >= 0 && value <= 10 ? value : null;
}

// D1 の all<T>() は型アサーションで中身を検証しないため、信頼の起点をこのスキーマに置く。
// 下流（一覧表示・LLM に渡すカタログ）は検証済みの値だけを受け取る。
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

export const featureRowSchema = z.object({
  message_id: z.string().min(1),
  fingerprint: z.string().min(1),
  status: z.string().min(1),
  source: optionalText,
  title: optionalText,
  artist: optionalText,
  tags: optionalText, // JSON 配列文字列
  source_url: optionalText,
  confidence: optionalText,
});

export type MusicRow = z.infer<typeof musicRowSchema>;
export type FeatureRow = z.infer<typeof featureRowSchema>;

export interface CatalogItem {
  id: string;
  dopamine: number | null;
  metadata_status: "matched" | "unknown";
  title?: string;
  artist?: string;
  tags?: string[];
  source_url?: string;
  match_confidence?: string;
}

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

export async function fingerprint(record: { url?: unknown; title?: unknown }): Promise<string> {
  return Sha256.hex(JSON.stringify([record.url ?? null, record.title ?? null]));
}

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

// fingerprint が一致した musicbrainz メタだけ付与する。不一致なら独立メタは出さない。
export async function modelCatalog(
  records: MusicRow[],
  features: Map<string, FeatureRow>,
): Promise<CatalogItem[]> {
  const result: CatalogItem[] = [];
  for (const record of records) {
    if (!record.message_id || !canonicalUrl(record.url)) continue;
    const digest = await fingerprint(record);
    const item: CatalogItem = {
      id: record.message_id,
      dopamine: score(record.dopamine),
      metadata_status: "unknown",
    };
    const feature = features.get(record.message_id);
    if (feature && feature.fingerprint === digest && feature.status === "matched" && feature.source === "musicbrainz") {
      item.metadata_status = "matched";
      item.title = String(feature.title ?? "").slice(0, 200);
      item.artist = String(feature.artist ?? "").slice(0, 200);
      item.tags = parseTags(feature.tags).slice(0, 12);
      item.source_url = feature.source_url ?? undefined;
      item.match_confidence = feature.confidence ?? "medium";
    }
    result.push(item);
  }
  return result;
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

export function parseFeatureRows(values: unknown[]): FeatureRow[] {
  return parseRows(featureRowSchema, values, "music_features");
}
