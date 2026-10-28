// Offline stand-in for Gemini, enabled with INVESTIGATOR_MOCK=1. Queries containing "nooauth"
// simulate an app without public OAuth, exercising the short "limited" path. It exercises the full pipeline
// (streaming, source resolution, schema validation, evidence enforcement, real endpoint probes)
// without spending tokens. Its guide content is canned and clearly labelled as a mock run.
import type { GuideContent } from "../guide/schema";
import type { GroundedResult, LLM, Usage } from "./gemini";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockLLM implements LLM {
  model = "mock (no API calls)";
  usage: Usage = { calls: 0, inputTokens: 0, outputTokens: 0, searchQueries: 0 };
  private name = "Linear";
  private noOAuth = false;

  async preflight() {
    await wait(200);
  }

  async grounded(prompt: string, opts: { label: string }): Promise<GroundedResult> {
    await wait(600 + Math.random() * 900);
    this.usage.calls++;
    if (opts.label === "identify") {
      const q = prompt.match(/typed: "([^"]+)"/)?.[1] ?? "Linear";
      this.noOAuth = /nooauth/i.test(q);
      this.name = q.replace(/^https?:\/\//, "").replace(/\..*$/, "");
      this.name = this.name.charAt(0).toUpperCase() + this.name.slice(1);
      return {
        text: JSON.stringify({
          appName: this.name,
          website: "https://linear.app",
          officialDomains: ["linear.app"],
          developerDocsUrl: "https://linear.app/developers/oauth-2-0-authentication",
          category: "Project management",
          offersOAuth: this.noOAuth ? "unclear" : "yes",
          oauthNotes: this.noOAuth ? "Only API keys are mentioned." : "OAuth 2.0 authorization code flow for third-party apps.",
          assumedUseCase: "AI agent reads and creates issues on the user's behalf",
          ambiguous: false,
          alternatives: [],
        }),
        chunks: [],
        supports: [],
        queries: [`${this.name} OAuth app`],
      };
    }
    if (opts.label === "availability") {
      return {
        text: "VERDICT: NO_OAUTH\n- MOCK NOTE: Only personal API keys are documented.",
        chunks: [{ uri: "https://linear.app/developers", title: "Linear Developers" }],
        supports: [{ text: "Only personal API keys are documented.", chunkIndices: [0] }],
        queries: [`${this.name} oauth availability`],
      };
    }
    const text = `- MOCK NOTE: OAuth apps are created in workspace settings under API.\n- MOCK NOTE: Developers report the actor=app mode is useful for agents.`;
    return {
      text,
      chunks: [
        { uri: "https://linear.app/developers/oauth-2-0-authentication", title: "OAuth 2.0 authentication – Linear Developers" },
        { uri: "https://stackoverflow.com/questions/tagged/linear-app", title: "stackoverflow.com" },
      ],
      supports: [
        { text: "OAuth apps are created in workspace settings under API.", chunkIndices: [0] },
        { text: "Developers report the actor=app mode is useful for agents.", chunkIndices: [1] },
      ],
      queries: [`${this.name} ${opts.label} oauth`],
    };
  }

  async structured(): Promise<string> {
    await wait(1200);
    this.usage.calls++;
    const content: GuideContent = {
      appName: this.name,
      website: "https://linear.app",
      category: "Project management",
      assumedUseCase: "AI agent reads and creates issues on the user's behalf",
      tldr: "MOCK RUN — canned content used to test the pipeline without an API key. Do not rely on it.",
      classification: {
        archetype: this.noOAuth ? "no_public_oauth" : "instant_self_serve",
        rationale: "Mock rationale.",
        flags: [
          {
            id: "redirect_uri_restrictions",
            detail: "Mock flag citing an official source.",
            evidence: { status: "source", sources: ["S1"] },
          },
          {
            id: "token_lifecycle_gotchas",
            detail: "Mock flag the model over-claimed as tested; the evidence check must downgrade it.",
            evidence: { status: "tested", sources: ["S2"] },
          },
        ],
      },
      effort: {
        firstToken: {
          activeMinutes: { min: 10, max: 20 },
          waitDays: { min: 0, max: 0 },
          conditions: "Mock conditions.",
          evidence: { status: "source", sources: ["S1"] },
        },
        production: {
          activeMinutes: { min: 30, max: 60 },
          waitDays: { min: 0, max: 0 },
          conditions: "Mock conditions.",
          evidence: { status: "source", sources: ["S9"] },
        },
      },
      quickRef: {
        consoleUrl: "https://linear.app/settings/api/applications/new",
        docsUrl: "https://linear.app/developers/oauth-2-0-authentication",
        authorizeUrl: "https://linear.app/oauth/authorize",
        tokenUrl: "https://api.linear.app/oauth/token",
        discoveryUrl: null,
        facts: [{ label: "Mock fact", value: "Value", evidence: { status: "source", sources: ["S1"] } }],
      },
      scopes: [{ scope: "read", purpose: "Mock scope", tier: "basic", evidence: { status: "source", sources: ["S1"] } }],
      prerequisites: [],
      steps: [
        {
          phase: "register",
          title: "Mock step",
          detail: "Mock detail.",
          url: "https://linear.app/settings/api",
          owner: "human",
          humanReason: "account_login",
          agentHelp: "Mock agent help.",
          basis: "documented",
          evidence: { status: "source", sources: ["S1"] },
        },
        {
          phase: "configure",
          title: "Mock assumed step",
          detail: "Inferred from standard OAuth practice.",
          url: null,
          owner: "agent",
          humanReason: null,
          agentHelp: "Mock agent help.",
          basis: "assumed",
          evidence: { status: "source", sources: ["S1"] },
        },
      ],
      gotchas: [
        {
          title: "Mock gotcha",
          detail: "Only a community source.",
          severity: "warning",
          mitigation: "Mock mitigation.",
          evidence: { status: "source", sources: ["S2"] },
        },
      ],
      uncertainties: [{ question: "Mock question?", why: "Mock.", howToResolve: "Mock." }],
      agentHandoff: { prompt: "Mock prompt.", artifacts: [] },
      nextAction: "Mock next action.",
      providerContact: { channel: "Mock developer support form", url: "https://linear.app/contact", evidence: { status: "source", sources: ["S1"] } },
    };
    return JSON.stringify(content);
  }
}
