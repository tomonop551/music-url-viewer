// 一覧（/）とプレイリスト（/playlists）で同じデータ源を使うための切り替え。
// 画面ごとに分岐を書くと、片方だけフィクスチャに載る／載らないというズレが起きる。
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getD1Binding, getMusicPage, MUSIC_PAGE_SIZE, type MusicPage } from "./d1";
import { fixtureMusicPage, isFixtureSource } from "./fixture";

const EMPTY_PAGE: MusicPage = {
  rows: [],
  total: 0,
  page: 1,
  pageSize: MUSIC_PAGE_SIZE,
  lastPage: 1,
};

// opt-in。`MUSIC_DATA_SOURCE=fixture` のときだけ同梱フィクスチャを読み、既定はこれまでどおり
// D1 を読む（本番の見え方を変えない）。
export async function loadMusicPage({
  query,
  page,
}: {
  query: string;
  page: number;
}): Promise<MusicPage> {
  if (isFixtureSource(process.env.MUSIC_DATA_SOURCE)) return fixtureMusicPage({ query, page });

  const db = getD1Binding(getCloudflareContext().env);
  return db ? getMusicPage(db, { query, page }) : EMPTY_PAGE;
}
