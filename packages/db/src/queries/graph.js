"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeFactGraph = writeFactGraph;
exports.writePerceptionGraph = writePerceptionGraph;
const client_1 = require("../client");
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
async function writeFactGraph(auditId, pages) {
    if (pages.length === 0)
        return;
    // ── Fact nodes ─────────────────────────────────────────────────────────────
    const pageNodes = pages.map((p) => ({
        auditId,
        nodeType: 'page',
        label: p.url,
        url: p.url,
        source: 'dom',
        confidence: 1.0,
    }));
    // Schema entity nodes — deduplicated by name within this audit
    const schemaEntityNames = new Set();
    const schemaEntityNodes = [];
    for (const page of pages) {
        for (const schema of page.schemaMarkup) {
            const s = schema;
            const name = typeof s['name'] === 'string' ? s['name'].slice(0, 200) : null;
            if (name && !schemaEntityNames.has(name)) {
                schemaEntityNames.add(name);
                schemaEntityNodes.push({
                    auditId, nodeType: 'schema_entity', label: name,
                    url: null, source: 'schema', confidence: 0.9,
                });
            }
        }
    }
    // External domain nodes — deduplicated by hostname
    const externalDomains = new Set();
    for (const page of pages) {
        for (const extUrl of page.externalLinks) {
            try {
                const host = new URL(extUrl).hostname.replace(/^www\./, '');
                if (!externalDomains.has(host)) {
                    externalDomains.add(host);
                }
            }
            catch { /* skip malformed URLs */ }
        }
    }
    const externalDomainNodes = [...externalDomains].map((domain) => ({
        auditId, nodeType: 'external_domain', label: domain,
        url: `https://${domain}`, source: 'dom', confidence: 1.0,
    }));
    await client_1.db.factNode.createMany({
        data: [...pageNodes, ...schemaEntityNodes, ...externalDomainNodes],
        skipDuplicates: true,
    });
    // ── Fact edges ─────────────────────────────────────────────────────────────
    const internalEdges = [];
    const externalEdges = [];
    for (const page of pages) {
        // Use rich LinkRef data when available (includes anchor text + position)
        if (page.internalLinkRefs && page.internalLinkRefs.length > 0) {
            for (const ref of page.internalLinkRefs) {
                internalEdges.push({
                    auditId,
                    fromUrl: page.url,
                    toUrl: ref.url,
                    relationship: 'INTERNAL_LINK',
                    anchorText: ref.anchorText || null,
                    position: ref.position,
                    isNoFollow: ref.isNoFollow,
                    confidence: 1.0,
                });
            }
        }
        else {
            // Fallback: plain internalLinks array (no anchor text or position)
            for (const toUrl of page.internalLinks) {
                internalEdges.push({
                    auditId,
                    fromUrl: page.url,
                    toUrl,
                    relationship: 'INTERNAL_LINK',
                    anchorText: null,
                    position: null,
                    isNoFollow: false,
                    confidence: 1.0,
                });
            }
        }
        // External links — URL only (no anchor/position signals from extractor)
        for (const extUrl of page.externalLinks) {
            externalEdges.push({
                auditId,
                fromUrl: page.url,
                toUrl: extUrl,
                relationship: 'EXTERNAL_LINK',
                anchorText: null,
                position: null,
                isNoFollow: false,
                confidence: 1.0,
            });
        }
    }
    // Batch insert in chunks of 500 to stay within Postgres parameter limits
    const allEdges = [...internalEdges, ...externalEdges];
    const CHUNK = 500;
    for (let i = 0; i < allEdges.length; i += CHUNK) {
        await client_1.db.factEdge.createMany({
            data: allEdges.slice(i, i + CHUNK),
            skipDuplicates: true,
        });
    }
}
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
async function writePerceptionGraph(auditId, snapshot) {
    if (snapshot.nodes.length === 0)
        return;
    await client_1.db.perceptionNode.createMany({
        data: snapshot.nodes.map((n) => ({
            auditId,
            nodeRef: n.id,
            nodeType: n.type,
            label: n.label.slice(0, 500),
            confidence: n.confidence / 100, // snapshot stores 0–100; DB stores 0–1
            citationReadiness: n.citationReadiness / 100,
            disambiguationStrength: n.disambiguationStrength / 100,
            derivedFrom: 'fact_graph',
        })),
        skipDuplicates: true,
    });
    if (snapshot.edges.length === 0)
        return;
    await client_1.db.perceptionEdge.createMany({
        data: snapshot.edges.map((e) => ({
            auditId,
            sourceRef: e.source,
            targetRef: e.target,
            relationshipType: e.relationshipType,
            strength: e.strength,
            derivedFrom: 'ai_inference',
        })),
        skipDuplicates: true,
    });
}
//# sourceMappingURL=graph.js.map