import { describe, expect, it } from "vitest";
import { buildSuggestCandidates } from "./ai-suggest";
import type { AiTagRow } from "./d1";
import type { MusicRow } from "./catalog";

// 候補の作り方を固定する。AI に渡す候補は多すぎると応答が遅くなるため、
// 「タグのある曲を優先し、足りない分を新しい順」で上限まで集める。
const row = (over: Partial<MusicRow> = {}): MusicRow => ({
  message_id: "a",
  url: "https://youtu.be/a",
  timestamp: "2026-01-01T00:00:00Z",
  title: "A",
  ...over,
});

const tags = (message_id: string): AiTagRow => ({
  message_id,
  artist: "アーティスト",
  genres: ["J-POP"],
  moods: ["切ない"],
  model: "m",
  created_at: "t",
  input_fingerprint: "f",
});

describe("候補の一括組み立て", () => {
  it("タグのある曲を優先し、足りない分を新しい順で埋める", () => {
    // rows は SQL（timestamp DESC）から来る前提なので、新しい順に並べて渡す
    const rows = [
      row({ message_id: "new", timestamp: "2026-06-01T00:00:00Z" }),
      row({ message_id: "old", timestamp: "2025-01-01T00:00:00Z" }),
      row({ message_id: "tagged" }),
    ];
    const map = new Map([["tagged", tags("tagged")]]);

    const candidates = buildSuggestCandidates(rows, map, 2);
    expect(candidates.map((c) => c.message_id)).toEqual(["tagged", "new"]);
  });

  it("上限に達したら残りは捨てる", () => {
    const rows = [row({ message_id: "a" }), row({ message_id: "b" }), row({ message_id: "c" })];
    const candidates = buildSuggestCandidates(rows, new Map(), 2);
    expect(candidates).toHaveLength(2);
  });

  it("title の無い行は対象外", () => {
    const rows = [row({ message_id: "a", title: undefined })];
    expect(buildSuggestCandidates(rows, new Map(), 10)).toHaveLength(0);
  });

  it("タグ付きが上限を超えるときはタグ付きだけで埋める", () => {
    const rows = [row({ message_id: "a" }), row({ message_id: "b" })];
    const map = new Map([
      ["a", tags("a")],
      ["b", tags("b")],
    ]);
    const candidates = buildSuggestCandidates(rows, map, 1);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].genres).toEqual(["J-POP"]);
  });
});
