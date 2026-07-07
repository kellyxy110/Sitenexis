// MaxunBenchmarkStub — benchmark-only stub for CompetitiveIntelligenceCapability.
// maxun (github.com/getmaxun/maxun) is a no-code web extraction platform with
// visual robot-building and scheduled runs.
//
// benchmarkOnly = true — this adapter never enters the production registry.
// To benchmark: instantiate directly and pass to a benchmark runner.
// To promote to production: complete integration, set benchmarkOnly = false,
// register in CompetitiveIntelligenceRegistry.

import type {
  CompetitiveIntelligenceAdapter,
  CompetitorAnalysisOptions,
  CompetitiveAnalysisOutput,
  CompetitiveIntelligenceHealth,
} from './interface';

const BENCHMARK_ONLY_ERROR = 'MaxunBenchmarkStub: benchmark-only adapter — not for production use. Complete integration review before enabling.';

export class MaxunBenchmarkStub implements CompetitiveIntelligenceAdapter {
  readonly provider = 'maxun';
  readonly benchmarkOnly = true;

  isConfigured(): boolean {
    // Always false in production — benchmark runner uses it directly, not via registry
    return false;
  }

  async analyzeCompetitors(
    _targetDomain: string,
    _competitors: string[],
    _opts?: CompetitorAnalysisOptions,
  ): Promise<CompetitiveAnalysisOutput> {
    throw new Error(BENCHMARK_ONLY_ERROR);
  }

  async healthCheck(): Promise<CompetitiveIntelligenceHealth> {
    return {
      provider: 'maxun',
      status: 'unavailable',
      latencyMs: 0,
      checkedAt: new Date(),
      details: 'Benchmark-only stub — configure MAXUN_SERVICE_URL and complete integration review to enable',
    };
  }
}

export function getMaxunBenchmarkStub(): MaxunBenchmarkStub {
  return new MaxunBenchmarkStub();
}
