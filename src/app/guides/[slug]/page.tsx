import type { Metadata } from "next";
import Link from "next/link";
import { GuideView } from "@/components/guide-view";
import { getGuide } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = await getGuide((await params).slug);
  return guide
    ? { title: `${guide.appName} OAuth app setup guide — OAuth Field Guide`, description: guide.tldr }
    : { title: "Guide not found — OAuth Field Guide" };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">No guide for “{slug}” on this server</h1>
        <p className="mt-2 text-sm text-muted">
          Live guides are stored by the server that generated them. If someone shared this with you, ask for the
          portable link — or generate it now.
        </p>
        <Link
          href={`/investigate?app=${encodeURIComponent(slug)}`}
          className="mt-6 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Investigate {slug} live
        </Link>
      </div>
    );
  }
  return <GuideView guide={guide} />;
}
