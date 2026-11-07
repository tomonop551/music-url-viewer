import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 全ルートの Basic 認証ゲート。
// 認証情報は git 管理外（`wrangler secret put`）で注入する。公開リポジトリのため
// 平文シークレットを wrangler.toml / ソースに置かないこと。
// 未設定の環境（ローカル開発など）では素通しする。
export function proxy(request: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization") ?? "";

  if (!isAuthorized(authorization, `${user}:${pass}`)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="music-url-viewer"' },
    });
  }

  return NextResponse.next();
}

// 認証失败は例外ではなく false で返す。atob は不正 base64 で DOMException を
// throw するため（例: `Authorization: Basic ***`）、無ガードだと本来 401 の
// 入力が 500 になり、認証ゲート自体が落ちる。
// 定数時間比較（timingSafeEqual）は入れていない: proxy の実行環境（Edge/OpenNext）で
// node:crypto に依存できる保証が無いこと、タイミング攻撃はこのゲートの具体的な失敗
// モデル外のため、AGENTS.md の「推測的セキュリティのエッジケースの複雑化禁止」に従う。
function isAuthorized(authorization: string, expected: string): boolean {
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Basic" || !token) return false;

  let decoded: string;
  try {
    decoded = atob(token);
  } catch {
    return false;
  }
  return decoded === expected;
}

export const config = {
  // 静的アセットを除く全ルート（HTML / RSC / API）を対象。
  // _next/data はゲート対象に残す（RSC ペイロードが漏れないように）。
  // /api/auth/* は OAuth のコールバック先なので素通しする（Basic 認証では
  // リダイレクトに Authorization が付かず、ここに置くと 401 で詰まる）。
  matcher: "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
};
