// プレイリスト機能のための URL 分解。
//
// 一覧表示用の canonicalUrl()（catalog.ts）は流用できない。用途が逆で、
// music.youtube.com/playlist?list=... を `list=` ごと捨てて origin + pathname に潰す。
// プレイリストは「ID が取り出せるか」を見たいので、表示用の正規化とは別の判定をここに置く。

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "music.youtube.com", "youtu.be"]);
const SPOTIFY_HOST = "open.spotify.com";

// 実データ（music_catalog）の動画 ID はすべて 11 文字（英数と - _）。形の合わない値は ID と見なさない。
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// Spotify の ID は 22 文字の base62 だが、実データに track URL が 1 件も無く測れていない。
// 長さを要求すると将来の登録を取り落とす恐れがあるため、いまは区切りと文字種だけを見る。
const SPOTIFY_ID = /^[A-Za-z0-9]{1,64}$/;

export type PlaylistTarget = "youtube" | "spotify";

// https 以外と、資格情報つきの URL は受け付けない（catalog.ts の canonicalUrl と同じ線引き）。
function parseSafe(value: unknown): URL | null {
  if (typeof value !== "string") return null;
  const url = URL.parse(value);
  if (url === null) return null;
  if (url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "") return null;
  return url;
}

function segments(url: URL): string[] {
  return url.pathname.split("/").filter((part) => part !== "");
}

// 動画 ID を取り出す。取れなければ null。
// 実データには watch?v= と youtu.be/ のほかに /live/<id> と /shorts/<id> の形があり、
// 後者2つも ID を持っているため拾う（/embed/<id> は共有用の形として同じ扱いにする）。
export function toVideoId(value: unknown): string | null {
  const url = parseSafe(value);
  if (!url || !YOUTUBE_HOSTS.has(url.hostname)) return null;

  const parts = segments(url);
  let candidate: string | null | undefined;
  if (url.hostname === "youtu.be") {
    candidate = parts[0];
  } else if (parts[0] === "watch") {
    // ラジオ混在（list= / rv= 付き）でも動画 ID は v= にある
    candidate = url.searchParams.get("v");
  } else if (parts[0] === "live" || parts[0] === "shorts" || parts[0] === "embed") {
    candidate = parts[1];
  }

  return candidate !== null && candidate !== undefined && VIDEO_ID.test(candidate)
    ? candidate
    : null;
}

// Spotify のトラック URI を作る。track 以外（アルバム・プレイリスト）は対象外。
export function toSpotifyTrackUri(value: unknown): string | null {
  const url = parseSafe(value);
  if (!url || url.hostname !== SPOTIFY_HOST) return null;

  const parts = segments(url);
  if (parts.length !== 2 || parts[0] !== "track") return null;
  if (!SPOTIFY_ID.test(parts[1])) return null;
  return `spotify:track:${parts[1]}`;
}

// 画面で「なぜ選べないか」を出せるように、除外理由を日本語で返す。
// 選べるときは null。判定は toVideoId / toSpotifyTrackUri と同じ経路を通すため、
// ここだけの判断で「選べるのに理由が付く」ことは起きない。
export function unusableReason(value: unknown, target: PlaylistTarget): string | null {
  const usable = target === "youtube" ? toVideoId(value) : toSpotifyTrackUri(value);
  if (usable) return null;

  if (typeof value !== "string" || value === "") return "URL が記録されていません";

  const url = URL.parse(value);
  if (url === null) return "URL として解釈できません";
  if (url.protocol !== "https:") return "https の URL ではありません";
  if (url.username !== "" || url.password !== "") return "URL に認証情報が含まれています";

  if (target === "youtube") {
    if (!YOUTUBE_HOSTS.has(url.hostname)) return "YouTube 系の URL ではありません";
    return "動画 ID を含まない URL です（再生リスト・チャンネルなど）";
  }
  if (url.hostname !== SPOTIFY_HOST) return "Spotify の URL ではありません";
  return "トラックの URL ではありません（アルバム・プレイリストなど）";
}
