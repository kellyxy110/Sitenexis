import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// ── Mock the OpenAI SDK before importing the adapter (no live Agnes credits) ──
vi.mock('openai', () => {
  const create: Mock = vi.fn();
  const MockOpenAI = vi.fn(() => ({ chat: { completions: { create } } }));
  return { default: MockOpenAI, __create: create };
});

const { AgnesAdapter, getAgnesAdapter, DEFAULT_AGNES_MODEL, DEFAULT_AGNES_BASE_URL } = await import('../agnes.adapter');
const OpenAI = (await import('openai')).default as unknown as Mock;
const mockCreate = (new (OpenAI as unknown as new () => { chat: { completions: { create: Mock } } })()).chat.completions.create;

describe('AgnesAdapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a normalized AICompletionOutput on success', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Your biggest weakness is thin content.' } }],
      model: 'agnes-2.0-flash',
      usage: { prompt_tokens: 220, completion_tokens: 60 },
    });
    const adapter = new AgnesAdapter('sk-agnes-test-key-longer-than-10');
    const out = await adapter.complete({ systemPrompt: 'sys', userPrompt: 'explain', model: 'agnes-2.0-flash' });
    expect(out.provider).toBe('agnes');
    expect(out.content).toContain('thin content');
    expect(out.model).toBe('agnes-2.0-flash');
    expect(out.inputTokens).toBe(220);
    expect(out.outputTokens).toBe(60);
  });

  it('uses the configured base URL and model', async () => {
    const adapter = new AgnesAdapter('sk-agnes-test-key-longer-than-10', 'agnes-2.0-flash', 'https://apihub.agnes-ai.com/v1');
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'ok' } }] });
    await adapter.complete({ systemPrompt: 's', userPrompt: 'u', model: '' });
    // Model falls back to default when input.model is empty.
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'agnes-2.0-flash' }), expect.anything());
    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: 'https://apihub.agnes-ai.com/v1' }));
  });

  it('throws on empty content', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: '' } }], model: 'agnes-2.0-flash' });
    const adapter = new AgnesAdapter('sk-agnes-test-key-longer-than-10');
    await expect(adapter.complete({ systemPrompt: 's', userPrompt: 'u', model: 'agnes-2.0-flash' })).rejects.toThrow('Agnes returned empty content');
  });

  it('propagates provider errors (for the route to handle/fallback)', async () => {
    mockCreate.mockRejectedValueOnce(new Error('503 upstream'));
    const adapter = new AgnesAdapter('sk-agnes-test-key-longer-than-10');
    await expect(adapter.complete({ systemPrompt: 's', userPrompt: 'u', model: 'agnes-2.0-flash' })).rejects.toThrow('503');
  });

  it('is unavailable without a key and never leaks it', async () => {
    const adapter = new AgnesAdapter('');
    expect(adapter.isConfigured()).toBe(false);
    const health = await adapter.healthCheck();
    expect(health.status).toBe('unavailable');
    // health output must never contain a key
    expect(JSON.stringify(health)).not.toMatch(/sk-/);
  });

  it('exposes default model and base URL constants', () => {
    expect(DEFAULT_AGNES_MODEL).toBe('agnes-2.0-flash');
    expect(DEFAULT_AGNES_BASE_URL).toBe('https://apihub.agnes-ai.com/v1');
  });

  it('getAgnesAdapter memoizes per key+model+baseURL', () => {
    const a = getAgnesAdapter('sk-agnes-test-key-longer-than-10');
    const b = getAgnesAdapter('sk-agnes-test-key-longer-than-10');
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(AgnesAdapter);
  });
});
