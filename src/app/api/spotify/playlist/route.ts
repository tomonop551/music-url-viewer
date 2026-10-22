import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { pickSpotifyTracks, buildCreatePlaylistRequests, type SpotifyTrack } from "@/lib/playlist/spotify";
import type { SelectableRecord } from "@/lib/playlist/selection-store";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  // クライアントが持つ選択レコード（message_id / url / timestamp / title）
  tracks: z.array(
    z.object({
      message_id: z.string().min(1),
      url: z.string().min(1),
      timestamp: z.string().min(1),
      title: z.string().optional(),
    }),
  ).max(500),
});

interface SpotifyPlaylist {
  id: string;
  external_urls: { spotify: string };
}

// Spotify API でプレイリストを作り、曲を積む。
// 成功・失敗にかかわらず「どこまで進んだか」を応答に含める（再開可能にするため）。
export async function POST(request: Request) {
  const session = await auth();
  const accessToken = session?.accessToken as string | undefined;
  if (!accessToken) {
    return NextResponse.json({ error: "Spotify と連携してください" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "リクエストの内容が不正です" }, { status: 400 });
  }

  // Spotify に載せられる曲だけを選択から拾う（YouTube 等は対象外）
  const records: SelectableRecord[] = parsed.data.tracks;
  const tracks: SpotifyTrack[] = pickSpotifyTracks(records);
  const uris = tracks
    .map((t) => {
      const m = t.url.match(/track\/([A-Za-z0-9]+)/);
      return m ? `spotify:track:${m[1]}` : null;
    })
    .filter((u): u is string => u !== null);

  if (uris.length === 0) {
    return NextResponse.json(
      { error: "Spotify のトラック URL が選択されていません" },
      { status: 400 },
    );
  }

  const requests = buildCreatePlaylistRequests(uris, parsed.data.name);

  // 器を作る
  const createRes = await fetch("https://api.spotify.com/v1/me/playlists", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requests[0]),
  });
  if (!createRes.ok) {
    return NextResponse.json(
      { error: "プレイリストの作成に失敗しました", status: createRes.status },
      { status: 502 },
    );
  }
  const playlist = (await createRes.json()) as SpotifyPlaylist;

  // 曲を積む（失敗したら止めて進捗を返す。続きは再実行で積む）
  let added = 0;
  for (const req of requests.slice(1)) {
    const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: req.uris }),
    });
    if (!addRes.ok) {
      return NextResponse.json({
        playlistId: playlist.id,
        playlistUrl: playlist.external_urls.spotify,
        added,
        total: uris.length,
        error: "曲の追加で失敗しました（再実行で続きから積めます）",
      }, { status: 502 });
    }
    added += req.uris?.length ?? 0;
  }

  return NextResponse.json({
    playlistId: playlist.id,
    playlistUrl: playlist.external_urls.spotify,
    added,
    total: uris.length,
  });
}
