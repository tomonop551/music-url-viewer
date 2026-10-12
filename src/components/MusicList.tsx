import Link from "next/link";
import type { MusicUrlRecord } from "@/types/music";
import { MusicCard } from "./MusicCard";

interface MusicListProps {
  items: MusicUrlRecord[];
  query: string;
  page: number;
  pageSize: number;
  total: number;
  lastPage: number;
}

// 検索とページ送りは URL（?q=&page=）で表す。絞り込みは D1 側で済ませてあるので、
// ここは「与えられた 1 ページを描く」だけにしてある（ブラウザ側の状態を持たない）。
export function MusicList({ items, query, page, pageSize, total, lastPage }: MusicListProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const countLabel = query
    ? `「${query}」に一致 ${total} 曲中 ${from}〜${to} 件目`
    : `登録 ${total} 曲中 ${from}〜${to} 件目`;

  // 検索語を保ったままページだけ差し替える（1 ページ目は page を省いて URL を短く保つ）
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (target > 1) params.set("page", String(target));
    const suffix = params.toString();
    return suffix ? `/?${suffix}` : "/";
  };

  const pageLinkClass =
    "rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 transition hover:bg-gray-50";
  const pageDisabledClass = "rounded-lg border border-gray-200 px-3 py-2 text-gray-400";

  return (
    <>
      {/* 件数が増えると検索欄が画面外へ流れるため、追従させて常に手の届く位置に置く */}
      <header className="sticky top-0 z-10 mb-6 border-b border-gray-200/80 bg-gray-50/90 py-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Music URL Viewer
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {countLabel}
              {query && (
                <>
                  {" · "}
                  <Link href="/" className="text-blue-700 underline decoration-blue-200 underline-offset-4">
                    クリア
                  </Link>
                </>
              )}
            </p>
          </div>

          {/* 素の GET フォームなので JS 無しでも送信できる（送信するとページ番号は 1 に戻る） */}
          <form action="/" method="get" role="search" className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <label htmlFor="music-search" className="sr-only">
                タイトルまたはURLで検索
              </label>
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                id="music-search"
                type="search"
                name="q"
                defaultValue={query}
                placeholder="タイトル・URLで検索"
                className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pr-3 pl-9 text-sm text-gray-900 shadow-sm transition outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              検索
            </button>
          </form>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-600">
            {query ? "検索条件に一致する曲が見つかりませんでした。" : "表示できるURLがありません。"}
          </p>
          {query && (
            <Link
              href="/"
              className="mt-4 inline-block rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
            >
              検索をクリア
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <MusicCard key={item.message_id} item={item} />
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <nav aria-label="ページ送り" className="mt-8 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} rel="prev" className={pageLinkClass}>
              前へ
            </Link>
          ) : (
            <span className={pageDisabledClass}>前へ</span>
          )}
          <span className="tabular-nums text-gray-600">
            {page} / {lastPage} ページ
          </span>
          {page < lastPage ? (
            <Link href={pageHref(page + 1)} rel="next" className={pageLinkClass}>
              次へ
            </Link>
          ) : (
            <span className={pageDisabledClass}>次へ</span>
          )}
        </nav>
      )}
    </>
  );
}
