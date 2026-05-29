'use client';

import { useState, useRef, useCallback } from 'react';

// ─── Validation hook ──────────────────────────────────────────────────────────

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function cleanDomainInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '');  // strip any path
}

export function useDomainValidation(raw: string): {
  isValid: boolean;
  cleanDomain: string;
  error: string | null;
} {
  const cleanDomain = cleanDomainInput(raw);

  if (!raw.trim()) {
    return { isValid: false, cleanDomain: '', error: null };
  }

  if (!DOMAIN_RE.test(cleanDomain)) {
    return {
      isValid: false,
      cleanDomain,
      error: 'Please enter a valid domain (e.g. example.com)',
    };
  }

  return { isValid: true, cleanDomain, error: null };
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface DomainInputProps {
  onSubmit: (domain: string) => void | Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export function DomainInput({
  onSubmit,
  isLoading = false,
  placeholder = 'Enter your domain (e.g. apple.com)',
  autoFocus = false,
}: DomainInputProps) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isValid, cleanDomain, error } = useDomainValidation(value);
  const showError = touched && !!error;

  const handleBlur = useCallback(() => {
    setFocused(false);
    setTouched(true);
    // Auto-clean on blur
    const cleaned = cleanDomainInput(value);
    if (cleaned !== value) setValue(cleaned);
  }, [value]);

  const handleSubmit = useCallback(async () => {
    setTouched(true);
    if (!isValid || isLoading) return;
    await onSubmit(cleanDomain);
  }, [isValid, isLoading, onSubmit, cleanDomain]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSubmit();
    },
    [handleSubmit]
  );

  const borderClass = showError
    ? 'ring-2 ring-red-500 border-red-500'
    : focused
    ? 'ring-2 ring-cyan border-cyan shadow-[0_0_0_4px_rgba(0,200,255,0.15)]'
    : 'border-[#1E3A5F] hover:border-[#2A5180]';

  return (
    <div className="w-full">
      {/* Input bar */}
      <div
        className={[
          'flex items-center rounded-xl border bg-[#05130F] transition-all duration-200',
          borderClass,
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={isLoading}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="Domain"
          aria-invalid={showError}
          aria-describedby={showError ? 'domain-error' : undefined}
          className={[
            'flex-1 bg-transparent py-0 pl-5 pr-3 text-base text-white placeholder-[#4A6280]',
            'outline-none disabled:opacity-50',
            'h-14 md:h-14',
          ].join(' ')}
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || (!isValid && touched)}
          aria-label="Run audit"
          className={[
            'mr-2 flex shrink-0 items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold',
            'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan',
            isLoading
              ? 'cursor-not-allowed bg-cyan/70 text-navy'
              : 'bg-cyan text-navy hover:bg-teal active:scale-95',
            !isValid && touched && !isLoading ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          {isLoading ? (
            <>
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-[pulse_0.8s_ease-in-out_0s_infinite] rounded-full bg-[#030907]" />
                <span className="h-1.5 w-1.5 animate-[pulse_0.8s_ease-in-out_0.2s_infinite] rounded-full bg-[#030907]" />
                <span className="h-1.5 w-1.5 animate-[pulse_0.8s_ease-in-out_0.4s_infinite] rounded-full bg-[#030907]" />
              </span>
              <span>Starting Scan...</span>
            </>
          ) : (
            'Run Audit →'
          )}
        </button>
      </div>

      {/* Error message */}
      {showError && (
        <p
          id="domain-error"
          role="alert"
          className="mt-2 text-sm text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}
