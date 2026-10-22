import { describe, expect, it } from "vitest";
import { toSpotifyTrackUri, toVideoId, unusableReason } from "./playlist-url";

// URL は実データ（music_catalog）から採取した形をそのまま使う。
// 追跡クエリ（si=）や list= が付いたまま登録されているので、それを落とせることを固定する。
describe("動画 ID の切り出し", () => {
  it("実データにあった形から動画 ID を取り出す", () => {
    const cases: [string, string][] = [
      ["https://music.youtube.com/watch?v=NFRMOc3zNHk", "NFRMOc3zNHk"],
      ["https://music.youtube.com/watch?v=bOxfM1SqX14&si=VcR3TwQkQhRbNQZa", "bOxfM1SqX14"],
      ["https://www.youtube.com/watch?v=6RTLznn_I7k", "6RTLznn_I7k"],
      // ラジオ混在（list= と rv= が付く）。動画 ID は v= にある
      ["https://www.youtube.com/watch?v=-M5i-JYvgyQ&list=RD-M5i-JYvgyQ&start_radio=1&rv=k2OY3xxUO0w", "-M5i-JYvgyQ"],
      ["https://youtu.be/oCb89c0MDVk?si=iwEOcO-ByqBrQUGG", "oCb89c0MDVk"],
      ["https://youtu.be/JwOuZ0XQOSM", "JwOuZ0XQOSM"],
      // パスに ID がある形。当初の案では取り落としていた
      ["https://www.youtube.com/live/C4qJeIjNd2U", "C4qJeIjNd2U"],
      ["https://youtube.com/shorts/6juOTj7K2Fo?si=xkBxPBu64Hyw_nsz", "6juOTj7K2Fo"],
      ["https://www.youtube.com/embed/fWNaR-rxAic", "fWNaR-rxAic"],
    ];
    for (const [url, id] of cases) expect(toVideoId(url), url).toBe(id);
  });

  it("動画 ID を持たない URL は null", () => {
    // 再生リストとチャンネルは実データにあった形
    for (const url of [
      "https://youtube.com/playlist?list=PLV0FohNukCl0K51cer3VpHUQWNKSzP04g&si=oi58toyD2HXvYkmr",
      "https://music.youtube.com/playlist?list=OLAK5uy_nIZetgKJuMQ7rConC54DIpHgB1G1u7v-Y&si=VTNPmtBJ9kPsWvf3",
      "https://youtube.com/@norinori_core",
      "https://open.spotify.com/track/0123456789abcdefghijkl",
      "https://music.apple.com/jp/album/demo/1",
    ]) {
      expect(toVideoId(url), url).toBeNull();
    }
  });

  it("危険な URL と形の合わない ID は拒否する", () => {
    for (const value of [
      null,
      undefined,
      42,
      "",
      "javascript:alert(1)",
      "http://youtu.be/oCb89c0MDVk",
      "https://user:pass@youtu.be/oCb89c0MDVk",
      "https://youtube.com.evil.example/watch?v=oCb89c0MDVk",
    ]) {
      expect(toVideoId(value)).toBeNull();
    }
    // 11 文字でない値は ID として扱わない（catalog.test.ts が使う "demo" は通らない）
    for (const url of ["https://youtu.be/demo", "https://www.youtube.com/watch?v=short"]) {
      expect(toVideoId(url), url).toBeNull();
    }
  });
});

describe("Spotify のトラック URI", () => {
  // 実データに track URL が無いため、ID は 22 文字 base62 の合成値を使う
  const id = "0123456789abcdefghijkl";

  it("track の URL を uri に変換する", () => {
    expect(toSpotifyTrackUri(`https://open.spotify.com/track/${id}`)).toBe(`spotify:track:${id}`);
    expect(toSpotifyTrackUri(`https://open.spotify.com/track/${id}?si=abc`)).toBe(`spotify:track:${id}`);
  });

  it("track 以外と他ホストは null", () => {
    for (const url of [
      "https://open.spotify.com/album/0123456789abcdefghijkl",
      "https://open.spotify.com/playlist/0123456789abcdefghijkl",
      `https://open.spotify.com/track/${id}/extra`,
      "https://open.spotify.com/track/",
      "https://youtu.be/oCb89c0MDVk",
    ]) {
      expect(toSpotifyTrackUri(url), url).toBeNull();
    }
  });
});

describe("除外理由", () => {
  it("選べるときは null を返す", () => {
    expect(unusableReason("https://youtu.be/oCb89c0MDVk", "youtube")).toBeNull();
    expect(unusableReason("https://open.spotify.com/track/0123456789abcdefghijkl", "spotify")).toBeNull();
  });

  it("選べないときは理由を返す", () => {
    const cases: [unknown, "youtube" | "spotify", string][] = [
      ["https://music.youtube.com/playlist?list=OLAK5uy_nIZetgKJuMQ7rConC54DIpHgB1G1u7v-Y", "youtube", "動画 ID"],
      ["https://youtube.com/@norinori_core", "youtube", "動画 ID"],
      ["https://music.apple.com/jp/album/demo/1", "youtube", "YouTube"],
      ["https://open.spotify.com/album/0123456789abcdefghijkl", "spotify", "トラック"],
      ["https://youtu.be/oCb89c0MDVk", "spotify", "Spotify"],
      ["http://youtu.be/oCb89c0MDVk", "youtube", "https"],
      ["not a url", "youtube", "解釈"],
      [null, "youtube", "記録されていません"],
    ];
    for (const [value, target, expected] of cases) {
      expect(unusableReason(value, target), String(value)).toContain(expected);
    }
  });
});
