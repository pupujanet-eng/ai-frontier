import { readFileSync } from "node:fs";
import { assertCompleteEdition } from "./publish-digest";
import { displayDigest } from "../src/lib/edition-display";
const digest = displayDigest(JSON.parse(readFileSync(process.argv[2] || "data/digests/latest.json", "utf8")));
assertCompleteEdition(digest);
console.log(`[publication] Verified ${digest.date}: core insight and ${digest.topics!.length} complete trend topics`);
