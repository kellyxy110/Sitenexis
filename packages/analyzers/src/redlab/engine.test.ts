import { describe, expect, it } from 'vitest';
import { buildRedLabReport } from './engine';

describe('redlab engine', () => {
  it('scores full marks when every probed sensitive path returns a non-2xx status and no scripts are present', () => {
    const report = buildRedLabReport({
      pathProbeResults: [{ path: '/.env', statusCode: 404 }, { path: '/.git/config', statusCode: 403 }],
      scriptSources: [],
    });
    expect(report.exposedPaths).toHaveLength(0);
    expect(report.scoreBreakdown.exposedPathFreedom).toBe(100);
    expect(report.scoreBreakdown.libraryFreshness).toBeNull();
  });

  it('flags a publicly reachable .env file as critical with a named finding', () => {
    const report = buildRedLabReport({
      pathProbeResults: [{ path: '/.env', statusCode: 200 }],
      scriptSources: [],
    });
    const finding = report.exposedPaths.find((f) => f.path === '/.env');
    expect(finding?.severity).toBe('critical');
    expect(report.scoreBreakdown.exposedPathFreedom).toBe(70);
    expect(report.issues.some((i) => i.code.includes('env'))).toBe(true);
  });

  it('detects an outdated jQuery version from a script source URL', () => {
    const report = buildRedLabReport({
      pathProbeResults: [],
      scriptSources: ['https://cdn.example.com/jquery-1.12.4.min.js'],
    });
    const finding = report.vulnerableLibraries.find((f) => f.library === 'jQuery');
    expect(finding?.detectedVersion).toBe('1.12.4');
    expect(finding?.cveReferences.length).toBeGreaterThan(0);
    expect(report.scoreBreakdown.libraryFreshness).toBeLessThan(100);
  });

  it('does not flag a current jQuery version as vulnerable', () => {
    const report = buildRedLabReport({
      pathProbeResults: [],
      scriptSources: ['https://cdn.example.com/jquery-3.7.1.min.js'],
    });
    expect(report.vulnerableLibraries).toHaveLength(0);
    expect(report.scoreBreakdown.libraryFreshness).toBe(100);
  });

  it('ignores probe results for paths that are not on the sensitive-path list, even if they 200', () => {
    const report = buildRedLabReport({
      pathProbeResults: [{ path: '/about', statusCode: 200 }],
      scriptSources: [],
    });
    expect(report.exposedPaths).toHaveLength(0);
  });

  it('never attempts exploitation — limitations explicitly state read-only scope', () => {
    const report = buildRedLabReport({ pathProbeResults: [], scriptSources: [] });
    expect(report.limitations.some((l) => l.includes('read-only'))).toBe(true);
  });
});
