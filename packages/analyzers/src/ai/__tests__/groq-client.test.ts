import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  complete: vi.fn(),
  getGroqFastAdapter: vi.fn(),
  emitAiCall: vi.fn(),
}));

vi.mock('@sitenexis/adapters', () => ({
  getGroqFastAdapter: h.getGroqFastAdapter,
}));
vi.mock('../telemetry', () => ({ emitAiCall: h.emitAiCall }));

let callGroq: typeof import('../groq-client').callGroq;
let isGroqConfigured: typeof import('../groq-client').isGroqConfigured;
let GROQ_MODEL: typeof import('../groq-client').GROQ_MODEL;

beforeEach(async () => {
  vi.clearAllMocks();
  h.getGroqFastAdapter.mockReturnValue({ complete: h.complete });
  ({ callGroq, isGroqConfigured, GROQ_MODEL } = await import('../groq-client'));
});

describe('isGroqConfigured', () => {
  const original = process.env['GROQ_API_KEY'];
  afterEach(() => { process.env['GROQ_API_KEY'] = original; });

  it('false when unset', () => {
    delete process.env['GROQ_API_KEY'];
    expect(isGroqConfigured()).toBe(false);
  });
  it('false when a placeholder value', () => {
    process.env['GROQ_API_KEY'] = 'placeholder-key';
    expect(isGroqConfigured()).toBe(false);
  });
  it('true when a real-looking key is set', () => {
    process.env['GROQ_API_KEY'] = 'gsk_realkey1234567890';
    expect(isGroqConfigured()).toBe(true);
  });
});

describe('callGroq', () => {
  it('uses the default entity-extraction system prompt and model when no options are given (backward compatible)', async () => {
    h.complete.mockResolvedValueOnce({ content: '{"a":1}', model: GROQ_MODEL, provider: 'groq', latencyMs: 120 });
    const result = await callGroq<{ a: number }>('classify this');
    expect(result).toEqual({ a: 1 });
    expect(h.complete).toHaveBeenCalledWith(expect.objectContaining({ model: GROQ_MODEL, userPrompt: 'classify this' }));
    expect(h.complete.mock.calls[0]![0].ctx).toBeUndefined();
  });

  it('passes a custom systemPrompt and timeoutMs through to the adapter as ctx.timeoutMs', async () => {
    h.complete.mockResolvedValueOnce({ content: '{"ok":true}', model: GROQ_MODEL, provider: 'groq', latencyMs: 80 });
    await callGroq('classify', { systemPrompt: 'custom prompt', timeoutMs: 8_000, maxTokens: 512, temperature: 0.1 });
    expect(h.complete).toHaveBeenCalledWith(expect.objectContaining({
      systemPrompt: 'custom prompt',
      maxTokens: 512,
      temperature: 0.1,
      ctx: { timeoutMs: 8_000 },
    }));
  });

  it('emits a success telemetry event on success', async () => {
    h.complete.mockResolvedValueOnce({ content: '{"a":1}', model: GROQ_MODEL, provider: 'groq', latencyMs: 55, inputTokens: 10, outputTokens: 5 });
    await callGroq('x');
    expect(h.emitAiCall).toHaveBeenCalledWith(expect.objectContaining({ success: true, provider: 'groq', latencyMs: 55, inputTokens: 10, outputTokens: 5 }));
  });

  it('rethrows and emits a failure telemetry event on adapter error', async () => {
    h.complete.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(callGroq('x')).rejects.toThrow('socket hang up');
    expect(h.emitAiCall).toHaveBeenCalledWith(expect.objectContaining({ success: false, provider: 'groq' }));
  });

  it('never leaks API key material into the emitted telemetry errorCode', async () => {
    h.complete.mockRejectedValueOnce(new Error('401 Incorrect API key provided: gsk_liveSecretValue1234567890'));
    await expect(callGroq('x')).rejects.toThrow();
    const event = h.emitAiCall.mock.calls[0]![0];
    expect(event.errorCode).not.toContain('gsk_liveSecretValue1234567890');
    expect(event.errorCode).toContain('[redacted]');
  });

  it('propagates an AbortError from the adapter (timeout) to the caller unmodified in kind', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    h.complete.mockRejectedValueOnce(abortErr);
    await expect(callGroq('x', { timeoutMs: 1_000 })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
