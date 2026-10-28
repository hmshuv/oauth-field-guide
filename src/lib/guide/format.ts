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

// Plain markdown export, so a guide can be pasted into an issue, doc or chat.
export function guideToMarkdown(g: Guide): string {
  const verdict = verdictOf(g);
  const coverage = evidenceCoverage(g);
  const lines: string[] = [];
  lines.push(`# ${g.appName} — OAuth app setup guide`);
  lines.push("");
  lines.push(
    `**Verdict:** ${verdictText(verdict)} · **Archetype:** ${ARCHETYPE_INFO[g.classification.archetype].label} · **Evidence:** ${coverageLabel(coverage)} (${Math.round(coverage * 100)}% backed) · **Use case:** ${g.assumedUseCase}`,
  );
  lines.push("");
  lines.push(`> ${g.tldr}`);
  lines.push("");
  lines.push(`| Milestone | Hands-on time | Wait on provider |`);
  lines.push(`| --- | --- | --- |`);
  lines.push(
    `| Works with your own account | ${formatMinutes(g.effort.firstToken.activeMinutes)} | ${formatDays(g.effort.firstToken.waitDays)} |`,
  );
  lines.push(
    `| Any customer can connect | ${formatMinutes(g.effort.production.activeMinutes)} | ${formatDays(g.effort.production.waitDays)} |`,
  );
  lines.push("");
  lines.push(`**Next action:** ${g.nextAction}`);
  lines.push("");
  if (g.classification.flags.length) {
    lines.push(`## What affects your setup`);
    for (const f of g.classification.flags) lines.push(`- **${FLAG_INFO[f.id].label}:** ${f.detail} ${ev(f.evidence)}`);
    lines.push("");
  }
  lines.push(`## Steps`);
  let n = 1;
  for (const phase of STEP_PHASES) {
    const steps = g.steps.filter((s) => s.phase === phase);
    if (!steps.length) continue;
    lines.push(`### ${PHASE_INFO[phase]}`);
    for (const s of steps) {
      const owner = s.owner === "agent" ? "🤖 Agent" : s.owner === "human" ? "👤 You" : "🤝 Shared";
      lines.push(`${n++}. **${s.title}** (${owner})${s.basis === "assumed" ? " **[Assumed — not in provider docs]**" : ""} ${ev(s.evidence)}`);
      lines.push(`   ${s.detail}`);
      if (s.url) lines.push(`   ${s.url}`);
      if (s.humanReason) lines.push(`   _Why a human:_ ${HUMAN_REASON_INFO[s.humanReason]}`);
      if (s.agentHelp) lines.push(`   _Agent can:_ ${s.agentHelp}`);
    }
  }
  lines.push("");
  lines.push(`## Gotchas`);
  for (const x of g.gotchas) {
    lines.push(`- **${x.severity.toUpperCase()} — ${x.title}:** ${x.detail} _Mitigation:_ ${x.mitigation} ${ev(x.evidence)}`);
  }
  lines.push("");
  if (g.scopes.length) {
    lines.push(`## Scopes`);
    for (const s of g.scopes) lines.push(`- \`${s.scope}\` (${s.tier}) — ${s.purpose} ${ev(s.evidence)}`);
    lines.push("");
  }
  lines.push(`## Quick reference`);
  lines.push(`- Console: ${g.quickRef.consoleUrl ?? "not found"}`);
  lines.push(`- Docs: ${g.quickRef.docsUrl ?? "not found"}`);
  if (g.quickRef.authorizeUrl) lines.push(`- Authorize URL: ${g.quickRef.authorizeUrl}`);
  if (g.quickRef.tokenUrl) lines.push(`- Token URL: ${g.quickRef.tokenUrl}`);
  for (const f of g.quickRef.facts) lines.push(`- ${f.label}: ${f.value} ${ev(f.evidence)}`);
  lines.push("");
  if (g.uncertainties.length) {
    lines.push(`## What we couldn't verify`);
    for (const u of g.uncertainties) lines.push(`- **${u.question}** ${u.why} _To resolve:_ ${u.howToResolve}`);
    lines.push("");
  }
  const email = providerEmail(g);
  if (email) {
    lines.push(`## Ask the provider`);
    lines.push(`To: ${email.to}`);
    lines.push(`Subject: ${email.subject}`);
    lines.push("");
    lines.push("```");
    lines.push(email.body);
    lines.push("```");
    lines.push("");
  }
  if (g.probes.length) {
    lines.push(`## What we tested`);
    for (const p of g.probes) lines.push(`- ${p.ok ? "✅" : "⚠️"} ${p.kind} \`${p.target}\` → ${p.observed}`);
    lines.push("");
  }
  lines.push(`## Sources`);
  for (const s of g.sources) lines.push(`- [${s.id}] ${s.title} — ${s.url}`);
  lines.push("");
  lines.push(
    `_Evidence key: Tested = observed by our agent; Source-backed = official docs; Community-reported = developer reports; Uncertain = not confirmed. Generated ${g.origin.generatedAt.slice(0, 10)}._`,
  );
  return lines.join("\n");
}
