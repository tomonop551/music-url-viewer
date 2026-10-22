// CSV への変換。書き出し（プレイリストの持ち出し）で使う。
//
// RFC 4180 に沿った形にする。クオートが必要なのは、値にカンマ・ダブルクオート・
// 改行を含むとき。先頭に BOM を付けるのは、Excel で開いたときの文字化けを防ぐため
// （BOM 無しの UTF-8 は Excel が Shift_JIS と決め打ちする）。

const BOM = "\uFEFF";

// クオートが必要か。カンマ・ダブルクオート・改行を含む値は包む。
function quoteIfNeeded(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// 行をフラット化し、ヘッダーの順に並べた CSV を作る。
// 行のキーがヘッダーに無い場合は無視する（列の順序はヘッダーが決める）。
export function toCsv(
  rows: Record<string, string | number | undefined>[],
  header: string[],
): string {
  const lines = [header.join(",")];
  for (const row of rows) {
    const cells = header.map((key) => {
      const value = row[key];
      if (value === undefined || value === null) return "";
      return quoteIfNeeded(String(value));
    });
    lines.push(cells.join(","));
  }
  return BOM + lines.join("\n");
}
