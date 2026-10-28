// Validates every curated guide in data/library against the Guide schema
// and checks that every evidence.sources id resolves to a declared source.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Guide } from "../src/lib/guide/schema";

// Argument: a slug prefix within data/library, or a path to a single guide file anywhere.
const arg = process.argv[2];
const single = arg?.endsWith(".json");
const dir = single ? path.dirname(path.resolve(arg!)) : path.join(process.cwd(), "data/library");
const only = single ? path.basename(arg!) : arg;
let failed = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  if (only && !file.startsWith(only)) continue;
  const raw = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
  const parsed = Guide.safeParse(raw);
  if (!parsed.success) {
    failed++;
    console.error(`✗ ${file}`);
    for (const issue of parsed.error.issues.slice(0, 20)) {
      console.error(`   ${issue.path.join(".")}: ${issue.message}`);
    }
    continue;
  }
  const ids = new Set(parsed.data.sources.map((s) => s.id));
  const dangling = new Set<string>();
  JSON.stringify(parsed.data, (key, value) => {
    if (key === "evidence" && value?.sources) {
      for (const id of value.sources) if (!ids.has(id)) dangling.add(id);
    }
    return value;
  });
  if (dangling.size) {
    failed++;
    console.error(`✗ ${file}: evidence references undeclared sources ${[...dangling].join(", ")}`);
    continue;
  }
  console.log(`✓ ${file}`);
}
process.exit(failed ? 1 : 0);
