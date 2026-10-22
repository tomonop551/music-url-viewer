import { NextResponse } from "next/server";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getD1Binding, getMusicRows, getAiTagsMap } from "@/lib/catalog/d1";
import { buildSuggestCandidates, buildSuggestPrompt, parseSuggestions, SUGGEST_SCHEMA } from "@/lib/ai/suggest";
import { suggestionsSchema } from "@/lib/ai/enrich";
import { callOpenRouter } from "@/lib/ai/openrouter";

export const runtime = "nodejs";

const bodySchema = z.object({
  theme: z.string().min(1).max(100),
});

// AI に渡す候補の上限。多すぎると応答待ちが伸び、Workers の応答時間上限に触れるため。
const SUGGEST_CANDIDATE_LIMIT = 50;

export async function POST(request: Request) {
  const { env } = getCloudflareContext();
  const db = getD1Binding(env);
  if (!db) {
    return NextResponse.json({ error: "D1 に接続できません" }, { status: 503 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey || !model) {
    return NextResponse.json({ error: "AI の設定がありません" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "テーマを入力してください" }, { status: 400 });
  }

  // 候補は1クエリで組み立てる（曲ごとの D1 呼び出しはサブリクエスト上限にかかるため）。
  // AI に渡す候補は上限までに抑え、応答待ちを短く保つ。
  // タグの取得は候補を絞った後に行う（223 件を IN 句に渡すと
  // SQLite の変数上限を超え、D1_ERROR: too many SQL variables になるため）。
  const rows = await getMusicRows(db);
  const preCandidates = buildSuggestCandidates(rows, new Map(), SUGGEST_CANDIDATE_LIMIT);
  const tagsMap = await getAiTagsMap(db, preCandidates.map((c) => c.message_id));
  const candidates = buildSuggestCandidates(preCandidates, tagsMap, SUGGEST_CANDIDATE_LIMIT);
  if (candidates.length === 0) {
    return NextResponse.json({ error: "候補となる曲がありません" }, { status: 400 });
  }

  const prompt = buildSuggestPrompt(parsed.data.theme, candidates);
  const res = await callOpenRouter({ apiKey, model, prompt }, "playlist_suggest", SUGGEST_SCHEMA, suggestionsSchema);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 502 });
  }

  const allowed = new Set(candidates.map((c) => c.message_id));
  const suggestions = parseSuggestions(res.data, allowed);
  return NextResponse.json({ theme: parsed.data.theme, suggestions });
}
