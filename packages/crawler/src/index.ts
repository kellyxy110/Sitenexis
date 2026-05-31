// Queue, heartbeat, and extraction utilities — safe to import in Next.js API routes.
// DomainCrawler is intentionally NOT re-exported here: it requires puppeteer which
// is not available on Vercel serverless. Import from './crawler' directly in the
// BullMQ worker process only.
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
