"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MusicCard } from "./MusicCard";
import { toSpotifyTrackUri, toVideoId } from "@/lib/playlist-url";
import { countInPage, deselectMany, selectMany, toggleSelection } from "@/lib/selection";
import {
  clearStoredSelection,
  loadSelectedRecordsMap,
  loadStoredSelection,
  RECORDS_KEY,
  STORAGE_KEY,
  storeSelectedRecords,
  storeSelection,
} from "@/lib/selection-store";
import { toCsv } from "@/lib/csv";
import type { MusicUrlRecord } from "@/types/music";

interface PlaylistSelectorProps {
  items: MusicUrlRecord[];
  query: string;
  page: number;
  pageSize: number;
  total: number;
  lastPage: number;
  // 初期選択。サーバ描画と一致させるため props で受け、選択操作はクライアント側だけで完結させる
  initialSelected: string[];
}

// プレイリスト機能の選択UI。検索・ページングの見た目は MusicList と同じ構造。
// 選択状態は URL に載せずクライアントの状態に置く（数百件になり得るため）。
export function PlaylistSelector({
  items,
  query,
  page,
  pageSize,
  total,
  lastPage,
  initialSelected,
}: PlaylistSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));

  // localStorage の復元はマウント後に行う。SSR の HTML と storage の値は独立しているため、
  // 初回描画に使うと hydration の食い違いになる（初期選択は空で描き、直後に合わせ込む）。
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    setSelected(() => loadStoredSelection(() => window.localStorage.getItem(STORAGE_KEY)));
    setRestored(true);
  }, []);

  // 選択の変化を storage へ退避する。復元の直前に空集合を書かないよう、
  // 復元が済んでから書き込みを始める（復元→空書き込みで保存値を消す事故の予防）。
  useEffect(() => {
    if (!restored) return;
    storeSelection(selected, (value) => localStorage.setItem(STORAGE_KEY, value));
  }, [selected, restored]);

  // 表示中のレコードを、選択の有無と無関係に退避する（書き出しの材料のキャッシュ）。
  // 選択を解除しても書き出しには使える状態を保つため、依存は items のみ。
  useEffect(() => {
    storeSelectedRecords(items, (key, value) => localStorage.setItem(key, value));
  }, [items]);

  // 判定は selection.ts の純関数に寄せる。コンポーネントは状態の受け渡しだけを担う。
  const toggle = (id: string) => setSelected((prev) => toggleSelection(prev, id));

  const selectableIds = items.map((item) => item.message_id);
  const selectedInPage = countInPage(selected, selectableIds);

  // 選べる曲が 1 件以上あるときだけ「全選択」を有効にする（選択は対象ページ内で完結する）
  const allSelected = selectableIds.length > 0 && selectedInPage === selectableIds.length;
  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        // 全解除は storage の保存値も消す。残ると「解除したのに復帰する」ように見えるため
        clearStoredSelection((key) => localStorage.removeItem(key));
        return deselectMany(prev, selectableIds);
      }
      return selectMany(prev, selectableIds);
    });
  };

  // 書き出しはクライアント側の Blob で完結させる（サーバに状態を持たない）。
  // 対象の材料は退避しておいたレコードから拾うため、全件をクライアントに持たなくて済む。
  const exportCsv = () => {
    const records = loadSelectedRecordsMap(() => localStorage.getItem(RECORDS_KEY));
    const rows = [...selected]
      .map((id) => records[id])
      .filter((r): r is NonNullable<typeof r> => r !== undefined)
      .map((r) => ({
        message_id: r.message_id,
        title: r.title ?? "",
        url: r.url,
        timestamp: r.timestamp,
      }));
    if (rows.length === 0) return;

    const csv = toCsv(rows, ["message_id", "title", "url", "timestamp"]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "playlist.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // 検索語を保ったままページだけ差し替える（1 ページ目は page を省いて URL を短く保つ）
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (target > 1) params.set("page", String(target));
    const suffix = params.toString();
    return suffix ? `/playlists?${suffix}` : "/playlists";
  };

  const countLabel = query
    ? `「${query}」に一致 ${total} 曲中 ${(page - 1) * pageSize + 1}〜${Math.min(page * pageSize, total)} 件目`
    : `登録 ${total} 曲中 ${(page - 1) * pageSize + 1}〜${Math.min(page * pageSize, total)} 件目`;

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
              プレイリストを作る
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {countLabel} · 選択 {selected.size} 件
            </p>
          </div>

          {/* 素の GET フォームなので JS 無しでも送信できる（送信するとページ番号は 1 に戻る） */}
          <form action="/playlists" method="get" role="search" className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <label htmlFor="playlist-search" className="sr-only">
                タイトルまたはURLで検索
              </label>
              <input
                id="playlist-search"
                type="search"
                name="q"
                defaultValue={query}
                placeholder="タイトル・URLで検索"
                className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pr-3 pl-3 text-sm text-gray-900 shadow-sm transition outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
              href="/playlists"
              className="mt-4 inline-block rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
            >
              検索をクリア
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
            >
              {allSelected ? "全解除" : "全選択"}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={selected.size === 0}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                selected.size === 0
                  ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              CSV で書き出す（{selected.size} 件）
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <PlaylistCard
                key={item.message_id}
                item={item}
                selected={selected.has(item.message_id)}
                onToggle={() => toggle(item.message_id)}
              />
            ))}
          </div>
        </>
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

interface PlaylistCardProps {
  item: MusicUrlRecord;
  selected: boolean;
  onToggle: () => void;
}

// 選択のON/OFFをカードの左上に置く。動画 ID も Spotify track も取れない URL は、
// どの書き出し先にも載せられないためチェックボタンごと無効化する（理由の表示は後続の刻み）。
function PlaylistCard({ item, selected, onToggle }: PlaylistCardProps) {
  const selectable = toVideoId(item.url) !== null || toSpotifyTrackUri(item.url) !== null;
  return (
    <div className="relative">
      <MusicCard item={item} />
      <label
        className={`absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 shadow-sm ring-1 ring-gray-200 ${
          selectable ? "cursor-pointer" : "cursor-not-allowed opacity-40"
        }`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          disabled={!selectable}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-200"
        />
        <span className="sr-only">選択</span>
      </label>
    </div>
  );
}
