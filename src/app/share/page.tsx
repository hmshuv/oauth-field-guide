"use client";

import { decompressFromEncodedURIComponent } from "lz-string";
import { useEffect, useState } from "react";
import { GuideView } from "@/components/guide-view";
import { Guide } from "@/lib/guide/schema";

// Portable links carry the whole guide in the URL fragment, so they work on any deployment,
// never hit the server, and survive serverless instances forgetting generated guides.
export default function SharePage() {
  const [state, setState] = useState<{ guide: Guide | null; error: string | null }>({ guide: null, error: null });

  useEffect(() => {
    const load = () => {
      try {
        const json = decompressFromEncodedURIComponent(window.location.hash.slice(1));
        const parsed = Guide.safeParse(json ? JSON.parse(json) : null);
        setState(parsed.success ? { guide: parsed.data, error: null } : { guide: null, error: "This link doesn't contain a valid guide." });
      } catch {
        setState({ guide: null, error: "This link is incomplete or corrupted." });
      }
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  if (state.error) return <p className="mx-auto max-w-xl px-4 py-20 text-center text-sm text-muted">{state.error}</p>;
  if (!state.guide) return <p className="mx-auto max-w-xl px-4 py-20 text-center text-sm text-muted">Loading guide…</p>;
  return <GuideView guide={state.guide} />;
}
