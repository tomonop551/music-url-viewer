import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

// Basic 認証ゲートは不正な Authorization ヘッダで例外をこぼして 500 を返してはならない
// （atob は不正 base64 で DOMException を throw する）。401 だけ返すことを固定する。
const request = (authorization?: string) =>
  new NextRequest("https://example.com/", {
    headers: authorization === undefined ? {} : { authorization },
  });

beforeEach(() => {
  vi.stubEnv("BASIC_AUTH_USER", "user");
  vi.stubEnv("BASIC_AUTH_PASSWORD", "pass");
});

afterEach(() => vi.unstubAllEnvs());

describe("Basic 認証ゲート", () => {
  it("正しい認証情報（user:pass）は素通し", () => {
    const response = proxy(request(`Basic ${btoa("user:pass")}`));
    expect(response.status).not.toBe(401);
  });

  it("認証ヘッダ無しは 401 と WWW-Authenticate", () => {
    const response = proxy(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe('Basic realm="music-url-viewer"');
  });

  it("不正な認証情報・ありとあらゆる Authorization ヘッダは例外ではなく 401", async () => {
    const headers = [
      "Basic !!!invalid===", // atob が DOMException を throw する不正 base64
      "Basic @@@@",
      "Basic c29tZXRoaW5n", // 正しい base64 だが user:pass ではない
      "Basic", // スキームのみで token が無い
      "Basic ",
      "Bearer abc",
      "basic dXNlcjpwYXNz", // スキームは大文字小文字を区別する（既定動作を維持）
      "",
      "Basic\taXNvbWU=",
    ];
    for (const authorization of headers) {
      expect(proxy(request(authorization)).status, authorization).toBe(401);
    }
  });

  it("BASIC_AUTH_* 未設定の環境（ローカル開発）は素通し", async () => {
    vi.unstubAllEnvs();
    expect(proxy(request("Basic !!!invalid===")).status).not.toBe(401);
  });
});
