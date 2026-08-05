/**
 * Second Brain issue fingerprint v1 — deterministic, pure, prose-independent.
 *
 * fingerprint = sha256(`${userId}::${domain}::${module}::${type}`)
 *
 * `module` + `type` — not pageUrl, not recommendation/message text — is the
 * chosen identity grain. Confirmed against two independent existing call
 * sites rather than assumed:
 *   - packages/shared/src/legacy-evidence-projection.ts sets
 *     `issueCode: present(issue.type)` and `moduleId: issue.module` when
 *     projecting legacy issues into the canonical v2 evidence shape — i.e.
 *     this codebase already treats module+type as the stable rule identity.
 *   - packages/analyzers/src/issues/dedupe.ts — the canonical dedupe used by
 *     every report surface (Action Plan, Fix Plan, PDF, Executive Summary,
 *     Narrative Report) — collapses the same module+type issue across every
 *     affected page into ONE group, tracking affectedUrls as data, not
 *     identity. Fingerprinting per-page here would make Second Brain
 *     disagree with every other surface about what counts as "one issue."
 * `type` values are hand-authored deterministic constants
 * (`missing_alt_text`, `missing_canonical`, ...), never LLM-generated —
 * confirmed by direct inspection of analyzer source, not assumed.
 *
 * fingerprintVersion is carried alongside every fingerprint specifically so
 * this algorithm can be revised later without corrupting or colliding with
 * existing IssueMemory rows.
 */

import { createHash } from 'crypto';
import type { CurrentIssueGroup, DedupeSeverity, RawIssueForFingerprint } from './types';

export const ISSUE_FINGERPRINT_VERSION = 'v1';

const SEVERITY_RANK: Record<DedupeSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function computeIssueFingerprint(userId: string, domain: string, module: string, type: string): string {
  return createHash('sha256').update(`${userId}::${domain}::${module}::${type}`).digest('hex');
}

/**
 * Groups an audit's raw issues by (module, type) — the same grain as
 * `dedupeExact` in packages/analyzers/src/issues/dedupe.ts, minus its
 * recommendation-text tiebreaker (prose-dependent, deliberately excluded
 * from identity here) and minus `collapseCanonicalTopics`'s cross-module
 * regex matching (also prose-dependent). One CurrentIssueGroup per distinct
 * (module, type) pair actually present in this audit.
 */
export function groupCurrentAuditIssues(
  userId: string,
  domain: string,
  issues: readonly RawIssueForFingerprint[],
): CurrentIssueGroup[] {
  const groups = new Map<string, { module: string; type: string; severity: DedupeSeverity; pageUrls: Set<string> }>();

  for (const issue of issues) {
    const key = `${issue.module}::${issue.type}`;
    let group = groups.get(key);
    if (!group) {
      group = { module: issue.module, type: issue.type, severity: issue.severity, pageUrls: new Set() };
      groups.set(key, group);
    } else if (SEVERITY_RANK[issue.severity] < SEVERITY_RANK[group.severity]) {
      group.severity = issue.severity;
    }
    if (issue.pageUrl) group.pageUrls.add(issue.pageUrl);
  }

  return [...groups.values()].map((group) => ({
    fingerprint: computeIssueFingerprint(userId, domain, group.module, group.type),
    fingerprintVersion: ISSUE_FINGERPRINT_VERSION,
    module: group.module,
    type: group.type,
    severity: group.severity,
    affectedPageCount: group.pageUrls.size,
  }));
}
