import { describe, expect, it } from "vitest";

import { canonicalUrl, parseMusicRows } from "./catalog";
import { FIXTURE_DATA_SOURCE, fixtureMusicPage, fixtureMusicRows, isFixtureSource } from "./fixture";

describe("フィクスチャデータ源", () => {
  it("既定では使わない（opt-in）", () => {
    for (const value of [undefined, "", "d1", "FIXTURE", " fixture"]) {
      expect(isFixtureSource(value)).toBe(false);
    }
    expect(isFixtureSource(FIXTURE_DATA_SOURCE)).toBe(true);
  });

  it("同梱の行は一覧の検証を通り、新しい順に並ぶ", () => {
    const rows = fixtureMusicRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(parseMusicRows(rows)).toHaveLength(rows.length);

    const timestamps = rows.map((row) => row.timestamp);
    expect(timestamps).toEqual([...timestamps].sort().reverse());
  });

  it("URL は https の許可ホストだけを使う", () => {
    for (const row of fixtureMusicRows()) {
      expect(canonicalUrl(row.url)).not.toBeNull();
    }
  });

  it("件数と並び順は D1 版と同じ見え方になる", () => {
    const rows = fixtureMusicRows();
    const all = fixtureMusicPage();
    expect(all.total).toBe(rows.length);
    expect(all.page).toBe(1);
    expect(all.pageSize).toBe(50);
    expect(all.rows).toEqual(rows);
  });

  it("件数を超えるページ番号は最終ページへ丸める", () => {
    const rows = fixtureMusicRows();
    const over = fixtureMusicPage({ page: 99, pageSize: 2 });
    expect(over.lastPage).toBe(Math.ceil(rows.length / 2));
    expect(over.page).toBe(over.lastPage);
    expect(over.rows).toHaveLength(rows.length - (over.lastPage - 1) * 2);

    const under = fixtureMusicPage({ page: 0, pageSize: 2 });
    expect(under.page).toBe(1);
    expect(under.rows).toHaveLength(2);
  });

  it("検索は title と url の部分一致（大文字小文字を問わない）", () => {
    const byTitle = fixtureMusicPage({ query: "beta" });
    expect(byTitle.total).toBe(1);
    expect(byTitle.rows[0]?.message_id).toBe("fixture-0004");

    const byUrl = fixtureMusicPage({ query: "spotify.com" });
    expect(byUrl.total).toBe(1);
    expect(byUrl.rows[0]?.message_id).toBe("fixture-0004");

    expect(fixtureMusicPage({ query: "該当しない検索語" }).total).toBe(0);
  });
});
