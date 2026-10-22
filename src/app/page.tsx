import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getD1Binding, getMusicPage, MUSIC_PAGE_SIZE } from "@/lib/catalog/d1";
import { MusicList } from "@/components/MusicList";
import type { MusicUrlRecord } from "@/types/music";

export const dynamic = "force-dynamic";

// ISR（Incremental Static Regeneration）: 1 日 = 86400 秒
export const revalidate = 86400;

// 検索語とページ番号は URL（?q=&page=）に載せ、絞り込みは D1 側で行う。
// 一覧は常に 1 ページ分だけを取るので、件数が増えても取得量は一定。
export default async function Home({
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
        <p className="mb-4 text-sm">
          <a href="/playlists" className="text-blue-700 underline decoration-blue-200 underline-offset-4">
            プレイリストを作る →
          </a>
        </p>
        <MusicList
          items={musicUrls}
          query={query}
          page={musicPage.page}
          pageSize={musicPage.pageSize}
          total={musicPage.total}
          lastPage={musicPage.lastPage}
        />
      </div>
    </main>
  );
}
