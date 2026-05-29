import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from './supabase/server';
import { DEMO_USER } from './demo-store';
import { isFullyConfigured } from './mode';

export async function requireAuth(_req: NextRequest): Promise<{ id: string; email: string }> {
  if (!isFullyConfigured()) {
    return DEMO_USER;
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError('Unauthorized');
  }

  return { id: user.id, email: user.email ?? '' };
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
