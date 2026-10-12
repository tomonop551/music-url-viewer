import { z } from "zod";

// チャット境界の検証。ユーザー入力もモデル出力も未信頼データとして扱い、
// ここを通ったものだけを後段（D1 への保存・UI への返却）に渡す。

// 生の長さで上限を掛けてから trim する（全角空白だけの入力を空として弾く順序にするため）。
const messageSchema = z.string().max(1000).trim().min(1);

export interface ChatRequest {
  message: string;
  reset: boolean;
  startNew?: boolean;
}

// リセット指示が来たら message は要求しない（reset を優先する）。
export const chatRequestBodySchema = z.union([
  z.object({ reset: z.literal(true) }).transform(() => ({ message: "", reset: true as const })),
  z
    .object({ message: messageSchema, startNew: z.boolean().optional() })
    .transform((v) => ({
      message: v.message,
      reset: false as const,
      ...(v.startNew ? { startNew: true as const } : {}),
    })),
]);

export function parseChatInput(value: unknown): ChatRequest {
  const parsed = chatRequestBodySchema.safeParse(value);
  if (!parsed.success) throw new Error("Invalid input");
  return parsed.data;
}

// URL は「スキーマで形を表す」より「型ガードとして使う」方が噛み合うため、判定関数のまま残す。
export function safeMusicUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      ["youtube.com", "www.youtube.com", "music.youtube.com", "youtu.be", "open.spotify.com", "music.apple.com"].includes(url.hostname);
  } catch { return false; }
}

export const agentReplySchema = z.object({
  message: z.string().max(3000).trim().min(1),
  recommendations: z.array(z.object({ id: z.string().min(1), reason: z.string().max(500) })),
});

export function parseAgentReply(value: unknown): { message: string; recommendations: { id: string; reason: string }[] } {
  const parsed = agentReplySchema.safeParse(value);
  if (!parsed.success) throw new Error("Invalid reply");
  const unique = [...new Map(parsed.data.recommendations.map((item) => [item.id, item])).values()];
  return { message: parsed.data.message, recommendations: unique.slice(0, 3) };
}
