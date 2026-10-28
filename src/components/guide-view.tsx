"use client";

import { compressToEncodedURIComponent } from "lz-string";
import { useMemo } from "react";
import { coverageLabel, DIFFICULTY_INFO, evidenceCounts, evidenceCoverage, verdictOf } from "@/lib/guide/difficulty";
import { formatDays, formatMinutes, guideToMarkdown, providerEmail } from "@/lib/guide/format";
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

const SECTIONS = [
  ["overview", "Overview"],
  ["factors", "What affects setup"],
  ["split", "Agent vs. you"],
  ["steps", "Steps"],
  ["gotchas", "Gotchas"],
  ["scopes", "Scopes"],
  ["reference", "Quick reference"],
  ["handoff", "Hand off to an agent"],
  ["verification", "What we verified"],
  ["ask", "Ask the provider"],
  ["sources", "Sources"],
] as const;

export function GuideView({ guide, shareable = true }: { guide: Guide; shareable?: boolean }) {
  const sources = useMemo(() => new Map(guide.sources.map((s) => [s.id, s])), [guide.sources]);
  const verdict = verdictOf(guide);
  const coverage = evidenceCoverage(guide);
  const email = providerEmail(guide);
  const counts = evidenceCounts(guide);
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const live = guide.origin.kind === "live";

  return (
    <SourcesContext.Provider value={sources}>
      <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 py-8 sm:px-6">
        <nav className="no-print sticky top-20 hidden h-fit w-44 shrink-0 xl:block" aria-label="Guide sections">
          <ul className="space-y-1 text-sm">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded px-2 py-1 text-muted hover:bg-surface-2 hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 flex-1 space-y-6">
          {/* Overview */}
          <section id="overview" className="card scroll-mt-20 p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted">
                {live ? (
                  <>
                    <span className="font-medium text-accent">Live investigation</span> · {guide.origin.model} ·{" "}
                    {new Date(guide.origin.generatedAt).toLocaleString()}
                    {guide.origin.durationMs ? ` · ${Math.round(guide.origin.durationMs / 1000)}s` : ""}
                  </>
                ) : (
                  <>
                    <span className="font-medium text-ink">Curated library guide</span> · researched{" "}
                    {guide.origin.generatedAt.slice(0, 10)}
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
              · {guide.category}
            </p>
            <p className="mt-3 text-sm">
              <span className="text-muted">Assumes you are building:</span> {guide.assumedUseCase}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <VerdictBadge verdict={verdict} size="lg" />
              <ArchetypeBadge archetype={guide.classification.archetype} />
              <span className="text-xs text-muted">
                {verdict.kind === "rated"
                  ? DIFFICULTY_INFO[verdict.level].description
                  : verdict.kind === "not_available"
                    ? "Third-party developers can't use OAuth here — see the alternative below."
                    : "Too little of this guide is backed by docs or tests to rate it."}
              </span>
            </div>
            {verdict.kind === "unrated" && (
              <div className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--ev-uncertain)", background: "var(--ev-uncertain-soft)" }}>
                <span className="font-semibold" style={{ color: "var(--ev-uncertain)" }}>
                  Low evidence — {Math.round(coverage * 100)}% of claims are backed.
                </span>{" "}
                The provider&apos;s documentation is thin or missing, so most of this guide is inferred. Treat it as a starting
                point and {email ? <a href="#ask" className="underline">ask the provider</a> : "contact the provider"} before
                committing to a launch date.
              </div>
            )}
            <p className="mt-4 text-base leading-relaxed">{guide.tldr}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MilestoneTile title="Working with your own account" m={guide.effort.firstToken} />
              <MilestoneTile title="Any customer can connect" m={guide.effort.production} />
            </div>

            <div className="mt-5 rounded-lg border border-accent/30 bg-accent-soft p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-accent">Do this next</div>
              <p className="mt-1 text-sm">{guide.nextAction}</p>
            </div>

            <div className="mt-5">
              <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
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
                <span className="text-muted">· {coverageLabel(coverage)} ({Math.round(coverage * 100)}% backed)</span>
                <a href="#verification" className="text-muted underline-offset-2 hover:underline">
                  How we graded this →
                </a>
              </div>
            </div>
          </section>

          {/* Factors */}
          <Section id="factors" title="What affects your setup" subtitle={ARCHETYPE_INFO[guide.classification.archetype].short}>
            <p className="text-sm text-muted">{guide.classification.rationale}</p>
            {guide.classification.flags.length > 0 && (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
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
            )}
            {guide.prerequisites.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-semibold">Before you start</h3>
                <ul className="mt-2 space-y-2">
                  {guide.prerequisites.map((p, i) => (
                    <li key={i} className="flex flex-wrap items-start gap-2 text-sm">
                      <span className="mt-0.5 text-muted">☐</span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{p.item}</span>{" "}
                        <span className="text-muted">
                          — {p.detail}
                          {p.owner === "customer_admin" ? " (your customer's admin)" : p.owner === "business" ? " (business/legal)" : ""}
                        </span>
                      </span>
                      <EvidenceBadge evidence={p.evidence} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          {/* Split */}
          <Section id="split" title="What an agent can do vs. where you take over">
            <SplitView guide={guide} />
          </Section>

          {/* Steps */}
          <Section id="steps" title="Step-by-step">
            <StepList guide={guide} />
          </Section>

          {/* Gotchas */}
          <Section id="gotchas" title="Gotchas & blockers">
            <ul className="space-y-3">
              {[...guide.gotchas]
                .sort((a, b) => sevRank(a.severity) - sevRank(b.severity))
                .map((g, i) => (
                  <li key={i} className="rounded-lg border border-line p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityPill severity={g.severity} />
                      <span className="text-sm font-medium">{g.title}</span>
                      <span className="ml-auto">
                        <EvidenceBadge evidence={g.evidence} />
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{g.detail}</p>
                    <p className="mt-2 text-sm">
                      <span className="font-medium">Mitigation:</span> {g.mitigation}
                    </p>
                  </li>
                ))}
            </ul>
          </Section>

          {/* Scopes */}
          {guide.scopes.length > 0 && (
            <Section id="scopes" title="Scopes for this use case">
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

          {/* Reference */}
          <Section id="reference" title="Quick reference">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
              <RefRow label="Developer console" url={guide.quickRef.consoleUrl} />
              <RefRow label="OAuth docs" url={guide.quickRef.docsUrl} />
              {guide.quickRef.authorizeUrl && <RefRow label="Authorize URL" url={guide.quickRef.authorizeUrl} mono />}
              {guide.quickRef.tokenUrl && <RefRow label="Token URL" url={guide.quickRef.tokenUrl} mono />}
              {guide.quickRef.discoveryUrl && <RefRow label="Discovery document" url={guide.quickRef.discoveryUrl} mono />}
            </dl>
            <ul className="mt-5 divide-y divide-line border-t border-line">
              {guide.quickRef.facts.map((f, i) => (
                <li key={i} className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-start sm:gap-4">
                  <span className="w-56 shrink-0 font-medium">{f.label}</span>
                  <span className="min-w-0 flex-1 text-muted break-words">{f.value}</span>
                  <EvidenceBadge evidence={f.evidence} />
                </li>
              ))}
            </ul>
          </Section>

          {/* Handoff */}
          <Section id="handoff" title="Hand this to your coding agent" subtitle="Paste into Claude Code, Cursor, Copilot, etc.">
            <div className="relative">
              <pre className="max-h-80 overflow-auto rounded-lg bg-surface-2 p-4 text-xs leading-relaxed whitespace-pre-wrap">
                {guide.agentHandoff.prompt}
              </pre>
              <CopyButton text={guide.agentHandoff.prompt} label="Copy prompt" className="no-print absolute right-2 top-2" />
            </div>
            {guide.agentHandoff.artifacts.map((a, i) => (
              <div key={i} className="mt-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">{a.title}</span>
                  <CopyButton text={a.content} label="Copy" className="no-print" />
                </div>
                <pre className="max-h-80 overflow-auto rounded-lg bg-surface-2 p-4 font-mono text-xs leading-relaxed">{a.content}</pre>
              </div>
            ))}
          </Section>

          {/* Verification */}
          <Section id="verification" title="What we verified — and what we couldn't">
            <div className="grid gap-2 text-xs sm:grid-cols-4">
              {EVIDENCE_STATUSES.map((s) => (
                <div key={s} className="rounded-lg border border-line p-3">
                  <EvidencePill status={s} />
                  <p className="mt-1.5 text-muted">{EVIDENCE_INFO[s].hint}</p>
                </div>
              ))}
            </div>

            <h3 className="mt-6 text-sm font-semibold">Live probes (no credentials)</h3>
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
          </Section>

          {/* Ask the provider */}
          {email && (
            <Section id="ask" title="Ask the provider" subtitle="When the docs run out: a ready-to-send message built from the open questions above.">
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

          {/* Sources */}
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

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-20 p-5 sm:p-7">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MilestoneTile({ title, m }: { title: string; m: Guide["effort"]["firstToken"] }) {
  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</span>
        <EvidenceBadge evidence={m.evidence} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
        <div>
          <div className="text-xl font-semibold">{formatMinutes(m.activeMinutes)}</div>
          <div className="text-xs text-muted">hands-on</div>
        </div>
        <div>
          <div className="text-xl font-semibold">{formatDays(m.waitDays)}</div>
          <div className="text-xs text-muted">waiting on provider</div>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">{m.conditions}</p>
    </div>
  );
}

function SplitView({ guide }: { guide: Guide }) {
  const agent = guide.steps.filter((s) => s.owner === "agent" || (s.owner === "shared" && s.agentHelp));
  const human = guide.steps.filter((s) => s.owner !== "agent");
  const reasons = [...new Set(human.map((s) => s.humanReason).filter((r): r is NonNullable<typeof r> => !!r))];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg bg-accent-soft p-4">
        <div className="text-sm font-semibold text-accent">🤖 An agent can handle ({agent.length})</div>
        <ul className="mt-2 space-y-1.5 text-sm">
          {agent.map((s, i) => (
            <li key={i}>
              <span className="font-medium">{s.title}</span>
              {s.agentHelp && <span className="text-muted"> — {s.agentHelp}</span>}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg bg-surface-2 p-4">
        <div className="text-sm font-semibold">👤 You take over ({human.length})</div>
        <ul className="mt-2 space-y-1.5 text-sm">
          {human.map((s, i) => (
            <li key={i}>
              <span className="font-medium">{s.title}</span>
              {s.humanReason && <span className="text-muted"> — {HUMAN_REASON_INFO[s.humanReason]}</span>}
            </li>
          ))}
        </ul>
        {reasons.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Why a human: {reasons.map((r) => HUMAN_REASON_INFO[r].toLowerCase()).join("; ")}.
          </p>
        )}
      </div>
    </div>
  );
}

function StepList({ guide }: { guide: Guide }) {
  let n = 0;
  return (
    <div className="space-y-6">
      {STEP_PHASES.map((phase) => {
        const steps = guide.steps.filter((s) => s.phase === phase);
        if (!steps.length) return null;
        return (
          <div key={phase}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{PHASE_INFO[phase]}</h3>
            <ol className="mt-2 space-y-3">
              {steps.map((s, i) => {
                n++;
                return (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">
                      {n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{s.title}</span>
                        {s.basis === "assumed" && (
                          <span
                            className="rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium"
                            style={{ color: "var(--ev-uncertain)", borderColor: "var(--ev-uncertain)" }}
                            title="Not described in this provider's docs — inferred from how OAuth usually works"
                          >
                            Assumed
                          </span>
                        )}
                        <OwnerPill owner={s.owner} />
                        <EvidenceBadge evidence={s.evidence} />
                      </div>
                      <p className="mt-1 text-sm text-muted">{s.detail}</p>
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-accent break-all hover:underline">
                          {s.url} ↗
                        </a>
                      )}
                      {s.humanReason && s.owner !== "agent" && (
                        <p className="mt-1 text-xs text-muted">👤 {HUMAN_REASON_INFO[s.humanReason]}</p>
                      )}
                      {s.agentHelp && <p className="mt-1 text-xs text-muted">🤖 {s.agentHelp}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </div>
  );
}

function RefRow({ label, url, mono }: { label: string; url: string | null; mono?: boolean }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className={`break-all text-accent hover:underline ${mono ? "font-mono text-xs" : ""}`}>
            {url}
          </a>
        ) : (
          <span className="text-[var(--ev-uncertain)]">Not found in the provider&apos;s documentation</span>
        )}
      </dd>
    </>
  );
}

const sevRank = (s: string) => ({ blocker: 0, warning: 1, info: 2 })[s] ?? 3;

function SeverityPill({ severity }: { severity: "blocker" | "warning" | "info" }) {
  const style = {
    blocker: { color: "var(--lvl-4)", label: "Blocker" },
    warning: { color: "var(--lvl-3)", label: "Warning" },
    info: { color: "var(--muted)", label: "Info" },
  }[severity];
  return (
    <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ color: style.color, borderColor: style.color }}>
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
      <CopyButton
        text={() => `${origin}/share#${compressToEncodedURIComponent(JSON.stringify(guide))}`}
        label="Copy portable link"
      />
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
