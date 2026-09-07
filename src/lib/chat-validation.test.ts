import { describe, expect, it } from "vitest";
import { parseAgentReply, parseChatInput, safeMusicUrl } from "./chat-validation";

describe("chat boundary", () => {
  it("rejects empty, oversized, and non-string input", () => {
    for (const value of [null, {}, { message: "  " }, { message: 1 }, { message: "a".repeat(1001) }]) expect(() => parseChatInput(value)).toThrow();
    expect(parseChatInput({ message: " 集中したい " })).toEqual({ message: "集中したい", reset: false });
  });
  it("does not trust lookalike domains, scripts, or URL credentials", () => {
    for (const url of ["javascript:alert(1)", "https://youtube.com.attacker.example/video", "https://user:pass@youtube.com/watch?v=demo", "http://youtu.be/demo", "https://example.com"]) expect(safeMusicUrl(url)).toBe(false);
    expect(safeMusicUrl("https://open.spotify.com/track/demo")).toBe(true);
    expect(safeMusicUrl("https://youtu.be/demo")).toBe(true);
  });
  it("rejects malformed model output and deduplicates recommendations", () => {
    expect(() => parseAgentReply({ message: "hello", recommendations: [{ id: "demo", reason: 5 }] })).toThrow();
    const pick = { id: "demo", reason: "推定です" };
    expect(parseAgentReply({ message: "候補です", recommendations: [pick, pick] }).recommendations).toEqual([pick]);
  });
});
