import { createHash } from 'crypto';

/**
 * SiteNexis Report Integrity System (Module 17).
 *
 * Pure, deterministic primitives for signing and verifying audit reports.
 * No DB, no I/O — same input always yields the same signature, so a report can
 * be independently re-verified from its inputs + output artifact.
 *
 * Design:
 *   - inputHash  — hash of the canonical audit inputs (what the report was built
 *     from). Known BEFORE rendering, so it can be embedded on the report itself.
 *   - outputHash — hash of the rendered artifact bytes (the PDF/markdown buffer).
 *     Computed AFTER rendering; used to detect any tampering with the delivered
 *     file. Never embedded in the artifact it hashes (that would be circular).
 */

/** Bump when the report structure or scoring surface changes materially. */
export const REPORT_ENGINE_VERSION = 'sitenexis-report-engine/1.0.0';

export interface ReportIntegrity {
  /** Human-readable, collision-resistant report identifier. */
  reportId: string;
  algorithm: 'sha256';
  engineVersion: string;
  /** Prompt template version when an LLM contributed; null for deterministic reports. */
  promptVersion: string | null;
  /** Model id used when an LLM contributed; null otherwise. */
  modelUsed: string | null;
  /** Provider used when an LLM contributed; null otherwise. */
  modelProvider: string | null;
  /** SHA-256 of the canonical report inputs. */
  inputHash: string;
  /** SHA-256 of the rendered artifact bytes; null until the artifact exists. */
  outputHash: string | null;
  /** ISO-8601 signing timestamp. */
  signedAt: string;
}

export interface SignReportParams {
  auditId: string;
  /** The full set of inputs the report was generated from. */
  input: unknown;
  engineVersion?: string;
  promptVersion?: string | null;
  modelUsed?: string | null;
  modelProvider?: string | null;
  /** Override the signing clock (tests / reproducibility). */
  signedAt?: Date;
}

/**
 * Deterministically serialise a value: object keys are sorted recursively so the
 * hash is stable regardless of property insertion order. Arrays keep their order
 * (order is semantically meaningful). `undefined` is dropped like JSON.stringify.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortValue);
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const v = record[key];
    if (v !== undefined) sorted[key] = sortValue(v);
  }
  return sorted;
}

export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Hash the canonical report inputs. Stable across key ordering. */
export function computeInputHash(input: unknown): string {
  return sha256(canonicalize(input));
}

/** Hash the rendered artifact bytes (PDF/markdown/JSON string). */
export function computeOutputHash(artifact: string | Buffer): string {
  return sha256(artifact);
}

/**
 * Build a human-readable report id: SNX-<audit prefix>-<yyyymmdd>-<hash prefix>.
 * Deterministic given the same auditId, timestamp, and inputHash.
 */
export function generateReportId(auditId: string, signedAt: Date, inputHash: string): string {
  const auditPart = auditId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'AUDIT';
  const y = signedAt.getUTCFullYear();
  const m = String(signedAt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(signedAt.getUTCDate()).padStart(2, '0');
  return `SNX-${auditPart}-${y}${m}${d}-${inputHash.slice(0, 8).toUpperCase()}`;
}

/**
 * Sign a report from its inputs. Produces the integrity record with inputHash and
 * a report id; outputHash is left null until the artifact is rendered (then set
 * via {@link attachOutputHash}).
 */
export function signReport(params: SignReportParams): ReportIntegrity {
  const signedAt = params.signedAt ?? new Date();
  const inputHash = computeInputHash(params.input);
  return {
    reportId: generateReportId(params.auditId, signedAt, inputHash),
    algorithm: 'sha256',
    engineVersion: params.engineVersion ?? REPORT_ENGINE_VERSION,
    promptVersion: params.promptVersion ?? null,
    modelUsed: params.modelUsed ?? null,
    modelProvider: params.modelProvider ?? null,
    inputHash,
    outputHash: null,
    signedAt: signedAt.toISOString(),
  };
}

/** Return a copy of the integrity record with the rendered artifact's hash attached. */
export function attachOutputHash(integrity: ReportIntegrity, artifact: string | Buffer): ReportIntegrity {
  return { ...integrity, outputHash: computeOutputHash(artifact) };
}

export interface VerificationResult {
  valid: boolean;
  inputValid: boolean;
  outputValid: boolean;
  expectedInputHash: string;
  actualInputHash: string;
  expectedOutputHash: string | null;
  actualOutputHash: string | null;
  reason: string | null;
}

/**
 * Independently verify a report: recompute the input hash from the inputs and the
 * output hash from the artifact, and compare against the signed integrity record.
 * If `artifact` is omitted, only the input side is verified.
 */
export function verifyReport(
  integrity: ReportIntegrity,
  input: unknown,
  artifact?: string | Buffer,
): VerificationResult {
  const actualInputHash = computeInputHash(input);
  const inputValid = actualInputHash === integrity.inputHash;

  let outputValid = true;
  let actualOutputHash: string | null = null;
  if (artifact !== undefined) {
    actualOutputHash = computeOutputHash(artifact);
    // If the record has no outputHash we cannot confirm the artifact — treat as invalid.
    outputValid = integrity.outputHash !== null && actualOutputHash === integrity.outputHash;
  }

  const valid = inputValid && outputValid;
  const reason = valid
    ? null
    : !inputValid
      ? 'Input hash mismatch — the report inputs have changed since signing.'
      : integrity.outputHash === null
        ? 'No output hash on record — the artifact cannot be verified.'
        : 'Output hash mismatch — the report file has been altered since signing.';

  return {
    valid,
    inputValid,
    outputValid,
    expectedInputHash: integrity.inputHash,
    actualInputHash,
    expectedOutputHash: integrity.outputHash,
    actualOutputHash,
    reason,
  };
}
