import { describe, expect, it, vi } from "vitest";
import { getD1Binding, type D1Database } from "./d1";

describe("D1 バインディングの検証", () => {
  it("欠落・別物は undefined を返してログに残す", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getD1Binding({})).toBeUndefined();
    expect(getD1Binding({ DB: { prepare: "not a function" } })).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("prepare と batch を持つならそのまま渡す", () => {
    const binding = { prepare: () => ({}), batch: async () => [] } as unknown as D1Database;
    expect(getD1Binding({ DB: binding })).toBe(binding);
  });
});
