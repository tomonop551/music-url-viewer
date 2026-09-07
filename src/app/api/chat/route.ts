import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from "@aws-sdk/client-bedrock-agentcore";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { getChatConfig } from "@/lib/chat-config";
import { parseAgentReply, parseChatInput, safeMusicUrl } from "@/lib/chat-validation";
import type { Recommendation } from "@/types/chat";

export const runtime = "nodejs";
const region = process.env.AWS_REGION || process.env.NEXT_PUBLIC_AWS_REGION || "ap-northeast-1";
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region, maxAttempts: 2 }));
const agent = new BedrockAgentCoreClient({ region, maxAttempts: 1 });
const cookieName = "music_chat_session";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const config = getChatConfig();
  if (!config) return json({ error: "チャットの準備中です。しばらくしてからお試しください。" }, 503);
  if (request.headers.get("origin") !== config.origin) return json({ error: "リクエストを受け付けられません。" }, 403);
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
      if (bytes > 8192) { await reader.cancel(); return json({ error: "入力が長すぎます。" }, 413); }
      chunks.push(value);
    }
    input = parseChatInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch { return json({ error: "1〜1000文字のメッセージを入力してください。" }, 400); }

  const jar = await cookies();
  const existing = jar.get(cookieName)?.value;
  const session = existing && /^[0-9a-f-]{36}$/.test(existing) ? existing : randomUUID();
  const key = { id: `session#${session}` };
  const now = Math.floor(Date.now() / 1000);
  const lock = randomUUID();
  let locked = false;
  try {
    // A shared daily cap also limits callers who repeatedly discard their cookie.
    await db.send(new UpdateCommand({
      TableName: config.table, Key: { id: `budget#${new Date().toISOString().slice(0, 10)}` },
      UpdateExpression: "SET expires_at = :ttl ADD request_count :one",
      ConditionExpression: "attribute_not_exists(request_count) OR request_count < :limit",
      ExpressionAttributeValues: { ":ttl": now + 172800, ":one": 1, ":limit": config.dailyLimit },
    }));
    await db.send(new UpdateCommand({
      TableName: config.table, Key: key,
      UpdateExpression: "SET busy_until = :busy, lock_id = :lock, expires_at = :ttl, last_request = :now",
      ConditionExpression: "(attribute_not_exists(busy_until) OR busy_until < :now) AND (attribute_not_exists(last_request) OR last_request < :recent)",
      ExpressionAttributeValues: { ":busy": now + 90, ":lock": lock, ":ttl": now + 86400, ":now": now, ":recent": now - 2 },
    }));
    locked = true;
    jar.set(cookieName, session, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/chat", maxAge: 86400 });
    if (input.reset) {
      await db.send(new UpdateCommand({ TableName: config.table, Key: key, UpdateExpression: "REMOVE history", ConditionExpression: "lock_id = :lock", ExpressionAttributeValues: { ":lock": lock } }));
      return json({ message: "", recommendations: [] });
    }
    const saved = await db.send(new GetCommand({ TableName: config.table, Key: key, ConsistentRead: true }));
    const history = input.startNew ? [] : saved.Item?.history ?? [];
    const result = await agent.send(new InvokeAgentRuntimeCommand({
      agentRuntimeArn: config.arn,
      // History is owned by the API; the cookie binds the runtime session.
      runtimeSessionId: session, contentType: "application/json", accept: "application/json",
      payload: Buffer.from(JSON.stringify({ message: input.message, history })),
    }), { abortSignal: AbortSignal.timeout(45000) });
    if (!result.response) throw new Error("Missing response");
    const reply = parseAgentReply(JSON.parse(await result.response.transformToString()));
    const ids = reply.recommendations.map(item => ({ message_id: item.id }));
    const musicTable = process.env.MUSIC_TABLE_NAME || "MusicUrls";
    const records = ids.length ? await db.send(new BatchGetCommand({ RequestItems: { [musicTable]: { Keys: ids, ConsistentRead: true } } })) : undefined;
    if (records?.UnprocessedKeys && Object.keys(records.UnprocessedKeys).length) throw new Error("Incomplete catalog read");
    const recommendations: Recommendation[] = [];
    for (const pick of reply.recommendations) {
      const record = records?.Responses?.[musicTable]?.find(item => item.message_id === pick.id);
      if (!record || !safeMusicUrl(record.url)) continue;
      recommendations.push({ ...pick, title: String(record.title || "タイトル不明"), url: record.url,
        ...(typeof record.dopamine === "number" && record.dopamine >= 0 && record.dopamine <= 10 ? { dopamine: record.dopamine } : {}) });
    }
    await db.send(new UpdateCommand({
      TableName: config.table, Key: key, UpdateExpression: "SET history = :history", ConditionExpression: "lock_id = :lock",
      ExpressionAttributeValues: { ":lock": lock, ":history": [...history, { role: "user", text: input.message }, { role: "assistant", text: reply.message + "\nSelected IDs: " + recommendations.map(item => item.id).join(",") }].slice(-12) },
    }));
    return json({ message: reply.message, recommendations });
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") return json({ error: "少し時間をおいてお試しください。利用上限に達した場合は翌日再開できます。" }, 429);
    console.error("Chat request failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return json({ error: "曲を探せませんでした。時間をおいてもう一度お試しください。" }, 502);
  } finally {
    if (locked) await db.send(new UpdateCommand({ TableName: config.table, Key: key, UpdateExpression: "REMOVE busy_until, lock_id", ConditionExpression: "lock_id = :lock", ExpressionAttributeValues: { ":lock": lock } })).catch(() => {});
  }
}
