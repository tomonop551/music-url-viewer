import { describe, expect, it } from "vitest";
import { parseAgentReply, parseChatInput, safeMusicUrl } from "./chat-validation";

describe("chat 境界", () => {
  it("空・長すぎ・非文字列入力を拒否", () => {
    for (const value of [null, {}, { message: "  " }, { message: 1 }, { message: "a".repeat(1001) }]) expect(() => parseChatInput(value)).toThrow();
    expect(parseChatInput({ message: " 集中したい " })).toEqual({ message: "集中したい", reset: false });
  });
  it("似せドメイン・スクリプト・URL 資格情報を信頼しない", () => {
    for (const url of ["javascript:alert(1)", "https://youtube.com.attacker.example/video", "https://user:pass@youtube.com/watch?v=demo", "http://youtu.be/demo", "https://example.com"]) expect(safeMusicUrl(url)).toBe(false);
    expect(safeMusicUrl("https://open.spotify.com/track/demo")).toBe(true);
    expect(safeMusicUrl("https://youtu.be/demo")).toBe(true);
  });
  it("不正なモデル出力を拒否し、推奨を重複排除", () => {
    expect(() => parseAgentReply({ message: "hello", recommendations: [{ id: "demo", reason: 5 }] })).toThrow();
    const pick = { id: "demo", reason: "推定です" };
    expect(parseAgentReply({ message: "候補です", recommendations: [pick, pick] }).recommendations).toEqual([pick]);
  });
});
