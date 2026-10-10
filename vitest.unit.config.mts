import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // [一時停止]中の route.test.ts など、テスト0件のファイルを失敗扱いしない
    passWithNoTests: true,
  },
});
