# Scoring methodology v2

## Status: Approved v2 methodology baseline

This document defines the fixed universal base methodology for `sitenexis-intelligence-v2`. It does not change V1 scoring and it does not implement industry-specific profiles or an overall V2 score.

## Base category weights

| Category | Weight |
| --- | ---: |
| Web Health and Crawlability | 5 |
| Crawl Stability | 3 |
| Sitemap and Index Hygiene | 3 |
| Technical SEO | 6 |
| On-Page SEO | 5 |
| Content Depth and Information Gain | 6 |
| Passage Quality and Readability | 3 |
| Structured Data and Schema | 5 |
| AI Retrievability | 6 |
| AI Answer Readiness | 5 |
| AI Recommendation Readiness | 6 |
| Entity Detection | 2 |
| Entity Consistency | 5 |
| Entity Authenticity | 5 |
| Citation Readiness | 4 |
| Citation Authority | 5 |
| E-E-A-T | 5 |
| Machine Trust | 5 |
| Local and Geographic Visibility | 3 |
| Social and Off-Site Amplification | 1 |
| Brand Consistency | 2 |
| Topical Authority | 3 |
| Temporal Authority | 1 |
| Visual Integrity | 1 |
| Security and AI Governance | 5 |
| **Total** | **100** |

## Calculation policy

A numeric category score starts from a baseline of 50 only after either two independent eligible signals, or one eligible High/Critical category-defining signal, exists. Empty categories are `INSUFFICIENT_EVIDENCE`; unavailable-only categories are `UNAVAILABLE`; neither receives a placeholder score.

Signal magnitudes are Minor 2, Low 4, Moderate 7, High 10, and Critical 15. Verification factors are Confirmed 1.00, Likely .75, Partial .50, Inferred .40, and zero for Unverified, Not Detected, Crawl Failed, Temporary Failure, Rendering Required, External Data Required, and Provider Unavailable. Confidence remains separate from the numeric score.

Coverage with a valid denominator is: >=80% Calculated; 60–79% Calculated with confidence capped at Moderate; 40–59% Partial; 20–39% Partial with confidence capped at Low; below 20% Insufficient Evidence. Unknown denominators are not fabricated.

Grades are Excellent 90–100, Strong 80–89, Good 70–79, Fair 60–69, Weak 50–59, Poor 35–49, and Critical 0–34. Overall V2 aggregation is explicitly deferred.