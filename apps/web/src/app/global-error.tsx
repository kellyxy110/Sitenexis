'use client';

import { useEffect, useState } from 'react';
import { recoverFromChunkLoadError } from '@/lib/chunk-load-recovery';

/**
 * Root-level fallback — catches errors that occur outside any nested error
 * boundary (or before one mounts). Must render its own <html>/<body> since it
 * replaces the entire root layout when triggered.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (recoverFromChunkLoadError(error)) {
      setRecovering(true);
      return;
    }
    console.error('[global error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased" style={{ background: '#050B09', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          {recovering ? (
            <p style={{ fontSize: 14, color: '#4A6280' }}>Updating to the latest version…</p>
          ) : (
            <div style={{ width: '100%', maxWidth: 420, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(10,22,40,0.6)', padding: 32, textAlign: 'center' }}>
              <h1 style={{ marginBottom: 8, fontSize: 18, fontWeight: 700 }}>Something went wrong</h1>
              <p style={{ marginBottom: 24, fontSize: 14, color: '#4A6280', lineHeight: 1.6 }}>
                A client-side error occurred. Reloading usually fixes this.
              </p>
              <button
                onClick={() => { window.location.reload(); }}
                style={{ width: '100%', borderRadius: 8, background: '#00C8FF', padding: '10px 16px', fontSize: 14, fontWeight: 600, color: '#0A1628', border: 'none', cursor: 'pointer' }}
              >
                Reload page
              </button>
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
