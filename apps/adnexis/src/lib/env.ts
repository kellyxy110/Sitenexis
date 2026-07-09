import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://placeholder:placeholder@localhost:5432/placeholder'),
  DIRECT_URL:   z.string().default('postgresql://placeholder:placeholder@localhost:5432/placeholder'),

  AUTH_SECRET:      z.string().default('dev-secret-replace-in-production'),
  NEXTAUTH_URL:     z.string().default('http://localhost:3001'),
  AUTH_GOOGLE_ID:   z.string().default(''),
  AUTH_GOOGLE_SECRET: z.string().default(''),

  ANTHROPIC_API_KEY: z.string().default(''),
  GROQ_API_KEY:      z.string().default(''),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  STRIPE_SECRET_KEY:               z.string().default('sk_test_placeholder'),
  STRIPE_WEBHOOK_SECRET:           z.string().default('whsec_placeholder'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default('pk_test_placeholder'),

  STRIPE_PRICE_PRO:    z.string().default(''),
  STRIPE_PRICE_AGENCY: z.string().default(''),

  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3001'),
});

export const env = envSchema.parse(process.env);
