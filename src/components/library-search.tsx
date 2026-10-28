"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Verdict } from "@/lib/guide/difficulty";
import type { Archetype } from "@/lib/guide/taxonomy";
import { ArchetypeBadge, VerdictBadge } from "./badges";

export type GuideCard = {
  slug: string;
  appName: string;
  category: string;
  archetype: Archetype;
  verdict: Verdict;
  firstToken: string;
  production: string;
  tldr: string;
  live: boolean;
};

const SUGGESTIONS = ["Linear", "HubSpot", "Zoom", "Xero", "Shopify", "Microsoft Outlook"];

export function LibrarySearch({ library, recent }: { library: GuideCard[]; recent: GuideCard[] }) {
  const [q, setQ] = useState("");
  const router = useRouter();
  const needle = q.trim().toLowerCase();
  const matches = useMemo(
    () =>
      needle
        ? [...library, ...recent].filter(
            (g) => g.appName.toLowerCase().includes(needle) || g.category.toLowerCase().includes(needle) || g.slug.includes(needle),
          )
        : library,
    [library, recent, needle],
  );
  const exact = matches.find((g) => g.appName.toLowerCase() === needle || g.slug === needle);

  const investigate = (name: string) => router.push(`/investigate?app=${encodeURIComponent(name)}`);

  return (
    <>
      <form
        className="mt-8 flex max-w-2xl flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!needle) return;
          if (exact) router.push(`/guides/${exact.slug}`);
          else investigate(q.trim());
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="App name or website — e.g. Linear, hubspot.com"
          className="h-12 flex-1 rounded-lg border border-line bg-surface px-4 text-base outline-none focus:border-accent"
          aria-label="App name or website"
          autoFocus
        />
        <button type="submit" className="h-12 rounded-lg bg-accent px-5 text-sm font-semibold text-white disabled:opacity-50" disabled={!needle}>
          {exact ? "Open guide" : "Investigate live"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Not in the library? Try:</span>
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => investigate(s)} className="rounded-full border border-line px-2.5 py-1 hover:border-accent hover:text-accent">
            {s}
          </button>
        ))}
      </div>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{needle ? "Matching guides" : "Curated library"}</h2>
          <span className="text-xs text-muted">{needle ? `${matches.length} match${matches.length === 1 ? "" : "es"}` : `${library.length} reference apps across every archetype`}</span>
        </div>
        {needle && !exact && (
          <button
            type="button"
            onClick={() => investigate(q.trim())}
            className="mt-4 flex w-full items-center justify-between rounded-xl border border-dashed border-accent bg-accent-soft p-4 text-left"
          >
            <span>
              <span className="block text-sm font-semibold text-accent">Investigate “{q.trim()}” live</span>
              <span className="block text-xs text-muted">
                An agent researches official docs, review policies and developer reports, probes the live OAuth endpoints, and writes a shareable guide (~1–2 min).
              </span>
            </span>
            <span className="text-accent">→</span>
          </button>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((g) => (
            <Card key={g.slug} g={g} />
          ))}
        </div>
      </section>

      {!needle && recent.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Recently investigated live</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((g) => (
              <Card key={g.slug} g={g} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Card({ g }: { g: GuideCard }) {
  return (
    <Link href={`/guides/${g.slug}`} className="card group flex flex-col p-4 transition hover:border-accent">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold group-hover:text-accent">{g.appName}</div>
          <div className="text-xs text-muted">
            {g.category}
            {g.live && " · live"}
          </div>
        </div>
        <VerdictBadge verdict={g.verdict} />
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-muted">{g.tldr}</p>
      <div className="mt-auto pt-4">
        <ArchetypeBadge archetype={g.archetype} />
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-muted">Own account</dt>
            <dd className="font-medium">{g.firstToken}</dd>
          </div>
          <div>
            <dt className="text-muted">Any customer</dt>
            <dd className="font-medium">{g.production}</dd>
          </div>
        </dl>
      </div>
    </Link>
  );
}
