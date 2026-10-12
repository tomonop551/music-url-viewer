import type { MusicUrlRecord } from "@/types/music";

interface MusicCardProps {
  item: MusicUrlRecord;
}

// 日付は Asia/Tokyo 固定で整形する。表示をリクエストのタイムゾーン任せにすると、
// SSR（Workers は UTC）とブラウザで文字列が食い違い、hydration で表示が入れ替わる。
const timestampFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// プロトコルは一覧では判別の役に立たないため落とし、ホストとパスだけを見せる。
function compactUrl(url: string): string {
  try {
    const { host, pathname, search } = new URL(url);
    return `${host}${pathname}${search}`;
  } catch {
    return url;
  }
}

// 配信元の識別。一覧を目で追うときの手がかりになるため、色とアイコンで区別する。
function PlatformChip({ url }: { url: string }) {
  if (url.includes("spotify.com")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-800 ring-1 ring-inset ring-green-100">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.75.75 0 0 1-1.03.25c-2.8-1.7-6.3-2.1-10.4-1.15a.75.75 0 1 1-.33-1.46c4.5-1.03 8.4-.58 11.5 1.32.36.22.47.68.26 1.04Zm1.2-2.7a.94.94 0 0 1-1.29.31c-3.2-1.97-8.1-2.54-11.9-1.39a.94.94 0 1 1-.54-1.8c4.3-1.3 9.7-.66 13.4 1.6.44.27.58.85.33 1.28Zm.1-2.8C14.06 8.6 7.9 8.4 4.5 9.43a1.13 1.13 0 1 1-.65-2.16C7.7 6.2 14.5 6.44 18.9 9.05a1.13 1.13 0 0 1-1.15 1.95Z" />
        </svg>
        Spotify
      </span>
    );
  }

  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-100">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.9 12 4.9 12 4.9s-6 0-7.7.4A2.7 2.7 0 0 0 2.4 7.2 28 28 0 0 0 2 12c0 1.6.1 3.2.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.4 7.7.4 7.7.4s6 0 7.7-.4a2.7 2.7 0 0 0 1.9-1.9c.3-1.6.4-3.2.4-4.8s-.1-3.2-.4-4.8Z" />
          <path d="M10 15.5v-7l6 3.5-6 3.5Z" fill="#fff" />
        </svg>
        YouTube
      </span>
    );
  }

  return null;
}

export function MusicCard({ item }: MusicCardProps) {
  const title = item.title || compactUrl(item.url);

  return (
    <article className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-within:ring-2 focus-within:ring-blue-200">
      <div className="mb-3 flex items-center justify-between gap-3">
        <PlatformChip url={item.url} />
        <time
          dateTime={item.timestamp}
          className="ml-auto shrink-0 text-xs font-medium tabular-nums text-gray-500"
        >
          {timestampFormatter.format(new Date(item.timestamp))}
        </time>
      </div>

      <h2 className="text-[15px] leading-snug font-semibold text-gray-900">
        {/* カード全面をクリック領域にするため、擬似要素でリンクの当たり判定を広げる */}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          title={title}
          className="line-clamp-2 rounded outline-none group-hover:text-blue-700 after:absolute after:inset-0"
        >
          {title}
          <span className="sr-only">（新しいタブで開く）</span>
        </a>
      </h2>

      {item.title && (
        <p className="mt-1.5 truncate text-xs text-gray-500">{compactUrl(item.url)}</p>
      )}

      {typeof item.dopamine === "number" && (
        <div className="mt-auto flex items-center pt-4">
          <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-[11px] font-semibold text-pink-700 ring-1 ring-inset ring-pink-100">
            中毒性<span className="tabular-nums">{item.dopamine}</span>
          </span>
        </div>
      )}
    </article>
  );
}
