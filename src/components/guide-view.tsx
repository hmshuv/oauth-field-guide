"use client";

// A guide reads in two passes. Part 1 ("Do it") is the what: verdict, timing, the path, what will
// block you, and a step checklist — no paragraphs. Part 2 ("Why & details") holds the reasoning,
// evidence and sources, and every Part 1 item links to its "why".
import { compressToEncodedURIComponent } from "lz-string";
import { useMemo } from "react";
import { coverageLabel, DIFFICULTY_INFO, evidenceCounts, evidenceCoverage, verdictOf } from "@/lib/guide/difficulty";
import { actorOf, formatDays, formatMinutes, guideToMarkdown, numberedSteps, providerEmail } from "@/lib/guide/format";
import type { Guide } from "@/lib/guide/schema";
import {
  ARCHETYPE_INFO,
  EVIDENCE_INFO,
  EVIDENCE_STATUSES,
  FLAG_INFO,
  HUMAN_REASON_INFO,
  PHASE_INFO,
  STEP_PHASES,
} from "@/lib/guide/taxonomy";
import { ArchetypeBadge, EvidenceBadge, EvidencePill, OwnerPill, SourcesContext, VerdictBadge } from "./badges";
import { CopyButton } from "./copy-button";
import { JourneyMap } from "./journey-map";

const DO_SECTIONS = [
  ["overview", "Overview"],
  ["map", "Path at a glance"],
  ["watch", "Watch out for"],
  ["before", "Before you start"],
  ["steps", "Steps"],
  ["copy", "Copy & paste"],
] as const;

const WHY_SECTIONS = [
  ["why-summary", "The full picture"],
  ["why-steps", "Step details"],
  ["why-gotchas", "Gotchas explained"],
  ["why-scopes", "Scopes"],
  ["why-facts", "Reference facts"],
  ["verification", "What we verified"],
  ["ask", "Ask the provider"],
  ["sources", "Sources"],
] as const;

const sevRank = (s: string) => ({ blocker: 0, warning: 1, info: 2 })[s] ?? 3;

export function GuideView({ guide, shareable = true }: { guide: Guide; shareable?: boolean }) {
  const sources = useMemo(() => new Map(guide.sources.map((s) => [s.id, s])), [guide.sources]);
  const verdict = verdictOf(guide);
  const coverage = evidenceCoverage(guide);
  const email = providerEmail(guide);
  const steps = numberedSteps(guide);
  const gotchas = [...guide.gotchas].sort((a, b) => sevRank(a.severity) - sevRank(b.severity));
  const live = guide.origin.kind === "live";
  const ownerCount = (o: string) => guide.steps.filter((s) => s.owner === o && ["agent", "you"].includes(actorOf(s))).length;
  const othersCount = guide.steps.filter((s) => !["agent", "you"].includes(actorOf(s))).length;
  const sections = WHY_SECTIONS.filter(([id]) => (id === "ask" ? !!email : id === "why-scopes" ? guide.scopes.length > 0 : true));

  return (
    <SourcesContext.Provider value={sources}>
      <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 py-8 sm:px-6">
        <nav className="no-print sticky top-20 hidden h-fit w-44 shrink-0 xl:block" aria-label="Guide sections">
          <TocGroup title="Do it" items={DO_SECTIONS} />
          <TocGroup title="Why & details" items={sections} />
        </nav>

        <article className="min-w-0 flex-1 space-y-6">
          {/* ───────────── Part 1: Do it ───────────── */}
          <section id="overview" className="card scroll-mt-20 p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted">
                {live ? (
                  <>
                    <span className="font-medium text-accent">Live investigation</span> · {guide.origin.model} ·{" "}
                    {new Date(guide.origin.generatedAt).toLocaleDateString()}
                  </>
                ) : (
                  <>
                    <span className="font-medium text-ink">Researched guide</span> · {guide.origin.generatedAt.slice(0, 10)}
                  </>
                )}
              </span>
              {shareable && <ShareBar guide={guide} />}
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight">{guide.appName}</h1>
            <p className="mt-1 text-sm text-muted">
              <a href={guide.website} target="_blank" rel="noreferrer" className="hover:underline">
                {guide.website.replace(/^https?:\/\//, "")}
              </a>{" "}
              · {guide.category} · for: {guide.assumedUseCase}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <VerdictBadge verdict={verdict} size="lg" />
              <ArchetypeBadge archetype={guide.classification.archetype} />
              <a href="#why-summary" className="text-xs text-muted hover:text-accent">
                why this rating →
              </a>
            </div>
            {verdict.kind === "unrated" && (
              <div className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--ev-uncertain)", background: "var(--ev-uncertain-soft)" }}>
                <span className="font-semibold" style={{ color: "var(--ev-uncertain)" }}>
                  Low evidence ({Math.round(coverage * 100)}% backed).
                </span>{" "}
                Docs are thin — treat this as a starting point and {email ? <a href="#ask" className="underline">ask the provider</a> : "contact the provider"} before
                committing to a date.
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Stat label="Works for you" value={formatMinutes(guide.effort.firstToken.activeMinutes)} sub={waitText(guide.effort.firstToken.waitDays)} href="#why-effort" />
              <Stat label="Any customer can connect" value={formatMinutes(guide.effort.production.activeMinutes)} sub={waitText(guide.effort.production.waitDays)} href="#why-effort" />
              <Stat
                href="#steps"
                label="Who does the work"
                value={`${guide.steps.length} steps`}
                sub={`🤖 ${ownerCount("agent")} agent · 👤 ${ownerCount("human")} you · 🤝 ${ownerCount("shared")} shared${othersCount ? ` · ⏳🏢 ${othersCount} others` : ""}`}
              />
            </div>

            <div className="mt-5 rounded-lg border border-accent/30 bg-accent-soft p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-accent">Do this next</div>
              <p className="mt-1 text-sm">{guide.nextAction}</p>
            </div>
          </section>

          <Section id="map" title="Your path at a glance">
            <JourneyMap guide={guide} />
          </Section>

          {gotchas.length > 0 && (
            <Section id="watch" title="Watch out for">
              <ul className="space-y-2">
                {gotchas.map((g, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <SeverityPill severity={g.severity} />
                    <span className="min-w-0 flex-1 font-medium">{g.title}</span>
                    <WhyLink href={`#why-gotcha-${i}`} label="why & fix" />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {guide.prerequisites.length > 0 && (
            <Section id="before" title="Before you start">
              <ul className="space-y-2">
                {guide.prerequisites.map((p, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-muted" aria-hidden>
                      ☐
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{p.item}</span>
                      {p.owner !== "developer" && (
                        <span className="ml-2 text-xs text-muted">{p.owner === "customer_admin" ? "customer's admin" : "business / legal"}</span>
                      )}
                    </span>
                    <EvidenceBadge evidence={p.evidence} compact />
                    <WhyLink href={`#why-prereq-${i}`} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section id="steps" title="Steps">
            <div className="space-y-5">
              {STEP_PHASES.map((phase) => {
                const inPhase = steps.filter(({ step }) => step.phase === phase);
                if (!inPhase.length) return null;
                return (
                  <div key={phase}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{PHASE_INFO[phase]}</h3>
                    <ol className="mt-2 space-y-1.5">
                      {inPhase.map(({ step: s, n }) => (
                        <li key={n} id={`step-${n}`} className="flex scroll-mt-24 flex-wrap items-center gap-2 rounded-md px-1 py-1 text-sm target:bg-accent-soft">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">{n}</span>
                          <span className="min-w-0 flex-1 font-medium">{s.title}</span>
                          {s.basis === "assumed" && <AssumedTag />}
                          <OwnerPill owner={actorPill(s)} />
                          <EvidenceBadge evidence={s.evidence} compact />
                          {s.url && (
                            <a href={s.url} target="_blank" rel="noreferrer" className="rounded border border-line px-1.5 py-0.5 text-[11px] text-accent hover:bg-surface-2">
                              open ↗
                            </a>
                          )}
                          <WhyLink href={`#why-step-${n}`} label="details" />
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section id="copy" title="Copy & paste">
            {guide.scopes.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Scopes to request</span>
                  <CopyButton text={guide.scopes.map((s) => s.scope).join(" ")} label="Copy all" className="no-print" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {guide.scopes.map((s, i) => (
                    <code key={i} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs" title={s.purpose}>
                      {s.scope}
                    </code>
                  ))}
                </div>
              </div>
            )}

            <dl className="mt-5 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
              <UrlRow label="Developer console" url={guide.quickRef.consoleUrl} />
              <UrlRow label="OAuth docs" url={guide.quickRef.docsUrl} />
              {guide.quickRef.authorizeUrl && <UrlRow label="Authorize URL" url={guide.quickRef.authorizeUrl} mono />}
              {guide.quickRef.tokenUrl && <UrlRow label="Token URL" url={guide.quickRef.tokenUrl} mono />}
              {guide.quickRef.discoveryUrl && <UrlRow label="Discovery" url={guide.quickRef.discoveryUrl} mono />}
            </dl>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Prompt for your coding agent</span>
                <CopyButton text={guide.agentHandoff.prompt} label="Copy prompt" className="no-print" />
              </div>
              <details className="rounded-lg bg-surface-2">
                <summary className="cursor-pointer px-4 py-2 text-xs text-muted">Show prompt</summary>
                <pre className="max-h-80 overflow-auto px-4 pb-4 text-xs leading-relaxed whitespace-pre-wrap">{guide.agentHandoff.prompt}</pre>
              </details>
            </div>
            {guide.agentHandoff.artifacts.map((a, i) => (
              <div key={i} className="mt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{a.title}</span>
                  <CopyButton text={a.content} label="Copy" className="no-print" />
                </div>
                <details className="rounded-lg bg-surface-2">
                  <summary className="cursor-pointer px-4 py-2 text-xs text-muted">Show {a.language || "snippet"}</summary>
                  <pre className="max-h-80 overflow-auto px-4 pb-4 font-mono text-xs leading-relaxed">{a.content}</pre>
                </details>
              </div>
            ))}
          </Section>

          {/* ───────────── Part 2: Why & details ───────────── */}
          <div className="pt-6">
            <h2 className="text-2xl font-semibold tracking-tight">Why & details</h2>
            <p className="mt-1 text-sm text-muted">The reasoning, evidence and sources behind everything above. Hover a badge to see its sources.</p>
          </div>

          <Section id="why-summary" title="The full picture" subtitle={ARCHETYPE_INFO[guide.classification.archetype].label}>
            <p className="text-base leading-relaxed">{guide.tldr}</p>
            <p className="mt-3 text-sm text-muted">{guide.classification.rationale}</p>
            {verdict.kind === "rated" && <p className="mt-2 text-xs text-muted">Rating: {DIFFICULTY_INFO[verdict.level].description}</p>}

            <div id="why-effort" className="mt-5 grid scroll-mt-24 gap-3 sm:grid-cols-2">
              <MilestoneTile title="Working with your own account" m={guide.effort.firstToken} />
              <MilestoneTile title="Any customer can connect" m={guide.effort.production} />
            </div>

            {guide.classification.flags.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-semibold">What affects your setup</h3>
                <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                  {guide.classification.flags.map((f) => (
                    <li key={f.id} className="rounded-lg border border-line p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium">{FLAG_INFO[f.id].label}</span>
                        <EvidenceBadge evidence={f.evidence} />
                      </div>
                      <p className="mt-1 text-sm text-muted">{f.detail}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {guide.prerequisites.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-semibold">Before you start — why each matters</h3>
                <ul className="mt-2 space-y-2">
                  {guide.prerequisites.map((p, i) => (
                    <li key={i} id={`why-prereq-${i}`} className="scroll-mt-24 rounded-md p-1 text-sm target:bg-accent-soft">
                      <span className="font-medium">{p.item}</span> <span className="text-muted">— {p.detail}</span>{" "}
                      <EvidenceBadge evidence={p.evidence} />
                    </li>
                  ))}
                </ul>
              </>
            )}

            <EvidenceSummary guide={guide} coverage={coverage} />
          </Section>

          <Section id="why-steps" title="Step details">
            <ol className="space-y-4">
              {steps.map(({ step: s, n }) => (
                <li key={n} id={`why-step-${n}`} className="scroll-mt-24 rounded-lg p-1 target:bg-accent-soft">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">{n}</span>
                    <span className="text-sm font-medium">{s.title}</span>
                    {s.basis === "assumed" && <AssumedTag />}
                    <EvidenceBadge evidence={s.evidence} />
                    <a href={`#step-${n}`} className="ml-auto text-[11px] text-muted hover:text-accent">
                      ↑ back to step
                    </a>
                  </div>
                  <div className="ml-8 mt-1 space-y-1 text-sm">
                    <p className="text-muted">{s.detail}</p>
                    {s.humanReason && s.owner !== "agent" && <p className="text-xs text-muted">👤 Why you: {HUMAN_REASON_INFO[s.humanReason]}</p>}
                    {s.agentHelp && <p className="text-xs text-muted">🤖 What an agent can do: {s.agentHelp}</p>}
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noreferrer" className="inline-block text-xs text-accent break-all hover:underline">
                        {s.url} ↗
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {gotchas.length > 0 && (
            <Section id="why-gotchas" title="Gotchas explained">
              <ul className="space-y-3">
                {gotchas.map((g, i) => (
                  <li key={i} id={`why-gotcha-${i}`} className="scroll-mt-24 rounded-lg border border-line p-4 target:bg-accent-soft">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityPill severity={g.severity} />
                      <span className="text-sm font-medium">{g.title}</span>
                      <span className="ml-auto">
                        <EvidenceBadge evidence={g.evidence} />
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{g.detail}</p>
                    <p className="mt-2 text-sm">
                      <span className="font-medium">Fix:</span> {g.mitigation}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {guide.scopes.length > 0 && (
            <Section id="why-scopes" title="Why each scope">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Scope</th>
                      <th className="py-2 pr-3 font-medium">Why you need it</th>
                      <th className="py-2 pr-3 font-medium">Tier</th>
                      <th className="py-2 font-medium">Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guide.scopes.map((s, i) => (
                      <tr key={i} className="border-t border-line align-top">
                        <td className="py-2 pr-3">
                          <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">{s.scope}</code>
                        </td>
                        <td className="py-2 pr-3 text-muted">{s.purpose}</td>
                        <td className="py-2 pr-3">
                          <TierPill tier={s.tier} />
                        </td>
                        <td className="py-2">
                          <EvidenceBadge evidence={s.evidence} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          <Section id="why-facts" title="Reference facts">
            <ul className="divide-y divide-line">
              {guide.quickRef.facts.map((f, i) => (
                <li key={i} className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-start sm:gap-4">
                  <span className="w-56 shrink-0 font-medium">{f.label}</span>
                  <span className="min-w-0 flex-1 text-muted break-words">{f.value}</span>
                  <EvidenceBadge evidence={f.evidence} />
                </li>
              ))}
            </ul>
          </Section>

          <Section id="verification" title="What we verified — and what we couldn't">
            <h3 className="text-sm font-semibold">Live probes (no credentials)</h3>
            {guide.probes.length ? (
              <ul className="mt-2 space-y-2">
                {guide.probes.map((p) => (
                  <li key={p.id} className="flex items-start gap-2 text-sm">
                    <span className={p.ok ? "text-[var(--ev-tested)]" : "text-[var(--ev-uncertain)]"}>{p.ok ? "✓" : "⚠"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium capitalize">{p.kind}</span>{" "}
                      <code className="font-mono text-xs break-all text-muted">{p.target}</code>
                      <span className="block text-muted">{p.observed}</span>
                    </span>
                    <span className="text-[11px] text-muted">[{p.id}]</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No probes recorded for this guide.</p>
            )}

            {guide.corrections.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-semibold">Corrections made during verification</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {guide.corrections.map((c, i) => (
                    <li key={i} className="rounded-lg border border-line p-3">
                      <div className="font-medium">{c.what}</div>
                      <div className="mt-1 text-muted">
                        <span className="line-through decoration-1">{c.before}</span> → {c.after}
                      </div>
                      <div className="mt-1 text-xs text-muted">{c.how}</div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {guide.uncertainties.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-semibold">Open questions</h3>
                <ul className="mt-2 space-y-3">
                  {guide.uncertainties.map((u, i) => (
                    <li key={i} className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--ev-uncertain)" }}>
                      <div className="font-medium">{u.question}</div>
                      <div className="mt-1 text-muted">{u.why}</div>
                      <div className="mt-1">
                        <span className="font-medium">To resolve:</span> {u.howToResolve}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          {email && (
            <Section id="ask" title="Ask the provider" subtitle="A ready-to-send message built from the open questions above.">
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
                <dt className="text-muted">Send to</dt>
                <dd className="min-w-0 break-words">
                  {guide.providerContact?.url ? (
                    <a href={guide.providerContact.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      {email.to}
                    </a>
                  ) : (
                    email.to
                  )}
                  {guide.providerContact && (
                    <span className="ml-2 align-middle">
                      <EvidenceBadge evidence={guide.providerContact.evidence} />
                    </span>
                  )}
                </dd>
                <dt className="text-muted">Subject</dt>
                <dd>{email.subject}</dd>
              </dl>
              <div className="relative mt-3">
                <pre className="max-h-96 overflow-auto rounded-lg bg-surface-2 p-4 text-xs leading-relaxed whitespace-pre-wrap">{email.body}</pre>
                <CopyButton text={`Subject: ${email.subject}\n\n${email.body}`} label="Copy message" className="no-print absolute right-2 top-2" />
              </div>
            </Section>
          )}

          <Section id="sources" title="Sources">
            <ol className="space-y-1.5 text-sm">
              {guide.sources.map((s) => (
                <li key={s.id} className="flex gap-2">
                  <span className="w-8 shrink-0 text-muted">{s.id}</span>
                  <span className="min-w-0 flex-1">
                    <a href={s.url} target="_blank" rel="noreferrer" className="break-words text-accent hover:underline">
                      {s.title}
                    </a>
                    <span className="ml-2 text-xs text-muted">{s.kind}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        </article>
      </div>
    </SourcesContext.Provider>
  );
}

function actorPill(s: Guide["steps"][number]) {
  const actor = actorOf(s);
  return actor === "agent" || actor === "you" ? s.owner : actor;
}

function TocGroup({ title, items }: { title: string; items: readonly (readonly [string, string])[] }) {
  return (
    <div className="mb-5">
      <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</div>
      <ul className="space-y-0.5 text-sm">
        {items.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`} className="block rounded px-2 py-1 text-muted hover:bg-surface-2 hover:text-ink">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-20 p-5 sm:p-7">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function waitText(r: Guide["effort"]["firstToken"]["waitDays"]): string {
  const d = formatDays(r);
  return d === "No wait" ? "hands-on · no waiting on the provider" : d === "Unknown" ? "hands-on + unknown provider wait" : `hands-on + ${d} waiting on the provider`;
}

function Stat({ label, value, sub, href }: { label: string; value: string; sub: string; href: string }) {
  return (
    <a href={href} className="rounded-lg border border-line p-3 hover:border-accent">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      <div className="text-xs text-muted">{sub}</div>
    </a>
  );
}

function WhyLink({ href, label = "why" }: { href: string; label?: string }) {
  return (
    <a href={href} className="no-print shrink-0 text-[11px] text-muted hover:text-accent">
      {label} →
    </a>
  );
}

function AssumedTag() {
  return (
    <span
      className="rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium"
      style={{ color: "var(--ev-uncertain)", borderColor: "var(--ev-uncertain)" }}
      title="Not described in this provider's docs — inferred from how OAuth usually works"
    >
      Assumed
    </span>
  );
}

function MilestoneTile({ title, m }: { title: string; m: Guide["effort"]["firstToken"] }) {
  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</span>
        <EvidenceBadge evidence={m.evidence} />
      </div>
      <div className="mt-2 text-sm font-medium">
        {formatMinutes(m.activeMinutes)} hands-on · {formatDays(m.waitDays).toLowerCase()}
      </div>
      <p className="mt-1 text-xs text-muted">{m.conditions}</p>
    </div>
  );
}

function EvidenceSummary({ guide, coverage }: { guide: Guide; coverage: number }) {
  const counts = evidenceCounts(guide);
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold">How well this guide is backed</h3>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        {EVIDENCE_STATUSES.map((s) => (
          <div key={s} style={{ width: `${(counts[s] / total) * 100}%`, background: `var(--ev-${s})` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {EVIDENCE_STATUSES.map((s) => (
          <span key={s} title={EVIDENCE_INFO[s].hint}>
            <EvidencePill status={s}>
              {counts[s]} {EVIDENCE_INFO[s].label.toLowerCase()}
            </EvidencePill>
          </span>
        ))}
        <span className="text-muted">
          · {coverageLabel(coverage)} ({Math.round(coverage * 100)}% backed)
        </span>
      </div>
    </div>
  );
}

function UrlRow({ label, url, mono }: { label: string; url: string | null; mono?: boolean }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        {url ? (
          <>
            <a href={url} target="_blank" rel="noreferrer" className={`min-w-0 break-all text-accent hover:underline ${mono ? "font-mono text-xs" : ""}`}>
              {url}
            </a>
            <CopyButton text={url} label="Copy" className="no-print shrink-0 !px-1.5 !py-0 text-[10px]" />
          </>
        ) : (
          <span className="text-[var(--ev-uncertain)]">Not found in the provider&apos;s documentation</span>
        )}
      </dd>
    </>
  );
}

function SeverityPill({ severity }: { severity: "blocker" | "warning" | "info" }) {
  const style = {
    blocker: { color: "var(--lvl-4)", label: "Blocker" },
    warning: { color: "var(--lvl-3)", label: "Warning" },
    info: { color: "var(--muted)", label: "Info" },
  }[severity];
  return (
    <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ color: style.color, borderColor: style.color }}>
      {style.label}
    </span>
  );
}

function TierPill({ tier }: { tier: string }) {
  const color = { basic: "var(--lvl-1)", sensitive: "var(--lvl-3)", restricted: "var(--lvl-4)", admin: "var(--lvl-4)", unknown: "var(--muted)" }[tier];
  return (
    <span className="text-xs font-medium capitalize" style={{ color }}>
      {tier}
    </span>
  );
}

function ShareBar({ guide }: { guide: Guide }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="no-print flex flex-wrap gap-2">
      <CopyButton text={() => `${origin}/guides/${guide.slug}`} label="Copy link" />
      <CopyButton text={() => `${origin}/share#${compressToEncodedURIComponent(JSON.stringify(guide))}`} label="Copy portable link" />
      <CopyButton text={() => guideToMarkdown(guide)} label="Copy Markdown" />
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-2"
      >
        Print / PDF
      </button>
    </div>
  );
}
