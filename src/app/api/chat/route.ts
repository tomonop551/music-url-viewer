/*
 * [一時停止] AIチャット機能 /api/chat（Cloudflare移行を優先するため無効化）。
 * 復旧時はこのブロックコメントを外してハンドラを再有効化する。
 * 現時点ではエクスポート無しのため /api/chat は 404/405 になる。
 */
/*
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { bindWorkersAi, type WorkersAi } from "@/lib/ai";
import {
  acquireSessionLock,
  clearSessionHistory,
  getModelCatalog,
  getSessionHistory,
  incrementBudget,
  releaseSessionLock,
  resolveCatalogRecords,
  seedSession,
  setSessionHistory,
  type D1Database,
} from "@/lib/d1";
import { recommend } from "@/lib/recommender";
import { parseChatInput, safeMusicUrl } from "@/lib/chat-validation";
import type { Recommendation } from "@/types/chat";

export const runtime = "nodejs";

const cookieName = "music_chat_session";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

function stack(): { db: D1Database; ai: WorkersAi; origin: string; dailyLimit: number; modelId: string } {
  return {
    // OpenNext Cloudflare は Worker のバインディング（D1 / AI / vars）を process.env に注入する。
    db: process.env.DB as unknown as D1Database,
    ai: process.env.AI as unknown as WorkersAi,
    origin: process.env.APP_ORIGIN || "",
    dailyLimit: Number(process.env.CHAT_DAILY_LIMIT || 200),
    modelId: process.env.AI_MODEL_ID || "@cf/moonshotai/kimi-k2.7-code",
  };
}

export async function POST(request: Request) {
  const { db, ai, origin, dailyLimit, modelId } = stack();
  if (!origin) return json({ error: "チャットの準備中です。しばらくしてからお試しください。" }, 503);
  if (request.headers.get("origin") !== origin) return json({ error: "リクエストを受け付けられません。" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "入力形式が正しくありません。" }, 415);

  let input;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "メッセージを入力してください。" }, 400);
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 8192) {
        await reader.cancel();
        return json({ error: "入力が長すぎます。" }, 413);
      }
      chunks.push(value);
    }
    input = parseChatInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    return json({ error: "1〜1000文字のメッセージを入力してください。" }, 400);
  }

  const jar = await cookies();
  const existing = jar.get(cookieName)?.value;
  const session = existing && /^[0-9a-f-]{36}$/.test(existing) ? existing : randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const lock = randomUUID();
  let locked = false;
  try {
    // 共有日次枠（cookie を捨てる caller も対象）。アトミックに加算して上限判定。
    const count = await incrementBudget(db, new Date().toISOString().slice(0, 10));
    if (count > dailyLimit) return json({ error: "利用上限に達しました。翌日再開できます。" }, 429);

    await seedSession(db, session, now);
    if (!(await acquireSessionLock(db, session, now, lock))) {
      return json({ error: "少し時間をおいてお試しください。利用上限に達した場合は翌日再開できます。" }, 429);
    }
    locked = true;
    jar.set(cookieName, session, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/chat", maxAge: 86400 });

    if (input.reset) {
      await clearSessionHistory(db, session, lock, now);
      return json({ message: "", recommendations: [] });
    }

    const history = input.startNew ? [] : await getSessionHistory(db, session);

    const catalog = await getModelCatalog(db);
    // 既定上限（300 件 / 120k chars）を超えないようにする
    if (catalog.length > 300 || JSON.stringify(catalog).length > 120000) throw new Error("Catalog capacity exceeded");

    const callModel = bindWorkersAi({ AI: ai }, modelId);
    const reply = await recommend({ message: input.message, history }, catalog, callModel);

    const ids = reply.recommendations.map((r) => r.id);
    const records = ids.length ? await resolveCatalogRecords(db, ids) : [];
    const recommendations: Recommendation[] = [];
    for (const pick of reply.recommendations) {
      const record = records.find((r) => r.message_id === pick.id);
      if (!record || !safeMusicUrl(record.url)) continue;
      recommendations.push({
        ...pick,
        title: String(record.title || "タイトル不明"),
        url: record.url,
        ...(typeof record.dopamine === "number" && record.dopamine >= 0 && record.dopamine <= 10 ? { dopamine: record.dopamine } : {}),
      });
    }

    const nextHistory = [
      ...history,
      { role: "user" as const, text: input.message },
      { role: "assistant" as const, text: reply.message + "\nSelected IDs: " + recommendations.map((r) => r.id).join(",") },
    ].slice(-12);
    await setSessionHistory(db, session, nextHistory, lock, now);
    return json({ message: reply.message, recommendations });
  } catch (error) {
    console.error("Chat request failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return json({ error: "曲を探せませんでした。時間をおいてもう一度お試しください。" }, 502);
  } finally {
    if (locked) await releaseSessionLock(db, session, lock).catch(() => {});
  }
}
*/
export const runtime = "nodejs";

// [一時停止] AIチャットは無効化中。上記の実装はコメントで保持。
// Next の route ファイルはハンドラ必須のため、最小の 503 スタブを残す。
export async function POST() {
  return new Response(JSON.stringify({ error: "AIチャットは現在ご利用いただけません（一時停止中）。" }), {
    status: 503,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}