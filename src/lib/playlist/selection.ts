// プレイリストの選択状態を扱う純関数群。
// コンポーネント（PlaylistSelector）から判定を寄せてここに置くことで、
// 「全選択は対象ページ内の選択可能な ID だけが対象」という挙動を
// コンポーネントを描かずに検証できる。

// 1 件の選択を切り替える。入力の集合は書き換えない（React の state 更新の前提）。
export function toggleSelection(selected: Set<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) {
    next.delete(id);
    return next;
  }
  next.add(id);
  return next;
}

// 指定された ID をすべて選択に加える。既存の選択は残す。
export function selectMany(selected: Set<string>, ids: Iterable<string>): Set<string> {
  return new Set([...selected, ...ids]);
}

// 指定された ID を選択から外す。集合に無い ID が混ざっても集合は壊れない。
export function deselectMany(selected: Set<string>, ids: Iterable<string>): Set<string> {
  const drop = new Set(ids);
  return new Set([...selected].filter((id) => !drop.has(id)));
}

// 件数表示用。選択のうち、いま表示しているページに載っている ID だけを数える。
// 「全選択」の対象が対象ページ内の選択可能な ID であるため、ページ外の選択は数えない。
export function countInPage(selected: Set<string>, pageIds: Iterable<string>): number {
  return [...pageIds].filter((id) => selected.has(id)).length;
}
