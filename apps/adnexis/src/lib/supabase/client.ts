'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';
  return createBrowserClient(url, key);
}

export function isSupabaseConfigured(): boolean {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  return Boolean(url) && !url.includes('placeholder');
}
