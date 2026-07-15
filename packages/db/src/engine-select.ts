/**
 * Pure, platform-aware Prisma query-engine selection.
 *
 * The repo commits BOTH the Windows dll and the Linux .so.node engines into
 * packages/db/generated so the same checkout works on a Windows dev machine and
 * on Vercel's Linux runtime. The hazard: on Windows the Linux binaries exist on
 * disk too, so naive "first file that exists" logic pins an incompatible engine
 * and every query dies with "Prisma engines do not seem to be compatible with
 * your system". Selection therefore MUST be ordered by the current platform.
 *
 * This module is intentionally free of `fs`/side-effects so it can be unit tested.
 * Regression guard for the instrumentation/client engine-pinning bug.
 */

export const ENGINE_WINDOWS = 'query_engine-windows.dll.node';
export const ENGINE_RHEL_3 = 'libquery_engine-rhel-openssl-3.0.x.so.node';
export const ENGINE_RHEL_1 = 'libquery_engine-rhel-openssl-1.1.x.so.node';
export const ENGINE_MUSL_3 = 'libquery_engine-linux-musl-openssl-3.0.x.so.node';
export const ENGINE_MUSL = 'libquery_engine-linux-musl.so.node';

/**
 * Engine filenames in preference order for a given platform.
 * On win32 the Windows dll must come first; elsewhere the Linux engines lead.
 */
export function orderEnginesForPlatform(platform: NodeJS.Platform): string[] {
  if (platform === 'win32') {
    return [ENGINE_WINDOWS, ENGINE_RHEL_3, ENGINE_RHEL_1, ENGINE_MUSL_3, ENGINE_MUSL];
  }
  return [ENGINE_RHEL_3, ENGINE_RHEL_1, ENGINE_MUSL_3, ENGINE_MUSL, ENGINE_WINDOWS];
}

/**
 * Pick the absolute path to the platform-appropriate engine.
 *
 * Engine-outer, directory-inner: locate the most platform-appropriate engine
 * wherever it exists across `dirs` before falling back to a less-appropriate one.
 * `join` and `exists` are injected so this stays pure and testable.
 *
 * @returns the chosen absolute path, or null if no known engine is found.
 */
export function pickEngineLibrary(
  platform: NodeJS.Platform,
  dirs: string[],
  exists: (p: string) => boolean,
  join: (dir: string, file: string) => string,
): string | null {
  for (const engine of orderEnginesForPlatform(platform)) {
    for (const dir of dirs) {
      if (!dir) continue;
      const p = join(dir, engine);
      if (exists(p)) return p;
    }
  }
  return null;
}
