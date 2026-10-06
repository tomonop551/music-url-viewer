import { getMusicRows, type D1Database } from "@/lib/d1";
import { validListRows } from "@/lib/catalog";
import { MusicChat } from "@/components/MusicChat";
import { MusicList } from "@/components/MusicList";
import type { MusicUrlRecord } from "@/types/music";

// Cloudflare（OpenNext on Workers）ではバインディングが process.env に注入される。
// ハンドラ外で binding を参照できないため、関数で取得する。
export const dynamic = "force-dynamic";

// ISR（Incremental Static Regeneration）: 1 日 = 86400 秒
export const revalidate = 86400;

function db(): D1Database | undefined {
  if (!process.env.DB) return undefined;
  return process.env.DB as unknown as D1Database;
}

export default async function Home() {
  const rows = db() ? await getMusicRows(db()!) : [];
  const musicUrls: MusicUrlRecord[] = validListRows(rows).map((r) => ({
    message_id: r.message_id,
    url: r.url,
    user_name: r.user_name,
    timestamp: r.timestamp,
    ...(r.title ? { title: r.title } : {}),
    ...(typeof r.dopamine === "number" ? { dopamine: r.dopamine } : {}),
  }));
  // チャット可用: D1 と Workers AI バインディング、APP_ORIGIN が揃ったとき
  const chatAvailable = Boolean(process.env.DB && process.env.AI && process.env.APP_ORIGIN);

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-w-0"><MusicList initialMusicUrls={musicUrls} /></section>
        <MusicChat available={chatAvailable} />
      </div>
    </main>
  );
}