"use client";

// "Your path at a glance": a swimlane map drawn from the guide's own data (no model calls).
// Columns are the phases that have steps, lanes are who acts, provider waits are bars, and the
// two milestones (first token / production) are marked under the phase where they're reached.
// Arrows connect the steps in order; they're measured from the rendered nodes so they follow the layout.
import { useLayoutEffect, useRef, useState } from "react";
import { actorOf, formatDays, formatMinutes, numberedSteps, type Actor } from "@/lib/guide/format";
import type { Guide } from "@/lib/guide/schema";
import { PHASE_INFO, STEP_PHASES, type StepPhase } from "@/lib/guide/taxonomy";

const LANES: { key: Actor; label: string; glyph: string }[] = [
  { key: "agent", label: "Agent", glyph: "🤖" },
  { key: "you", label: "You", glyph: "👤" },
  { key: "provider", label: "Provider", glyph: "⏳" },
  { key: "customer", label: "Customer admin", glyph: "🏢" },
];

type Step = Guide["steps"][number];

const hasWait = (r: { min: number | null; max: number | null }) => (r.max ?? r.min) !== 0;

const NODE_RADIUS = 16; // half the 28px node plus a small gap before the arrowhead

function arrowPath(a: DOMRect, b: DOMRect, origin: DOMRect): string | null {
  const ax = a.left + a.width / 2 - origin.left;
  const ay = a.top + a.height / 2 - origin.top;
  const bx = b.left + b.width / 2 - origin.left;
  const by = b.top + b.height / 2 - origin.top;
  const dx = bx - ax;
  const dy = by - ay;
  if (Math.abs(dx) < 8) {
    if (Math.abs(dy) < 8) return null;
    const s = Math.sign(dy);
    return `M ${ax} ${ay + s * NODE_RADIUS} L ${bx} ${by - s * NODE_RADIUS}`;
  }
  const s = Math.sign(dx);
  const sx = ax + s * NODE_RADIUS;
  const ex = bx - s * NODE_RADIUS;
  if (Math.abs(dy) < 2) return `M ${sx} ${ay} L ${ex} ${by}`;
  const mid = (ex - sx) / 2;
  return `M ${sx} ${ay} C ${sx + mid} ${ay}, ${ex - mid} ${by}, ${ex} ${by}`;
}

export function JourneyMap({ guide }: { guide: Guide }) {
  const steps = numberedSteps(guide);
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<number, HTMLAnchorElement>());
  const [paths, setPaths] = useState<string[]>([]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const origin = wrap.getBoundingClientRect();
      const next: string[] = [];
      for (let n = 1; n < steps.length; n++) {
        const a = nodeRefs.current.get(n);
        const b = nodeRefs.current.get(n + 1);
        if (!a || !b) continue;
        const d = arrowPath(a.getBoundingClientRect(), b.getBoundingClientRect(), origin);
        if (d) next.push(d);
      }
      setPaths(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [steps.length]);

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
    (l) => l.key === "you" || l.key === "agent" || steps.some((s) => actorOf(s.step) === l.key) || (l.key === "provider" && prodWait),
  );
  const cols = `minmax(92px,auto) repeat(${phases.length}, minmax(76px, 1fr))`;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        <div ref={wrapRef} className="relative grid gap-y-1" style={{ gridTemplateColumns: cols }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <marker id="journey-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted)" />
              </marker>
            </defs>
            {paths.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="var(--muted)" strokeOpacity={0.7} strokeWidth={1.5} markerEnd="url(#journey-arrow)" />
            ))}
          </svg>
          <div />
          {phases.map((p) => (
            <div key={p} className="px-1 pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
              {PHASE_INFO[p].replace(/ the app| with your account| & verification| to customers|-side setup/g, "")}
            </div>
          ))}

          {lanes.map((lane) => (
            <Row
              key={lane.key}
              lane={lane}
              phases={phases}
              steps={steps}
              waitPhase={lane.key === "provider" ? waitPhase : null}
              guide={guide}
              register={(n, el) => (el ? nodeRefs.current.set(n, el) : nodeRefs.current.delete(n))}
            />
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
  register,
}: {
  lane: (typeof LANES)[number];
  phases: StepPhase[];
  steps: { step: Step; n: number }[];
  waitPhase: StepPhase | null;
  guide: Guide;
  register: (n: number, el: HTMLAnchorElement | null) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-1.5 border-t border-line py-2 pr-2 text-xs font-medium">
        <span aria-hidden>{lane.glyph}</span>
        {lane.label}
      </div>
      {phases.map((p) => {
        const here = steps.filter((s) => s.step.phase === p && actorOf(s.step) === lane.key);
        return (
          <div key={p} className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-line px-1 py-3">
            {here.map(({ step, n }) => (
              <StepNode key={n} step={step} n={n} nodeRef={(el) => register(n, el)} />
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

function StepNode({ step, n, nodeRef }: { step: Step; n: number; nodeRef: (el: HTMLAnchorElement | null) => void }) {
  const shared = step.owner === "shared";
  const agent = step.owner === "agent";
  return (
    <a
      ref={nodeRef}
      href={`#step-${n}`}
      title={`${n}. ${step.title}`}
      className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition hover:scale-110 ${
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
      <div className="text-[10px] text-muted whitespace-nowrap">{active} work</div>
      <div className="text-[10px] text-muted whitespace-nowrap">{formatDays(wait) === "No wait" ? "no wait" : `${formatDays(wait)} wait`}</div>
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
