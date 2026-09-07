import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let fail = false;
  let submitted;
  await page.route("**/api/chat", async route => {
    submitted = route.request().postDataJSON();
    if (fail) return route.fulfill({ status: 502, json: { error: "曲を探せませんでした。" } });
    return route.fulfill({ json: { message: submitted.reset ? "" : "中毒性の評価から選びました。", recommendations: submitted.reset ? [] : [
      { id: "demo-zero", title: "Example Track", url: "https://youtu.be/example", dopamine: 0, reason: "中毒性は0/10です。" },
      { id: "demo-unknown", title: "Another Example", url: "https://open.spotify.com/track/example", reason: "この曲はまだ未評価です。" },
    ] } });
  });
  await page.goto((process.env.STORYBOOK_URL || "http://localhost:6006") + "/iframe.html?id=music-musicchat--welcome&viewMode=story");
  await page.getByRole("heading", { name: "今、どんな気分？" }).waitFor();
  await page.getByRole("button", { name: "クセになる曲が聴きたい" }).click();
  await page.getByRole("link", { name: "Example Track" }).waitFor();
  assert.equal(submitted.message, "クセになる曲が聴きたい");
  assert.equal(await page.getByText("中毒性 0/10", { exact: true }).count(), 1);
  assert.equal(await page.getByText("中毒性 未評価", { exact: true }).count(), 1);
  await page.screenshot({ path: "/tmp/music-companion-desktop.png", fullPage: true });
  fail = true;
  await page.getByLabel("今の気分や聴きたい曲", { exact: true }).fill("もっと静かな曲");
  await page.getByRole("button", { name: "送信", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByLabel("今の気分や聴きたい曲", { exact: true }).inputValue(), "もっと静かな曲");
  fail = false;
  await page.getByRole("button", { name: "新しい会話" }).click();
  await page.getByRole("button", { name: "クセになる曲が聴きたい" }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Example Track" }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.getByRole("heading", { name: "今、どんな気分？" }).isVisible(), false);
  await page.getByRole("button", { name: "気分から曲を探す", exact: true }).click();
  await page.getByRole("heading", { name: "今、どんな気分？" }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: "/tmp/music-companion-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log("Chat UI passed: desktop, recommendations, zero/unrated, error recovery, reset, mobile.");
} finally {
  await browser.close();
}
