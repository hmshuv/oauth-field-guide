# OAuth Field Guide

**Will connecting an app take 15 minutes or 6 weeks?** Before an AI agent can act for your users, you need an OAuth app with each provider — and sometimes the provider's approval. This tool gives developers an evidence-graded setup guide for any app: how hard it is, hands-on time vs. waiting time, what can block approval, what an agent can do for you vs. where you take over, and what is still uncertain.

- **Curated library** — six reference apps chosen to cover every friction archetype: GitHub, Slack, Notion, Gmail, Salesforce, LinkedIn.
- **Live investigator** — type any app name or website; an agent researches it, probes its live OAuth endpoints, and publishes a shareable guide in ~1–2 minutes.

## Quickstart

```bash
npm install
cp .env.example .env.local      # (or .env) then set GEMINI_API_KEY (https://aistudio.google.com/apikey)
npm run dev                     # http://localhost:3000
```

No key? The library works without one. **Free-tier keys work too:** Google Search grounding needs a billing-enabled Gemini project; without it the agent automatically switches to reading the provider's official pages directly (see *Live pipeline* below). Free tiers also cap requests per model per day (20/day for `gemini-3.8-flash` on the key we tested), so the agent falls back through `gemini-3.6-flash → gemini-3.5-flash-lite → gemini-3-flash-preview`. A run uses ~3 calls in direct mode, ~5 with search. Visitors can also paste their own Gemini key in **Settings** (stored in their browser only). `INVESTIGATOR_MOCK=1` runs the live flow against canned responses (no API calls) for UI testing.

### For coding agents setting this up

1. If `GEMINI_API_KEY` is already exported in the shell environment, Next.js reads it directly — no file needed. Otherwise copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` from the user's environment. Never commit `.env*` files (they are git-ignored).
2. `npm install && npm run dev`, open `http://localhost:3000`, submit an app that is *not* in the library (e.g. `Linear`, `HubSpot`, `Zoom`).
3. Checks that need no key or tokens: `npm run validate` (library schema), `npm run smoke` (offline end-to-end test of the Gemini adapter + pipeline), `npm run typecheck`, `npm run lint`, `npm run build`.

## Demo path

1. **Home** → compare cards: GitHub (*Quick*) vs. Gmail (*High friction*, 2–13 weeks) vs. Salesforce (*tenant-scoped*).
2. **A guide** (e.g. `/guides/slack`) → the verdict, the two clocks, *Do this next*, the agent-vs-you split, steps with owners, gotchas, the coding-agent hand-off prompt, and *What we verified*. Hover any evidence pill for its sources.
3. **Live** → type an unfamiliar app → watch the stages, sources and probes stream in → share via short link, portable link, Markdown or PDF.

## Key decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Unit of guidance | Two milestones: *working with your own account* vs. *any customer can connect* | Almost every launch surprise lives in the gap between them (user caps, marketplace-only rate limits, security assessments, admin approval). |
| Classification | 6 archetypes × 14 friction flags; difficulty **computed in code** | Archetype tells you *what kind* of gate; flags tell you *which* requirements; computing difficulty keeps curated and live guides comparable. See [docs/research.md](docs/research.md). |
| Evidence | Every claim is **Tested / Source-backed / Community-reported / Uncertain**, with source ids | Developers need to know what to trust. "Tested" only means our agent observed it (endpoint probes), never that an app was approved. |
| Who grades evidence | Code, not the model | The model can't run tests, so model-claimed "tested" is downgraded; "source-backed" requires an official (provider-domain) citation. |
| "Attempting setup" | Credential-free probes: discovery documents, authorize/token endpoints with a bogus client, console/docs URLs | It's what an agent can honestly attempt without accounts; it caught real errors in our own logic (see [docs/verification.md](docs/verification.md)). |
| Agent vs. human | Every step has an owner (`agent` / `human` / `shared`), a human reason (2FA login, legal, provider review, customer admin, DNS, recording) and concrete agent help, plus a paste-ready prompt for the developer's coding agent | Answers "what can an agent do for me and where do I take over" per step, not as a vague summary. |
| Live pipeline | Gemini `generateContent`: 1 identify call → 3 parallel Google-Search-grounded research tracks (mechanics, approval path, field reports) → structured-output synthesis → probes. **Without grounding (free-tier keys):** the model suggests official doc URLs, we fetch them and follow OAuth-related links on official domains, and one call reads the pages | Separating grounded research from structured output avoids known Gemini issues combining them. The direct-docs path cites only pages we actually retrieved, so it can't invent URLs — but it can't see forums, which each guide states. |
| Missing documentation | Availability check before full research; "No public OAuth" verdict; evidence coverage (<40% → *Unrated · low evidence*); steps tagged *Assumed*; URLs left empty when not found; an *Ask the provider* message built from open questions | When docs run out, the guide says so plainly and gives the developer a next step instead of confident filler. |
| Walkthrough | "Your path at a glance" swimlane map at the top of each guide (phases × agent / you / provider wait / customer admin, plus milestones) | Text-heavy guides need a one-glance view; drawn from guide data, so it costs no tokens. |
| Token thrift | Free key/model preflight; curated + cached guides cost nothing; research checkpointed so a failed synthesis retries without re-research; one cheap repair call for invalid JSON; per-IP limit on the shared key | The live flow should never waste a run. |
| Sharing | Short link `/guides/<slug>` + portable link (whole guide compressed into the URL fragment) + Markdown + print/PDF | Short links are friendly; portable links survive serverless instances and need no database. |
| Scope | 6 deep guides instead of 100 shallow ones | A trustworthy slice per archetype + a live investigator for the long tail is more useful than unverified breadth. |

## Architecture

```
src/lib/guide/        schema.ts (zod contract) · taxonomy.ts · difficulty.ts · format.ts (Markdown export)
src/lib/investigator/ pipeline.ts · gemini.ts (adapter, retries, usage) · prompts.ts · probes.ts (SSRF-guarded)
                      verify.ts (fold probes into evidence) · mock.ts · events.ts
src/app/              / (library + search) · /investigate (live stream) · /guides/[slug] · /share · /method
                      /api/investigate (NDJSON stream) · /api/status
data/library/         curated guides (JSON, validated against the same schema as live guides)
scripts/              validate-library · probe-library · smoke-gemini
```

Curated guides were researched from official docs by research agents, probed by `npm run probe`, and spot-checked against primary sources ([docs/verification.md](docs/verification.md)).

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | Server key for live investigations (optional if visitors bring their own) |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Research model (Google Search grounding) |
| `GEMINI_SYNTHESIS_MODEL` | same as above | Structured synthesis model (e.g. `gemini-4-argon` for higher quality; paid tier only) |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3-flash-preview` | Tried in order when a model is overloaded or out of daily free quota |
| `INVESTIGATE_LIMIT_PER_HOUR` | `6` | Per-IP limit when the server key is used |
| `INVESTIGATOR_MOCK` | `0` | `1` = canned responses, no API calls |
| `GUIDES_DIR` | `data/generated` (`/tmp/oauth-guides` on Vercel) | Where live guides and research checkpoints are stored |

**Deploying (Vercel):** import the repo, set `GEMINI_API_KEY` as an environment variable in the project settings (never in the repo), deploy. The investigate route allows up to 300 s. Live guides on serverless are stored in `/tmp` per instance — use the portable link to share them durably.

## Limitations

- No agent creates real OAuth apps, submits reviews, or logs into consoles; console-only details are source-backed at best.
- Review timelines are rarely published; estimates are conservative ranges and marked uncertain when unsupported.
- Live guides reflect what web search surfaces at that moment; login-only or bot-blocked docs are invisible to it.
- Probes prove endpoints are live and how they reject bad input — not that your configuration will be approved.
- The live investigator has been run against the real Gemini API only on a **free-tier key** (no Search grounding), i.e. the direct-docs path: Linear and Plausible Analytics. The grounded path is verified offline (`npm run smoke`) but not yet live.
- In direct-docs mode, citations are checked to exist and to be official pages, but not that each page states the exact claim.
- Generated guides persist on local disk (or `/tmp` on serverless); there is no database.

## First live run (checklist)

1. Set `GEMINI_API_KEY`, `npm run dev`.
2. Investigate one app (e.g. `Linear`). The preflight stage validates the key and model without spending tokens; if it fails, nothing else runs.
3. If synthesis fails, press **Retry** — research is checkpointed for 24 h and is not repeated.
4. Repeat lookups of the same app are served from cache (14 days) — use *Re-investigate from scratch* to force a new run.
