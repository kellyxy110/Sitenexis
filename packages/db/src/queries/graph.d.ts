import type { CrawledPage, PerceptionGraphSnapshot } from '@sitenexis/shared';
/**
 * Dual-writes crawled pages and their internal links into the normalized
 * Fact Graph tables (fact_nodes, fact_edges).
 *
 * Rules:
 *   - Only DOM-extracted data enters fact tables
 *   - confidence = 1.0 for all rows (verified extraction)
 *   - Uses createMany (batch insert, no upsert — tables are append-only per audit)
 *   - External domains written as fact_nodes with nodeType = 'external_domain'
 *   - Schema entities written as fact_nodes with nodeType = 'schema_entity'
 */
export declare function writeFactGraph(auditId: string, pages: CrawledPage[]): Promise<void>;
/**
 * Writes the normalized Perception Graph (nodes + edges) derived from an
 * existing PerceptionGraphSnapshot.
 *
 * Rules:
 *   - Only called after the Fact Graph write succeeds
 *   - derivedFrom is always 'fact_graph' for nodes, 'ai_inference' for edges
 *   - Nodes with confidence < 0.5 are stored but will be suppressed by the UI
 *     rendering layer (PCE gate) — they are NOT filtered here
 */
export declare function writePerceptionGraph(auditId: string, snapshot: PerceptionGraphSnapshot): Promise<void>;
//# sourceMappingURL=graph.d.ts.map