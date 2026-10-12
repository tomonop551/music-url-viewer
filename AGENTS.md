<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:mise-rules -->
# Development Tools Rule
When developing in this directory, you MUST ALWAYS use `mise` to run commands (e.g., `mise run <command>` or `mise exec -- <command>`). Do not use global package managers or system executables directly if they are managed by `mise`.
<!-- END:mise-rules -->
