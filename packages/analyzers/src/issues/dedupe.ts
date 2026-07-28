/**
 * Canonical issue deduplication.
 *
 * A single site-wide problem (a missing title tag, a missing H1, a missing
 * Organization schema) is usually detected once per affected page, or once
 * per analyzer module that happens to notice it. Presented raw, that becomes
 * N near-identical report entries for what is really one fix. This module is
 * the one place that decision gets made — every surface that lists issues
 * (Action Plan, Fix Plan/Roadmap, PDF, Executive Summary, Narrative Report)
 * calls into it rather than re-implementing its own grouping.
 *
 * Two passes:
 *   1. dedupeExact  — same module + type + recommendation text, regardless of
 *      which page raised it. Strict by construction: a different type or a
 *      different recommendation is a different signature, so this pass never
 *      merges findings with different root causes.
 *   2. collapseCanonicalTopics — the same real-world fix raised by different
 *      analyzer modules with different wording (e.g. Entity Intelligence and
 *      Machine Trust both flagging "no sameAs links"). Matching is narrow and
 *      text-based on purpose, to avoid merging unrelated issues that happen
 *      to share a keyword.
 */

export type DedupeSeverity = 'critical' | 'warning' | 'info';

/** Minimum shape any consumer's issue/finding record must have to be deduplicated. */
export interface DedupeInput {
  module: string;
  type: string;
  severity: DedupeSeverity;
  message: string;
  recommendation: string;
  pageUrl?: string | null;
  fixCode?: string | null;
}

/** One deduplicated group. `representative` is the original item (of caller's own type T) chosen to display — highest severity, then the one carrying a code fix — so all of T's fields (problem, solution, evidence, etc.) survive untouched. */
export interface DedupeGroup<T extends DedupeInput> {
  representative: T;
  /** Every item folded into this group, including the representative — never discarded, so page-level evidence stays available to the caller. */
  members: T[];
  affectedPageCount: number;
  affectedUrls: string[];
  /** Other modules whose findings were folded in during the cross-module pass (empty unless collapseCanonicalTopics matched). */
  mergedModules: string[];
}

const SEVERITY_RANK: Record<DedupeSeverity, number> = { critical: 0, warning: 1, info: 2 };

function pickRepresentative<T extends DedupeInput>(members: T[]): T {
  return [...members].sort((a, b) =>
    (SEVERITY_RANK[a.severity] ?? 2) - (SEVERITY_RANK[b.severity] ?? 2)
    || ((a.fixCode ? 0 : 1) - (b.fixCode ? 0 : 1)),
  )[0]!;
}

function toGroup<T extends DedupeInput>(members: T[], mergedModules: string[] = []): DedupeGroup<T> {
  const representative = pickRepresentative(members);
  const affectedUrls = [...new Set(members.map((m) => m.pageUrl).filter((u): u is string => !!u))];
  return {
    representative,
    members,
    affectedPageCount: affectedUrls.length,
    affectedUrls,
    mergedModules,
  };
}

/**
 * Pass 1 — collapse the same (module, type, recommendation) fix raised across
 * many pages into one group. The dedup key is exact-match on purpose: it is
 * what guarantees two findings with genuinely different causes never merge.
 */
export function dedupeExact<T extends DedupeInput>(items: T[]): DedupeGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const actionText = (item.recommendation || item.message).trim().toLowerCase().replace(/\s+/g, ' ');
    const sig = `${item.module}::${item.type}::${actionText}`;
    const group = groups.get(sig);
    if (group) group.push(item);
    else groups.set(sig, [item]);
  }
  return [...groups.values()].map((members) => toGroup(members));
}

/**
 * Cross-module fix topics. Each entry recognises a real-world fix that
 * multiple independent analyzer modules detect on their own (different
 * module, different type, different wording) but which resolves to a single
 * action for the site owner. Matching is conservative and text-based, on the
 * combination of module signal + recommendation content — precise enough to
 * avoid merging unrelated issues that happen to mention a shared keyword
 * (e.g. "schema" alone is never sufficient; the test requires the specific
 * fix content too).
 */
export const CANONICAL_TOPICS: { id: string; label: string; test: (item: DedupeInput) => boolean }[] = [
  {
    id: 'external-validation-sameas',
    label: 'Add sameAs links for external entity validation',
    test: (item) => {
      const text = `${item.recommendation} ${item.message}`.toLowerCase();
      return /same\s*as/.test(text) && /(wikipedia|wikidata|linkedin|crunchbase)/.test(text);
    },
  },
  {
    id: 'missing-organization-schema',
    label: 'Add Organization schema to the homepage',
    test: (item) => {
      const text = `${item.recommendation} ${item.message}`.toLowerCase();
      return /organi[sz]ation schema/.test(text) && /(add|missing|no organi[sz]ation)/.test(text);
    },
  },
  {
    id: 'missing-faq-schema',
    label: 'Add FAQPage schema',
    test: (item) => {
      const text = `${item.recommendation} ${item.message}`.toLowerCase();
      return /faqpage schema/.test(text) && /(add|missing|no faqpage)/.test(text);
    },
  },
];

/**
 * Pass 2 — run after {@link dedupeExact}. Groups across module/type
 * boundaries by canonical fix topic, keeping the same most-severe/
 * most-detailed representative selection rule, and records which other
 * modules also flagged the same real-world fix so that coverage information
 * is preserved rather than silently lost.
 */
export function collapseCanonicalTopics<T extends DedupeInput>(groups: DedupeGroup<T>[]): DedupeGroup<T>[] {
  const claimed = new Set<DedupeGroup<T>>();
  const result: DedupeGroup<T>[] = [];

  for (const topic of CANONICAL_TOPICS) {
    const matches = groups.filter((g) => !claimed.has(g) && topic.test(g.representative));
    if (matches.length === 0) continue;
    for (const m of matches) claimed.add(m);
    if (matches.length === 1) { result.push(matches[0]!); continue; }

    const allMembers = matches.flatMap((g) => g.members);
    const representative = pickRepresentative(allMembers);
    const otherModules = [...new Set(matches.map((g) => g.representative.module).filter((mod) => mod !== representative.module))];
    const affectedUrls = [...new Set(allMembers.map((m) => m.pageUrl).filter((u): u is string => !!u))];
    result.push({
      representative,
      members: allMembers,
      affectedPageCount: affectedUrls.length,
      affectedUrls,
      mergedModules: otherModules,
    });
  }

  for (const group of groups) {
    if (!claimed.has(group)) result.push(group);
  }

  return result;
}

/** Convenience: both passes in sequence — the entry point every consumer should call. */
export function dedupeFindings<T extends DedupeInput>(items: T[]): DedupeGroup<T>[] {
  return collapseCanonicalTopics(dedupeExact(items));
}
