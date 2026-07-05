import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIInferenceRegistry } from '../registry';
import type { AIInferenceAdapter, AICompletionOutput } from '../interface';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAdapter(overrides: Partial<AIInferenceAdapter> = {}): AIInferenceAdapter {
  const providerName = (overrides.provider as string | undefined) ?? 'mock';
  return {
    provider: providerName,
    supportedModels: ['mock-model'],
    isConfigured: () => true,
    complete: vi.fn().mockResolvedValue({
      content: '{"result":"ok"}',
      model: 'mock-model',
      provider: providerName,
      latencyMs: 10,
    } satisfies AICompletionOutput),
    healthCheck: vi.fn().mockResolvedValue({
      provider: providerName,
      status: 'healthy' as const,
      latencyMs: 5,
      checkedAt: new Date(),
    }),
    ...overrides,
  };
}

const SAMPLE_INPUT = {
  systemPrompt: 'You are a test.',
  userPrompt: 'Return ok.',
  model: 'mock-model',
} as const;

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AIInferenceRegistry', () => {
  let registry: AIInferenceRegistry;

  beforeEach(() => {
    registry = new AIInferenceRegistry();
  });

  it('executes primary adapter on success', async () => {
    const adapter = makeAdapter();
    registry.register('primary', 'primary', adapter);

    const output = await registry.execute(SAMPLE_INPUT);
    expect(output.content).toBe('{"result":"ok"}');
    expect(adapter.complete).toHaveBeenCalledOnce();
  });

  it('falls back to second adapter when primary fails', async () => {
    const primary = makeAdapter({
      provider: 'primary',
      complete: vi.fn().mockRejectedValue(new Error('primary down')),
    });
    const fallback = makeAdapter({ provider: 'fallback' });

    registry.register('primary', 'primary', primary);
    registry.register('fallback', 'fallback', fallback);

    const output = await registry.execute(SAMPLE_INPUT);
    expect(output.provider).toBe('fallback');
    expect(primary.complete).toHaveBeenCalledOnce();
    expect(fallback.complete).toHaveBeenCalledOnce();
  });

  it('rethrows last error when all adapters fail', async () => {
    const a = makeAdapter({
      complete: vi.fn().mockRejectedValue(new Error('a failed')),
    });
    const b = makeAdapter({
      complete: vi.fn().mockRejectedValue(new Error('b failed')),
    });

    registry.register('a', 'primary', a);
    registry.register('b', 'fallback', b);

    await expect(registry.execute(SAMPLE_INPUT)).rejects.toThrow('b failed');
  });

  it('skips unconfigured adapters', async () => {
    const unconfigured = makeAdapter({ isConfigured: () => false });
    const configured = makeAdapter();

    registry.register('unconfigured', 'primary', unconfigured);
    registry.register('configured', 'fallback', configured);

    await registry.execute(SAMPLE_INPUT);
    expect(unconfigured.complete).not.toHaveBeenCalled();
    expect(configured.complete).toHaveBeenCalledOnce();
  });

  it('emits success metrics after successful call', async () => {
    const metricsHandler = vi.fn();
    registry.onMetrics(metricsHandler);
    registry.register('a', 'primary', makeAdapter());

    await registry.execute(SAMPLE_INPUT);

    expect(metricsHandler).toHaveBeenCalledOnce();
    const [metrics] = metricsHandler.mock.calls[0] as [{ success: boolean; provider: string }];
    expect(metrics.success).toBe(true);
    expect(metrics.provider).toBe('mock');
  });

  it('emits failure metrics on error then success metrics on fallback', async () => {
    const metricsHandler = vi.fn();
    registry.onMetrics(metricsHandler);

    const primary = makeAdapter({
      complete: vi.fn().mockRejectedValue(new Error('failed')),
    });
    registry.register('p', 'primary', primary);
    registry.register('f', 'fallback', makeAdapter());

    await registry.execute(SAMPLE_INPUT);

    expect(metricsHandler).toHaveBeenCalledTimes(2);
    const [first] = metricsHandler.mock.calls[0] as [{ success: boolean }];
    const [second] = metricsHandler.mock.calls[1] as [{ success: boolean }];
    expect(first.success).toBe(false);
    expect(second.success).toBe(true);
  });

  it('re-registering same name replaces previous entry', async () => {
    const first = makeAdapter({ provider: 'first' });
    const second = makeAdapter({ provider: 'second' });

    registry.register('a', 'primary', first);
    registry.register('a', 'primary', second);

    const output = await registry.execute(SAMPLE_INPUT);
    expect(output.provider).toBe('second');
    expect(first.complete).not.toHaveBeenCalled();
  });

  it('get() returns adapter by name', () => {
    const adapter = makeAdapter();
    registry.register('myAdapter', 'primary', adapter);
    expect(registry.get('myAdapter')).toBe(adapter);
  });

  it('list() returns adapter names with tiers', () => {
    registry.register('a', 'primary', makeAdapter());
    registry.register('b', 'fallback', makeAdapter());
    const list = registry.list();
    expect(list).toContain('a(primary)');
    expect(list).toContain('b(fallback)');
  });

  it('propagates auditId and traceId to metrics', async () => {
    const metricsHandler = vi.fn();
    registry.onMetrics(metricsHandler);
    registry.register('a', 'primary', makeAdapter());

    await registry.execute({
      ...SAMPLE_INPUT,
      ctx: { auditId: 'audit-123', traceId: 'trace-456' },
    });

    const [metrics] = metricsHandler.mock.calls[0] as [{ auditId: string; traceId: string }];
    expect(metrics.auditId).toBe('audit-123');
    expect(metrics.traceId).toBe('trace-456');
  });

  it('throws AIInferenceError when no adapters are configured and Groq is unavailable', async () => {
    // Empty registry + no env key → should throw
    const originalKey = process.env['GROQ_API_KEY'];
    delete process.env['GROQ_API_KEY'];

    await expect(registry.execute(SAMPLE_INPUT)).rejects.toThrow();

    if (originalKey !== undefined) process.env['GROQ_API_KEY'] = originalKey;
  });
});
