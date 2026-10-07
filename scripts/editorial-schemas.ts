// Keep the grammar stable between requests; dynamic article IDs are validated
// against the input map after decoding, rather than recompiling a new grammar.
type Schema = Record<string, unknown>;
const string: Schema = { type: "string" };
const list = (items: Schema): Schema => ({ type: "array", items });
const object = (properties: Record<string, Schema>): Schema => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const choices = (...values: string[]): Schema => ({ type: "string", enum: values });
const layers = list(choices("models", "infrastructure", "agents", "products", "business", "governance"));
const envelope = (item: Schema): Schema => object({ items: list(item) });
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
