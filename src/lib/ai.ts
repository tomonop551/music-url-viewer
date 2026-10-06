/**
 * Cloudflare 移行: Workers AI function calling への配線層。
 * recommender.ts の抽象 `CallModel`（neutral な messages/tools/tool_call）を
 * env.AI.run の wire format に変換する。
 *
 * 注意: この wire shape は要実機検証。実バインディング（`wrangler dev` で AI binding 有効時）に
 * 対し、function_call の `arguments` が文字列/オブジェクトどちらで返るかを確認して調整する。
 */
import type { CallModel, LlmMessage, ToolBlock, ToolCall, ToolDef } from "./recommender";

export interface WorkersAi {
  run(model: string, input: { messages: unknown; tools: unknown; tool_choice: "any" }): Promise<unknown>;
}

interface WorkersAiEnv {
  AI: WorkersAi;
}

interface BlockCall {
  type?: string;
  name?: string;
  arguments?: unknown;
}

/** Workers AI の tool 定義へ変換（function: {…} ネスト）。 */
function toWireTools(tools: ToolDef[]): unknown[] {
  return tools.map((t) => ({
    type: t.type,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

/** neutral LlmMessage[] → Workers AI messages。system は先頭に付与。 */
function toWireMessages(system: string, messages: LlmMessage[]): unknown[] {
  return [
    { role: "system", content: system },
    ...messages.map((m) => ({
      role: m.role,
      content:
        typeof m.content === "string"
          ? m.content
          : m.content.map((b: ToolBlock) =>
              b.type === "tool_call"
                ? { type: "function_call", name: b.name, arguments: JSON.stringify(b.arguments) }
                : { type: "tool_result", name: b.name, content: JSON.stringify(b.content) },
            ),
    })),
  ];
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

function extractCalls(content: unknown): ToolCall[] {
  if (!Array.isArray(content)) {
    // 単一 tool_call をオブジェクト返しするモデルへのフォールバック
    if (content && typeof content === "object" && "name" in content) {
      const c = content as BlockCall;
      if (c.name) return [{ name: c.name, arguments: parseArgs(c.arguments) }];
    }
    return [];
  }
  const calls: ToolCall[] = [];
  for (const block of content) {
    if (block && typeof block === "object" && (block as BlockCall).type === "function_call") {
      const b = block as BlockCall;
      if (b.name) calls.push({ name: b.name, arguments: parseArgs(b.arguments) });
    }
  }
  return calls;
}

/** env.AI を `CallModel` に束縛する。model_id は Workers AI モデル名（例: "@cf/moonshotai/kimi-k2.7-code"）。 */
export function bindWorkersAi(env: WorkersAiEnv, modelId: string): CallModel {
  return async ({ system, messages, tools }) => {
    const raw = await env.AI.run(modelId, {
      messages: toWireMessages(system, messages),
      tools: toWireTools(tools),
      tool_choice: "any",
    });
    const output = (raw as { output?: unknown })?.output;
    const content = output && typeof output === "object" && "content" in output
      ? (output as { content: unknown }).content
      : undefined;
    return extractCalls(content);
  };
}