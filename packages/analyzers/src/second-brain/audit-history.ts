/**
 * Second Brain audit-history helpers — deterministic, pure. Resolves "the
 * canonical timestamp of an audit" and "the most recent comparable audit
 * before this one" from an already-fetched list. Callers (the orchestration
 * layer) are responsible for fetching only usable, non-demo, same-tenant
 * audits — this module does not filter, it only orders and picks.
 */

export interface AuditTimestampCandidate {
  id: string;
  completedAt: string | null;
  createdAt: string;
}

/** Audit.completedAt, falling back to createdAt — the one canonical audit timestamp used everywhere in Second Brain (WebsiteMemory.firstAuditAt, previous-audit resolution). */
export function canonicalAuditTimestamp(audit: AuditTimestampCandidate): number {
  return new Date(audit.completedAt ?? audit.createdAt).getTime();
}

/**
 * Given a list of comparable/usable audits (caller has already excluded
 * demo audits and non-usable statuses) for one (userId, domain), returns
 * the most recent one strictly earlier than `currentAuditId` by canonical
 * timestamp — or null if there is none (this is the first usable audit).
 */
export function findPreviousUsableAudit<T extends AuditTimestampCandidate>(
  candidates: readonly T[],
  currentAuditId: string,
): T | null {
  const current = candidates.find((a) => a.id === currentAuditId);
  if (!current) return null;
  const currentTime = canonicalAuditTimestamp(current);

  const earlier = candidates.filter((a) => a.id !== currentAuditId && canonicalAuditTimestamp(a) < currentTime);
  if (earlier.length === 0) return null;

  return earlier.reduce((latest, a) => (canonicalAuditTimestamp(a) > canonicalAuditTimestamp(latest) ? a : latest));
}
