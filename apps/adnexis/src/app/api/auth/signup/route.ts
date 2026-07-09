export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const SignupSchema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    const first = Object.values(fieldErrors).flat()[0] ?? 'Invalid input';
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const { email, password } = parsed.data;

  try {
    const { hash } = await import('bcryptjs');
    const { createUserWithPassword } = await import('@sitenexis/db');
    const passwordHash = await hash(password, 12);
    await createUserWithPassword(email.toLowerCase(), passwordHash);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in instead.' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Could not create account. Please try again.' },
      { status: 500 },
    );
  }
}
