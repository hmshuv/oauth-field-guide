import { coverageLabel, DIFFICULTY_INFO, evidenceCoverage, verdictOf, type Verdict } from "./difficulty";
import type { Evidence, Guide } from "./schema";
import {
  ARCHETYPE_INFO,
  EVIDENCE_INFO,
  FLAG_INFO,
  HUMAN_REASON_INFO,
  PHASE_INFO,
  STEP_PHASES,
} from "./taxonomy";

type Range = { min: number | null; max: number | null };

export function formatMinutes(r: Range): string {
  const fmt = (m: number) => (m < 60 ? `${m} min` : `${+(m / 60).toFixed(1)} h`);
  if (r.min === null && r.max === null) return "Unknown";
  if (r.min !== null && r.max !== null && r.min !== r.max) {
    if (r.max < 60) return `${r.min}–${r.max} min`;
    return `${fmt(r.min)} – ${fmt(r.max)}`;
  }
  return fmt((r.min ?? r.max)!);
}

export function formatDays(r: Range): string {
  if (r.min === null && r.max === null) return "Unknown";
  if (r.min === 0 && (r.max === 0 || r.max === null)) return "No wait";
  const fmt = (d: number) => {
    if (d < 1) return `${Math.round(d * 24)} h`;
    if (d >= 14) return `${Math.round(d / 7)} wk`;
    return `${d} d`;
  };
  if (r.min !== null && r.max !== null && r.min !== r.max) return `${fmt(r.min)} – ${fmt(r.max)}`;
  if (r.max === null) return `${fmt(r.min!)}+`;
  return fmt((r.min ?? r.max)!);
}

export function evidenceLabel(e: Evidence): string {
  return EVIDENCE_INFO[e.status].label;
}

function ev(e: Evidence): string {
  const refs = e.sources.length ? ` ${e.sources.map((s) => `[${s}]`).join("")}` : "";
  return `_(${evidenceLabel(e)}${refs})_`;
}

export type Actor = "agent" | "you" | "provider" | "customer";

// Who actually acts on a step — finer than `owner`: waits on the provider's reviewers and
// steps done by the customer's admin are not the developer's work.
export function actorOf(s: Guide["steps"][number]): Actor {
  if (s.phase === "customer" || s.humanReason === "customer_admin") return "customer";
  if (s.humanReason === "provider_review") return "provider";
  return s.owner === "agent" ? "agent" : "you";
}

// Steps in phase order with the display number used everywhere (step list, map, Markdown).
export function numberedSteps(g: Pick<Guide, "steps">) {
  return STEP_PHASES.flatMap((phase) => g.steps.filter((s) => s.phase === phase)).map((step, i) => ({ step, n: i + 1 }));
}

export function guideUrlPath(slug: string) {
  return `/guides/${slug}`;
}

export function verdictText(v: Verdict): string {
  if (v.kind === "not_available") return "Not available via OAuth";
  if (v.kind === "unrated") return "Unrated — not enough evidence";
  return DIFFICULTY_INFO[v.level].label;
}

// Lower-case the first word for use mid-sentence, unless it's an acronym ("AI agent …").
const sentenceCase = (t: string) =>
  (/^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t).replace(/\.$/, "");

// Our own tooling notes aren't questions for the provider.
const isProviderQuestion = (q: string) => !/^Probe:|^Not searched:|does not appear in any research source/.test(q);

// A ready-to-send message to the provider, built from the guide's open questions — the developer's
// next step when documentation runs out.
export function providerEmail(g: Guide): { to: string; subject: string; body: string } | null {
  const questions = g.uncertainties.filter((u) => isProviderQuestion(u.question)).slice(0, 6);
  if (!questions.length) return null;
  const to = g.providerContact
    ? `${g.providerContact.channel}${g.providerContact.url ? ` — ${g.providerContact.url}` : ""}`
    : `No contact channel found — check ${g.quickRef.docsUrl ?? g.website} for developer support`;
  const body = [
    `Hi ${g.appName} developer support team,`,
    "",
    `We're building an integration where ${sentenceCase(g.assumedUseCase)}. Before we register an OAuth app and launch to customers, we couldn't find answers to the following in your documentation:`,
    "",
    ...questions.flatMap((u, i) => [`${i + 1}. ${u.question}`, `   (What we found: ${u.why})`]),
    "",
    "Could you point us to the right documentation or process — including whether any review or approval is needed before customers outside our own account can connect, and the typical timeline?",
    "",
    "Thanks,",
    "[Your name]",
    "[Company · website]",
  ].join("\n");
  return { to, subject: `OAuth integration questions — ${g.appName}`, body };
}

// Plain markdown export, so a guide can be pasted into an issue, doc or chat. Same order as the page:
// "Do it" first (scannable), then "Why & details".
export function guideToMarkdown(g: Guide): string {
  const verdict = verdictOf(g);
  const coverage = evidenceCoverage(g);
  const steps = numberedSteps(g);
  const gotchas = [...g.gotchas].sort((a, b) => ["blocker", "warning", "info"].indexOf(a.severity) - ["blocker", "warning", "info"].indexOf(b.severity));
  const who = (s: Guide["steps"][number]) =>
    ({ agent: "🤖 Agent", you: s.owner === "shared" ? "🤝 Agent prepares, you finish" : "👤 You", provider: "⏳ Provider", customer: "🏢 Customer admin" })[actorOf(s)];
  const L: string[] = [];
  L.push(`# ${g.appName} — OAuth app setup guide`, "");
  L.push(`**${verdictText(verdict)}** · ${ARCHETYPE_INFO[g.classification.archetype].label} · for: ${g.assumedUseCase}`, "");
  const wait = (r: Range) => (formatDays(r) === "No wait" ? "no wait" : `${formatDays(r)} wait`);
  L.push(`- **Works for you:** ${formatMinutes(g.effort.firstToken.activeMinutes)} hands-on · ${wait(g.effort.firstToken.waitDays)}`);
  L.push(`- **Any customer can connect:** ${formatMinutes(g.effort.production.activeMinutes)} hands-on · ${wait(g.effort.production.waitDays)}`);
  L.push("", `**Do this next:** ${g.nextAction}`, "");

  if (gotchas.length) {
    L.push("## Watch out for");
    for (const x of gotchas) L.push(`- **${x.severity}:** ${x.title}`);
    L.push("");
  }
  if (g.prerequisites.length) {
    L.push("## Before you start");
    for (const p of g.prerequisites) L.push(`- [ ] ${p.item}`);
    L.push("");
  }
  L.push("## Steps");
  for (const phase of STEP_PHASES) {
    const inPhase = steps.filter(({ step }) => step.phase === phase);
    if (!inPhase.length) continue;
    L.push(`**${PHASE_INFO[phase]}**`);
    for (const { step: s, n } of inPhase) {
      L.push(`${n}. ${s.title} — ${who(s)}${s.basis === "assumed" ? " _(assumed)_" : ""}${s.url ? ` · ${s.url}` : ""}`);
    }
  }
  L.push("");
  L.push("## Copy & paste");
  if (g.scopes.length) L.push(`- Scopes: \`${g.scopes.map((s) => s.scope).join(" ")}\``);
  L.push(`- Console: ${g.quickRef.consoleUrl ?? "not found"}`);
  L.push(`- Docs: ${g.quickRef.docsUrl ?? "not found"}`);
  if (g.quickRef.authorizeUrl) L.push(`- Authorize URL: ${g.quickRef.authorizeUrl}`);
  if (g.quickRef.tokenUrl) L.push(`- Token URL: ${g.quickRef.tokenUrl}`);
  L.push("");

  L.push("---", "", "# Why & details", "");
  L.push(g.tldr, "", g.classification.rationale, "");
  L.push(`Evidence: ${coverageLabel(coverage)} (${Math.round(coverage * 100)}% of claims backed by tests or official docs).`, "");
  if (g.classification.flags.length) {
    L.push("## What affects your setup");
    for (const f of g.classification.flags) L.push(`- **${FLAG_INFO[f.id].label}:** ${f.detail} ${ev(f.evidence)}`);
    L.push("");
  }
  L.push("## Step details");
  for (const { step: s, n } of steps) {
    L.push(`${n}. **${s.title}** ${ev(s.evidence)}`, `   ${s.detail}`);
    if (s.humanReason && s.owner !== "agent") L.push(`   _Why a human:_ ${HUMAN_REASON_INFO[s.humanReason]}`);
    if (s.agentHelp) L.push(`   _Agent can:_ ${s.agentHelp}`);
  }
  L.push("");
  if (gotchas.length) {
    L.push("## Gotchas explained");
    for (const x of gotchas) L.push(`- **${x.title}:** ${x.detail} _Fix:_ ${x.mitigation} ${ev(x.evidence)}`);
    L.push("");
  }
  if (g.scopes.length) {
    L.push("## Why each scope");
    for (const s of g.scopes) L.push(`- \`${s.scope}\` (${s.tier}) — ${s.purpose} ${ev(s.evidence)}`);
    L.push("");
  }
  if (g.quickRef.facts.length) {
    L.push("## Reference facts");
    for (const f of g.quickRef.facts) L.push(`- ${f.label}: ${f.value} ${ev(f.evidence)}`);
    L.push("");
  }
  if (g.uncertainties.length) {
    L.push("## What we couldn't verify");
    for (const u of g.uncertainties) L.push(`- **${u.question}** ${u.why} _To resolve:_ ${u.howToResolve}`);
    L.push("");
  }
  if (g.probes.length) {
    L.push("## What we tested");
    for (const p of g.probes) L.push(`- ${p.ok ? "✅" : "⚠️"} ${p.kind} \`${p.target}\` → ${p.observed}`);
    L.push("");
  }
  const email = providerEmail(g);
  if (email) {
    L.push("## Ask the provider", `To: ${email.to}`, `Subject: ${email.subject}`, "", "```", email.body, "```", "");
  }
  L.push("## Sources");
  for (const s of g.sources) L.push(`- [${s.id}] ${s.title} — ${s.url}`);
  L.push(
    "",
    `_Evidence key: Tested = observed by our agent; Source-backed = official docs; Community-reported = developer reports; Uncertain = not confirmed. Generated ${g.origin.generatedAt.slice(0, 10)}._`,
  );
  return L.join("\n");
}
