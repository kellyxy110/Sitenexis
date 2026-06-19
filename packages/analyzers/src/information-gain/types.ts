// Internal types for the Information Gain Engine.
// These are NOT exported to @sitenexis/shared — they are implementation details only.

export interface CohortPageRaw {
  url: string;
  html: string;
  title: string;
  wordCount: number;
  crawlSuccess: boolean;
}
