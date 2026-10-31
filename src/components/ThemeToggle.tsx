"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

// テーマ設定の保存キー。layout.tsx のインラインスクリプトと同じ値にする必要があるが、
// インラインスクリプトは定数を import できないため、約束で揃える（片方だけ変えると崩れる）。
const STORAGE_KEY = "theme";

type Mode = "light" | "dark" | "system";

// 正誤は <html> のクラス 1 つで表す。トークンの色値は color-scheme（=クラス）に
// light-dark() で連動し、dark: variant も同じクラスを追う。layout.tsx の
// インラインスクリプトと同じ判定を行う（こちらは描画後・切替時の再適用）。
function applyMode(mode: Mode) {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
}

const options: { value: Mode; label: string; icon: ReactNode }[] = [
  {
    value: "light",
    label: "明るい",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "暗い",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "システムに合わせる",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </svg>
    ),
  },
];

export function ThemeToggle() {
  // 未保存時の見た目は明色（layout.tsx のスクリプトの既定と同じ前提）。
  const [mode, setMode] = useState<Mode>("light");

  // localStorage の復元はマウント後。SSR の HTML には選択が無いので、初回描画で読むと
  // hydration が食い違う（PlaylistSelector の選択復元と同じ形）。
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") setMode(stored);
  }, []);

  // システム追従の間は OS 設定の実時変化にも追随する。
  useEffect(() => {
    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyMode("system");
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [mode]);

  const select = (next: Mode) => {
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyMode(next);
  };

  return (
    <div
      role="group"
      aria-label="テーマ切替"
      className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-surface p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => select(option.value)}
          aria-pressed={mode === option.value}
          className={`rounded-lg p-1.5 transition ${
            mode === option.value
              ? "bg-surface-muted text-fg"
              : "text-fg-muted hover:bg-surface-muted"
          }`}
        >
          {option.icon}
          <span className="sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
