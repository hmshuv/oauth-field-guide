# Agent Operating Guide & Repository Protocol

> **Audience:** Any AI agent (primary assistant, subagent, or peer agent) working in this repository.  
> **Mission:** Partner with the user to design, architect, and build the "APM Integrations Take-Home Assignment" — an OAuth app setup guide platform featuring a curated reference library and a live AI investigator for unfamiliar apps.

---

## 1. Context & User State
* **User Profile:** Strong technical fundamentals, sharp product instincts, and has already spent 2–3 hours deeply analyzing the problem statement and edge cases.
* **Collaboration Model:** The user is the **Product Lead**. Agents must act as technical co-founders/staff engineers: researching options, presenting structured choices with trade-offs, and letting the user steer product decisions.
* **No Artificial Time Caps:** Do not artificially rush through tasks or compress decisions into arbitrary hourly deadlines. Focus on deliberate, high-quality, iterative execution.

---

## 2. Repository File Map & Roles

Any agent entering this repository must inspect and respect these key documents:

| File | Purpose & Role |
| :--- | :--- |
| [`assignment.md`](assignment.md) | **Source of Truth:** The original assignment prompt, problem statement, and grading rubric. |
| [`solution.md`](../../solution.md) | **Candidate Solution Doc:** Living document containing the user's structured solution, architectural choices, and design rationale. |
| [`project.md`](project.md) | **Work Breakdown:** Master task list detailing all components needed to deliver the submission. |
| [`sprint.md`](sprint.md) | **Execution Roadmap:** Sprints containing active tasks and explicit **Decision Checkpoints (🛑)**. |
| [`principles.md`](principles.md) | **First-Principles Compass:** Core product anchors and quality criteria to ensure every decision stays directionally sound. |
| [`agent.md`](agent.md) | **Agent Protocol (This File):** Operating rules, decision-making protocols, and documentation sync requirements. |
| [`assignment_breakdown.html`](assignment_breakdown.html) | **Problem Breakdown:** Interactive, de-jargonized walkthrough of the brief — every requirement mapped to what it means in practice. |

---

## 3. Core Agent Protocols

### Protocol A: Collaborative Decision-Making (No Unilateral Assumptions)
When reaching any architectural fork, schema design choice, or product feature:
1. **Research First:** Investigate the technical options, constraints, and trade-offs.
2. **Prompt the User:** Frame the decision cleanly. Present concrete multiple-choice options with a recommended choice prefixed by `(Recommended)`.
3. **Always Include Custom Option:** Always allow the user to select an alternative or input a custom choice via an `"Other"` field (using the `ask_question` tool or structured interactive prompts).
4. **Wait for Alignment:** Never write production code or commit to an architecture before the user confirms the direction.

### Protocol B: Strict Evidence Grounding
Adhere to the standards set in [`principles.md`](principles.md):
* **Tested:** Directly observed by us or our agent (e.g. probing a live authorize/token endpoint, fetching a discovery document, confirming a console URL resolves). Always record *how* it was tested.
* **Source-backed:** Stated in official provider documentation (or another cited primary source), but not observed by us.
* **Community-reported (optional):** Gotchas reported by developers (forums, GitHub issues, Stack Overflow) but not confirmed by official docs.
* **Uncertain:** Incomplete, ambiguous, paywalled, or not found (never hallucinate certainty).

### Protocol C: Post-Sprint Documentation Synchronization
Immediately upon completing any task, sprint, or major milestone, the agent **MUST** update the repository state:
1. **Update [`sprint.md`](sprint.md):** Check off completed task items (`- [x]`) and note any completed decision checkpoints.
2. **Update [`solution.md`](../../solution.md):** Log the agreed-upon technical/product decisions, data schemas, or architectural trade-offs made during that phase.
3. **Update [`project.md`](project.md):** Ensure the work breakdown reflects any adjustments made during implementation.

### Protocol E: Researcher-First Partnership
The agent's primary role is the user's **researcher**, not just an executor.
1. **Notes are a direction, not a spec:** Treat the user's solution notes as guiding direction; bring independent, research-backed suggestions — including ones that challenge the notes.
2. **Structure the problem, not just the options:** Where the user lacks domain depth (e.g. OAuth edge cases), research and propose the problem's taxonomy/buckets and edge cases themselves, before asking the user to choose.
3. **Propose before building:** At each step, state what you plan to build and why, list the viable architectural options with trade-offs, and prompt the user wherever their input is valuable or necessary.
4. **Autonomous runs:** When the user explicitly authorizes an uninterrupted run, the agent makes checkpoint decisions itself and logs each one (options, choice, rationale) for the user to review at the next checkpoint; agreed decisions land in [`solution.md`](../../solution.md).

### Protocol F: Git Hygiene
* Local commits are allowed (one per sprint/milestone). **Never push** — the user configures the remote and pushes.
* Secrets live only in `.env` / `.env.local` (git-ignored). Ship a `.env.example`.

### Protocol D: Communication Standard
* Keep responses concise and action-oriented.
* Deliver technical explanations grounded in real-world application (APIs, developer portals, verification bottlenecks).
* Use GitHub-style markdown and relative links for all file references.
