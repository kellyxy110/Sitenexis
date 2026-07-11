import { describe, it, expect } from 'vitest';
import { buildSecurityTrustReport, type SecurityPage } from '../engine';

function page(overrides: Partial<SecurityPage> & Pick<SecurityPage, 'url'>): SecurityPage {
  return {
    bodyText: '',
    title: null,
    internalLinks: [],
    externalLinks: [],
    ...overrides,
  };
}

describe('security scanner — headers', () => {
  it('reports not-assessed (null score) when no headers are supplied', () => {
    const report = buildSecurityTrustReport({ pages: [page({ url: 'https://x.com' })] });
    expect(report.headers.assessed).toBe(false);
    expect(report.headers.score).toBeNull();
    // no header findings fabricated when we never saw the headers
    expect(report.findings.some((f) => f.category === 'security_header')).toBe(false);
  });

  it('scores present headers and flags missing ones', () => {
    const report = buildSecurityTrustReport({
      pages: [page({ url: 'https://x.com' })],
      homepageHeaders: {
        'Content-Security-Policy': "default-src 'self'",
        'Strict-Transport-Security': 'max-age=63072000',
      },
    });
    expect(report.headers.assessed).toBe(true);
    expect(report.headers.present).toContain('content-security-policy');
    expect(report.headers.missing).toContain('x-frame-options');
    expect(report.headers.score).toBeGreaterThan(0);
  });
});

describe('security scanner — secret exposure', () => {
  it('detects and redacts an exposed AWS key', () => {
    const report = buildSecurityTrustReport({
      pages: [page({ url: 'https://x.com/leak', bodyText: 'key AKIAIOSFODNN7EXAMPLE in source' })],
    });
    expect(report.secretsFound).toBe(1);
    const finding = report.findings.find((f) => f.category === 'secret_exposure');
    expect(finding?.severity).toBe('critical');
    expect(finding?.evidence).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(finding?.evidence).toContain('redacted');
  });

  it('does not double-count the same secret across pages', () => {
    const secret = 'AKIAIOSFODNN7EXAMPLE';
    const report = buildSecurityTrustReport({
      pages: [
        page({ url: 'https://x.com/a', bodyText: secret }),
        page({ url: 'https://x.com/b', bodyText: secret }),
      ],
    });
    expect(report.secretsFound).toBe(1);
  });

  it('scans extraText (structured data) too', () => {
    const report = buildSecurityTrustReport({
      pages: [page({ url: 'https://x.com', extraText: '{"token":"sk_live_abcdef0123456789abcd"}' })],
    });
    expect(report.secretsFound).toBeGreaterThanOrEqual(1);
  });
});

describe('security scanner — trust signals', () => {
  it('rewards trust pages and social profiles', () => {
    const report = buildSecurityTrustReport({
      pages: [page({
        url: 'https://x.com',
        internalLinks: ['https://x.com/about', 'https://x.com/contact', 'https://x.com/privacy', 'https://x.com/terms'],
        externalLinks: ['https://linkedin.com/company/x', 'https://github.com/x'],
      })],
    });
    expect(report.trustSignals.present).toEqual(expect.arrayContaining(['about', 'contact', 'privacy', 'terms']));
    expect(report.trustSignals.socialProfiles).toEqual(expect.arrayContaining(['linkedin', 'github']));
    expect(report.trustSignals.score).toBe(100);
  });

  it('flags missing trust pages', () => {
    const report = buildSecurityTrustReport({ pages: [page({ url: 'https://x.com' })] });
    expect(report.findings.some((f) => f.code === 'missing_privacy_page')).toBe(true);
    expect(report.findings.some((f) => f.code === 'no_social_profiles')).toBe(true);
  });
});

describe('security scanner — probes & overall', () => {
  it('flags exposed risky files and penalises the overall score', () => {
    const clean = buildSecurityTrustReport({
      pages: [page({ url: 'https://x.com', internalLinks: ['https://x.com/about', 'https://x.com/contact'] })],
    });
    const exposed = buildSecurityTrustReport({
      pages: [page({ url: 'https://x.com', internalLinks: ['https://x.com/about', 'https://x.com/contact'] })],
      probes: [{ path: '/.env', status: 200 }],
    });
    expect(exposed.riskyFilesExposed).toBe(1);
    expect(exposed.findings.some((f) => f.code === 'risky_file_exposed')).toBe(true);
    expect(exposed.overallScore!).toBeLessThan(clean.overallScore!);
  });

  it('ignores probes that returned non-2xx', () => {
    const report = buildSecurityTrustReport({
      pages: [page({ url: 'https://x.com' })],
      probes: [{ path: '/.env', status: 404 }],
    });
    expect(report.riskyFilesExposed).toBe(0);
  });
});
