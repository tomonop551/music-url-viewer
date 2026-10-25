import type { MusicUrlRecord } from "@/types/music";

import { compactUrl, DopamineChip, formatTimestamp, PlatformChip } from "./MusicDisplay";

interface MusicCardProps {
  item: MusicUrlRecord;
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
          {formatTimestamp(item.timestamp)}
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
          <DopamineChip value={item.dopamine} />
        </div>
      )}
    </article>
  );
}
