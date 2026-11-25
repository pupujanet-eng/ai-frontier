import { promises as fs } from "node:fs";
import path from "node:path";
import type { DailyDigest } from "../src/types";
import { displayDigest } from "../src/lib/edition-display";
import { assertCompleteEdition, publishDigest } from "./publish-digest";
import { beijingDate } from "./model-budget";

async function readComplete(file: string, expectedDate?: string) {
  const digest = displayDigest(JSON.parse(await fs.readFile(file, "utf8")), expectedDate);
  assertCompleteEdition(digest, expectedDate);
  return digest;
}

// Reviewed editions are tracked independently of mutable runtime caches. They pass
// the same publication gate and never replace a newer or already complete edition.
export async function applyReviewedEditions(source: string, target: string, today = beijingDate()) {
  const names = await fs.readdir(source).catch((error) => {
    if (error.code === "ENOENT") return [] as string[];
    throw error;
  });
  const reviewed: DailyDigest[] = [];
  for (const name of names.filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort()) {
    const digest = await readComplete(path.join(source, name), name.slice(0, 10));
    if (digest.date > today) throw new Error("Cannot publish a future reviewed edition");
    reviewed.push(digest);
  }
  if (!reviewed.length) return;
  let latest = await readComplete(path.join(target, "latest.json")).catch(() => undefined);
  await fs.mkdir(target, { recursive: true });
  for (const candidate of reviewed) {
    const file = path.join(target, `${candidate.date}.json`);
    const existing = await readComplete(file, candidate.date).catch(() => undefined);
    const digest = existing ?? candidate;
    if (!existing) {
      await fs.writeFile(`${file}.tmp`, JSON.stringify(digest, null, 2));
      await fs.rename(`${file}.tmp`, file);
    }
    if (!latest || digest.date > latest.date) latest = digest;
  }
  await publishDigest(latest!, target, latest!.date);
  console.log(`[reviewed] Restored complete editions; latest ${latest!.date}; no model calls`);
}

if (process.argv[1]?.endsWith("apply-reviewed-editions.ts")) {
  applyReviewedEditions("data/reviewed-editions", "data/digests").catch((error) => {
    console.error(error); process.exitCode = 1;
  });
}
