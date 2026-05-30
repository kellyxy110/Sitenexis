import { readFileSync } from 'fs';
import { join } from 'path';
import { spawn, type ChildProcess } from 'child_process';

try {
  const raw = readFileSync(join(__dirname, '../.env'), 'utf-8');
  for (const line of raw.split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)="?([^"]*)"?/.exec(line.trim());
    if (m?.[1] && !process.env[m[1]]) process.env[m[1]] = m[2] ?? '';
  }
} catch { /* .env is optional in production */ }

import {
  createRedisClient,
  HEARTBEAT_KEY,
  HEARTBEAT_STALE_MS,
} from './queue';
import type IORedis from 'ioredis';

// ── Logging ───────────────────────────────────────────────────────────────────

function log(msg: string): void {
  process.stderr.write(`${new Date().toISOString()} [watchdog] ${msg}\n`);
}

// ── Config ────────────────────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 30_000;   // heartbeat check every 30 s
const STARTUP_GRACE_MS  = 30_000;   // wait 30 s before first heartbeat check
const HEALTHY_UPTIME_MS = 5 * 60_000; // 5 min uptime = reset backoff
const MAX_RESTARTS      = 20;
const BASE_BACKOFF_MS   = 1_000;
const MAX_BACKOFF_MS    = 60_000;

// ── Worker process ────────────────────────────────────────────────────────────

// Detect whether we're running as .ts (tsx) or compiled .js (node).
const isTs      = __filename.endsWith('.ts');
const workerBin = isTs ? 'tsx' : process.execPath;
const workerScript = join(__dirname, isTs ? 'worker.ts' : 'worker.js');

let workerProc:     ChildProcess | null = null;
let monitorTimer:   ReturnType<typeof setInterval>  | null = null;
let redis:          IORedis | null = null;
let restartCount    = 0;
let workerStartedAt = 0;
let stopping        = false;

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
      env: { ...process.env },
    });

    workerProc.on('exit', (code, signal) => {
      workerProc = null;
      if (stopping) return;

      const desc = signal ? `signal:${signal}` : `code:${code}`;
      log(`Worker exited (${desc})`);

      // Reset backoff if the worker was healthy for a while
      if (Date.now() - workerStartedAt > HEALTHY_UPTIME_MS) {
        log('Worker had healthy uptime — resetting restart backoff');
        restartCount = 0;
      }

      restartCount++;
      log(`Worker restarted (#${restartCount})`);
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
      log(`Heartbeat stale (${Math.round(age / 1000)}s) — killing and restarting worker`);
      if (workerProc) {
        workerProc.kill('SIGTERM');
        // exit event fires → spawnWorker() called from exit handler
      } else {
        restartCount++;
        spawnWorker();
      }
    }
  } catch (err) {
    log(`Heartbeat check error: ${String(err)}`);
  }
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

function cleanup(): void {
  stopping = true;
  if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null; }
  if (workerProc)   { try { workerProc.kill('SIGTERM'); } catch { /* ok */ } workerProc = null; }
  try { redis?.disconnect(); } catch { /* best effort */ }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log('Watchdog starting');

  redis = createRedisClient();
  redis.on('connect', () => log('Watchdog connected to Redis'));
  redis.on('error',   (err: Error) => log(`Watchdog Redis error: ${err.message}`));

  spawnWorker();

  // Grace period — give the worker time to start and write its first heartbeat
  setTimeout(() => {
    log('Starting heartbeat monitor');
    monitorTimer = setInterval(() => void checkHeartbeat(), CHECK_INTERVAL_MS);
  }, STARTUP_GRACE_MS);
}

// ── Signals ───────────────────────────────────────────────────────────────────

process.on('SIGTERM', () => { log('SIGTERM — shutting down'); cleanup(); process.exit(0); });
process.on('SIGINT',  () => { log('SIGINT — shutting down');  cleanup(); process.exit(0); });

process.on('uncaughtException',  (err: Error) => { log(`Uncaught: ${err.message}`); cleanup(); process.exit(1); });
process.on('unhandledRejection', (r: unknown) => { log(`Unhandled: ${String(r)}`); cleanup(); process.exit(1); });

void main();
