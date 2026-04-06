export interface DigestItem {
  id: string;
  title: string;
  titleZh: string;
  summary: string;
  summaryZh: string;
  insight: string; // AI-generated insight for PM perspective
  url: string;
  source: string;
  category: "github" | "research" | "industry" | "thought-leader" | "chinese";
  tags: string[];
  relevance: "a2a" | "agent-ads" | "geo" | "general"; // your 3 core projects
  date: string;
}

export interface DailyDigest {
  date: string; // YYYY-MM-DD
  dateZh: string; // 中文日期
  highlights: DigestItem[]; // top 3-5 must-reads
  github: DigestItem[];
  research: DigestItem[];
  industry: DigestItem[];
  thoughtLeaders: DigestItem[];
  chinese: DigestItem[];
  editorNote: string; // Claude's daily synthesis note
}
