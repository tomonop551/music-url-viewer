// カタログ境界。Provider 由来の未信頼フィールドは catalog 出力に含めない（LLM に渡さない）。
import { Sha256 } from "./sha256";

export interface MusicRow {
  message_id: string;
  url: string;
  user_name: string;
  timestamp: string;
  title?: string | null;
  dopamine?: number | null;
}

export interface FeatureRow {
  message_id: string;
  fingerprint: string;
  status: string;
  source?: string | null;
  title?: string | null;
  artist?: string | null;
  tags?: string | null; // JSON 配列文字列
  source_url?: string | null;
  confidence?: string | null;
}

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

export function score(value: unknown): number | null {
  if (typeof value === "boolean" || typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >= 0 && value <= 10 ? value : null;
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

export function validListRows(rows: MusicRow[]): MusicRow[] {
  return rows.filter((r) => r.message_id && r.url && r.timestamp);
}