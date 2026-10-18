import { describe, expect, it } from "vitest";
import {
  countInPage,
  toggleSelection,
  selectMany,
  deselectMany,
} from "./selection";

// 選択状態は Set<message_id>。コンポーネントはこの純関数に判定を寄せ、
// ここで「全選択は対象ページ内の選択可能な ID だけが対象」「選択はページを跨がない」
// という刻み1で決めた挙動を固定する。
const ids = ["a", "b", "c"];

describe("1件のトグル", () => {
  it("未選択→選択済み", () => {
    const next = toggleSelection(new Set<string>(), "a");
    expect(next.has("a")).toBe(true);
    expect(next.size).toBe(1);
  });

  it("選択済み→解除", () => {
    const next = toggleSelection(new Set(ids), "b");
    expect(next.has("b")).toBe(false);
    expect(next.size).toBe(2);
  });

  it("元の集合を書き換えない（不変）", () => {
    const prev = new Set(ids);
    toggleSelection(prev, "x");
    expect([...prev].sort()).toEqual(["a", "b", "c"]);
  });
});

describe("まとめて入れ替え", () => {
  it("selectMany は指定IDを選択に加える", () => {
    const next = selectMany(new Set<string>(), ids);
    expect([...next].sort()).toEqual(ids);
  });

  it("selectMany は既存の選択を残す", () => {
    const next = selectMany(new Set(["z"]), ids);
    expect([...next].sort()).toEqual([...ids, "z"].sort());
  });

  it("deselectMany は指定IDだけを外す", () => {
    const next = deselectMany(new Set(ids), ["b"]);
    expect([...next].sort()).toEqual(["a", "c"]);
  });

  it("deselectMany は集合に無いIDを渡されても壊れない", () => {
    const next = deselectMany(new Set(ids), ["zzz"]);
    expect([...next].sort()).toEqual(ids);
  });
});

describe("ページ内の件数", () => {
  it("選択のうち、対象ページに載っているIDだけを数える", () => {
    // ページを跨いで選択を保持しない（刻み1の決定）ため、
    // 「表示中のページにないID」は件数に数えない
    const selected = new Set(["a", "c", "other-page"]);
    expect(countInPage(selected, ["a", "c", "x"])).toBe(2);
  });

  it("ページに何もなければ 0", () => {
    expect(countInPage(new Set(["a"]), [])).toBe(0);
  });
});
