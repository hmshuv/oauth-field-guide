// Credential-free probes: the parts of "attempting setup" an agent can do without an account.
// They hit public endpoints with obviously-invalid inputs and record what the provider says,
// which turns some claims from "the docs say so" into "we observed it".
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Probe } from "../guide/schema";

const TIMEOUT_MS = 7000;
const MAX_BODY = 200_000;
const UA = "oauth-guide-investigator/1.0 (+credential-free endpoint probe)";
const PROBE_CLIENT_ID = "oauth-guide-probe-invalid-client";
const PROBE_REDIRECT = "https://example.com/oauth/callback";

function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v === "::";
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

// Only public https hosts — the investigator follows URLs a model produced, so guard against SSRF.
export async function assertPublicHttps(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("only https URLs are probed");
  const host = url.hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("refusing to probe a local hostname");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new Error("refusing to probe a private address");
  return url;
}

async function request(url: string, init: RequestInit = {}) {
  await assertPublicHttps(url);
  const res = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...init,
    headers: { "user-agent": UA, accept: "application/json, text/html;q=0.9, */*;q=0.5", ...init.headers },
  });
  const text = (await res.text()).slice(0, MAX_BODY);
  return { res, text };
}

function snippet(text: string, n = 160): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
}

function oauthError(text: string): string | null {
  try {
    const j = JSON.parse(text);
    if (typeof j.error === "string") return j.error_description ? `${j.error}: ${j.error_description}` : j.error;
    if (j.error?.message) return String(j.error.message);
  } catch {
    // Only look for error=… in URLs and plain text; HTML pages mention "error" in scripts and styles.
    if (/<html|<!doctype|<script/i.test(text)) return null;
    const m = text.match(/error[=:"\s]+([a-z_]{4,40})/i);
    if (m) return m[1];
  }
  return null;
}

const isHtml = (text: string) => /<html|<!doctype/i.test(text.slice(0, 2000));

const now = () => new Date().toISOString();

export type DiscoveryDoc = {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  scopes_supported?: string[];
  code_challenge_methods_supported?: string[];
  grant_types_supported?: string[];
  response_types_supported?: string[];
};

export async function probeDiscovery(
  id: string,
  url: string,
): Promise<{ probe: Probe; doc: DiscoveryDoc | null }> {
  try {
    const { res, text } = await request(url);
    let doc: DiscoveryDoc | null = null;
    try {
      doc = JSON.parse(text);
    } catch {
      doc = null;
    }
    const ok = res.ok && !!doc?.authorization_endpoint;
    const observed = ok
      ? `HTTP ${res.status}; issuer ${doc!.issuer ?? "?"}; authorize ${doc!.authorization_endpoint}; PKCE methods: ${
          doc!.code_challenge_methods_supported?.join(", ") || "not advertised"
        }`
      : `HTTP ${res.status}; no valid discovery document`;
    return { probe: { id, kind: "discovery", target: url, ok, status: res.status, observed, at: now() }, doc: ok ? doc : null };
  } catch (e) {
    return { probe: failed(id, "discovery", url, e), doc: null };
  }
}

export async function probeAuthorize(id: string, authorizeUrl: string): Promise<Probe> {
  const url = new URL(authorizeUrl);
  url.searchParams.set("client_id", PROBE_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", PROBE_REDIRECT);
  url.searchParams.set("state", "probe");
  try {
    const { res, text } = await request(url.toString());
    const location = res.headers.get("location");
    const err = oauthError(text) ?? (location ? oauthError(decodeURIComponent(location)) : null);
    // A live authorize endpoint either redirects (to login or with an error) or renders an error page.
    // 404/405/5xx means the URL is probably wrong.
    const ok = res.status < 500 && res.status !== 404 && res.status !== 405;
    const parts = [`HTTP ${res.status}`];
    if (location) parts.push(`redirects to ${new URL(location, url).host}${new URL(location, url).pathname}`);
    if (err) parts.push(`error "${err}"`);
    else if (!location && isHtml(text)) parts.push("serves an HTML login/consent page");
    else if (!location) parts.push(`"${snippet(text, 100)}"`);
    if (!ok) parts.push("→ endpoint looks wrong or unavailable");
    else if (err || res.status >= 400 || /error/i.test(location ?? "")) parts.push("→ endpoint is live and rejects the unknown client");
    else parts.push("→ endpoint is live (client validation may happen after login)");
    return { id, kind: "authorize", target: authorizeUrl, ok, status: res.status, observed: parts.join("; "), at: now() };
  } catch (e) {
    return failed(id, "authorize", authorizeUrl, e);
  }
}

export async function probeToken(id: string, tokenUrl: string): Promise<Probe> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: "probe-invalid-code",
    client_id: PROBE_CLIENT_ID,
    client_secret: "probe-invalid-secret",
    redirect_uri: PROBE_REDIRECT,
  });
  try {
    const { res, text } = await request(tokenUrl, {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    });
    const err = oauthError(text);
    // A real token endpoint answers a bogus code with an OAuth-style JSON error — some (e.g. GitHub) use 404 for
    // unknown clients. A wrong path returns an HTML page or a "no such method" error instead.
    const wrongPath = !!err && /unknown_method|unknown_path|no_route|method_not_found/i.test(err);
    const ok =
      res.status < 500 &&
      !wrongPath &&
      (!!err || (res.status >= 400 && res.status !== 404 && res.status !== 405 && !isHtml(text)));
    const observed = `HTTP ${res.status}; ${err ? `error "${err}"` : isHtml(text) ? "HTML page" : `"${snippet(text, 100)}"`}; ${
      ok ? "→ token endpoint is live and rejects a bogus code" : "→ unexpected response (URL may be wrong)"
    }`;
    return { id, kind: "token", target: tokenUrl, ok, status: res.status, observed, at: now() };
  } catch (e) {
    return failed(id, "token", tokenUrl, e);
  }
}

export async function probePage(id: string, url: string): Promise<Probe> {
  try {
    const { res, text } = await request(url);
    const location = res.headers.get("location");
    const ok = res.status < 400 || res.status === 401 || res.status === 403;
    let observed = `HTTP ${res.status}`;
    if (location) observed += `; redirects to ${new URL(location, url).host}${new URL(location, url).pathname}`;
    if (res.status === 401 || res.status === 403) observed += " (reachable; requires login or blocks automated requests)";
    else if (res.status === 404) observed += " → page not found";
    else if (res.ok) {
      const title = text.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
      if (title) observed += `; title "${snippet(title, 80)}"`;
    }
    return { id, kind: "page", target: url, ok, status: res.status, observed, at: now() };
  } catch (e) {
    return failed(id, "page", url, e);
  }
}

function failed(id: string, kind: Probe["kind"], target: string, e: unknown): Probe {
  const msg = e instanceof Error ? (e.name === "TimeoutError" ? "timed out" : e.message) : String(e);
  return { id, kind, target, ok: false, status: null, observed: `request failed: ${msg}`, at: now() };
}

// Candidate discovery URLs to try when a guide doesn't name one.
export function discoveryCandidates(authorizeUrl: string | null, explicit: string | null): string[] {
  const out = new Set<string>();
  if (explicit) out.add(explicit);
  if (authorizeUrl) {
    try {
      const origin = new URL(authorizeUrl).origin;
      out.add(`${origin}/.well-known/openid-configuration`);
      out.add(`${origin}/.well-known/oauth-authorization-server`);
    } catch {
      /* ignore malformed URL */
    }
  }
  return [...out];
}

export type ProbeTargets = {
  consoleUrl: string | null;
  docsUrl: string | null;
  authorizeUrl: string | null;
  tokenUrl: string | null;
  discoveryUrl: string | null;
};

export async function runProbes(t: ProbeTargets, onProbe?: (p: Probe) => void) {
  let n = 0;
  const nextId = () => `P${++n}`;
  const probes: Probe[] = [];
  const emit = (p: Probe) => {
    probes.push(p);
    onProbe?.(p);
    return p;
  };

  let discovery: DiscoveryDoc | null = null;
  let discoveryUrl: string | null = null;
  for (const candidate of discoveryCandidates(t.authorizeUrl, t.discoveryUrl)) {
    const r = await probeDiscovery("pending", candidate);
    // Only record failed guesses when the URL was explicitly claimed; derived guesses that 404 are noise.
    if (r.doc || candidate === t.discoveryUrl) {
      r.probe.id = nextId();
      emit(r.probe);
    }
    if (r.doc) {
      discovery = r.doc;
      discoveryUrl = candidate;
      break;
    }
  }

  const authorizeUrl = t.authorizeUrl ?? discovery?.authorization_endpoint ?? null;
  const tokenUrl = t.tokenUrl ?? discovery?.token_endpoint ?? null;
  const tasks: Array<Promise<Probe>> = [];
  const ids = { authorize: "", token: "", console: "", docs: "" };
  if (authorizeUrl) tasks.push(probeAuthorize((ids.authorize = nextId()), authorizeUrl));
  if (tokenUrl) tasks.push(probeToken((ids.token = nextId()), tokenUrl));
  if (t.consoleUrl) tasks.push(probePage((ids.console = nextId()), t.consoleUrl));
  if (t.docsUrl && t.docsUrl !== t.consoleUrl) tasks.push(probePage((ids.docs = nextId()), t.docsUrl));
  for (const p of await Promise.all(tasks)) emit(p);

  probes.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  return { probes, discovery, discoveryUrl, ids };
}
