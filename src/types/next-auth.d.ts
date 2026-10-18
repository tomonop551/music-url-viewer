import { DefaultSession } from "next-auth";

// Auth.js の JWT callback で accessToken を token に載せるための型補完。
// セッショントークンは cookie のみで、D1 には保存しない（issue #22 のセキュリティ要件）。
declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
  }
}

// DefaultSession を参照して型の継承関係を保つ（side-effect import のみ）
export type { DefaultSession };
