import { routeVisionTask } from '../ai/model-router';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VisualAnalysisResult {
  visualHierarchyScore: number;          // 0–100
  imageTextAlignmentScore: number;       // 0–100
  contentAboveTheFoldScore: number;      // 0–100
  visualTrustSignalScore: number;        // 0–100
  overallVisualScore: number;            // 0–100
  issues: VisualIssue[];
  suggestions: string[];
  analysisSource: 'gemma4' | 'skipped';
}

export interface VisualIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  recommendation: string;
}

interface GemmaVisualResponse {
  visualHierarchyScore: number;
  imageTextAlignmentScore: number;
  contentAboveTheFoldScore: number;
  visualTrustSignalScore: number;
  issues: Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    description: string;
    recommendation: string;
  }>;
  suggestions: string[];
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM = `You are an AI visual perception analyst specialising in how AI systems interpret web page screenshots.
You evaluate pages for machine readability, visual trust signals, content clarity, and AI extractability.
Return ONLY valid JSON. No explanation. No markdown.`;

function buildVisualPrompt(pageUrl: string): string {
  return `Analyse this web page screenshot for AI retrieval optimisation.

Page URL: ${pageUrl}

Evaluate on four dimensions (each 0-100):

1. Visual Hierarchy Score — Is there a clear H1, logical reading flow, and heading structure visible?
2. Image-Text Alignment Score — Do images reinforce the text content or distract from it?
3. Content Above The Fold Score — Is substantive, AI-extractable content visible without scrolling?
4. Visual Trust Signal Score — Are trust signals visible (author attribution, dates, organisation marks, credibility indicators)?

Return ONLY valid JSON:
{
  "visualHierarchyScore": 75,
  "imageTextAlignmentScore": 80,
  "contentAboveTheFoldScore": 60,
  "visualTrustSignalScore": 70,
  "issues": [
    {
      "type": "missing_visual_hierarchy",
      "severity": "warning",
      "description": "No clear H1 visible in the above-fold area",
      "recommendation": "Add a prominent H1 heading that matches the page topic"
    }
  ],
  "suggestions": ["Move the author attribution above the fold", "Increase contrast on the main CTA"]
}`;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Analyse a page screenshot using Gemma 4 31B multimodal.
 * Evaluates visual hierarchy, image-text alignment, above-fold content, and trust signals.
 * Returns a `skipped` result if no screenshot is available or Gemma is not configured.
 */
export async function analyzeVisualPage(
  pageUrl: string,
  screenshotBase64OrUrl: string,
): Promise<VisualAnalysisResult> {
  const SKIPPED: VisualAnalysisResult = {
    visualHierarchyScore: 0,
    imageTextAlignmentScore: 0,
    contentAboveTheFoldScore: 0,
    visualTrustSignalScore: 0,
    overallVisualScore: 0,
    issues: [],
    suggestions: [],
    analysisSource: 'skipped',
  };

  if (!screenshotBase64OrUrl) return SKIPPED;

  try {
    const result = await routeVisionTask<GemmaVisualResponse>(
      'visual_analysis',
      SYSTEM,
      buildVisualPrompt(pageUrl),
      screenshotBase64OrUrl,
      { jsonMode: true, maxTokens: 1024 },
    );

    if (!result) return SKIPPED;

    const vhs = clamp(result.visualHierarchyScore ?? 0);
    const itas = clamp(result.imageTextAlignmentScore ?? 0);
    const catfs = clamp(result.contentAboveTheFoldScore ?? 0);
    const vtss = clamp(result.visualTrustSignalScore ?? 0);

    // Equal weight across all four dimensions
    const overallVisualScore = Math.round((vhs + itas + catfs + vtss) / 4);

    return {
      visualHierarchyScore: vhs,
      imageTextAlignmentScore: itas,
      contentAboveTheFoldScore: catfs,
      visualTrustSignalScore: vtss,
      overallVisualScore,
      issues: result.issues ?? [],
      suggestions: result.suggestions ?? [],
      analysisSource: 'gemma4',
    };
  } catch (err) {
    console.error('[visual-analysis] Gemma 4 analysis failed (non-fatal):', err instanceof Error ? err.message : String(err));
    return SKIPPED;
  }
}

function clamp(val: number): number {
  return Math.min(100, Math.max(0, Math.round(val)));
}
