import {
  ARCHETYPE_INFO,
  ARCHETYPES,
  FLAG_INFO,
  FLAGS,
  HUMAN_REASON_INFO,
  HUMAN_REASONS,
} from "../guide/taxonomy";

export const RESEARCH_SYSTEM = `You are a meticulous OAuth integration researcher helping developers who build AI agents.
Your job is to find out what it really takes to register an OAuth app with a provider and get it approved so that the developer's customers can connect their accounts.
Rules:
- Prefer the provider's official developer documentation, changelogs and policy pages. Use community sources (forums, GitHub issues, Stack Overflow, blogs) only for real-world gotchas, and say that they are community reports.
- Write every finding as a short, self-contained bullet. Include exact URLs, exact scope strings, numbers, and dates of policy changes.
- When you cannot find something, write "NOT FOUND: <what>" instead of guessing. Never invent URLs, scopes, limits or timelines.
- Today's date is ${new Date().toISOString().slice(0, 10)}. Flag anything that may be outdated.`;

export function identifyPrompt(query: string) {
  return `A developer typed: "${query}"
Identify the software product they mean and how third-party developers can integrate with it.
Respond with ONLY a JSON object (no prose) with these keys:
{
  "appName": "official product name",
  "website": "https://… main website",
  "officialDomains": ["domains owned by the provider that host its docs, consoles and auth, e.g. 'slack.com'"],
  "developerDocsUrl": "https://… the official page about OAuth / authorization for third-party apps (or the API docs home)",
  "category": "e.g. CRM, Email, Project management",
  "offersOAuth": "yes" | "no" | "unclear",
  "oauthNotes": "one sentence on what kind of OAuth (or other auth) it offers to third parties",
  "assumedUseCase": "the most likely thing an AI agent would do with this app on a user's behalf, one sentence",
  "ambiguous": true | false,
  "alternatives": ["other products this name could refer to, if ambiguous"]
}`;
}

export type Identity = {
  appName: string;
  website: string;
  officialDomains: string[];
  developerDocsUrl: string;
  category: string;
  offersOAuth: "yes" | "no" | "unclear";
  oauthNotes: string;
  assumedUseCase: string;
  ambiguous: boolean;
  alternatives: string[];
};

const context = (id: Identity) =>
  `Product: ${id.appName} (${id.website}). Official docs: ${id.developerDocsUrl}.
Integration being built: ${id.assumedUseCase}
Auth summary so far: ${id.oauthNotes}`;

export const RESEARCH_BRIEFS = [
  {
    key: "mechanics",
    label: "Registration & OAuth mechanics",
    prompt: (id: Identity) => `${context(id)}

Research the mechanics of registering a third-party OAuth app for ${id.appName}:
1. Where exactly a developer registers the app (exact console URL), which app types exist (e.g. OAuth app vs other app kinds) and which one fits the integration above, and what fields registration asks for.
2. The authorization URL, token URL, any OpenID/OAuth discovery document URL, OAuth version, PKCE support, and how the client authenticates.
3. Redirect URI rules: HTTPS requirement, localhost allowed?, exact match or wildcards, how many.
4. Access token lifetime, refresh tokens (issued? expiry? rotation?), revocation.
5. The exact scopes this integration needs and how sensitive each one is.
6. Rate limits that would affect an AI agent.
7. Whether endpoints or credentials differ per customer (subdomains, instance URLs, per-tenant apps).`,
  },
  {
    key: "approval",
    label: "Review, verification & distribution",
    prompt: (id: Identity) => `${context(id)}

Research the approval path for a ${id.appName} OAuth app, from first test to letting any customer connect:
1. Can any developer register immediately, or is a paid plan / specific edition / partner account required?
2. What is required before other customers (outside the developer's own account/workspace) can connect: publishing/distribution settings, privacy policy or terms URLs, business or domain verification, manual app review, demo video, security assessment, user caps before approval.
3. Is there a marketplace / app directory? Is listing optional or required, and what does its review involve?
4. Are any API permissions gated behind a partner program or access application?
5. Customer side: must the customer's admin approve, install, or allowlist the app? Are there admin controls that block third-party apps by default?
6. Published or reported timelines for each review step (state the source).`,
  },
  {
    key: "field",
    label: "Field reports & recent changes",
    prompt: (id: Identity) => `${context(id)}

Research what surprises developers when they build an OAuth integration with ${id.appName}:
1. Policy or API changes from 2024 to today that affect third-party OAuth apps (with dates).
2. Common app-review rejection reasons and setup mistakes.
3. Gotchas specific to AI agents: rate limits on reading data, terms that restrict AI/LLM use of data, token expiry surprises.
4. Anything developers commonly report as confusing or slow (forums, GitHub issues, Stack Overflow). Mark each item as OFFICIAL or COMMUNITY.`,
  },
] as const;

const archetypes = ARCHETYPES.map((a) => `- ${a}: ${ARCHETYPE_INFO[a].description} (e.g. ${ARCHETYPE_INFO[a].examples})`).join("\n");
const flags = FLAGS.map((f) => `- ${f}: ${FLAG_INFO[f].hint}`).join("\n");
const reasons = HUMAN_REASONS.map((r) => `- ${r}: ${HUMAN_REASON_INFO[r]}`).join("\n");

export const SYNTHESIS_SYSTEM = `You turn research notes into a structured OAuth app setup guide for developers building AI agents.
The guide must answer: how hard is this, how long will it take (hands-on time vs waiting on the provider), what can block approval, what an AI/coding agent can do vs what a human must do, and what is uncertain.

Classification — pick exactly one archetype:
${archetypes}

Friction flags — include only those the notes support:
${flags}

Evidence rules (strict):
- Every evidence object lists the source ids (S1, S2, …) from the research notes that support the claim.
- status "source": supported by at least one OFFICIAL source id.
- status "community": supported only by community/other sources.
- status "uncertain": no source supports it, the notes say NOT FOUND, or sources conflict. Explain why in "note".
- NEVER use status "tested" — our system adds tested evidence itself from live probes.
- Do not invent facts, URLs, scopes, numbers or timelines that are not in the notes. If a URL is unknown use the official docs URL.

Effort:
- effort.firstToken = until OAuth works with the developer's own account. effort.production = until any customer can connect without caps or warnings.
- activeMinutes = hands-on developer time. waitDays = calendar time waiting on the provider (0/0 if none). Use null when unknown (e.g. discretionary partner approvals). Be conservative and realistic.

Steps (6–12, in order) — phases: prepare, register, configure, test, review, launch, customer.
- owner "agent": a coding agent can do it entirely (write code/config, call APIs, generate manifests, draft texts).
- owner "human": needs a person; set humanReason. owner "shared": an agent prepares, a human finishes; set humanReason.
- humanReason values:
${reasons}
- agentHelp: concretely what an agent can do for that step (null if nothing).

Also write:
- tldr: two decision-useful sentences.
- gotchas (3–8) with severity blocker/warning/info and a mitigation each.
- uncertainties: every important thing that could not be confirmed, with how to resolve it.
- agentHandoff.prompt: a paste-ready prompt for the developer's coding agent covering the automatable work; artifacts: useful config snippets (env template with placeholders, manifests). Never include real secrets.
- nextAction: the one thing to do right now.
Keep text tight and specific; no marketing language.`;

export function synthesisPrompt(
  id: Identity,
  sources: { id: string; title: string; url: string; kind: string }[],
  notes: { label: string; text: string }[],
) {
  return `PRODUCT
${JSON.stringify(id, null, 2)}

SOURCES (id · kind · title · url)
${sources.map((s) => `${s.id} · ${s.kind.toUpperCase()} · ${s.title} · ${s.url}`).join("\n") || "(none)"}

RESEARCH NOTES (citations in [S#] refer to SOURCES)
${notes.map((n) => `## ${n.label}\n${n.text}`).join("\n\n")}

Write the guide JSON for: ${id.appName}. Assumed use case: ${id.assumedUseCase}`;
}

export function repairPrompt(previous: string, errors: string) {
  return `The JSON below failed validation. Fix ONLY the problems listed and return the full corrected JSON object.

ERRORS
${errors}

JSON
${previous}`;
}
