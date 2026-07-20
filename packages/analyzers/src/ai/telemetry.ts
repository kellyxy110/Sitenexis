// AI call telemetry — DB-free event emitter for callAI()/callGroqDirect().
// packages/analyzers must never call the DB directly (CLAUDE.md §7), so this
// module only emits events; apps/web subscribes and persists via @sitenexis/db.
// Mirrors the onMetrics() pattern already used in packages/adapters/src/*/registry.ts.

export interface AiCallEvent {
  provider: string;
  model: string;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  inputTokens?: number;
  outputTokens?: number;
}

type Handler = (event: AiCallEvent) => void;

const handlers: Handler[] = [];

/** Subscribe to every AI call made through client.ts. Handlers must never throw. */
export function onAiCall(handler: Handler): void {
  handlers.push(handler);
}

export function emitAiCall(event: AiCallEvent): void {
  for (const handler of handlers) {
    try {
      handler(event);
    } catch {
      // A telemetry subscriber failing must never affect the AI call itself.
    }
  }
}
