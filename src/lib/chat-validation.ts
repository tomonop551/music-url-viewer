export function parseChatInput(value: unknown): { message: string; reset: boolean; startNew?: boolean } {
  if (!value || typeof value !== "object") throw new Error("Invalid input");
  const body = value as Record<string, unknown>;
  if (body.reset === true) return { message: "", reset: true };
  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 1000) {
    throw new Error("Invalid message");
  }
  return { message: body.message.trim(), reset: false, ...(body.startNew === true ? { startNew: true } : {}) };
}

export function safeMusicUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      ["youtube.com", "www.youtube.com", "music.youtube.com", "youtu.be", "open.spotify.com", "music.apple.com"].includes(url.hostname);
  } catch { return false; }
}

export function parseAgentReply(value: unknown): { message: string; recommendations: { id: string; reason: string }[] } {
  if (!value || typeof value !== "object") throw new Error("Invalid reply");
  const reply = value as Record<string, unknown>;
  if (typeof reply.message !== "string" || !reply.message.trim() || reply.message.length > 3000 || !Array.isArray(reply.recommendations)) {
    throw new Error("Invalid reply");
  }
  const seen = new Set<string>();
  const recommendations: { id: string; reason: string }[] = [];
  for (const item of reply.recommendations) {
    if (!item || typeof item.id !== "string" || typeof item.reason !== "string" || item.reason.length > 500) throw new Error("Invalid recommendation");
    if (!seen.has(item.id) && recommendations.length < 3) {
      recommendations.push({ id: item.id, reason: item.reason });
      seen.add(item.id);
    }
  }
  return { message: reply.message, recommendations };
}
