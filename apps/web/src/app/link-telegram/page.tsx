'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type LinkState = 'idle' | 'confirming' | 'success' | 'error';

function LinkTelegramContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<LinkState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleConfirm(): Promise<void> {
    setState('confirming');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/telegram-user/link/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Linking failed.' })) as { error?: string };
        setErrorMessage(body.error ?? 'Linking failed.');
        setState('error');
        return;
      }
      setState('success');
    } catch {
      setErrorMessage('Network error — please try again.');
      setState('error');
    }
  }

  if (!token) {
    return (
      <div className="max-w-md rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <h1 className="mb-2 text-lg font-bold text-white">Missing link token</h1>
        <p className="text-sm text-[#7A9AB4]">Open this page from the link Telegram sent you, or send /start to the bot again.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
      <h1 className="mb-2 text-lg font-bold text-white">Connect Telegram to SiteNexis</h1>

      {state === 'idle' || state === 'confirming' ? (
        <>
          <p className="mb-6 text-sm text-[#7A9AB4]">
            Confirm that you want to link your Telegram account to this SiteNexis account.
            You&apos;ll be able to check audit status, scores, and reports from Telegram.
          </p>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={state === 'confirming'}
            className="rounded-lg bg-cyan px-5 py-2.5 text-sm font-semibold text-navy disabled:opacity-60"
          >
            {state === 'confirming' ? 'Connecting…' : 'Confirm connection'}
          </button>
        </>
      ) : state === 'success' ? (
        <p className="text-sm text-teal">Telegram connected. You can return to the chat now.</p>
      ) : (
        <p className="text-sm text-red-400">{errorMessage}</p>
      )}
    </div>
  );
}

export default function LinkTelegramPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-6">
      <Suspense fallback={<div className="text-sm text-[#7A9AB4]">Loading…</div>}>
        <LinkTelegramContent />
      </Suspense>
    </main>
  );
}
