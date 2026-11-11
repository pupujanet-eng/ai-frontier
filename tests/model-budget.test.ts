import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { beijingDate, budgetedRequest, budgetLimits, CircuitOpenError, ModelBudget, usageCost } from "../scripts/model-budget";
import { repairCompletion } from "../scripts/editorial-retry";
import { synthesizeTopics } from "../scripts/synthesize-topics";
import type { DigestItem } from "../src/types";

const model = "claude-sonnet-4-6";
const clock = () => new Date("2026-11-11T04:00:00Z");
async function fixture(usd = 5, calls = 80, failures = 12) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "model-budget-"));
  const file = path.join(dir, "2026-11-11.json");
  const limits = { usd, calls, failures };
  return { dir, file, limits, budget: await ModelBudget.open(file, "2026-11-11", limits, clock) };
}
const response = { usage: { input_tokens: 1000, output_tokens: 100 }, _request_id: "req-test", stop_reason: "end_turn" };

test("reserve before sending; exhausted daily budget survives process restart", async () => {
  const f = await fixture(0.01);
  try {
    let sends = 0;
    await assert.rejects(budgetedRequest(f.budget, model, "topic", 2400, async () => 1000, async () => { sends++; return response; }), CircuitOpenError);
    assert.equal(sends, 0);
    const restored = await ModelBudget.open(f.file, "2026-11-11", f.limits, clock, true);
    assert.throws(() => restored.assertAvailable(), CircuitOpenError);
    assert.equal(restored.state.entries.length, 0);
  } finally { await fs.rm(f.dir, { recursive: true, force: true }); }
});
test("actual usage replaces reservation, including rejected output; failures have a daily cap", async () => {
  const f = await fixture(5, 80, 2);
  try {
    let sends = 0;
    await assert.rejects(repairCompletion(async () => {
      await budgetedRequest(f.budget, model, "classify", 6500, async () => 1000, async () => {
        sends++;
        const persisted = JSON.parse(await fs.readFile(f.file, "utf8"));
        assert.equal(persisted.entries.length, sends);
        assert.equal(persisted.entries.at(-1).actualUsd, undefined);
        return response;
      });
      return [];
    }, () => { throw new Error("Incomplete classification batch"); }, () => f.budget.validationFailed()), CircuitOpenError);
    assert.equal(sends, 2);
    assert.equal(f.budget.chargedUsd, 0.009);
    assert.equal(f.budget.state.validationFailures, 2);
    const restored = await ModelBudget.open(f.file, "2026-11-11", f.limits, clock, true);
    assert.throws(() => restored.assertAvailable(), CircuitOpenError);
  } finally { await fs.rm(f.dir, { recursive: true, force: true }); }
});
test("401/402/403 errors escape repairs immediately and stop later scheduled runs", async () => {
  for (const status of [400, 401, 402, 403, 404]) {
    const f = await fixture();
    try {
      let sends = 0;
      await assert.rejects(repairCompletion(() => budgetedRequest(f.budget, model, "core", 2400, async () => 1000, async () => { sends++; throw { status }; }), (v) => v), CircuitOpenError);
      assert.equal(sends, 1);
      assert.ok(f.budget.chargedUsd > 0);
      assert.equal(f.budget.state.entries[0].actualUsd, undefined);
      const restored = await ModelBudget.open(f.file, "2026-11-11", f.limits, clock, true);
      assert.throws(() => restored.assertAvailable(), /stopped for this Beijing day/);
    } finally { await fs.rm(f.dir, { recursive: true, force: true }); }
  }
});
test("429, timeout and 5xx stop current run; cooldown preserves uncertain spending", async () => {
  for (const error of [{status:429}, {status:503}, new Error("timeout")]) {
    const f = await fixture();
    try {
      await assert.rejects(budgetedRequest(f.budget, model, "topic", 2400, async () => 1000, async () => { throw error; }), /paused for 30 minutes/);
      const charged = f.budget.chargedUsd;
      assert.throws(() => f.budget.assertAvailable(), CircuitOpenError);
      const later = await ModelBudget.open(f.file, "2026-11-11", f.limits, () => new Date("2026-11-11T04:31:00Z"), true);
      assert.doesNotThrow(() => later.assertAvailable());
      assert.equal(later.chargedUsd, charged);
    } finally { await fs.rm(f.dir, { recursive: true, force: true }); }
  }
});
test("call limit, missing/corrupt ledger, unpriced model and invalid limits fail closed", async () => {
  const f = await fixture(5, 1);
  try {
    assert.throws(() => f.budget.assertAvailable("unpriced-model"), CircuitOpenError);
    await budgetedRequest(f.budget, model, "core", 2400, async () => 1000, async () => response);
    await assert.rejects(budgetedRequest(f.budget, model, "core", 2400, async () => { throw new Error("must not count"); }, async () => response), CircuitOpenError);
    await assert.rejects(ModelBudget.open(path.join(f.dir, "missing.json"), "2026-11-11", f.limits, clock, true), CircuitOpenError);
    await fs.writeFile(f.file, "{}");
    await assert.rejects(ModelBudget.open(f.file, "2026-11-11", f.limits, clock), CircuitOpenError);
    for (const value of ["NaN", "0", "-1", "Infinity"]) assert.throws(() => budgetLimits({DAILY_MODEL_BUDGET_USD:value}), CircuitOpenError);
    assert.equal(usageCost(model, {input_tokens:1000,output_tokens:100,cache_creation_input_tokens:1000,cache_read_input_tokens:1000,cache_creation:{ephemeral_5m_input_tokens:1000,ephemeral_1h_input_tokens:0}}), 0.00855);
  } finally { await fs.rm(f.dir, { recursive: true, force: true }); }
});
test("token-count failure or ledger write failure cannot send an unaccounted request", async () => {
  const f = await fixture();
  try {
    let sends = 0;
    await assert.rejects(budgetedRequest(f.budget, model, "core", 2400, async () => { throw {status:429}; }, async () => { sends++; return response; }), CircuitOpenError);
    assert.equal(sends, 0);
    assert.equal(f.budget.state.entries.length, 0);
    const later = await ModelBudget.open(f.file, "2026-11-11", f.limits, () => new Date("2026-11-11T04:31:00Z"), true);
    await fs.mkdir(`${f.file}.tmp`); // Simulate a failed atomic ledger write.
    await assert.rejects(budgetedRequest(later, model, "core", 2400, async () => 1000, async () => { sends++; return response; }), /Cannot persist/);
    assert.equal(sends, 0);
  } finally { await fs.rm(f.dir, {recursive:true,force:true}); }
});
test("unexpected actual usage over the estimate is recorded before further spending stops", async () => {
  const f = await fixture(0.1);
  try {
    await assert.rejects(budgetedRequest(f.budget, model, "core", 1000, async () => 1, async () => ({usage:{input_tokens:100000,output_tokens:1000}})), /Actual usage exceeded/);
    assert.equal(f.budget.chargedUsd, 0.315);
    const restored = await ModelBudget.open(f.file, "2026-11-11", f.limits, clock, true);
    assert.equal(restored.chargedUsd, 0.315);
    assert.throws(() => restored.assertAvailable(), CircuitOpenError);
  } finally { await fs.rm(f.dir, {recursive:true,force:true}); }
});
test("Beijing rollover cannot silently reuse yesterday's budget; new date has its own ledger", async () => {
  const f = await fixture();
  try {
    const midnight = () => new Date("2026-11-11T16:00:00Z");
    assert.equal(beijingDate(midnight()), "2026-11-12");
    const stale = await ModelBudget.open(f.file, "2026-11-11", f.limits, midnight, true);
    assert.throws(() => stale.assertAvailable(), /date changed/);
    const fresh = await ModelBudget.open(path.join(f.dir, "2026-11-12.json"), "2026-11-12", f.limits, midnight);
    assert.doesNotThrow(() => fresh.assertAvailable());
  } finally { await fs.rm(f.dir, { recursive: true, force: true }); }
});
test("topic planner does not swallow circuit errors or continue other topics", async () => {
  const inputs = ["a", "b"].map((id) => ({id,title:id,content:"evidence",url:`https://${id}.example/news`,source:id,category:"industry" as const,kind:"primary" as const,publishedAt:"2026-11-11T01:00:00Z"}));
  const items = inputs.map((s) => ({id:s.id,evidenceQuality:"substantial"} as DigestItem));
  let calls = 0;
  await assert.rejects(synthesizeTopics(inputs, items, "2026-11-11", async (_prompt, _schema, validate) => {
    calls++;
    if (calls === 1) return validate([{title:"first",sourceIds:["a","b"]},{title:"second",sourceIds:["a","b"]}]);
    throw new CircuitOpenError("budget exhausted");
  }), CircuitOpenError);
  assert.equal(calls, 2);
});

const restoreBudget = createRequire(import.meta.url)("../scripts/restore-model-budget.cjs");
test("CI restores today's newest ledger, blocks missing ledgers, and includes reruns of old runs", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "budget-restore-"));
  const actions = { listWorkflowRuns: "runs", listJobsForWorkflowRun: "jobs", listWorkflowRunArtifacts: "artifacts", downloadArtifact: async () => ({data:Buffer.from("zip")}) };
  let missing = false;
  let legacy = false;
  const github = {rest:{actions}, paginate: async (method: string) => {
    if (method === "runs") return [{id:123,created_at:"2026-10-10T00:00:00Z",updated_at:"2026-11-11T03:00:00Z"}];
    if (method === "jobs") return [{run_attempt:2,steps:[...(legacy ? [] : [{name:"Restore daily model budget"}]),{name:"Generate daily digest",started_at:"2026-11-11T01:00:00Z",conclusion:"failure"}]}];
    return missing ? [] : [{id:12,name:"model-budget-2026-11-11-123-2",expired:false,created_at:"2026-11-11T02:00:00Z"}];
  }};
  const options = {github, context:{repo:{owner:"test",repo:"test"},runId:456},core:{setOutput:()=>{},info:()=>{}},now:clock(),dir};
  try {
    await restoreBudget(options);
    assert.equal(await fs.readFile(path.join(dir,"restore.zip"),"utf8"),"zip");
    missing = true;
    await assert.rejects(restoreBudget(options), /refusing to reset budget/);
    await assert.rejects(restoreBudget({...options,context:{...options.context,runId:123},attempt:3}), /refusing to reset budget/);
    missing = false; legacy = true;
    await assert.rejects(restoreBudget(options), /Legacy generation/);
  } finally { await fs.rm(dir, {recursive:true,force:true}); }
});
