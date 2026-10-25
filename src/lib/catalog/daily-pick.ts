// 「今日の一曲」の選定。時計にも D1 にも依存させず、日付文字列と件数だけで決める。
// SQL の外に置くことで、日付跨ぎや 0 件のときの挙動をユニットテストで固定できる。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// JST の日付を YYYY-MM-DD で返す。UTC のまま日付を取ると、日本時間の 0〜9 時に
// 前日の曲が選ばれる（Workers は UTC で動くため、ここで +9 時間してから日付を切る）。
export function jstDateKey(now: Date): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

// FNV-1a（32bit）。暗号学的な強さは要らず、同じ入力から常に同じ値が出ればよい。
function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// 日付文字列のハッシュを件数で割った余りを OFFSET として返す。
// 0 件（または件数として使えない値）のときは 0 を返すが、その場合の曲は存在しないので
// 呼び出し側が描画を見送る（ここで例外にすると、空のカタログでトップが落ちる）。
export function pickDailyIndex(dateKey: string, total: number): number {
  const size = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0;
  if (size === 0) return 0;
  return fnv1a(dateKey) % size;
}
