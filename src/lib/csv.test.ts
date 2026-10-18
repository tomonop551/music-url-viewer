import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

// CSV は「持ち出し」の形式。表計算ソフトとテキストエディタのどちらでも
// 開けることを優先し、BOM 付き UTF-8 の標準的な形にする。
describe("CSV への変換", () => {
  it("ヘッダーと行をカンマで結合する（BOM を含む）", () => {
    const csv = toCsv(
      [
        { message_id: "a", title: "曲A" },
        { message_id: "b", title: "曲B" },
      ],
      ["message_id", "title"],
    );
    expect(csv).toBe("\uFEFFmessage_id,title\na,曲A\nb,曲B");
  });

  it("BOM を先頭に付ける（Excel で開いても文字化けしないため）", () => {
    const csv = toCsv([{ a: "1" }], ["a"]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });

  it("カンマを含む値はクオートする", () => {
    const csv = toCsv([{ t: "花譜, ライブ" }], ["t"]);
    expect(csv).toBe("\uFEFFt\n\"花譜, ライブ\"");
  });

  it("ダブルクオートは二重にして、値もクオートする", () => {
    const csv = toCsv([{ t: '「過去"を喰らう"」' }], ["t"]);
    expect(csv).toBe('\uFEFFt\n"「過去""を喰らう""」"');
  });

  it("改行を含む値はクオートする", () => {
    const csv = toCsv([{ t: "1行目\n2行目" }], ["t"]);
    expect(csv).toBe("\uFEFFt\n\"1行目\n2行目\"");
  });

  it("該当行が無くてもヘッダーだけは出す", () => {
    const csv = toCsv([], ["message_id", "url"]);
    expect(csv).toBe("\uFEFFmessage_id,url");
  });
});
