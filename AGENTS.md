<!-- BEGIN:nextjs-agent-rules -->

## これはあなたの知っている Next.js ではない

このバージョンには破壊的変更があり、API・慣習・ファイル構成が学習データと異なる場合がある。コードを書く前に、このファイルのディレクトリを基点に解決される `node_modules/next/dist/docs/` の該当ガイドを読むこと（モノレポでは `next` パッケージがリポジトリルートからは見えない場合がある）。非推奨（deprecation）の記述には従うこと。

このブロックは `next dev` が書き込み・再追加する。内容は `node_modules/next/dist/server/lib/generate-agent-files.js` で確認できる。差分から削除すると再作成されるだけで、作業と一緒にコミットすればツリーがクリーンに保たれる。

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:mise-rules -->

# 開発ツールのルール

このディレクトリでの開発では、コマンドの実行に必ず `mise` を使うこと（例: `mise run <command>`、`mise exec -- <command>`）。mise で管理されているものは、グローバルのパッケージマネージャやシステムの実行ファイルを直接使わない。
<!-- END:mise-rules -->

# ブランチ名

ブランチ名は「種別/概要」の形式にする（例: `feat/17-today-pick`、`refactor/comment`）。issue 番号がある課題に基づく場合は「種別/<issue 番号>-<概要>」とする。種別は `feat`・`fix`・`docs`・`chore`・`refactor`・`test` を使う。ブランチは常に `main` から切り、PR も `main` 向けにする。

# コミットと PR タイトル

コミットメッセージと PR タイトルは conventional commits 形式にする: `type(scope): 要約`。

有効な type は `feat`、`fix`、`docs`、`chore`、`refactor`、`test`。scope は省略可。影響する領域（`ui`、`catalog`、`playlist`、`api` など）が分かるなら付ける。要約は日本語で書く。

例: `feat(playlist): CSV への変換を追加する`、`refactor(ui): カードの表示部品を共通モジュールに切り出す`

# コードスタイル

## 一般原則

- 再利用・合成しないものは 1 つの関数にまとめる
- 未知の値は、その値を所有する境界で一度だけ検証し、内側には型付きの値を渡す。すでにスキーマやコンストラクタや内部の型で保証された値を、防御的に再検証しない
- 使われない単発ヘルパーを先取りして切り出さない。呼び出し箇所にインラインする。切り出すのは、再利用される場合・本当に複雑な境界を隠す場合・独立した名前が呼び出し側の読みやすさを上げる場合だけ
- 推測的あるいは発生確率が極めて低い競合やセキュリティのエッジケースのために複雑さを足す前に、具体的な失敗モード・発生条件・複雑さのコストをユーザーに説明して同意を得る。理論的な堅牢性のために黙ってスコープを広げない
- `try`/`catch` は可能な限り避ける
- `any` 型を使わない
- 型推論に任せる。export や明確さのために必要な場合を除き、明示的な型注釈や interface を付けない
- for ループより配列の関数型メソッド（`flatMap`、`filter`、`map`）を優先する。`filter` では型ガードを使い、下流の型推論を保つ
- 値が一度しか使われないなら変数をインライン化し、変数の総数を減らす

```ts
// Good
const musicPage = await getMusicPage(db, { query, page: requestedPage });

// Bad
const musicPageData = await getMusicPage(db, { query, page: requestedPage });
```

## 分割代入

不必要な分割代入をしない。ドット記法で文脈を保つ。

```ts
// Good
record.url;
record.timestamp;

// Bad
const { url, timestamp } = record;
```

## import

- import のエイリアスを付けない。`import { foo as bar } from "..."` のような改名 import を使わない
- 型位置の `import("...")` 参照を使わない。2 つの import が本当に名前衝突し、他に選択肢がない場合に限り、型の別名 import（`import type { Foo as FooDefinition } from "..."`）を最終手段として許す
- 星 import を使わない。`import * as Foo from "..."` や `import type * as Foo from "..."` を書かない
- 選択されたコードパスでのみ必要な重いモジュールは動的 import を優先する。動的 import の束縛は、必要とする最も狭いスコープの先頭近くで分割代入し、通常の import のように読めるようにする。`await import("./module").then((mod) => mod.value())` や `(await import("./module")).value()` のようなインラインチェーンを避ける

## 変数

`const` を `let` より優先する。再代入の代わりに三項演算子か早期リターンを使う。

```ts
// Good
const page = requestedPage > lastPage ? lastPage : requestedPage;

// Bad
let page;
if (requestedPage > lastPage) page = lastPage;
else page = requestedPage;
```

## 制御フロー

`else` を避ける。早期リターンを使う。

```ts
// Good
function score(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >= 0 && value <= 10 ? value : null;
}

// Bad
function score(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  } else {
    return value >= 0 && value <= 10 ? value : null;
  }
}
```

## 複雑なロジック

関数に検証分岐や補助的な処理がいくつも並ぶときは、本体の関数を正常系の流れとして読ませ、細部を本体の下に置いた小さなヘルパーへ移す。

```ts
// Good
export function parseMusicRows(values: unknown[]) {
  return parseRows(musicRowSchema, values, "music_catalog")
}

function parseRows<T>(schema: z.ZodType<T>, values: unknown[], label: string): T[] {
  ...
}
```

- ヘルパーは対応するコードの近く、読みやすさが上がるなら主 export の下に置く
- 単純な式を多数の単発ヘルパーに分解しすぎない。`requireConfig` や `readMetadata` のように実在する概念を名指すときだけ切り出す
- 効果（副作用・非同期）が本当に伴わないヘルパーから Promise を返さない。同期的なパース・検証・オプション構築は同期的に保つ
- コメントは自明でない制約や意外な挙動のために書く。自明な代入や制御フローのために書かない

# テスト

- モックは可能な限り避ける。`globalThis.*` の置き換えは他に選択肢がない場合に限る
- 実装そのものをテストする。テスト側にロジックを複製しない
- テストは対象ファイルの隣に置く（`src/**/*.test.ts`）

# チェック

- コマンドは必ず mise 経由で実行する（`mise.toml` のタスク一覧を参照）
- Lint: `mise run lint`（oxlint）
- 単体テスト: `mise run test:unit`（vitest）。Storybook のブラウザテストは chromium が必要なため、初回は `mise run e2e:setup` を通す
- 型チェック: `mise run type-check`（`tsc --noEmit`。直接 tsc を呼ばずタスク経由で）
- 整形: `mise run format`（Prettier。基準は `.prettierrc.json`。lint は oxlint が担う）
- 依存の追加・更新・スクリプト実行は必ず pnpm を使う。他のパッケージマネージャを持ち込まない
