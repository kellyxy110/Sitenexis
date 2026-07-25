# Machine Resource Studio

Machine Resource Studio, or MRS, is the explanation layer for SiteNexis audit data.

MRS turns stored crawl records into score cards, explanations, issue distribution, ranked recommendations, confidence values, and evidence provenance.

MRS is not a second scoring engine. It reads stored audit scores and stored findings. It does not claim access to private search or AI provider systems.

## Data flow

```text
Audit
  -> crawled pages
  -> stored scores
  -> stored AI visibility score
  -> stored issues
  -> MRS report engine
  -> API response
  -> dashboard
```

The report engine is deterministic for the same input records, except for the report generation timestamp.

## API

```text
GET /api/audit/[id]/machine-resources
```

The route requires an authenticated user. It checks that the audit belongs to the user before it reads data.

The response uses the SiteNexis Graceful Truth Layer. The response can be complete, partial, or empty.

## Score cards

MRS can show these scores when the audit stores them:

- Overall health
- Google readiness
- AI visibility
- Structured data
- Authority flow
- Performance
- Citation readiness
- Retrieval readiness
- Machine trust

Each score card includes the score value, formula, evidence count, and confidence value.

MRS uses the stored audit overall score when it exists. If it does not exist, MRS computes an average from available score cards. It does not use zero for missing scores.

## Evidence provenance

Evidence records use these source types:

- `crawl`: a stored crawled page;
- `issue`: a stored audit issue;
- `score`: a stored score record;
- `ai-visibility`: a stored AI visibility record.

Each evidence record contains a source ID, module, detail, timestamp, and confidence.

## Recommendations

MRS creates recommendations from stored issues. It sorts issues by severity:

- `P0`: critical issue;
- `P1`: warning issue;
- `P2`: informational issue.

Each recommendation contains source issue IDs, module, explanation, implementation guide, business impact, SEO impact, AI impact, difficulty, estimated time, and confidence.

The engine does not create a recommendation when no issue evidence exists.

## Limitations

MRS reports limits when:

- the audit has no crawled pages;
- the audit has no issue records;
- the AI visibility record is unavailable;
- the audit is not complete.

These limits are visible in the API response and dashboard.

## Dashboard

The dashboard route is:

```text
/dashboard/machine-resources
```

The dashboard includes an executive summary, technical and AI explanations, expandable score cards, issue distribution bars, expandable recommendations, an evidence viewer, confidence values, data limits, and strength messages.

## Tests

The deterministic engine has tests for no evidence, unavailable scores, issue-linked recommendations, and evidence provenance.

Run the tests with:

```bash
pnpm --filter @sitenexis/analyzers test -- machine-resource-studio/engine.test.ts
```
