// Direct-docs research for keys without Google Search grounding: fetch the provider's own pages,
// follow OAuth-relevant links on official domains, and hand the text to the model with page ids.
// Every source is a page we actually retrieved, so URLs can't be invented.
import type { Source } from "../guide/schema";
import { assertPublicHttps } from "./probes";

const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;
const PAGE_CHARS = 7000;
const MAX_FETCHES = 16;
const MAX_PAGES = 10;
const UA = "Mozilla/5.0 (compatible; oauth-guide-investigator/1.0; +reads public developer docs)";

export type Page = { url: string; title: string; text: string; links: string[]; score: number };

const KEYWORDS: [RegExp, number][] = [
  [/oauth/gi, 5],
  [/authori[sz]/gi, 4],
  [/client[ _-]?id|client[ _-]?secret/gi, 3],
  [/scopes?\b/gi, 3],
  [/redirect[ _-]?ur[il]|callback/gi, 2],
  [/consent/gi, 2],
  [/review|approv|verif/gi, 2],
  [/marketplace|directory|listing|publish|distribut/gi, 2],
  [/partner/gi, 2],
  [/rate[ -]?limit/gi, 2],
  [/refresh[ _-]?token|access[ _-]?token/gi, 2],
  [/api[ _-]?key|personal access token/gi, 2],
];

const URL_HINT = /oauth|auth|app|scope|permission|token|review|publish|distribut|marketplace|partner|rate|limit|develop|api|integration|connect|security|verification/i;
const SKIP = /\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|css|js|mp4|woff2?)(\?|$)|\/(blog|careers|jobs|pricing|legal|press|customers|login|signup|sign-up|logout)\b/i;

function relevance(text: string): number {
  return KEYWORDS.reduce((sum, [re, w]) => sum + Math.min(10, (text.match(re) ?? []).length) * w, 0);
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'");

export function htmlToText(html: string): { title: string; text: string } {
  const title = decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "");
  const body = html
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|footer|header|aside)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<h[1-4][^>]*>/gi, "\n## ")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<(p|div|section|article|tr|br|h[1-6]|pre|table)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decode(body)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1)
    .join("\n");
  return { title, text };
}

function extractLinks(html: string, base: string, isOfficial: (host: string) => boolean): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(decode(m[1]), base);
      if (u.protocol !== "https:" || !isOfficial(u.hostname) || SKIP.test(u.pathname)) continue;
      u.hash = "";
      u.search = "";
      out.add(u.toString().replace(/\/$/, ""));
    } catch {
      /* ignore malformed hrefs */
    }
  }
  return [...out];
}

// Follows redirects manually so every hop passes the public-https guard.
async function fetchHtml(url: string): Promise<{ finalUrl: string; html: string } | null> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHttps(current);
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok || !/html|text\/plain/i.test(res.headers.get("content-type") ?? "")) return null;
    const html = (await res.text()).slice(0, MAX_BYTES);
    return { finalUrl: current, html };
  }
  return null;
}

export async function gatherOfficialPages(
  seeds: string[],
  officialDomains: string[],
  log: (m: string) => void,
): Promise<Page[]> {
  const isOfficial = (host: string) => {
    const h = host.replace(/^www\./, "").toLowerCase();
    return officialDomains.some((d) => h === d || h.endsWith(`.${d}`));
  };
  const seen = new Set<string>();
  const pages = new Map<string, Page>();
  let fetches = 0;

  const visit = async (url: string) => {
    const key = url.replace(/\/$/, "");
    if (seen.has(key) || fetches >= MAX_FETCHES) return;
    seen.add(key);
    fetches++;
    try {
      const r = await fetchHtml(url);
      if (!r || !isOfficial(new URL(r.finalUrl).hostname)) return;
      const { title, text } = htmlToText(r.html);
      const finalKey = r.finalUrl.replace(/\/$/, "");
      if (pages.has(finalKey)) return;
      pages.set(finalKey, {
        url: r.finalUrl,
        title: title || new URL(r.finalUrl).pathname,
        text,
        links: extractLinks(r.html, r.finalUrl, isOfficial),
        score: relevance(text) + relevance(r.finalUrl) * 2,
      });
    } catch {
      /* unreachable or blocked pages are simply skipped */
    }
  };

  const valid = [...new Set(seeds.filter((s) => /^https:\/\//.test(s)))];
  await Promise.all(valid.slice(0, 8).map(visit));
  log(`Read ${pages.size} of ${Math.min(valid.length, 8)} suggested official pages`);

  // One hop out: follow the most promising links found on the seed pages.
  const candidates = new Map<string, number>();
  for (const p of pages.values()) {
    for (const link of p.links) {
      if (seen.has(link) || !URL_HINT.test(link)) continue;
      candidates.set(link, (candidates.get(link) ?? 0) + relevance(link) + p.score / 50);
    }
  }
  const next = [...candidates.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u).slice(0, MAX_FETCHES - fetches);
  await Promise.all(next.map(visit));
  if (next.length) log(`Followed ${next.length} OAuth-related links; ${pages.size} pages retrieved in total`);

  return [...pages.values()]
    .filter((p) => p.text.length >= 300 && p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PAGES);
}

export function pagesToSources(pages: Page[]): Source[] {
  return pages.map((p, i) => ({ id: `S${i + 1}`, title: p.title.slice(0, 140), url: p.url, kind: "official" as const }));
}

export function pagesForPrompt(pages: Page[], sources: Source[]): string {
  return pages
    .map((p, i) => `=== [${sources[i].id}] ${sources[i].title} — ${p.url} ===\n${p.text.slice(0, PAGE_CHARS)}`)
    .join("\n\n");
}
