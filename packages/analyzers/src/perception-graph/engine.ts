import type {
  CrawledPage,
  EntityIntelligenceReport,
  PerceptionGraphSnapshot,
  PerceptionNode,
  PerceptionEdge,
  PerceptionRelationshipType,
} from '@sitenexis/shared';
import { createHash } from 'crypto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId(label: string, type: string): string {
  return createHash('md5').update(`${type}:${label}`).digest('hex').slice(0, 12);
}

// ─── Entity nodes ─────────────────────────────────────────────────────────────

function buildEntityNodes(
  entityReport: EntityIntelligenceReport,
  pages: CrawledPage[]
): PerceptionNode[] {
  return entityReport.entitiesDetected.map((entity) => {
    // Find pages that mention this entity
    const normalizedName = entity.normalizedName.toLowerCase();
    const supportingPages = pages
      .filter((p) => p.bodyText.toLowerCase().includes(normalizedName))
      .map((p) => p.url)
      .slice(0, 10);

    const citationReadiness = Math.round(
      (entity.consistencyScore * 0.4 + entity.disambiguationScore * 0.6)
    );

    return {
      id: makeId(entity.normalizedName, 'entity'),
      type: 'entity',
      label: entity.name,
      confidence: Math.round(entity.consistencyScore),
      citationReadiness: Math.min(100, citationReadiness),
      disambiguationStrength: entity.disambiguationScore,
      supportingPages,
    };
  });
}

// ─── Topic nodes ──────────────────────────────────────────────────────────────

function extractTopicClusters(pages: CrawledPage[]): string[] {
  // Use heading text to identify major topics
  const topicFrequency = new Map<string, number>();

  for (const page of pages) {
    for (const heading of page.headings) {
      if (heading.level <= 2) {
        const words = heading.text
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 3);

        for (const word of words) {
          topicFrequency.set(word, (topicFrequency.get(word) ?? 0) + 1);
        }
      }
    }
  }

  // Top topics by frequency (minimum 2 occurrences)
  return [...topicFrequency.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}

function buildTopicNodes(
  topics: string[],
  pages: CrawledPage[],
  entityConfidenceScore: number
): PerceptionNode[] {
  return topics.map((topic) => {
    const supportingPages = pages
      .filter((p) =>
        p.headings.some((h) => h.text.toLowerCase().includes(topic.toLowerCase())) ||
        p.title?.toLowerCase().includes(topic.toLowerCase())
      )
      .map((p) => p.url)
      .slice(0, 10);

    const confidence = Math.min(100, Math.round(
      (supportingPages.length / Math.max(pages.length, 1)) * 100 * 2
    ));

    return {
      id: makeId(topic, 'topic'),
      type: 'topic',
      label: topic,
      confidence,
      citationReadiness: Math.round(entityConfidenceScore * 0.7),
      disambiguationStrength: Math.min(100, supportingPages.length * 15),
      supportingPages,
    };
  });
}

// ─── Page nodes ───────────────────────────────────────────────────────────────

function buildPageNodes(pages: CrawledPage[], entityConfidenceScore: number): PerceptionNode[] {
  return pages.slice(0, 15).map((page) => ({
    id: makeId(page.url, 'page'),
    type: 'page',
    label: page.title ?? page.url,
    confidence: Math.min(100, Math.round((page.wordCount / 500) * 30) + 40),
    citationReadiness: page.schemaMarkup.length > 0 ? Math.round(entityConfidenceScore * 0.8) : Math.round(entityConfidenceScore * 0.5),
    disambiguationStrength: page.schemaMarkup.length > 0 ? 70 : 40,
    supportingPages: [page.url],
  }));
}

// ─── Edges ────────────────────────────────────────────────────────────────────

function buildEntityTopicEdges(
  entityNodes: PerceptionNode[],
  topicNodes: PerceptionNode[],
  _pages: CrawledPage[]
): PerceptionEdge[] {
  const edges: PerceptionEdge[] = [];

  for (const entity of entityNodes) {
    for (const topic of topicNodes) {
      // Check if entity appears in pages that also contain this topic
      const sharedPages = entity.supportingPages.filter((url) =>
        topicNodes
          .find((t) => t.id === topic.id)
          ?.supportingPages.includes(url)
      );

      if (sharedPages.length > 0) {
        const strength = Math.min(1, sharedPages.length / 5);
        const relationship: PerceptionRelationshipType = 'relatedTo';

        edges.push({
          source: entity.id,
          target: topic.id,
          relationshipType: relationship,
          strength,
          evidencedBy: sharedPages.slice(0, 3),
        });
      }
    }
  }

  return edges;
}

function buildEntityEntityEdges(
  entityNodes: PerceptionNode[],
  _pages: CrawledPage[]
): PerceptionEdge[] {
  const edges: PerceptionEdge[] = [];

  for (let i = 0; i < entityNodes.length; i++) {
    for (let j = i + 1; j < entityNodes.length; j++) {
      const entityA = entityNodes[i]!;
      const entityB = entityNodes[j]!;

      const sharedPages = entityA.supportingPages.filter((url) =>
        entityB.supportingPages.includes(url)
      );

      if (sharedPages.length >= 2) {
        const strength = Math.min(1, sharedPages.length / 4);
        edges.push({
          source: entityA.id,
          target: entityB.id,
          relationshipType: 'relatedTo',
          strength,
          evidencedBy: sharedPages.slice(0, 3),
        });
      }
    }
  }

  return edges.slice(0, 30); // Cap at 30 entity-entity edges
}

function buildPageEntityEdges(
  pageNodes: PerceptionNode[],
  entityNodes: PerceptionNode[]
): PerceptionEdge[] {
  const edges: PerceptionEdge[] = [];

  for (const pageNode of pageNodes) {
    const pageUrl = pageNode.supportingPages[0];
    if (!pageUrl) continue;

    for (const entityNode of entityNodes) {
      if (entityNode.supportingPages.includes(pageUrl)) {
        edges.push({
          source: pageNode.id,
          target: entityNode.id,
          relationshipType: 'supports',
          strength: Math.min(1, entityNode.confidence / 100),
          evidencedBy: [pageUrl],
        });
      }
    }
  }

  return edges.slice(0, 50); // Cap total page-entity edges
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildPerceptionGraph(
  auditId: string,
  pages: CrawledPage[],
  entityReport: EntityIntelligenceReport
): PerceptionGraphSnapshot {
  if (pages.length === 0) {
    return { auditId, nodes: [], edges: [] };
  }

  const topics = extractTopicClusters(pages);
  const entityNodes = buildEntityNodes(entityReport, pages);
  // Use a confidence floor of 20 when no entities were validated (heuristic-only graph)
  const baseConfidence = entityReport.entitiesDetected.length > 0
    ? entityReport.entityConfidenceScore
    : 20;
  const topicNodes = buildTopicNodes(topics, pages, baseConfidence);
  const pageNodes = buildPageNodes(pages, baseConfidence);

  const allNodes: PerceptionNode[] = [...entityNodes, ...topicNodes, ...pageNodes];

  const entityTopicEdges = buildEntityTopicEdges(entityNodes, topicNodes, pages);
  const entityEntityEdges = buildEntityEntityEdges(entityNodes, pages);
  const pageEntityEdges = buildPageEntityEdges(pageNodes, entityNodes);

  // When no entity nodes exist, link topic nodes to each other via shared pages
  const topicTopicEdges: PerceptionEdge[] = [];
  if (entityNodes.length === 0 && topicNodes.length >= 2) {
    for (let i = 0; i < topicNodes.length; i++) {
      for (let j = i + 1; j < topicNodes.length; j++) {
        const a = topicNodes[i]!;
        const b = topicNodes[j]!;
        const shared = a.supportingPages.filter((u) => b.supportingPages.includes(u));
        if (shared.length > 0) {
          topicTopicEdges.push({
            source: a.id,
            target: b.id,
            relationshipType: 'relatedTo',
            strength: Math.min(1, shared.length / 3),
            evidencedBy: shared.slice(0, 2),
          });
        }
      }
    }
  }

  const allEdges: PerceptionEdge[] = [
    ...entityTopicEdges,
    ...entityEntityEdges,
    ...pageEntityEdges,
    ...topicTopicEdges.slice(0, 20),
  ];

  // Return empty only if truly nothing was built
  if (allNodes.length === 0) return { auditId, nodes: [], edges: [] };

  return { auditId, nodes: allNodes, edges: allEdges };
}
