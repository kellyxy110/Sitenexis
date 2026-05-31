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

  // Self-audit system
  SELF_AUDIT_SECRET: z.string().default('dev-self-audit-secret'),
  VERCEL_DEPLOY_WEBHOOK_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
