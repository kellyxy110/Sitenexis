// SiteNexis Benchmark Stubs — NOT for production use.
// Each stub wraps a HuggingFace model for offline benchmarking and capability evaluation.
// benchmarkOnly = true enforces that these never enter a production registry.
// To promote a stub to production: complete integration review, validate outputs,
// update benchmarkOnly = false, and register in the appropriate production registry.

import type {
  FastReasoningAdapter,
  FastReasoningInput,
  FastReasoningOutput,
  LongContextReasoningAdapter,
  LongContextReasoningInput,
  LongContextReasoningOutput,
  LongFormReportAdapter,
  LongFormReportInput,
  LongFormReportOutput,
  AgenticReasoningAdapter,
  AgenticReasoningInput,
  AgenticReasoningOutput,
} from './interface';

const HF_BASE = 'https://api-inference.huggingface.co/models';
const DEFAULT_TIMEOUT = 120_000;

// ─── Shared HF call helper ────────────────────────────────────────────────────

async function hfTextGenerate(
  modelId: string,
  hfToken: string,
  system: string | undefined,
  user: string,
  maxTokens: number,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<{ content: string; inputTokens?: number; outputTokens?: number; latencyMs: number }> {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const res = await fetch(`${HF_BASE}/${modelId}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
        'x-wait-for-model': 'true',
      },
      body: JSON.stringify({ model: modelId, messages, max_tokens: maxTokens, stream: false }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HF ${modelId} returned ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const out: { content: string; latencyMs: number; inputTokens?: number; outputTokens?: number } = {
      content: data.choices?.[0]?.message?.content ?? '',
      latencyMs: Date.now() - start,
    };
    if (data.usage?.prompt_tokens !== undefined) out.inputTokens = data.usage.prompt_tokens;
    if (data.usage?.completion_tokens !== undefined) out.outputTokens = data.usage.completion_tokens;
    return out;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function getHfToken(): string {
  return process.env['HF_TOKEN'] ?? process.env['HUGGINGFACE_TOKEN'] ?? '';
}

function isHfConfigured(): boolean {
  const t = getHfToken();
  return t.length > 10;
}

// ── FastReasoningCapability — openPangu-2.0-Flash ─────────────────────────────

export class OpenPanguFastReasoningStub implements FastReasoningAdapter {
  readonly provider = 'open-pangu-fast-reasoning';
  readonly modelId = 'openpangu/openPangu-2.0-Flash';
  readonly benchmarkOnly = true;

  isConfigured(): boolean { return isHfConfigured(); }

  async complete(input: FastReasoningInput): Promise<FastReasoningOutput> {
    const hfToken = getHfToken();
    const maxTokens = input.maxTokens ?? 2048;
    const result = await hfTextGenerate(this.modelId, hfToken, input.systemPrompt, input.prompt, maxTokens);
    const out: FastReasoningOutput = { content: result.content, model: this.modelId, latencyMs: result.latencyMs };
    if (result.inputTokens !== undefined) out.inputTokens = result.inputTokens;
    if (result.outputTokens !== undefined) out.outputTokens = result.outputTokens;
    return out;
  }
}

// ── LongContextReasoningCapability — LongCat-2.0 ──────────────────────────────

export class LongCatReasoningStub implements LongContextReasoningAdapter {
  readonly provider = 'longcat-reasoning';
  readonly modelId = 'meituan-longcat/LongCat-2.0';
  readonly contextWindowTokens = 1_000_000;    // LongCat-2.0 supports ~1M context
  readonly benchmarkOnly = true;

  isConfigured(): boolean { return isHfConfigured(); }

  async complete(input: LongContextReasoningInput): Promise<LongContextReasoningOutput> {
    const hfToken = getHfToken();
    const maxOut = input.maxOutputTokens ?? 4096;
    const result = await hgTextGenerate(this.modelId, hfToken, input.systemPrompt, input.userPrompt, maxOut);
    const contextUtilization = input.contextBudgetTokens && result.inputTokens
      ? Math.min(1, result.inputTokens / input.contextBudgetTokens)
      : undefined;
    const out: LongContextReasoningOutput = { content: result.content, model: this.modelId, latencyMs: result.latencyMs };
    if (result.inputTokens !== undefined) out.inputTokens = result.inputTokens;
    if (result.outputTokens !== undefined) out.outputTokens = result.outputTokens;
    if (contextUtilization !== undefined) out.contextUtilization = contextUtilization;
    return out;
  }
}

// helper alias (avoid re-declaration)
async function hgTextGenerate(
  modelId: string,
  hfToken: string,
  system: string | undefined,
  user: string,
  maxTokens: number,
) {
  return hfTextGenerate(modelId, hfToken, system, user, maxTokens);
}

// ── LongFormReportGenerationCapability — pagestorm-research-preview-14b ───────

export class PagestormReportStub implements LongFormReportAdapter {
  readonly provider = 'pagestorm-report';
  readonly modelId = 'Pageshift-Entertainment/pagestorm-research-preview-14b-full-book';
  readonly benchmarkOnly = true;

  isConfigured(): boolean { return isHfConfigured(); }

  async generateReport(input: LongFormReportInput): Promise<LongFormReportOutput> {
    const hfToken = getHfToken();
    const targetWords = input.targetWordCount ?? 3000;
    const maxTokens = Math.min(8192, Math.ceil(targetWords * 1.4));
    const system = `You are a professional report writer. Output ${input.outputFormat ?? 'markdown'} only. Target length: ~${targetWords} words.`;
    const user = `Title: ${input.title}\n\nOutline:\n${input.outline.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nContext:\n${input.context}`;

    const result = await hfTextGenerate(this.modelId, hfToken, system, user, maxTokens);
    const wordCount = result.content.split(/\s+/).filter(Boolean).length;
    return { content: result.content, wordCount, model: this.modelId, latencyMs: result.latencyMs };
  }
}

// ── AgenticReasoningCapability — gemma-4-12B-agentic-fable5-composer2.5-v2 ────

export class GemmaAgenticReasoningStub implements AgenticReasoningAdapter {
  readonly provider = 'gemma-agentic-reasoning';
  readonly modelId = 'yuxinlu1/gemma-4-12B-agentic-fable5-composer2.5-v2-3.5x-tau2';
  readonly benchmarkOnly = true;

  isConfigured(): boolean { return isHfConfigured(); }

  async reason(input: AgenticReasoningInput): Promise<AgenticReasoningOutput> {
    const hfToken = getHfToken();
    const maxSteps = input.maxSteps ?? 10;
    const system = `You are an agentic reasoner. Available tools: ${input.availableTools.join(', ')}.\nFor each step output JSON: {"thought":"...","action":"...","action_input":"..."}.\nAfter all steps, output {"final_answer":"..."}.`;
    const user = `Goal: ${input.goal}${input.context ? `\n\nContext: ${input.context}` : ''}`;

    const start = Date.now();
    const result = await hfTextGenerate(this.modelId, hfToken, system, user, maxSteps * 512);

    // Parse best-effort — benchmark only; don't throw on parse failures
    const steps: AgenticReasoningOutput['steps'] = [];
    let finalAnswer = result.content;
    try {
      const jsonBlocks = [...result.content.matchAll(/\{[\s\S]*?\}/g)].map((m) => {
        try { return JSON.parse(m[0]) as Record<string, unknown>; } catch { return null; }
      }).filter(Boolean) as Record<string, unknown>[];

      let stepNum = 1;
      for (const block of jsonBlocks) {
        if ('final_answer' in block) {
          finalAnswer = String(block['final_answer'] ?? result.content);
          break;
        }
        steps.push({
          step: stepNum++,
          thought: String(block['thought'] ?? ''),
          action: String(block['action'] ?? ''),
          actionInput: String(block['action_input'] ?? ''),
        });
      }
    } catch { /* best-effort parsing */ }

    return {
      finalAnswer,
      steps,
      model: this.modelId,
      latencyMs: Date.now() - start,
      stepsUsed: steps.length,
    };
  }
}

// ── Singleton factories ────────────────────────────────────────────────────────

export function getOpenPanguFastReasoningStub(): OpenPanguFastReasoningStub {
  return new OpenPanguFastReasoningStub();
}

export function getLongCatReasoningStub(): LongCatReasoningStub {
  return new LongCatReasoningStub();
}

export function getPagestormReportStub(): PagestormReportStub {
  return new PagestormReportStub();
}

export function getGemmaAgenticReasoningStub(): GemmaAgenticReasoningStub {
  return new GemmaAgenticReasoningStub();
}
