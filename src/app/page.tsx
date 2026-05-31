import { getMusicUrls } from "@/lib/dynamodb";
import { MusicList } from "@/components/MusicList";
import type { MusicUrlRecord } from "@/types/music";

// Skip static generation during build to avoid AccessDeniedException in Amplify build environment
export const dynamic = "force-dynamic";

// Set ISR (Incremental Static Regeneration): 1 day = 86400 seconds
export const revalidate = 86400;

export default async function Home() {
  const musicUrls = await getMusicUrls();

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <MusicList initialMusicUrls={musicUrls as MusicUrlRecord[]} />
      </div>
    </main>
  );
}
