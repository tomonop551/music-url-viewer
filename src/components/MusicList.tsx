import Link from "next/link";
import type { ReactNode } from "react";

import type { MusicUrlRecord } from "@/types/music";
import { MusicCard } from "./MusicCard";
import { PageNav } from "./PageNav";
import { EmptyState } from "./EmptyState";

interface MusicListProps {
  items: MusicUrlRecord[];
  query: string;
  page: number;
  pageSize: number;
  total: number;
  lastPage: number;
  // ヘッダーと一覧の間に差し込む要素（トップの「今日の一曲」）。追従するヘッダーを
  // 先頭に保つ必要があるため、ページ側ではなくここで受け取る。
  hero?: ReactNode;
}

// 検索とページ送りは URL（?q=&page=）で表す。絞り込みは D1 側で済ませてあるので、
// ここは「与えられた 1 ページを描く」だけにしてある（ブラウザ側の状態を持たない）。
export function MusicList({ items, query, page, pageSize, total, lastPage, hero }: MusicListProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  // ヘッダーは総件数だけを持ち、範囲は一覧の見出しに置く（ヒーローの曲と混ざらないようにする）。
  const totalLabel = query ? `「${query}」に一致 ${total} 曲` : `登録 ${total} 曲`;
  const rangeLabel = total === 0 ? "0 件" : `${from}〜${to} 件目`;

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
              {totalLabel}
              {query && (
                <>
                  {" · "}
                  <Link
                    href="/"
                    className="text-blue-700 underline decoration-blue-200 underline-offset-4"
                  >
                    クリア
                  </Link>
                </>
              )}
            </p>
          </div>

          {/* 素の GET フォームなので JS 無しでも送信できる（送信するとページ番号は 1 に戻る） */}
          <form
            action="/"
            method="get"
            role="search"
            className="flex w-full items-center gap-2 sm:w-auto"
          >
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

      {hero}

      <section aria-labelledby="music-list-heading">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="music-list-heading" className="text-base font-semibold text-gray-900">
            曲の一覧
          </h2>
          <p className="text-xs tabular-nums text-gray-600">
            {totalLabel}中 {rangeLabel}
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyState base="/" query={query} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <MusicCard key={item.message_id} item={item} />
            ))}
          </div>
        )}
      </section>

      <PageNav base="/" query={query} page={page} lastPage={lastPage} />
    </>
  );
}
