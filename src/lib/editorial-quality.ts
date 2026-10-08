import type { TrendTopic } from "../types";

export function editorialJudgment(text: string): string {
  return text.replace(/^(?:(?:[（(]?编辑判断[）)]?)[：:·]?\s*)+/, "").trim();
}
function completeSentence(text: string, minimum: number): boolean {
  return text.trim().length >= minimum && /[。！？.!?][”’」』）)"']*$/.test(text.trim());
}
// Valid JSON can still contain prose cut off in the middle of a sentence.
export function isCompleteTopic(topic: Pick<TrendTopic, "thesis" | "whyNow" | "sections">): boolean {
  return completeSentence(editorialJudgment(topic.thesis), 20)
    && completeSentence(topic.whyNow, 40)
    && topic.sections.length >= 3
    && topic.sections.every((section) => completeSentence(section.body, 60))
    && topic.sections.reduce((length, section) => length + section.body.length, 0) >= 400;
}
