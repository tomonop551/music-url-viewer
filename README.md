# Music URL Viewer

A modern, high-performance web application built with Next.js to display music URLs stored in Cloudflare D1.

## AI music companion

A responsive chat recommends registered tracks using Cloudflare Workers AI and independent MusicBrainz metadata. It keeps the 0–10 addictiveness score separate from mood; no manual tagging is required.

> The chat is temporarily paused during the Cloudflare migration.

## Features

- **Server-Side Rendering (SSR)**: Securely fetches data from Cloudflare D1 without exposing credentials to the client.
- **Incremental Static Regeneration (ISR)**: Cached for 24 hours for fast performance.
- **Modern UI**: Clean, responsive card-based layout built with Tailwind CSS.
- **Auto-Sorting**: Automatically sorts entries by timestamp in descending order.

## Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/) via [OpenNext](https://opennext.js.org/cloudflare)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/)
- **AI**: [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Tooling**: [mise](https://mise.jdx.dev/) and [pnpm](https://pnpm.io/)

## Getting Started

### 1. Install dependencies

```bash
mise install
mise run install
```

### 2. Set up Cloudflare

Create the D1 database (fills the binding ID in `wrangler.toml`) and apply the schema:

```bash
mise exec -- bash scripts/setup-cloudflare.sh
mise exec -- wrangler d1 migrations apply music_url_viewer --remote
```

### 3. Run the development server

```bash
mise run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

- `src/app/page.tsx`: Main page with ISR configuration.
- `src/lib/d1.ts`: D1 data access layer.
- `src/lib/catalog.ts`: Catalog boundary (URL canonicalization, fingerprint, metadata modeling).
- `src/lib/ai.ts`: Workers AI function-calling wiring.
- `src/types/`: TypeScript definitions for music records and chat messages.

## Deployment

```bash
mise exec -- pnpm deploy:cf
```

This runs `opennextjs-cloudflare build` and `wrangler deploy`.

## License

MIT
