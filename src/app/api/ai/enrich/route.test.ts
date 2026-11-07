// enrich route の部分失敗受け皿。D1 を偽バインディングで回し、OpenRouter は外部境界と
// してモックする（route のオーケストレーションだけを検証し、AI 実応答は openrouter テスト側が担保）。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callOpenRouter: vi.fn(),
  env: { DB: undefined as unknown },
}));

// getCloudflareContext は実行環境の境界なので置き換える（DB の中は偽 D1 で回す）。
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: mocks.env }),
}));
// OpenRouter は外部 API。route のオーケストレーション（部分失敗の折り込み）だけを検証する。
vi.mock("@/lib/ai/openrouter", () => ({
  callOpenRouter: (...args: unknown[]) => mocks.callOpenRouter(...args),
}));

import { POST } from "./route";
import type { D1Database, D1PreparedStatement } from "@/lib/catalog/d1";

// music_catalog の SELECT と music_ai_tags の UPSERT をSQLで判別する偽 D1。
// failOn で任意の段階（読み出し / 特定行の書き込み）に例外を混ぜられる。
function fakeDb(
  options: {
    rows?: unknown[];
    failSelect?: boolean;
    failUpsertFor?: string;
  } = {},
) {
  const upserted: unknown[][] = [];
  const statement = (sql: string, params: unknown[]): D1PreparedStatement => ({
    bind: (...next: unknown[]) => statement(sql, next),
    first: async <T>() => {
      // incrementAiBudget の RETURNING count のみ first を使う
      if (sql.includes("music_ai_budget")) return { count: 1 } as T;
      return null;
    },
    all: async <T>() => {
      if (options.failSelect) throw new Error("D1_ERROR: too many SQL variables");
      return { results: (options.rows ?? []) as T[] };
    },
    run: async () => {
      if (options.failUpsertFor !== undefined && String(params[0]) === options.failUpsertFor) {
        throw new Error("D1_ERROR: write failed");
      }
      upserted.push(params);
      return { meta: { changes: 1 } };
    },
  });
  const db: D1Database = { prepare: (sql) => statement(sql, []), batch: async () => [] };
  return { db, upserted };
}

const row = (message_id: string, title: string) => ({
  message_id,
  url: `https://youtu.be/${message_id}`,
  timestamp: "2026-01-01T00:00:00Z",
  title,
});

const tags = {
  artist: "花譜",
  genres: ["J-POP"],
  moods: [],
  languages: ["ja"],
  era: "2020s",
  ai_dopamine: 7,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "test-model");
  mocks.callOpenRouter.mockResolvedValue({ ok: true, data: tags });
});

afterEach(() => vi.unstubAllEnvs());

describe("enrich API の部分失敗", () => {
  it("途中の行で upsert が throw しても 200 + 行単位の成否 JSON を返す", async () => {
    const { db, upserted } = fakeDb({
      rows: [row("a", "曲A"), row("b", "曲B"), row("c", "曲C")],
      failUpsertFor: "b",
    });
    mocks.env.DB = db;

    const response = await POST(
      new Request("https://example.com/api/ai/enrich", { method: "POST" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      processed: 3,
      ok: 2,
      results: [
        { message_id: "a", ok: true },
        { message_id: "b", ok: false, error: "タグの保存に失敗しました" },
        { message_id: "c", ok: true },
      ],
    });
    // 失敗行の後の行も書き込みが続いていること（全 loss しない）
    expect(upserted.map((p) => p[0])).toEqual(["a", "c"]);
  });

  it("getMusicRows が throw する場合は 200 + 0 件 + 理由を返す", async () => {
    mocks.env.DB = fakeDb({ failSelect: true }).db;

    const response = await POST(
      new Request("https://example.com/api/ai/enrich", { method: "POST" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      processed: 0,
      ok: 0,
      results: [],
      error: "カタログの読み込みに失敗しました",
    });
  });

  it("title の無い行は対象外（AI を呼ばない）", async () => {
    mocks.env.DB = fakeDb({
      rows: [row("a", "曲A"), { message_id: "b", url: "u", timestamp: "t" }],
    }).db;

    const response = await POST(
      new Request("https://example.com/api/ai/enrich", { method: "POST" }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).processed).toBe(1);
    expect(mocks.callOpenRouter).toHaveBeenCalledTimes(1);
  });
});
