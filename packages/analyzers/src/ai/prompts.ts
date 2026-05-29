/**
 * Prompt templates for the SiteNexis AI Readability Engine.
 *
 * Rules for all prompts:
 * - Body excerpts are capped at ~2000 tokens (~8000 chars) to control costs.
 * - Every prompt ends with "Return ONLY valid JSON. No explanation. No markdown."
 * - A concrete example output is included in the system prompt for consistency.
 * - Scores are always integers to prevent drift in downstream averaging.
 */

/**
 * Truncate content to a byte limit and emit a structured warning to stderr
 * when content is actually cut. This makes all prompt truncation observable.
 */
function truncateWithWarning(content: string, limit: number, context: string): string {
  if (content.length <= limit) return content;
  const dropped = content.length - limit;
  process.stderr.write(
    JSON.stringify({
      level: 'warn',
      event: 'TRUNCATION_DETECTED',
      context,
      originalLength: content.length,
      truncatedLength: limit,
      droppedChars: dropped,
    }) + '\n'
  );
  return content.slice(0, limit);
}

export const AI_SYSTEM_PROMPT =
  'You are an AI content analysis expert evaluating web pages for AI retrieval readiness. ' +
  'You analyse how well a page can be retrieved, understood, and cited by AI systems such as ' +
  'ChatGPT, Perplexity, Google AI Overviews, and Gemini. ' +
  'You always return a single valid JSON object with no surrounding text, explanation, or markdown.';

const MAX_BODY_CHARS = 8_000; // ~2000 tokens

// ─── Prompt 1: Entity Clarity ─────────────────────────────────────────────────

/**
 * Builds the user prompt for evaluating entity clarity (0–25).
 *
 * Evaluates whether named entities (people, organisations, products, places,
 * services) are clearly identified and defined on the page — a prerequisite
 * for an AI system to reliably reference this content.
 *
 * @param title       - Page <title> text.
 * @param bodyExcerpt - First ~8000 chars of extracted body text.
 */
export function entityClarityPrompt(title: string, bodyExcerpt: string): string {
  const excerpt = truncateWithWarning(bodyExcerpt, MAX_BODY_CHARS, `entityClarityPrompt title="${title}"`);

  return `Evaluate the entity clarity of the following web page for AI retrieval readiness.

Page title: ${title}

Body text:
${excerpt}

Your task:
1. Identify all named entities present on the page (people, organisations, places, products, services, technologies).
2. Rate the entity clarity on a scale of 0–25 (integer only):
   - 21–25: All key entities explicitly named, defined in context, and unambiguous
   - 16–20: Most entities clear; one or two are assumed knowledge
   - 11–15: Several entities unnamed or lacking context
   - 6–10: Significant entity clarity problems — important entities ambiguous or absent
   - 0–5: Very poor — entities undefined, inconsistent, or completely absent
3. List up to 5 specific missing entity signals (e.g. "Company founding date not stated", "Author identity not defined").

Return ONLY valid JSON. No explanation. No markdown.
Example: {"score": 17, "missingEntities": ["Organisation founding year not stated", "Author credentials absent"]}`;
}

// ─── Prompt 2: Conversational Readiness ───────────────────────────────────────

/**
 * Builds the user prompt for evaluating conversational readiness (0–25).
 *
 * Evaluates whether the page is structured to answer natural language queries
 * as an AI assistant would receive them — direct answers, FAQ structures,
 * H1/title alignment with likely search queries.
 *
 * @param title       - Page <title> text.
 * @param headings    - Array of H1/H2/H3 heading texts from the page.
 * @param bodyExcerpt - First ~8000 chars of extracted body text.
 */
export function conversationalReadinessPrompt(
  title: string,
  headings: string[],
  bodyExcerpt: string
): string {
  const excerpt = truncateWithWarning(bodyExcerpt, MAX_BODY_CHARS, `conversationalReadinessPrompt title="${title}"`);
  const headingList = headings.length > 0
    ? headings.map((h, i) => `${i + 1}. ${h}`).join('\n')
    : '(no headings detected)';

  return `Evaluate the conversational readiness of the following web page for AI query answering.

Page title: ${title}

Page headings:
${headingList}

Body text:
${excerpt}

Your task:
1. Assess whether the content directly answers questions a real user would ask an AI assistant.
2. Check for: FAQ-style Q&A structures, direct factual answers, natural prose (not keyword lists), and whether the H1/title matches what someone would literally search for.
3. Rate conversational readiness on a scale of 0–25 (integer only):
   - 21–25: Clear Q&A structures, direct answers, title matches natural queries
   - 16–20: Good structure; answers findable but not immediately surfaced
   - 11–15: Moderate — requires significant reading to extract answers
   - 6–10: Poor — answers buried, content is keyword-dense rather than answer-focused
   - 0–5: Not conversationally structured; unsuitable for AI Q&A extraction
4. List up to 5 specific issues found (e.g. "No FAQ section", "H1 is a keyword list, not a question or statement").

Return ONLY valid JSON. No explanation. No markdown.
Example: {"score": 19, "issues": ["No FAQ section present", "Introduction does not state a direct answer"]}`;
}

// ─── Prompt 3: AI Extractability ─────────────────────────────────────────────

/**
 * Builds the user prompt for evaluating AI extractability (0–25).
 *
 * Evaluates whether an AI system can compress this page into an accurate
 * 2-sentence summary — a proxy for chunk-level extractability in a RAG pipeline.
 * Fragmented, tab-gated, or structurally incoherent content scores low.
 *
 * @param title       - Page <title> text.
 * @param bodyExcerpt - First ~8000 chars of extracted body text.
 */
export function aiExtractabilityPrompt(title: string, bodyExcerpt: string): string {
  const excerpt = truncateWithWarning(bodyExcerpt, MAX_BODY_CHARS, `aiExtractabilityPrompt title="${title}"`);

  return `Evaluate the AI extractability of the following web page — how cleanly an AI system can summarise and cite it.

Page title: ${title}

Body text:
${excerpt}

Your task:
1. Attempt to summarise the page in exactly 2 sentences. If you cannot produce a coherent summary, note why.
2. Rate AI extractability on a scale of 0–25 (integer only):
   - 21–25: Highly extractable — clear thesis, logical structure, dense useful content
   - 16–20: Mostly extractable — good content with minor structural fragmentation
   - 11–15: Partially extractable — useful content exists but is fragmented or ambiguous
   - 6–10: Poorly extractable — thin, repetitive, contradictory, or structurally incoherent
   - 0–5: Not extractable — boilerplate, placeholder, or content that cannot be summarised
3. List up to 5 specific issues (e.g. "Content fragmented into tabs", "No clear conclusion", "Contradictory claims in paragraphs 2 and 4").

Return ONLY valid JSON. No explanation. No markdown.
Example: {"score": 21, "summary": "Acme Corp provides cloud storage solutions for enterprise teams. Their flagship product supports real-time collaboration and integrates with major productivity suites.", "issues": ["No conclusion paragraph"]}`;
}

// ─── Prompt 4: Entity Detection ───────────────────────────────────────────────

/**
 * Extracts named entities from a page with type, description, and sameAs hints.
 */
export function entityDetectionPrompt(title: string, bodyExcerpt: string): string {
  const excerpt = truncateWithWarning(bodyExcerpt, MAX_BODY_CHARS, `entityDetectionPrompt title="${title}"`);

  return `Extract all named entities from the following web page for AI knowledge graph analysis.

Page title: ${title}

Body text:
${excerpt}

Your task:
1. Extract every named entity: people, organisations, products, services, locations, technologies, events.
2. For each entity provide:
   - name: the canonical name as used on the page
   - type: one of "Person", "Organisation", "Product", "Service", "Location", "Technology", "Event", "Concept"
   - description: 1-sentence description from page context (null if not available)
   - sameAsHints: any URLs or external references on the page that identify this entity (Wikipedia, Wikidata, LinkedIn, etc.)
   - mentionCount: approximate count of times the entity is mentioned
3. Identify the primaryEntity (the main subject of the page).
4. Note missingAttributes: up to 5 key facts about the primary entity that the page does NOT define (e.g. "founding year not stated").

Return ONLY valid JSON. No explanation. No markdown.
Example: {
  "entities": [{"name": "Acme Corp", "type": "Organisation", "description": "Cloud storage company", "sameAsHints": ["https://en.wikipedia.org/wiki/Acme"], "mentionCount": 12}],
  "primaryEntity": "Acme Corp",
  "missingAttributes": ["founding year not stated", "CEO not named"]
}`;
}

// ─── Prompt 5: Groq fast entity extraction ───────────────────────────────────

const GROQ_MAX_BODY_CHARS = 6_000;

/**
 * Prompt for Stage 1 of the hybrid entity pipeline (runs on Groq).
 *
 * Goal: fast candidate detection and content classification.
 * NOT used for scoring, trust, or citation reasoning — those stay with Claude.
 *
 * Output is raw candidate data fed directly into the Claude disambiguation prompt.
 */
export function groqEntityExtractionPrompt(title: string, bodyExcerpt: string): string {
  const excerpt = truncateWithWarning(
    bodyExcerpt,
    GROQ_MAX_BODY_CHARS,
    `groqEntityExtractionPrompt title="${title}"`,
  );

  return `Extract all named entities from this web page and produce a content summary.

Page title: ${title}

Body text:
${excerpt}

Tasks:
1. List every named entity you can identify: people, organisations, products, services, locations, technologies, events, concepts.
   For each provide:
   - name: the canonical name as used on the page
   - type: one of "Person", "Organisation", "Product", "Service", "Location", "Technology", "Event", "Concept"
   - mentionCount: integer count of how many times it appears
2. Write a 1-2 sentence factual summary of what this page is about.
3. List the top 5-8 content keywords (strings).
4. Add 2-4 content category tags (e.g. "B2B SaaS", "Product Page", "Company About", "Blog Post").

If no named entities are present, return an empty entities array.

Return ONLY valid JSON. No explanation. No markdown.
Example: {
  "entities": [
    {"name": "Acme Corp", "type": "Organisation", "mentionCount": 8},
    {"name": "Jane Smith", "type": "Person", "mentionCount": 3}
  ],
  "summary": "Acme Corp provides cloud storage for enterprise teams.",
  "keywords": ["cloud storage", "enterprise", "collaboration"],
  "contentTags": ["B2B SaaS", "Company Homepage"]
}`;
}

// ─── Prompt 6: Claude entity disambiguation ───────────────────────────────────

/**
 * Prompt for Stage 2 of the hybrid entity pipeline (runs on Claude).
 *
 * Receives Groq's raw candidates and performs:
 * - validation (drop false positives)
 * - type correction
 * - description enrichment from page context
 * - sameAs hint extraction
 * - primary entity identification
 * - missing attribute detection
 *
 * entityConfidenceScore is derived ONLY from the entities returned here.
 */
export function claudeEntityDisambiguationPrompt(
  title: string,
  bodyExcerpt: string,
  groqResult: {
    entities: Array<{ name: string; type: string; mentionCount: number }>;
    summary: string;
  },
): string {
  const excerpt = truncateWithWarning(
    bodyExcerpt,
    MAX_BODY_CHARS,
    `claudeEntityDisambiguationPrompt title="${title}"`,
  );

  const candidateList = groqResult.entities
    .map((e, i) => `${i + 1}. ${e.name} (${e.type}, ~${e.mentionCount} mentions)`)
    .join('\n');

  return `Perform entity disambiguation and validation for AI knowledge graph analysis.

A fast extraction pass identified these entity candidates from the page:
${candidateList}

Page summary: ${groqResult.summary}

Now validate each candidate using the full page context.

Page title: ${title}

Body text:
${excerpt}

Your tasks:
1. Validate each candidate — confirm it is a genuine named entity (not a generic noun, common word, or UI string). Drop false positives.
2. Correct the entity type if misclassified.
3. For each validated entity add:
   - description: 1-sentence description drawn from page context (null if absent)
   - sameAsHints: any Wikipedia, Wikidata, LinkedIn, or external reference URLs found in the page text for this entity
   - mentionCount: refined count
4. Identify the primaryEntity (the main subject of the page).
5. List missingAttributes: up to 5 key facts about the primary entity that the page does NOT state (e.g. "founding year not stated", "CEO not named").

Return ONLY valid JSON. No explanation. No markdown.
Example: {
  "entities": [
    {"name": "Acme Corp", "type": "Organisation", "description": "Cloud storage provider for enterprise teams", "sameAsHints": ["https://en.wikipedia.org/wiki/Acme_Corp"], "mentionCount": 12}
  ],
  "primaryEntity": "Acme Corp",
  "missingAttributes": ["founding year not stated", "CEO not named"]
}`;
}

// ─── Prompt 7: Semantic Contradiction Detection ───────────────────────────────

/**
 * Detects semantic contradictions across two page excerpts.
 * Used by semantic trust engine (top 20 pages by PageRank only).
 */
const MAX_CONTRADICTION_CHARS = 3_000;

export function contradictionDetectionPrompt(
  pageA: { url: string; excerpt: string },
  pageB: { url: string; excerpt: string }
): string {
  const excerptA = truncateWithWarning(pageA.excerpt, MAX_CONTRADICTION_CHARS, `contradictionDetectionPrompt pageA url="${pageA.url}"`);
  const excerptB = truncateWithWarning(pageB.excerpt, MAX_CONTRADICTION_CHARS, `contradictionDetectionPrompt pageB url="${pageB.url}"`);

  return `Analyse these two web page excerpts from the same domain for semantic contradictions.

Page A (${pageA.url}):
${excerptA}

Page B (${pageB.url}):
${excerptB}

Your task:
1. Identify any factual contradictions where the two pages make conflicting claims about the same entity, date, location, product feature, or statistic.
2. For each contradiction provide:
   - entityInvolved: the entity or topic where the contradiction occurs
   - claimA: the claim from Page A
   - claimB: the contradicting claim from Page B
   - severity: "critical" (direct factual conflict) | "warning" (ambiguous or probable conflict) | "info" (minor inconsistency)
3. If no contradictions found, return an empty array.

Return ONLY valid JSON. No explanation. No markdown.
Example: {"contradictions": [{"entityInvolved": "founding year", "claimA": "founded in 2010", "claimB": "founded in 2015", "severity": "critical"}]}`;
}

// ─── parseAIResponse<T> ───────────────────────────────────────────────────────

/**
 * Safely parse a raw Claude API text response into a typed value.
 *
 * Handles:
 * - Markdown code fences (```json … ```, ``` … ```)
 * - Leading/trailing whitespace
 * - Single-line and multi-line JSON
 *
 * @throws Error with a descriptive message if the response is not valid JSON.
 */
export function parseAIResponse<T>(raw: string): T {
  const stripped = stripCodeFences(raw.trim());

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error(
      `Claude API returned non-JSON response. First 300 chars: ${raw.slice(0, 300)}`
    );
  }

  return parsed as T;
}

function stripCodeFences(text: string): string {
  // Remove ```json … ``` or ``` … ``` wrappers
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}
