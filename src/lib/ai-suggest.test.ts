import { describe, expect, it } from "vitest";
import { buildSuggestPrompt, parseSuggestions, SUGGEST_SCHEMA } from "./ai-suggest";

// AI の提案は「候補の中から選ばせる」。候補に無い message_id が返ってきたら
// それは AI の幻覚なので、画面に出す前に落とす。
describe("提案応答の検証", () => {
  const allowed = new Set(["a", "b", "c"]);

  it("候補内の message_id を持つ提案を受け入れる", () => {
    const parsed = parseSuggestions(
      { recommendations: [{ message_id: "a", reason: "雨の日に合う" }] },
      allowed,
    );
    expect(parsed).toEqual([{ message_id: "a", reason: "雨の日に合う" }]);
  });

  it("候補に無い message_id は落とす（AI の幻覚対策）", () => {
    const parsed = parseSuggestions(
      {
        recommendations: [
          { message_id: "a", reason: "よい" },
          { message_id: "phantom", reason: "存在しない" },
        ],
      },
      allowed,
    );
    expect(parsed.map((r) => r.message_id)).toEqual(["a"]);
  });

  it("reason の無い提案は空文字に倒す（行ごと落とさない）", () => {
    const parsed = parseSuggestions(
      { recommendations: [{ message_id: "b" }] },
      allowed,
    );
    expect(parsed[0].reason).toBe("");
  });

  it("配列でない応答は空配列に倒す", () => {
    expect(parseSuggestions({ recommendations: "none" }, allowed)).toEqual([]);
    expect(parseSuggestions(null, allowed)).toEqual([]);
  });
});

describe("プロンプトの構成", () => {
  it("候補の message_id と title を渡す（URL は渡さない）", () => {
    const prompt = buildSuggestPrompt(
      "雨の日に聴きたい",
      [
        { message_id: "a", title: "雨のメロディ" },
        { message_id: "b", title: "ハイメンテナンスガール" },
      ],
    );
    expect(prompt).toContain("雨の日に聴きたい");
    expect(prompt).toContain("雨のメロディ");
    expect(prompt).not.toContain("https://");
  });
});

// structured outputs で使う JSON Schema が無事であることを固定する
describe("スキーマの妥当性", () => {
  it("recommendations は message_id と reason を要求する", () => {
    const props = (SUGGEST_SCHEMA as { properties: { recommendations: { items: { properties: Record<string, unknown> } } } }).properties.recommendations.items.properties;
    expect(Object.keys(props)).toContain("message_id");
    expect(Object.keys(props)).toContain("reason");
  });
});
