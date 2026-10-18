// 選択状態のlocalStorage への退避。
// ページ送りや検索のたびにクライアントコンポーネントは作り直されるため、
// 刻み1の「ページ内完結」のままでは跨いだ選択が消える。そこでここに退避する。
// 読み取りはマウント後（useEffect）に行う前提。SSR と localStorage の値は
// 独立しているため、描画に使うと hydration の食い違いになる（Readme.md とは別）。

import type { MusicUrlRecord } from "@/types/music";

export const STORAGE_KEY = "music-url-viewer:selected";
// 選択対象のレコード（title / url / timestamp）を退避するキー。書き出しの直前に読み出す。
export const RECORDS_KEY = "music-url-viewer:selected-records";

export type SelectableRecord = Pick<MusicUrlRecord, "message_id" | "url" | "timestamp" | "title">;

// 生の取得/保存関数を受け取る。localStorage の有無は呼び出し側の環境次第なので、
// ここはNode でも単体検証できるよう、/storage への直接参照をコンポーネント側に任せる。
export type RawReader = () => string | null;
export type RawWriter = (value: string) => void;

// 保存値は message_id の JSON 配列。形の合わない値はすべて「無選択」に倒す
// （黙って壊れた値を使い続けると、選べなくなった原因が画面から見えなくなる）。
export function loadStoredSelection(read: RawReader): Set<string> {
  let raw: string | null;
  try {
    raw = read();
  } catch {
    return new Set<string>();
  }
  if (raw === null) return new Set<string>();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Set<string>();
  }
  if (!Array.isArray(parsed)) return new Set<string>();

  const ids = parsed.filter((value): value is string => typeof value === "string" && value !== "");
  return new Set(ids);
}

// 保存に失敗（private mode / quota 超過）しても選択の操作自体は生かす。
// 退避できなかったことは無視できないが、画面の_OPERABILITY を落とす理由にはならない。
export function storeSelection(selected: Set<string>, write: RawWriter): void {
  try {
    write(JSON.stringify([...selected]));
  } catch {
    // 保存できないこと（quota など）より、今の選択操作を優先する
  }
}

// 後片付け。テストと「全解除」で使う。
export function clearStoredSelection(remove: (key: string) => void = () => {}): void {
  try {
    remove(STORAGE_KEY);
  } catch {
    // 失敗は無視（クリアできないだけで、選択操作には影響しない）
  }
}

// ---- 選択レコードの退避（書き出しのための材料）----

// 選択時に渡されたレコードを、message_id をキーにしたオブジェクトで退避する。
// 配列にしないのは、選択と解除を繰り返しても同じ message_id の書き込みが
// 上書き（merge）で済むようにするため。
export function storeSelectedRecords(
  records: SelectableRecord[],
  write: (key: string, value: string) => void,
  key: string = RECORDS_KEY,
): void {
  try {
    // 解除してもレコードは残す。書き出しの対象は選択側（STORAGE_KEY）で絞るため、
    // ここは「一度見た曲の情報のキャッシュ」として振る舞う。
    const existing: Record<string, SelectableRecord> = {};
    for (const record of records) {
      existing[record.message_id] = record;
    }
    write(key, JSON.stringify(existing));
  } catch {
    // 保存できなくても選択操作は生かす（selection と同じ線引き）
  }
}

// 保存値を読み戻す。壊れた値は「無選択」として空オブジェクトに倒す。
// 値は message_id → レコード の形。形の合わない行だけを落とす（部分拾い）。
export function loadSelectedRecordsMap(
  read: RawReader,
  _key: string = RECORDS_KEY,
): Record<string, SelectableRecord> {
  let raw: string | null;
  try {
    raw = read();
  } catch {
    return {};
  }
  if (raw === null) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

  const out: Record<string, SelectableRecord> = {};
  for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const rec = value as Record<string, unknown>;
    if (typeof rec.message_id !== "string" || rec.message_id === "") continue;
    if (typeof rec.url !== "string" || rec.url === "") continue;
    if (typeof rec.timestamp !== "string" || rec.timestamp === "") continue;
    out[id] = {
      message_id: rec.message_id,
      url: rec.url,
      timestamp: rec.timestamp,
      ...(typeof rec.title === "string" && rec.title !== "" ? { title: rec.title } : {}),
    };
  }
  return out;
}

