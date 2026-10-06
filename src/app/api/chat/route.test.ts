import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  incrementBudget: vi.fn(),
  seedSession: vi.fn(),
  acquireSessionLock: vi.fn(),
  getModelCatalog: vi.fn(),
  resolveCatalogRecords: vi.fn(),
  getSessionHistory: vi.fn(),
  clearSessionHistory: vi.fn(),
  setSessionHistory: vi.fn(),
  releaseSessionLock: vi.fn(),
  callModel: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookieGet, set: mocks.cookieSet }) }));
// d1 は SQL 実行の外部層としてモックし、route のオーケストレーションを検証する
// （d1.ts 自体の SQL 整合は別途実 SQLite テストが担保）。
vi.mock("@/lib/d1", () => ({
  incrementBudget: () => mocks.incrementBudget(),
  seedSession: () => mocks.seedSession(),
  acquireSessionLock: () => mocks.acquireSessionLock(),
  getModelCatalog: () => mocks.getModelCatalog(),
  resolveCatalogRecords: () => mocks.resolveCatalogRecords(),
  getSessionHistory: () => mocks.getSessionHistory(),
  clearSessionHistory: () => mocks.clearSessionHistory(),
  setSessionHistory: () => mocks.setSessionHistory(),
  releaseSessionLock: () => mocks.releaseSessionLock(),
}));
vi.mock("@/lib/ai", () => ({ bindWorkersAi: () => mocks.callModel }));

import { POST } from "./route";

const request = (body: unknown, origin = "https://example.com") =>
  new Request("https://example.com/api/chat", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_ORIGIN", "https://example.com");
  vi.stubEnv("CHAT_DAILY_LIMIT", "200");
  vi.stubEnv("AI_MODEL_ID", "example-model");
  mocks.cookieGet.mockReturnValue(undefined);
  mocks.incrementBudget.mockResolvedValue(1);
  mocks.seedSession.mockResolvedValue(undefined);
  mocks.acquireSessionLock.mockResolvedValue(true);
  mocks.getSessionHistory.mockResolvedValue([]);
  mocks.getModelCatalog.mockResolvedValue([]);
  mocks.resolveCatalogRecords.mockResolvedValue([]);
  mocks.clearSessionHistory.mockResolvedValue(undefined);
  mocks.setSessionHistory.mockResolvedValue(undefined);
  mocks.releaseSessionLock.mockResolvedValue(undefined);
  // 2 ターンの tool ループ: 検索で allowed を埋めてから submit
  mocks.callModel
    .mockResolvedValueOnce([{ name: "search_catalog", arguments: {} }])
    .mockResolvedValueOnce([
      { name: "submit_recommendations", arguments: { message: "候補です", recommendations: [{ id: "demo", reason: "中毒性0/10" }, { id: "deleted", reason: "候補" }] } },
    ]);
});
afterEach(() => vi.unstubAllEnvs());

describe("chat API", () => {
  it("rejects cross-origin requests before any storage/ai access", async () => {
    expect((await POST(request({ message: "曲を探して" }, "https://other.example"))).status).toBe(403);
    expect(mocks.incrementBudget).not.toHaveBeenCalled();
    expect(mocks.callModel).not.toHaveBeenCalled();
  });

  it("fails closed when origin config or input is invalid", async () => {
    vi.unstubAllEnvs();
    expect((await POST(request({ message: "hello" }))).status).toBe(503);
    expect(mocks.incrementBudget).not.toHaveBeenCalled();
    vi.stubEnv("APP_ORIGIN", "https://example.com");
    vi.stubEnv("CHAT_DAILY_LIMIT", "200");
    expect((await POST(request({ message: "x".repeat(1001) }))).status).toBe(400);
    expect(mocks.incrementBudget).not.toHaveBeenCalled();
  });

  it("resolves current links, drops deleted tracks, and resets context on startNew", async () => {
    mocks.getModelCatalog.mockResolvedValue([
      { id: "demo", dopamine: 0, metadata_status: "unknown" },
      { id: "deleted", dopamine: 8, metadata_status: "unknown" },
    ]);
    mocks.resolveCatalogRecords.mockResolvedValue([
      { message_id: "demo", title: "Example track", url: "https://youtu.be/example", dopamine: 0 },
    ]);
    const response = await POST(request({ message: "中毒性で選んで", startNew: true }));
    expect(response.status).toBe(200);
    const reply = (await response.json()) as {
      message: string;
      recommendations: Array<{ id: string; title: string; url: string; dopamine?: number; reason: string }>;
    };
    expect(reply.recommendations).toEqual([{ id: "demo", title: "Example track", url: "https://youtu.be/example", dopamine: 0, reason: "中毒性0/10" }]);
    expect(mocks.cookieSet).toHaveBeenCalledWith("music_chat_session", expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: "strict" }));
    expect(mocks.setSessionHistory).toHaveBeenCalled();
    expect(mocks.releaseSessionLock).toHaveBeenCalled();
  });

  it("preserves prior turns for follow-up requests", async () => {
    mocks.getSessionHistory.mockResolvedValue([
      { role: "user", text: "old context" },
      { role: "assistant", text: "old reply" },
    ]);
    await POST(request({ message: "別の曲" }));
    const msgs = mocks.callModel.mock.calls[0][0].messages;
    expect(msgs.slice(0, 2)).toEqual([
      { role: "user", content: "old context" },
      { role: "assistant", content: "old reply" },
    ]);
    expect(msgs[2]).toEqual({ role: "user", content: "別の曲" });
  });

  it("stops before inference when the shared budget is exhausted", async () => {
    mocks.incrementBudget.mockResolvedValue(201); // > dailyLimit(200)
    expect((await POST(request({ message: "曲" }))).status).toBe(429);
    expect(mocks.callModel).not.toHaveBeenCalled();
    expect(mocks.acquireSessionLock).not.toHaveBeenCalled();
  });

  it("returns 429 when the session lock is busy", async () => {
    mocks.acquireSessionLock.mockResolvedValue(false);
    expect((await POST(request({ message: "曲" }))).status).toBe(429);
    expect(mocks.callModel).not.toHaveBeenCalled();
    expect(mocks.releaseSessionLock).not.toHaveBeenCalled();
  });

  it("releases its lock and hides provider details after inference failure", async () => {
    mocks.getModelCatalog.mockResolvedValue([]);
    mocks.callModel.mockReset();
    mocks.callModel.mockRejectedValueOnce(new Error("private upstream detail"));
    const response = await POST(request({ message: "曲" }));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private upstream detail");
    expect(mocks.releaseSessionLock).toHaveBeenCalled();
  });

  it("resets without invoking the model", async () => {
    const response = await POST(request({ reset: true }));
    expect(response.status).toBe(200);
    expect(mocks.callModel).not.toHaveBeenCalled();
    expect(mocks.clearSessionHistory).toHaveBeenCalled();
    expect(mocks.setSessionHistory).not.toHaveBeenCalled();
  });
});