// Kleine Einstellungen im localStorage (Sprache, Theme). Zugriff kann werfen (gesperrte Cookies, privater Modus).
const P = 'aims-manager:einstellung:';

export function lokalLesen(k: string): string | null {
  try {
    return globalThis.localStorage?.getItem(P + k) ?? null;
  } catch {
    return null;
  }
}

export function lokalSchreiben(k: string, v: string): void {
  try {
    globalThis.localStorage?.setItem(P + k, v);
  } catch {
    /* nicht gemerkt, ohne Folgen */
  }
}
