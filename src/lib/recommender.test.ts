import { describe, expect, it, vi } from "vitest";
import { filterCatalog, recommend, validateReply, type CallModel, type ChatInput, type ToolCall } from "./recommender";
import type { CatalogItem } from "./catalog";

const demo: CatalogItem = { id: "demo", dopamine: 8, metadata_status: "unknown" };

describe("recommender 検証", () => {
  it("未登録 id は fail-closed", () => {
    expect(() =>
      validateReply({ message: "候補です", recommendations: [{ id: "invented", reason: "理由" }] }, new Set(["registered"])),
    ).toThrow("Unregistered recommendation");
  });

  it("0 未評価や boolean 的な dopamine 絞り込みを拒否", () => {
    const catalog: CatalogItem[] = [
      { id: "zero", dopamine: 0, metadata_status: "unknown" },
      { id: "missing", dopamine: null, metadata_status: "unknown" },
    ];
    expect(filterCatalog(catalog, { max_dopamine: 0 }).map((i) => i.id)).toEqual(["zero"]);
    expect(() => filterCatalog(catalog, { min_dopamine: true })).toThrow();
    expect(() => filterCatalog(catalog, { min_dopamine: 11 })).toThrow();
    expect(() => filterCatalog(catalog, { min_dopamine: 7, max_dopamine: 5 })).toThrow();
  });

  it("空フィルタは全件返す", () => {
    const catalog: CatalogItem[] = [
      { id: "zero", dopamine: 0, metadata_status: "unknown" },
      { id: "missing", dopamine: null, metadata_status: "unknown" },
    ];
    expect(filterCatalog(catalog, {}).map((i) => i.id).sort()).toEqual(["missing", "zero"]);
  });
});

describe("recommender ツールループ", () => {
  const input: ChatInput = { message: "クセになる曲", history: [] };

  it("取得した候補のみ選択する", async () => {
    const callModel = vi.fn<CallModel>();
    callModel
      .mockResolvedValueOnce([tool("search_catalog", { min_dopamine: 7 })])
      .mockResolvedValueOnce([tool("submit_recommendations", { message: "中毒性で選びました", recommendations: [{ id: "demo", reason: "中毒性8/10です" }] })]);
    const result = await recommend(input, [demo], callModel);
    expect(result.recommendations[0].id).toBe("demo");
    expect(callModel).toHaveBeenCalledTimes(2);
  });

  it("曲を選ばずに質問できる", async () => {
    const callModel = vi.fn<CallModel>();
    callModel.mockResolvedValueOnce([
      tool("submit_recommendations", { message: "落ち着きたいですか？", recommendations: [] }),
    ]);
    const result = await recommend(input, [], callModel);
    expect(result.recommendations).toEqual([]);
  });

  it("繰り返し検索は上限付き", async () => {
    const callModel = vi.fn<CallModel>();
    callModel.mockResolvedValue([tool("search_catalog", {})]);
    await expect(recommend(input, [], callModel)).rejects.toThrow("Tool limit exceeded");
    expect(callModel).toHaveBeenCalledTimes(3);
  });

  it("未知のツールは fail-closed", async () => {
    const callModel = vi.fn<CallModel>();
    callModel.mockResolvedValueOnce([tool("injected", {})]);
    await expect(recommend(input, [], callModel)).rejects.toThrow("Unknown tool");
  });
});

function tool(name: string, args: Record<string, unknown>): ToolCall {
  return { name, arguments: args };
}