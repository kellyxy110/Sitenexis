import { describe, it, expect } from 'vitest';
import {
  canonicalize,
  computeInputHash,
  computeOutputHash,
  signReport,
  attachOutputHash,
  verifyReport,
  generateReportId,
  REPORT_ENGINE_VERSION,
} from '../integrity';

describe('report integrity — canonicalization', () => {
  it('is stable regardless of object key order', () => {
    const a = { domain: 'x.com', scores: { seo: 80, ai: 60 } };
    const b = { scores: { ai: 60, seo: 80 }, domain: 'x.com' };
    expect(canonicalize(a)).toBe(canonicalize(b));
    expect(computeInputHash(a)).toBe(computeInputHash(b));
  });

  it('preserves array order (order is meaningful)', () => {
    expect(computeInputHash([1, 2, 3])).not.toBe(computeInputHash([3, 2, 1]));
  });

  it('drops undefined like JSON.stringify', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe(canonicalize({ a: 1 }));
  });
});

describe('report integrity — signing', () => {
  const input = { domain: 'x.com', auditDate: '2026-07-10T00:00:00.000Z', scores: { overall: 72 } };
  const signedAt = new Date('2026-07-10T12:00:00.000Z');

  it('produces a deterministic signature for the same inputs', () => {
    const s1 = signReport({ auditId: 'aud_123', input, signedAt });
    const s2 = signReport({ auditId: 'aud_123', input, signedAt });
    expect(s1).toEqual(s2);
    expect(s1.inputHash).toHaveLength(64);
    expect(s1.algorithm).toBe('sha256');
    expect(s1.engineVersion).toBe(REPORT_ENGINE_VERSION);
    expect(s1.outputHash).toBeNull();
  });

  it('generates a human-readable, deterministic report id', () => {
    const inputHash = computeInputHash(input);
    const id = generateReportId('aud_123', signedAt, inputHash);
    expect(id).toBe(`SNX-AUD123-20260710-${inputHash.slice(0, 8).toUpperCase()}`);
  });

  it('changes the hash when inputs change', () => {
    const s1 = signReport({ auditId: 'aud_123', input, signedAt });
    const s2 = signReport({ auditId: 'aud_123', input: { ...input, scores: { overall: 73 } }, signedAt });
    expect(s1.inputHash).not.toBe(s2.inputHash);
  });
});

describe('report integrity — verification', () => {
  const input = { domain: 'x.com', scores: { overall: 72 } };
  const artifact = Buffer.from('%PDF-1.7 fake report bytes');

  it('verifies an untampered report (input + output)', () => {
    const signed = attachOutputHash(signReport({ auditId: 'a', input }), artifact);
    const result = verifyReport(signed, input, artifact);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('detects tampered inputs', () => {
    const signed = attachOutputHash(signReport({ auditId: 'a', input }), artifact);
    const result = verifyReport(signed, { domain: 'x.com', scores: { overall: 99 } }, artifact);
    expect(result.valid).toBe(false);
    expect(result.inputValid).toBe(false);
    expect(result.reason).toMatch(/inputs have changed/);
  });

  it('detects a tampered artifact', () => {
    const signed = attachOutputHash(signReport({ auditId: 'a', input }), artifact);
    const result = verifyReport(signed, input, Buffer.from('%PDF-1.7 ALTERED bytes'));
    expect(result.valid).toBe(false);
    expect(result.outputValid).toBe(false);
    expect(result.reason).toMatch(/altered/);
  });

  it('verifies input-only when no artifact is supplied', () => {
    const signed = signReport({ auditId: 'a', input });
    const result = verifyReport(signed, input);
    expect(result.valid).toBe(true);
    expect(result.actualOutputHash).toBeNull();
  });

  it('flags a missing output hash when an artifact is checked', () => {
    const signed = signReport({ auditId: 'a', input }); // never attached an output hash
    const result = verifyReport(signed, input, artifact);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/No output hash/);
  });

  it('outputHash matches an independent computeOutputHash', () => {
    const signed = attachOutputHash(signReport({ auditId: 'a', input }), artifact);
    expect(signed.outputHash).toBe(computeOutputHash(artifact));
  });
});
