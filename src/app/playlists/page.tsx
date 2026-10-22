import { getCloudflareContext } from "@opennextjs/cloudflare";

import { PlaylistSelector } from "@/components/PlaylistSelector";
import { getD1Binding, getMusicPage, MUSIC_PAGE_SIZE } from "@/lib/catalog/d1";
import type { MusicUrlRecord } from "@/types/music";

export const dynamic = "force-dynamic";

// 一覧（/）と同じ経路で 1 ページ分だけ取る。全件をクライアントに送らないため、
// 件数が増えても取得量と HTML の大きさは一定。
export default async function Playlists({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const requestedPage = Number.parseInt(typeof params.page === "string" ? params.page : "1", 10);

  const db = getD1Binding(getCloudflareContext().env);
  const musicPage = db
    ? await getMusicPage(db, { query, page: requestedPage })
    : { rows: [], total: 0, page: 1, pageSize: MUSIC_PAGE_SIZE, lastPage: 1 };

  const musicUrls: MusicUrlRecord[] = musicPage.rows.map((r) => ({
    message_id: r.message_id,
    url: r.url,
    timestamp: r.timestamp,
    ...(r.title ? { title: r.title } : {}),
    ...(r.dopamine !== undefined ? { dopamine: r.dopamine } : {}),
  }));

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="mb-2 text-sm">
          <a href="/" className="text-blue-700 underline decoration-blue-200 underline-offset-4">
            ← 一覧へ戻る
          </a>
        </p>
        <PlaylistSelector
          items={musicUrls}
          query={query}
          page={musicPage.page}
          pageSize={musicPage.pageSize}
          total={musicPage.total}
          lastPage={musicPage.lastPage}
          initialSelected={[]}
        />
      </div>
    </main>
  );
}
