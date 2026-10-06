import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext Cloudflare アダプタ設定。デフォルト（defineCloudflareConfig()）で
// workers 向けのキャッシュ・ノード互換（nodejs_compat）を最適化する。
// 必要に応じて incrementalCache / tagCache / queue をオーバーライドできる。
export default defineCloudflareConfig();