import ky, { HTTPError, KyError } from "ky";
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
  let json: unknown;
  try {
    json = await ky
      .post(OPENROUTER_URL, {
        headers: { Authorization: `Bearer ${opts.apiKey}` },
        json: {
          model: opts.model,
          messages: [{ role: "user", content: opts.prompt }],
          response_format: {
            type: "json_schema",
            json_schema: { name: schemaName, strict: true, schema },
          },
          // structured outputs 非対応の provider へのルーティングを避ける
          // （schema を無視した自由文の応答が返るのを防ぐため）
          provider: { require_parameters: true },
        },
        retry: 0,
        // 旧 AbortSignal.timeout 相当の「送信開始からの合計上限」は totalTimeout が持つ
        // （応答本文の読み取り込みで打ち切られる）。per-attempt 既定 10s が先に発火して
        // 30s を早期失敗させないため timeout は無効化する（retry: 0 なので試行は 1 回）。
        timeout: false,
        totalTimeout: opts.timeoutMs ?? 30_000,
      })
      .json();
  } catch (error) {
    // 非 2xx は HTTPError として throw される（status はそのまま返し、呼び出し側が 502 に折り返す）。
    if (error instanceof HTTPError) {
      return { ok: false, error: "OpenRouter がエラーを返しました", status: error.response.status };
    }
    // TimeoutError・NetworkError など、応答を得られなかった ky の失敗
    // （旧実装の fetch 例外・AbortSignal 打ち切りと同じ「接続に失敗」経路）。
    if (error instanceof KyError) {
      return { ok: false, error: "OpenRouter への接続に失敗しました" };
    }
    // 2xx なのに JSON パースに失敗したケース（素の SyntaxError がそのまま出る）。
    return { ok: false, error: "OpenRouter の応答を解釈できません" };
  }

  let data: OpenRouterResponse;
  try {
    data = chatCompletionSchema.parse(json);
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
