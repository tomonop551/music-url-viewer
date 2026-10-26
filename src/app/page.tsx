import { jstDateKey } from "@/lib/catalog/daily-pick";
import { toRecord } from "@/lib/catalog/catalog";
import { loadDailyPick, loadMusicPage } from "@/lib/catalog/source";
import { MusicList } from "@/components/MusicList";
import { TodayPick } from "@/components/TodayPick";

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

  // 「今日」はサーバ側で 1 回だけ確定させる。クライアントで new Date() から求めると、
  // 日付を跨いだ瞬間に SSR と hydration で別の曲になる。
  const dateKey = jstDateKey(new Date());

  // 「今日の一曲」は検索語に依らず全件から選ぶ。そのため一覧とは別に引く（page 2 以降も同じ曲）。
  const [musicPage, dailyPick] = await Promise.all([
    loadMusicPage({ query, page: requestedPage }),
    loadDailyPick(dateKey),
  ]);

  const musicUrls = musicPage.rows.map(toRecord);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 text-sm">
          <a
            href="/playlists"
            className="text-blue-700 underline decoration-blue-200 underline-offset-4"
          >
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
          hero={<TodayPick item={dailyPick ? toRecord(dailyPick) : null} dateKey={dateKey} />}
        />
      </div>
    </main>
  );
}
