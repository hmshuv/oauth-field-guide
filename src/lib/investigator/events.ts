// Stage list and stream event types, shared by the server pipeline and the browser UI.
import type { Guide, Probe, Source } from "../guide/schema";
import type { Usage } from "./gemini";

export const STAGES = [
  { key: "preflight", label: "Checking API key & model" },
  { key: "identify", label: "Identifying the app" },
  { key: "research", label: "Researching docs, reviews & field reports" },
  { key: "sources", label: "Resolving & classifying sources" },
  { key: "synthesize", label: "Writing the structured guide" },
  { key: "verify", label: "Probing live endpoints & grading evidence" },
  { key: "save", label: "Publishing the guide" },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];

export type InvestigateEvent =
  | { type: "stage"; stage: StageKey; status: "start" | "done" | "skipped"; detail?: string }
  | { type: "log"; stage: StageKey; message: string }
  | { type: "source"; source: Source }
  | { type: "probe"; probe: Probe }
  | { type: "usage"; usage: Usage }
  | { type: "done"; slug: string; cached: boolean; library: boolean; guide?: Guide }
  | { type: "error"; message: string; kind: string; stage?: StageKey };
