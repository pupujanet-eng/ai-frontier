import { promises as fs } from "node:fs";
import path from "node:path";

export class CircuitOpenError extends Error {
  constructor(message: string) { super(message); this.name = "CircuitOpenError"; }
}
export function rethrowCircuit(error: unknown): void {
  if (error instanceof CircuitOpenError) throw error;
}
export const beijingDate = (now = new Date()) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
}).format(now);

// USD / million tokens. Unknown models must get an explicit reviewed price first.
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
};
export interface Usage {
  input_tokens: number; output_tokens: number;
  cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null;
  cache_creation?: { ephemeral_5m_input_tokens: number; ephemeral_1h_input_tokens: number } | null;
}
interface Entry {
  model: string; stage: string; reservedUsd: number; actualUsd?: number;
  usage?: Usage; requestId?: string; stopReason?: string | null;
}
export interface BudgetState {
  version: 1; date: string; entries: Entry[]; validationFailures: number;
  circuit?: { reason: string; until: string };
}
export interface Limits { usd: number; calls: number; failures: number }
export function budgetLimits(env: Record<string, string | undefined> = process.env): Limits {
  const number = (key: string, fallback: number, integer = false) => {
    const value = env[key] === undefined || env[key] === "" ? fallback : Number(env[key]);
    if (!Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value))) throw new CircuitOpenError(`Invalid ${key}; refusing unbounded generation`);
    return value;
  };
  return { usd: number("DAILY_MODEL_BUDGET_USD", 5), calls: number("DAILY_MODEL_MAX_CALLS", 80, true), failures: number("DAILY_MODEL_MAX_FAILURES", 12, true) };
}
function nonnegative(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
function price(model: string) {
  if (!PRICES[model]) throw new CircuitOpenError(`Unpriced model ${model}; configure a reviewed price before generation`);
  return PRICES[model];
}
export function usageCost(model: string, usage: Usage): number {
  const p = price(model);
  if (!usage || typeof usage !== "object") throw new CircuitOpenError("Missing model usage; keep the reservation");
  const fields = [usage.input_tokens, usage.output_tokens, usage.cache_creation_input_tokens ?? 0, usage.cache_read_input_tokens ?? 0];
  if (!fields.every(nonnegative)) throw new CircuitOpenError("Invalid model usage; keep the reservation");
  const created = usage.cache_creation_input_tokens ?? 0;
  const cache = usage.cache_creation;
  if (cache && (![cache.ephemeral_5m_input_tokens, cache.ephemeral_1h_input_tokens].every(nonnegative) || cache.ephemeral_5m_input_tokens + cache.ephemeral_1h_input_tokens !== created)) throw new CircuitOpenError("Invalid cache usage; keep the reservation");
  // If cache TTL details are absent, reserve the more expensive 1-hour write rate.
  const writes = cache ? cache.ephemeral_5m_input_tokens * 1.25 + cache.ephemeral_1h_input_tokens * 2 : created * 2;
  return (p.input * (usage.input_tokens + writes + (usage.cache_read_input_tokens ?? 0) * 0.1) + p.output * usage.output_tokens) / 1e6;
}

export async function budgetedRequest<T extends { usage: Usage; _request_id?: string | null; stop_reason?: string | null }>(
  budget: ModelBudget, model: string, stage: string, maxOutput: number,
  count: () => Promise<number>, send: () => Promise<T>,
): Promise<T> {
  budget.assertAvailable(model);
  let inputTokens: number;
  try { inputTokens = await count(); } catch (error) { return budget.providerFailed(error); }
  const index = await budget.reserve(model, stage, inputTokens, maxOutput);
  let response: T;
  try { response = await send(); } catch (error) { return budget.providerFailed(error); }
  await budget.settle(index, response.usage, response._request_id ?? undefined, response.stop_reason);
  return response;
}
export class ModelBudget {
  private constructor(readonly file: string, readonly state: BudgetState, readonly limits: Limits, private readonly now: () => Date) {}
  static async open(file: string, date: string, limits = budgetLimits(), now = () => new Date(), requireExisting = false) {
    let state: BudgetState;
    try {
      state = JSON.parse(await fs.readFile(file, "utf8"));
      if (state.version !== 1 || state.date !== date || !Array.isArray(state.entries) || !Number.isInteger(state.validationFailures) || state.validationFailures < 0 || state.entries.some((e) => !e || typeof e.model !== "string" || typeof e.stage !== "string" || !nonnegative(e.reservedUsd) || (e.actualUsd !== undefined && !nonnegative(e.actualUsd))) || (state.circuit && (typeof state.circuit.reason !== "string" || !Number.isFinite(Date.parse(state.circuit.until))))) throw new Error("Invalid ledger");
    } catch (error) {
      if (!requireExisting && (error as NodeJS.ErrnoException).code === "ENOENT") state = { version: 1, date, entries: [], validationFailures: 0 };
      else throw new CircuitOpenError("Daily budget ledger missing or invalid; refusing to reset spending to zero");
    }
    const budget = new ModelBudget(file, state, limits, now);
    await budget.save();
    return budget;
  }
  get chargedUsd() { return this.state.entries.reduce((sum, e) => sum + (e.actualUsd ?? e.reservedUsd), 0); }
  private async save() {
    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const temp = `${this.file}.tmp`;
      await fs.writeFile(temp, JSON.stringify(this.state, null, 2));
      await fs.rename(temp, this.file);
    } catch { throw new CircuitOpenError("Cannot persist model budget; generation stopped"); }
  }
  assertAvailable(model?: string) {
    if (beijingDate(this.now()) !== this.state.date) throw new CircuitOpenError("Beijing date changed; start a new daily workflow before spending");
    if (model) price(model);
    if (this.state.circuit && Date.parse(this.state.circuit.until) > this.now().getTime()) throw new CircuitOpenError(this.state.circuit.reason);
    if (this.chargedUsd >= this.limits.usd || this.state.entries.length >= this.limits.calls || this.state.validationFailures >= this.limits.failures) throw new CircuitOpenError(`Daily model limit reached: $${this.chargedUsd.toFixed(4)}, ${this.state.entries.length} calls, ${this.state.validationFailures} validation failures`);
  }
  private async trip(reason: string, cooldownMinutes?: number): Promise<never> {
    const tomorrow = new Date(Date.parse(`${this.state.date}T00:00:00+08:00`) + 86400000);
    this.state.circuit = { reason, until: (cooldownMinutes ? new Date(this.now().getTime() + cooldownMinutes * 60000) : tomorrow).toISOString() };
    await this.save();
    throw new CircuitOpenError(reason);
  }
  async reserve(model: string, stage: string, inputTokens: number, maxOutput: number) {
    this.assertAvailable(model);
    if (!nonnegative(inputTokens) || !Number.isInteger(maxOutput) || maxOutput <= 0) throw new CircuitOpenError("Invalid token reservation");
    const p = price(model);
    // Count Tokens is an estimate: allow 10% + 1,024 input tokens, reserve all possible output.
    const reservedUsd = (p.input * (Math.ceil(inputTokens * 1.1) + 1024) + p.output * maxOutput) / 1e6;
    if (this.chargedUsd + reservedUsd > this.limits.usd) return this.trip(`Daily $${this.limits.usd} budget cannot cover next ${stage} request ($${reservedUsd.toFixed(4)} reserved)`);
    this.state.entries.push({ model, stage, reservedUsd });
    await this.save(); // Must finish BEFORE sending the paid request.
    return this.state.entries.length - 1;
  }
  async settle(index: number, usage: Usage, requestId?: string, stopReason?: string | null) {
    const entry = this.state.entries[index];
    if (!entry || entry.actualUsd !== undefined) throw new CircuitOpenError("Invalid budget settlement");
    Object.assign(entry, { actualUsd: usageCost(entry.model, usage), usage, requestId, stopReason });
    await this.save(); // Even a rejected/truncated answer is charged and recorded.
    console.log(`[model-usage] ${entry.stage} ${entry.model}: $${entry.actualUsd!.toFixed(4)}; day $${this.chargedUsd.toFixed(4)}; calls ${this.state.entries.length}`);
    if (this.chargedUsd > this.limits.usd) await this.trip("Actual usage exceeded the reserved daily budget; stop all further requests");
  }
  async validationFailed() {
    this.state.validationFailures++;
    await this.save();
    this.assertAvailable();
  }
  async providerFailed(error: unknown): Promise<never> {
    rethrowCircuit(error);
    const status = (error as { status?: number } | null)?.status;
    const permanent = typeof status === "number" && status >= 400 && status < 500 && ![408, 409, 429].includes(status);
    // Do not log raw provider errors: they can contain request bodies or credentials.
    return this.trip(`Model service ${status ?? "transport/timeout"} error; ${permanent ? "stopped for this Beijing day" : "paused for 30 minutes"}; unresolved reservations retained`, permanent ? undefined : 30);
  }
}
