import { z } from "zod";

// OpenRouter の chat completions API。JSON schema での structured outputs を要求する。
// API キーは wrangler secret（OPENROUTER_API_KEY）で渡す。
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// OpenRouter の応答の型（OpenAI 互換）。content は JSON 文字列で返るため、
// 呼び出し側が渡す zod スキーマで二段階にパースする。
const chatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable(),
        }),
      }),
    )
    .min(1),
});

export interface OpenRouterResponse {
  choices: { message: { content: string | null } }[];
}

interface EnrichOptions {
  apiKey: string;
  model: string;
  prompt: string;
  // 応答の待ち時間の上限（ms）。フリーモデルは応答が遅く、Workers の応答時間上限に
  // 触れるため、明示的に打ち切って 502 を返す（ブラウザを待たせない）。
  timeoutMs?: number;
}

// 1 回の AI 呼び出し。応答の content は、渡された zod スキーマで検証する
// （濃縮と提案で応答の型が違うため。structured outputs の schema と対応させる）。
export async function callOpenRouter<T>(
  opts: EnrichOptions,
  schemaName: string,
  schema: object,
  contentSchema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [{ role: "user", content: opts.prompt }],
        response_format: {
          type: "json_schema",
          json_schema: { name: schemaName, strict: true, schema },
        },
        // structured outputs 非対応の provider へのルーティングを避ける
        // （schema を無視した自由文の応答が返るのを防ぐため）
        provider: { require_parameters: true },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });
  } catch {
    return { ok: false, error: "OpenRouter への接続に失敗しました" };
  }

  if (!res.ok) {
    return { ok: false, error: "OpenRouter がエラーを返しました", status: res.status };
  }

  let data: OpenRouterResponse;
  try {
    data = chatCompletionSchema.parse(await res.json());
  } catch {
    return { ok: false, error: "OpenRouter の応答を解釈できません" };
  }

  const content = data.choices[0].message.content;
  if (content === null || content === "") {
    return { ok: false, error: "OpenRouter の応答が空です" };
  }

  try {
    const parsed = JSON.parse(content);
    return { ok: true, data: contentSchema.parse(parsed) };
  } catch {
    return { ok: false, error: "AI の応答が想定した形式ではありません" };
  }
}
