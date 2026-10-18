import { aiTagsSchema, type AiTags } from "./ai-enrich";

// OpenRouter の chat completions API。JSON schema での structured outputs を要求する。
// API キーは wrangler secret（OPENROUTER_API_KEY）で渡す。
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterResponse {
  choices: { message: { content: string } }[];
}

interface EnrichOptions {
  apiKey: string;
  model: string;
  prompt: string;
}

type EnrichResult = { ok: true; tags: AiTags } | { ok: false; error: string; status?: number };

// 1 曲の推定を OpenRouter に依頼する。失敗は例外でなく結果オブジェクトで返す
// （バッチで複数曲を回すため、1 曲の失敗で全体を止めない）。
export async function enrichWithOpenRouter(
  opts: EnrichOptions,
  schemaName: string,
  schema: object,
): Promise<EnrichResult> {
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
        messages: [
          { role: "user", content: opts.prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: schemaName, strict: true, schema },
        },
      }),
    });
  } catch {
    return { ok: false, error: "OpenRouter への接続に失敗しました" };
  }

  if (!res.ok) {
    return { ok: false, error: "OpenRouter がエラーを返しました", status: res.status };
  }

  let data: OpenRouterResponse;
  try {
    data = (await res.json()) as OpenRouterResponse;
  } catch {
    return { ok: false, error: "OpenRouter の応答を解釈できません" };
  }

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    return { ok: false, error: "OpenRouter の応答が空です" };
  }

  try {
    const parsed = JSON.parse(content);
    return { ok: true, tags: aiTagsSchema.parse(parsed) };
  } catch {
    return { ok: false, error: "AI の応答が想定した形式ではありません" };
  }
}
