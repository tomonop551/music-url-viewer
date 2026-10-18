# Music URL Viewer

A modern, high-performance web application built with Next.js to display music URLs stored in Cloudflare D1.

## Features

- **Server-Side Rendering (SSR)**: Securely fetches data from Cloudflare D1 without exposing credentials to the client.
- **Incremental Static Regeneration (ISR)**: Cached for 24 hours for fast performance.
- **Modern UI**: Clean, responsive card-based layout built with Tailwind CSS.
- **Auto-Sorting**: Automatically sorts entries by timestamp in descending order.
- **Playlist selection**: `/playlists` で曲を選び、CSV として書き出せる（詳細は下記）。

## プレイリストの選択と書き出し

[AI チャット等の既存機能は 2026-10 に削除した。プレイリスト作成は「選んで持ち出す」体験を先に完成させる。]

`/playlists` で次の操作ができる。

- 検索・ページ送りを跨いで曲を選択できる（選択状態はブラウザの localStorage に置く。URL には載らない）
- 選択できない URL（動画 ID の無い再生リスト、YouTube 以外など）はカードに理由を出す
- 「CSV で書き出す」で選択中の曲をダウンロードする（message_id / title / url / timestamp の 4 列。BOM 付き UTF-8）

書き出された URL の列は、YouTube Music への取り込み（別 issue: #21）や手作業の貼り付けにそのまま使える。サーバへの書き込みは無く、ダウンロードはクライアント側の Blob で完結する。

## Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/) via [OpenNext](https://opennext.js.org/cloudflare)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Tooling**: [mise](https://mise.jdx.dev/) and [pnpm](https://pnpm.io/)

## Getting Started

### 1. Install dependencies

```bash
mise install
mise run install
```

### 2. Run the development server

```bash
mise run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

- `src/app/page.tsx`: Main page with ISR configuration.
- `src/app/playlists/page.tsx`: Playlist selection page.
- `src/lib/d1.ts`: D1 data access layer.
- `src/lib/catalog.ts`: Catalog boundary (URL canonicalization, row validation).
- `src/lib/playlist-url.ts`: URL → video ID / Spotify track URI の判定と除外理由。
- `src/lib/selection.ts` / `src/lib/selection-store.ts`: 選択状態の判定と localStorage への退避。
- `src/lib/csv.ts`: 書き出し用の CSV 変換。

## Deployment

```bash
mise exec -- pnpm deploy:cf
```

This runs `opennextjs-cloudflare build` and `wrangler deploy`.

## Basic Auth

全ルートは `src/proxy.ts` で Basic 認証により保護されている。認証情報は公開リポジトリに平文で置かないため、Cloudflare の secrets として設定する。

```bash
wrangler secret put BASIC_AUTH_USER
wrangler secret put BASIC_AUTH_PASSWORD
```

未設定の環境（ローカル開発など）では認証ゲートが無効になる。ローカルで検証する場合は `.env.example` を `.env` にコピーして値を埋める。

## License

MIT
