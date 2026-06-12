import type { SseScore } from '../../generated';
import { db } from '../client';

export type { SseScore };

export interface SaveSseScoreInput {
  topicalAuthorityScore: number;
  taDepth: number;
  taBreadth: number;
  taInterlinking: number;
  taFreshness: number;

  semanticDensityScore: number;
  sdsRawDensity: number;
  sdsEntityCount: number;
  sdsFactCount: number;
  sdsRelationshipCount: number;
  sdsTotalWords: number;

  aiCrawlabilityScore: number;
  aciRobots: number;
  aciSitemap: number;
  aciRenderability: number;
  aciIndexability: number;

  geoScore: number;
  snsMasterScore: number;
  snsLabel: string;
}

export async function saveSseScore(auditId: string, data: SaveSseScoreInput): Promise<SseScore> {
  return db.sseScore.upsert({
    where: { auditId },
    create: { auditId, ...data },
    update: { ...data },
  });
}

export async function getSseScore(auditId: string): Promise<SseScore | null> {
  return db.sseScore.findUnique({ where: { auditId } });
}
