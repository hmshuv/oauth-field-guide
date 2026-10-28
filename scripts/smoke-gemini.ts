/* eslint-disable @typescript-eslint/no-explicit-any -- test harness pokes at SDK internals and untyped events */
// Offline smoke test for the real GeminiLLM adapter + full pipeline, without an API key or tokens.
// Swaps the SDK transport for canned responses shaped exactly like @google/genai's
// GenerateContentResponse (candidates, groundingMetadata, usageMetadata) and asserts on the
// request configs we send. Run: npm run smoke
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { GenerateContentResponse } from "@google/genai";

process.env.GUIDES_DIR = mkdtempSync(path.join(tmpdir(), "oauth-guides-smoke-"));

type Req = { model: string; contents: string; config: Record<string, any> };

function response(text: string, grounding?: object): GenerateContentResponse {
  return Object.assign(new GenerateContentResponse(), {
    candidates: [{ content: { role: "model", parts: [{ text }] }, groundingMetadata: grounding }],
    usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 400, thoughtsTokenCount: 100 },
  });
}

// A name outside the curated library, so the pipeline runs every stage instead of redirecting.
const identity = {
  appName: "Notion Smoke",
  website: "https://www.notion.com",
  officialDomains: ["notion.com"],
  developerDocsUrl: "https://developers.notion.com/guides/get-started/authorization",
  category: "Docs",
  offersOAuth: "yes",
  oauthNotes: "OAuth 2.0 public connections",
  assumedUseCase: "AI agent reads and writes pages",
  ambiguous: false,
  alternatives: [],
};

// Reuse a curated guide's content as the "model output", re-pointing citations at S1/S2.
const curated = JSON.parse(readFileSync("data/library/notion.json", "utf8"));
for (const k of ["schemaVersion", "slug", "origin", "sources", "probes", "corrections"]) delete curated[k];
const synthesized = JSON.stringify(curated, (key, value) =>
  key === "evidence" ? { ...value, status: value.status === "tested" ? "tested" : value.status, sources: ["S1", "S2"] } : value,
);

const requests: Req[] = [];
async function fakeGenerate(req: Req) {
  requests.push(req);
  if (req.config.responseMimeType === "application/json") return response(synthesized);
  if (req.contents.includes("A developer typed")) return response("```json\n" + JSON.stringify(identity) + "\n```", { webSearchQueries: ["notion oauth"] });
  if (req.contents.includes("VERDICT: OAUTH_AVAILABLE")) {
    return response("VERDICT: NO_OAUTH\n- Only personal API keys are documented.", {
      webSearchQueries: ["notion smoke oauth"],
      groundingChunks: [{ web: { uri: "https://developers.notion.com/reference/intro", title: "developers.notion.com" } }],
      groundingSupports: [{ segment: { text: "Only personal API keys are documented." }, groundingChunkIndices: [0] }],
    });
  }
  const text = "- Public connections use OAuth 2.0 with refresh tokens.\n- Developers report the page picker confuses users.";
  return response(text, {
    webSearchQueries: ["notion oauth public connection", "notion refresh token"],
    groundingChunks: [
      { web: { uri: "https://developers.notion.com/guides/get-started/authorization", title: "developers.notion.com" } },
      { web: { uri: "https://www.reddit.com/r/Notion/comments/x/oauth", title: "reddit.com" } },
    ],
    groundingSupports: [
      { segment: { startIndex: 2, endIndex: 58, text: "Public connections use OAuth 2.0 with refresh tokens." }, groundingChunkIndices: [0] },
      { segment: { text: "Developers report the page picker confuses users." }, groundingChunkIndices: [1] },
    ],
  });
}

async function main() {
  const { GeminiLLM } = await import("../src/lib/investigator/gemini");
  const { investigate } = await import("../src/lib/investigator/pipeline");
  const llm = new GeminiLLM("fake-key-for-offline-smoke-test-000000");
  (llm as any).ai = { models: { get: async () => ({ name: "models/x" }), generateContent: fakeGenerate } };

  const events: any[] = [];
  await investigate("notion-smoke-test", llm, (e) => events.push(e), { force: true });

  const fail = (m: string) => {
    console.error("✗", m);
    process.exitCode = 1;
  };
  const err = events.find((e) => e.type === "error");
  if (err) fail(`pipeline error: ${err.message}`);
  const done = events.find((e) => e.type === "done");
  if (!done) fail("no done event");
  else console.log(`✓ done: slug=${done.slug} library=${done.library}`);

  const grounded = requests.filter((r) => r.config.tools);
  const structured = requests.filter((r) => r.config.responseMimeType === "application/json");
  if (!grounded.every((r) => r.config.tools.some((t: object) => "googleSearch" in t))) fail("grounded calls missing googleSearch tool");
  if (!grounded.some((r) => r.config.tools.some((t: object) => "urlContext" in t))) fail("mechanics track missing urlContext");
  if (!grounded.every((r) => r.config.thinkingConfig?.thinkingLevel)) fail("grounded calls missing thinkingLevel");
  console.log(`✓ ${grounded.length} grounded calls with googleSearch (+urlContext on mechanics), ${structured.length} structured`);
  console.log(`✓ usage tracked: ${JSON.stringify(llm.usage)}`);
  return { events, structured };
}

// Second scenario: identify is unsure OAuth exists and the availability check says no — only that one
// research call should run, and synthesis must be told it's in limited mode.
async function limited() {
  requests.length = 0;
  Object.assign(identity, { appName: "Notion Smoke NoOAuth", offersOAuth: "unclear" });
  const { GeminiLLM } = await import("../src/lib/investigator/gemini");
  const { investigate } = await import("../src/lib/investigator/pipeline");
  const llm = new GeminiLLM("fake-key-for-offline-smoke-test-000000");
  (llm as any).ai = { models: { get: async () => ({ name: "models/x" }), generateContent: fakeGenerate } };
  const events: any[] = [];
  await investigate("notion-smoke-nooauth", llm, (e) => events.push(e), { force: true });
  const research = requests.filter((r) => r.config.tools && !r.contents.includes("A developer typed"));
  const synth = requests.find((r) => r.config.responseMimeType === "application/json");
  const err = events.find((e) => e.type === "error");
  if (err) console.error("✗ limited: pipeline error", err.message);
  if (research.length !== 1) console.error(`✗ limited: expected 1 research call, got ${research.length}`);
  else console.log("✓ limited: availability check only (3 research calls skipped)");
  if (!synth?.contents.includes("LIMITED RESEARCH MODE")) console.error("✗ limited: synthesis not told about limited mode");
  else console.log("✓ limited: synthesis prompt in limited mode");
  if (err || research.length !== 1 || !synth?.contents.includes("LIMITED RESEARCH MODE")) process.exitCode = 1;
  const g = events.find((e) => e.type === "done")?.guide;
  if (g) console.log(`  origin note: ${g.origin.note}`);
}

async function run() {
  await full();
  await limited();
}

async function full() {
  const { events, structured } = await main();
  const done = events.find((e) => e.type === "done");
  if (!structured.length) {
    console.error("✗ synthesis was never called");
    process.exitCode = 1;
  } else if (!structured[0].config.responseJsonSchema) {
    console.error("✗ synthesis call missing responseJsonSchema");
    process.exitCode = 1;
  } else console.log("✓ synthesis used responseJsonSchema");
  const g = done?.guide;
  if (g) {
    const official = g.sources.filter((s: any) => s.kind === "official").length;
    console.log(`✓ guide: ${g.steps.length} steps, ${g.sources.length} sources (${official} official), ${g.probes.length} probes, corrections: ${g.corrections.map((c: any) => c.what).join("; ") || "none"}`);
    const notes = events.filter((e) => e.type === "source").map((e) => `${e.source.id}=${e.source.kind}`);
    console.log(`  sources: ${notes.join(", ")}`);
  }
}

run();
