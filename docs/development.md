# 開発ガイド（ローカル開発・検証・push まで）

このドキュメントは「clone してから PR を出すまで」の手順をまとめたもの。デプロイ（Cloudflare へ
の反映）は README を参照。コマンドはすべて `mise` 経由で実行する（リポジトリのルール。`mise.toml`
がバージョンとタスクの唯一の情報源）。

## 1. セットアップ

```bash
mise install        # Node / pnpm / wrangler を mise.toml に従って用意
mise run install    # pnpm install（= pnpm install）
cp .env.example .env
```

`mise` を使わない環境向けに `.nvmrc`（Node 22.22.1）と `package.json` の `engines` も置いてある。

## 2. アプリを起動する

### 2-1. フィクスチャで起動する（推奨・D1 不要）

`.env` に `MUSIC_DATA_SOURCE=fixture` があれば、同梱フィクスチャ
（`src/lib/catalog/fixtures/music-catalog.json`）を一覧に表示する。D1 の資格情報も
Cloudflare のバインディングも不要で、検索・ページ送り・`/playlists` の選択と CSV 書き出しまで触れる。

```bash
mise run dev        # → http://localhost:3000
```

フィクスチャの行を増やしたい場合は JSON を編集する（`src/lib/catalog/catalog.ts` の
`musicRowSchema` を通る形だけが表示される）。

### 2-2. 本番と同じ D1 経路で起動する

`MUSIC_DATA_SOURCE` を未設定（または `fixture` 以外）にすると、これまでどおり D1 を読む。
このとき `mise run dev` は `wrangler` のローカル D1（miniflare）を参照するため、**ローカルの D1 に
テーブルとデータが無いと 500 になる**（`D1_ERROR: no such table: music_catalog`）。テーブル定義を
公開リポジトリに置いていないため、手元で D1 経路を再現したい場合は自分の環境でスキーマとデータを
用意するか、`mise exec -- pnpm dev:cf`（`wrangler dev --remote`。AWS SSO ではなく Cloudflare の
認証が必要）を使う。

## 3. 検証する

| コマンド                  | 内容                                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| `mise run lint`           | oxlint                                                                |
| `mise run type-check`     | `tsc --noEmit`                                                        |
| `mise run format:check`   | Prettier の整形チェック                                               |
| `mise run test:unit`      | Vitest（node 環境。`src/**/*.test.ts`）                               |
| `mise run test:storybook` | Storybook の stories をブラウザで実行（要 `mise run e2e:setup`）      |
| `mise run test`           | 上 2 つの一括実行                                                     |
| `mise run ci`             | `lint` → `type-check` → `format:check` → `test:unit` → `build` の一括 |
| `mise run build`          | `next build`                                                          |
| `mise run storybook`      | Storybook を起動（http://localhost:6006）                             |

**push 前に `mise run ci` を通す**のが基本。ブラウザテスト（`test:storybook`）は OS の共有ライブラリと
chromium が必要なので、初回だけ次を実行する。

```bash
mise run e2e:setup      # pnpm exec playwright install --with-deps chromium
```

`test:storybook` は CI（`.github/workflows/verify.yml`）でも実行されている。CI は `mise run e2e:setup` で
chromium と OS 依存を導入する。ローカルで `--with-deps`（sudo が必要）が通らない環境ではブラウザ
テスト自体が実行できないため、その担保は CI 側で行う。

## 4. push 前フック（lefthook）

```bash
mise run hooks:install   # ローカルごとに 1 回
```

以降のコミットで、ステージされたファイルに対して lint・整形・型チェックが走る（`lefthook.yml`）。
整形はステージ内容にも反映される（`stage_fixed`）。

- フックは `git commit --no-verify` で回避できるため、**最終的な担保は CI** に置く。
- フックが遅いと感じたら `lefthook.yml` の `jobs` を削ってよい（削った分は CI が拾う）。

## 5. 変更の流れ

1. issue を立て、受け入れ条件を issue コメントで確定させる。
2. `git switch -c <type>/<issue番号>-<slug> origin/main`（`feat` / `fix` / `chore` / `docs` / `refactor` / `test` / `infra`）。
3. 実装 → `mise run ci` → コミット（日本語 Conventional Commits。コミットメッセージには「なぜ」を書く）。
4. `git push -u origin HEAD` → PR（本文に `Closes #N`、日本語）。**マージはしない**（人間がレビューして行う）。
5. PR の CI（verify）が赤い場合は原因を直して同じブランチへ追加コミットする。
