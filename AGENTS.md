<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:mise-rules -->
# Development Tools Rule
When developing in this directory, you MUST ALWAYS use `mise` to run commands (e.g., `mise run <command>` or `mise exec -- <command>`). Do not use global package managers or system executables directly if they are managed by `mise`.
<!-- END:mise-rules -->
