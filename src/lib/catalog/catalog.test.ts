import { describe, expect, it } from "vitest";
import { canonicalUrl, parseMusicRows, score } from "./catalog";

describe("カタログ", () => {
  it("0 は未評価でも boolean でもない", () => {
    expect(score(0)).toBe(0);
    for (const value of [null, true, -1, 11, "10", Number.NaN]) expect(score(value)).toBeNull();
  });

  it("危険な URL は拒否される", () => {
    for (const value of [
      null,
      "javascript:alert(1)",
      "https://youtube.com.evil.example/watch",
      "https://user:pass@youtube.com/watch",
    ]) {
      expect(canonicalUrl(value)).toBeNull();
    }
    expect(canonicalUrl("https://youtu.be/demo?si=tracking")).toBe(
      "https://www.youtube.com/watch?v=demo",
    );
  });
});

describe("D1 行の検証", () => {
  it("形の合わない行だけを落とし、値の壊れた列は未取得に倒す", () => {
    const rows = parseMusicRows([
      {
        message_id: "ok",
        url: "https://youtu.be/ok",
        timestamp: "2026-01-01T00:00:00Z",
        title: "",
        dopamine: 12,
      },
      { message_id: "", url: "https://youtu.be/empty-id", timestamp: "2026-01-01T00:00:00Z" },
      null,
    ]);
    expect(rows).toEqual([
      { message_id: "ok", url: "https://youtu.be/ok", timestamp: "2026-01-01T00:00:00Z" },
    ]);
  });

  it("空文字のタイトルは未取得として扱う", () => {
    const rows = parseMusicRows([
      {
        message_id: "a",
        url: "https://youtu.be/a",
        timestamp: "2026-01-01T00:00:00Z",
        title: "  曲名  ",
      },
    ]);
    expect(rows[0].title).toBe("  曲名  ");
    expect(
      parseMusicRows([{ message_id: "b", url: "https://youtu.be/b", timestamp: "t", title: "" }])[0]
        .title,
    ).toBeUndefined();
  });
});
