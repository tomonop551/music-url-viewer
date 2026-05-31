"use client";

import { useState } from "react";
import type { MusicUrlRecord } from "@/types/music";
import { MusicCard } from "./MusicCard";

interface MusicListProps {
  initialMusicUrls: MusicUrlRecord[];
}

export function MusicList({ initialMusicUrls }: MusicListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUrls = initialMusicUrls.filter((item) => {
    if (!searchQuery) return true;
    return item.title?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <>
      <header className="mb-12 relative flex flex-col md:flex-row md:items-start justify-between">
        <div className="text-center md:text-left flex-1">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight sm:text-5xl">
            Music URL Viewer
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            DynamoDBから取得した音楽URLの一覧です（1日1回更新）
          </p>
        </div>
        <div className="mt-6 md:mt-0 md:ml-4 flex-shrink-0 flex justify-end">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="タイトルで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow text-gray-900"
            />
            <svg
              className="absolute right-3 top-2.5 h-4 w-4 text-gray-400"
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
          </div>
        </div>
      </header>

      {filteredUrls.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-500">
            {initialMusicUrls.length === 0
              ? "表示できるURLがありません。"
              : "検索条件に一致するURLが見つかりませんでした。"}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {filteredUrls.map((item) => (
            <MusicCard key={item.message_id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}
