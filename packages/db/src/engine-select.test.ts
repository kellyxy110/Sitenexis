import { describe, it, expect } from 'vitest';
import {
  orderEnginesForPlatform,
  pickEngineLibrary,
  ENGINE_WINDOWS,
  ENGINE_RHEL_3,
  ENGINE_RHEL_1,
} from './engine-select';

// Deterministic path join so tests are OS-independent.
const j = (dir: string, file: string): string => `${dir}/${file}`;

describe('orderEnginesForPlatform', () => {
  it('lists the Windows dll FIRST on win32', () => {
    expect(orderEnginesForPlatform('win32')[0]).toBe(ENGINE_WINDOWS);
  });

  it('lists a Linux engine first on non-Windows platforms', () => {
    for (const p of ['linux', 'darwin'] as NodeJS.Platform[]) {
      expect(orderEnginesForPlatform(p)[0]).toBe(ENGINE_RHEL_3);
    }
  });
});

describe('pickEngineLibrary', () => {
  const generated = '/repo/packages/db/generated';
  // Simulates the real repo: BOTH the Windows dll and the Linux engines are on disk.
  const bothPresent = new Set([
    j(generated, ENGINE_WINDOWS),
    j(generated, ENGINE_RHEL_3),
    j(generated, ENGINE_RHEL_1),
  ]);

  it('REGRESSION: on Windows never pins an incompatible Linux engine when the dll exists', () => {
    const chosen = pickEngineLibrary('win32', [generated], (p) => bothPresent.has(p), j);
    expect(chosen).toBe(j(generated, ENGINE_WINDOWS));
  });

  it('on Linux picks the rhel engine even though the Windows dll is also present', () => {
    const chosen = pickEngineLibrary('linux', [generated], (p) => bothPresent.has(p), j);
    expect(chosen).toBe(j(generated, ENGINE_RHEL_3));
  });

  it('falls back to a Linux engine on Windows only when the dll is absent', () => {
    const linuxOnly = new Set([j(generated, ENGINE_RHEL_3), j(generated, ENGINE_RHEL_1)]);
    const chosen = pickEngineLibrary('win32', [generated], (p) => linuxOnly.has(p), j);
    expect(chosen).toBe(j(generated, ENGINE_RHEL_3));
  });

  it('prefers the correct engine wherever it lives across multiple candidate dirs', () => {
    // An earlier dir holds ONLY a Linux engine (a Next.js-traced copy); the real
    // generated dir later in the list holds the Windows dll. Windows must still win.
    const tracedLinux = '/repo/apps/web/.next/traced/packages/db/generated';
    const files = new Set([
      j(tracedLinux, ENGINE_RHEL_3),
      j(generated, ENGINE_WINDOWS),
      j(generated, ENGINE_RHEL_3),
    ]);
    const chosen = pickEngineLibrary('win32', [tracedLinux, generated], (p) => files.has(p), j);
    expect(chosen).toBe(j(generated, ENGINE_WINDOWS));
  });

  it('returns null when no known engine is found', () => {
    expect(pickEngineLibrary('win32', ['/nowhere'], () => false, j)).toBeNull();
  });
});
