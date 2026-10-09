import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emphasisParts, selectCoreInsight, validateCoreInsight } from "../src/lib/core-insight";
import type { CoreInsight } from "../src/types";
const edition = (): CoreInsight => JSON.parse(readFileSync("data/editorials/2026-10-09.json", "utf8"));
test("core synthesis survives absent topics and date-bound correction never leaks into another edition", () => {
  const e = edition();
  assert.equal(selectCoreInsight(e.date, undefined, e)?.points.length, 3);
  assert.equal(selectCoreInsight("2026-10-10", undefined, e), undefined);
  const generated = {...e, origin: "generated" as const};
  assert.equal(selectCoreInsight(e.date, generated, {...e, date:"2026-10-08"})?.origin, "generated");
});
test("rejects invented citations, incomplete prose, missing highlights and stale evidence", () => {
  for (const mutate of [
    (e: CoreInsight) => { e.points[0].sourceIds = ["fabricated"]; },
    (e: CoreInsight) => { e.points[0].meaning = "句子在这里被截断，没有真正形成可读的完整解释"; },
    (e: CoreInsight) => { e.highlights = ["不存在的重点"]; },
    (e: CoreInsight) => { e.sources[0].publishedAt = "2026-05-01"; },
    (e: CoreInsight) => { e.sources[0].publishedAt = "2026-10-10"; },
    (e: CoreInsight) => { e.highlights = [e.takeaway]; },
  ]) {
    const e = edition(); mutate(e);
    assert.throws(() => validateCoreInsight(e, e.sources, e.date));
  }
});
test("highlight matching preserves literal text, overlapping phrases and markup-like input", () => {
  const text = "C++ 与 C++ 工具：<script>只是文字</script>。";
  const parts = emphasisParts(text, ["C++", "C++ 工具", ""]);
  assert.equal(parts.map((p) => p.text).join(""), text);
  assert.deepEqual(parts.filter((p) => p.highlighted).map((p) => p.text), ["C++", "C++ 工具"]);
});
