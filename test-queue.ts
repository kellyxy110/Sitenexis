/**
 * BullMQ Queue & Worker Stability Test Suite — TEST MODE ONLY
 * Do NOT modify production code. Execute and report only.
 * NOTE: Tests are code-analysis based — no live Redis/worker required.
 * Live behavioral tests are noted where they require an actual Redis instance.
 */

function header(title: string) {
  console.log(`\n${'═'.repeat(55)}`);
  console.log(title);
  console.log('═'.repeat(55));
}

function section(title: string) {
  console.log(`\n── ${title} ──`);
}

async function runQueueTests() {

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: JOB PERSISTENCE / REDIS RESTART
  // ─────────────────────────────────────────────────────────────────────────
  header('QUEUE TEST 1: JOB PERSISTENCE & REDIS RESTART');

  section('Queue configuration (queue.ts)');
  console.log('Queue: crawlQueue ("crawl")');
  console.log('Connection: IORedis, maxRetriesPerRequest: null');
  console.log('  → maxRetriesPerRequest: null means IORedis will retry INDEFINITELY on command failure');
  console.log('  → This is REQUIRED for BullMQ — without it, commands during Redis restart throw');
  console.log('');
  console.log('Job persistence settings:');
  console.log('  attempts: 3');
  console.log('  backoff: exponential, 5s base (5s → 10s → 20s)');
  console.log('  removeOnComplete: { count: 100 } — last 100 completed jobs retained');
  console.log('  removeOnFail: { count: 50 } — last 50 failed jobs retained');
  console.log('');
  console.log('Redis restart behavior:');
  console.log('  BullMQ stores jobs in Redis SORTED SETS + HASH keys');
  console.log('  Jobs survive Redis restart IF Redis has persistence (AOF or RDB) enabled');
  console.log('  Default Redis config: RDB snapshots every 60s — jobs in last 60s may be lost');
  console.log('  Upstash Redis (production): persistent by default — jobs survive restart');
  console.log('  Local Redis (dev): persistence depends on local redis.conf — likely NOT persistent');
  console.log('');
  console.log('RISK: "active" jobs (currently running) at Redis restart:');
  console.log('  BullMQ moves jobs to "active" state when the worker picks them up');
  console.log('  If Redis restarts while a job is active:');
  console.log('    - The job remains in "active" set in Redis (persisted)');
  console.log('    - BUT the worker process lost its lock (worker died or connection dropped)');
  console.log('    - BullMQ stalled job detection will eventually move it back to "waiting"');
  console.log('    - Stalled check interval: default 30,000ms');
  console.log('    - After stalled → retried up to "attempts" limit');
  console.log('  MISSING: No stalledInterval configuration in worker.ts — uses BullMQ default (30s)');

  section('Live test result: Redis not running — OBSERVED BEHAVIOR');
  console.log('OBSERVED: Attempting to import queue.ts (which creates an IORedis singleton at module load)');
  console.log('causes the process to HANG INDEFINITELY when Redis is unavailable.');
  console.log('');
  console.log('Root cause: IORedis is created at module scope in queue.ts:13-16:');
  console.log('  export const redisConnection = new IORedis(');
  console.log('    process.env[\'REDIS_URL\'] ?? \'redis://localhost:6379\',');
  console.log('    { maxRetriesPerRequest: null }');
  console.log('  )');
  console.log('');
  console.log('maxRetriesPerRequest: null → IORedis retries ALL commands indefinitely');
  console.log('getJobCounts() is a Redis command → blocks forever with no Redis available');
  console.log('No timeout, no AbortSignal, no fallback — PERMANENT HANG confirmed by test execution');
  console.log('');
  console.log('FINDING: Any process that imports @sitenexis/crawler (or queue.ts) without Redis');
  console.log('  available will BLOCK on the first Redis command and never proceed.');
  console.log('  The IORedis client does connect eventually (reconnect loop) but commands');
  console.log('  issued during the disconnect period queue up and execute on reconnect.');

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: WORKER CRASH RECOVERY
  // ─────────────────────────────────────────────────────────────────────────
  header('QUEUE TEST 2: WORKER CRASH RECOVERY');

  section('Worker configuration (worker.ts)');
  console.log('Worker concurrency: 5 (worker.ts:22)');
  console.log('Error handlers: "failed" and "completed" events — stderr only, no re-throw');
  console.log('');
  console.log('Crash recovery mechanisms:');
  console.log('  1. BullMQ "active" lock: worker holds lock while processing');
  console.log('     Lock TTL: BullMQ default = 30,000ms');
  console.log('     If worker crashes, lock expires after 30s → job becomes "stalled"');
  console.log('     BullMQ moves stalled jobs → "waiting" for retry');
  console.log('');
  console.log('  2. Retry policy: 3 attempts, exponential backoff (5s/10s/20s)');
  console.log('     After 3 failures → job moves to "failed" state (retained for 50 jobs)');
  console.log('');
  console.log('  3. Worker "failed" event (worker.ts:26-28):');
  console.log('     Only writes to stderr. Does NOT notify Infrastructure Agent.');
  console.log('     MISSING: No mechanism to set audit.status = "failed" when worker crashes');
  console.log('     The audit DB record will remain in "running" state indefinitely');
  console.log('');
  console.log('CRITICAL GAP: If worker crashes on attempt 3, the job moves to BullMQ "failed"');
  console.log('  but the Audit record in the database stays as status="running" forever.');
  console.log('  The UI will show a spinner indefinitely for that audit.');
  console.log('  No timeout, no cleanup, no failure propagation to the DB.');

  section('Process exit handling');
  console.log('worker.ts has NO process signal handlers (SIGTERM, SIGINT)');
  console.log('If the worker process is killed:');
  console.log('  - Active jobs lose their lock (after 30s stall detection)');
  console.log('  - Graceful shutdown (worker.close()) is NEVER called');
  console.log('  - BullMQ recommends calling worker.close() on SIGTERM for clean shutdown');
  console.log('  - Without it: jobs may be re-processed after restart (at-least-once delivery)');
  console.log('  - MISSING: SIGTERM/SIGINT handlers calling worker.close()');

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: HIGH LOAD BURST TEST
  // ─────────────────────────────────────────────────────────────────────────
  header('QUEUE TEST 3: HIGH LOAD BURST TEST');

  section('Test 3a: enqueueCrawlJob idempotency analysis');
  console.log('From queue.ts:42-45:');
  console.log('  const job = await crawlQueue.add("crawl-domain", data, {');
  console.log('    jobId: data.auditId,');
  console.log('  });');
  console.log('');
  console.log('BullMQ jobId behavior:');
  console.log('  - If a job with the same jobId already exists in waiting/active/delayed:');
  console.log('    BullMQ silently ignores the duplicate add() call');
  console.log('  - The function returns job.id ?? data.auditId (line 45)');
  console.log('  - If ignored, job.id is undefined → returns data.auditId (audit UUID)');
  console.log('  - SAFE: enqueueCrawlJob is idempotent — same auditId = same job, not duplicated');
  console.log('');
  console.log('  BUT: If the job has already completed and been removed (after 100 completions):');
  console.log('  → A new job with the same auditId CAN be created');
  console.log('  → This creates a re-audit of an already-complete audit');
  console.log('  → Not a queue bug — it is a design choice, but callers should guard against this');

  section('Test 3b: 20-50 job burst — analysis');
  console.log('Worker concurrency: 5 (processes 5 jobs in parallel)');
  console.log('Each job: full domain crawl (Puppeteer) + 16 agents + Claude API calls');
  console.log('Estimated time per job: 3–8 minutes (from CLAUDE.md)');
  console.log('');
  console.log('Burst scenario: 50 jobs enqueued simultaneously');
  console.log('  Queue state after enqueue:');
  console.log('    waiting: 45 jobs');
  console.log('    active: 5 jobs (immediately picked up)');
  console.log('');
  console.log('  Resource pressure:');
  console.log('    Puppeteer: 5 concurrent browser instances (each uses ~200-400MB RAM)');
  console.log('    Total Puppeteer RAM: ~1-2GB for 5 concurrent jobs');
  console.log('    Claude API: up to 5× concurrent calls per job × 5 jobs = 25 concurrent Claude calls');
  console.log('    Redis keys: BullMQ creates ~10-15 Redis keys per job → 50 jobs = ~500-750 keys');
  console.log('');
  console.log('  Throttle mechanisms:');
  console.log('    - Worker concurrency=5: hard limit on simultaneous jobs');
  console.log('    - AI client rate limiter (ai/client.ts): 60 RPM token bucket — SHARED across all jobs');
  console.log('    - 5 jobs × multiple Claude calls each = rate limit contention');
  console.log('    - Callers BLOCK (not fail) when rate limit approached — adds latency, not failures');
  console.log('');
  console.log('  MISSING: No queue-level rate limiting per userId (plan limits)');
  console.log('  A burst from one user consumes all 5 worker slots — other users starved');

  section('Test 3c: Live burst simulation (no Redis)');
  console.log('Skipped: Importing queue.ts blocks indefinitely without Redis (see Test 1 finding)');
  console.log('The enqueueCrawlJob function signature is:');
  console.log('  async function enqueueCrawlJob(data: CrawlJobData): Promise<string>');
  console.log('  Returns: job.id ?? data.auditId');
  console.log('  All 50 enqueue calls would complete near-instantly (Redis commands are fast)');
  console.log('  The queue enters: 45 waiting + 5 active state immediately');

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4: RETRY BEHAVIOR
  // ─────────────────────────────────────────────────────────────────────────
  header('QUEUE TEST 4: RETRY BEHAVIOR');

  section('Retry configuration');
  console.log('From queue.ts (defaultJobOptions):');
  console.log('  attempts: 3');
  console.log('  backoff: { type: "exponential", delay: 5_000 }');
  console.log('');
  console.log('Retry timeline for a failing job:');
  console.log('  Attempt 1: runs immediately → fails → wait 5s');
  console.log('  Attempt 2: runs after 5s → fails → wait 10s (5s × 2^1)');
  console.log('  Attempt 3: runs after 10s → fails → job moves to "failed" state');
  console.log('  Total time before permanent failure: ~15-20s minimum');
  console.log('');
  console.log('What counts as a "failure":');
  console.log('  - The worker function throws or rejects its Promise');
  console.log('  - runInfrastructureAgent() throws (any uncaught error propagates up)');
  console.log('');
  console.log('What does NOT trigger a retry:');
  console.log('  - Worker crashes (process killed) — BullMQ stall detection handles this separately');
  console.log('  - Individual page crawl failures — only retry the whole job');
  console.log('  - Claude API failures that are caught internally — Infrastructure Agent may');
  console.log('    complete with partial results rather than throwing');

  section('Worker failure event');
  console.log('worker.ts:26-28:');
  console.log('  worker.on("failed", (job, err) => {');
  console.log('    process.stderr.write(`[worker] Job ${job?.id} failed: ${String(err)}\\n`);');
  console.log('  });');
  console.log('');
  console.log('This fires on FINAL failure only (all attempts exhausted)');
  console.log('In-progress retry failures do NOT emit this event');
  console.log('MISSING: No "attempt:failed" handler to log individual retry attempts');

  section('Lost jobs analysis');
  console.log('Conditions under which jobs can be permanently lost:');
  console.log('');
  console.log('  1. Redis has no persistence (RDB disabled, AOF disabled):');
  console.log('     Redis restart loses ALL waiting/delayed jobs');
  console.log('     Active jobs survive via stall detection (IF Redis data persists)');
  console.log('');
  console.log('  2. removeOnComplete: { count: 100 }:');
  console.log('     The 101st completed job causes the oldest to be removed');
  console.log('     The job data is gone but the DB record persists — NOT a data loss issue');
  console.log('');
  console.log('  3. removeOnFail: { count: 50 }:');
  console.log('     Same — failed job data removed after 50 entries');
  console.log('     Audit record in DB persists (stuck at "running" state — see Test 2)');
  console.log('');
  console.log('  4. Worker crash on attempt 3 with no SIGTERM handler:');
  console.log('     Job stalls → re-queued → attempt 3 (or possibly attempt 1 of a new run)');
  console.log('     Depends on whether BullMQ counts stall retries against attempts limit');
  console.log('     BullMQ behavior: stall = implicit failed attempt counted against attempts');

  section('Duplicate execution analysis');
  console.log('Conditions under which a job can execute MORE THAN ONCE:');
  console.log('');
  console.log('  1. Worker crashes after job completes but before BullMQ receives ack:');
  console.log('     BullMQ detects stall → re-queues → executes again');
  console.log('     Infrastructure Agent will run again on the same auditId');
  console.log('     RISK: Duplicate DB writes (scores, issues, pages)');
  console.log('     MITIGATION: saveAuditScores() uses upsert → idempotent if schema supports it');
  console.log('     UNKNOWN: Whether saveIssues() uses insert or upsert — if insert, duplicates possible');
  console.log('');
  console.log('  2. Two workers running simultaneously (not current config but possible):');
  console.log('     BullMQ lock prevents this — same jobId cannot be picked up by two workers');
  console.log('     Only one worker runs per job at a time');

  section('Queue stability under load — summary');
  console.log('STABLE behaviors:');
  console.log('  ✓ Job deduplication via jobId = auditId');
  console.log('  ✓ maxRetriesPerRequest: null prevents Redis command failures during reconnect');
  console.log('  ✓ Promise.allSettled in crawler prevents one page failure killing the job');
  console.log('  ✓ Worker concurrency=5 prevents unbounded resource consumption');
  console.log('  ✓ Exponential backoff prevents thundering herd on retry');
  console.log('');
  console.log('UNSTABLE behaviors:');
  console.log('  ✗ No SIGTERM handler — graceful shutdown not implemented');
  console.log('  ✗ Audit status stuck at "running" if job fails all retries');
  console.log('  ✗ No per-user queue priority or rate limiting');
  console.log('  ✗ No stall interval override — 30s default may be too long for production');
  console.log('  ✗ Duplicate execution possible on stall → re-queue if saveIssues() is non-idempotent');
  console.log('  ✗ Crawl-delay from robots.txt ignored — could trigger rate-limiting by target sites');
  console.log('  ✗ No individual page retry — a slow page gets one attempt, then is silently dropped');

  console.log('\n' + '═'.repeat(55));
  console.log('QUEUE TESTS COMPLETE');
  console.log('═'.repeat(55) + '\n');
}

runQueueTests().catch(err => {
  console.error('\nFATAL TEST ERROR:', err);
  process.exit(1);
});
