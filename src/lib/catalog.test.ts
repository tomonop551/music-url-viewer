import { describe, expect, it } from "vitest";
import { canonicalUrl, fingerprint, modelCatalog, score, type CatalogItem, type FeatureRow, type MusicRow } from "./catalog";

const row = (over: Partial<MusicRow> = {}): MusicRow => ({
  message_id: "demo",
  url: "https://open.spotify.com/track/demo",
  user_name: "name",
  timestamp: "2026-01-01T00:00:00Z",
  ...over,
});

describe("catalog", () => {
  it("provider content is excluded and stale metadata is ignored", async () => {
    const record = { ...row(), title: "PRIVATE_PROVIDER_TITLE", user_name: "PRIVATE_NAME", dopamine: 0 };
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

  it("zero is not missing or boolean", () => {
    expect(score(0)).toBe(0);
    for (const value of [null, true, -1, 11, "10", Number.NaN]) expect(score(value)).toBeNull();
  });

  it("unsafe urls are rejected", () => {
    for (const value of [null, "javascript:alert(1)", "https://youtube.com.evil.example/watch", "https://user:pass@youtube.com/watch"]) {
      expect(canonicalUrl(value)).toBeNull();
    }
    expect(canonicalUrl("https://youtu.be/demo?si=tracking")).toBe("https://www.youtube.com/watch?v=demo");
  });
});

describe("catalog capacity", () => {
  it("produces only ids with valid canonical urls", async () => {
    const items: CatalogItem[] = await modelCatalog(
      [row({ url: "https://youtu.be/ok" }), row({ message_id: "bad", url: "javascript:alert(1)" })],
      new Map(),
    );
    expect(items.map((i) => i.id)).toEqual(["demo"]);
  });
});