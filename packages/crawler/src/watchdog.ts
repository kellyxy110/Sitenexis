// ── Env bootstrap ─────────────────────────────────────────────────────────────
import { readFileSync } from 'fs';
import { join }         from 'path';
import { spawn, type ChildProcess } from 'child_process';

try {
  const raw = readFileSync(join(__dirname, '../.env'), 'utf-8');
  for (const line of raw.split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)="?([^"]*)"?/.exec(line.trim());
    if (m?.[1] && !process.env[m[1]]) process.env[m[1]] = m[2] ?? '';
  }
} catch { /* .env is optional in production */ }

import {
  validateRedisUrl,
  maskUrl,
  getRedisUrl,
  createRedisClient,
  HEARTBEAT_KEY,
  HEARTBEAT_STALE_MS,
} from './queue';
import type IORedis from 'ioredis';

// ── Startup validation ────────────────────────────────────────────────────────
validateRedisUrl();

// ── Logging ───────────────────────────────────────────────────────────────────

function log(msg: string): void {
  process.stderr.write(`${new Date().toISOString()} [watchdog] ${msg}\n`);
}

// ── Config ────────────────────────────────────────────────────────────────────

const CHECK_INTERVAL_MS  = 30_000;        // heartbeat check every 30 s
const STARTUP_GRACE_MS   = 30_000;        // wait before first check (worker startup)
const HEALTHY_UPTIME_MS  = 5 * 60_000;   // 5 min healthy = reset backoff counter
const MAX_RESTARTS       = 20;
const BASE_BACKOFF_MS    = 1_000;
const MAX_BACKOFF_MS     = 60_000;

// ── Worker process management ─────────────────────────────────────────────────

// Detect runtime: tsx (dev) vs compiled Node (production).
const isTs       = __filename.endsWith('.ts');
const workerBin  = isTs ? 'tsx' : process.execPath;
const workerScript = join(__dirname, isTs ? 'worker.ts' : 'worker.js');

let workerProc:     ChildProcess | null = null;
let monitorTimer:   ReturnType<typeof setInterval> | null = null;
let redis:          IORedis | null = null;
let restartCount    = 0;
let workerStartedAt = 0;
let stopping        = false;
let lastRedisErrLog = 0;

function backoffMs(): number {
  if (restartCount === 0) return 0;
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, restartCount - 1), MAX_BACKOFF_MS);
}

function spawnWorker(): void {
  if (stopping) return;

  if (restartCount >= MAX_RESTARTS) {
    log(`Max restarts (${MAX_RESTARTS}) reached — watchdog stopping`);
    cleanup();
    process.exit(1);
  }

  const delay = backoffMs();
  if (delay > 0) log(`Backing off ${delay}ms before next spawn`);

  setTimeout(() => {
    if (stopping) return;

    workerStartedAt = Date.now();
    log(`Spawning worker (restart #${restartCount}) — ${workerBin} ${workerScript}`);

    workerProc = spawn(workerBin, [workerScript], {
      stdio: 'inherit',
      env: { ...process.env },   // inherit all env vars including REDIS_URL
    });

    workerProc.on('exit', (code, signal) => {
      workerProc = null;
      if (stopping) return;

      const desc = signal ? `signal:${signal}` : `code:${code}`;
      log(`Worker exited (${desc})`);

      if (Date.now() - workerStartedAt > HEALTHY_UPTIME_MS) {
        log('Worker had healthy uptime — resetting restart backoff');
        restartCount = 0;
      }

      restartCount++;
      spawnWorker();
    });

    workerProc.on('error', (err: Error) => {
      log(`Worker spawn error: ${err.message}`);
    });
  }, delay);
}

// ── Heartbeat monitoring ──────────────────────────────────────────────────────

async function checkHeartbeat(): Promise<void> {
  if (!redis || stopping) return;

  try {
    const raw = await redis.get(HEARTBEAT_KEY);

    if (raw === null) {
      log('Heartbeat key absent — worker may still be starting');
      return;
    }

    const age = Date.now() - parseInt(raw, 10);
    if (age > HEARTBEAT_STALE_MS) {
      log(`Heartbeat stale (${Math.round(age / 1000)}s old) — killing worker`);
      if (workerProc) {
        workerProc.kill('SIGTERM');
        // exit handler fires → spawnWorker() called automatically
      } else {
        restartCount++;
        spawnWorker();
      }
    }
  } catch (err) {
    // Don't flood logs on transient Redis errors during heartbeat checks.
    const now = Date.now();
    if (now - lastRedisErrLog > 30_000) {
      log(`Heartbeat check error: ${String(err)}`);
      lastRedisErrLog = now;
    }
  }
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

function cleanup(): void {
  stopping = true;
  if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null; }
  if (workerProc)   { try { workerProc.kill('SIGTERM'); } catch { /* ok */ } workerProc = null; }
  if (redis)        { try { redis.disconnect();         } catch { /* ok */ } redis = null; }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log('Watchdog starting');
  log(`Redis: ${maskUrl(getRedisUrl())}`);
  log(`TLS: ${getRedisUrl().startsWith('rediss://') ? 'enabled' : 'disabled'}`);

  redis = createRedisClient(false);

  redis.on('connect',     () => log('Watchdog Redis connected'));
  redis.on('ready',       () => log('Watchdog Redis ready'));
  redis.on('reconnecting',() => log('Watchdog Redis reconnecting…'));
  redis.on('close',       () => log('Watchdog Redis connection closed'));

  // Rate-limit error events — every reconnection attempt fires 'error'.
  // Without rate-limiting this fills the Railway log with noise.
  redis.on('error', (err: Error) => {
    const now = Date.now();
    if (now - lastRedisErrLog > 30_000) {
      log(`Watchdog Redis error: ${err.message}`);
      lastRedisErrLog = now;
    }
  });

  spawnWorker();

  // Grace period: give the worker time to start and write its first heartbeat.
  setTimeout(() => {
    log('Starting heartbeat monitor');
    monitorTimer = setInterval(() => void checkHeartbeat(), CHECK_INTERVAL_MS);
  }, STARTUP_GRACE_MS);
}

// ── Signals ───────────────────────────────────────────────────────────────────

process.on('SIGTERM', () => { log('SIGTERM — shutting down'); cleanup(); process.exit(0); });
process.on('SIGINT',  () => { log('SIGINT — shutting down');  cleanup(); process.exit(0); });
process.on('uncaughtException',  (err: Error) => { log(`Uncaught: ${err.message}`); cleanup(); process.exit(1); });
process.on('unhandledRejection', (r: unknown) => { log(`Unhandled: ${String(r)}`);  cleanup(); process.exit(1); });

void main();
