import { callAI } from './client';
import { scoutChatPrompt, SCOUT_CHAT_SYSTEM_PROMPT, type ScoutChatContext, type ScoutChatOutput } from './prompts';

const SCOUT_CHAT_MAX_TOKENS = 1_024;

/**
 * The single entry point for Scout's conversational Q&A. This is the only
 * place in the codebase that turns a free-text user question into an AI
 * call grounded in canonical SiteNexis audit data — callers (Telegram, and
 * potentially future surfaces) must build a `ScoutChatContext` from
 * already-computed data and never pass raw crawl output or unvalidated
 * user input beyond the question string itself.
 */
export async function answerScoutQuestion(context: ScoutChatContext, question: string): Promise<ScoutChatOutput> {
  const prompt = scoutChatPrompt(context, question);
  return callAI<ScoutChatOutput>(prompt, SCOUT_CHAT_SYSTEM_PROMPT, SCOUT_CHAT_MAX_TOKENS);
}
