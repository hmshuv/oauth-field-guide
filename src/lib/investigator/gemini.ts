import { createHash } from "node:crypto";
import { GoogleGenAI, ThinkingLevel, type GenerateContentResponse } from "@google/genai";

export const DEFAULT_MODEL = "gemini-3.8-flash";
// Tried in order when the configured model is overloaded (5xx) after retries.
export const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3-flash-preview")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export type Usage = { calls: number; inputTokens: number; outputTokens: number; searchQueries: number };

export type GroundedResult = {
  text: string;
  chunks: { uri: string; title: string; domain?: string }[];
  supports: { text: string; chunkIndices: number[] }[];
  queries: string[];
};

export interface LLM {
  model: string;
  preflight(): Promise<void>;
  grounded(prompt: string, opts: { system: string; urls?: string[]; label: string }): Promise<GroundedResult>;
  structured(prompt: string, opts: { system: string; schema: unknown; label: string }): Promise<string>;
  // Plain generation over material we supply (no web search); urls are read with URL context if given.
  read(prompt: string, opts: { system: string; urls?: string[]; label: string }): Promise<string>;
  usage: Usage;
  onFallback?: (model: string) => void;
}

export class LLMError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "quota" | "model_quota" | "billing" | "model" | "timeout" | "overloaded" | "other",
  ) {
    super(message);
  }
}

function classify(e: unknown): LLMError {
  const msg = e instanceof Error ? e.message : String(e);
  const status = (e as { status?: number })?.status;
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
    return new LLMError("The model call timed out.", "timeout");
  }
  if (status === 401 || status === 403 || /API key not valid|PERMISSION_DENIED|API_KEY_INVALID/i.test(msg)) {
    return new LLMError("The Gemini API key was rejected. Check GEMINI_API_KEY or the key you entered.", "auth");
  }
  // Free-tier keys get a small daily request quota per model; another model may still have room.
  const quotaId = msg.match(/"quotaId":\s*"([^"]+)"/)?.[1];
  if (quotaId && /PerModel/i.test(quotaId)) {
    return new LLMError(`Daily quota for this model is used up (${quotaId}).`, "model_quota");
  }
  if (/check your plan and billing/i.test(msg)) {
    return new LLMError(
      "This Gemini key has no quota for this request (Google: \"check your plan and billing\"). Google Search grounding needs a billing-enabled project.",
      "billing",
    );
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    return new LLMError("Gemini rate limit reached. Try again in a minute or use another key.", "quota");
  }
  if (status === 404 || /not found|is not supported/i.test(msg)) {
    return new LLMError(`Model not available for this key: ${msg.slice(0, 200)}`, "model");
  }
  return new LLMError(msg.slice(0, 300), "other");
}

const groundingBlocked = new Map<string, number>();

export class GeminiLLM implements LLM {
  private ai: GoogleGenAI;
  private keyId: string;
  usage: Usage = { calls: 0, inputTokens: 0, outputTokens: 0, searchQueries: 0 };
  onFallback?: (model: string) => void;

  constructor(
    apiKey: string,
    readonly model: string = process.env.GEMINI_MODEL || DEFAULT_MODEL,
    private readonly synthesisModel: string = process.env.GEMINI_SYNTHESIS_MODEL || model,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.keyId = createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
  }

  // Metadata lookup only: validates the key and model without spending tokens.
  async preflight() {
    try {
      await this.ai.models.get({ model: this.model, config: { abortSignal: AbortSignal.timeout(15_000) } });
      if (this.synthesisModel !== this.model) {
        await this.ai.models.get({ model: this.synthesisModel, config: { abortSignal: AbortSignal.timeout(15_000) } });
      }
    } catch (e) {
      throw classify(e);
    }
  }

  private async call(
    model: string,
    contents: string,
    initialConfig: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<GenerateContentResponse> {
    let config = initialConfig;
    let lastError: LLMError | null = null;
    // Overloaded (5xx) calls aren't billed, so walk a short model chain with backoff before giving up.
    const chain = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
    for (const [i, current] of chain.entries()) {
      if (i > 0) this.onFallback?.(current);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await this.ai.models.generateContent({
            model: current,
            contents,
            config: { ...config, abortSignal: AbortSignal.timeout(timeoutMs) },
          });
          this.usage.calls++;
          this.usage.inputTokens += res.usageMetadata?.promptTokenCount ?? 0;
          this.usage.outputTokens +=
            (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0);
          return res;
        } catch (e) {
          const err = classify(e);
          const status = (e as { status?: number })?.status;
          lastError = err;
          // Rejected requests are not billed: if a model doesn't support a setting, drop it and retry.
          if (/thinking/i.test(err.message) && config.thinkingConfig) {
            config = { ...config, thinkingConfig: undefined };
            continue;
          }
          if (/url_?context/i.test(err.message) && Array.isArray(config.tools)) {
            config = { ...config, tools: (config.tools as object[]).filter((t) => !("urlContext" in t)) };
            continue;
          }
          if (err.kind === "model_quota") break; // this model is done for today — try the next one
          if (status !== undefined && status >= 500) {
            if (attempt < 2) await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
            continue;
          }
          // Rate limits get one short wait; auth, billing and model errors fail fast so nothing is wasted.
          if (err.kind === "quota" && attempt === 0) {
            await new Promise((r) => setTimeout(r, 5000));
            continue;
          }
          throw err;
        }
      }
    }
    if (lastError?.kind === "model_quota") {
      throw new LLMError(
        `Every model in the chain (${chain.join(", ")}) has used up this key's daily free quota. Try tomorrow, enable billing, or paste another key in Settings.`,
        "quota",
      );
    }
    throw new LLMError(
      `All Gemini models tried (${chain.join(", ")}) are overloaded right now. Wait a minute and press Retry. ${lastError ? `(${lastError.message.slice(0, 120)})` : ""}`,
      "overloaded",
    );
  }

  async grounded(prompt: string, opts: { system: string; urls?: string[]; label: string }): Promise<GroundedResult> {
    // Don't spend a request re-discovering that this key can't use Search grounding.
    if ((groundingBlocked.get(this.keyId) ?? 0) > Date.now()) {
      throw new LLMError("Google Search grounding is unavailable on this key (cached).", "billing");
    }
    try {
      return await this.groundedCall(prompt, opts);
    } catch (e) {
      if (e instanceof LLMError && e.kind === "billing") groundingBlocked.set(this.keyId, Date.now() + 3600_000);
      throw e;
    }
  }

  private async groundedCall(prompt: string, opts: { system: string; urls?: string[]; label: string }): Promise<GroundedResult> {
    const contents = opts.urls?.length
      ? `${prompt}\n\nRead these pages if they are relevant:\n${opts.urls.join("\n")}`
      : prompt;
    const res = await this.call(
      this.model,
      contents,
      {
        systemInstruction: opts.system,
        tools: opts.urls?.length ? [{ googleSearch: {} }, { urlContext: {} }] : [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        maxOutputTokens: 6000,
        temperature: 0.2,
      },
      120_000,
    );
    const meta = res.candidates?.[0]?.groundingMetadata;
    const queries = meta?.webSearchQueries ?? [];
    this.usage.searchQueries += queries.length;
    return {
      text: res.text ?? "",
      chunks: (meta?.groundingChunks ?? [])
        .map((c) => ({ uri: c.web?.uri ?? "", title: c.web?.title ?? c.web?.domain ?? "", domain: c.web?.domain }))
        .filter((c) => c.uri),
      supports: (meta?.groundingSupports ?? []).map((s) => ({
        text: s.segment?.text ?? "",
        chunkIndices: s.groundingChunkIndices ?? [],
      })),
      queries,
    };
  }

  async read(prompt: string, opts: { system: string; urls?: string[]; label: string }): Promise<string> {
    const res = await this.call(
      this.model,
      opts.urls?.length ? `${prompt}\n\nAlso read these pages:\n${opts.urls.join("\n")}` : prompt,
      {
        systemInstruction: opts.system,
        ...(opts.urls?.length ? { tools: [{ urlContext: {} }] } : {}),
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        maxOutputTokens: 8000,
        temperature: 0.2,
      },
      150_000,
    );
    return res.text ?? "";
  }

  async structured(prompt: string, opts: { system: string; schema: unknown; label: string }): Promise<string> {
    const res = await this.call(
      this.synthesisModel,
      prompt,
      {
        systemInstruction: opts.system,
        responseMimeType: "application/json",
        responseJsonSchema: opts.schema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        maxOutputTokens: 24_000,
        temperature: 0.2,
      },
      180_000,
    );
    const text = res.text ?? "";
    if (!text) throw new LLMError("The model returned an empty response.", "other");
    return text;
  }
}

export function resolveApiKey(headerKey: string | null): { key: string | null; source: "user" | "server" | null } {
  if (headerKey && headerKey.trim().length > 20) return { key: headerKey.trim(), source: "user" };
  if (process.env.GEMINI_API_KEY) return { key: process.env.GEMINI_API_KEY, source: "server" };
  return { key: null, source: null };
}
