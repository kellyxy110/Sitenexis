export { runVerificationPass, surfaceableFindings, groupByConfidence } from './engine';
export { computeConfidence, DETERMINISTIC_CONFIDENCE, computeSourceReliability, computeExtractionConsistency } from './confidence';
export {
  titleEvidence,
  metaDescriptionEvidence,
  canonicalEvidence,
  h1Evidence,
  robotsEvidence,
  schemaTypeEvidence,
  schemaValueEvidence,
  bodyTextEvidence,
  headingEvidence,
  countEvidenceSources,
  isStaleSnapshot,
} from './dom-evidence';
export { verifySEOIssue, verifySchemaIssue, verifyEntity, adjustedSeverity } from './verifier';
