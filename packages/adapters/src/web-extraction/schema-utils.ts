/**
 * Flattens a parsed JSON-LD block into individual entity objects.
 *
 * Sites commonly publish multiple entities in one <script> tag via the
 * `@graph` array (Organization + Person + WebSite + ... under one @context).
 * Every downstream schema check in this codebase (sameAs detection, @type
 * lookups, dateModified/freshness checks, speakable detection) expects one
 * entity per array entry — without flattening, a @graph-wrapped script
 * becomes a single opaque { @context, @graph: [...] } object whose own
 * top-level keys never match, producing false-negative "missing schema"
 * findings even when the schema is present and valid.
 */
export function flattenJsonLd(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed.flatMap((item) => flattenJsonLd(item));
  }
  if (parsed && typeof parsed === 'object') {
    const graph = (parsed as Record<string, unknown>)['@graph'];
    if (Array.isArray(graph)) {
      return graph;
    }
  }
  return [parsed];
}
