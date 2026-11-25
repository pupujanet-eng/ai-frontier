// Classification IDs are validated against the input map after decoding.
// Topic citations additionally receive an input-specific enum below.
type Schema = Record<string, unknown>;
const string: Schema = { type: "string" };
const list = (items: Schema): Schema => ({ type: "array", items });
const object = (properties: Record<string, Schema>): Schema => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const choices = (...values: string[]): Schema => ({ type: "string", enum: values });
const layers = list(choices("models", "infrastructure", "agents", "products", "business", "governance"));
const envelope = (item: Schema): Schema => object({ items: list(item) });
const single = (item: Schema): Schema => object({ item });
export const CLASSIFICATION_SCHEMA = envelope(object({
  id: string, include: { type: "boolean" }, titleZh: string, summaryZh: string,
  whyItMatters: string, limitations: string, insight: string,
  importance: { type: "integer", enum: [1,2,3,4,5,6,7,8,9,10] },
  evidenceQuality: choices("substantial", "limited"),
  relevance: choices("general", "a2a", "agent-ads", "geo"), tags: list(string), layers,
}));
export const PLAN_SCHEMA = envelope(object({ title: string, sourceIds: list(string) }));
export const TOPIC_SCHEMA = envelope(object({
  title: string, thesis: string, whyNow: string, layers,
  sections: list(object({ heading: string, body: string, sourceIds: list(string), kind: choices("fact", "analysis", "uncertainty") })),
  watchNext: list(string),
}));

// Constrain citations during decoding as well as validating them after generation.
export function withSourceIds(schema: Schema, ids: string[]): Schema {
  const copy = structuredClone(schema);
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "sourceIds") (value as Schema)[key] = list({ type: "string", enum: ids });
      else visit(child);
    }
  }
  visit(copy);
  return copy;
}

export const CORE_INSIGHT_SCHEMA = envelope(object({
  takeaway: string, highlights: list(string), boundary: string,
  points: list(object({ title: string, fact: string, meaning: string, watch: string, highlights: list(string), sourceIds: list(string) })),
}));

export const TOPIC_HEADER_SCHEMA = single(object({ title: string, thesis: string, whyNow: string, layers, watchNext: list(string) }));
export const TOPIC_SECTION_SCHEMA = single(object({ body: string, sourceIds: list(string) }));

export const CORE_POINT_SCHEMA = single(object({ title: string, fact: string, meaning: string, watch: string, highlights: list(string), sourceIds: list(string) }));
export const CORE_SUMMARY_SCHEMA = single(object({ takeaway: string, highlights: list(string), boundary: string }));

// Fixed required keys prevent a valid-but-empty items array from consuming retries.
// Uses the object/required/enum subset supported by Claude structured outputs.
export function classificationSchema(ids: string[]): Schema {
  if (!ids.length || ids.length > 4 || new Set(ids).size !== ids.length) throw new Error("Classification needs 1–4 unique article IDs");
  const base = (CLASSIFICATION_SCHEMA.properties as Record<string, Schema>).items.items as Schema;
  return object({ articles: object(Object.fromEntries(ids.map((id) => {
    const row = structuredClone(base);
    (row.properties as Record<string, Schema>).id = choices(id);
    return [id, row];
  }))) });
}
export function classificationRows(value: unknown, schema: Schema): unknown[] {
  const articles = (value as {articles?:unknown} | null)?.articles;
  const expected = ((schema.properties as Record<string, Schema>).articles.required as string[]);
  if (!articles || typeof articles !== "object" || Array.isArray(articles)) throw new Error("Missing classification article map");
  const rows = articles as Record<string, {id?:unknown}>;
  if (Object.keys(rows).length !== expected.length || expected.some((id) => !Object.hasOwn(rows,id) || rows[id]?.id !== id)) throw new Error("Classification article map has missing, unknown or mismatched IDs");
  return expected.map((id) => rows[id]);
}
