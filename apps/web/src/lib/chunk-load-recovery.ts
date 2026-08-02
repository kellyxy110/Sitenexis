'use client';

const RELOAD_FLAG_KEY = 'sitenexis:chunk-reload-attempted';

/** Webpack/Next.js throws this specific shape when a lazily-loaded JS chunk 404s — almost always because the browser has an older page open and the chunk's content hash changed under a new deploy. */
export function isChunkLoadError(error: Error): boolean {
  return error.name === 'ChunkLoadError' || /Loading chunk [\d]+ failed/i.test(error.message);
}

/**
 * A stale client can't recover from a chunk 404 by re-rendering — the
 * browser's module registry still points at the old, now-missing file. Only
 * a full reload re-fetches the current build's asset manifest. Guarded by a
 * per-tab-session flag so a genuinely broken chunk (not just staleness)
 * still surfaces the real error instead of reload-looping forever.
 *
 * Returns true when a reload was just triggered — the caller should render a
 * brief "updating" state instead of the full error UI while it happens.
 */
export function recoverFromChunkLoadError(error: Error): boolean {
  if (typeof window === 'undefined' || !isChunkLoadError(error)) return false;
  if (window.sessionStorage.getItem(RELOAD_FLAG_KEY) === '1') return false;
  window.sessionStorage.setItem(RELOAD_FLAG_KEY, '1');
  window.location.reload();
  return true;
}
