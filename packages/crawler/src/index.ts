// Queue, heartbeat, and extraction utilities — safe to import in Next.js API routes.
// DomainCrawler and crawlDomain are re-exported here for the BullMQ worker process.
// In Next.js API routes, importing these will fail on Vercel (puppeteer not available)
// — that import is always wrapped in try/catch which triggers serverless fallback.
export { DomainCrawler, crawlDomain, type CrawlOptions, type CrawlEvents } from './crawler';
export {
  enqueueCrawlJob,
  getCrawlQueueStats,
  redisConnection,
  createRedisClient,
  getRedisConnection,
  HEARTBEAT_KEY,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_STALE_MS,
  type CrawlJobData,
} from './queue';
export { RobotsParser, fetchRobotsTxt, type RobotsRules } from './robots';
export { fetchSitemapUrls } from './sitemap';
export { extractChunks, type PageChunk } from './extractor';
