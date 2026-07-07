// SiteNexis Benchmark Capability Interfaces — inference model evaluation stubs.
// These capabilities wrap HuggingFace models for structured benchmarking.
// benchmarkOnly = true — none enter the production registry.
// To promote: complete integration, benchmark review, set benchmarkOnly = false.

// ── FastReasoningCapability ────────────────────────────────────────────────────

export interface FastReasoningInput {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperatureHint?: 'deterministic' | 'creative';
}

export interface FastReasoningOutput {
  content: string;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface FastReasoningAdapter {
  readonly provider: string;
  readonly modelId: string;
  readonly benchmarkOnly: boolean;
  isConfigured(): boolean;
  complete(input: FastReasoningInput): Promise<FastReasoningOutput>;
}

// ── LongContextReasoningCapability ────────────────────────────────────────────

export interface LongContextReasoningInput {
  systemPrompt: string;
  userPrompt: string;
  /** Target context budget in tokens; adapter enforces within model limits */
  contextBudgetTokens?: number;
  maxOutputTokens?: number;
}

export interface LongContextReasoningOutput {
  content: string;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  contextUtilization?: number;  // 0–1: tokens used / context window
}

export interface LongContextReasoningAdapter {
  readonly provider: string;
  readonly modelId: string;
  readonly contextWindowTokens: number;
  readonly benchmarkOnly: boolean;
  isConfigured(): boolean;
  complete(input: LongContextReasoningInput): Promise<LongContextReasoningOutput>;
}

// ── LongFormReportGenerationCapability ────────────────────────────────────────

export interface LongFormReportInput {
  title: string;
  outline: string[];       // section headings / structure prompts
  context: string;         // background data and facts
  targetWordCount?: number;
  outputFormat?: 'markdown' | 'html' | 'plain';
}

export interface LongFormReportOutput {
  content: string;
  wordCount: number;
  model: string;
  latencyMs: number;
}

export interface LongFormReportAdapter {
  readonly provider: string;
  readonly modelId: string;
  readonly benchmarkOnly: boolean;
  isConfigured(): boolean;
  generateReport(input: LongFormReportInput): Promise<LongFormReportOutput>;
}

// ── AgenticReasoningCapability ─────────────────────────────────────────────────

export interface AgenticReasoningInput {
  goal: string;
  availableTools: string[];      // tool names available to the agent
  context?: string;
  maxSteps?: number;             // default 10
}

export interface AgenticReasoningStep {
  step: number;
  thought: string;
  action: string;
  actionInput: string;
  observation?: string;
}

export interface AgenticReasoningOutput {
  finalAnswer: string;
  steps: AgenticReasoningStep[];
  model: string;
  latencyMs: number;
  stepsUsed: number;
}

export interface AgenticReasoningAdapter {
  readonly provider: string;
  readonly modelId: string;
  readonly benchmarkOnly: boolean;
  isConfigured(): boolean;
  reason(input: AgenticReasoningInput): Promise<AgenticReasoningOutput>;
}
