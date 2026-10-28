# Product Principles & First-Principles Compass

> **Purpose:** Use this document as our directional anchor throughout the build. Whenever we make an architectural, UX, or scoping decision, loop back to this document to ensure we stay true to the assignment's core intent.

---

## 1. The Core Product Anchor
Developers don't need another generic search engine or raw documentation dump.  
**They need to de-risk their launch.**  
They need to answer three immediate questions:
1. *Will connecting this app take me 15 minutes or 3 weeks?*
2. *What unexpected blockers (video demos, paid tiers, DNS records) will stop me?*
3. *What can code/agents automate for me, and what must I do manually?*

---

## 2. First-Principle Rules for Every Decision

### Principle I: Time-to-Clarity Over Information Density
* **Rule:** If a piece of information doesn't help a developer make a decision or take an action, cut it.
* **In Practice:** Don't summarize 20 pages of OAuth RFC specs. Give them:
  * Direct URL to the developer console.
  * Exact callback URL requirements.
  * Explicit list of required scopes.
  * Expected approval wait time.

### Principle II: Intellectual Honesty Over Confident Hallucination
* **Rule:** An agent that admits uncertainty is infinitely more trustworthy than an agent that guesses.
* **In Practice:** Every piece of guidance must carry a clear grounding status:
  * 🟢 **Tested:** Observed directly by us/our agent (e.g. live endpoint probe, discovery document fetched, console URL resolves) — with a note on how.
  * 🔵 **Source-backed:** Stated by official provider docs (cited), but not observed by us. May vary by account type or recent policy shifts.
  * 🟣 **Community-reported:** Reported by developers (forums, issues) but not in official docs.
  * 🔴 **Uncertain:** Could not be confirmed (paywalled, enterprise-only, ambiguous, or only knowable after a live approval submission).

### Principle III: Explicit Division of Labor (Agent vs. Human)
* **Rule:** Clearly delineate where automation ends and human responsibility begins.
* **In Practice:** Categorize every setup task:
  * **Agent / Scriptable:** Fetching redirect URIs, configuring scope strings, validating JSON manifests, generating boilerplate integration code.
  * **Human Required:** 2FA authentication, submitting billing details, uploading video walkthroughs, DNS domain verification.

### Principle IV: A Focused Working Slice Over Shallow Breadth
* **Rule:** Deliver a deeply polished, trustworthy slice rather than a fragile system with 100 broken links. Research deeply; keep the build slice small.
* **In Practice:** A handful of contrasting pre-baked reference apps (one or two per friction category) + 1 robust real-time agent investigation flow — the live investigator is the primary deliverable.

### Principle V: Self-Explaining & Shareable
* **Rule:** The output must be clear enough to forward to a technical co-founder or product manager without verbal explanation.
* **In Practice:** Structure guides with clear visual hierarchy, difficulty badges, and clean export/share capabilities.

---

## 3. The Alignment Compass (Questions to Ask at Every Checkpoint)
Before implementing any feature or prompt, ask:
1. *Does this directly save a developer from an unexpected launch delay?*
2. *Is it immediately obvious what step the developer should take next?*
3. *Are we transparent about what the AI agent verified vs. what remains uncertain?*
4. *Are we keeping the technical complexity lean?*
