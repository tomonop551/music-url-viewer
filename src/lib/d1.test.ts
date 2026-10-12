import { describe, expect, it, vi } from "vitest";
import { getD1Binding, getMusicPage, MUSIC_PAGE_SIZE, type D1Database, type D1PreparedStatement } from "./d1";

describe("D1 バインディングの検証", () => {
  it("欠落・別物は undefined を返してログに残す", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getD1Binding({})).toBeUndefined();
    expect(getD1Binding({ DB: { prepare: "not a function" } })).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("prepare と batch を持つならそのまま渡す", () => {
    const binding = { prepare: () => ({}), batch: async () => [] } as unknown as D1Database;
    expect(getD1Binding({ DB: binding })).toBe(binding);
  });
});

// 渡された SQL とパラメータを記録するだけの偽 D1。件数と行は呼び出し側が与える。
function fakeDb(total: number, rows: unknown[] = []) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const statement = (sql: string, params: unknown[]): D1PreparedStatement => ({
    bind: (...next: unknown[]) => statement(sql, next),
    first: async <T>() => { queries.push({ sql, params }); return { total } as T; },
    all: async <T>() => { queries.push({ sql, params }); return { results: rows as T[] }; },
    run: async () => ({ meta: { changes: 1 } }),
  });
  const db: D1Database = { prepare: (sql) => statement(sql, []), batch: async () => [] };
  return { db, queries };
}

const musicRow = {
  message_id: "1",
  url: "https://youtu.be/demo",
  timestamp: "2026-01-01T00:00:00Z",
};

describe("一覧のページング", () => {
  it("1 ページ目は 50 件を先頭から取る", async () => {
    const { db, queries } = fakeDb(222, [musicRow]);
    const result = await getMusicPage(db, {});
    expect(result).toMatchObject({ total: 222, page: 1, pageSize: MUSIC_PAGE_SIZE, lastPage: 5 });
    expect(result.rows).toEqual([{ message_id: "1", url: "https://youtu.be/demo", timestamp: "2026-01-01T00:00:00Z" }]);
    const select = queries[1];
    expect(select.sql).not.toContain("WHERE");
    expect(select.params).toEqual([MUSIC_PAGE_SIZE, 0]);
  });

  it("2 ページ目は OFFSET でずらす", async () => {
    const { db, queries } = fakeDb(222);
    await getMusicPage(db, { page: 2 });
    expect(queries[1].params).toEqual([MUSIC_PAGE_SIZE, MUSIC_PAGE_SIZE]);
  });

  it("件数を超えるページ指定は最終ページへ丸める", async () => {
    expect((await getMusicPage(fakeDb(222).db, { page: 99 })).page).toBe(5);
    // 0 件でも 1 ページ目として扱う（空のページに行き止まりを作らない）
    expect((await getMusicPage(fakeDb(0).db, { page: 3 })).page).toBe(1);
  });

  it("検索語はタイトルと URL の両方に当てる", async () => {
    const { db, queries } = fakeDb(3);
    await getMusicPage(db, { query: "  花譜  " });
    expect(queries[0].sql).toContain("title LIKE ?");
    expect(queries[0].sql).toContain("url LIKE ?");
    // 前後の空白は落として部分一致にする
    expect(queries[0].params).toEqual(["%花譜%", "%花譜%"]);
    expect(queries[1].params).toEqual(["%花譜%", "%花譜%", MUSIC_PAGE_SIZE, 0]);
  });

  it("ワイルドカードは文字として検索する", async () => {
    const { db, queries } = fakeDb(0);
    await getMusicPage(db, { query: "100%_test\\" });
    expect(queries[0].params).toEqual(["%100\\%\\_test\\\\%", "%100\\%\\_test\\\\%"]);
  });
});
