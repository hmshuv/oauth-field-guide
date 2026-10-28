# Solution Strategy: APM Integrations Take-Home

## 1. Problem & Pain Points to Solve
* **Piecing together scattered documentation:** Developers lose significant time and cognitive effort on administrative research rather than building product features.
* **Unfamiliar setup flows & provider bureaucracy:** Time lost getting acquainted with idiosyncratic developer portals, manual email exchanges, and obscure ticket approvals.
* **Surprise blockers:** Unforeseen verification delays (e.g., domain verification, video demos, compliance audits) halting launches days before release.

---

## 2. Target Users
* **Developers / AI Agent Builders:** Software engineers, technical founders, and prompt/agent creators building AI applications that need access to user accounts and tools.

---

## 3. Stakeholder Ecosystem
1. **End User:** The human account owner who grants permission (consents) to access their account data.
2. **AI Agent:** The autonomous workflow/agent that takes actions on behalf of the user using the issued tokens.
3. **Developer:** The builder registering the OAuth client, configuring scopes, and managing integration lifecycles.
4. **Third-Party Provider Console:** The external developer dashboard (e.g., Google Cloud, Slack API, GitHub, Notion) that issues client credentials and enforces app approvals.
5. **Integration Platform / Tool Provider:** The integration infrastructure (e.g., Composio) orchestrating tools and connections.

---

## 4. Product Thinking & Design Principles
### Developer-Centric Empathy Model
To build a tool developers genuinely use and share, design around four core user questions:
* *What do they need vs. what is noise?* (Direct URLs, exact scopes, and wait times vs. 50 pages of boilerplate).
* *What do developers prefer?* (Clarity, self-service checklists, copy-pasteable configs, transparency on blockers).
* *What do they already know vs. what do they not?* (They know standard OAuth concepts like redirect URIs; they do NOT know provider-specific review gotchas or pricing traps).
* *What are their strengths and weaknesses?* (Strong at writing code and following technical specs; vulnerable to administrative and compliance roadblocks).

### Requirement Scenarios
* **Coverage:** Account for all common integration scenarios (instant self-service, domain-restricted, and enterprise-audited).
* **Shareability:** Every guide has its own link that opens a standalone page a teammate can read without context.

---

## 5. System Components & Architecture

### Component A: The App Library
* A curated catalog of pre-computed, verified OAuth setup guides.
* Represents distinct difficulty tiers (Instant/Self-serve, Moderate/Nuanced, and High Friction/Audit-heavy).

### Component B: Live AI App Investigator
* Real-time agentic research pipeline for apps not yet in the pre-computed library.
* Accepts an app name or website URL, crawls/searches developer documentation, extracts configuration parameters, and outputs a standardized guide on the fly.

### Component C: Interactive User Experience (UI)
* Clean, interactive frontend interface.
* Clear visual breakdown: Time estimates, Gotchas, Agent vs. Human responsibility split, and Source Confidence markers.
* Designed for easy sharing across engineering and product teams.

---

## 6. Agreed Decisions (from the first build run, 2026-10-28)
Full log with options and rationale: [`agentSolution.md`](agentSolution.md) §4.
* **Taxonomy:** 6 archetypes (instant self-serve · self-serve review-to-scale · scope-based verification · tenant-scoped · partner-gated · no public OAuth) × 14 friction flags; difficulty computed in code.
* **Two clocks:** every guide separates "working with your own account" from "any customer can connect", each with hands-on time vs. provider wait.
* **Evidence:** Tested / Source-backed / Community-reported / Uncertain, per claim, enforced by code.
* **Library:** GitHub, Slack, Notion, Gmail + Salesforce + LinkedIn.
* **Live investigator:** Gemini (`gemini-3.8-flash` default), grounded research tracks → structured synthesis → probes; BYO key supported; key only in env.
* **Sharing:** short link, portable link, Markdown, print/PDF. Collaboration/flagging features dropped (scope).
