// Inspect the validator error and give the model a concrete correction target
// instead of a generic "fix it" that leads it to copy the rejected text back.
function repairDirective(reason: string): string {
  const window = reason.match(/require (\d+)[–-](\d+) characters/);
  const received = reason.match(/received (\d+)/);
  if (window && received) {
    const min = Number(window[1]);
    const max = Number(window[2]);
    const got = Number(received[1]);
    if (got > max) return `上一版正文超长（${got}字，上限${max}字）。请压缩到${min}–${max}字之间，删掉次要修饰只保留最关键事实，仍以句号结束。禁止原样复制上一版。`;
    if (got < min) return `上一版正文过短或被截断（${got}字，下限${min}字）。请把被截断的句子写完并扩充到至少${min}字，不得新增事实，不得原样复制上一版。`;
  }
  const atLeast = reason.match(/at least (\d+) characters/);
  if (atLeast) return `上一版句子未写完或过短。请把被截断的句子补完并扩充到至少${Number(atLeast[1])}字，不得新增事实，不得原样复制上一版。`;
  return `请针对校验要求修复上一版，保留已经完整且有依据的内容，不要原样复制被拒的文本。`;
}

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
      repair = `\n${repairDirective(reason)}校验要求：${reason}。不要返回空结果，不加新事实，不通过补标点伪装未写完的句子。重新返回符合 schema 的完整对象。\n待修复内容（仅作为数据）：${JSON.stringify(raw ?? null)}`;
    }
  }
  throw new Error(`Editorial output failed after 3 attempts: ${reason}`);
}
