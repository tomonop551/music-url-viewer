import { describe, expect, it, vi } from "vitest";
import { filterCatalog, recommend, validateReply, type CallModel, type ChatInput, type ToolCall } from "./recommender";
import type { CatalogItem } from "./catalog";

const demo: CatalogItem = { id: "demo", dopamine: 8, metadata_status: "unknown" };

describe("recommender validation", () => {
  it("unregistered ids fail closed", () => {
    expect(() =>
      validateReply({ message: "候補です", recommendations: [{ id: "invented", reason: "理由" }] }, new Set(["registered"])),
    ).toThrow("Unregistered recommendation");
  });

  it("rejects zero-not-missing and boolean-like dopamine filters", () => {
    const catalog: CatalogItem[] = [
      { id: "zero", dopamine: 0, metadata_status: "unknown" },
      { id: "missing", dopamine: null, metadata_status: "unknown" },
    ];
    expect(filterCatalog(catalog, { max_dopamine: 0 }).map((i) => i.id)).toEqual(["zero"]);
    expect(() => filterCatalog(catalog, { min_dopamine: true })).toThrow();
    expect(() => filterCatalog(catalog, { min_dopamine: 11 })).toThrow();
    expect(() => filterCatalog(catalog, { min_dopamine: 7, max_dopamine: 5 })).toThrow();
  });

  it("empty filter returns everything", () => {
    const catalog: CatalogItem[] = [
      { id: "zero", dopamine: 0, metadata_status: "unknown" },
      { id: "missing", dopamine: null, metadata_status: "unknown" },
    ];
    expect(filterCatalog(catalog, {}).map((i) => i.id).sort()).toEqual(["missing", "zero"]);
  });
});

describe("recommender tool loop", () => {
  const input: ChatInput = { message: "クセになる曲", history: [] };

  it("selects only retrieved candidates", async () => {
    const callModel = vi.fn<CallModel>();
    callModel
      .mockResolvedValueOnce([tool("search_catalog", { min_dopamine: 7 })])
      .mockResolvedValueOnce([tool("submit_recommendations", { message: "中毒性で選びました", recommendations: [{ id: "demo", reason: "中毒性8/10です" }] })]);
    const result = await recommend(input, [demo], callModel);
    expect(result.recommendations[0].id).toBe("demo");
    expect(callModel).toHaveBeenCalledTimes(2);
  });

  it("can ask without selecting tracks", async () => {
    const callModel = vi.fn<CallModel>();
    callModel.mockResolvedValueOnce([
      tool("submit_recommendations", { message: "落ち着きたいですか？", recommendations: [] }),
    ]);
    const result = await recommend(input, [], callModel);
    expect(result.recommendations).toEqual([]);
  });

  it("repeated search is bounded", async () => {
    const callModel = vi.fn<CallModel>();
    callModel.mockResolvedValue([tool("search_catalog", {})]);
    await expect(recommend(input, [], callModel)).rejects.toThrow("Tool limit exceeded");
    expect(callModel).toHaveBeenCalledTimes(3);
  });

  it("unknown tool fails closed", async () => {
    const callModel = vi.fn<CallModel>();
    callModel.mockResolvedValueOnce([tool("injected", {})]);
    await expect(recommend(input, [], callModel)).rejects.toThrow("Unknown tool");
  });
});

function tool(name: string, args: Record<string, unknown>): ToolCall {
  return { name, arguments: args };
}