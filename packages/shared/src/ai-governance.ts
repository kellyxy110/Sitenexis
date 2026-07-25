/**
 * AI Governance Assessment — models the domain's declared policy toward AI
 * systems: the emerging Content Signals convention (search / ai-train /
 * ai-input / use), which named AI crawlers are allowed or blocked, and
 * whether AI-facing discovery resources (llms.txt, ai.txt, security.txt)
 * are present. Distinct from Machine Trust Security (Section 23): this
 * module evaluates declared policy, not injection/exploit risk.
 */

export type ContentSignalValue = 'yes' | 'no' | null;

export interface ContentSignalDirective {
  /** The raw Content-Signal line as found in robots.txt, unparsed. */
  raw: string;
  search: ContentSignalValue;
  aiTrain: ContentSignalValue;
  aiInput: ContentSignalValue;
  use: string | null;
}

export interface NamedBotAccess {
  bot: string;
  status: 'allowed' | 'disallowed' | 'unspecified';
}

export type AiGovernanceIssueCode =
  | 'no_content_signal'
  | 'ambiguous_ai_input_policy'
  | 'all_major_ai_bots_blocked'
  | 'training_blocked_but_search_bots_also_blocked'
  | 'missing_llms_txt'
  | 'missing_ai_txt'
  | 'missing_security_txt'
  | 'missing_sitemap_declaration';

export interface AiGovernanceIssue {
  code: AiGovernanceIssueCode;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  explanation: string;
  recommendation: string;
}

export interface AiGovernanceScoreBreakdown {
  /** null when robots.txt has no Content-Signal directive at all — not an error, an emerging standard. */
  contentSignalClarity: number | null;
  aiCrawlerAccessBalance: number;
  aiDiscoveryResourceCoverage: number;
}

export interface AiGovernanceReport {
  version: 'ai-governance-v1';
  assessedAt: string;
  overallScore: number;
  scoreBreakdown: AiGovernanceScoreBreakdown;
  contentSignal: ContentSignalDirective | null;
  namedBotAccess: NamedBotAccess[];
  hasLlmsTxt: boolean;
  hasAiTxt: boolean;
  hasSecurityTxt: boolean;
  hasSitemapDeclaration: boolean;
  issues: AiGovernanceIssue[];
  limitations: string[];
}
