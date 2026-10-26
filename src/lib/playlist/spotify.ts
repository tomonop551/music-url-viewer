import { toSpotifyTrackUri } from "../catalog/playlist-url";
import type { SelectableRecord } from "./selection-store";

export type SpotifyTrack = SelectableRecord;

// Spotify に載せられる曲だけを残す。URL → URI の判定は
// playlist-url.ts の既存経路（unusableReason と同じ線引き）に寄せる。
export function pickSpotifyTracks(records: SelectableRecord[]): SpotifyTrack[] {
  return records.filter((r) => toSpotifyTrackUri(r.url) !== null);
}

// Spotify API は 1 リクエストあたり 100曲まで。ここでは 50 曲ずつに分割して
// 失敗時の再開単位を細かく保つ（1 リクエストの失敗でやり直す範囲を狭める）。
const URIS_PER_REQUEST = 50;

export interface CreatePlaylistRequest {
  name?: string;
  uris?: string[];
}

// 1 つ目のリクエストで器を作り、2 つ目以降で曲を積む。
// 曲の追加は 1 リクエスト URIS_PER_REQUEST 本までに分割する。
export function buildCreatePlaylistRequests(uris: string[], name: string): CreatePlaylistRequest[] {
  const requests: CreatePlaylistRequest[] = [{ name }];
  for (let i = 0; i < uris.length; i += URIS_PER_REQUEST) {
    requests.push({ uris: uris.slice(i, i + URIS_PER_REQUEST) });
  }
  return requests;
}
