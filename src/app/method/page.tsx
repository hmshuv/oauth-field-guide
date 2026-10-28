import { EvidencePill } from "@/components/badges";
import { DIFFICULTY_INFO } from "@/lib/guide/difficulty";
import { STAGES } from "@/lib/investigator/events";
import { ARCHETYPE_INFO, ARCHETYPES, EVIDENCE_INFO, EVIDENCE_STATUSES, FLAG_INFO, FLAGS } from "@/lib/guide/taxonomy";

export const metadata = { title: "How it works — OAuth Field Guide" };

const STAGE_DETAIL: Record<string, string> = {
  preflight: "Validates the API key and model with a metadata call that costs no tokens, so a bad key never wastes a run.",
  identify:
    "Resolves the name or URL to a product, its official domains and its OAuth docs (one grounded search call). If it isn't sure the app offers OAuth, one availability check runs first; if no public OAuth is found, the agent writes a short guide about the alternative (API keys, partner programs) instead of paying for full research.",
  research:
    "Three parallel grounded research tracks: registration mechanics, the review/verification path, and field reports & recent policy changes. The mechanics track also reads the official docs page directly.",
  sources:
    "Resolves Google's grounding redirects to real URLs, de-duplicates them, and classifies each as official (provider-owned domain) or community. Citations are inserted into the notes as [S#].",
  synthesize:
    "A separate structured-output call turns the cited notes into the guide schema. Invalid JSON gets one cheap repair call; research is checkpointed so a retry never repeats it.",
  verify:
    "Code, not the model, grades evidence: model-claimed 'tested' is downgraded, 'source-backed' without an official citation is downgraded. Then credential-free probes hit the live discovery, authorize and token endpoints and the console/docs pages.",
  save: "The guide is saved under a short link and can also be shared as a self-contained portable link or Markdown.",
};

export default function MethodPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
        <p className="mt-3 text-muted">
          Developers don&apos;t need another documentation summary — they need to de-risk a launch. Every guide answers four
          questions: how hard is it, how long will it take (hands-on time vs. waiting on the provider), what can block
          approval, and what an agent can do for you vs. where you take over. Every claim says how we know it.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-semibold tracking-tight">1. The problem has two clocks</h2>
        <p className="mt-2 text-sm text-muted">
          Each guide separates <strong className="text-ink">“working with your own account”</strong> (usually minutes) from{" "}
          <strong className="text-ink">“any customer can connect”</strong> (sometimes weeks). Most launch surprises live in the
          gap: user caps on unverified apps, marketplace reviews, security assessments, partner approvals, or a customer admin
          who must approve the app.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight">2. Archetypes</h2>
        <p className="mt-2 text-sm text-muted">The top-level bucket: what kind of gate stands between registration and production.</p>
        <div className="mt-4 space-y-3">
          {ARCHETYPES.map((a) => (
            <div key={a} className="card p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">{ARCHETYPE_INFO[a].label}</span>
                <span className="text-xs text-accent">{ARCHETYPE_INFO[a].short}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{ARCHETYPE_INFO[a].description}</p>
              <p className="mt-1 text-xs text-muted">Examples: {ARCHETYPE_INFO[a].examples}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight">3. Friction flags</h2>
        <p className="mt-2 text-sm text-muted">Specific requirements that cut across archetypes. A guide only carries the flags its evidence supports.</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {FLAGS.map((f) => (
            <div key={f} className="rounded-lg border border-line p-3">
              <dt className="text-sm font-medium">{FLAG_INFO[f].label}</dt>
              <dd className="mt-0.5 text-sm text-muted">{FLAG_INFO[f].hint}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight">4. Difficulty is computed, not written</h2>
        <p className="mt-2 text-sm text-muted">
          Starting from the archetype, a guide moves to High friction if it needs a security assessment or partner
          application, at least Involved if the production wait is 3+ days, and High friction at 21+ days.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {([1, 2, 3, 4] as const).map((l) => (
            <li key={l}>
              <span className="font-medium">{DIFFICULTY_INFO[l].label}</span> — <span className="text-muted">{DIFFICULTY_INFO[l].description}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight">5. When documentation is thin or missing</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>
            <strong className="text-ink">Evidence coverage</strong> — the share of claims backed by our tests or official docs
            (community reports count half). Below 40%, the guide shows <em>Unrated · low evidence</em> and a warning instead
            of a difficulty rating.
          </li>
          <li>
            <strong className="text-ink">Assumed steps</strong> — steps inferred from standard OAuth practice rather than the
            provider&apos;s docs are tagged <em>Assumed</em> and can never be graded better than Uncertain.
          </li>
          <li>
            <strong className="text-ink">No invented URLs</strong> — console/docs/endpoint URLs are left empty when research
            didn&apos;t find them, and URLs that never appeared in a source are listed as open questions.
          </li>
          <li>
            <strong className="text-ink">No public OAuth</strong> is a verdict of its own, not a difficulty level.
          </li>
          <li>
            <strong className="text-ink">Ask the provider</strong> — open questions become a ready-to-send message to the
            provider&apos;s developer support or partner channel.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight">6. Evidence grades</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {EVIDENCE_STATUSES.map((s) => (
            <div key={s} className="rounded-lg border border-line p-3">
              <EvidencePill status={s} />
              <p className="mt-1.5 text-sm text-muted">{EVIDENCE_INFO[s].hint}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          “Tested” never means we created an app or passed a review. It means our agent observed the claim itself —
          e.g. fetching the provider&apos;s discovery document, or sending a deliberately invalid client id to the live
          authorize endpoint and recording how it responds.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight">7. The live investigator</h2>
        <ol className="mt-4 space-y-3">
          {STAGES.map((s, i) => (
            <li key={s.key} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">{i + 1}</span>
              <div>
                <div className="text-sm font-medium">{s.label}</div>
                <p className="text-sm text-muted">{STAGE_DETAIL[s.key]}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight">8. Limitations</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>No agent creates real OAuth apps or submits reviews; console-only facts are source-backed at best.</li>
          <li>Review timelines are rarely published; estimates are conservative ranges and marked uncertain where unsupported.</li>
          <li>Live guides reflect what web search surfaces at that moment; paywalled or login-only docs are invisible to it.</li>
          <li>Probes confirm endpoints are live and how they reject bad input — not that your configuration will be approved.</li>
        </ul>
      </section>
    </div>
  );
}
