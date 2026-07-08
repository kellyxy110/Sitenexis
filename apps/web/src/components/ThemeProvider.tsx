'use client';
import { useEffect } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem('sn-theme') ?? 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  }, []);
  return <>{children}</>;
}
