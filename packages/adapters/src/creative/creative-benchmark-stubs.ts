// AdNexis Creative Benchmark Stubs — evaluation-only adapters.
// None of these adapters are registered in any production registry.
// benchmarkOnly = true enforces production exclusion.
//
// Models under evaluation:
//   LongFormCreativeBriefCapability  — pagestorm-research-preview-14b-full-book
//   CreativeAgentPlanningCapability  — gemma-4-12B-agentic-fable5-composer2.5-v2-3.5x-tau2
//   FastCreativeRoutingCapability    — openPangu-2.0-Flash

const HF_BASE = 'https://api-inference.huggingface.co/models';
const STUB_TIMEOUT = 120_000;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function getHfToken(): string {
  return process.env['HF_TOKEN'] ?? process.env['HUGGINGFACE_TOKEN'] ?? '';
}

function isHfConfigured(): boolean {
  return getHfToken().length > 10;
}

async function hfChat(
  modelId: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<{ content: string; latencyMs: number; inputTokens?: number; outputTokens?: number }> {
  const hfToken = getHfToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STUB_TIMEOUT);
  const start = Date.now();

  try {
    const res = await fetch(`${HF_BASE}/${modelId}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
        'x-wait-for-model': 'true',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_tokens: maxTokens,
        stream: false,
      }),
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

// ── LongFormCreativeBriefCapability ───────────────────────────────────────────

export interface AdNexisCreativeBriefInput {
  productName: string;
  audience: string;
  objective: string;
  constraints?: string[];
  exampleTone?: string;
  targetWordCount?: number;
}

export interface AdNexisCreativeBriefOutput {
  brief: string;
  wordCount: number;
  model: string;
  latencyMs: number;
}

export interface LongFormCreativeBriefAdapter {
  readonly provider: string;
  readonly modelId: string;
  readonly benchmarkOnly: boolean;
  isConfigured(): boolean;
  generateBrief(input: AdNexisCreativeBriefInput): Promise<AdNexisCreativeBriefOutput>;
}

export class PagestormCreativeBriefStub implements LongFormCreativeBriefAdapter {
  readonly provider = 'pagestorm-creative-brief';
  readonly modelId = 'Pageshift-Entertainment/pagestorm-research-preview-14b-full-book';
  readonly benchmarkOnly = true;

  isConfigured(): boolean { return isHfConfigured(); }

  async generateBrief(input: AdNexisCreativeBriefInput): Promise<AdNexisCreativeBriefOutput> {
    const targetWords = input.targetWordCount ?? 2000;
    const maxTokens = Math.min(6144, Math.ceil(targetWords * 1.4));
    const system = `You are a senior creative director. Write a comprehensive creative brief in markdown. Target: ~${targetWords} words. Tone: ${input.exampleTone ?? 'professional'}.`;
    const user = [
      `Product: ${input.productName}`,
      `Audience: ${input.audience}`,
      `Objective: ${input.objective}`,
      ...(input.constraints?.length ? [`Constraints:\n${input.constraints.map((c: string) => `- ${c}`).join('\n')}`] : []),
    ].join('\n\n');

    const { content, latencyMs } = await hfChat(this.modelId, system, user, maxTokens);
    return { brief: content, wordCount: content.split(/\s+/).filter(Boolean).length, model: this.modelId, latencyMs };
  }
}

// ── CreativeAgentPlanningCapability ───────────────────────────────────────────

export interface CreativeAgentPlanInput {
  campaignGoal: string;
  assets: string[];             // available asset types: "banner", "video", "copy"
  channels: string[];           // "instagram", "youtube", etc.
  budget?: string;
  timeline?: string;
}

export interface CreativeAgentPlanOutput {
  plan: string;
  tasks: Array<{ task: string; channel: string; priority: 'high' | 'medium' | 'low' }>;
  model: string;
  latencyMs: number;
}

export interface CreativeAgentPlanningAdapter {
  readonly provider: string;
  readonly modelId: string;
  readonly benchmarkOnly: boolean;
  isConfigured(): boolean;
  planCampaign(input: CreativeAgentPlanInput): Promise<CreativeAgentPlanOutput>;
}

export class GemmaCreativeAgentStub implements CreativeAgentPlanningAdapter {
  readonly provider = 'gemma-creative-agent';
  readonly modelId = 'yuxinlu1/gemma-4-12B-agentic-fable5-composer2.5-v2-3.5x-tau2';
  readonly benchmarkOnly = true;

  isConfigured(): boolean { return isHfConfigured(); }

  async planCampaign(input: CreativeAgentPlanInput): Promise<CreativeAgentPlanOutput> {
    const system = `You are a creative campaign strategist. Output a campaign plan as JSON: {"plan":"...","tasks":[{"task":"...","channel":"...","priority":"high|medium|low"}]}`;
    const user = [
      `Goal: ${input.campaignGoal}`,
      `Assets available: ${input.assets.join(', ')}`,
      `Channels: ${input.channels.join(', ')}`,
      ...(input.budget ? [`Budget: ${input.budget}`] : []),
      ...(input.timeline ? [`Timeline: ${input.timeline}`] : []),
    ].join('\n');

    const result = await hfChat(this.modelId, system, user, 2048);

    let plan = result.content;
    let tasks: CreativeAgentPlanOutput['tasks'] = [];
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { plan?: string; tasks?: unknown[] };
        plan = typeof parsed.plan === 'string' ? parsed.plan : result.content;
        if (Array.isArray(parsed.tasks)) {
          tasks = parsed.tasks
            .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
            .map((t) => ({
              task: String(t['task'] ?? ''),
              channel: String(t['channel'] ?? ''),
              priority: (['high', 'medium', 'low'].includes(String(t['priority'])) ? t['priority'] : 'medium') as 'high' | 'medium' | 'low',
            }));
        }
      }
    } catch { /* best-effort */ }

    return { plan, tasks, model: this.modelId, latencyMs: result.latencyMs };
  }
}

// ── FastCreativeRoutingCapability ─────────────────────────────────────────────

export interface CreativeRoutingInput {
  assetType: 'image' | 'video' | 'copy' | 'brief';
  urgency: 'real-time' | 'standard' | 'batch';
  qualityRequirement: 'draft' | 'production' | 'premium';
  constraints?: string;
}

export interface CreativeRoutingDecision {
  recommendedProvider: string;
  rationale: string;
  estimatedLatencyMs: number;
  confidenceScore: number;     // 0–1
  fallbackProvider?: string;
}

export interface FastCreativeRoutingAdapter {
  readonly provider: string;
  readonly modelId: string;
  readonly benchmarkOnly: boolean;
  isConfigured(): boolean;
  route(input: CreativeRoutingInput): Promise<CreativeRoutingDecision>;
}

export class OpenPanguCreativeRoutingStub implements FastCreativeRoutingAdapter {
  readonly provider = 'open-pangu-creative-routing';
  readonly modelId = 'openpangu/openPangu-2.0-Flash';
  readonly benchmarkOnly = true;

  isConfigured(): boolean { return isHfConfigured(); }

  async route(input: CreativeRoutingInput): Promise<CreativeRoutingDecision> {
    const system = `You are a creative infrastructure router. Output JSON: {"recommendedProvider":"...","rationale":"...","estimatedLatencyMs":0,"confidenceScore":0.0,"fallbackProvider":"..."}`;
    const user = `Route this creative request:\nType: ${input.assetType}\nUrgency: ${input.urgency}\nQuality: ${input.qualityRequirement}${input.constraints ? `\nConstraints: ${input.constraints}` : ''}`;

    const result = await hfChat(this.modelId, system, user, 512);

    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<CreativeRoutingDecision>;
        return {
          recommendedProvider: parsed.recommendedProvider ?? 'flux-schnell',
          rationale: parsed.rationale ?? result.content,
          estimatedLatencyMs: typeof parsed.estimatedLatencyMs === 'number' ? parsed.estimatedLatencyMs : 10000,
          confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.7,
          ...(parsed.fallbackProvider ? { fallbackProvider: parsed.fallbackProvider } : {}),
        };
      }
    } catch { /* fall through */ }

    return {
      recommendedProvider: 'flux-schnell',
      rationale: result.content || 'Routing fallback — default provider selected',
      estimatedLatencyMs: 10_000,
      confidenceScore: 0.5,
    };
  }
}

// ── Singleton factories ────────────────────────────────────────────────────────

export function getPagestormCreativeBriefStub(): PagestormCreativeBriefStub {
  return new PagestormCreativeBriefStub();
}

export function getGemmaCreativeAgentStub(): GemmaCreativeAgentStub {
  return new GemmaCreativeAgentStub();
}

export function getOpenPanguCreativeRoutingStub(): OpenPanguCreativeRoutingStub {
  return new OpenPanguCreativeRoutingStub();
}
