import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://placeholder:placeholder@localhost:5432/placeholder'),
  DIRECT_URL: z.string().default('postgresql://placeholder:placeholder@localhost:5432/placeholder'),

  SUPABASE_URL: z.string().default('https://placeholder.supabase.co'),
  SUPABASE_ANON_KEY: z.string().default('placeholder'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('placeholder'),

  NEXT_PUBLIC_SUPABASE_URL: z.string().default('https://placeholder.supabase.co'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default('placeholder'),

  ANTHROPIC_API_KEY: z.string().default(''),
  GROQ_API_KEY: z.string().default(''),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  STRIPE_SECRET_KEY: z.string().default('sk_test_placeholder'),
  STRIPE_WEBHOOK_SECRET: z.string().default('whsec_placeholder'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default('pk_test_placeholder'),

  STRIPE_PRICE_PRO:    z.string().default(''),
  STRIPE_PRICE_AGENCY: z.string().default(''),

  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3001'),
});

export const env = envSchema.parse(process.env);
