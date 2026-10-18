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
  const [scheme, token] = authorization.split(" ");
  const valid = scheme === "Basic" && atob(token ?? "") === `${user}:${pass}`;

  if (!valid) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="music-url-viewer"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  // 静的アセットを除く全ルート（HTML / RSC / API）を対象。
  // _next/data はゲート対象に残す（RSC ペイロードが漏れないように）。
  // /api/auth/* は OAuth のコールバック先なので素通しする（Basic 認証では
  // リダイレクトに Authorization が付かず、ここに置くと 401 で詰まる）。
  matcher: "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
};
