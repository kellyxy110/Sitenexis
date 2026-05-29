import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const AUDIT_DOMAINS = ['example.com', 'acme.io', 'testsite.dev'] as const;

const SAMPLE_ISSUES = [
  { module: 'seo', type: 'missing_meta_description', severity: 'warning' as const, message: 'Page is missing a meta description.', recommendation: 'Add a unique meta description of 120–160 characters.' },
  { module: 'seo', type: 'title_too_long', severity: 'warning' as const, message: 'Page title exceeds 60 characters.', recommendation: 'Shorten the title to under 60 characters.' },
  { module: 'seo', type: 'missing_alt_text', severity: 'warning' as const, message: '3 images are missing alt text.', recommendation: 'Add descriptive alt attributes to all content images.' },
  { module: 'ai', type: 'low_entity_clarity', severity: 'critical' as const, message: 'Primary entity is not clearly defined in body text.', recommendation: 'Add an explicit entity definition in the first 200 words.' },
  { module: 'ai', type: 'poor_chunk_extractability', severity: 'warning' as const, message: 'Chunks contain dangling cross-references.', recommendation: 'Make each paragraph semantically self-contained.' },
  { module: 'schema', type: 'missing_organization_schema', severity: 'critical' as const, message: 'No Organisation schema detected.', recommendation: 'Add a JSON-LD Organisation schema to the homepage.' },
  { module: 'schema', type: 'missing_review_aggregate', severity: 'info' as const, message: 'Product page lacks AggregateRating schema.', recommendation: 'Add AggregateRating to eligible product pages.' },
  { module: 'links', type: 'orphan_pages', severity: 'warning' as const, message: '5 pages have no inbound internal links.', recommendation: 'Link to these pages from relevant hub pages.' },
  { module: 'performance', type: 'lcp_too_slow', severity: 'critical' as const, message: 'Largest Contentful Paint is 4.2s (threshold: 2.5s).', recommendation: 'Optimise hero image size and enable lazy loading.' },
  { module: 'content', type: 'thin_page', severity: 'warning' as const, message: 'Page has fewer than 300 words.', recommendation: 'Expand content to at least 600 words with substantive detail.' },
] as const;

async function main(): Promise<void> {
  console.log('Seeding database...');

  const user = await prisma.user.upsert({
    where: { email: 'test@sitenexis.com' },
    update: {},
    create: {
      email: 'test@sitenexis.com',
      name: 'Test User',
      plan: 'pro',
    },
  });

  console.log(`Upserted user: ${user.email} (${user.id})`);

  for (const domain of AUDIT_DOMAINS) {
    const audit = await prisma.audit.create({
      data: {
        userId: user.id,
        domain,
        status: 'complete',
        startedAt: new Date(Date.now() - 5 * 60_000),
        completedAt: new Date(),
        pageCount: 42,
        crawlDurationMs: 18_500,
      },
    });

    await prisma.auditScore.create({
      data: {
        auditId: audit.id,
        overall: 71,
        seoScore: 68,
        aiScore: 74,
        schemaScore: 55,
        linkGraphScore: 80,
        performanceScore: 72,
        breakdown: {
          seo: { titleOptimisation: 70, metaOptimisation: 60, headingStructure: 75, canonicalisation: 90, crawlability: 85, imageOptimisation: 55 },
          ai: { entityClarity: 72, conversationalReadiness: 68, aiExtractability: 80, knowledgeGraphStructure: 76 },
          schema: { coverage: 55 },
          linkGraph: { avgPageRank: 0.18 },
          performance: { lcp: 3100, fid: 80, cls: 0.08, ttfb: 420 },
        },
      },
    });

    await prisma.issue.createMany({
      data: SAMPLE_ISSUES.map((issue) => ({
        auditId: audit.id,
        pageUrl: `https://${domain}/`,
        ...issue,
      })),
    });

    console.log(`Seeded audit for ${domain} (${audit.id})`);
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
