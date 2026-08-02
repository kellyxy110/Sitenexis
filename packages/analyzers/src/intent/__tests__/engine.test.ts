import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  callGroq: vi.fn(),
  isGroqConfigured: vi.fn(),
}));

vi.mock('../../ai/groq-client', () => ({
  callGroq: h.callGroq,
  isGroqConfigured: h.isGroqConfigured,
  GROQ_MODEL: 'llama-3.1-8b-instant',
}));

import { runScoutAnalysis, type ScoutEngineInput } from '../engine';
import * as modelRouter from '../../ai/model-router';

function page(overrides: Partial<ScoutEngineInput['pages'][number]> = {}): ScoutEngineInput['pages'][number] {
  return {
    url: 'https://example.com/pricing',
    title: 'Pricing',
    headings: ['Our Plans'],
    bodyText: 'Choose a plan and buy now. Compare pricing tiers and checkout.',
    wordCount: 40,
    hasSchema: false,
    schemaTypes: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.isGroqConfigured.mockReturnValue(true);
});

describe('runScoutAnalysis — Groq-backed intent classification', () => {
  it('classifies successfully via Groq and reports it in the pipeline detail', async () => {
    h.callGroq.mockResolvedValue({
      primaryIntent: 'commercial', primaryConfidence: 0.9,
      secondaryIntents: [], intentSignals: ['pricing', 'checkout'],
    });

    const result = await runScoutAnalysis({ domain: 'example.com', pages: [page()] });

    expect(result.state).toBe('complete');
    expect(result.pageIntents[0]).toMatchObject({ primaryIntent: 'commercial', primaryConfidence: 0.9 });
    expect(result.pipeline.reasoning.detail).toMatch(/1 via Groq \(llama-3\.1-8b-instant\)/);
    expect(result.pipeline.reasoning.detail).toMatch(/0 via deterministic keyword fallback/);
  });

  it('falls back to deterministic keyword classification on a Groq timeout (AbortError), and the audit still completes', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    h.callGroq.mockRejectedValue(abortErr);

    const result = await runScoutAnalysis({ domain: 'example.com', pages: [page()] });

    expect(result.state).toBe('complete');
    expect(result.pageIntents[0]?.primaryIntent).toBe('commercial'); // keyword fallback still finds "buy"/"pricing"
    expect(result.pageIntents[0]?.intentSignals).toContain('Classified via keyword fallback — AI model unavailable');
    expect(result.pipeline.reasoning.detail).toMatch(/1 via deterministic keyword fallback \(1 timed out\)/);
  });

  it('falls back to deterministic classification on a Groq 4xx/5xx error (non-timeout), without counting it as a timeout', async () => {
    h.callGroq.mockRejectedValue(new Error('502 Bad Gateway'));

    const result = await runScoutAnalysis({ domain: 'example.com', pages: [page()] });

    expect(result.state).toBe('complete');
    expect(result.pageIntents[0]?.intentSignals).toContain('Classified via keyword fallback — AI model unavailable');
    expect(result.pipeline.reasoning.detail).not.toMatch(/timed out/);
  });

  it('falls back immediately without calling Groq when GROQ_API_KEY is not configured', async () => {
    h.isGroqConfigured.mockReturnValue(false);

    const result = await runScoutAnalysis({ domain: 'example.com', pages: [page()] });

    expect(h.callGroq).not.toHaveBeenCalled();
    expect(result.pageIntents[0]?.intentSignals).toContain('Classified via keyword fallback — AI model unavailable');
  });

  it('falls back to deterministic classification when Groq returns a malformed/unparseable response', async () => {
    h.callGroq.mockRejectedValue(new SyntaxError('Unexpected token in JSON'));

    const result = await runScoutAnalysis({ domain: 'example.com', pages: [page()] });

    expect(result.pageIntents[0]?.intentSignals).toContain('Classified via keyword fallback — AI model unavailable');
  });

  it('the deterministic fallback distinguishes intent by content keywords, not a single default', async () => {
    h.isGroqConfigured.mockReturnValue(false);

    const result = await runScoutAnalysis({
      domain: 'example.com',
      pages: [
        page({ url: 'https://example.com/how-to-fix', title: 'Troubleshooting Guide', headings: ['Fix It'], bodyText: 'Step by step tutorial: how to troubleshoot and fix the issue.' }),
        page({ url: 'https://example.com/about', title: 'About Us', headings: ['Our Team'], bodyText: 'About our team and contact information.' }),
      ],
    });

    expect(result.pageIntents[0]?.primaryIntent).toBe('learn_and_solve');
    expect(result.pageIntents[1]?.primaryIntent).toBe('navigational');
  });

  it('the audit continues and produces a complete result even when every page fails classification', async () => {
    h.callGroq.mockRejectedValue(new Error('network error'));

    const result = await runScoutAnalysis({
      domain: 'example.com',
      pages: [page(), page({ url: 'https://example.com/b' }), page({ url: 'https://example.com/c' })],
    });

    expect(result.state).toBe('complete');
    expect(result.pagesAnalyzed).toBe(3);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('never calls the OpenRouter model router (no dead Hermes/Qwen model call remains)', async () => {
    const routeTaskSpy = vi.spyOn(modelRouter, 'routeTask');
    h.callGroq.mockResolvedValue({ primaryIntent: 'informational', primaryConfidence: 0.7, secondaryIntents: [], intentSignals: [] });

    await runScoutAnalysis({ domain: 'example.com', pages: [page()] });

    expect(routeTaskSpy).not.toHaveBeenCalled();
  });

  it('bounds the Groq call with a fixed timeout (8s), not the adapter default or an unbounded wait', async () => {
    h.callGroq.mockResolvedValue({ primaryIntent: 'informational', primaryConfidence: 0.7, secondaryIntents: [], intentSignals: [] });

    await runScoutAnalysis({ domain: 'example.com', pages: [page()] });

    expect(h.callGroq).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ timeoutMs: 8_000 }));
  });

  it('classifies each page exactly once (no duplicate classification calls per page)', async () => {
    h.callGroq.mockResolvedValue({ primaryIntent: 'informational', primaryConfidence: 0.7, secondaryIntents: [], intentSignals: [] });

    await runScoutAnalysis({
      domain: 'example.com',
      pages: [page(), page({ url: 'https://example.com/b' }), page({ url: 'https://example.com/c' })],
    });

    expect(h.callGroq).toHaveBeenCalledTimes(3);
  });
});
