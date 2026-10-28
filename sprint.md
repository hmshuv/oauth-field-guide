# Sprint Roadmap & Execution Plan

> **Format:** Iterative Milestones with **Collaborative Decision Checkpoints (🛑)**.  
> At every checkpoint, the agent researches the technical landscape and prompts the user with structured choices + recommendations, allowing custom input before building.

---

## Sprint 0: Domain Research & Problem Taxonomy
**Goal:** Before designing anything, research the OAuth-app landscape and propose how to classify the problem at the top level.

### Tasks
- [ ] Understand provider OAuth apps vs. integrations vs. user connections (Composio managed-auth directory as the starting point).
- [ ] Research the dimensions that drive setup friction (registration access, review gates, scope sensitivity, tenancy, end-user/admin consent, token behaviour, business requirements).
- [ ] Propose a top-level taxonomy (archetypes + friction modifiers) and pick 1–2 reference apps per archetype.
- [ ] Research the LLM tooling for the live investigator (Gemini models, grounding, structured output).

### 🛑 Decision Checkpoints
1. **Decision 0.1 — Taxonomy:** Which top-level buckets classify OAuth setup friction?
2. **Decision 0.2 — Reference apps:** Which apps represent each bucket? (User picked GitHub, Slack, Notion, Gmail + 1–2 for uncovered buckets.)

### Sprint 0 Definition of Done
* A research brief (`docs/research.md`) with the taxonomy, its evidence, and the chosen reference apps.

---

## Sprint 1: Foundations, Schema & Curated Library
**Goal:** Establish the standard guide format and build out the baseline dataset of 3–4 contrasting apps.

### Tasks
- [ ] Define the unified JSON schema for OAuth guides (`Task 1`).
- [ ] Build the curated reference dataset (`Task 2`).

### 🛑 Decision Checkpoints (Agent prompts user with options)
1. **Decision 1.1 — Schema Design:** What minimal fields give developers maximum clarity without overwhelming them? (Fields to include: Timeline split, agent vs. human tasks, gotchas, evidence tags).
2. **Decision 1.2 — Reference App Selection:** Which 3–4 apps best showcase the full spectrum of OAuth friction? (e.g. Slack = Instant, Spotify/Notion = Moderate, Google = High friction).

### Sprint 1 Definition of Done
* Standardized JSON guide schema finalized and agreed upon.
* Working JSON dataset containing 3–4 detailed, realistic app guides conforming to the schema.
* Clear baseline for what a high-quality guide looks like.

---

## Sprint 2: Live AI App Investigator Engine
**Goal:** Implement the agentic research workflow that investigates unfamiliar apps and populates the schema dynamically.

### Tasks
- [ ] Set up the agent researcher pipeline (`Task 3`).
- [ ] Implement search/doc retrieval and structured extraction logic.
- [ ] Add certainty/evidence tagging (`Task 5`).

### 🛑 Decision Checkpoints (Agent prompts user with options)
1. **Decision 2.1 — Agent Architecture & Tooling:** What is the most reliable way to research live docs on demand? (Direct LLM with web search vs. dedicated headless crawler vs. structured prompt chaining).
2. **Decision 2.2 — Handling Incomplete / Ambiguous Data:** How should the agent behave when provider docs don't state pricing tiers or approval timelines? (Explicit `Uncertain` tagging vs fallback heuristics).

### Sprint 2 Definition of Done
* Submitting an unlisted app (e.g. `Linear` or `Airtable`) triggers the agent live and returns a valid, structured guide with confidence markers.

---

## Sprint 3: Interactive UI, Shareability & Submission
**Goal:** Build the developer-facing interactive interface, verify against real sources, and finalize documentation.

### Tasks
- [ ] Build the interactive UI with search, live trigger, and guide visualization (`Task 4`).
- [ ] Add shareable link/export functionality.
- [ ] Write the comprehensive submission `README.md` (`Task 6`).

### 🛑 Decision Checkpoints (Agent prompts user with options)
1. **Decision 3.1 — Tech Stack for UI:** What frontend gets us the cleanest, most responsive result? (e.g., Next.js / React vs. lightweight HTML/JS with Tailwind).
2. **Decision 3.2 — Presentation of the Agent's Thinking:** How should the UI show live streaming status steps while the agent investigates (e.g., "Crawling docs...", "Extracting scopes...")?

### Sprint 3 Definition of Done
* Working interactive web experience demonstrating both library lookup and live generation.
* Clear README documenting setup, architecture decisions, and limitations.
