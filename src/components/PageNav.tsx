import Link from "next/link";

// 検索語を保ったままページだけ差し替える（1 ページ目は page を省いて URL を短く保つ）
function pageHref(base: string, query: string, target: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (target > 1) params.set("page", String(target));
  const suffix = params.toString();
  return suffix ? `${base}?${suffix}` : base;
}

const pageLinkClass =
  "rounded-lg border border-border-strong bg-surface px-3 py-2 text-fg-muted transition hover:bg-surface-muted";
const pageDisabledClass = "rounded-lg border border-border px-3 py-2 text-fg-subtle";

interface PageNavProps {
  // ベースのパス（"/" または "/playlists"）
  base: string;
  query: string;
  page: number;
  lastPage: number;
}

// ページ送り。最終ページが 1 なら描かない。
export function PageNav({ base, query, page, lastPage }: PageNavProps) {
  if (lastPage <= 1) return null;

  return (
    <nav aria-label="ページ送り" className="mt-8 flex items-center justify-center gap-4 text-sm">
      {page > 1 ? (
        <Link href={pageHref(base, query, page - 1)} rel="prev" className={pageLinkClass}>
          前へ
        </Link>
      ) : (
        <span className={pageDisabledClass}>前へ</span>
      )}
      <span className="tabular-nums text-fg-muted">
        {page} / {lastPage} ページ
      </span>
      {page < lastPage ? (
        <Link href={pageHref(base, query, page + 1)} rel="next" className={pageLinkClass}>
          次へ
        </Link>
      ) : (
        <span className={pageDisabledClass}>次へ</span>
      )}
    </nav>
  );
}
