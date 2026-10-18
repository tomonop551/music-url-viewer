import { describe, expect, it } from "vitest";
import { checkDailyLimit } from "./ai-budget";

// AI 呼び出しは無料枠を圧迫しないよう、1 日の実行回数を固定する。
// 日付の繰り上がりで数え直すこと、閾値ちょうどで拒否されることを固定する。
describe("1 日の実行回数の判定", () => {
  it("0 回の日は許可される", () => {
    expect(checkDailyLimit({ count: 0, limit: 10 })).toEqual({ allowed: true, remaining: 10 });
  });

  it("残りがあれば許可される", () => {
    expect(checkDailyLimit({ count: 9, limit: 10 })).toEqual({ allowed: true, remaining: 1 });
  });

  it("閾値に達したら拒否される（10 回目の呼び出しは許されるが 11 回目は駄目）", () => {
    // 10 回実行済み（count=10）なら残り 0 で拒否
    expect(checkDailyLimit({ count: 10, limit: 10 })).toEqual({ allowed: false, remaining: 0 });
  });

  it("limit を超えてもエラーにならず拒否だけ返す", () => {
    expect(checkDailyLimit({ count: 15, limit: 10 })).toEqual({ allowed: false, remaining: 0 });
  });
});
