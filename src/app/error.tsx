"use client";

import { useEffect } from "react";

// 一覧・プレイリストのサーバ側例外（D1_ERROR、too many SQL variables、レート制限など）
// の受け皿。ここが無いと Next 既定の無骨な 500 ページがそのまま出る。
// ルートの page.tsx と playlists/page.tsx の両方をこの 1 つの境界が覆う。
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-bg px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-16 text-center">
          <p className="text-base text-fg">一覧の読み込みに失敗しました</p>
          <p className="mt-2 text-sm text-fg-muted">
            サーバーとの通信で問題が起きました。少し時間をおいて再試行してください。
          </p>
          {error instanceof Error && "digest" in error && typeof error.digest === "string" && (
            <p className="mt-2 font-mono text-xs text-fg-subtle">エラーID: {error.digest}</p>
          )}
          <div className="mt-6 flex items-center justify-center gap-4 text-sm">
            <button
              type="button"
              onClick={() => retry()}
              className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-fg-muted transition hover:bg-surface-muted"
            >
              再試行
            </button>
            <a
              href="/"
              className="rounded-lg border border-border-strong px-3 py-2 text-accent underline underline-offset-4"
            >
              先頭へ戻る
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
