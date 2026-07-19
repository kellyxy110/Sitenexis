import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/signup' },
  robots: { index: false, follow: true },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
