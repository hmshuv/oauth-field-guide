import "server-only";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Guide, slugify } from "./guide/schema";

const LIBRARY_DIR = path.join(process.cwd(), "data/library");
// Serverless filesystems are read-only except /tmp; locally we keep generated guides in the repo's data dir.
const GENERATED_DIR =
  process.env.GUIDES_DIR || (process.env.VERCEL ? "/tmp/oauth-guides" : path.join(process.cwd(), "data/generated"));
const CHECKPOINT_DIR = path.join(GENERATED_DIR, ".checkpoints");

let libraryCache: Guide[] | null = null;

export function getLibrary(): Guide[] {
  if (libraryCache && process.env.NODE_ENV === "production") return libraryCache;
  const guides: Guide[] = [];
  for (const file of readdirSync(LIBRARY_DIR).filter((f) => f.endsWith(".json"))) {
    const parsed = Guide.safeParse(JSON.parse(readFileSync(path.join(LIBRARY_DIR, file), "utf8")));
    if (parsed.success) guides.push(parsed.data);
    else console.error(`Invalid library guide ${file}:`, parsed.error.issues.slice(0, 3));
  }
  libraryCache = guides.sort((a, b) => a.appName.localeCompare(b.appName));
  return libraryCache;
}

const safe = (slug: string) => slugify(slug) || "unknown";

export async function getGenerated(slug: string): Promise<{ guide: Guide; savedAt: Date } | null> {
  const file = path.join(GENERATED_DIR, `${safe(slug)}.json`);
  try {
    const [raw, info] = await Promise.all([readFile(file, "utf8"), stat(file)]);
    const parsed = Guide.safeParse(JSON.parse(raw));
    return parsed.success ? { guide: parsed.data, savedAt: info.mtime } : null;
  } catch {
    return null;
  }
}

export async function saveGenerated(guide: Guide) {
  await mkdir(GENERATED_DIR, { recursive: true });
  await writeFile(path.join(GENERATED_DIR, `${safe(guide.slug)}.json`), JSON.stringify(guide, null, 2));
}

export async function listGenerated(): Promise<Guide[]> {
  try {
    const files = (await readdir(GENERATED_DIR)).filter((f) => f.endsWith(".json"));
    const guides = await Promise.all(files.map((f) => getGenerated(f.replace(/\.json$/, ""))));
    return guides
      .filter((g): g is NonNullable<typeof g> => !!g)
      .sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime())
      .map((g) => g.guide);
  } catch {
    return [];
  }
}

export async function getGuide(slug: string): Promise<Guide | null> {
  return getLibrary().find((g) => g.slug === slug) ?? (await getGenerated(slug))?.guide ?? null;
}

export function findInLibrary(query: string): Guide | null {
  const q = slugify(query);
  if (!q) return null;
  return (
    getLibrary().find(
      (g) => g.slug === q || slugify(g.appName) === q || slugify(g.website) === q,
    ) ?? null
  );
}

// Research checkpoints let a failed synthesis retry without paying for the research again.
export async function saveCheckpoint(key: string, data: unknown) {
  await mkdir(CHECKPOINT_DIR, { recursive: true });
  await writeFile(path.join(CHECKPOINT_DIR, `${safe(key)}.json`), JSON.stringify(data));
}

export async function loadCheckpoint<T>(key: string, maxAgeMs: number): Promise<T | null> {
  const file = path.join(CHECKPOINT_DIR, `${safe(key)}.json`);
  try {
    const info = await stat(file);
    if (Date.now() - info.mtime.getTime() > maxAgeMs) return null;
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}
