"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Usage } from "@/lib/investigator/gemini";
import { STAGES, type InvestigateEvent, type StageKey } from "@/lib/investigator/events";
import type { Guide, Probe, Source } from "@/lib/guide/schema";
import { GuideView } from "./guide-view";
import { getUserKey } from "./settings";

type StageState = { status: "pending" | "start" | "done" | "skipped" | "error"; detail?: string };

export function Investigation({ app }: { app: string }) {
  const router = useRouter();
  const [stages, setStages] = useState<Record<StageKey, StageState>>(initialStages);
  const [logs, setLogs] = useState<{ stage: StageKey; message: string }[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<{ message: string; kind: string; stage?: StageKey } | null>(null);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const started = useRef(false);

  const run = useCallback(
    async (force = false) => {
      setStages(initialStages());
      setLogs([]);
      setSources([]);
      setProbes([]);
      setGuide(null);
      setError(null);
      setCached(false);
      setRunning(true);
      setStartedAt(Date.now());
      const headers: Record<string, string> = { "content-type": "application/json" };
      const userKey = getUserKey();
      if (userKey) headers["x-gemini-key"] = userKey;
      try {
        const res = await fetch("/api/investigate", { method: "POST", headers, body: JSON.stringify({ query: app, force }) });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          setError({ message: body.error ?? `Request failed (${res.status})`, kind: body.kind ?? "other" });
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) if (line.trim()) handle(JSON.parse(line) as InvestigateEvent);
        }
      } catch (e) {
        setError({ message: e instanceof Error ? e.message : String(e), kind: "network" });
      } finally {
        setRunning(false);
      }

      function handle(e: InvestigateEvent) {
        switch (e.type) {
          case "stage":
            setStages((s) => ({ ...s, [e.stage]: { status: e.status, detail: e.detail } }));
            break;
          case "log":
            setLogs((l) => [...l, { stage: e.stage, message: e.message }]);
            break;
          case "source":
            setSources((s) => [...s, e.source]);
            break;
          case "probe":
            setProbes((p) => [...p, e.probe]);
            break;
          case "usage":
            setUsage(e.usage);
            break;
          case "done":
            if (e.library) router.replace(`/guides/${e.slug}`);
            else if (e.guide) {
              setGuide(e.guide);
              setCached(e.cached);
            }
            break;
          case "error":
            setError({ message: e.message, kind: e.kind, stage: e.stage });
            if (e.stage) setStages((s) => ({ ...s, [e.stage!]: { status: "error", detail: e.message } }));
            break;
        }
      }
    },
    [app, router],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  const elapsed = running && startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : null;

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {guide ? "Guide ready: " : running ? "Investigating " : ""}
            <span className="text-accent">{guide?.appName ?? app}</span>
          </h1>
          <span className="text-xs text-muted">
            {elapsed !== null && `${elapsed}s · `}
            {usage && `${usage.calls} model calls · ${usage.searchQueries} searches · ${(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens`}
          </span>
        </div>

        {cached && guide && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface p-3 text-sm">
            <span>
              Loaded a guide this server generated on {new Date(guide.origin.generatedAt).toLocaleString()} — no tokens spent.
            </span>
            <button type="button" onClick={() => run(true)} className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-surface-2">
              Re-investigate from scratch
            </button>
          </div>
        )}

        {!cached && (
          <div className={`mt-6 grid gap-4 ${guide ? "lg:grid-cols-2" : "lg:grid-cols-[1.1fr_1fr]"}`}>
            <div className="card p-5">
              <h2 className="text-sm font-semibold">Agent progress</h2>
              <ol className="mt-3 space-y-2.5">
                {STAGES.map((s) => {
                  const st = stages[s.key];
                  return (
                    <li key={s.key} className="flex gap-3 text-sm">
                      <StageIcon status={st.status} />
                      <div className="min-w-0 flex-1">
                        <div className={st.status === "pending" ? "text-muted" : "font-medium"}>{s.label}</div>
                        {st.detail && <div className="text-xs text-muted break-words">{st.detail}</div>}
                        {logs
                          .filter((l) => l.stage === s.key)
                          .map((l, i) => (
                            <div key={i} className="mt-0.5 text-xs text-muted break-words">
                              › {l.message}
                            </div>
                          ))}
                      </div>
                    </li>
                  );
                })}
              </ol>
              {error && (
                <div className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--lvl-4)" }}>
                  <div className="font-medium" style={{ color: "var(--lvl-4)" }}>
                    Investigation stopped
                  </div>
                  <p className="mt-1 text-muted">{error.message}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {error.kind !== "auth" && (
                      <button type="button" onClick={() => run(false)} className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                        Retry{error.stage === "synthesize" || error.stage === "verify" ? " (reuses saved research)" : ""}
                      </button>
                    )}
                    {(error.kind === "auth" || error.kind === "quota") && (
                      <span className="text-xs text-muted">Open Settings (top right) to add your own Gemini key.</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-semibold">
                Evidence collected <span className="font-normal text-muted">({sources.length} sources · {probes.length} probes)</span>
              </h2>
              {!sources.length && !probes.length && <p className="mt-3 text-sm text-muted">Sources appear here as the agent finds them.</p>}
              <ul className="mt-3 max-h-96 space-y-1.5 overflow-auto text-xs">
                {probes.map((p) => (
                  <li key={p.id} className="flex gap-2">
                    <span className={p.ok ? "text-[var(--ev-tested)]" : "text-[var(--ev-uncertain)]"}>{p.ok ? "✓" : "⚠"}</span>
                    <span className="min-w-0 flex-1 break-words">
                      <span className="font-medium">Probe {p.kind}</span> <span className="text-muted">{p.observed}</span>
                    </span>
                  </li>
                ))}
                {sources.map((s) => (
                  <li key={s.id} className="flex gap-2">
                    <span className="w-7 shrink-0 text-muted">{s.id}</span>
                    <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-accent">
                      {s.title}
                    </a>
                    <span className={s.kind === "official" ? "text-[var(--ev-source)]" : "text-[var(--ev-community)]"}>{s.kind}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {guide && !cached && (
          <div className="mt-4 rounded-lg border border-line bg-surface p-3 text-sm">
            Saved at{" "}
            <Link href={`/guides/${guide.slug}`} className="text-accent hover:underline">
              /guides/{guide.slug}
            </Link>
            . Use <span className="font-medium">Copy portable link</span> below for a link that works anywhere.
          </div>
        )}
      </div>
      {guide && <GuideView guide={guide} />}
    </div>
  );
}

function initialStages(): Record<StageKey, StageState> {
  return Object.fromEntries(STAGES.map((s) => [s.key, { status: "pending" }])) as Record<StageKey, StageState>;
}

function StageIcon({ status }: { status: StageState["status"] }) {
  if (status === "start")
    return <span className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-label="running" />;
  const map = {
    pending: { c: "var(--border)", g: "○" },
    done: { c: "var(--ev-tested)", g: "✓" },
    skipped: { c: "var(--muted)", g: "↷" },
    error: { c: "var(--lvl-4)", g: "✕" },
  }[status];
  return (
    <span className="mt-px w-4 shrink-0 text-center text-sm font-bold" style={{ color: map.c }}>
      {map.g}
    </span>
  );
}
