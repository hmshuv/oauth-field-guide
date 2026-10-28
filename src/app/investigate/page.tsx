import { Investigation } from "@/components/investigation";

export const dynamic = "force-dynamic";

export default async function InvestigatePage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  const app = ((await searchParams).app ?? "").trim();
  if (!app) {
    return <p className="mx-auto max-w-xl px-4 py-20 text-center text-sm text-muted">Enter an app name on the home page to start.</p>;
  }
  return <Investigation app={app} key={app} />;
}
