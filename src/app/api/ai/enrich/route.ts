import { NextResponse } from "next/server";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getD1Binding, getMusicRows, upsertAiTags, incrementAiBudget } from "@/lib/d1";
import type { MusicRow } from "@/lib/catalog";
import { buildEnrichPrompt, pickEnrichTargets } from "@/lib/ai-enrich";
import { enrichWithOpenRouter } from "@/lib/openrouter";
import { checkDailyLimit } from "@/lib/ai-budget";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

// 1 日の AI 呼び出し上限（無料枠の消費を固定する）。1 リクエスト = 1 回と数える。
const DAILY_LIMIT = 10;

const bodySchema = z.object({
  // 1 回の実行で処理する件数の上限（opt-in の手動実行。勝手に全部を回さない）
  limit: z.number().int().min(1).max(50).default(10),
});

const responseSchema = {
  type: "object",
  properties: {
    artist: { type: "string", description: "アーティスト名（推定で良い）" },
    genres: { type: "array", items: { type: "string" }, description: "ジャンル（最大 5 件）" },
    moods: { type: "array", items: { type: "string" }, description: "雰囲気（最大 5 件）" },
    languages: { type: "array", items: { type: "string" }, description: "歌詞の言語（ja / en など）" },
    era: { type: "string", description: "年代（例: 2020s）" },
    ai_dopamine: { type: "number", description: "0〜10 の中毒性の推定" },
  },
  required: ["artist", "genres", "moods", "languages", "era", "ai_dopamine"],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  const { env } = getCloudflareContext();
  const db = getD1Binding(env);
  if (!db) {
    return NextResponse.json({ error: "D1 に接続できません" }, { status: 503 });
  }

  // 実行の前に当日回数を加算し、上限に達していたら拒否する。
  // 加算を先にするのは、同時リクエストでも上限を超えて実行させないため
  // （拒否された分はカウンタに残るが、日付が変われば数え直す）。
  // 日付は JST 固定（Workers は UTC のため、そのままの toISOString では日本の「今日」とずれる）。
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const count = await incrementAiBudget(db, nowJst);
  const budget = checkDailyLimit({ count, limit: DAILY_LIMIT });
  if (!budget.allowed) {
    return NextResponse.json(
      { error: `本日の AI 呼び出しは上限（${DAILY_LIMIT} 回）に達しました` },
      { status: 429 },
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey || !model) {
    return NextResponse.json({ error: "AI の設定がありません" }, { status: 503 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // 空でも許容（limit の既定値で動く）
  }
  const parsed = bodySchema.safeParse(body);
  const limit = parsed.success ? parsed.data.limit : 10;

  // 濃縮の対象は title のある行だけ。未濃縮のものから順に処理する
  const allRows: MusicRow[] = await getMusicRows(db);
  const targets = pickEnrichTargets<MusicRow>(allRows).slice(0, limit);

  const results = [];
  for (const row of targets) {
    const prompt = buildEnrichPrompt(row);
    const fingerprint = createHash("sha256").update(`${row.url}\n${row.title ?? ""}`).digest("hex");

    const res = await enrichWithOpenRouter({ apiKey, model, prompt }, "catalog_tags", responseSchema);
    if (!res.ok) {
      results.push({ message_id: row.message_id, ok: false, error: res.error });
      continue;
    }

    await upsertAiTags(db, {
      message_id: row.message_id,
      ...res.tags,
      model,
      created_at: new Date().toISOString(),
      input_fingerprint: fingerprint,
    });
    results.push({ message_id: row.message_id, ok: true });
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ processed: results.length, ok: okCount, results });
}
