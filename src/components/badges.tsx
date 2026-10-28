"use client";

import { createContext, useContext } from "react";
import { DIFFICULTY_INFO, type DifficultyLevel, type Verdict } from "@/lib/guide/difficulty";
import type { Evidence, Source } from "@/lib/guide/schema";
import { ARCHETYPE_INFO, EVIDENCE_INFO, type Archetype, type EvidenceStatus } from "@/lib/guide/taxonomy";

export const SourcesContext = createContext<Map<string, Source>>(new Map());

const EV_STYLE: Record<EvidenceStatus, { color: string; bg: string; glyph: string }> = {
  tested: { color: "var(--ev-tested)", bg: "var(--ev-tested-soft)", glyph: "●" },
  source: { color: "var(--ev-source)", bg: "var(--ev-source-soft)", glyph: "◆" },
  community: { color: "var(--ev-community)", bg: "var(--ev-community-soft)", glyph: "▲" },
  uncertain: { color: "var(--ev-uncertain)", bg: "var(--ev-uncertain-soft)", glyph: "?" },
};

export function EvidencePill({ status, children }: { status: EvidenceStatus; children?: React.ReactNode }) {
  const s = EV_STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{ color: s.color, background: s.bg }}
    >
      <span aria-hidden>{s.glyph}</span>
      {children ?? EVIDENCE_INFO[status].label}
    </span>
  );
}

// Evidence badge with a hover/focus card listing the note and the sources behind the claim.
// `compact` renders just a coloured glyph (for scannable checklists); the hover card is the same.
export function EvidenceBadge({ evidence, compact = false }: { evidence: Evidence; compact?: boolean }) {
  const sources = useContext(SourcesContext);
  const cited = evidence.sources.map((id) => sources.get(id)).filter((s): s is Source => !!s);
  const style = EV_STYLE[evidence.status];
  return (
    <span className="group relative inline-flex align-middle">
      <button type="button" className="cursor-help focus:outline-none" aria-label={`Evidence: ${EVIDENCE_INFO[evidence.status].label}`}>
        {compact ? (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px]" style={{ color: style.color, background: style.bg }}>
            {style.glyph}
          </span>
        ) : (
          <EvidencePill status={evidence.status}>
            {EVIDENCE_INFO[evidence.status].label}
            {cited.length > 0 && <span className="opacity-70">· {cited.map((s) => s.id).join(" ")}</span>}
          </EvidencePill>
        )}
      </button>
      <span className="absolute right-0 top-full z-30 mt-1 hidden w-80 max-w-[85vw] rounded-lg border border-line bg-surface p-3 text-xs text-ink shadow-lg group-hover:block group-focus-within:block sm:left-0 sm:right-auto">
        <span className="block font-medium">{EVIDENCE_INFO[evidence.status].label}</span>
        <span className="mt-0.5 block text-muted">{EVIDENCE_INFO[evidence.status].hint}</span>
        {evidence.note && <span className="mt-2 block">{evidence.note}</span>}
        {cited.length > 0 && (
          <span className="mt-2 block space-y-1">
            {cited.map((s) => (
              <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="block truncate text-accent hover:underline">
                [{s.id}] {s.title}
              </a>
            ))}
          </span>
        )}
      </span>
    </span>
  );
}

const LVL_COLOR: Record<DifficultyLevel, string> = { 1: "var(--lvl-1)", 2: "var(--lvl-2)", 3: "var(--lvl-3)", 4: "var(--lvl-4)" };

export function DifficultyBadge({ level, size = "sm" }: { level: DifficultyLevel; size?: "sm" | "lg" }) {
  const color = LVL_COLOR[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}
      style={{ color, borderColor: color }}
      title={DIFFICULTY_INFO[level].description}
    >
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`${size === "lg" ? "h-2.5 w-1.5" : "h-2 w-1"} rounded-sm`}
            style={{ background: i <= level ? color : "var(--border)" }}
          />
        ))}
      </span>
      {DIFFICULTY_INFO[level].label}
    </span>
  );
}

export function ArchetypeBadge({ archetype }: { archetype: Archetype }) {
  return (
    <span
      className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted"
      title={ARCHETYPE_INFO[archetype].description}
    >
      {ARCHETYPE_INFO[archetype].label}
    </span>
  );
}

export function OwnerPill({ owner }: { owner: "agent" | "human" | "shared" | "provider" | "customer" }) {
  const map = {
    agent: { label: "Agent can do", glyph: "🤖", cls: "bg-accent-soft text-accent" },
    human: { label: "You", glyph: "👤", cls: "bg-surface-2 text-ink" },
    shared: { label: "Agent prepares, you finish", glyph: "🤝", cls: "bg-surface-2 text-ink" },
    provider: { label: "Provider reviews", glyph: "⏳", cls: "bg-surface-2 text-ink" },
    customer: { label: "Customer admin", glyph: "🏢", cls: "bg-surface-2 text-ink" },
  }[owner];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${map.cls}`}>
      <span aria-hidden>{map.glyph}</span>
      {map.label}
    </span>
  );
}

// Difficulty when the evidence supports a rating; otherwise an explicit "unrated" or "not available".
export function VerdictBadge({ verdict, size = "sm" }: { verdict: Verdict; size?: "sm" | "lg" }) {
  if (verdict.kind === "rated") return <DifficultyBadge level={verdict.level} size={size} />;
  const cls = `inline-flex items-center gap-1.5 rounded-full border border-dashed font-semibold ${size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`;
  return verdict.kind === "not_available" ? (
    <span className={cls} style={{ color: "var(--muted)", borderColor: "var(--muted)" }} title="No public OAuth flow for third-party developers">
      ⊘ No public OAuth
    </span>
  ) : (
    <span className={cls} style={{ color: "var(--ev-uncertain)", borderColor: "var(--ev-uncertain)" }} title="Not enough evidence to rate difficulty">
      ? Unrated · low evidence
    </span>
  );
}
