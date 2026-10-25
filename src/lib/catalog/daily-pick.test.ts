import { describe, expect, it } from "vitest";

import { jstDateKey, pickDailyIndex } from "./daily-pick";

describe("今日の一曲の選定", () => {
  it("同じ日付なら何度呼んでも同じ位置になる", () => {
    expect(pickDailyIndex("2026-10-26", 223)).toBe(pickDailyIndex("2026-10-26", 223));
    expect(pickDailyIndex("2026-10-26", 223)).toBe(130);
  });

  it("0 以上 total 未満に収まる", () => {
    for (const total of [1, 2, 5, 50, 223]) {
      for (let day = 1; day <= 31; day += 1) {
        const dateKey = `2026-10-${String(day).padStart(2, "0")}`;
        const index = pickDailyIndex(dateKey, total);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(total);
      }
    }
  });

  // 「同じ日は同じ曲、日付が変われば変わる」の後半。日付跨ぎで位置が動くことを固定する。
  it("日付が変われば選ばれる位置も変わる", () => {
    expect(pickDailyIndex("2026-10-26", 223)).toBe(130);
    expect(pickDailyIndex("2026-10-27", 223)).toBe(121);
  });

  it("1 曲しか無ければ常に先頭", () => {
    expect(pickDailyIndex("2026-10-26", 1)).toBe(0);
    expect(pickDailyIndex("2027-01-01", 1)).toBe(0);
  });

  // 空のカタログでもトップを落とさない。曲を描かない判断は呼び出し側が持つ。
  it("0 件や件数として使えない値でも落ちない", () => {
    expect(pickDailyIndex("2026-10-26", 0)).toBe(0);
    expect(pickDailyIndex("2026-10-26", -3)).toBe(0);
    expect(pickDailyIndex("2026-10-26", 2.9)).toBeLessThan(2);
    expect(pickDailyIndex("2026-10-26", Number.NaN)).toBe(0);
  });
});

describe("JST の日付文字列", () => {
  // UTC 15:00 = JST 翌日 0:00。この境界をまたぐと選曲の対象日が入れ替わる。
  it("UTC 15:00 を境に日付が変わる", () => {
    expect(jstDateKey(new Date("2026-10-26T14:59:59.999Z"))).toBe("2026-10-26");
    expect(jstDateKey(new Date("2026-10-26T15:00:00.000Z"))).toBe("2026-10-27");
  });

  it("年をまたいでも 2 桁で揃う", () => {
    expect(jstDateKey(new Date("2026-12-31T15:00:00.000Z"))).toBe("2027-01-01");
    expect(jstDateKey(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01");
  });
});
