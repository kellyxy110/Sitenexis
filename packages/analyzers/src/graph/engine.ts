import {
  type CrawledPage,
  type LinkGraphScore,
  type GraphNode,
  type GraphEdge,
  type LinkSuggestion,
  type LinkPosition,
  type LinkStructuralIssue,
  type ExternalLinkMeta,
} from '@sitenexis/shared';

const DAMPING_FACTOR = 0.85;
const PAGERANK_ITERATIONS = 10;
const WEAK_CLUSTER_DENSITY_THRESHOLD = 0.30;
const MAX_LINK_SUGGESTIONS_PER_ORPHAN = 3;
const LABEL_PROPAGATION_ITERATIONS = 10;
const MAX_STRUCTURAL_ISSUES_PER_TYPE = 20;

// ─── Main export ──────────────────────────────────────────────────────────────

export function analyzeLinkGraph(pages: CrawledPage[]): LinkGraphScore {
  const emptyMeta: ExternalLinkMeta = {
    externalLinkCount: 0, topDomains: [], nofollowRatio: 0, externalAuthorityScore: 0,
  };

  if (pages.length === 0) {
    return {
      score: 0, nodes: [], edges: [], orphanPages: [],
      deadEndPages: [], overlinkedPages: [], underlinkedCriticalPages: [],
      weakClusters: [], avgPageRank: 0, linkSuggestions: [],
      structuralIssues: [], linkAuthorityFlowScore: 0, hierarchyDepth: 0,
      externalLinkMeta: emptyMeta,
    };
  }

  // Phase 1: Build graph
  const { edges, inDegree, outDegree } = buildGraph(pages);

  // Phase 2: PageRank
  const urlList = pages.map((p) => p.url);
  const pageRankMap = computePageRank(urlList, edges);

  // Phase 3: BFS depths from root
  const rootUrl = detectRootUrl(pages);
  const { depthMap, hierarchyDepth } = computeDepths(rootUrl, edges, urlList);

  // Phase 4: Orphan + dead-end + structural anomaly detection
  const orphanPages = urlList.filter(
    (url) => (inDegree.get(url) ?? 0) === 0 && url !== rootUrl,
  );
  const deadEndPages = urlList.filter((url) => (outDegree.get(url) ?? 0) === 0);
  const { overlinkedPages, underlinkedCriticalPages } = detectStructuralAnomalies(
    urlList, inDegree, pageRankMap,
  );

  // Phase 5: Topic cluster detection
  const { clusterMap, weakClusters } = detectClusters(urlList, edges, inDegree);

  // Phase 6: Assemble nodes with LAFS
  const pageTitles = new Map(pages.map((p) => [p.url, p.title ?? null]));
  const maxPR = Math.max(...[...pageRankMap.values()], 1e-10);
  const meanInDegree =
    urlList.reduce((s, u) => s + (inDegree.get(u) ?? 0), 0) / urlList.length;

  const nodes: GraphNode[] = pages.map((p) => {
    const pr = pageRankMap.get(p.url) ?? 0;
    const ind = inDegree.get(p.url) ?? 0;
    const outd = outDegree.get(p.url) ?? 0;
    const depth = depthMap.get(p.url) ?? hierarchyDepth;
    const cluster = clusterMap.get(p.url) ?? 'cluster_0';

    const lafs = computeNodeLAFS(pr, maxPR, ind, meanInDegree, depth, hierarchyDepth);

    return {
      url: p.url,
      id: p.url,
      label: deriveLabel(p.url, p.title),
      pageRank: pr,
      inDegree: ind,
      inboundCount: ind,
      outDegree: outd,
      outboundCount: outd,
      depth,
      cluster,
      linkAuthorityFlowScore: lafs,
    };
  });

  const avgPageRank = nodes.reduce((s, n) => s + n.pageRank, 0) / nodes.length;

  // Site-wide LAFS = PageRank-weighted average
  const totalPR = nodes.reduce((s, n) => s + n.pageRank, 0);
  const sitewideLAFS = totalPR > 0
    ? Math.round(
        nodes.reduce((s, n) => s + n.linkAuthorityFlowScore * n.pageRank, 0) / totalPR,
      )
    : Math.round(nodes.reduce((s, n) => s + n.linkAuthorityFlowScore, 0) / nodes.length);

  // Phase 7: Link suggestions for orphans
  const linkSuggestions = suggestLinks(orphanPages, pages, pageTitles);

  // Phase 8: Structural issues list
  const structuralIssues = buildStructuralIssues(
    orphanPages, deadEndPages, overlinkedPages, underlinkedCriticalPages, pageTitles,
  );

  // Phase 9: External link metadata aggregation
  const externalLinkMeta = aggregateExternalLinkMeta(pages);

  // Phase 10: Scoring
  const score = computeScore(
    pages.length, orphanPages.length, deadEndPages.length, overlinkedPages.length, weakClusters,
  );

  return {
    score,
    nodes,
    edges,
    orphanPages,
    deadEndPages,
    overlinkedPages,
    underlinkedCriticalPages,
    weakClusters,
    avgPageRank,
    linkSuggestions,
    structuralIssues,
    linkAuthorityFlowScore: Math.min(100, Math.max(0, sitewideLAFS)),
    hierarchyDepth,
    externalLinkMeta,
  };
}

// ─── Phase 1: Graph construction ─────────────────────────────────────────────

const POSITION_RANK: Record<LinkPosition, number> = {
  body: 5, sidebar: 4, nav: 3, footer: 2, other: 1,
};

function pickBetterPosition(a: LinkPosition | null, b: LinkPosition): LinkPosition {
  if (a === null) return b;
  return (POSITION_RANK[a] ?? 0) >= (POSITION_RANK[b] ?? 0) ? a : b;
}

function pickBetterAnchor(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return b.length > a.length ? b : a;
}

function buildGraph(pages: CrawledPage[]): {
  edges: GraphEdge[];
  inDegree: Map<string, number>;
  outDegree: Map<string, number>;
} {
  const urlSet = new Set(pages.map((p) => p.url));

  type EdgeAccum = { weight: number; bestAnchor: string; position: LinkPosition | null };
  const edgeAccum = new Map<string, EdgeAccum>();
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  for (const page of pages) {
    inDegree.set(page.url, 0);
    outDegree.set(page.url, 0);
  }

  for (const page of pages) {
    if (page.internalLinkRefs && page.internalLinkRefs.length > 0) {
      for (const ref of page.internalLinkRefs) {
        if (!urlSet.has(ref.url)) continue;
        const key = `${page.url}::${ref.url}`;
        const ex = edgeAccum.get(key);
        edgeAccum.set(key, {
          weight: (ex?.weight ?? 0) + 1,
          bestAnchor: pickBetterAnchor(ex?.bestAnchor ?? '', ref.anchorText),
          position: pickBetterPosition(ex?.position ?? null, ref.position),
        });
      }
    } else {
      for (const link of page.internalLinks) {
        if (!urlSet.has(link)) continue;
        const key = `${page.url}::${link}`;
        const ex = edgeAccum.get(key);
        edgeAccum.set(key, {
          weight: (ex?.weight ?? 0) + 1,
          bestAnchor: ex?.bestAnchor ?? '',
          position: ex?.position ?? null,
        });
      }
    }
  }

  const edges: GraphEdge[] = [];
  for (const [key, accum] of edgeAccum.entries()) {
    const sep = key.indexOf('::');
    const from = key.slice(0, sep);
    const to = key.slice(sep + 2);
    edges.push({
      from, to, source: from, target: to,
      weight: accum.weight,
      anchorText: accum.bestAnchor || null,
      position: accum.position,
    });
    inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
    outDegree.set(from, (outDegree.get(from) ?? 0) + 1);
  }

  return { edges, inDegree, outDegree };
}

// ─── Phase 2: PageRank ────────────────────────────────────────────────────────

function computePageRank(urls: string[], edges: GraphEdge[]): Map<string, number> {
  const n = urls.length;
  if (n === 0) return new Map();

  const urlIndex = new Map(urls.map((url, i) => [url, i]));
  let ranks = new Array<number>(n).fill(1 / n);

  const outLinks = new Map<number, number[]>();
  for (const edge of edges) {
    const from = urlIndex.get(edge.from);
    const to = urlIndex.get(edge.to);
    if (from === undefined || to === undefined) continue;
    const existing = outLinks.get(from) ?? [];
    existing.push(to);
    outLinks.set(from, existing);
  }

  for (let iter = 0; iter < PAGERANK_ITERATIONS; iter++) {
    const next = new Array<number>(n).fill((1 - DAMPING_FACTOR) / n);
    for (const [fromIdx, toList] of outLinks.entries()) {
      if (toList.length === 0) continue;
      const contribution = (DAMPING_FACTOR * (ranks[fromIdx] ?? 0)) / toList.length;
      for (const toIdx of toList) {
        next[toIdx] = (next[toIdx] ?? 0) + contribution;
      }
    }
    ranks = next;
  }

  return new Map(urls.map((url, i) => [url, ranks[i] ?? 0]));
}

// ─── Phase 3: BFS depth from root ────────────────────────────────────────────

function computeDepths(
  rootUrl: string,
  edges: GraphEdge[],
  urlList: string[],
): { depthMap: Map<string, number>; hierarchyDepth: number } {
  const adjacency = new Map<string, string[]>();
  for (const url of urlList) adjacency.set(url, []);
  for (const edge of edges) {
    const nbrs = adjacency.get(edge.from) ?? [];
    nbrs.push(edge.to);
    adjacency.set(edge.from, nbrs);
  }

  const depthMap = new Map<string, number>();
  const queue: string[] = [rootUrl];
  depthMap.set(rootUrl, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depthMap.get(current) ?? 0;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!depthMap.has(neighbor)) {
        depthMap.set(neighbor, currentDepth + 1);
        queue.push(neighbor);
      }
    }
  }

  const maxReachableDepth = Math.max(0, ...[...depthMap.values()]);

  // Unreachable nodes (orphans) get depth = maxReachableDepth + 1
  for (const url of urlList) {
    if (!depthMap.has(url)) depthMap.set(url, maxReachableDepth + 1);
  }

  return { depthMap, hierarchyDepth: maxReachableDepth };
}

// ─── Phase 4: Structural anomaly detection ────────────────────────────────────

function detectStructuralAnomalies(
  urlList: string[],
  inDegree: Map<string, number>,
  pageRankMap: Map<string, number>,
): { overlinkedPages: string[]; underlinkedCriticalPages: string[] } {
  if (urlList.length === 0) return { overlinkedPages: [], underlinkedCriticalPages: [] };

  const inDegrees = urlList.map((u) => inDegree.get(u) ?? 0);
  const mean = inDegrees.reduce((s, v) => s + v, 0) / inDegrees.length;
  const variance = inDegrees.reduce((s, v) => s + (v - mean) ** 2, 0) / inDegrees.length;
  const stdDev = Math.sqrt(variance);

  const overlinkedThreshold = Math.max(mean + 2 * stdDev, 5);

  const overlinkedPages = urlList.filter(
    (u) => (inDegree.get(u) ?? 0) > overlinkedThreshold,
  );

  // Underlinked critical: top 20% by PageRank but inDegree < median
  const sorted = [...urlList].sort(
    (a, b) => (pageRankMap.get(b) ?? 0) - (pageRankMap.get(a) ?? 0),
  );
  const topQuintile = new Set(sorted.slice(0, Math.ceil(urlList.length * 0.20)));
  const medianInDegree = inDegrees.sort((a, b) => a - b)[Math.floor(inDegrees.length / 2)] ?? 0;

  const underlinkedCriticalPages = urlList.filter(
    (u) =>
      topQuintile.has(u) &&
      (inDegree.get(u) ?? 0) < medianInDegree &&
      (inDegree.get(u) ?? 0) < mean,
  );

  return { overlinkedPages, underlinkedCriticalPages };
}

// ─── Phase 5: Topic cluster detection (label propagation) ────────────────────

function detectClusters(
  urls: string[],
  edges: GraphEdge[],
  inDegree: Map<string, number>,
): { clusterMap: Map<string, string>; weakClusters: string[][] } {
  const n = urls.length;
  if (n === 0) return { clusterMap: new Map(), weakClusters: [] };

  const labels = new Map<string, string>(urls.map((url, i) => [url, `cluster_${i}`]));
  const neighbors = new Map<string, Set<string>>();
  for (const url of urls) neighbors.set(url, new Set());
  for (const edge of edges) {
    neighbors.get(edge.from)?.add(edge.to);
    neighbors.get(edge.to)?.add(edge.from);
  }

  for (let iter = 0; iter < LABEL_PROPAGATION_ITERATIONS; iter++) {
    let changed = false;
    const ordered = [...urls].sort(
      (a, b) => (inDegree.get(b) ?? 0) - (inDegree.get(a) ?? 0),
    );

    for (const url of ordered) {
      const nbrs = neighbors.get(url);
      if (!nbrs || nbrs.size === 0) continue;
      const freq = new Map<string, number>();
      for (const nbr of nbrs) {
        const lbl = labels.get(nbr) ?? '';
        freq.set(lbl, (freq.get(lbl) ?? 0) + 1);
      }
      let best = labels.get(url) ?? '';
      let bestCount = freq.get(best) ?? 0;
      for (const [lbl, count] of freq.entries()) {
        if (count > bestCount || (count === bestCount && lbl < best)) {
          best = lbl; bestCount = count;
        }
      }
      if (best !== labels.get(url)) { labels.set(url, best); changed = true; }
    }
    if (!changed) break;
  }

  const clusterIds = new Map<string, number>();
  let nextId = 0;
  const clusterMap = new Map<string, string>();
  for (const url of urls) {
    const rawLabel = labels.get(url) ?? 'cluster_0';
    if (!clusterIds.has(rawLabel)) clusterIds.set(rawLabel, nextId++);
    clusterMap.set(url, `cluster_${clusterIds.get(rawLabel)}`);
  }

  const clusterGroups = new Map<string, string[]>();
  for (const [url, cluster] of clusterMap.entries()) {
    const group = clusterGroups.get(cluster) ?? [];
    group.push(url);
    clusterGroups.set(cluster, group);
  }

  const edgeSet = new Set(edges.map((e) => `${e.from}::${e.to}`));
  const weakClusters: string[][] = [];
  for (const [, members] of clusterGroups.entries()) {
    if (members.length < 2) continue;
    if (computeClusterDensity(members, edgeSet) < WEAK_CLUSTER_DENSITY_THRESHOLD) {
      weakClusters.push(members);
    }
  }

  return { clusterMap, weakClusters };
}

function computeClusterDensity(members: string[], edgeSet: Set<string>): number {
  const n = members.length;
  if (n < 2) return 1;
  const memberSet = new Set(members);
  let internalEdges = 0;
  for (const from of members) {
    for (const to of members) {
      if (from !== to && memberSet.has(to) && edgeSet.has(`${from}::${to}`)) internalEdges++;
    }
  }
  return internalEdges / (n * (n - 1));
}

// ─── Phase 6: Link Authority Flow Score ──────────────────────────────────────

function computeNodeLAFS(
  pageRank: number,
  maxPR: number,
  inDeg: number,
  meanInDeg: number,
  depth: number,
  maxDepth: number,
): number {
  const prNorm = pageRank / maxPR;
  const inboundRatio = Math.min(1, inDeg / Math.max(meanInDeg * 3, 1));
  const depthScore = maxDepth > 0 ? 1 - Math.min(1, depth / maxDepth) : 1;
  const raw = prNorm * 0.40 + inboundRatio * 0.30 + depthScore * 0.20 + 0.10;
  return Math.min(100, Math.max(0, Math.round(raw * 100)));
}

// ─── Phase 7: Link suggestions ────────────────────────────────────────────────

function suggestLinks(
  orphanPages: string[],
  allPages: CrawledPage[],
  pageTitles: Map<string, string | null>,
): LinkSuggestion[] {
  const suggestions: LinkSuggestion[] = [];
  const nonOrphanSet = new Set(
    allPages.map((p) => p.url).filter((u) => !orphanPages.includes(u)),
  );
  const nonOrphans = [...nonOrphanSet];

  for (const orphan of orphanPages.slice(0, 30)) {
    const candidates = nonOrphans
      .map((c) => ({ url: c, score: computeSimilarity(orphan, c, pageTitles) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_LINK_SUGGESTIONS_PER_ORPHAN);

    for (const candidate of candidates) {
      suggestions.push({
        from: candidate.url,
        to: orphan,
        reason: buildSuggestionReason(candidate.url, orphan, pageTitles),
      });
    }
  }

  return suggestions;
}

function computeSimilarity(
  a: string,
  b: string,
  pageTitles: Map<string, string | null>,
): number {
  const aSegs = new Set(urlPathSegments(a));
  const bSegs = new Set(urlPathSegments(b));
  const segOverlap = [...aSegs].filter((s) => bSegs.has(s)).length;
  const aKw = new Set(titleKeywords(pageTitles.get(a) ?? ''));
  const bKw = new Set(titleKeywords(pageTitles.get(b) ?? ''));
  const kwOverlap = [...aKw].filter((k) => bKw.has(k)).length;
  return segOverlap * 2 + kwOverlap;
}

function buildSuggestionReason(
  from: string,
  to: string,
  pageTitles: Map<string, string | null>,
): string {
  const fromTitle = pageTitles.get(from) ?? urlPathSegments(from).pop() ?? from;
  const toTitle = pageTitles.get(to) ?? urlPathSegments(to).pop() ?? to;
  const shared = urlPathSegments(from).filter((s) => urlPathSegments(to).includes(s));
  if (shared.length > 0) {
    return `Both pages share the URL path segment "/${shared[0]}/" — add a link from "${fromTitle}" to "${toTitle}" to connect this orphan page.`;
  }
  return `"${fromTitle}" covers a related topic — add a link to "${toTitle}" to resolve orphan status.`;
}

// ─── Phase 8: Structural issues ──────────────────────────────────────────────

function buildStructuralIssues(
  orphanPages: string[],
  deadEndPages: string[],
  overlinkedPages: string[],
  underlinkedCriticalPages: string[],
  pageTitles: Map<string, string | null>,
): LinkStructuralIssue[] {
  const issues: LinkStructuralIssue[] = [];

  for (const url of orphanPages.slice(0, MAX_STRUCTURAL_ISSUES_PER_TYPE)) {
    const lbl = pageLabel(url, pageTitles);
    issues.push({
      type: 'orphan', url, severity: 'warning',
      description: `"${lbl}" has no incoming internal links — invisible to AI crawlers following link paths.`,
      recommendation: 'Add at least one contextual internal link to this page from a related, well-linked page.',
    });
  }

  for (const url of deadEndPages.slice(0, MAX_STRUCTURAL_ISSUES_PER_TYPE)) {
    const lbl = pageLabel(url, pageTitles);
    issues.push({
      type: 'dead_end', url, severity: 'info',
      description: `"${lbl}" has no outgoing internal links — authority terminates at this page.`,
      recommendation: 'Add contextually relevant links to distribute authority and guide AI crawlers onward.',
    });
  }

  for (const url of overlinkedPages.slice(0, 5)) {
    const lbl = pageLabel(url, pageTitles);
    issues.push({
      type: 'overlinked', url, severity: 'info',
      description: `"${lbl}" receives an unusually high number of internal links — may dilute authority distribution across the site.`,
      recommendation: 'Review whether all links to this page are contextually justified.',
    });
  }

  for (const url of underlinkedCriticalPages.slice(0, MAX_STRUCTURAL_ISSUES_PER_TYPE)) {
    const lbl = pageLabel(url, pageTitles);
    issues.push({
      type: 'underlinked_critical', url, severity: 'warning',
      description: `"${lbl}" is a high-value page (top PageRank quintile) but receives fewer links than average.`,
      recommendation: 'Add targeted internal links from related pages to amplify authority flow to this key page.',
    });
  }

  return issues;
}

function pageLabel(url: string, pageTitles: Map<string, string | null>): string {
  const title = pageTitles.get(url);
  if (title) return title.length > 40 ? title.slice(0, 37) + '…' : title;
  try {
    const u = new URL(url);
    return u.pathname || u.hostname;
  } catch { return url; }
}

// ─── Phase 9: External link metadata ─────────────────────────────────────────

function aggregateExternalLinkMeta(pages: CrawledPage[]): ExternalLinkMeta {
  let totalExternal = 0;
  let weightedNoFollow = 0;
  const domainCounts = new Map<string, number>();
  const authorityScores: number[] = [];

  for (const page of pages) {
    if (page.externalLinkMeta) {
      const meta = page.externalLinkMeta;
      totalExternal += meta.externalLinkCount;
      weightedNoFollow += meta.nofollowRatio * meta.externalLinkCount;
      for (const { domain, count } of meta.topDomains) {
        domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + count);
      }
      if (meta.externalLinkCount > 0) authorityScores.push(meta.externalAuthorityScore);
    } else {
      totalExternal += page.externalLinks.length;
      for (const url of page.externalLinks) {
        try {
          const host = new URL(url).hostname.replace(/^www\./, '');
          domainCounts.set(host, (domainCounts.get(host) ?? 0) + 1);
        } catch { /* ignore */ }
      }
    }
  }

  const topDomains = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  const nofollowRatio = totalExternal > 0
    ? Math.round((weightedNoFollow / totalExternal) * 100) / 100
    : 0;

  const externalAuthorityScore = authorityScores.length > 0
    ? Math.round(authorityScores.reduce((s, v) => s + v, 0) / authorityScores.length)
    : 0;

  return { externalLinkCount: totalExternal, topDomains, nofollowRatio, externalAuthorityScore };
}

// ─── Phase 10: Structural Health Score ───────────────────────────────────────

function computeScore(
  pageCount: number,
  orphanCount: number,
  deadEndCount: number,
  overlinkedCount: number,
  weakClusters: string[][],
): number {
  if (pageCount === 0) return 0;

  const orphanPenalty = Math.min(50, (orphanCount / pageCount) * 100);
  const deadEndPenalty = Math.min(20, (deadEndCount / pageCount) * 40);
  const clusterPenalty = Math.min(20, weakClusters.length * 5);
  const overlinkedPenalty = Math.min(10, overlinkedCount * 2);

  const raw = 100 - orphanPenalty - deadEndPenalty - clusterPenalty - overlinkedPenalty;
  return Math.max(0, Math.round(raw));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function detectRootUrl(pages: CrawledPage[]): string {
  return pages.reduce((best, p) => {
    try {
      const u = new URL(p.url);
      if (u.pathname === '/' || u.pathname === '') return p.url;
    } catch { /* ignore */ }
    return p.url.length < best.length ? p.url : best;
  }, pages[0]?.url ?? '');
}

function deriveLabel(url: string, title: string | null): string {
  if (title) return title.length > 60 ? title.slice(0, 57) + '…' : title;
  try {
    const u = new URL(url);
    const slug = u.pathname.split('/').filter(Boolean).pop();
    return slug ?? u.hostname;
  } catch { return url; }
}

function urlPathSegments(url: string): string[] {
  try {
    return new URL(url).pathname
      .split('/')
      .map((s) => s.toLowerCase().trim())
      .filter((s) => s.length > 2 && !/^\d+$/.test(s));
  } catch { return []; }
}

function titleKeywords(title: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'is', 'are', 'was', 'with',
  ]);
  return title
    .toLowerCase()
    .split(/[\s\-_/]+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));
}
