/**
 * Second Brain WebsiteMemory resolution — deterministic, pure.
 *
 * firstAuditId must be the chronologically EARLIEST eligible audit for a
 * website by canonical audit timestamp, not merely the first audit Second
 * Brain happened to process. A bounded backfill that later discovers an
 * older audit must update it — this is a strictly-earlier-wins
 * compare-and-set, so reprocessing (including reprocessing the same audit,
 * or reprocessing in a different order) is always idempotent: the result
 * depends only on the set of candidates seen, never on call order.
 */

import type { WebsiteMemoryCandidate, WebsiteMemoryResolution } from './types';

export function resolveFirstAudit(
  existing: WebsiteMemoryCandidate | null,
  candidate: WebsiteMemoryCandidate,
): WebsiteMemoryResolution {
  if (!existing) {
    return { firstAuditId: candidate.auditId, firstAuditAt: candidate.auditAt, changed: true };
  }

  const existingTime = new Date(existing.auditAt).getTime();
  const candidateTime = new Date(candidate.auditAt).getTime();

  if (candidateTime < existingTime) {
    return { firstAuditId: candidate.auditId, firstAuditAt: candidate.auditAt, changed: true };
  }

  return { firstAuditId: existing.auditId, firstAuditAt: existing.auditAt, changed: false };
}
