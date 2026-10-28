import type { Guide, GuideContent } from "./schema";
import type { Archetype, Flag } from "./taxonomy";

export type DifficultyLevel = 1 | 2 | 3 | 4;

export const DIFFICULTY_INFO: Record<DifficultyLevel, { label: string; description: string }> = {
  1: { label: "Quick", description: "Self-serve. You can ship the same day." },
  2: { label: "Moderate", description: "Self-serve with extra configuration, policies or an optional review." },
  3: { label: "Involved", description: "Expect reviews, admin approvals or per-customer setup measured in days." },
  4: { label: "High friction", description: "Audits, partner approval or multi-week reviews that you can't speed up." },
};

const BASE: Record<Archetype, DifficultyLevel> = {
  instant_self_serve: 1,
  self_serve_review_to_scale: 2,
  tenant_scoped: 3,
  scope_verification: 3,
  partner_gated: 4,
  no_public_oauth: 4, // never shown as a rating — see verdictOf
};

const HEAVY_FLAGS: Flag[] = ["security_assessment", "partner_application"];

// Difficulty is computed, never authored, so curated and live guides are rated identically.
export function difficultyOf(guide: Pick<GuideContent, "classification" | "effort">): DifficultyLevel {
  let level = BASE[guide.classification.archetype];
  const flags = new Set(guide.classification.flags.map((f) => f.id));
  if (HEAVY_FLAGS.some((f) => flags.has(f))) level = 4;

  const wait = guide.effort.production.waitDays;
  const maxWait = wait.max ?? wait.min;
  if (maxWait !== null && maxWait >= 21) level = Math.max(level, 4) as DifficultyLevel;
  else if (maxWait !== null && maxWait >= 3) level = Math.max(level, 3) as DifficultyLevel;
  return level;
}

export function evidenceCounts(guide: object) {
  const counts = { tested: 0, source: 0, community: 0, uncertain: 0 };
  JSON.stringify(guide, (key, value) => {
    if (key === "evidence" && value?.status) counts[value.status as keyof typeof counts]++;
    return value;
  });
  return counts;
}

// Share of claims backed by our own tests or official docs (community reports count half).
export function evidenceCoverage(guide: object): number {
  const c = evidenceCounts(guide);
  const total = c.tested + c.source + c.community + c.uncertain;
  return total ? (c.tested + c.source + 0.5 * c.community) / total : 0;
}

export const LOW_COVERAGE = 0.4;

export function coverageLabel(coverage: number): string {
  if (coverage >= 0.7) return "Well evidenced";
  if (coverage >= LOW_COVERAGE) return "Partially evidenced";
  return "Low evidence";
}

export type Verdict =
  | { kind: "rated"; level: DifficultyLevel }
  | { kind: "unrated"; coverage: number }
  | { kind: "not_available" };

// A difficulty rating is only shown when the evidence can carry it; "no public OAuth" is not a difficulty at all.
export function verdictOf(guide: Guide): Verdict {
  if (guide.classification.archetype === "no_public_oauth") return { kind: "not_available" };
  const coverage = evidenceCoverage(guide);
  if (coverage < LOW_COVERAGE) return { kind: "unrated", coverage };
  return { kind: "rated", level: difficultyOf(guide) };
}
