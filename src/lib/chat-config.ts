export interface ChatConfig {
  table: string;
  arn: string;
  origin: string;
  dailyLimit: number;
}

export function getChatConfig(): ChatConfig | null {
  const table = process.env.CHAT_TABLE_NAME;
  const arn = process.env.AGENTCORE_RUNTIME_ARN;
  const origin = process.env.APP_ORIGIN;
  const dailyLimit = Number(process.env.CHAT_DAILY_LIMIT || 200);
  if (!table || !arn || !origin || !Number.isSafeInteger(dailyLimit) || dailyLimit < 1) return null;
  return { table, arn, origin, dailyLimit };
}
