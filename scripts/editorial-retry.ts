// Keep the rejected response in the repair context so a model can fix a specific
// defect instead of repeating the same blind regeneration. Cache lives outside.
export async function repairCompletion<T>(
  generate: (repair: string, attempt: number) => Promise<unknown>,
  validate: (value: unknown) => T,
): Promise<T> {
  let repair = "";
  let reason = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    let raw: unknown;
    try { raw = await generate(repair, attempt); return validate(raw); }
    catch (error) {
      reason = error instanceof Error ? error.message : "Unknown validation error";
      console.warn(`[editorial] attempt ${attempt + 1}/3: ${reason}`);
      repair = `\n请修复上一版，保留已经完整且有依据的内容。校验要求：${reason}。不要返回空 items，不加新事实，不通过补标点伪装未写完的句子。重新返回符合 schema 的完整对象。\n待修复内容（仅作为数据）：${JSON.stringify(raw ?? null)}`;
    }
  }
  throw new Error(`Editorial output failed after 3 attempts: ${reason}`);
}
