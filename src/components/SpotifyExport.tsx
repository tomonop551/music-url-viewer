"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import type { SelectableRecord } from "@/lib/selection-store";

interface SpotifyExportProps {
  tracks: SelectableRecord[];
  selectedCount: number;
}

interface ImportResult {
  playlistUrl?: string;
  added?: number;
  total?: number;
  error?: string;
}

// 選択中の曲を Spotify のプレイリストとして作る。進捗（追加できた件数）を出し、
// 失敗時は続きから再実行できる形の応答を受け取る。
export function SpotifyExport({ tracks, selectedCount }: SpotifyExportProps) {
  const { status } = useSession();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const create = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/spotify/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `music-url-viewer ${new Date().toLocaleDateString("ja-JP")}`,
          tracks,
        }),
      });
      const data = await res.json();
      setResult(res.ok ? data : { ...data, error: data.error ?? "作成に失敗しました" });
    } catch {
      setResult({ error: "通信に失敗しました" });
    } finally {
      setBusy(false);
    }
  };

  if (status === "unauthenticated") {
    return <SpotifySignIn />;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={create}
        disabled={busy || selectedCount === 0}
        className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
          busy || selectedCount === 0
            ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"
            : "bg-green-600 text-white hover:bg-green-700"
        }`}
      >
        {busy ? "作成中…" : `Spotify に作成（${selectedCount} 件）`}
      </button>
      {result && (
        <p className="text-xs text-gray-600">
          {result.error ? (
            <span className="text-red-700">
              {result.error}（追加済み {result.added ?? 0}/{result.total ?? "?"} 件）
            </span>
          ) : (
            <>
              作成完了（{result.added}/{result.total} 件） —{" "}
              <a
                href={result.playlistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-700 underline decoration-green-200 underline-offset-4"
              >
                Spotify で開く
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}

function SpotifySignIn() {
  return (
    <button
      type="button"
      onClick={() => signIn("spotify", { callbackUrl: "/playlists" })}
      className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
    >
      Spotify と連携する
    </button>
  );
}
