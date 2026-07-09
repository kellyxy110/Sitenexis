import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export async function requireAuth(_req?: unknown): Promise<{ id: string; email: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new AuthError('Unauthorized');
  return { id: session.user.id, email: session.user.email ?? '' };
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
