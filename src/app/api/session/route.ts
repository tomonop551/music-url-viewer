import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// ユーザ情報を返さない。 Basic 認証の外に出す Route ではないため、状態だけで十分
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  return NextResponse.json({
    authenticated: true,
    expires: session.expires,
  }, { status: 200 });
}
