import type { FixLanguage } from '@sitenexis/shared';

export type { FixLanguage };

export interface IssueContext {
  issueId: string;
  auditId: string;
  type: string;
  severity: string;
  message: string;
  recommendation: string;
  pageUrl?: string;
  module: string;
  domain?: string;
}

export interface GeneratedFix {
  problem: string;
  solution: string;
  fixCode: string;
  fixLanguage: FixLanguage;
  expectedImpact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  source: 'template' | 'llm';
}
