import { z } from "zod";
import {
  ARCHETYPES,
  EVIDENCE_STATUSES,
  FLAGS,
  HUMAN_REASONS,
  OWNERS,
  SCOPE_TIERS,
  STEP_PHASES,
} from "./taxonomy";

// Every claim in a guide carries evidence: a status plus the ids of the sources behind it.
export const Evidence = z.object({
  status: z.enum(EVIDENCE_STATUSES),
  sources: z.array(z.string()).describe("Source ids (e.g. S1) that support this claim"),
  note: z.string().optional().describe("How it was tested, or why it is uncertain"),
});
export type Evidence = z.infer<typeof Evidence>;

const Range = z.object({
  min: z.number().nullable().describe("Lower bound; null if unknown"),
  max: z.number().nullable().describe("Upper bound; null if unknown"),
});

const Milestone = z.object({
  activeMinutes: Range.describe("Hands-on developer time in minutes"),
  waitDays: Range.describe("Calendar wait on the provider in days; 0/0 if none, null if unknown"),
  conditions: z.string().describe("What must be true to reach this milestone"),
  evidence: Evidence,
});

// The part of a guide an author (curator or the live agent) writes.
export const GuideContent = z.object({
  appName: z.string(),
  website: z.string(),
  category: z.string().describe("Product category, e.g. 'Email', 'CRM', 'Developer tools'"),
  assumedUseCase: z
    .string()
    .describe("The integration this guide assumes, e.g. 'AI agent reads and sends email for the user'"),
  tldr: z.string().describe("Two sentences: how hard this is and the single biggest thing to know"),
  classification: z.object({
    archetype: z.enum(ARCHETYPES),
    rationale: z.string(),
    flags: z.array(
      z.object({
        id: z.enum(FLAGS),
        detail: z.string(),
        evidence: Evidence,
      }),
    ),
  }),
  effort: z.object({
    firstToken: Milestone.describe("Until OAuth works with the developer's own account"),
    production: Milestone.describe("Until any customer can connect without warnings or caps"),
  }),
  quickRef: z.object({
    consoleUrl: z.string().describe("Where the developer registers the app"),
    docsUrl: z.string().describe("Main official OAuth documentation page"),
    authorizeUrl: z.string().nullable(),
    tokenUrl: z.string().nullable(),
    discoveryUrl: z.string().nullable().describe("OIDC/OAuth discovery document if one exists"),
    facts: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
        evidence: Evidence,
      }),
    ),
  }),
  scopes: z.array(
    z.object({
      scope: z.string(),
      purpose: z.string(),
      tier: z.enum(SCOPE_TIERS),
      evidence: Evidence,
    }),
  ),
  prerequisites: z.array(
    z.object({
      item: z.string(),
      detail: z.string(),
      owner: z.enum(["developer", "business", "customer_admin"]),
      evidence: Evidence,
    }),
  ),
  steps: z.array(
    z.object({
      phase: z.enum(STEP_PHASES),
      title: z.string(),
      detail: z.string(),
      url: z.string().nullable(),
      owner: z.enum(OWNERS),
      humanReason: z.enum(HUMAN_REASONS).nullable(),
      agentHelp: z.string().nullable().describe("What a coding/AI agent can do for this step"),
      evidence: Evidence,
    }),
  ),
  gotchas: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      severity: z.enum(["blocker", "warning", "info"]),
      mitigation: z.string(),
      evidence: Evidence,
    }),
  ),
  uncertainties: z.array(
    z.object({
      question: z.string(),
      why: z.string(),
      howToResolve: z.string(),
    }),
  ),
  agentHandoff: z.object({
    prompt: z
      .string()
      .describe("A prompt the developer can paste into their coding agent to do the automatable work"),
    artifacts: z.array(
      z.object({
        title: z.string(),
        language: z.string(),
        content: z.string(),
      }),
    ),
  }),
  nextAction: z.string().describe("The one thing the developer should do right now"),
});
export type GuideContent = z.infer<typeof GuideContent>;

export const Source = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  kind: z.enum(["official", "community", "probe", "other"]),
});
export type Source = z.infer<typeof Source>;

export const Probe = z.object({
  id: z.string(),
  kind: z.enum(["discovery", "authorize", "token", "page"]),
  target: z.string(),
  ok: z.boolean(),
  status: z.number().nullable(),
  observed: z.string(),
  at: z.string(),
});
export type Probe = z.infer<typeof Probe>;

export const Guide = GuideContent.extend({
  schemaVersion: z.literal(1),
  slug: z.string(),
  origin: z.object({
    kind: z.enum(["curated", "live"]),
    generatedAt: z.string(),
    model: z.string().nullable(),
    durationMs: z.number().nullable(),
    note: z.string().nullable(),
  }),
  sources: z.array(Source),
  probes: z.array(Probe),
  // What verification changed: claims the agent (or curator) corrected or downgraded.
  corrections: z
    .array(
      z.object({
        what: z.string(),
        before: z.string(),
        after: z.string(),
        how: z.string(),
      }),
    )
    .default([]),
});
export type Guide = z.infer<typeof Guide>;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\.(com|io|so|app|ai|dev|co|org|net)(\/.*)?$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
