"use client";

import { useState } from "react";

interface Suggestion {
  message_id: string;
  reason: string;
}

interface AiSuggestProps {
  // 選択中の曲に提案を追加できるよう、選択状態の操作を受け取る
  onPick?: (messageId: string) => void;
  // 提案の表示とリンク先に使う対応表（message_id → title / url）
  urlById: Record<string, string>;
  titleById: Record<string, string>;
}

// テーマを渡すと AI が候補の中から選曲して提案する。
// 提案は候補の中からしか選ばれないため、存在しない曲が出ることはない（route 側で濾過済み）。
export function AiSuggest({ onPick, urlById, titleById }: AiSuggestProps) {
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suggest = async () => {
    if (theme.trim() === "") return;
    setBusy(true);
    setError(null);
    setSuggestions(null);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "提案の取得に失敗しました");
        return;
      }
      setSuggestions(data.suggestions as Suggestion[]);
    } catch {
      setError("通信に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          onKeyDown={(e) => {
            // IME の変換確定の Enter は送信に使わない（「今日」の変換確定で
            // 意図しない送信が走るため。isComposing の間は無視する）
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") suggest();
          }}
          placeholder="テーマを入力（例: 雨の日に聴きたい）"
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
        <button
          type="button"
          onClick={suggest}
          disabled={busy || theme.trim() === ""}
          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            busy || theme.trim() === ""
              ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"
              : "bg-purple-600 text-white hover:bg-purple-700"
          }`}
        >
          {busy ? "考え中…" : "提案してもらう"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}

      {suggestions && (
        <ul className="mt-3 space-y-2">
          {suggestions.length === 0 && (
            <li className="text-xs text-gray-600">提案できる曲が見つかりませんでした。</li>
          )}
          {suggestions.map((s) => (
            <li
              key={s.message_id}
              className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2"
            >
              <div className="min-w-0">
                <a
                  href={urlById[s.message_id]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-medium text-gray-900 hover:text-blue-700 hover:underline"
                >
                  {titleById[s.message_id] ?? "(無題)"}
                </a>
                <p className="mt-0.5 text-xs text-gray-600">{s.reason}</p>
              </div>
              {onPick && (
                <button
                  type="button"
                  onClick={() => onPick(s.message_id)}
                  className="shrink-0 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 transition hover:bg-gray-50"
                >
                  選択に加える
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
