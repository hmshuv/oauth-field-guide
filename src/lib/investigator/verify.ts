// Folds probe observations back into a guide: upgrades claims we observed to "tested",
// corrects endpoint URLs that disagree with the provider's own discovery document,
// and turns failed checks into explicit uncertainties.
import type { Guide, Probe } from "../guide/schema";
import { runProbes, type DiscoveryDoc } from "./probes";

const norm = (u: string | null | undefined) => (u ?? "").replace(/\/+$/, "").toLowerCase();

export async function probeAndVerify(guide: Guide, onProbe?: (p: Probe) => void): Promise<Guide> {
  const run = await runProbes(guide.quickRef, onProbe);
  return applyProbes(guide, run.probes, run.discovery, run.discoveryUrl);
}

export function applyProbes(
  input: Guide,
  probes: Probe[],
  discovery: DiscoveryDoc | null,
  discoveryUrl: string | null,
): Guide {
  const g: Guide = structuredClone(input);
  // Drop results of earlier probe runs so re-probing is idempotent.
  g.sources = g.sources.filter((s) => !/^P\d+$/.test(s.id));
  g.corrections = g.corrections.filter((c) => !c.how.startsWith("Probe"));
  g.quickRef.facts = g.quickRef.facts.filter((f) => !f.evidence.sources.some((s) => /^P\d+$/.test(s)));
  g.uncertainties = g.uncertainties.filter((u) => !u.question.startsWith("Probe:"));

  g.probes = probes;
  for (const p of probes) {
    const host = safeHost(p.target);
    g.sources.push({ id: p.id, title: `Our probe: ${p.kind} check on ${host}`, url: p.target, kind: "probe" });
  }
  const byKind = (k: Probe["kind"]) => probes.filter((p) => p.kind === k);
  const discoveryProbe = byKind("discovery").find((p) => p.ok);

  if (discovery && discoveryProbe) {
    if (!g.quickRef.discoveryUrl) g.quickRef.discoveryUrl = discoveryUrl;
    for (const [field, label] of [
      ["authorizeUrl", "authorization_endpoint"],
      ["tokenUrl", "token_endpoint"],
    ] as const) {
      const fromDoc = discovery[label];
      if (!fromDoc) continue;
      const claimed = g.quickRef[field];
      if (claimed && norm(claimed) !== norm(fromDoc)) {
        // Discovery documents often describe only "Sign in with X" (OIDC), not the API-authorization flow,
        // so a different endpoint there is only a correction when the guide's own URL failed its probe.
        const kind = field === "authorizeUrl" ? "authorize" : "token";
        const ownProbe = probes.find((p) => p.kind === kind && norm(p.target) === norm(claimed));
        if (ownProbe && !ownProbe.ok) {
          g.corrections.push({
            what: field === "authorizeUrl" ? "Authorize URL" : "Token URL",
            before: claimed,
            after: fromDoc,
            how: `Probe ${ownProbe.id} failed (${ownProbe.observed}); probe ${discoveryProbe.id} found ${label} in the provider's discovery document.`,
          });
          g.quickRef[field] = fromDoc;
        } else {
          g.quickRef.facts.push({
            label: `Discovery lists a different ${label}`,
            value: `${fromDoc} — typically the OpenID "Sign in with" flow; the URL above is the one for API access.`,
            evidence: { status: "tested", sources: [discoveryProbe.id, ...(ownProbe ? [ownProbe.id] : [])], note: `Compared ${discoveryProbe.target} with the guide's ${field}.` },
          });
        }
      }
      if (!claimed) g.quickRef[field] = fromDoc;
    }

    const pkce = discovery.code_challenge_methods_supported;
    g.quickRef.facts.push({
      label: "PKCE (from discovery document)",
      value: pkce?.length
        ? `Advertised methods: ${pkce.join(", ")}`
        : "Not advertised in the discovery document (it may only describe OpenID sign-in; check the docs)",
      evidence: {
        status: "tested",
        sources: [discoveryProbe.id],
        note: `Fetched ${discoveryProbe.target}`,
      },
    });
    if (discovery.scopes_supported?.length) {
      g.quickRef.facts.push({
        label: "Scopes advertised in discovery",
        value: discovery.scopes_supported.slice(0, 12).join(", ") + (discovery.scopes_supported.length > 12 ? " …" : ""),
        evidence: { status: "tested", sources: [discoveryProbe.id], note: `Fetched ${discoveryProbe.target}` },
      });
    }
  }

  const live = probes.filter((p) => (p.kind === "authorize" || p.kind === "token") && p.ok);
  if (live.length) {
    g.quickRef.facts.push({
      label: "Endpoints observed live",
      value: live.map((p) => `${p.kind === "authorize" ? "Authorize" : "Token"}: ${p.observed}`).join(" · "),
      evidence: {
        status: "tested",
        sources: live.map((p) => p.id),
        note: "Requests sent with a deliberately invalid client id / code; no credentials used.",
      },
    });
  }

  for (const p of probes) {
    if (p.ok) continue;
    if (p.kind === "discovery") continue; // a missing discovery doc is normal for plain OAuth 2.0 providers
    const what = { authorize: "authorize URL", token: "token URL", page: "page" }[p.kind];
    g.uncertainties.push({
      question: `Probe: the ${what} ${p.target} did not respond as expected`,
      why: p.observed,
      howToResolve: "Open the URL in a browser while logged in, or check the provider's docs for the current URL.",
    });
  }
  return g;
}

function safeHost(u: string) {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
}
