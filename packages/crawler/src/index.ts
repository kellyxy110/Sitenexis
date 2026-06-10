// Queue, heartbeat, and extraction utilities — safe to import in Next.js API routes.
// DomainCrawler and crawlDomain are NOT re-exported here because crawler.ts imports
// puppeteer at the module level, which is unavailable on Vercel serverless.
// The worker process imports from './crawler' directly.
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
