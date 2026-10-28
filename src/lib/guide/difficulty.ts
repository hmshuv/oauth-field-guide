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
  no_public_oauth: 4,
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

export function evidenceCounts(guide: Guide) {
  const counts = { tested: 0, source: 0, community: 0, uncertain: 0 };
  JSON.stringify(guide, (key, value) => {
    if (key === "evidence" && value?.status) counts[value.status as keyof typeof counts]++;
    return value;
  });
  return counts;
}
