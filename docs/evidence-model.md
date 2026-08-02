# Evidence Projection model

## Purpose

An Evidence Projection is a versioned, read-oriented representation of evidence already observed by SiteNexis. It does not replace Page or Issue. It permits reports to say what was confirmed, inferred, unavailable, or conflicting.

## Proposed contract

```ts
interface EvidenceProjection {
  id: string; auditId: string; pageId?: string | null; issueId?: string | null;
  domain: string; url?: string | null; canonicalUrl?: string | null;
  scope: 'site' | 'page' | 'external' | 'historical'; category: string; subcategory?: string | null;
  ruleId?: string | null; issueCode?: string | null; title: string; description: string;
  severity?: 'critical' | 'warning' | 'info' | null; confidence: number;
  verificationState: VerificationState; sourceLayer: SourceLayer; extractionMethod?: string | null;
  rawValue?: unknown; normalizedValue?: unknown; expectedValue?: unknown;
  evidenceSnippet?: string | null; selector?: string | null; jsonPath?: string | null;
  sourceUrl?: string | null; statusCode?: number | null; responseTime?: number | null;
  detectedAt: string; firstDetectedAt?: string | null; lastConfirmedAt?: string | null; retryCount: number;
  businessImpact?: string | null; visibilityImpact?: string | null; recommendation?: string | null;
  rootCauseId?: string | null; scoreImpacts?: unknown[]; metadata?: Record<string, unknown>;
}
```

## Field origin map

| Fields | Current source | v2 action |
| --- | --- | --- |
| auditId, domain, pageId, URL, canonical, status, response time | Audit and Page | derive |
| title, description, severity, recommendation | Issue | derive |
| raw/normalized values, selector, JSON path | extractor/schema agents | future persistence where absent |
| confidence, render method | Issue and Page | normalize |
| source layer and verification state | partial existing signals | new projection primitive |
| timestamps, retry count | audit/page timestamps | derive initially; persist retry evidence later |
| root cause and score impacts | not universal | future projection/persistence |

## Source layers

| Layer | Strength and limits | Current availability | Future requirement |
| --- | --- | --- | --- |
| RAW_HTML | direct response evidence; may miss JS | fetch adapter | persist field-level provenance |
| RENDERED_DOM | browser-visible evidence; costlier | worker/Crawl4AI | retain alongside raw evidence |
| HTTP_HEADERS | direct transport evidence | crawler/adapters | normalize |
| ROBOTS, SITEMAP | direct resource evidence | crawler | retain attempts |
| STRUCTURED_DATA | parsed JSON-LD/microdata | extractors | add paths and block identity |
| INTERNAL_LINK_GRAPH | derived deterministic evidence | Link Graph | cite graph nodes/edges |
| SCREENSHOT | visual evidence only | limited | store viewport and selector |
| EXTERNAL_SEARCH, EXTERNAL_PROFILE, BUSINESS_DIRECTORY, REVIEW_PLATFORM | sampled or provider evidence | partial/provider-dependent | record source and independence |
| BACKLINK_PROVIDER | authoritative only when connected | unavailable | provider contract |
| SEARCH_CONSOLE, ANALYTICS, PROVIDER_API, USER_CONNECTED_DATA | connected data | Google integration partial | include availability state |
| HISTORICAL_DATABASE | prior observed state | existing audits | compare methodology versions |

## Verification states

| State | Meaning | Allowed language | Score/recommendation treatment |
| --- | --- | --- | --- |
| CONFIRMED | direct reliable evidence | “We confirmed” | eligible for normal impact |
| LIKELY | strong but incomplete evidence | “Evidence suggests” | reduced confidence |
| INFERRED | derived interpretation | “This may indicate” | no standalone hard deduction |
| PARTIAL | some required evidence exists | “Partially assessed” | coverage-limited |
| UNVERIFIED | no sufficient validation | “Could not verify” | no negative assumption |
| CONFLICTING | sources disagree | “Sources disagree” | confidence reduction and diagnostic |
| NOT_DETECTED | absent from examined evidence | “Not detected in sampled evidence” | never state nonexistence |
| NOT_APPLICABLE | not relevant | “Not applicable” | excluded from denominator |
| CRAWL_FAILED | retrieval did not complete | “Could not retrieve” | no absence finding |
| TEMPORARY_FAILURE | timeout/transient error | “Temporarily unavailable” | retry, no score failure |
| RENDERING_REQUIRED | static evidence insufficient | “Rendered validation required” | defer hard claim |
| EXTERNAL_DATA_REQUIRED | claim needs outside evidence | “Requires external data” | partial status |
| PROVIDER_UNAVAILABLE | connected source missing/unavailable | “Provider unavailable” | never convert to zero |
