import { describe, expect, it } from 'vitest';
import { buildAiGovernanceReport } from './engine';

const NO_RESOURCES = { hasLlmsTxt: false, hasAiTxt: false, hasSecurityTxt: false };

describe('ai governance engine', () => {
  it('treats a missing Content-Signal directive as info, not an error, and leaves the sub-score null', () => {
    const report = buildAiGovernanceReport({ robotsTxtContent: 'User-agent: *\nAllow: /\n', ...NO_RESOURCES });
    expect(report.contentSignal).toBeNull();
    expect(report.scoreBreakdown.contentSignalClarity).toBeNull();
    expect(report.issues.find((i) => i.code === 'no_content_signal')?.severity).toBe('info');
  });

  it('parses a complete Content-Signal directive and scores it fully clear', () => {
    const report = buildAiGovernanceReport({
      robotsTxtContent: 'User-agent: *\nContent-Signal: search=yes,ai-train=no,ai-input=yes,use=reference\nAllow: /\n',
      ...NO_RESOURCES,
    });
    expect(report.contentSignal).toEqual({ raw: expect.stringContaining('Content-Signal'), search: 'yes', aiTrain: 'no', aiInput: 'yes', use: 'reference' });
    expect(report.scoreBreakdown.contentSignalClarity).toBe(100);
  });

  it('flags an ambiguous ai-input policy when Content-Signal omits it', () => {
    const report = buildAiGovernanceReport({
      robotsTxtContent: 'Content-Signal: search=yes,ai-train=no,use=reference\n',
      ...NO_RESOURCES,
    });
    expect(report.scoreBreakdown.contentSignalClarity).toBe(70);
    expect(report.issues.some((i) => i.code === 'ambiguous_ai_input_policy')).toBe(true);
  });

  it('flags blocking search-oriented AI bots as a discoverability tradeoff, distinct from a training opt-out', () => {
    const robotsTxtContent = [
      'Content-Signal: search=yes,ai-train=no,use=reference',
      'User-agent: GPTBot',
      'Disallow: /',
      'User-agent: ClaudeBot',
      'Disallow: /',
      'User-agent: PerplexityBot',
      'Disallow: /',
    ].join('\n');
    const report = buildAiGovernanceReport({ robotsTxtContent, ...NO_RESOURCES });
    const finding = report.issues.find((i) => i.code === 'training_blocked_but_search_bots_also_blocked');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('warning');
    expect(report.namedBotAccess.find((b) => b.bot === 'GPTBot')?.status).toBe('disallowed');
  });

  it('does not flag bot blocking when no AI bots are explicitly specified', () => {
    const report = buildAiGovernanceReport({ robotsTxtContent: 'User-agent: *\nAllow: /\n', ...NO_RESOURCES });
    expect(report.issues.some((i) => i.code === 'all_major_ai_bots_blocked' || i.code === 'training_blocked_but_search_bots_also_blocked')).toBe(false);
    expect(report.scoreBreakdown.aiCrawlerAccessBalance).toBe(100);
  });

  it('scores full discovery-resource coverage when llms.txt, ai.txt, security.txt, and a sitemap declaration are all present', () => {
    const report = buildAiGovernanceReport({
      robotsTxtContent: 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n',
      hasLlmsTxt: true,
      hasAiTxt: true,
      hasSecurityTxt: true,
    });
    expect(report.scoreBreakdown.aiDiscoveryResourceCoverage).toBe(100);
    expect(report.hasSitemapDeclaration).toBe(true);
  });

  it('lists a named info-level issue for each missing discovery resource', () => {
    const report = buildAiGovernanceReport({ robotsTxtContent: 'User-agent: *\nAllow: /\n', ...NO_RESOURCES });
    expect(report.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['missing_llms_txt', 'missing_ai_txt', 'missing_security_txt', 'missing_sitemap_declaration']),
    );
  });
});
