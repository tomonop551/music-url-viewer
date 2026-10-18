import { z } from "zod";

// AI の提案は「候補の中から選ばせる」。候補に無い message_id が返ってきたら
// それは AI の幻覚なので、画面に出す前に落とす。

export const SUGGEST_SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          message_id: { type: "string", description: "候補の message_id" },
          reason: { type: "string", description: "このテーマで選んだ理由（1 文）" },
        },
        required: ["message_id", "reason"],
        additionalProperties: false,
      },
      description: "テーマに合う曲の提案（最大 3 件）",
    },
  },
  required: ["recommendations"],
  additionalProperties: false,
} as const;

export interface Suggestion {
  message_id: string;
  reason: string;
}

// 応答の検証。候補に無い message_id は落とし、reason の無い行は空文字に倒す
// （行ごと落とすと、理由の書き忘れだけで提案自体が消えてしまうため）。
export function parseSuggestions(value: unknown, allowed: Set<string>): Suggestion[] {
  const parsed = z
    .object({
      recommendations: z
        .array(
          z.object({
            message_id: z.string(),
            reason: z.string().optional().default(""),
          }),
        )
        .optional(),
    })
    .transform((v) => v.recommendations ?? [])
    .safeParse(value);
  if (!parsed.success) return [];

  return parsed.data
    .filter((r) => allowed.has(r.message_id))
    .map((r) => ({ message_id: r.message_id, reason: r.reason }));
}

// プロンプトにはテーマと候補（message_id / title / タグ）を渡す。URL は渡さない
// （トラッキングパラメータを AI に見せる利益が無いため）。
export interface SuggestCandidate {
  message_id: string;
  title?: string;
  artist?: string;
  genres?: string[];
  moods?: string[];
}

export function buildSuggestPrompt(theme: string, candidates: SuggestCandidate[]): string {
  const lines = [
    `テーマ「${theme}」に合う曲を、下の候補から最大 3 つ選んで提案してください。`,
    "必ず候補に書かれた message_id のみを使い、候補外の曲を提案しないでください。",
    "",
    "候補:",
  ];
  for (const c of candidates) {
    const tags = [
      c.artist,
      c.genres?.length ? `ジャンル: ${c.genres.join("/")}` : undefined,
      c.moods?.length ? `雰囲気: ${c.moods.join("/")}` : undefined,
    ]
      .filter(Boolean)
      .join(" ");
    lines.push(`- ${c.message_id}: ${c.title ?? "(無題)"}${tags ? ` ${tags}` : ""}`);
  }
  return lines.join("\n");
}
