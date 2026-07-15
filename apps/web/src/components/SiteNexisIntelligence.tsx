'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface IntelligenceResponse {
  answer: string;
  model: string;
  provider: string;
  latencyMs: number;
}

const SUGGESTIONS = [
  'Explain my biggest AI-visibility weaknesses in plain English.',
  'What should I fix first, and why?',
  'Turn the top issues into a prioritised action plan.',
  'How does my Machine Trust compare to my SEO health?',
];

/**
 * Per-audit "SiteNexis Intelligence" assistant. Reasoning layer only — it explains
 * and recommends over the completed audit; SiteNexis remains the source of truth for
 * all scores. Conversation is ephemeral (kept in component state, not persisted).
 */
export function SiteNexisIntelligence({ auditId, domain }: { auditId: string; domain: string }): React.JSX.Element {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: async (question: string): Promise<IntelligenceResponse> => {
      const res = await fetch(`/api/audit/${auditId}/intelligence`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, history: turns.slice(-6) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : res.status === 429
              ? 'You have reached the hourly question limit. Please try again later.'
              : 'The Intelligence assistant is temporarily unavailable.',
        );
      }
      return data as IntelligenceResponse;
    },
    onSuccess: (data) => {
      setTurns((prev) => [...prev, { role: 'assistant', content: data.answer }]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, ask.isPending]);

  function submit(question: string): void {
    const q = question.trim();
    if (!q || ask.isPending) return;
    setTurns((prev) => [...prev, { role: 'user', content: q }]);
    setInput('');
    ask.mutate(q);
  }

  return (
    <section
      aria-label="SiteNexis Intelligence assistant"
      className="rounded-xl border border-white/10 bg-[#0A1628]/60 p-5"
    >
      <header className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#00C8FF]/15 text-[#00C8FF]" aria-hidden>
          ✦
        </span>
        <div>
          <h2 className="text-sm font-semibold text-white">SiteNexis Intelligence</h2>
          <p className="text-xs text-[#4A6280]">Ask about <span className="text-[#0BCEBC]">{domain}</span> — explanations & fixes, not new scores.</p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="mb-3 max-h-80 space-y-3 overflow-y-auto pr-1"
        role="log"
        aria-live="polite"
        aria-busy={ask.isPending}
      >
        {turns.length === 0 && !ask.isPending && (
          <div className="space-y-2">
            <p className="text-xs text-[#4A6280]">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-xs text-[#EBF8FF] transition hover:border-[#00C8FF]/40 hover:bg-[#00C8FF]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8FF]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className={t.role === 'user' ? 'text-right' : 'text-left'}>
            <div
              className={
                t.role === 'user'
                  ? 'inline-block max-w-[85%] rounded-2xl rounded-br-sm bg-[#00C8FF]/15 px-3 py-2 text-sm text-white'
                  : 'inline-block max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2 text-sm text-[#EBF8FF]'
              }
            >
              {t.content}
            </div>
          </div>
        ))}

        {ask.isPending && (
          <div className="text-left" aria-label="Assistant is thinking">
            <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#00C8FF] [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#00C8FF] [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#00C8FF]" />
            </div>
          </div>
        )}

        {ask.isError && (
          <div role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#EF4444]">
            {ask.error instanceof Error ? ask.error.message : 'Something went wrong.'}{' '}
            <button type="button" onClick={() => ask.reset()} className="underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444]">Dismiss</button>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(input); }}
        className="flex items-center gap-2"
      >
        <label htmlFor="agnes-input" className="sr-only">Ask SiteNexis Intelligence</label>
        <input
          id="agnes-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this audit…"
          disabled={ask.isPending}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-[#4A6280] focus:border-[#00C8FF]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8FF] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={ask.isPending || !input.trim()}
          className="rounded-lg bg-[#00C8FF] px-4 py-2 text-sm font-semibold text-[#0A1628] transition hover:bg-[#0BCEBC] focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ask.isPending ? 'Thinking…' : 'Ask'}
        </button>
      </form>
    </section>
  );
}
