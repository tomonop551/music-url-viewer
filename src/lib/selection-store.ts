// 選択状態のlocalStorage への退避。
// ページ送りや検索のたびにクライアントコンポーネントは作り直されるため、
// 刻み1の「ページ内完結」のままでは跨いだ選択が消える。そこでここに退避する。
// 読み取りはマウント後（useEffect）に行う前提。SSR と localStorage の値は
// 独立しているため、描画に使うと hydration の食い違いになる（Readme.md とは別）。

export const STORAGE_KEY = "music-url-viewer:selected";

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
