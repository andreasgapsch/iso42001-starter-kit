// Prüfung im Werkzeug: Regeln (src/regeln) mit Katalogdaten ausführen.
import type { Kataloge } from '../../kataloge/typen.ts';
import type { Projekt } from '../../model/typen.ts';
import { pruefeProjekt, type Befund, type Regel } from '../../regeln/pruefungen.ts';
import type { GefuehrtDaten } from './gefuehrt-typen.ts';
import { gefuehrtSprung } from './pruefsprung.ts';

/** kataloge (ab rc.2): für die Regeln des Moduls NIST AI RMF (F27, F28, H36, H37, H40) */
export function pruefe(projekt: Projekt, regeln: Regel[], controlIds42001: string[], aiActStand: string, heute: string, kataloge?: Kataloge): Befund[] {
  return pruefeProjekt(regeln, { projekt, heute, controlIds42001, aiActStand, kataloge });
}

const jeSeiteCache = new WeakMap<readonly Befund[], Map<string, Befund[]>>();

/**
 * Befunde je Seite des Guides (AF-139): Jeder Befund gehört zu der Seite, auf die ihn die Prüfseite im Guide führt
 * (pruefsprung.ts). Der Guide nennt eine Seite nur «erledigt», wenn hier nichts steht. Je Befundliste einmal berechnet.
 */
export function befundeJeSeite(befunde: readonly Befund[], p: Projekt, g: GefuehrtDaten): Map<string, Befund[]> {
  const bekannt = jeSeiteCache.get(befunde);
  if (bekannt) return bekannt;
  const m = new Map<string, Befund[]>();
  for (const b of befunde) {
    const r = gefuehrtSprung(b, p, g);
    if (r?.art !== 'gefuehrt' || !r.seite) continue;
    m.set(r.seite, [...(m.get(r.seite) ?? []), b]);
  }
  jeSeiteCache.set(befunde, m);
  return m;
}

export type { Befund, Regel };
