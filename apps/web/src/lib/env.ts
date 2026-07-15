import { z } from 'zod';

const isProd = process.env['NODE_ENV'] === 'production';

// In production: require a real value. In dev/test: fall back to a placeholder
// so local development works without all secrets configured.
const prodRequired = (placeholder: string) =>
  isProd ? z.string().min(1, `Required in production`) : z.string().default(placeholder);

// Secrets that must never have a guessable default in any environment.
// In prod: required. In dev: still warn-level but allow a local fallback.
const secret = (minLen = 16) =>
  isProd
    ? z.string().min(minLen, `Must be at least ${minLen} characters in production`)
    : z.string().min(minLen).default('dev-secret-change-before-deploying-to-production');

const envSchema = z.object({
  DATABASE_URL: prodRequired('postgresql://placeholder:placeholder@localhost:5432/placeholder'),
  DIRECT_URL: prodRequired('postgresql://placeholder:placeholder@localhost:5432/placeholder'),

  SUPABASE_URL: prodRequired('https://placeholder.supabase.co'),
  SUPABASE_ANON_KEY: prodRequired('placeholder'),
  SUPABASE_SERVICE_ROLE_KEY: prodRequired('placeholder'),

  NEXT_PUBLIC_SUPABASE_URL: prodRequired('https://placeholder.supabase.co'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: prodRequired('placeholder'),

  GROQ_API_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().optional(),

  // OpenRouter — multi-model AI engine (free tier)
  // Fallback key used when a model-specific key is not set
  OPENROUTER_API_KEY: z.string().default(''),
  // Per-model keys — override OPENROUTER_API_KEY for rate-limit isolation
  OPENROUTER_HERMES_KEY: z.string().optional(),    // Hermes 3 405B — structured scoring
  OPENROUTER_DEEPSEEK_KEY: z.string().optional(),  // DeepSeek V4 Flash — whole-site analysis
  OPENROUTER_GEMMA_KEY: z.string().optional(),     // Gemma 4 31B — visual/multimodal
  OPENROUTER_QWEN_KEY: z.string().optional(),      // Qwen3-Next 80B — RAG simulation
  OPENROUTER_KIMI_KEY: z.string().optional(),      // Kimi K2.6 — code/schema generation
  OPENROUTER_LLAMA_KEY: z.string().optional(),     // Llama 3.3 70B — multilingual

  // Bynara Router — OpenAI-compatible provider (https://router.bynara.id/v1)
  BYNARA_API_KEY: z.string().default(''),
  BYNARA_BASE_URL: z.string().default('https://router.bynara.id/v1'),

  // Agnes — OpenAI-compatible reasoning provider for the per-audit "SiteNexis
  // Intelligence" assistant ONLY. Server-side only; never exposed to the client.
  // Reasoning/explanations/recommendations only — never used to compute scores.
  AGNES_API_KEY: z.string().default(''),
  AGNES_BASE_URL: z.string().default('https://apihub.agnes-ai.com/v1'),
  AGNES_MODEL: z.string().default('agnes-2.0-flash'),

  // Serper — SERP API for IGE cohort collection
  SERPER_API_KEY: z.string().default(''),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  S3_BUCKET_NAME: z.string().default('sitenexis-reports'),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  S3_ENDPOINT: z.string().default(''),

  STRIPE_SECRET_KEY: prodRequired('sk_test_placeholder'),
  STRIPE_WEBHOOK_SECRET: prodRequired('whsec_placeholder'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default('pk_test_placeholder'),

  // Stripe price IDs — map each plan to its Stripe price ID from the dashboard
  STRIPE_PRICE_STARTER: z.string().default(''),
  STRIPE_PRICE_PRO: z.string().default(''),
  STRIPE_PRICE_AGENCY: z.string().default(''),
  STRIPE_PRICE_ENTERPRISE: z.string().default(''),

  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),

  PROVIDER_WEIGHTS_CONFIG: z.string().optional(),
  TRUST_DECAY_CONFIG: z.string().optional(),
  SYNTHETIC_DETECTION_CONFIG: z.string().optional(),

  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM_EMAIL: z.string().default('SiteNexis <noreply@sitenexis.com>'),

  // Crawl4AI — Python extraction microservice (primary web extraction provider when set)
  CRAWL4AI_URL: z.string().default(''),

  // Scrapy — Python competitive intelligence microservice (competitive analysis when set)
  SCRAPY_SERVICE_URL: z.string().default(''),

  // Self-audit + deploy webhook — must be strong random secrets in production
  SELF_AUDIT_SECRET: secret(16),
  VERCEL_DEPLOY_WEBHOOK_SECRET: secret(16),

  // Ops-tunable: max unauthenticated quick-audit requests per IP per hour.
  // Defaults to 20; raise on staging so the launch validation suite can sweep the
  // full diversity benchmark without self-limiting.
  QUICK_AUDIT_RATE_LIMIT: z.coerce.number().int().positive().default(20),
});

export const env = envSchema.parse(process.env);
