import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import type { NextAuthConfig } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

const providers: NextAuthConfig['providers'] = [
  Credentials({
    credentials: {
      email:    { label: 'Email',    type: 'email'    },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;
      try {
        const { getUserByEmail } = await import('@sitenexis/db');
        const { compare } = await import('bcryptjs');
        const user = await getUserByEmail(credentials.email as string);
        if (!user?.passwordHash) return null;
        const valid = await compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email };
      } catch {
        return null;
      }
    },
  }),
];

// Google OAuth is optional — only active when both env vars are set
if (process.env['AUTH_GOOGLE_ID'] && process.env['AUTH_GOOGLE_SECRET']) {
  providers.push(
    Google({
      clientId:     process.env['AUTH_GOOGLE_ID'],
      clientSecret: process.env['AUTH_GOOGLE_SECRET'],
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error:  '/login',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user && account) {
        if (account.provider === 'credentials') {
          token.id = user.id;
        } else if (account.provider === 'google' && user.email) {
          // Find or create a DB user for Google sign-ins
          // Capture email before awaits so TypeScript keeps the string narrowing
          const email = user.email;
          try {
            const { getUserByEmail, upsertUser } = await import('@sitenexis/db');
            const existing = await getUserByEmail(email);
            const dbUser = existing ?? await upsertUser(user.id ?? crypto.randomUUID(), email);
            token.id = dbUser.id;
          } catch {
            token.id = user.id;
          }
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
