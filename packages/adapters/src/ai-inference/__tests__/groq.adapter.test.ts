import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// ── Mock the OpenAI SDK before importing the adapter ─────────────────────────
vi.mock('openai', () => {
  const create: Mock = vi.fn();
  const MockOpenAI = vi.fn(() => ({
    chat: { completions: { create } },
  }));
  return { default: MockOpenAI, __create: create };
});

// Import after mock is set up
const { GroqAdapter, getGroqAdapter, getGroqFastAdapter } = await import('../groq.adapter');
const OpenAI = (await import('openai')).default as unknown as Mock;
const mockCreate = (new (OpenAI as unknown as new () => { chat: { completions: { create: Mock } } })()).chat.completions.create;

describe('GroqAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns normalized AICompletionOutput on success', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"score":85}' } }],
      model: 'llama-3.3-70b-versatile',
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    });

    const adapter = new GroqAdapter('sk-test-key-longer-than-10');
    const output = await adapter.complete({
      systemPrompt: 'You are an AI.',
      userPrompt: 'Score this.',
      model: 'llama-3.3-70b-versatile',
      jsonMode: true,
    });

    expect(output.content).toBe('{"score":85}');
    expect(output.provider).toBe('groq');
    expect(output.model).toBe('llama-3.3-70b-versatile');
    expect(output.inputTokens).toBe(100);
    expect(output.outputTokens).toBe(20);
    expect(output.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('throws when API returns empty content', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '' } }],
      model: 'llama-3.3-70b-versatile',
    });

    const adapter = new GroqAdapter('sk-test-key-longer-than-10');
    await expect(
      adapter.complete({
        systemPrompt: 'sys',
        userPrompt: 'user',
        model: 'llama-3.3-70b-versatile',
      }),
    ).rejects.toThrow('Groq returned empty content');
  });

  it('reports unavailable when key is missing', async () => {
    const adapter = new GroqAdapter('');
    expect(adapter.isConfigured()).toBe(false);
    const health = await adapter.healthCheck();
    expect(health.status).toBe('unavailable');
    expect(health.details).toContain('GROQ_API_KEY not configured');
  });

  it('reports unavailable when key contains placeholder', async () => {
    const adapter = new GroqAdapter('placeholder-key');
    expect(adapter.isConfigured()).toBe(false);
  });

  it('reports healthy when API responds quickly', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'ok' } }],
    });

    const adapter = new GroqAdapter('sk-test-key-longer-than-10');
    const health = await adapter.healthCheck();
    expect(health.status).toBe('healthy');
    expect(health.provider).toBe('groq');
  });

  it('reports unavailable when health probe throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('connection refused'));

    const adapter = new GroqAdapter('sk-test-key-longer-than-10');
    const health = await adapter.healthCheck();
    expect(health.status).toBe('unavailable');
    expect(health.details).toContain('connection refused');
  });
});

describe('GroqAdapter singletons', () => {
  it('getGroqAdapter returns a GroqAdapter instance', () => {
    expect(getGroqAdapter()).toBeInstanceOf(GroqAdapter);
  });

  it('getGroqFastAdapter returns a GroqAdapter instance', () => {
    expect(getGroqFastAdapter()).toBeInstanceOf(GroqAdapter);
  });
});
