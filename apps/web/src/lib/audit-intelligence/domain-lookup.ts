import { getLatestUsableAuditForDomainOps, type OpsDomainAuditRecord } from '@sitenexis/db';
import type { AuditStatus } from '@sitenexis/shared';

/**
 * Mirrors the exact normalization `/api/audit/start` applies when a domain
 * is first submitted (protocol + path stripped, lowercased) — so a domain
 * typed into Telegram resolves to the same identity already stored on
 * existing audits. `www.` is left as-is here; it is a legitimate part of a
 * stored domain, and the www toggle is handled separately as a fallback.
 */
export function normalizeDomainInput(raw: string): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const stripped = trimmed
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
  return stripped.length > 0 ? stripped : null;
}

function toggleWww(domain: string): string {
  return domain.startsWith('www.') ? domain.slice(4) : `www.${domain}`;
}

export interface ResolvedDomainAudit {
  domain: string;
  audit: OpsDomainAuditRecord | null;
  isPartial: boolean;
  latestAnyStatus: AuditStatus | null;
  hadAnyAuditHistory: boolean;
}

/**
 * Resolves a Telegram-supplied domain string to the latest usable audit.
 * Tries the exact normalized form first (matching how audits are stored),
 * then falls back to the www-toggled variant — "example.com" and
 * "www.example.com" are the same real-world site, and silently missing
 * that would be a worse experience than a truthful "no audit found" for a
 * domain that clearly has one under the other form.
 */
export async function resolveAuditForDomain(rawDomain: string): Promise<ResolvedDomainAudit | null> {
  const domain = normalizeDomainInput(rawDomain);
  if (!domain) return null;

  let result = await getLatestUsableAuditForDomainOps(domain);
  let resolvedDomain = domain;

  if (!result.audit && !result.latestAny) {
    const alt = toggleWww(domain);
    const altResult = await getLatestUsableAuditForDomainOps(alt);
    if (altResult.audit || altResult.latestAny) {
      result = altResult;
      resolvedDomain = alt;
    }
  }

  return {
    domain: resolvedDomain,
    audit: result.audit,
    isPartial: result.isPartial,
    latestAnyStatus: result.latestAny?.status ?? null,
    hadAnyAuditHistory: result.latestAny !== null,
  };
}
