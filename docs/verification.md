# Verification log

What we tested, what we checked against sources, what we corrected, and what stays uncertain. Dates are 2026-10-28.

## 1. Credential-free probes (automated, reproducible)

`npm run probe` runs the same probes the live investigator uses against every curated guide and writes the results into each guide's **What we verified** section. No accounts, no credentials, one request per endpoint.

| App | Discovery doc | Authorize (bogus client) | Token (bogus code) | Console / docs pages |
| --- | --- | --- | --- | --- |
| GitHub | ✓ RFC 8414 metadata, PKCE `S256` | ✓ 302 → login | ✓ 404 `{"error":"Not Found"}` | ✓ / ✓ |
| Slack | ✓ OIDC (Sign in with Slack only) | ✓ consent page | ✓ `invalid_code` | ✓ / ✓ |
| Notion | — none published | ✓ 302 → install page | ✓ 401 `invalid_client` | ✓ / ✓ |
| Gmail | ✓ PKCE `plain, S256` | ✓ 302 → `/signin/oauth/error` | ✓ 401 `invalid_client` | ✓ (login) / ✓ |
| Salesforce | ✓ PKCE `S256` | ✓ 400 `invalid_client_id` | ✓ 400 `invalid_client_id` | ✓ / ✓ |
| LinkedIn | ✓ OIDC, PKCE not advertised | ✓ consent page | ✓ 401 `authorization code not found` | ✓ / ✓ |

The research agents also ran their own curl probes while writing guides (sources `T#`), e.g. Salesforce API calls to `login.salesforce.com` return `URL_NOT_RESET` (you must use the org's My Domain) and LinkedIn's live issuer is `https://www.linkedin.com/oauth`, not what parts of the docs show.

## 2. Spot-check of research-agent claims against primary sources

We re-checked the most surprising claims — the ones a developer would be most hurt by if wrong — independently of the agents that wrote them.

| # | Claim (guide) | Checked against | Result |
| --- | --- | --- | --- |
| 1 | GitHub OAuth Apps allow up to 10 callback URLs; "Expire user access tokens" is on by default | docs.github.com — *Creating an OAuth app* | ✅ Confirmed verbatim |
| 2 | Slack non-Marketplace distributed apps: 1 req/min, 15 objects on `conversations.history/replies` since 2025-05-29 | docs.slack.dev changelog 2025-05-29 | ✅ Confirmed. Existing installs "will not be impacted" per the current page; guide correctly flags the conflict with the archived changelog as uncertain |
| 3 | `gmail.send` sensitive; `readonly`/`compose`/`modify`/`metadata` restricted | developers.google.com Gmail scopes | ✅ Confirmed exactly |
| 4 | Notion: 180 req/min (600 Business/Enterprise) since 2026-09-09 | Notion request-limits page + changelog | ✅ Numbers on the limits page; the date only in the changelog (Sept 9, 2026) |
| 5 | Notion mints a fresh access/refresh pair per authorization (2026-06-08) | Notion changelog | ✅ Confirmed |
| 6 | Salesforce: new connected apps restricted since Spring '26 | Salesforce ISV security guide | ✅ Confirmed |
| 7 | Salesforce: 30-day refresh-token idle TTL enforced Oct 21 2026 (sandbox) / Nov 4 2026 (prod) | help.salesforce.com article 005461287 | ✅ Confirmed (our first web search found it only on a third-party blog — the agent had cited the primary source correctly) |
| 8 | LinkedIn Community Management: request on a fresh app; rejection means a new app; Development tier capped | Microsoft Learn — Community Management app review | ✅ Confirmed |

**8 / 8 confirmed.** Two lessons: secondary summaries (including our own search tool's) disagreed with primary sources twice (Slack existing-install date, Salesforce idle-TTL date) — which is why guides cite primary sources and why conflicts are surfaced as *uncertain* rather than resolved by guesswork.

## 3. What we corrected

**In the investigator's own logic (found by running probes on real providers):**

- **Slack false correction.** The first probe version "corrected" Slack's `oauth.v2` URLs to the endpoints in Slack's discovery document. Wrong: that document covers *Sign in with Slack* (OIDC), not bot installation. Now a discovery mismatch is only a correction when the guide's own URL fails its probe; otherwise it's recorded as a tested note.
- **GitHub false alarm.** GitHub's token endpoint answers unknown clients with `404 {"error":"Not Found"}`, which the first version flagged as "URL may be wrong". The probe now requests JSON and judges by the body: a real endpoint returns an OAuth-style JSON error; a wrong path returns HTML or "unknown method" (verified on both providers).
- **HTML false positive.** An SPA consent page contained the word "error" in its scripts; the probe now ignores HTML bodies when extracting OAuth errors.

**In live guides (automatic):** every live guide records how many claims the evidence check downgraded (model-claimed "tested", "source-backed" without an official citation, citations to sources that don't exist).

**Common assumptions the research overturned** (now in the guides): GitHub OAuth apps are not limited to one callback URL and tokens now expire by default; Notion tokens are no longer non-expiring; `gmail.send` is not restricted (but every read scope is); Salesforce "one connected app works in every org" no longer holds; Slack "customers can each create their own app from your manifest" is prohibited by its terms.

## 4. First real live runs (free-tier Gemini key, 2026-10-28)

The key had no Google Search grounding quota (429 "check your plan and billing" on every model) and a 20-requests/day free quota on `gemini-3.8-flash`, which led to the direct-docs fallback and the model chain.

| App | Path | Calls · tokens | Result |
| --- | --- | --- | --- |
| Linear | direct-docs (8 official pages incl. OAuth, app manifests, actor authorization, rate limiting) | 3 · ~22k | Rated *Moderate*, self-serve with optional directory listing; PKCE, 30-min refresh grace, workspace-admin approval; 4/4 probes passed |
| Plausible Analytics | direct-docs → limited (no public OAuth) | 3 · ~24k | *No public OAuth* verdict; API-key alternative (Business plan); console/authorize URLs left empty rather than invented; email to the real contact form |

Issues found and fixed during these runs: grounding 429 handling, 503 "high demand" on two models in a row (now a 4-model chain with backoff), per-model daily free quota (now skips to the next model), an "aI agent" casing bug in the provider email.

## 5. What remains uncertain (highlights)

- Review timelines that providers don't publish (LinkedIn Standard tier, Slack Marketplace in practice).
- Console-only facts we can't see without logging in (Slack's *Activate Public Distribution* checklist, Notion's current public-connection form fields).
- CASA assessment cost and assurance level for a given Gmail app (community-reported only).
- How a packaged Salesforce External Client App behaves cross-org in every edition.
- The search-grounded path has only been verified offline (`npm run smoke`); live runs so far used the direct-docs path.
