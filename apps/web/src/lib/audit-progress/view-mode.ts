import type { AuditProgressState } from './types';

export type AuditViewMode = 'running' | 'completed' | 'partial' | 'failed';

/**
 * Single source of truth for which top-level view the experience renders.
 * Kept as a pure function (rather than inline JSX conditionals) so the
 * completion/partial/failure branching is unit-testable without a DOM.
 */
export function deriveViewMode(state: AuditProgressState): AuditViewMode {
  if (state.stage === 'FAILED') return 'failed';
  if (state.stage === 'PARTIAL') return 'partial';
  if (state.stage === 'COMPLETED') return 'completed';
  return 'running';
}
