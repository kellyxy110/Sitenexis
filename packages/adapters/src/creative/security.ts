// Creative security — prompt validation, injection prevention, content policy.
// All adapters call validatePrompt() before sending to any model API.

export class PromptValidationError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'PromptValidationError';
    this.code = code;
  }
}

// ── Injection patterns ────────────────────────────────────────────────────────
// These patterns detect attempts to override system behavior via the prompt field.

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i,
  /system\s*:\s*you\s+are\s+now/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
  /###\s*instruction/i,
  /forget\s+your\s+(previous\s+)?(instructions?|training)/i,
  /as\s+a\s+(jailbroken|uncensored|unfiltered)\s+(ai|model|assistant)/i,
  /\bDAN\b.*\bdo\s+anything\s+now\b/i,
];

// ── Length guards ─────────────────────────────────────────────────────────────

const MAX_PROMPT_CHARS = 2_000;
const MAX_NEGATIVE_PROMPT_CHARS = 500;

// ── Validation ────────────────────────────────────────────────────────────────

export function validatePrompt(prompt: unknown, field = 'prompt'): string {
  if (typeof prompt !== 'string') {
    throw new PromptValidationError(`${field} must be a string`, 'invalid_type');
  }
  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    throw new PromptValidationError(`${field} must not be empty`, 'empty');
  }
  const maxLen = field === 'negativePrompt' ? MAX_NEGATIVE_PROMPT_CHARS : MAX_PROMPT_CHARS;
  if (trimmed.length > maxLen) {
    throw new PromptValidationError(
      `${field} exceeds ${maxLen} character limit (got ${trimmed.length})`,
      'too_long',
    );
  }
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new PromptValidationError(
        `${field} contains a disallowed pattern`,
        'injection_attempt',
      );
    }
  }
  return trimmed;
}

export function isValidPrompt(prompt: unknown, field = 'prompt'): boolean {
  try {
    validatePrompt(prompt, field);
    return true;
  } catch {
    return false;
  }
}

// ── API key guards ────────────────────────────────────────────────────────────

export function validateHuggingFaceToken(token: unknown): string {
  if (typeof token !== 'string' || token.trim().length < 8) {
    throw new PromptValidationError('HuggingFace token is missing or invalid', 'missing_token');
  }
  const t = token.trim();
  // HF tokens start with hf_ (user) or api_ (legacy) or have 32+ char length
  if (t.includes('placeholder') || t === 'YOUR_HF_TOKEN') {
    throw new PromptValidationError('HuggingFace token is a placeholder value', 'placeholder_token');
  }
  return t;
}

export function isTokenConfigured(token: string | undefined): boolean {
  return typeof token === 'string' && token.length >= 8 &&
    !token.includes('placeholder') && token !== 'YOUR_HF_TOKEN';
}
