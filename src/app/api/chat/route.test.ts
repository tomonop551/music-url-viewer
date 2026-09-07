import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ db: vi.fn(), agent: vi.fn(), cookieSet: vi.fn(), cookieGet: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookieGet, set: mocks.cookieSet }) }));
vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: () => ({ send: mocks.db }) },
  GetCommand: class { constructor(public input: unknown) {} },
  UpdateCommand: class { constructor(public input: unknown) {} },
  BatchGetCommand: class { constructor(public input: unknown) {} },
}));
vi.mock("@aws-sdk/client-bedrock-agentcore", () => ({
  BedrockAgentCoreClient: class { send = mocks.agent; },
  InvokeAgentRuntimeCommand: class { constructor(public input: unknown) {} },
}));
import { POST } from "./route";

const request = (body: unknown, origin = "https://example.com") => new Request("https://example.com/api/chat", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_ORIGIN", "https://example.com");
  vi.stubEnv("CHAT_TABLE_NAME", "example-chat");
  vi.stubEnv("MUSIC_TABLE_NAME", "example-music");
  vi.stubEnv("AGENTCORE_RUNTIME_ARN", "example-runtime");
  vi.stubEnv("CHAT_DAILY_LIMIT", "200");
  mocks.cookieGet.mockReturnValue(undefined);
  mocks.db.mockImplementation(async (command) => {
    if ("ConsistentRead" in command.input) return { Item: { history: [{ role: "user", text: "old context" }, { role: "assistant", text: "old reply" }] } };
    if ("RequestItems" in command.input) return { Responses: { "example-music": [{ message_id: "demo", title: "Example track", url: "https://youtu.be/example", dopamine: 0 }] } };
    return {};
  });
  mocks.agent.mockResolvedValue({ response: { transformToString: async () => JSON.stringify({ message: "候補です", recommendations: [{ id: "demo", reason: "中毒性0/10" }, { id: "deleted", reason: "候補" }] }) } });
});
afterEach(() => vi.unstubAllEnvs());

describe("chat API", () => {
  it("rejects cross-origin requests before AWS access", async () => {
    expect((await POST(request({ message: "曲を探して" }, "https://other.example"))).status).toBe(403);
    expect(mocks.db).not.toHaveBeenCalled();
    expect(mocks.agent).not.toHaveBeenCalled();
  });
  it("fails closed when configuration or input is invalid", async () => {
    vi.stubEnv("CHAT_DAILY_LIMIT", "NaN");
    expect((await POST(request({ message: "hello" }))).status).toBe(503);
    vi.stubEnv("CHAT_DAILY_LIMIT", "200");
    expect((await POST(request({ message: "x".repeat(1001) }))).status).toBe(400);
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("resolves current links, drops deleted tracks, and starts fresh context on reload", async () => {
    const response = await POST(request({ message: "中毒性で選んで", startNew: true }));
    expect(response.status).toBe(200);
    const reply = await response.json();
    expect(reply.recommendations).toEqual([{ id: "demo", title: "Example track", url: "https://youtu.be/example", dopamine: 0, reason: "中毒性0/10" }]);
    const payload = JSON.parse(mocks.agent.mock.calls[0][0].input.payload.toString());
    expect(payload).toEqual({ message: "中毒性で選んで", history: [] });
    expect(mocks.cookieSet).toHaveBeenCalledWith("music_chat_session", expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: "strict" }));
    expect(mocks.db.mock.calls.at(-1)?.[0].input.UpdateExpression).toBe("REMOVE busy_until, lock_id");
  });
  it("preserves prior turns for follow-up requests", async () => {
    await POST(request({ message: "別の曲" }));
    expect(JSON.parse(mocks.agent.mock.calls[0][0].input.payload.toString()).history).toHaveLength(2);
  });
  it("stops before inference when the shared budget is exhausted", async () => {
    mocks.db.mockRejectedValueOnce(Object.assign(new Error("budget"), { name: "ConditionalCheckFailedException" }));
    expect((await POST(request({ message: "曲" }))).status).toBe(429);
    expect(mocks.agent).not.toHaveBeenCalled();
  });
  it("releases its lock and hides provider details after inference failure", async () => {
    mocks.agent.mockRejectedValueOnce(new Error("private upstream detail"));
    const response = await POST(request({ message: "曲" }));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private upstream detail");
    expect(mocks.db.mock.calls.at(-1)?.[0].input.UpdateExpression).toBe("REMOVE busy_until, lock_id");
  });
  it("resets without invoking the model", async () => {
    expect((await POST(request({ reset: true }))).status).toBe(200);
    expect(mocks.agent).not.toHaveBeenCalled();
    expect(mocks.db.mock.calls.some(([command]) => command.input.UpdateExpression === "REMOVE history")).toBe(true);
  });
});
