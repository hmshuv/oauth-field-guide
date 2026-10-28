import { GeminiLLM, resolveApiKey, type LLM } from "@/lib/investigator/gemini";
import { MockLLM } from "@/lib/investigator/mock";
import type { InvestigateEvent } from "@/lib/investigator/events";
import { investigate } from "@/lib/investigator/pipeline";
import { slugify } from "@/lib/guide/schema";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Only the server's own key is rate limited; visitors who bring their own key pay for their own runs.
const LIMIT_PER_HOUR = Number(process.env.INVESTIGATE_LIMIT_PER_HOUR || 6);
const hits = new Map<string, number[]>();
const inFlight = new Set<string>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= LIMIT_PER_HOUR) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { query?: string; force?: boolean };
  const query = (body.query ?? "").trim().slice(0, 200);
  if (!query || !slugify(query)) return Response.json({ error: "Enter an app name or website." }, { status: 400 });

  const mock = process.env.INVESTIGATOR_MOCK === "1";
  const { key, source } = resolveApiKey(req.headers.get("x-gemini-key"));
  if (!mock && !key) {
    return Response.json(
      { error: "No Gemini API key configured. Add GEMINI_API_KEY to .env.local, or paste your own key in Settings.", kind: "auth" },
      { status: 401 },
    );
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!mock && source === "server" && rateLimited(ip)) {
    return Response.json(
      { error: `Rate limit: ${LIMIT_PER_HOUR} live investigations per hour on the shared key. Paste your own Gemini key in Settings to continue.`, kind: "quota" },
      { status: 429 },
    );
  }
  const lock = slugify(query);
  if (inFlight.has(lock)) {
    return Response.json({ error: "This app is already being investigated — wait for that run to finish." }, { status: 409 });
  }

  const llm: LLM = mock ? new MockLLM() : new GeminiLLM(key!);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      inFlight.add(lock);
      const send = (e: InvestigateEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await investigate(query, llm, send, { force: !!body.force });
      } finally {
        inFlight.delete(lock);
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
