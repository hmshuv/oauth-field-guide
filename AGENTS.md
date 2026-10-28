# Working in this repo

- Setup and checks: see README.md → "For coding agents setting this up". The Gemini key comes from the
  environment (`GEMINI_API_KEY`, or `.env.local` copied from `.env.example`); never commit keys.
- Guide contract: `src/lib/guide/schema.ts`. Curated guides in `data/library/` must pass `npm run validate`.
- How this project was planned and run (principles, sprints, agent protocol): `docs/process/`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
