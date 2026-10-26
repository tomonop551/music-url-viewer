// ローカル開発用のフィクスチャデータ源（opt-in）。
//
// `MUSIC_DATA_SOURCE=fixture` のときだけ同梱 JSON を読み、D1 のバインディングも
// Cloudflare の資格情報も無い状態で一覧とプレイリスト画面を確認できるようにする。
// 既定（未設定・その他の値）は現行どおり D1 を読むため、本番の見え方は変わらない。
import { parseMusicRows, type MusicRow } from "./catalog";
import { pickDailyIndex } from "./daily-pick";
import { MUSIC_PAGE_SIZE, type MusicPage } from "./d1";

import fixture from "./fixtures/music-catalog.json";

export const FIXTURE_DATA_SOURCE = "fixture";

export function isFixtureSource(value: unknown): boolean {
  return value === FIXTURE_DATA_SOURCE;
}

// ISO-8601 の文字列は辞書順が時刻順になる（D1 側の ORDER BY timestamp DESC と同じ並び）。
function newestFirst(a: MusicRow, b: MusicRow): number {
  if (a.timestamp === b.timestamp) return 0;
  return a.timestamp < b.timestamp ? 1 : -1;
}

// 一覧と同じ検証（musicRowSchema）を通してから使う。フィクスチャでも本番と同じ基準で
// 行が落ちるため、「フィクスチャでは表示できるが本番では消える」というズレを持ち込まない。
export function fixtureMusicRows(): MusicRow[] {
  return parseMusicRows(fixture).sort(newestFirst);
}

// D1 版 getMusicPage と同じ見え方（部分一致の絞り込み → 新しい順 → ページ丸め）を再現する。
// 絞り込みの対象（title と url）・最終ページへの丸め・既定ページサイズを揃えないと、
// ローカルと本番でページ数や件数が食い違う。
export function fixtureMusicPage(
  options: { query?: string; page?: number; pageSize?: number } = {},
): MusicPage {
  const pageSize = options.pageSize ?? MUSIC_PAGE_SIZE;
  const query = (options.query ?? "").trim().toLowerCase();
  const matched = query
    ? fixtureMusicRows().filter(
        (row) =>
          (row.title ?? "").toLowerCase().includes(query) || row.url.toLowerCase().includes(query),
      )
    : fixtureMusicRows();

  const total = matched.length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const requested =
    options.page === undefined || !Number.isFinite(options.page) ? 1 : Math.trunc(options.page);
  const page = Math.min(Math.max(1, requested), lastPage);

  return {
    rows: matched.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
    lastPage,
  };
}

// D1 版 getDailyPick と同じ選び方をする。並びを message_id 昇順に揃えないと、
// ローカル（フィクスチャ）と本番で別の曲が「今日の一曲」になる。
export function fixtureDailyPick(dateKey: string): MusicRow | null {
  const rows = [...fixtureMusicRows()].sort((a, b) => {
    if (a.message_id === b.message_id) return 0;
    return a.message_id < b.message_id ? -1 : 1;
  });
  return rows[pickDailyIndex(dateKey, rows.length)] ?? null;
}
