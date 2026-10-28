"use client";

// "Your path at a glance": a swimlane map drawn from the guide's own data (no model calls).
// Columns are the phases that have steps, lanes are who acts, provider waits are bars, and the
// two milestones (first token / production) are marked under the phase where they're reached.
import { formatDays, formatMinutes, numberedSteps } from "@/lib/guide/format";
import type { Guide } from "@/lib/guide/schema";
import { PHASE_INFO, STEP_PHASES, type StepPhase } from "@/lib/guide/taxonomy";

type Lane = "agent" | "you" | "provider" | "customer";

const LANES: { key: Lane; label: string; glyph: string }[] = [
  { key: "agent", label: "Agent", glyph: "🤖" },
  { key: "you", label: "You", glyph: "👤" },
  { key: "provider", label: "Provider", glyph: "⏳" },
  { key: "customer", label: "Customer admin", glyph: "🏢" },
];

type Step = Guide["steps"][number];

function laneOf(s: Step): Lane {
  if (s.phase === "customer" || s.humanReason === "customer_admin") return "customer";
  if (s.humanReason === "provider_review") return "provider";
  return s.owner === "agent" ? "agent" : "you";
}

const hasWait = (r: { min: number | null; max: number | null }) => (r.max ?? r.min) !== 0;

export function JourneyMap({ guide }: { guide: Guide }) {
  const steps = numberedSteps(guide);
  const phases = STEP_PHASES.filter((p) => steps.some((s) => s.step.phase === p));
  if (!phases.length) return null;

  // Where each wait sits: the review phase if present, otherwise the first phase after testing.
  const prodWait = hasWait(guide.effort.production.waitDays);
  const waitPhase: StepPhase | null = prodWait
    ? (phases.find((p) => p === "review") ?? phases.find((p) => p === "launch") ?? phases[phases.length - 1])
    : null;
  const firstTokenPhase = phases.filter((p) => ["prepare", "register", "configure", "test"].includes(p)).pop() ?? phases[0];
  const productionPhase = phases[phases.length - 1];

  const lanes = LANES.filter(
    (l) => l.key === "you" || l.key === "agent" || steps.some((s) => laneOf(s.step) === l.key) || (l.key === "provider" && prodWait),
  );
  const cols = `minmax(92px,auto) repeat(${phases.length}, minmax(76px, 1fr))`;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid gap-y-1" style={{ gridTemplateColumns: cols }}>
          <div />
          {phases.map((p) => (
            <div key={p} className="px-1 pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
              {PHASE_INFO[p].replace(/ the app| with your account| & verification| to customers|-side setup/g, "")}
            </div>
          ))}

          {lanes.map((lane) => (
            <Row key={lane.key} lane={lane} phases={phases} steps={steps} waitPhase={lane.key === "provider" ? waitPhase : null} guide={guide} />
          ))}

          <div className="pt-2 text-[11px] font-medium text-muted">Milestones</div>
          {phases.map((p) => (
            <div key={p} className="flex flex-col items-center gap-1 px-1 pt-2">
              {p === firstTokenPhase && (
                <Milestone label="Works for you" active={formatMinutes(guide.effort.firstToken.activeMinutes)} wait={guide.effort.firstToken.waitDays} />
              )}
              {p === productionPhase && (
                <Milestone label="Any customer" active={formatMinutes(guide.effort.production.activeMinutes)} wait={guide.effort.production.waitDays} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          <span>
            <Dot kind="agent" /> agent can do
          </span>
          <span>
            <Dot kind="you" /> you
          </span>
          <span>
            <Dot kind="shared" /> agent prepares, you finish
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border border-dashed border-[var(--ev-uncertain)] align-middle" /> assumed
          </span>
          <span>Click a step to jump to it.</span>
        </div>
      </div>
    </div>
  );
}

function Row({
  lane,
  phases,
  steps,
  waitPhase,
  guide,
}: {
  lane: (typeof LANES)[number];
  phases: StepPhase[];
  steps: { step: Step; n: number }[];
  waitPhase: StepPhase | null;
  guide: Guide;
}) {
  return (
    <>
      <div className="flex items-center gap-1.5 border-t border-line py-2 pr-2 text-xs font-medium">
        <span aria-hidden>{lane.glyph}</span>
        {lane.label}
      </div>
      {phases.map((p) => {
        const here = steps.filter((s) => s.step.phase === p && laneOf(s.step) === lane.key);
        return (
          <div key={p} className="flex flex-wrap items-center justify-center gap-1 border-t border-line px-1 py-2">
            {here.map(({ step, n }) => (
              <StepNode key={n} step={step} n={n} />
            ))}
            {p === waitPhase && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                style={{ background: "var(--ev-uncertain-soft)", color: "var(--ev-uncertain)" }}
                title={guide.effort.production.conditions}
              >
                wait {formatDays(guide.effort.production.waitDays)}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

function StepNode({ step, n }: { step: Step; n: number }) {
  const shared = step.owner === "shared";
  const agent = step.owner === "agent";
  return (
    <a
      href={`#step-${n}`}
      title={`${n}. ${step.title}`}
      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition hover:scale-110 ${
        step.basis === "assumed" ? "border-2 border-dashed" : "border-2"
      }`}
      style={{
        background: agent ? "var(--accent)" : shared ? "var(--accent-soft)" : "var(--surface-2)",
        color: agent ? "white" : "var(--text)",
        borderColor: step.basis === "assumed" ? "var(--ev-uncertain)" : agent || shared ? "var(--accent)" : "var(--border)",
      }}
    >
      {n}
    </a>
  );
}

function Milestone({ label, active, wait }: { label: string; active: string; wait: { min: number | null; max: number | null } }) {
  return (
    <div className="rounded-md border border-line bg-surface px-2 py-1 text-center">
      <div className="text-[11px] font-semibold whitespace-nowrap">◆ {label}</div>
      <div className="text-[10px] text-muted">{active} hands-on</div>
      <div className="text-[10px] text-muted">{formatDays(wait).toLowerCase()}</div>
    </div>
  );
}

function Dot({ kind }: { kind: "agent" | "you" | "shared" }) {
  const style = {
    agent: { background: "var(--accent)", borderColor: "var(--accent)" },
    you: { background: "var(--surface-2)", borderColor: "var(--border)" },
    shared: { background: "var(--accent-soft)", borderColor: "var(--accent)" },
  }[kind];
  return <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border align-middle" style={style} />;
}
