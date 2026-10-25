import { afterEach, describe, expect, it } from "vitest";

import { fixtureMusicPage } from "./fixture";
import { loadMusicPage } from "./source";

describe("データ源の切り替え", () => {
  const original = process.env.MUSIC_DATA_SOURCE;

  afterEach(() => {
    if (original === undefined) delete process.env.MUSIC_DATA_SOURCE;
    else process.env.MUSIC_DATA_SOURCE = original;
  });

  it("MUSIC_DATA_SOURCE=fixture なら Cloudflare の資格情報が無くても一覧が返る", async () => {
    process.env.MUSIC_DATA_SOURCE = "fixture";

    const page = await loadMusicPage({ query: "", page: 1 });
    expect(page).toEqual(fixtureMusicPage({ query: "", page: 1 }));
    expect(page.total).toBeGreaterThan(0);
  });

  it("検索語とページ番号はフィクスチャ側にもそのまま渡る", async () => {
    process.env.MUSIC_DATA_SOURCE = "fixture";

    const page = await loadMusicPage({ query: "beta", page: 99 });
    expect(page).toEqual(fixtureMusicPage({ query: "beta", page: 99 }));
    expect(page.total).toBe(1);
  });
});
