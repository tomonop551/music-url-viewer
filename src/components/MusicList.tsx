"use client";

import { useMemo, useState } from "react";
import type { MusicUrlRecord } from "@/types/music";
import { MusicCard } from "./MusicCard";

interface MusicListProps {
  initialMusicUrls: MusicUrlRecord[];
}

export function MusicList({ initialMusicUrls }: MusicListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const query = searchQuery.trim().toLowerCase();

  // タイトルが未取得の行も URL で辿れるようにする（一覧は 300 件規模になる想定）。
  const filteredUrls = useMemo(
    () =>
      query
        ? initialMusicUrls.filter(
            (item) =>
              item.title?.toLowerCase().includes(query) ||
              item.url.toLowerCase().includes(query),
          )
        : initialMusicUrls,
    [initialMusicUrls, query],
  );

  const countLabel = query
    ? `${initialMusicUrls.length} 曲中 ${filteredUrls.length} 曲が該当`
    : `登録 ${initialMusicUrls.length} 曲`;

  return (
    <>
      {/* 件数が増えると検索欄が画面外へ流れるため、追従させて常に手の届く位置に置く */}
      <header className="sticky top-0 z-10 mb-6 border-b border-gray-200/80 bg-gray-50/90 py-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Music URL Viewer
            </h1>
            <p role="status" className="mt-1 text-sm text-gray-600">
              {countLabel}
            </p>
          </div>

          <div className="relative w-full sm:w-72">
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
              type="text"
              placeholder="タイトル・URLで検索"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pr-9 pl-9 text-sm text-gray-900 shadow-sm transition outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="検索をクリア"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {filteredUrls.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-600">
            {initialMusicUrls.length === 0
              ? "表示できるURLがありません。"
              : "検索条件に一致する曲が見つかりませんでした。"}
          </p>
          {query && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-4 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
            >
              検索をクリア
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredUrls.map((item) => (
            <MusicCard key={item.message_id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}
