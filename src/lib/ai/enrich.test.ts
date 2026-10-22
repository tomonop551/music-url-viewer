import { describe, expect, it } from "vitest";
import { parseAiTags, buildEnrichPrompt, pickEnrichTargets } from "./enrich";

// AI の出力は境界値。schema 通りの形しか保存しない（壊れた行で DB を汚さないため）。
describe("AI 出力の検証", () => {
  it("正常な応答を受け入れる", () => {
    const tags = parseAiTags({
      artist: "花譜",
      genres: ["J-POP", "電子音楽"],
      moods: ["切ない", "中毒性"],
      languages: ["ja"],
      era: "2020s",
      ai_dopamine: 7,
    });
    expect(tags.genres).toEqual(["J-POP", "電子音楽"]);
    expect(tags.ai_dopamine).toBe(7);
  });

  it("範囲外の ai_dopamine は未評価（undefined）に倒す", () => {
    for (const v of [-1, 11, "7", Number.NaN]) {
      const tags = parseAiTags({ ai_dopamine: v });
      expect(tags.ai_dopamine).toBeUndefined();
    }
  });

  it("配列でない genres 等は空配列に倒す", () => {
    const tags = parseAiTags({ genres: "J-POP", moods: 42 });
    expect(tags.genres).toEqual([]);
    expect(tags.moods).toEqual([]);
  });
});

describe("プロンプトの構成", () => {
  it("title だけを入力にする（URL のクエリや本文を渡さない）", () => {
    const prompt = buildEnrichPrompt({ title: "花譜　#22　「過去を喰らう」" });
    expect(prompt).toContain("花譜");
    expect(prompt).not.toContain("si=");
    expect(prompt).not.toContain("https://");
  });
});

describe("濃縮対象の選別", () => {
  it("title の無い行は対象外", () => {
    const rows = [
      { message_id: "a", url: "https://youtu.be/a", timestamp: "t", title: "A" },
      { message_id: "b", url: "https://youtu.be/b", timestamp: "t" },
    ];
    expect(pickEnrichTargets(rows).map((r) => r.message_id)).toEqual(["a"]);
  });
});
