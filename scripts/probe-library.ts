// Runs the investigator's credential-free probes against every curated guide and writes the
// results back, so library guides carry the same "Tested" evidence as live ones.
// Usage: npm run probe [slug | path/to/guide.json]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Guide } from "../src/lib/guide/schema";
import { probeAndVerify } from "../src/lib/investigator/verify";

// Argument: a slug prefix within data/library, or a path to a single guide file anywhere.
const arg = process.argv[2];
const single = arg?.endsWith(".json");
const dir = single ? path.dirname(path.resolve(arg!)) : path.join(process.cwd(), "data/library");
const only = single ? path.basename(arg!) : arg;

async function main() {
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  if (only && !file.startsWith(only)) continue;
  const parsed = Guide.safeParse(JSON.parse(readFileSync(path.join(dir, file), "utf8")));
  if (!parsed.success) {
    console.error(`✗ ${file}: invalid guide, run npm run validate`);
    continue;
  }
  const guide = await probeAndVerify(parsed.data);
  writeFileSync(path.join(dir, file), JSON.stringify(guide, null, 2) + "\n");
  console.log(`\n${guide.appName}`);
  for (const p of guide.probes) console.log(`  ${p.ok ? "✓" : "⚠"} [${p.id}] ${p.kind} ${p.target}\n      ${p.observed}`);
  for (const c of guide.corrections.filter((c) => c.how.startsWith("Probe"))) console.log(`  ✎ ${c.what}: ${c.before} → ${c.after}`);
}
}

main();
