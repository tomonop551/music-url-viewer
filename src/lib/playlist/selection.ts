// プレイリストの選択状態を扱う純関数群。
// コンポーネント（PlaylistSelector）から判定を寄せてここに置くことで、
// 「選択はページ内で完結する」「全選択は対象ページ内の選択可能な ID だけが対象」
// という挙動をコンポーネントを描かずに検証できる。

// 1 件の選択を切り替える。入力の集合は書き換えない（React の state 更新の前提）。
export function toggleSelection(selected: Set<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// 指定された ID をすべて選択に加える。既存の選択は残す。
export function selectMany(selected: Set<string>, ids: Iterable<string>): Set<string> {
  const next = new Set(selected);
  for (const id of ids) next.add(id);
  return next;
}

// 指定された ID を選択から外す。集合に無い ID が混ざっても集合は壊れない。
export function deselectMany(selected: Set<string>, ids: Iterable<string>): Set<string> {
  const next = new Set(selected);
  for (const id of ids) next.delete(id);
  return next;
}

// 件数表示用。選択のうち、いま表示しているページに載っている ID だけを数える。
// 選択をページ跨ぎで保持しない（刻み1の決定）ため、ページ外の選択は表示に反映しない。
export function countInPage(selected: Set<string>, pageIds: Iterable<string>): number {
  let count = 0;
  for (const id of pageIds) {
    if (selected.has(id)) count += 1;
  }
  return count;
}
