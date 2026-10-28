# Sprint 0 — Domain research & problem taxonomy

_Researched 2026-10-28. This brief is the evidence behind the taxonomy in [`src/lib/guide/taxonomy.ts`](../src/lib/guide/taxonomy.ts)._

## 1. What a "provider OAuth app" is

Three separate things get conflated:

| Thing | Who owns it | Created how often |
| --- | --- | --- |
| **Provider OAuth app** (client id + secret, redirect URIs, scopes, branding, review status) | The developer | Once per provider (sometimes once per customer — see *tenant-scoped*) |
| **Integration** (the code that runs the OAuth flow, stores tokens, calls the API) | The developer | Once per provider |
| **Connection** (one end user's grant → access/refresh tokens) | Each end user (sometimes gated by their admin) | Once per user per provider |

Composio's [managed-auth directory](https://docs.composio.dev/toolkits/managed-auth) makes the split explicit: for 124 toolkits Composio supplies the provider OAuth app, for 258 the developer must "bring your own" (register an app, supply client id/secret). Even for managed apps, a production product usually wants its own app (its own name on the consent screen, its own quotas) — which is exactly the setup our guides cover. The directory also tells us which apps hurt most: the *bring-your-own* list is the long tail our live investigator must handle.

## 2. The key insight: two clocks

Every provider has two milestones that can be weeks apart:

1. **First token** — OAuth works with the developer's own account/workspace/org. Almost always self-serve, minutes.
2. **Production** — *any* customer can connect without user caps, scary warnings, throttling or admin blocks.

Launch surprises live in the gap: unverified-app user caps (Google: 100 users, lifetime), marketplace-only rate limits (Slack), security assessments (Google restricted scopes), partner approval (LinkedIn), customer-admin approval (GitHub org restrictions, Salesforce, Workspace admins). Every guide therefore reports **hands-on time** and **waiting time** separately for both milestones.

## 3. Dimensions that drive friction

| Dimension | Values seen | Example |
| --- | --- | --- |
| Who may register | anyone · paid plan/edition · partner account | GitHub: anyone · Salesforce: API-enabled edition for customers |
| What gates production | nothing · distribution settings · review · verification by scope sensitivity · program application | Slack Marketplace · Google CASA · LinkedIn CMA |
| Where the gate sits | provider · customer admin · both | GitHub org owner approval · Workspace API controls |
| Tenancy | one global app · per-customer org/store/subdomain | Salesforce My Domain / per-org policies |
| Token lifecycle | non-expiring · expiring + refresh · rotating refresh · no refresh | GitHub (8 h tokens by default since Aug 2026) · Notion (new pair per refresh) |
| Business requirements | none · policy URLs · domain/business verification · demo video · security assessment | Google restricted scopes |
| Data-use / rate terms | none · AI/LLM restrictions · throttling for unlisted apps | Slack 1 req/min for non-Marketplace apps |

## 4. Taxonomy (Decision 0.1)

Two layers, because one bucket can't capture everything and a flat list of flags isn't decision-useful:

**Archetype** — one per guide, answers "what kind of gate stands between registration and production?"

| Archetype | Meaning | Reference app |
| --- | --- | --- |
| Instant self-serve | Register and ship; no provider review | GitHub |
| Self-serve, review to scale | Works now; distribution/listing adds settings or review | Slack, Notion |
| Scope-based verification | Scopes requested decide the review (brand → sensitive → restricted + security assessment) | Gmail |
| Tenant-scoped | The client lives in / must be approved by each customer's org | Salesforce |
| Partner / program gated | Useful permissions need an application with discretionary approval | LinkedIn |
| No public OAuth | API keys / PATs only | (live investigator handles these) |

**Friction flags** — 14 cross-cutting, evidence-backed tags (paid plan, business/domain verification, policy URLs, manual review, demo video, security assessment, user cap, partner application, customer admin consent, per-customer setup, redirect rules, token lifecycle, optional marketplace).

**Difficulty** (Quick / Moderate / Involved / High friction) is **computed in code** from archetype + flags + production wait, so curated and live guides are rated identically and the model can't "vibe" a rating.

Alternatives considered: a single 1–5 difficulty score (rejected — hides *why*); per-provider free text (rejected — not comparable, not shareable); classifying by OAuth flow type (rejected — developers already know flows; it's the *approval path* they don't know).

## 5. Reference apps (Decision 0.2)

User picked GitHub, Slack, Notion, Gmail; we added one app per uncovered archetype:

- **GitHub** — instant self-serve, but org-owner approval is a hidden customer-side gate.
- **Slack** — self-serve, yet the Marketplace decides your rate limits (an agent-specific trap).
- **Notion** — self-serve public connection; the user's page picker limits what an agent sees.
- **Gmail** — every mail-reading scope is restricted → annual CASA assessment.
- **Salesforce** — tenant-scoped: each customer org's admin controls access and policies.
- **LinkedIn** — partner-gated: posting as a member is self-serve, company pages need program approval.

## 6. Live-investigator tooling research (feeds Decision 2.1)

- Gemini models (Oct 2026): `gemini-3.8-flash` (stable, "built for agents"), `gemini-4-argon` (flagship). `generateContent` is labelled *legacy but fully supported*; the newer Interactions API had breaking changes in mid-2026. **Chosen:** `generateContent` via `@google/genai` 2.31 — documented response shape we could verify against SDK types without a key.
- Grounding with Google Search on Gemini 3+: billed per executed search query, first 5,000/month free.
- Structured output + Search grounding together is documented for Gemini 3, but developers report empty grounding metadata and truncated JSON. **Chosen:** two-call pattern — grounded research calls (text + citations) then a separate structured-output synthesis call.
- Grounding chunk URIs are `vertexaisearch.cloud.google.com` redirects → we resolve them to real URLs before citing.

Sources: [Gemini models](https://ai.google.dev/gemini-api/docs/models) · [Grounding (generateContent)](https://ai.google.dev/gemini-api/docs/generate-content/google-search) · [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output) · [forum: empty grounding with structured output](https://discuss.ai.google.dev/t/grounding-metadata-grounding-chunks-grounding-supports-empty-when-using-structured-output-with-google-search-tool/113240)
