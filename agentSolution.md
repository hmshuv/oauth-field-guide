# Agent Solution Write-up

> Written and maintained by the agent (see Protocol E in [agent.md](agent.md)). Last updated: 2026-10-28 — after the missing-docs work, the free-tier fallback and the first real live runs.

## 1. The problem, restated

A developer building an AI agent needs their users to connect third-party apps. For each provider they must register an OAuth app and sometimes get it approved. What they can't easily tell:

1. **How long** — minutes, or weeks of review they can't speed up?
2. **What blocks** — reviews, videos, security audits, partner programs, customer admins, paid tiers, throttling?
3. **Who does what** — what can an agent do, and where must a human take over?
4. **What to trust** — which statements were observed, which are documented, which are guesses?

## 2. Core insight → product shape

**Two clocks.** Every provider has a *first token* milestone (works with your own account — almost always minutes) and a *production* milestone (any customer can connect without caps, warnings, throttling or admin blocks — sometimes months). Launch surprises live in the gap. Every guide reports hands-on time and waiting time for both.

**Archetype + flags.** One top-level archetype per app (what kind of gate stands between registration and production), plus evidence-backed friction flags. Difficulty is computed in code. Details and evidence: [docs/research.md](docs/research.md).

**Evidence on every claim.** Tested (observed by our agent) · Source-backed (official docs) · Community-reported · Uncertain. Code — not the model — has the final say.

## 3. What was built

| Component | Where | Notes |
| --- | --- | --- |
| Guide contract | `src/lib/guide/schema.ts`, `taxonomy.ts`, `difficulty.ts` | One zod schema shared by curated and live guides; JSON Schema for Gemini generated from it |
| Curated library | `data/library/*.json` | GitHub, Slack, Notion, Gmail (user's picks) + Salesforce (tenant-scoped) + LinkedIn (partner-gated) |
| Live investigator | `src/lib/investigator/` | preflight → identify → 3 grounded research tracks → source resolution/classification → structured synthesis → evidence enforcement → probes → save |
| Probes | `probes.ts`, `verify.ts` | Credential-free; SSRF-guarded; also run over the library via `npm run probe` |
| UI | `src/app`, `src/components` | Library + search, live stream view, guide page, portable share page, method page, BYO-key settings |
| Verification | [docs/verification.md](docs/verification.md) | Probe table, 8/8 spot-checks confirmed, corrections, open uncertainties |

## 4. Decisions log

| # | Checkpoint | Options considered | Chosen | Rationale |
| --- | --- | --- | --- | --- |
| 0.1 | Taxonomy | single difficulty score · free text · OAuth-flow-type buckets · **archetype + flags** | Archetype + flags, computed difficulty | *Why* matters more than a score; flags make guides comparable |
| 0.2 | Reference apps | user's 4 only · **+1 per uncovered archetype** | + Salesforce, LinkedIn | Covers tenant-scoped and partner-gated; "no public OAuth" left to the live agent |
| 1.1 | Schema | minimal fields · **decision-first fields with per-claim evidence** | Two milestones, flags, steps w/ owner + human reason + agent help, gotchas, uncertainties, agent hand-off, probes, corrections | Every field answers one of the four questions in §1 |
| 1.2 | Library authoring | hand-write · live agent (no key) · **parallel research agents + probes + spot-check** | Research agents (Claude) wrote guides against the schema; validated; probed; 8 claims re-checked | Quality without spending the user's Gemini tokens |
| 2.1 | Agent architecture | single grounded call · Deep Research agent · headless crawler · Interactions API · **generateContent two-phase** | 3 parallel grounded tracks + separate structured synthesis | Grounding + structured output combined is flaky on Gemini 3.x (documented reports); two-phase is robust and ~1–2 min |
| 2.1b | Model | gemini-4-argon · **gemini-3.8-flash** | Flash by default, configurable per phase | User has limited tokens; Flash is "built for agents"; Argon available via env |
| 2.2 | Incomplete data | fallback heuristics · **explicit uncertain + code-enforced grading** | Model must cite; code downgrades unsupported labels and logs them as corrections | Honesty over confidence (Principle II) |
| 2.3 | Token thrift | — | free preflight, cache, checkpoints, one repair call, no retries on auth/model errors, per-IP limit on shared key, BYO key | User's explicit concern about wasted runs |
| 3.1 | Stack | **Next.js 16 + TS + Tailwind 4** · plain HTML | Next.js | Streaming route handlers + server-rendered share pages in one deployable unit |
| 3.2 | Agent thinking display | spinner · **stage list + live sources/probes + usage** | Stage timeline with per-stage logs, live evidence panel, token/search counter | Shows what the agent is actually doing and what it costs |
| 3.3 | Sharing | DB-backed links · **short link + portable URL-fragment link + Markdown/PDF** | No database needed | Works on any deployment; portable link survives serverless |
| 3.4 | Deployment & keys | — | Key only in env (server) or browser (BYO); `.env.example`; Vercel-ready | "Keep credentials out of the submission" |
| 4.1 | Missing documentation (user-approved A–E) | — | Availability gate · evidence coverage + Unrated verdict · Assumed steps · Ask-the-provider message · No-public-OAuth verdict · nullable URLs | User asked how the pipeline behaves without docs; gaps were silent confidence and wasted runs |
| 4.2 | Key without Search grounding (user chose "build fallback") | enable billing · **direct-docs fallback** · other search APIs | Model suggests official URLs → we fetch + follow OAuth links → one read call | Works on free keys (reviewers too); sources are pages we retrieved. Other providers researched, not integrated (see §7) |
| 4.3 | Free-tier quotas / overload | — | Model chain with backoff; skip models whose daily quota is spent; cache "no grounding" per key | Observed live: 503s on two models, 20 RPD cap |
| 4.4 | Visual walkthrough (user chose swimlane) | swimlane · two-clock timeline · phase stepper | Swimlane map, data-driven, zero tokens | User found guides text-heavy |

## 5. What we learned (research highlights)

- **GitHub** — OAuth Apps now allow 10 callback URLs and issue expiring tokens by default (Aug 2026); the real gate is org owners approving the app (on by default for new orgs).
- **Slack** — distributing without review is easy, but non-Marketplace apps are throttled to 1 req/min on history/replies (May 2025): an AI agent effectively needs Marketplace approval.
- **Notion** — no review to go public; the page picker limits what the agent can see; refresh tokens rotate.
- **Gmail** — every mail-reading scope is restricted → CASA security assessment, ~6-week review, 100-user lifetime cap until verified.
- **Salesforce** — new connected apps blocked since Spring '26; cross-org now means a packaged External Client App installed by each customer admin; 30-day idle refresh-token TTL from Nov 2026.
- **LinkedIn** — member posting self-serve; company pages need Community Management API vetting; rejection means starting over with a new app.

## 6. Status & next steps

**Done & verified:** typecheck, lint, production build, schema validation of all guides, 30/30 library probes, offline end-to-end smoke test of the Gemini adapter, mock-mode UI run, 8/8 spot-checks.

**Live-verified (free-tier key, direct-docs path):** Linear (Moderate) and Plausible Analytics (No public OAuth), 3 calls each. **Not yet live-verified:** the search-grounded path (needs a billing-enabled key).

**Ideas not built (scope):** a 100-app index seeded from the Composio directory with "generate on demand"; scheduled re-verification of library guides (re-run probes + diff); per-scope difficulty toggles (e.g. Gmail with only `gmail.send`).

## 7. Other providers researched (not integrated)

| Option | What it gives | Free allowance (per vendor/secondary sources, Oct 2026) | Fit |
| --- | --- | --- | --- |
| Gemini with billing enabled | Google Search grounding (best recall incl. forums) | 5,000 grounded searches/month free on Gemini 3, then $14/1k | Zero code change — best quality |
| Tavily Search API | Search results + page content for agents | 1,000 credits/month, no card | Easiest drop-in search for the fallback path |
| Exa | Neural search + contents | ~$10 credit/month | Good for docs discovery |
| Groq `groq/compound` | LLM with built-in web search | Free tier ~250 requests/day (third-party figure); search billed $5–8/1k on paid | Would be a second LLM backend, larger change |
| You.com / Firecrawl | Search / crawl | ~100 queries/day / 1,000 credits/month | Alternatives |
