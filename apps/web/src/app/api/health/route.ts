import { NextResponse } from 'next/server';
import { prisma } from '@sitenexis/db';
import net from 'net';

function checkRedis(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const socket = net.createConnection(
        { host: parsed.hostname, port: Number(parsed.port) || 6379 },
        () => { socket.destroy(); resolve(true); }
      );
      socket.setTimeout(2000);
      socket.on('error', () => resolve(false));
      socket.on('timeout', () => { socket.destroy(); resolve(false); });
    } catch {
      resolve(false);
    }
  });
}

export async function GET(): Promise<NextResponse> {
  const checks = {
    db: false,
    redis: false,
    groq: !!process.env['GROQ_API_KEY'],
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch {
    // DB unavailable
  }

  checks.redis = await checkRedis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');

  const allHealthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    { status: allHealthy ? 'ok' : 'degraded', checks },
    { status: allHealthy ? 200 : 503 }
  );
}
