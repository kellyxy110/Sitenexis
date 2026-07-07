export type {
  CompetitorAnalysisOptions,
  CompetitorPageSignal,
  CompetitorDomainReport,
  CompetitiveAnalysisOutput,
  CompetitiveIntelligenceHealth,
  CompetitiveIntelligenceAdapter,
} from './interface';

export { ScrapyCompetitiveAdapter, getScrapyCompetitiveAdapter } from './scrapy.adapter';
export { MaxunBenchmarkStub, getMaxunBenchmarkStub } from './maxun.stub';
export { CompetitiveIntelligenceRegistry, CompetitiveIntelligenceError, competitiveRegistry } from './registry';
