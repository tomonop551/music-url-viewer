import { z } from "zod";

// AI の推定値の境界。score()（catalog.ts）と同じく、範囲外・不正値は「未評価」に倒す。
// 値が壊れた 1 行のせいで曲ごと落ちるのを避けるため。
const optionalStringArray = z
  .unknown()
  .transform((v) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []))
  .optional();

const optionalDopamine = z
  .unknown()
  .transform((v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10 ? v : undefined))
  .optional();

export const aiTagsSchema = z.object({
  artist: z.unknown().transform((v) => (typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, 200) : undefined)).optional(),
  genres: optionalStringArray,
  moods: optionalStringArray,
  languages: optionalStringArray,
  era: z.unknown().transform((v) => (typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, 40) : undefined)).optional(),
  ai_dopamine: optionalDopamine,
});

export type AiTags = z.infer<typeof aiTagsSchema>;

export function parseAiTags(value: unknown): AiTags {
  return aiTagsSchema.parse(value);
}

// 入力は title のみ。URL のクエリ（トラッキングパラメータ）や本文は AI に渡さない。
export function buildEnrichPrompt(record: { title?: string }): string {
  return [
    "次の曲について、アーティスト名・ジャンル・雰囲気・言語・年代・0〜10 の中毒性を推定してください。",
    "JSON 形式で返してください。",
    "",
    `曲名: ${record.title ?? ""}`,
  ].join("\n");
}

// 濃縮対象は title のある行だけ。title 無しでは推定の材料が無いため。
// 行の型は呼び出し側が持つ形（message_id 等を含む）をそのまま維持する。
export function pickEnrichTargets<Row extends { title?: string | null }>(
  rows: Row[],
): (Row & { title: string })[] {
  return rows.filter((r): r is Row & { title: string } =>
    typeof r.title === "string" && r.title.trim() !== ""
  );
}
