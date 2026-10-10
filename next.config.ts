import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare（OpenNext on Workers）へデプロイするため nodejs server が Worker に変換される。
  // 画像最適化など Cloudflare Images 設定が必要になればここに追記する。
};

export default nextConfig;