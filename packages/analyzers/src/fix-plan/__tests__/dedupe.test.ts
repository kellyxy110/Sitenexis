import { describe, it, expect } from 'vitest';
import { buildFixPlan, type IssueRecord } from '../engine';

// ─── Fixture ──────────────────────────────────────────────────────────────────

function issue(overrides: Partial<IssueRecord> & Pick<IssueRecord, 'id'>): IssueRecord {
  return {
    module: 'seo',
    type: 'missing_alt_text',
    severity: 'warning',
    message: 'Image is missing alt text',
    recommendation: 'Add descriptive alt text to every content image.',
    pageUrl: null,
    problem: null,
    solution: null,
    fixCode: null,
    fixLanguage: null,
    ...overrides,
  };
}

describe('buildFixPlan — action-plan de-duplication', () => {
  it('collapses the same fix repeated across many pages into one action', () => {
    const issues: IssueRecord[] = [
      issue({ id: '1', pageUrl: 'https://x.com/a' }),
      issue({ id: '2', pageUrl: 'https://x.com/b' }),
      issue({ id: '3', pageUrl: 'https://x.com/c' }),
    ];

    const plan = buildFixPlan({ domain: 'x.com', issues, subReportIssues: {} });

    const altItems = plan.items.filter((i) => i.type === 'missing_alt_text');
    expect(altItems).toHaveLength(1);
    expect(altItems[0]!.message).toContain('affects 3 pages');
  });

  it('keeps the most severe representative when duplicates disagree on severity', () => {
    const issues: IssueRecord[] = [
      issue({ id: '1', severity: 'info', pageUrl: 'https://x.com/a' }),
      issue({ id: '2', severity: 'critical', pageUrl: 'https://x.com/b' }),
    ];

    const plan = buildFixPlan({ domain: 'x.com', issues, subReportIssues: {} });

    const altItems = plan.items.filter((i) => i.type === 'missing_alt_text');
    expect(altItems).toHaveLength(1);
    expect(altItems[0]!.severity).toBe('critical');
  });

  it('does not merge genuinely different fixes', () => {
    const issues: IssueRecord[] = [
      issue({ id: '1', type: 'missing_alt_text', recommendation: 'Add alt text.' }),
      issue({ id: '2', type: 'missing_title', recommendation: 'Add a <title> tag.', message: 'Page has no title' }),
    ];

    const plan = buildFixPlan({ domain: 'x.com', issues, subReportIssues: {} });

    expect(plan.items).toHaveLength(2);
  });

  it('does not annotate page count for a single-page fix', () => {
    const issues: IssueRecord[] = [issue({ id: '1', pageUrl: 'https://x.com/a' })];

    const plan = buildFixPlan({ domain: 'x.com', issues, subReportIssues: {} });

    expect(plan.items[0]!.message).not.toContain('affects');
  });
});
