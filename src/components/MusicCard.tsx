import type { MusicUrlRecord } from "@/types/music";

interface MusicCardProps {
  item: MusicUrlRecord;
}

export function MusicCard({ item }: MusicCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md hover:border-blue-100 group">
      <div className="flex justify-between items-start mb-4">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          {item.user_name}
        </span>
        <time className="text-xs text-gray-400">
          {new Date(item.timestamp).toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>

      <h2 className="text-sm font-semibold text-gray-900 mb-2 truncate group-hover:text-blue-600 transition-colors">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2"
        >
          <span>{item.title || item.url}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-4 h-4 flex-shrink-0"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
            />
          </svg>
        </a>
      </h2>

      {item.title && (
        <p className="text-xs text-gray-500 mb-2 truncate">{item.url}</p>
      )}

      <div className="mt-4 flex items-center gap-2">
        {item.dopamine !== undefined && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-pink-50 text-pink-700 border border-pink-200">
            dopamine: {item.dopamine}
          </span>
        )}
        {item.url.includes("spotify.com") && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-green-500 border border-green-200 px-1.5 py-0.5 rounded">
            Spotify
          </span>
        )}
        {(item.url.includes("youtube.com") ||
          item.url.includes("youtu.be")) && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 border border-red-200 px-1.5 py-0.5 rounded">
            YouTube
          </span>
        )}
      </div>
    </div>
  );
}
