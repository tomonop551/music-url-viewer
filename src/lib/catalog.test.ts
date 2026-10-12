import { describe, expect, it } from "vitest";
import { canonicalUrl, fingerprint, modelCatalog, parseMusicRows, score, type CatalogItem, type FeatureRow, type MusicRow } from "./catalog";

const row = (over: Partial<MusicRow> = {}): MusicRow => ({
  message_id: "demo",
  url: "https://open.spotify.com/track/demo",
  timestamp: "2026-01-01T00:00:00Z",
  ...over,
});

describe("カタログ", () => {
  it("Provider 由来の内容は除外され、期限切れメタは無視される", async () => {
    const record = { ...row(), title: "PRIVATE_PROVIDER_TITLE", dopamine: 0 };
    const unknown = await modelCatalog([record], new Map());
    expect(JSON.stringify(unknown)).not.toContain("PRIVATE");
    expect(unknown[0].dopamine).toBe(0);

    const feature: FeatureRow = {
      message_id: "demo",
      fingerprint: await fingerprint(record),
      status: "matched",
      source: "musicbrainz",
      title: "Independent title",
      artist: "Demo artist",
      tags: JSON.stringify(["ambient"]),
      source_url: "https://musicbrainz.org/recording/demo",
    };
    const matched = await modelCatalog([record], new Map([["demo", feature]]));
    expect(matched[0].title).toBe("Independent title");

    const changed = { ...record, url: "https://open.spotify.com/track/changed" };
    const stale = await modelCatalog([changed], new Map([["demo", feature]]));
    expect(stale[0].metadata_status).toBe("unknown");
  });

  it("0 は未評価でも boolean でもない", () => {
    expect(score(0)).toBe(0);
    for (const value of [null, true, -1, 11, "10", Number.NaN]) expect(score(value)).toBeNull();
  });

  it("危険な URL は拒否される", () => {
    for (const value of [null, "javascript:alert(1)", "https://youtube.com.evil.example/watch", "https://user:pass@youtube.com/watch"]) {
      expect(canonicalUrl(value)).toBeNull();
    }
    expect(canonicalUrl("https://youtu.be/demo?si=tracking")).toBe("https://www.youtube.com/watch?v=demo");
  });
});

describe("カタログ容量", () => {
  it("正規化で有効な URL の id のみ残る", async () => {
    const items: CatalogItem[] = await modelCatalog(
      [row({ url: "https://youtu.be/ok" }), row({ message_id: "bad", url: "javascript:alert(1)" })],
      new Map(),
    );
    expect(items.map((i) => i.id)).toEqual(["demo"]);
  });
});

describe("D1 行の検証", () => {
  it("形の合わない行だけを落とし、値の壊れた列は未取得に倒す", () => {
    const rows = parseMusicRows([
      { message_id: "ok", url: "https://youtu.be/ok", timestamp: "2026-01-01T00:00:00Z", title: "", dopamine: 12 },
      { message_id: "", url: "https://youtu.be/empty-id", timestamp: "2026-01-01T00:00:00Z" },
      null,
    ]);
    expect(rows).toEqual([{ message_id: "ok", url: "https://youtu.be/ok", timestamp: "2026-01-01T00:00:00Z" }]);
  });

  it("空文字のタイトルは未取得として扱う", () => {
    const rows = parseMusicRows([
      { message_id: "a", url: "https://youtu.be/a", timestamp: "2026-01-01T00:00:00Z", title: "  曲名  " },
    ]);
    expect(rows[0].title).toBe("  曲名  ");
    expect(parseMusicRows([{ message_id: "b", url: "https://youtu.be/b", timestamp: "t", title: "" }])[0].title).toBeUndefined();
  });
});