// @sitenexis/loop-os — public API
// V4.5: StateEngine write primitives only.
// V5 will add LoopEngine, SkillEngine, and Verifier exports.

export type {
  ScoreSnapshot,
  KnownFix,
  FailedFix,
  LoopType,
  LoopCheckpoint,
  SiteState,
  SiteStatePatch,
  MemoryRecordType,
  MemoryRecord,
  ScoreSnapshotPayload,
  FixAppliedPayload,
  FixVerifiedPayload,
  LoopCheckpointPayload,
  IssueOpenedPayload,
  IssueResolvedPayload,
  LoopJobStatus,
  LoopJob,
} from './types';

export {
  getSiteState,
  upsertSiteState,
  appendScoreSnapshot,
  recordIssueSet,
  recordLoopCheckpoint,
} from './state-engine/index';
