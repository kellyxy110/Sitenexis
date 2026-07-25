import type {
  AiGovernanceIssue,
  AiGovernanceReport,
  ContentSignalDirective,
  NamedBotAccess,
} from '@sitenexis/shared';

export interface AiGovernanceInput {
  robotsTxtContent: string;
  hasLlmsTxt: boolean;
  hasAiTxt: boolean;
  hasSecurityTxt: boolean;
}

const NAMED_AI_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'Google-Extended',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'Applebot-Extended',
  'meta-externalagent',
];

/** Bots whose primary purpose is real-time search/reference retrieval, not bulk model training. */
const SEARCH_ORIENTED_BOTS = new Set(['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot']);

function parseContentSignal(robotsTxtContent: string): ContentSignalDirective | null {
  const match = /^\s*Content-Signal\s*:\s*(.+)$/im.exec(robotsTxtContent);
  if (!match?.[1]) return null;

  const raw = match[0].trim();
  const value = match[1].trim();
  const pairs = Object.fromEntries(
    value.split(',').map((pair) => pair.trim().split('=').map((s) => s.trim().toLowerCase())),
  ) as Record<string, string>;

  const asYesNo = (v: string | undefined): 'yes' | 'no' | null =>
    v === 'yes' ? 'yes' : v === 'no' ? 'no' : null;

  return {
    raw,
    search: asYesNo(pairs['search']),
    aiTrain: asYesNo(pairs['ai-train']),
    aiInput: asYesNo(pairs['ai-input']),
    use: pairs['use'] ?? null,
  };
}

function parseNamedBotAccess(robotsTxtContent: string): NamedBotAccess[] {
  const lines = robotsTxtContent.split('\n').map((l) => l.trim());

  return NAMED_AI_BOTS.map((bot) => {
    let inBlock = false;
    let status: NamedBotAccess['status'] = 'unspecified';

    for (const line of lines) {
      const uaMatch = /^user-agent\s*:\s*(.+)$/i.exec(line);
      if (uaMatch?.[1]) {
        inBlock = uaMatch[1].trim().toLowerCase() === bot.toLowerCase();
        continue;
      }
      if (!inBlock) continue;

      const disallowMatch = /^disallow\s*:\s*(.*)$/i.exec(line);
      if (disallowMatch) {
        status = disallowMatch[1].trim() === '' ? 'allowed' : 'disallowed';
      }
      const allowMatch = /^allow\s*:\s*(.*)$/i.exec(line);
      if (allowMatch && allowMatch[1].trim() === '/') {
        status = 'allowed';
      }
    }

    return { bot, status };
  });
}

function hasSitemapDeclaration(robotsTxtContent: string): boolean {
  return /^\s*sitemap\s*:/im.test(robotsTxtContent);
}

export function buildAiGovernanceReport(input: AiGovernanceInput): AiGovernanceReport {
  const issues: AiGovernanceIssue[] = [];
  const contentSignal = parseContentSignal(input.robotsTxtContent);
  const namedBotAccess = parseNamedBotAccess(input.robotsTxtContent);
  const sitemapDeclared = hasSitemapDeclaration(input.robotsTxtContent);

  // ── Content-Signal clarity ──────────────────────────────────────────────────
  let contentSignalClarity: number | null = null;
  if (!contentSignal) {
    issues.push({
      code: 'no_content_signal',
      severity: 'info',
      title: 'No Content-Signal directive declared',
      explanation: 'The Content-Signal directive is an emerging, non-standard convention that lets a domain declare whether AI systems may use its content for search, real-time reference, or model training, separately from crawl access. Its absence is common and not itself a problem.',
      recommendation: 'Consider adding a Content-Signal line to robots.txt if the business wants to make an explicit, machine-readable statement about AI use of its content (e.g. "Content-Signal: search=yes,ai-input=yes,ai-train=no,use=reference").',
    });
  } else {
    contentSignalClarity = 100;
    if (contentSignal.aiInput === null) {
      contentSignalClarity -= 30;
      issues.push({
        code: 'ambiguous_ai_input_policy',
        severity: 'warning',
        title: 'Content-Signal does not declare an ai-input policy',
        explanation: 'The declared Content-Signal specifies search and/or ai-train but omits ai-input, leaving real-time retrieval-augmented-generation use of this content undeclared.',
        recommendation: 'Add an explicit ai-input value (yes or no) to remove ambiguity about whether AI systems may use this content as live grounding for generated answers.',
      });
    }
  }

  // ── AI crawler access balance ────────────────────────────────────────────────
  const specifiedBots = namedBotAccess.filter((b) => b.status !== 'unspecified');
  const searchOrientedSpecified = specifiedBots.filter((b) => SEARCH_ORIENTED_BOTS.has(b.bot));
  const allSearchOrientedBlocked = searchOrientedSpecified.length > 0
    && searchOrientedSpecified.every((b) => b.status === 'disallowed');

  let aiCrawlerAccessBalance = 100;
  if (allSearchOrientedBlocked) {
    aiCrawlerAccessBalance -= 40;
    const trainingAlreadyRestricted = contentSignal?.aiTrain === 'no';
    issues.push({
      code: trainingAlreadyRestricted ? 'training_blocked_but_search_bots_also_blocked' : 'all_major_ai_bots_blocked',
      severity: 'warning',
      title: 'Search-oriented AI crawlers are blocked in robots.txt',
      explanation: trainingAlreadyRestricted
        ? 'Content-Signal already declares ai-train=no, which reserves training rights. Blocking GPTBot, ClaudeBot, and PerplexityBot in robots.txt on top of that also prevents these systems from citing or referencing the content in real-time answers, which is a separate and broader restriction than a training opt-out.'
        : 'GPTBot, ClaudeBot, and PerplexityBot are blocked from crawling. This is a legitimate content-protection choice, but for a business seeking discovery and citations, it also removes a direct pathway into AI-generated answers.',
      recommendation: 'Decide deliberately whether the goal is content protection or AI discoverability. If discoverability matters, allow the search-oriented bots (GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot) while keeping ai-train=no to reserve training rights.',
    });
  }

  // ── AI discovery resource coverage ───────────────────────────────────────────
  let aiDiscoveryResourceCoverage = 0;
  const RESOURCE_WEIGHT = 25;
  if (input.hasLlmsTxt) aiDiscoveryResourceCoverage += RESOURCE_WEIGHT;
  else issues.push({ code: 'missing_llms_txt', severity: 'info', title: 'No llms.txt found', explanation: 'llms.txt is an experimental convention that gives AI systems a concise, curated summary of the site and its key pages.', recommendation: 'Publish an llms.txt summarising the organisation, primary pages, and any AI-use guidance.' });
  if (input.hasAiTxt) aiDiscoveryResourceCoverage += RESOURCE_WEIGHT;
  else issues.push({ code: 'missing_ai_txt', severity: 'info', title: 'No ai.txt found', explanation: 'ai.txt is an experimental, non-standard convention for AI-use and attribution guidance, separate from robots.txt crawl rules.', recommendation: 'Publish an ai.txt if the business wants explicit AI-use guidance beyond the Content-Signal directive.' });
  if (input.hasSecurityTxt) aiDiscoveryResourceCoverage += RESOURCE_WEIGHT;
  else issues.push({ code: 'missing_security_txt', severity: 'info', title: 'No security.txt found', explanation: 'RFC 9116 security.txt gives a canonical, machine-readable disclosure contact — a trust signal AI systems and humans both use to gauge organisational maturity.', recommendation: 'Publish /.well-known/security.txt with a monitored contact and policy URL.' });
  if (sitemapDeclared) aiDiscoveryResourceCoverage += RESOURCE_WEIGHT;
  else issues.push({ code: 'missing_sitemap_declaration', severity: 'warning', title: 'robots.txt does not declare a Sitemap', explanation: 'No `Sitemap:` directive was found in robots.txt, which is the standard way crawlers discover the sitemap without guessing a URL.', recommendation: 'Add `Sitemap: https://<domain>/sitemap.xml` to robots.txt.' });

  const components = [contentSignalClarity, aiCrawlerAccessBalance, aiDiscoveryResourceCoverage].filter(
    (v): v is number => v !== null,
  );
  const overallScore = Math.round(components.reduce((sum, v) => sum + v, 0) / components.length);

  return {
    version: 'ai-governance-v1',
    assessedAt: new Date().toISOString(),
    overallScore,
    scoreBreakdown: { contentSignalClarity, aiCrawlerAccessBalance, aiDiscoveryResourceCoverage },
    contentSignal,
    namedBotAccess,
    hasLlmsTxt: input.hasLlmsTxt,
    hasAiTxt: input.hasAiTxt,
    hasSecurityTxt: input.hasSecurityTxt,
    hasSitemapDeclaration: sitemapDeclared,
    issues,
    limitations: [
      'Content-Signal, llms.txt, and ai.txt are emerging, non-standard conventions — not every AI provider is confirmed to read or honour them.',
      'This assessment evaluates declared policy only. It does not verify that any AI provider actually complies with robots.txt or Content-Signal (compliance varies by provider and is not independently confirmable from this domain alone).',
      'A missing resource is not scored as a security failure — most sites do not yet publish these emerging formats.',
    ],
  };
}
