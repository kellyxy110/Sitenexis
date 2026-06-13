import path from 'path';
import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://*.r2.cloudflarestorage.com",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://openrouter.ai",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../../'),

  outputFileTracingIncludes: {
    '**': [
      'packages/db/generated/**',
      '../../packages/db/generated/**',
    ],
  },

  transpilePackages: ['@sitenexis/shared'],
  serverExternalPackages: [
    '@prisma/client', 'pino', 'pino-pretty',
    '@sitenexis/db', '@sitenexis/crawler', '@sitenexis/agents', '@sitenexis/analyzers',
    '@react-pdf/renderer', '@aws-sdk/client-s3', 'puppeteer', 'bullmq', 'ioredis',
    'lighthouse', 'puppeteer-core', '@aws-sdk/client-s3-multipart-upload',
  ],

  webpack(config, { isServer }) {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]),
        '@react-pdf/renderer', '@aws-sdk/client-s3', '@aws-sdk/client-s3-multipart-upload',
        'puppeteer', 'puppeteer-core', 'bullmq', 'ioredis', 'lighthouse',
      ];
    }
    // Tell webpack fs/path are Node built-ins — suppress "module not found" warnings
    // from instrumentation.ts which runs server-only but is compiled for all runtimes.
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...((config.resolve as { fallback?: Record<string, boolean> }).fallback ?? {}),
        fs: false,
        path: false,
      },
    };
    return config;
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
  },

  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
