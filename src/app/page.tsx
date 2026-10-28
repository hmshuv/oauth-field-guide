import Link from "next/link";
import { LibrarySearch, type GuideCard } from "@/components/library-search";
import { difficultyOf } from "@/lib/guide/difficulty";
import { formatDays, formatMinutes } from "@/lib/guide/format";
import type { Guide } from "@/lib/guide/schema";
import { ARCHETYPE_INFO, ARCHETYPES } from "@/lib/guide/taxonomy";
import { getLibrary, listGenerated } from "@/lib/store";

export const dynamic = "force-dynamic";

function toCard(g: Guide): GuideCard {
  return {
    slug: g.slug,
    appName: g.appName,
    category: g.category,
    archetype: g.classification.archetype,
    level: difficultyOf(g),
    firstToken: `${formatMinutes(g.effort.firstToken.activeMinutes)} · ${formatDays(g.effort.firstToken.waitDays)}`,
    production: `${formatMinutes(g.effort.production.activeMinutes)} · ${formatDays(g.effort.production.waitDays)}`,
    tldr: g.tldr,
    live: g.origin.kind === "live",
  };
}

export default async function Home() {
  const library = getLibrary();
  const generated = (await listGenerated()).filter((g) => !library.some((l) => l.slug === g.slug));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Will connecting an app take 15 minutes — or 6 weeks?
        </h1>
        <p className="mt-3 text-base text-muted">
          Before your AI agent can act for your users, you need an OAuth app with each provider, and sometimes its
          approval. Look up an app for an evidence-graded setup guide, or let our agent investigate one live.
        </p>
      </section>

      <LibrarySearch library={library.map(toCard)} recent={generated.slice(0, 9).map(toCard)} />

      <section className="mt-16">
        <h2 className="text-lg font-semibold tracking-tight">How we classify setup friction</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Every guide is placed in one archetype, then tagged with the specific friction flags that apply. Difficulty is
          computed from the archetype, flags and approval wait, so curated and live guides are rated the same way.{" "}
          <Link href="/method" className="text-accent hover:underline">
            Read the method →
          </Link>
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ARCHETYPES.map((a) => {
            const members = library.filter((g) => g.classification.archetype === a);
            return (
              <div key={a} className="card p-4">
                <div className="text-sm font-semibold">{ARCHETYPE_INFO[a].label}</div>
                <div className="mt-0.5 text-xs text-accent">{ARCHETYPE_INFO[a].short}</div>
                <p className="mt-2 text-sm text-muted">{ARCHETYPE_INFO[a].description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {members.length ? (
                    members.map((g) => (
                      <Link key={g.slug} href={`/guides/${g.slug}`} className="rounded-full bg-surface-2 px-2 py-0.5 hover:text-accent">
                        {g.appName}
                      </Link>
                    ))
                  ) : (
                    <span className="text-muted">e.g. {ARCHETYPE_INFO[a].examples}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
