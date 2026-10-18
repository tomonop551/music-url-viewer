// AI 呼び出しの1日の予算。無料枠の消費を固定するため、実行前に必ず判定する。
export interface DailyLimitInput {
  count: number; // 当日すでに実行した回数
  limit: number; // 1 日に許す回数
}

export interface DailyLimitResult {
  allowed: boolean;
  remaining: number; // この呼び出しを含まない残り回数
}

export function checkDailyLimit({ count, limit }: DailyLimitInput): DailyLimitResult {
  const remaining = Math.max(0, limit - count);
  return { allowed: remaining > 0, remaining };
}
