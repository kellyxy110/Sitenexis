import {
  type CrawledPage,
  type LinkGraphScore,
  type GraphNode,
  type GraphEdge,
  type LinkSuggestion,
} from '@sitenexis/shared';

const DAMPING_FACTOR = 0.85;
const PAGERANK_ITERATIONS = 10;
const WEAK_CLUSTER_DENSITY_THRESHOLD = 0.30;
const MAX_LINK_SUGGESTIONS_PER_ORPHAN = 3;
const LABEL_PROPAGATION_ITERATIONS = 10;

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build a directed internal link graph from a crawl result and compute all
 * graph intelligence signals: PageRank, orphan detection, topic clusters,
 * weak cluster identification, and link suggestions.
 */
export function analyzeLinkGraph(pages: CrawledPage[]): LinkGraphScore {
  if (pages.length === 0) {
    return {
      score: 0, nodes: [], edges: [], orphanPages: [],
      weakClusters: [], avgPageRank: 0, linkSuggestions: [],
    };
  }

  // Phase 1: Build graph
  const { edges, inDegree, outDegree } = buildGraph(pages);

  // Phase 2: PageRank
  const urlList = pages.map((p) => p.url);
  const pageRankMap = computePageRank(urlList, edges);

  // Phase 3: Orphan detection
  const rootUrl = detectRootUrl(pages);
  const orphanPages = urlList.filter(
    (url) => (inDegree.get(url) ?? 0) === 0 && url !== rootUrl
  );

  // Phase 4: Topic cluster detection
  const { clusterMap, weakClusters } = detectClusters(urlList, edges, inDegree);

  // Build nodes
  const pageTitles = new Map(pages.map((p) => [p.url, p.title ?? null]));
  const nodes: GraphNode[] = pages.map((p) => {
    const pr = pageRankMap.get(p.url) ?? 0;
    const ind = inDegree.get(p.url) ?? 0;
    const outd = outDegree.get(p.url) ?? 0;
    const label = deriveLabel(p.url, p.title);
    const cluster = clusterMap.get(p.url) ?? 'cluster_0';
    return {
      url: p.url,
      id: p.url,
      label,
      pageRank: pr,
      inDegree: ind,
      inboundCount: ind,
      outDegree: outd,
      outboundCount: outd,
      depth: 0,
      cluster,
    };
  });

  const avgPageRank = nodes.reduce((s, n) => s + n.pageRank, 0) / nodes.length;

  // Phase 5: Link suggestions
  const linkSuggestions = suggestLinks(orphanPages, pages, pageTitles);

  // Scoring
  const score = computeScore(pages.length, orphanPages.length, nodes, weakClusters);

  return {
    score,
    nodes,
    edges,
    orphanPages,
    weakClusters,
    avgPageRank,
    linkSuggestions,
  };
}

// ─── Phase 1: Graph construction ─────────────────────────────────────────────

function buildGraph(pages: CrawledPage[]): {
  edges: GraphEdge[];
  inDegree: Map<string, number>;
  outDegree: Map<string, number>;
} {
  const urlSet = new Set(pages.map((p) => p.url));
  const edgeWeights = new Map<string, number>(); // "from::to" → count
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  // Initialise degree counters
  for (const page of pages) {
    inDegree.set(page.url, 0);
    outDegree.set(page.url, 0);
  }

  for (const page of pages) {
    for (const link of page.internalLinks) {
      if (!urlSet.has(link)) continue;
      const key = `${page.url}::${link}`;
      edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
    }
  }

  const edges: GraphEdge[] = [];
  for (const [key, weight] of edgeWeights.entries()) {
    const sep = key.indexOf('::');
    const from = key.slice(0, sep);
    const to = key.slice(sep + 2);
    edges.push({ from, to, source: from, target: to, weight, anchorText: null });
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

  // Build adjacency: from-index → list of to-indexes
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

// ─── Phase 4: Topic cluster detection (label propagation) ────────────────────

function detectClusters(
  urls: string[],
  edges: GraphEdge[],
  inDegree: Map<string, number>
): { clusterMap: Map<string, string>; weakClusters: string[][] } {
  const n = urls.length;
  if (n === 0) return { clusterMap: new Map(), weakClusters: [] };

  // Initialise: each node gets its own cluster label
  const labels = new Map<string, string>(urls.map((url, i) => [url, `cluster_${i}`]));

  // Build bidirectional adjacency for propagation
  const neighbors = new Map<string, Set<string>>();
  for (const url of urls) neighbors.set(url, new Set());
  for (const edge of edges) {
    neighbors.get(edge.from)?.add(edge.to);
    neighbors.get(edge.to)?.add(edge.from);
  }

  // Label propagation: adopt the most common label among neighbors
  for (let iter = 0; iter < LABEL_PROPAGATION_ITERATIONS; iter++) {
    let changed = false;
    // Shuffle-like iteration order: sort by in-degree desc (high-authority nodes stabilise first)
    const ordered = [...urls].sort(
      (a, b) => (inDegree.get(b) ?? 0) - (inDegree.get(a) ?? 0)
    );

    for (const url of ordered) {
      const nbrs = neighbors.get(url);
      if (!nbrs || nbrs.size === 0) continue;

      // Count neighbour labels
      const freq = new Map<string, number>();
      for (const nbr of nbrs) {
        const lbl = labels.get(nbr) ?? '';
        freq.set(lbl, (freq.get(lbl) ?? 0) + 1);
      }

      // Pick most frequent; tie-break deterministically by label string
      let best = labels.get(url) ?? '';
      let bestCount = freq.get(best) ?? 0;
      for (const [lbl, count] of freq.entries()) {
        if (count > bestCount || (count === bestCount && lbl < best)) {
          best = lbl;
          bestCount = count;
        }
      }

      if (best !== labels.get(url)) {
        labels.set(url, best);
        changed = true;
      }
    }

    if (!changed) break;
  }

  // Rename clusters sequentially (cluster_0, cluster_1, …) and assign slug names
  const clusterIds = new Map<string, number>();
  let nextId = 0;
  const clusterMap = new Map<string, string>();

  for (const url of urls) {
    const rawLabel = labels.get(url) ?? 'cluster_0';
    if (!clusterIds.has(rawLabel)) {
      clusterIds.set(rawLabel, nextId++);
    }
    clusterMap.set(url, `cluster_${clusterIds.get(rawLabel)}`);
  }

  // Group URLs by cluster for weak-cluster analysis
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
    const density = computeClusterDensity(members, edgeSet);
    if (density < WEAK_CLUSTER_DENSITY_THRESHOLD) {
      weakClusters.push(members);
    }
  }

  return { clusterMap, weakClusters };
}

/**
 * Internal link density of a cluster = actual edges / maximum possible edges.
 * Maximum for a directed graph of n nodes = n*(n-1).
 */
function computeClusterDensity(members: string[], edgeSet: Set<string>): number {
  const n = members.length;
  if (n < 2) return 1;
  const memberSet = new Set(members);
  let internalEdges = 0;

  for (const from of members) {
    for (const to of members) {
      if (from !== to && memberSet.has(to) && edgeSet.has(`${from}::${to}`)) {
        internalEdges++;
      }
    }
  }

  const maxPossible = n * (n - 1);
  return internalEdges / maxPossible;
}

// ─── Phase 5: Link suggestions ────────────────────────────────────────────────

function suggestLinks(
  orphanPages: string[],
  allPages: CrawledPage[],
  pageTitles: Map<string, string | null>
): LinkSuggestion[] {
  const suggestions: LinkSuggestion[] = [];
  const nonOrphanSet = new Set(allPages.map((p) => p.url).filter((u) => !orphanPages.includes(u)));
  const nonOrphans = [...nonOrphanSet];

  for (const orphan of orphanPages) {
    const candidates = nonOrphans
      .map((candidate) => ({
        url: candidate,
        score: computeSimilarity(orphan, candidate, pageTitles),
      }))
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

/**
 * Similarity score between two URLs for link suggestion purposes.
 * Combines URL path segment overlap and shared title keywords.
 */
function computeSimilarity(
  a: string,
  b: string,
  pageTitles: Map<string, string | null>
): number {
  const aSegments = new Set(urlPathSegments(a));
  const bSegments = new Set(urlPathSegments(b));
  const segmentOverlap = [...aSegments].filter((s) => bSegments.has(s)).length;

  const aKeywords = new Set(titleKeywords(pageTitles.get(a) ?? ''));
  const bKeywords = new Set(titleKeywords(pageTitles.get(b) ?? ''));
  const keywordOverlap = [...aKeywords].filter((k) => bKeywords.has(k)).length;

  return segmentOverlap * 2 + keywordOverlap;
}

function buildSuggestionReason(
  from: string,
  to: string,
  pageTitles: Map<string, string | null>
): string {
  const fromTitle = pageTitles.get(from) ?? urlPathSegments(from).pop() ?? from;
  const toTitle = pageTitles.get(to) ?? urlPathSegments(to).pop() ?? to;
  const sharedSegments = urlPathSegments(from).filter((s) =>
    urlPathSegments(to).includes(s)
  );

  if (sharedSegments.length > 0) {
    return `Both pages share the URL path segment "/${sharedSegments[0]}/" — add a link from "${fromTitle}" to "${toTitle}" to connect this orphan page.`;
  }

  return `"${fromTitle}" covers a related topic — add a link to "${toTitle}" to resolve orphan status.`;
}

function urlPathSegments(url: string): string[] {
  try {
    return new URL(url).pathname
      .split('/')
      .map((s) => s.toLowerCase().trim())
      .filter((s) => s.length > 2 && !/^\d+$/.test(s));
  } catch {
    return [];
  }
}

function titleKeywords(title: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'is', 'are', 'was', 'with']);
  return title
    .toLowerCase()
    .split(/[\s\-_/]+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function detectRootUrl(pages: CrawledPage[]): string {
  // Root = shortest URL, or the one with path "/"
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
  } catch {
    return url;
  }
}

function computeScore(
  pageCount: number,
  orphanCount: number,
  nodes: GraphNode[],
  weakClusters: string[][]
): number {
  if (pageCount === 0) return 0;

  const orphanRatio = orphanCount / pageCount;
  const connectivityScore = Math.max(0, 100 - orphanRatio * 100);

  const avgOutbound = nodes.reduce((s, n) => s + n.outDegree, 0) / nodes.length;
  const linkingScore = Math.min(100, avgOutbound * 10);

  const weakClusterPenalty = Math.min(20, weakClusters.length * 5);

  return Math.round(
    Math.min(100, connectivityScore * 0.5 + linkingScore * 0.3 + (20 - weakClusterPenalty) * 1)
  );
}
