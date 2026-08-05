import { describe, it, expect } from 'vitest';
import { computeIssueLifecycleTransitions, detectIssueRegressions } from '../issue-lifecycle-engine';
import type { CurrentIssueGroup, IssueMemorySnapshot } from '../types';

const FP = 'fp-missing-alt-text';

function group(overrides: Partial<CurrentIssueGroup> = {}): CurrentIssueGroup {
  return { fingerprint: FP, fingerprintVersion: 'v1', module: 'seo', type: 'missing_alt_text', severity: 'warning', affectedPageCount: 3, ...overrides };
}

function memory(lifecycleState: IssueMemorySnapshot['lifecycleState']): IssueMemorySnapshot {
  return { fingerprint: FP, fingerprintVersion: 'v1', module: 'seo', type: 'missing_alt_text', severity: 'warning', lifecycleState };
}

describe('computeIssueLifecycleTransitions', () => {
  it('first audit — new issue with no prior memory is OPENED / FIRST_SEEN', () => {
    const transitions = computeIssueLifecycleTransitions([], [group()]);
    expect(transitions).toEqual([
      { fingerprint: FP, fingerprintVersion: 'v1', module: 'seo', type: 'missing_alt_text', severity: 'warning', affectedPageCount: 3, eventType: 'OPENED', newLifecycleState: 'FIRST_SEEN' },
    ]);
  });

  it('second audit — issue still present after FIRST_SEEN is PERSISTED / PERSISTING', () => {
    const transitions = computeIssueLifecycleTransitions([memory('FIRST_SEEN')], [group()]);
    expect(transitions[0]).toMatchObject({ eventType: 'PERSISTED', newLifecycleState: 'PERSISTING' });
  });

  it('issue still present after PERSISTING remains PERSISTED / PERSISTING', () => {
    const transitions = computeIssueLifecycleTransitions([memory('PERSISTING')], [group()]);
    expect(transitions[0]).toMatchObject({ eventType: 'PERSISTED', newLifecycleState: 'PERSISTING' });
  });

  it('issue absent after being open is RESOLVED / RESOLVED, with affectedPageCount reset to 0', () => {
    const transitions = computeIssueLifecycleTransitions([memory('PERSISTING')], []);
    expect(transitions).toEqual([
      { fingerprint: FP, fingerprintVersion: 'v1', module: 'seo', type: 'missing_alt_text', severity: 'warning', affectedPageCount: 0, eventType: 'RESOLVED', newLifecycleState: 'RESOLVED' },
    ]);
  });

  it('issue present again after RESOLVED is REGRESSED / REGRESSED', () => {
    const transitions = computeIssueLifecycleTransitions([memory('RESOLVED')], [group()]);
    expect(transitions[0]).toMatchObject({ eventType: 'REGRESSED', newLifecycleState: 'REGRESSED' });
  });

  it('issue absent again while REGRESSED (open) is RESOLVED / RESOLVED — regression is not a terminal state', () => {
    const transitions = computeIssueLifecycleTransitions([memory('REGRESSED')], []);
    expect(transitions[0]).toMatchObject({ eventType: 'RESOLVED', newLifecycleState: 'RESOLVED' });
  });

  it('no transition when an already-RESOLVED issue stays absent — nothing changed, nothing emitted', () => {
    const transitions = computeIssueLifecycleTransitions([memory('RESOLVED')], []);
    expect(transitions).toEqual([]);
  });

  it('full mandated cycle: OPEN → RESOLVED → REGRESSED → RESOLVED, driven audit-by-audit', () => {
    // Audit 1: first appearance.
    let memories: IssueMemorySnapshot[] = [];
    let t1 = computeIssueLifecycleTransitions(memories, [group()]);
    expect(t1[0]).toMatchObject({ eventType: 'OPENED', newLifecycleState: 'FIRST_SEEN' });
    memories = [memory(t1[0]!.newLifecycleState)];

    // Audit 2: resolved (issue disappears).
    let t2 = computeIssueLifecycleTransitions(memories, []);
    expect(t2[0]).toMatchObject({ eventType: 'RESOLVED', newLifecycleState: 'RESOLVED' });
    memories = [memory(t2[0]!.newLifecycleState)];

    // Audit 3: regressed (issue returns).
    let t3 = computeIssueLifecycleTransitions(memories, [group()]);
    expect(t3[0]).toMatchObject({ eventType: 'REGRESSED', newLifecycleState: 'REGRESSED' });
    memories = [memory(t3[0]!.newLifecycleState)];

    // Audit 4: resolved again.
    let t4 = computeIssueLifecycleTransitions(memories, []);
    expect(t4[0]).toMatchObject({ eventType: 'RESOLVED', newLifecycleState: 'RESOLVED' });

    expect(detectIssueRegressions([...t1, ...t2, ...t3, ...t4])).toHaveLength(1);
    expect(detectIssueRegressions([...t1, ...t2, ...t3, ...t4])[0]).toMatchObject({ eventType: 'REGRESSED' });
  });

  it('handles multiple independent fingerprints in the same audit without cross-contamination', () => {
    const groupA = group({ fingerprint: 'fp-a', type: 'missing_alt_text' });
    const groupB = group({ fingerprint: 'fp-b', type: 'missing_canonical' });
    const memories = [{ ...memory('RESOLVED'), fingerprint: 'fp-a' }];
    const transitions = computeIssueLifecycleTransitions(memories, [groupA, groupB]);
    expect(transitions.find((t) => t.fingerprint === 'fp-a')).toMatchObject({ eventType: 'REGRESSED' });
    expect(transitions.find((t) => t.fingerprint === 'fp-b')).toMatchObject({ eventType: 'OPENED' });
  });
});
