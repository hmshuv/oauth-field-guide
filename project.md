# Project Plan: OAuth App Setup & Investigation Platform

## High-Level Objective
Build a functional, shareable tool that eliminates OAuth setup friction for AI developers by providing instant, grounded guides from a pre-computed library and a real-time AI investigator for unfamiliar apps.

---

## Work Breakdown Structure (Tasks)

### Task 1: Core Data Schema & Guide Contract
* Define a single, standardized JSON schema for an OAuth App Guide.
* Key fields required:
  * `appName`, `providerUrl`, `developerConsoleUrl`
  * `difficulty` (Instant, Moderate, Strict)
  * `estimatedTime` (Active setup minutes vs. Approval wait days)
  * `prerequisites` (e.g., Domain verification, privacy policy URL, paid tier)
  * `stepByStep` (Sequenced steps with direct dashboard URLs)
  * `agentVsHumanSplit` (What an agent/script can automate vs. what requires human action)
  * `gotchas` (Common rejection reasons, rate limits, scope restrictions)
  * `evidence` (Status tags: Verified by Test, Backed by Docs, or Uncertain)

### Task 2: Curated Pre-Baked Library Dataset
* Populate 3–4 high-contrast reference guides to show varied challenges:
  * **App 1 (Instant / Low Friction):** e.g., GitHub or Slack (immediate client credentials, sandbox testing).
  * **App 2 (Moderate / Strict Redirects & Toggles):** e.g., Notion or Spotify (explicit redirect URI policies, capability checkboxes).
  * **App 3 (High Friction / Review Audit):** e.g., Google Restricted Scopes or Salesforce (screencast demo, CASA security assessment, multi-week human review).

### Task 3: Live AI App Investigator Engine
* Implement the background agent workflow to research unknown apps on demand:
  * Accepts app name or domain (e.g. `Linear`, `https://airtable.com`).
  * Gathers official developer documentation and OAuth guidelines.
  * Extracts setup requirements, permission scopes, and verification caveats.
  * Formats the findings into the exact Task 1 JSON schema.
  * Flags missing or ambiguous provider details as `Uncertain`.

### Task 4: Interactive User Interface
* Build an intuitive, interactive UI (accessible in-browser):
  * **Search & Discovery:** Instant filter across pre-baked apps.
  * **Live Query Input:** Real-time generation trigger for unlisted apps.
  * **Guide Detail View:** Clear visual hierarchy (Difficulty badge, timeline split, agent vs. human task split, gotchas).
  * **Shareability:** One-click copyable guide or direct shareable view.

### Task 5: Testing, Evidence Grounding & Verification
* Run sanity checks against real developer portal documentation.
* Explicitly document what was verified by setup attempts vs. what remains doc-supported or unverified.

### Task 6: Documentation & Submission Package
* Prepare a concise, impactful `README.md`:
  * Quickstart / run instructions (1-command setup).
  * Core product decisions & trade-offs explained.
  * Known limitations & future roadmap.
  * Clean environment variable isolation (no hardcoded credentials).
