import { z } from "zod";
import { Guide, GuideContent, slugify, type Source } from "../guide/schema";
import {
  findInLibrary,
  getGenerated,
  loadCheckpoint,
  saveCheckpoint,
  saveGenerated,
} from "../store";
import { LLMError, type GroundedResult, type LLM } from "./gemini";
import {
  identifyPrompt,
  repairPrompt,
  RESEARCH_BRIEFS,
  RESEARCH_SYSTEM,
  SYNTHESIS_SYSTEM,
  synthesisPrompt,
  type Identity,
} from "./prompts";
import { probeAndVerify } from "./verify";
import type { InvestigateEvent, StageKey } from "./events";

export { STAGES, type InvestigateEvent, type StageKey } from "./events";

type Emit = (e: InvestigateEvent) => void;

type Checkpoint = {
  identity: Identity;
  sources: Source[];
  notes: { label: string; text: string }[];
};

const CACHE_MS = 14 * 24 * 3600 * 1000;
const CHECKPOINT_MS = 24 * 3600 * 1000;
const COMMUNITY_HOSTS = /(stackoverflow|stackexchange|reddit|medium|dev\.to|hashnode|substack|quora|youtube|github\.com|gist\.github|news\.ycombinator|community\.|forum\.|discuss\.)/i;

export async function investigate(
  query: string,
  llm: LLM,
  emit: Emit,
  opts: { force?: boolean } = {},
): Promise<void> {
  const started = Date.now();
  const querySlug = slugify(query);
  let stage: StageKey = "preflight";
  const begin = (s: StageKey, detail?: string) => {
    stage = s;
    emit({ type: "stage", stage: s, status: "start", detail });
  };
  const done = (s: StageKey, detail?: string) => emit({ type: "stage", stage: s, status: "done", detail });
  const log = (message: string) => emit({ type: "log", stage, message });

  try {
    // Free short-circuits first: curated library and previously generated guides cost no tokens.
    const curated = findInLibrary(query);
    if (curated) {
      emit({ type: "done", slug: curated.slug, cached: true, library: true });
      return;
    }
    if (!opts.force) {
      const cached = await getGenerated(querySlug);
      if (cached && Date.now() - cached.savedAt.getTime() < CACHE_MS) {
        emit({ type: "done", slug: cached.guide.slug, cached: true, library: false, guide: cached.guide });
        return;
      }
    }

    begin("preflight");
    await llm.preflight();
    done("preflight", `Key accepted · model ${llm.model}`);

    let checkpoint = opts.force ? null : await loadCheckpoint<Checkpoint>(querySlug, CHECKPOINT_MS);
    if (checkpoint) {
      for (const s of ["identify", "research", "sources"] as const) {
        emit({ type: "stage", stage: s, status: "skipped", detail: "Reused research from an unfinished earlier run (no tokens spent)" });
      }
      checkpoint.sources.forEach((source) => emit({ type: "source", source }));
    } else {
      begin("identify");
      const identity = await identify(query, llm);
      done("identify", `${identity.appName} · ${identity.category} · OAuth: ${identity.offersOAuth}`);
      if (identity.ambiguous && identity.alternatives.length) {
        log(`"${query}" is ambiguous — assuming ${identity.appName} (could also be: ${identity.alternatives.join(", ")})`);
      }
      const curatedMatch = findInLibrary(identity.appName);
      if (curatedMatch) {
        emit({ type: "done", slug: curatedMatch.slug, cached: true, library: true });
        return;
      }

      begin("research");
      log(`Use case assumed: ${identity.assumedUseCase}`);
      const results = await Promise.all(
        RESEARCH_BRIEFS.map(async (brief) => {
          const urls = brief.key === "mechanics" && /^https:\/\//.test(identity.developerDocsUrl) ? [identity.developerDocsUrl] : [];
          const r = await llm.grounded(brief.prompt(identity), { system: RESEARCH_SYSTEM, urls, label: brief.key });
          log(`${brief.label}: ${r.queries.length} searches, ${r.chunks.length} sources${r.queries.length ? ` — e.g. “${r.queries[0]}”` : ""}`);
          return { brief, result: r };
        }),
      );
      done("research", `${results.reduce((n, r) => n + r.result.queries.length, 0)} searches across ${results.length} research tracks`);
      emit({ type: "usage", usage: { ...llm.usage } });

      begin("sources");
      const { sources, notes } = await buildSources(identity, results, (s) => emit({ type: "source", source: s }));
      const official = sources.filter((s) => s.kind === "official").length;
      done("sources", `${sources.length} sources · ${official} official`);
      if (!official) log("No official sources were found — the guide will lean on community reports and uncertainty.");

      checkpoint = { identity, sources, notes };
      await saveCheckpoint(querySlug, checkpoint).catch(() => {});
    }

    begin("synthesize");
    const content = await synthesize(checkpoint, llm, log);
    done("synthesize", `${content.steps.length} steps · ${content.gotchas.length} gotchas`);
    emit({ type: "usage", usage: { ...llm.usage } });

    begin("verify");
    const { content: graded, downgraded } = enforceEvidence(content, checkpoint.sources);
    const slug = slugify(checkpoint.identity.appName) || querySlug;
    let guide: Guide = Guide.parse({
      ...graded,
      schemaVersion: 1,
      slug,
      origin: {
        kind: "live",
        generatedAt: new Date().toISOString(),
        model: llm.model,
        durationMs: null,
        note: `Investigated live by the agent from ${checkpoint.sources.length} web sources.`,
      },
      sources: checkpoint.sources,
      probes: [],
      corrections: downgraded.length
        ? [
            {
              what: `${downgraded.length} claim${downgraded.length > 1 ? "s" : ""} downgraded`,
              before: "Labelled by the model as better-supported",
              after: downgraded.slice(0, 6).join("; ") + (downgraded.length > 6 ? " …" : ""),
              how: "Evidence check: citations were missing, not official, or the model claimed a test it cannot run.",
            },
          ]
        : [],
    });
    guide = await probeAndVerify(guide, (probe) => {
      emit({ type: "probe", probe });
      log(`${probe.ok ? "✓" : "⚠"} ${probe.kind} ${hostOf(probe.target)} — ${probe.observed}`);
    });
    const tested = guide.probes.filter((p) => p.ok).length;
    done("verify", `${tested}/${guide.probes.length} probes confirmed · ${guide.corrections.length} corrections`);

    begin("save");
    guide.origin.durationMs = Date.now() - started;
    await saveGenerated(guide).catch((e) => log(`Could not persist guide on this server: ${String(e)}`));
    done("save", `/guides/${slug}`);
    emit({ type: "usage", usage: { ...llm.usage } });
    emit({ type: "done", slug, cached: false, library: false, guide });
  } catch (e) {
    const err = e instanceof LLMError ? e : new LLMError(e instanceof Error ? e.message : String(e), "other");
    emit({ type: "usage", usage: { ...llm.usage } });
    emit({ type: "error", message: err.message, kind: err.kind, stage });
  }
}

async function identify(query: string, llm: LLM): Promise<Identity> {
  const r = await llm.grounded(identifyPrompt(query), { system: RESEARCH_SYSTEM, label: "identify" });
  const parsed = parseJsonLoose(r.text) as Partial<Identity> | null;
  if (!parsed?.appName) throw new LLMError("Could not identify the app from that name or URL.", "other");
  const website = parsed.website || (query.startsWith("http") ? query : "");
  const domains = new Set((parsed.officialDomains ?? []).map((d) => d.replace(/^www\./, "").toLowerCase()));
  for (const u of [website, parsed.developerDocsUrl]) {
    const h = hostOf(u ?? "");
    if (h) domains.add(registrable(h));
  }
  return {
    appName: parsed.appName,
    website,
    officialDomains: [...domains].filter(Boolean),
    developerDocsUrl: parsed.developerDocsUrl || website,
    category: parsed.category || "Unknown",
    offersOAuth: parsed.offersOAuth ?? "unclear",
    oauthNotes: parsed.oauthNotes || "",
    assumedUseCase: parsed.assumedUseCase || `AI agent acts on the user's ${parsed.appName} data`,
    ambiguous: !!parsed.ambiguous,
    alternatives: parsed.alternatives ?? [],
  };
}

export function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Grounding chunks come back as Google redirect links; resolve them so guides cite real URLs.
async function resolveRedirect(uri: string): Promise<string> {
  if (!/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect/.test(uri)) return uri;
  try {
    const res = await fetch(uri, { redirect: "manual", signal: AbortSignal.timeout(5000) });
    return res.headers.get("location") || uri;
  } catch {
    return uri;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

async function buildSources(
  identity: Identity,
  results: { brief: (typeof RESEARCH_BRIEFS)[number]; result: GroundedResult }[],
  onSource: (s: Source) => void,
) {
  const unique = [...new Set(results.flatMap((r) => r.result.chunks.map((c) => c.uri)))];
  const resolved = new Map<string, string>();
  await mapLimit(unique, 8, async (uri) => resolved.set(uri, await resolveRedirect(uri)));

  const sources: Source[] = [];
  const idByUrl = new Map<string, string>();
  const sourceId = (uri: string, title: string) => {
    const url = resolved.get(uri) ?? uri;
    const key = url.replace(/#.*$/, "").replace(/\/+$/, "");
    let id = idByUrl.get(key);
    if (!id) {
      id = `S${sources.length + 1}`;
      idByUrl.set(key, id);
      const host = hostOf(url);
      const official = identity.officialDomains.some((d) => host === d || host.endsWith(`.${d}`));
      const source: Source = {
        id,
        title: title && title !== host ? title : host || url,
        url,
        kind: official ? "official" : COMMUNITY_HOSTS.test(url) ? "community" : "other",
      };
      sources.push(source);
      onSource(source);
    }
    return id;
  };

  const notes = results.map(({ brief, result }) => {
    const ids = result.chunks.map((c) => sourceId(c.uri, c.title));
    let text = result.text;
    // Insert [S#] markers after each supported segment so the synthesizer can cite precisely.
    const inserts: { at: number; marker: string }[] = [];
    let cursor = 0;
    for (const s of result.supports) {
      if (!s.text) continue;
      const pos = text.indexOf(s.text, Math.max(0, cursor - 200));
      if (pos === -1) continue;
      const marker = [...new Set(s.chunkIndices.map((i) => ids[i]).filter(Boolean))].map((x) => `[${x}]`).join("");
      if (marker) inserts.push({ at: pos + s.text.length, marker });
      cursor = pos + s.text.length;
    }
    for (const ins of inserts.sort((a, b) => b.at - a.at)) {
      text = `${text.slice(0, ins.at)} ${ins.marker}${text.slice(ins.at)}`;
    }
    if (!inserts.length && ids.length) text += `\n\n(Sources consulted for this track: ${[...new Set(ids)].map((x) => `[${x}]`).join("")})`;
    return { label: brief.label, text };
  });
  return { sources, notes };
}

export function geminiSchema(): unknown {
  const schema = z.toJSONSchema(GuideContent) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

async function synthesize(cp: Checkpoint, llm: LLM, log: (m: string) => void): Promise<GuideContent> {
  const prompt = synthesisPrompt(cp.identity, cp.sources, cp.notes);
  let raw: string;
  try {
    raw = await llm.structured(prompt, { system: SYNTHESIS_SYSTEM, schema: geminiSchema(), label: "synthesize" });
  } catch (e) {
    // If the API rejects the response schema itself, fall back to JSON mode + client-side validation.
    if (e instanceof LLMError && e.kind === "other" && /schema|INVALID_ARGUMENT/i.test(e.message)) {
      log("Structured-output schema rejected by the API; retrying in plain JSON mode.");
      raw = await llm.structured(
        `${prompt}\n\nReturn JSON matching this JSON Schema:\n${JSON.stringify(geminiSchema())}`,
        { system: SYNTHESIS_SYSTEM, schema: undefined, label: "synthesize-fallback" },
      );
    } else throw e;
  }
  let parsed = GuideContent.safeParse(parseJsonLoose(raw));
  if (parsed.success) return parsed.data;

  log("Guide JSON had validation errors; asking the model to repair them (research is not repeated).");
  const errors = parsed.error.issues.slice(0, 25).map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  const repaired = await llm.structured(repairPrompt(raw, errors), {
    system: SYNTHESIS_SYSTEM,
    schema: geminiSchema(),
    label: "repair",
  });
  parsed = GuideContent.safeParse(parseJsonLoose(repaired));
  if (parsed.success) return parsed.data;
  throw new LLMError(
    `The model's guide failed validation after one repair: ${parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")}. Retrying will reuse the saved research.`,
    "other",
  );
}

// Code, not the model, has the final say on evidence labels.
export function enforceEvidence(content: GuideContent, sources: Source[]) {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const downgraded: string[] = [];
  const fix = (label: string, e: GuideContent["steps"][number]["evidence"]) => {
    const valid = e.sources.filter((id) => byId.has(id));
    const hasOfficial = valid.some((id) => byId.get(id)!.kind === "official");
    const before = e.status;
    e.sources = valid;
    if (e.status === "tested") e.status = hasOfficial ? "source" : valid.length ? "community" : "uncertain";
    if (e.status === "source" && !hasOfficial) e.status = valid.length ? "community" : "uncertain";
    if (e.status === "community" && !valid.length) e.status = "uncertain";
    if (e.status !== before) {
      downgraded.push(`${label}: ${before} → ${e.status}`);
      e.note = [e.note, `Downgraded from "${before}" by evidence check.`].filter(Boolean).join(" ");
    }
  };
  const c = structuredClone(content);
  c.classification.flags.forEach((f) => fix(`flag ${f.id}`, f.evidence));
  fix("first-token estimate", c.effort.firstToken.evidence);
  fix("production estimate", c.effort.production.evidence);
  c.quickRef.facts.forEach((f) => fix(`fact "${f.label}"`, f.evidence));
  c.scopes.forEach((s) => fix(`scope ${s.scope}`, s.evidence));
  c.prerequisites.forEach((p) => fix(`prerequisite "${p.item}"`, p.evidence));
  c.steps.forEach((s) => {
    fix(`step "${s.title}"`, s.evidence);
    if (s.url && !/^https?:\/\//.test(s.url)) s.url = null;
  });
  c.gotchas.forEach((g) => fix(`gotcha "${g.title}"`, g.evidence));
  return { content: c, downgraded };
}

function hostOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function registrable(host: string): string {
  const parts = host.split(".");
  return parts.length > 2 && !/^(co|com|org|net)$/.test(parts[parts.length - 2]) ? parts.slice(-2).join(".") : host;
}
