import Link from "next/link";

interface EmptyStateProps {
  // 「検索をクリア」のリンク先（"/" または "/playlists"）
  base: string;
  query: string;
}

// 一覧の空状態。検索語があれば「条件に合わなかった」を伝えてクリア導線を出す。
export function EmptyState({ base, query }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-16 text-center">
      <p className="text-sm text-fg-muted">
        {query ? "検索条件に一致する曲が見つかりませんでした。" : "表示できるURLがありません。"}
      </p>
      {query && (
        <Link
          href={base}
          className="mt-4 inline-block rounded-lg border border-border-strong px-3 py-1.5 text-sm text-fg-muted transition hover:bg-surface-muted"
        >
          検索をクリア
        </Link>
      )}
    </div>
  );
}
