import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://placeholder:placeholder@localhost:5432/placeholder'),
  DIRECT_URL: z.string().default('postgresql://placeholder:placeholder@localhost:5432/placeholder'),

  SUPABASE_URL: z.string().default('https://placeholder.supabase.co'),
  SUPABASE_ANON_KEY: z.string().default('placeholder'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('placeholder'),

  NEXT_PUBLIC_SUPABASE_URL: z.string().default('https://placeholder.supabase.co'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default('placeholder'),

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

  // Serper — SERP API for IGE cohort collection
  SERPER_API_KEY: z.string().default(''),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  S3_BUCKET_NAME: z.string().default('sitenexis-reports'),
  S3_ACCESS_KEY_ID: z.string().default('placeholder'),
  S3_SECRET_ACCESS_KEY: z.string().default('placeholder'),
  S3_ENDPOINT: z.string().default('https://placeholder.r2.cloudflarestorage.com'),

  STRIPE_SECRET_KEY: z.string().default('sk_test_placeholder'),
  STRIPE_WEBHOOK_SECRET: z.string().default('whsec_placeholder'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default('pk_test_placeholder'),

  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),

  PROVIDER_WEIGHTS_CONFIG: z.string().optional(),
  TRUST_DECAY_CONFIG: z.string().optional(),
  SYNTHETIC_DETECTION_CONFIG: z.string().optional(),

  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM_EMAIL: z.string().default('SiteNexis <noreply@sitenexis.com>'),

  // Self-audit system — must be explicitly set; no default to avoid predictable secrets in prod
  SELF_AUDIT_SECRET: z.string().min(16).default('dev-self-audit-secret-change-in-prod'),
  VERCEL_DEPLOY_WEBHOOK_SECRET: z.string().min(16).default('dev-vercel-webhook-secret-change-in-prod'),
});

export const env = envSchema.parse(process.env);
