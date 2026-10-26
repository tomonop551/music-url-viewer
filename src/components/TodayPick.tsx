import type { MusicUrlRecord } from "@/types/music";

import {
  compactUrl,
  DopamineChip,
  formatDateKey,
  formatTimestamp,
  PlatformChip,
} from "./MusicDisplay";

interface TodayPickProps {
  // 空カタログ（total = 0）では描かない。呼び出し側は null を渡す。
  item: MusicUrlRecord | null;
  // JST の日付（YYYY-MM-DD）。サーバ側で 1 回だけ確定させて値で渡す（クライアントで
  // new Date() から求めると、日付を跨いだ瞬間に SSR と hydration で別の日付になる）。
  dateKey: string;
}

// 「今日の一曲」のヒーロー。日付から選ばれた 1 曲だけを大きく見せ、
// 下に続く「1 ページ 50 件の一覧」とは別のものだと見た目で分かるようにする。
export function TodayPick({ item, dateKey }: TodayPickProps) {
  if (!item) return null;

  const title = item.title || compactUrl(item.url);

  return (
    <section
      aria-label="今日の一曲"
      className="mx-auto mb-10 max-w-2xl rounded-3xl border border-border bg-surface px-6 py-8 text-center shadow-sm sm:px-10 sm:py-10"
    >
      <p className="text-[11px] font-semibold tracking-[0.2em] text-accent">
        今日の一曲
        <span className="ml-2 font-normal tracking-normal text-fg-muted">
          <time dateTime={dateKey}>{formatDateKey(dateKey)}</time>
        </span>
      </p>

      <h2 className="mt-4 text-2xl leading-snug font-bold tracking-tight text-fg sm:text-3xl">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          title={title}
          className="rounded outline-none underline-offset-4 hover:text-accent hover:underline focus-visible:ring-2 focus-visible:ring-blue-200"
        >
          {title}
          <span className="sr-only">（新しいタブで開く）</span>
        </a>
      </h2>

      {item.title && <p className="mt-2 truncate text-xs text-fg-muted">{compactUrl(item.url)}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-fg-muted">
        <PlatformChip url={item.url} />
        {typeof item.dopamine === "number" && <DopamineChip value={item.dopamine} />}
        <span className="tabular-nums">登録日 {formatTimestamp(item.timestamp)}</span>
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex items-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        開く
        <span className="sr-only">（新しいタブで開く）</span>
      </a>
    </section>
  );
}
