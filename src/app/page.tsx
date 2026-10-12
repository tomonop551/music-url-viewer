import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getD1Binding, getMusicRows } from "@/lib/d1";
// import { MusicChat } from "@/components/MusicChat"; // [一時停止] AIチャット（Cloudflare移行優先）
import { MusicList } from "@/components/MusicList";
import type { MusicUrlRecord } from "@/types/music";

export const dynamic = "force-dynamic";

// ISR（Incremental Static Regeneration）: 1 日 = 86400 秒
export const revalidate = 86400;

export default async function Home() {
  // D1 などのオブジェクトバインディングは process.env には注入されないため、
  // リクエストコンテキスト（getCloudflareContext）経由で取得する。
  const db = getD1Binding(getCloudflareContext().env);
  const rows = db ? await getMusicRows(db) : [];
  // 行の形は lib/catalog のスキーマで検証済み（title / dopamine は未取得なら undefined）
  const musicUrls: MusicUrlRecord[] = rows.map((r) => ({
    message_id: r.message_id,
    url: r.url,
    timestamp: r.timestamp,
    ...(r.title ? { title: r.title } : {}),
    ...(r.dopamine !== undefined ? { dopamine: r.dopamine } : {}),
  }));
  // const chatAvailable = Boolean(process.env.DB && process.env.AI && process.env.APP_ORIGIN); // [一時停止] AIチャット

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <MusicList initialMusicUrls={musicUrls} />
        {/* [一時停止] <MusicChat available={chatAvailable} /> */}
      </div>
    </main>
  );
}