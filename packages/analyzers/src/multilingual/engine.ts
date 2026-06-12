import type { CrawledPage } from '@sitenexis/shared';
import { routeTask, isAnyOpenRouterAvailable } from '../ai/model-router';

// ─── Types ────────────────────────────────────────────────────────────────────

// Llama 3.3 70B supports 8 languages fluently
export type SupportedLanguage =
  | 'en' | 'de' | 'fr' | 'it' | 'pt' | 'hi' | 'es' | 'th';

export interface LanguageDetectionResult {
  primaryLanguage: SupportedLanguage | 'other';
  confidence: number;             // 0–1
  multilingualSite: boolean;
  detectedLanguages: string[];
  requiresMultilingualAnalysis: boolean;
}

interface LangDetectResponse {
  primaryLanguage: string;
  confidence: number;
  detectedLanguages: string[];
  multilingualSite: boolean;
}

const LLAMA_SUPPORTED: Set<string> = new Set(['en', 'de', 'fr', 'it', 'pt', 'hi', 'es', 'th']);

const SYSTEM = `You are a language detection system. Analyse web page content and identify the primary language.
Return ONLY valid JSON. No explanation. No markdown.`;

function buildDetectionPrompt(sampleText: string): string {
  return `Detect the primary language and any secondary languages in this web content sample.

Content sample:
${sampleText}

Return ONLY valid JSON:
{
  "primaryLanguage": "en",
  "confidence": 0.98,
  "detectedLanguages": ["en"],
  "multilingualSite": false
}

Use ISO 639-1 language codes (en, de, fr, es, pt, it, hi, th, zh, ja, ko, ar, etc.)`;
}

/**
 * Programmatic language detection using Unicode script ranges.
 * Fast fallback — no API call required.
 */
function detectLanguageProgrammatic(text: string): SupportedLanguage | 'other' {
  // Check for non-Latin scripts first (more reliable)
  if (/[ऀ-ॿ]/.test(text)) return 'hi';       // Devanagari (Hindi)
  if (/[฀-๿]/.test(text)) return 'th';       // Thai
  if (/[一-鿿぀-ゟ゠-ヿ]/.test(text)) return 'other'; // CJK/Japanese

  // Latin-script languages — sample word detection
  const lower = text.toLowerCase();
  if (/\b(der|die|das|und|ist|nicht|auch|wird|haben|können)\b/.test(lower)) return 'de';
  if (/\b(les|des|une|est|avec|pour|dans|mais|plus|cette)\b/.test(lower)) return 'fr';
  if (/\b(della|degli|sono|non|per|una|delle|anche|tutto|questo)\b/.test(lower)) return 'it';
  if (/\b(não|para|uma|com|mas|também|sobre|como|mais|este)\b/.test(lower)) return 'pt';
  if (/\b(una|está|pero|también|como|más|este|para|los|las)\b/.test(lower)) return 'es';

  return 'en'; // Default to English for Latin script
}

/**
 * Detect the primary language of a site from its crawled pages.
 * Uses Llama 3.3 70B for non-English sites when OpenRouter is available.
 * Falls back to programmatic Unicode-based detection.
 */
export async function detectSiteLanguage(
  pages: CrawledPage[],
): Promise<LanguageDetectionResult> {
  // Build a representative sample from the first 5 meaningful pages
  const samplePages = pages
    .filter((p) => (p.bodyText ?? '').length > 100)
    .slice(0, 5);

  if (samplePages.length === 0) {
    return { primaryLanguage: 'en', confidence: 0.5, multilingualSite: false, detectedLanguages: ['en'], requiresMultilingualAnalysis: false };
  }

  const sampleText = samplePages
    .map((p) => p.bodyText.slice(0, 300))
    .join('\n\n')
    .slice(0, 1200);

  // Quick programmatic check
  const programmaticLang = detectLanguageProgrammatic(sampleText);

  // Skip AI detection for English — high confidence, no added value
  if (programmaticLang === 'en') {
    return {
      primaryLanguage: 'en',
      confidence: 0.95,
      multilingualSite: false,
      detectedLanguages: ['en'],
      requiresMultilingualAnalysis: false,
    };
  }

  // Use Llama 3.3 for non-English sites (multilingual support)
  if (isAnyOpenRouterAvailable()) {
    try {
      const result = await routeTask<LangDetectResponse>(
        'multilingual_analysis',
        SYSTEM,
        buildDetectionPrompt(sampleText),
        { jsonMode: true, maxTokens: 256, temperature: 0 },
      );

      if (result) {
        const lang = result.primaryLanguage as SupportedLanguage | 'other';
        return {
          primaryLanguage: lang,
          confidence: Math.min(1, Math.max(0, result.confidence ?? 0.8)),
          multilingualSite: result.multilingualSite ?? false,
          detectedLanguages: result.detectedLanguages ?? [lang],
          requiresMultilingualAnalysis: lang !== 'en' && LLAMA_SUPPORTED.has(lang),
        };
      }
    } catch { /* fall through to programmatic */ }
  }

  // Programmatic fallback
  return {
    primaryLanguage: programmaticLang,
    confidence: programmaticLang === 'other' ? 0.6 : 0.8,
    multilingualSite: false,
    detectedLanguages: [programmaticLang],
    // programmaticLang is already narrowed to exclude 'en' here (returned early above)
    requiresMultilingualAnalysis: LLAMA_SUPPORTED.has(programmaticLang),
  };
}
