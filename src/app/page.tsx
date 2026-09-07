import { getMusicUrls } from "@/lib/dynamodb";
import { getChatConfig } from "@/lib/chat-config";
import { MusicChat } from "@/components/MusicChat";
import { MusicList } from "@/components/MusicList";

// Skip static generation during build to avoid AccessDeniedException in Amplify build environment
export const dynamic = "force-dynamic";

// Set ISR (Incremental Static Regeneration): 1 day = 86400 seconds
export const revalidate = 86400;

export default async function Home() {
  const musicUrls = await getMusicUrls();
  const chatAvailable = getChatConfig() !== null;

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-w-0"><MusicList initialMusicUrls={musicUrls} /></section>
        <MusicChat available={chatAvailable} />
      </div>
    </main>
  );
}
