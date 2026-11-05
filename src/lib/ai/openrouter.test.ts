import { afterEach, describe, expect, it, vi } from "vitest";
import { callOpenRouter } from "./openrouter";
import { z } from "zod";

// callOpenRouter は ky を経由して globalThis.fetch を叩く。ky の fetch オプションは
// 関数の契約（{ok, error} を返す純粋な API クライアント）に持たせられないため、
// AGENTS.md の「他に選択肢がない場合」に該当する globalThis の差し替えで使う。
// （ky は試行の直前に globalThis.fetch を解決するのでスタブはそのまま効く）
const stubFetch = (impl: typeof fetch) => vi.spyOn(globalThis, "fetch").mockImplementation(impl);

const contentSchema = z.object({ hello: z.string() });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const baseOpts = { apiKey: "k", model: "m", prompt: "p" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("callOpenRouter の成功経路", () => {
  it("content の JSON を schema で検証して data を返す", async () => {
    const fetchSpy = stubFetch(async () =>
      jsonResponse({ choices: [{ message: { content: '{"hello":"world"}' } }] }),
    );
    const res = await callOpenRouter(baseOpts, "n", {}, contentSchema);
    expect(res).toEqual({ ok: true, data: { hello: "world" } });
    // ky が Authorization と JSON body を組み立てていること
    const request = fetchSpy.mock.calls[0][0] as Request;
    expect(request.headers.get("Authorization")).toBe("Bearer k");
  });
});

describe("callOpenRouter の失敗 3 経路（旧 fetch 実装と同じ日本語メッセージ）", () => {
  it("非 2xx は status を添えて『OpenRouter がエラーを返しました』", async () => {
    stubFetch(async () => jsonResponse({ error: "rate limited" }, 429));
    const res = await callOpenRouter(baseOpts, "n", {}, contentSchema);
    expect(res).toEqual({
      ok: false,
      error: "OpenRouter がエラーを返しました",
      status: 429,
    });
  });

  it("ネットワーク断（fetch の reject）は『OpenRouter への接続に失敗しました』", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const res = await callOpenRouter(baseOpts, "n", {}, contentSchema);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("OpenRouter への接続に失敗しました");
  });

  it("タイムアウト（totalTimeout 超過）は『OpenRouter への接続に失敗しました』", async () => {
    // 旧実装の AbortSignal.timeout と同じ「応答を待って打ち切り」経路。
    // 一生 resolve しない fetch で totalTimeout を発火させる。
    stubFetch(() => new Promise<Response>(() => {}));
    const res = await callOpenRouter({ ...baseOpts, timeoutMs: 50 }, "n", {}, contentSchema);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("OpenRouter への接続に失敗しました");
  });

  it("2xx でも JSON が壊れていれば『OpenRouter の応答を解釈できません』", async () => {
    stubFetch(async () => new Response("not json", { status: 200 }));
    const res = await callOpenRouter(baseOpts, "n", {}, contentSchema);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("OpenRouter の応答を解釈できません");
  });

  it("content が空なら『OpenRouter の応答が空です』", async () => {
    stubFetch(async () => jsonResponse({ choices: [{ message: { content: null } }] }));
    const res = await callOpenRouter(baseOpts, "n", {}, contentSchema);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("OpenRouter の応答が空です");
  });
});
