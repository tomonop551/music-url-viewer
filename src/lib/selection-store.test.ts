import { afterEach, describe, expect, it } from "vitest";
import {
  clearStoredSelection,
  loadSelectedRecordsMap,
  RECORDS_KEY,
  loadStoredSelection,
  STORAGE_KEY,
  storeSelectedRecords,
  storeSelection,
  type SelectableRecord,
} from "./selection-store";

// storage への退避は「ページ/検索を跨いで選択を保持する」ため。刻み1までの
// 「ページ内完結」からここで拡張する。localStorage はブラウザの持ち物なので、
// 读み書きの形（JSON 配列・異常値の扱い）だけをここで固定する。
describe("選択状態の退避", () => {
  afterEach(() => clearStoredSelection());

  it("管制外の環境（localStorage 未定義）でも壊れない", () => {
    // 返り値は空集合、書き込みも例外を出さない
    expect(loadStoredSelection(() => { throw new Error("異常系"); })).toEqual(new Set());
    expect(() => storeSelection(new Set(["a"]), () => {
      throw new Error("storage に触れてはいけない");
    })).not.toThrow();
  });

  it("書き込んだ配列を読み戻すと同じ集合になる", () => {
    const backing = new Map<string, string>();
    const read = () => backing.get(STORAGE_KEY) ?? null;
    const write = (value: string) => backing.set(STORAGE_KEY, value);

    storeSelection(new Set(["b", "a"]), write);
    expect(loadStoredSelection(read)).toEqual(new Set(["a", "b"]));
  });

  it("保存値の配列から文字列要素だけを拾う（数値や null は握りつぶす）", () => {
    // 壊れた要素ごと全捨てにすると、1 要素の型崩れで選択が全消しになる。部分拾いの方が実害が小さい。
    expect(loadStoredSelection(() => '["a",42,null]')).toEqual(new Set(["a"]));
    for (const raw of ["", "not json", '{"a":1}', "null"]) {
      expect(loadStoredSelection(() => raw), raw).toEqual(new Set());
    }
  });

  it("null（キーが無い）は空集合", () => {
    expect(loadStoredSelection(() => null)).toEqual(new Set());
  });
});

// ---- 選択レコードの退避（書き出しのための材料）----

describe("選択レコードの退避", () => {
  const record = (over: Partial<SelectableRecord> = {}): SelectableRecord => ({
    message_id: "a",
    url: "https://youtu.be/a",
    timestamp: "2026-01-01T00:00:00Z",
    title: "A",
    ...over,
  });

  it("レコードを渡すと message_id をキーにした JSON を書き込む", () => {
    const backing = new Map<string, string>();
    storeSelectedRecords([record()], (key, value) => backing.set(key, value));
    expect(JSON.parse(backing.get(RECORDS_KEY)!)).toEqual({
      a: { message_id: "a", url: "https://youtu.be/a", timestamp: "2026-01-01T00:00:00Z", title: "A" },
    });
  });

  it("同じ message_id の書き込みは上書きになる（merge ではなく置き換え）", () => {
    const backing = new Map<string, string>();
    const write = (key: string, value: string) => backing.set(key, value);
    storeSelectedRecords([record({ title: "初回" })], write);
    storeSelectedRecords([record({ title: "差し替え" })], write);
    const map = loadSelectedRecordsMap(() => backing.get(RECORDS_KEY) ?? null);
    expect(map["a"].title).toBe("差し替え");
    expect(Object.keys(map)).toEqual(["a"]);
  });

  it("title 無しのレコードは title を付けずに保存する", () => {
    const backing = new Map<string, string>();
    storeSelectedRecords([record({ title: undefined })], (key, value) => backing.set(key, value));
    const map = loadSelectedRecordsMap(() => backing.get(RECORDS_KEY) ?? null);
    expect("title" in map["a"]).toBe(false);
  });

  it("壊れた保存値は空オブジェクトに倒す", () => {
    for (const raw of ["", "not json", '{"a":42}', "[]", "null"]) {
      expect(loadSelectedRecordsMap(() => raw), raw).toEqual({});
    }
  });

  it("形の合わない行だけを落とす（部分拾い）", () => {
    const raw = JSON.stringify({
      a: { message_id: "a", url: "https://youtu.be/a", timestamp: "t" },
      bad: { message_id: 42 },
      "no-url": { message_id: "b", timestamp: "t" },
    });
    const map = loadSelectedRecordsMap(() => raw);
    expect(Object.keys(map)).toEqual(["a"]);
  });

  it("読み取りの例外は空オブジェクト", () => {
    expect(loadSelectedRecordsMap(() => { throw new Error("異常系"); })).toEqual({});
  });
});
