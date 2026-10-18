import { describe, expect, it } from "vitest";
import { SpotifyTrack, buildCreatePlaylistRequests, pickSpotifyTracks } from "./spotify";

// 選択 → Spotify への変換は、全曲を一括で投げない構成を固定する。
// API の失敗が起きたとき「どの曲まで済んだか」を残すため、
// 分割数の計算はここで確定させておく。
describe("選択曲の整理", () => {
  const track = (over: Partial<SpotifyTrack> = {}): SpotifyTrack => ({
    message_id: "a",
    url: "https://open.spotify.com/track/0123456789abcdefghijkl",
    timestamp: "2026-01-01T00:00:00Z",
    title: "A",
    ...over,
  });

  it("YouTube URL を選択から外す（Spotify に持っていけないため）", () => {
    const records = [
      track(),
      track({ message_id: "b", url: "https://youtu.be/b" }),
      track({ message_id: "c", url: "https://open.spotify.com/track/abcdefghijklmnopqrstuv" }),
    ];
    const picked = pickSpotifyTracks(records);
    expect(picked.map((t) => t.message_id)).toEqual(["a", "c"]);
  });

  it("Spotify 以外の URL も外す", () => {
    const records = [
      track({ url: "https://music.apple.com/jp/album/demo/1" }),
      track({ message_id: "b", url: "https://open.spotify.com/track/0123456789abcdefghijkl" }),
    ];
    expect(pickSpotifyTracks(records)).toHaveLength(1);
  });
});

describe("分割数の計算", () => {
  it("1 リクエストあたりの上限で分割する", () => {
    // 100 曲 / 上限 50 曲 → 器 1 + 追加 2 リクエスト
    const requests = buildCreatePlaylistRequests(
      Array.from({ length: 100 }, (_, i) => `spotify:track:id${i}`),
      "プレイリスト",
    );
    expect(requests).toHaveLength(3);
    expect(requests[0].uris).toBeUndefined(); // 器を作るだけ
    expect(requests[1].uris).toHaveLength(50);
    expect(requests[2].uris).toHaveLength(50);
  });

  it("曲が 0 でも器だけは作る", () => {
    const requests = buildCreatePlaylistRequests([], "空のプレイリスト");
    expect(requests).toHaveLength(1);
    expect(requests[0].name).toBe("空のプレイリスト");
  });
});
