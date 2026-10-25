import { describe, expect, it, vi } from "vitest";
import { pickDailyIndex } from "./daily-pick";
import {
  getD1Binding,
  getDailyPick,
  getMusicPage,
  MUSIC_PAGE_SIZE,
  type D1Database,
  type D1PreparedStatement,
} from "./d1";

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
    first: async <T>() => {
      queries.push({ sql, params });
      return { total } as T;
    },
    all: async <T>() => {
      queries.push({ sql, params });
      return { results: rows as T[] };
    },
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
    expect(result.rows).toEqual([
      { message_id: "1", url: "https://youtu.be/demo", timestamp: "2026-01-01T00:00:00Z" },
    ]);
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

// getDailyPick は「全件数」→「1 行」の順に first() を呼ぶ。呼び出し順で応答を返す偽 D1。
function fakePickDb(total: number, row: unknown | null) {
  const queries: { sql: string; params: unknown[] }[] = [];
  let calls = 0;
  const statement = (sql: string, params: unknown[]): D1PreparedStatement => ({
    bind: (...next: unknown[]) => statement(sql, next),
    first: async <T>() => {
      queries.push({ sql, params });
      calls += 1;
      return (calls === 1 ? { total } : row) as T | null;
    },
    all: async <T>() => {
      queries.push({ sql, params });
      return { results: [] as T[] };
    },
    run: async () => ({ meta: { changes: 1 } }),
  });
  const db: D1Database = { prepare: (sql) => statement(sql, []), batch: async () => [] };
  return { db, queries };
}

describe("今日の一曲の取得", () => {
  it("全件数から決めた OFFSET で 1 件だけ引く", async () => {
    const { db, queries } = fakePickDb(223, musicRow);
    const pick = await getDailyPick(db, "2026-10-26");

    expect(pick).toEqual({
      message_id: "1",
      url: "https://youtu.be/demo",
      timestamp: "2026-01-01T00:00:00Z",
    });
    // 検索語で絞らない（絞り込み後の件数で選ぶと、検索のたびに曲が変わる）
    expect(queries[0].sql).toContain("COUNT(*) AS total");
    expect(queries[0].sql).not.toContain("WHERE");
    expect(queries[1].sql).toContain("ORDER BY message_id");
    expect(queries[1].params).toEqual([pickDailyIndex("2026-10-26", 223)]);
  });

  it("同じ日付なら同じ OFFSET、日付が変われば変わる", async () => {
    const today = fakePickDb(223, musicRow);
    const sameDay = fakePickDb(223, musicRow);
    const tomorrow = fakePickDb(223, musicRow);
    await getDailyPick(today.db, "2026-10-26");
    await getDailyPick(sameDay.db, "2026-10-26");
    await getDailyPick(tomorrow.db, "2026-10-27");

    expect(sameDay.queries[1].params).toEqual(today.queries[1].params);
    expect(tomorrow.queries[1].params).not.toEqual(today.queries[1].params);
  });

  it("0 件なら行を引かずに null", async () => {
    const { db, queries } = fakePickDb(0, null);
    expect(await getDailyPick(db, "2026-10-26")).toBeNull();
    expect(queries).toHaveLength(1);
  });

  it("OFFSET の位置に行が無ければ null", async () => {
    const { db } = fakePickDb(223, null);
    expect(await getDailyPick(db, "2026-10-26")).toBeNull();
  });
});
