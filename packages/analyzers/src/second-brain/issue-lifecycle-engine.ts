/**
 * Second Brain Issue Lifecycle Engine (doubles as the mandatory-for-SB1
 * Issue Regression Engine — a regression IS a lifecycle transition, not a
 * separate detector with its own state).
 *
 * Deterministic, pure. Given the full set of existing IssueMemory rows for
 * a (userId, domain) — both currently-open and currently-resolved — and the
 * current audit's grouped issues (see issue-fingerprint.ts), computes one
 * IssueLifecycleTransition per fingerprint that changed state this audit.
 *
 * Transition rules (fingerprint-scoped, never cross-fingerprint):
 *   - Present now, no prior memory row at all           → OPENED      → FIRST_SEEN
 *   - Present now, prior state was RESOLVED              → REGRESSED  → REGRESSED
 *   - Present now, prior state was FIRST_SEEN/PERSISTING/REGRESSED → PERSISTED → PERSISTING
 *   - Absent now, prior state was open (not RESOLVED)     → RESOLVED   → RESOLVED
 *   - Absent now, prior state was already RESOLVED        → (no transition — nothing changed)
 *
 * This produces exactly the required cycle when driven audit-by-audit:
 *   OPENED(FIRST_SEEN) → PERSISTED(PERSISTING) → RESOLVED(RESOLVED)
 *     → REGRESSED(REGRESSED) → RESOLVED(RESOLVED)
 */

import type { CurrentIssueGroup, IssueLifecycleTransition, IssueMemorySnapshot } from './types';

export function computeIssueLifecycleTransitions(
  previousMemories: readonly IssueMemorySnapshot[],
  currentGroups: readonly CurrentIssueGroup[],
): IssueLifecycleTransition[] {
  const previousByFingerprint = new Map(previousMemories.map((m) => [m.fingerprint, m]));
  const currentFingerprints = new Set(currentGroups.map((g) => g.fingerprint));
  const transitions: IssueLifecycleTransition[] = [];

  for (const group of currentGroups) {
    const prev = previousByFingerprint.get(group.fingerprint);
    if (!prev) {
      transitions.push({
        fingerprint: group.fingerprint, fingerprintVersion: group.fingerprintVersion, module: group.module, type: group.type,
        severity: group.severity, affectedPageCount: group.affectedPageCount,
        eventType: 'OPENED', newLifecycleState: 'FIRST_SEEN',
      });
    } else if (prev.lifecycleState === 'RESOLVED') {
      transitions.push({
        fingerprint: group.fingerprint, fingerprintVersion: group.fingerprintVersion, module: group.module, type: group.type,
        severity: group.severity, affectedPageCount: group.affectedPageCount,
        eventType: 'REGRESSED', newLifecycleState: 'REGRESSED',
      });
    } else {
      transitions.push({
        fingerprint: group.fingerprint, fingerprintVersion: group.fingerprintVersion, module: group.module, type: group.type,
        severity: group.severity, affectedPageCount: group.affectedPageCount,
        eventType: 'PERSISTED', newLifecycleState: 'PERSISTING',
      });
    }
  }

  for (const prev of previousMemories) {
    const wasOpen = prev.lifecycleState !== 'RESOLVED';
    if (wasOpen && !currentFingerprints.has(prev.fingerprint)) {
      transitions.push({
        fingerprint: prev.fingerprint, fingerprintVersion: prev.fingerprintVersion, module: prev.module, type: prev.type,
        severity: prev.severity, affectedPageCount: 0,
        eventType: 'RESOLVED', newLifecycleState: 'RESOLVED',
      });
    }
  }

  return transitions;
}

/** Convenience filter — the subset of a lifecycle run that constitutes a regression. Mandatory-for-SB1 detector, exposed directly rather than only inline, so it is independently testable and callable. */
export function detectIssueRegressions(transitions: readonly IssueLifecycleTransition[]): IssueLifecycleTransition[] {
  return transitions.filter((t) => t.eventType === 'REGRESSED');
}
