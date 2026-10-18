import { NextResponse } from "next/server";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getD1Binding, getMusicRows, getAiTags } from "@/lib/d1";
import { buildSuggestPrompt, parseSuggestions, SUGGEST_SCHEMA, type SuggestCandidate } from "@/lib/ai-suggest";
import { enrichWithOpenRouter } from "@/lib/openrouter";

export const runtime = "nodejs";

const bodySchema = z.object({
  theme: z.string().min(1).max(100),
});

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

  // 候補は濃縮済みタグのある曲を優先して渡す（タグが無い曲は title のみの候補になる）
  const rows = await getMusicRows(db);
  const candidates: SuggestCandidate[] = [];
  for (const row of rows) {
    if (typeof row.title !== "string" || row.title.trim() === "") continue;
    const tags = await getAiTags(db, row.message_id);
    candidates.push({
      message_id: row.message_id,
      title: row.title,
      artist: tags?.artist,
      genres: tags?.genres,
      moods: tags?.moods,
    });
  }
  if (candidates.length === 0) {
    return NextResponse.json({ error: "候補となる曲がありません" }, { status: 400 });
  }

  const prompt = buildSuggestPrompt(parsed.data.theme, candidates);
  const res = await enrichWithOpenRouter({ apiKey, model, prompt }, "playlist_suggest", SUGGEST_SCHEMA);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 502 });
  }

  const allowed = new Set(candidates.map((c) => c.message_id));
  const suggestions = parseSuggestions({ recommendations: res.tags }, allowed);
  return NextResponse.json({ theme: parsed.data.theme, suggestions });
}
