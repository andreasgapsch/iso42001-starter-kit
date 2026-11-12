// Erkennung, was der Browser unter file:// kann.

import type { FsaGlobal } from './datei.ts';
import type { Faehigkeiten } from './typen.ts';
import { waehleZwischenspeicher, type Auswahl, type Umgebung } from './zwischenspeicher.ts';

export interface FsaUmgebung extends FsaGlobal {
  isSecureContext?: boolean;
  /** In einem fremden iframe sperrt Chromium die Dialoge. */
  self?: unknown;
  top?: unknown;
}

/** File System Access nur, wenn beide Dialoge da sind, der Kontext sicher ist und kein iframe vorliegt. */
export function erkenneFsa(g: FsaUmgebung): { oeffnen: boolean; speichern: boolean } {
  const basis = g.isSecureContext !== false && (g.top === undefined || g.top === g.self);
  return {
    oeffnen: basis && typeof g.showOpenFilePicker === 'function',
    speichern: basis && typeof g.showSaveFilePicker === 'function',
  };
}

/** Synchroner Test mit Schreiben und Löschen; Zugriff selbst kann werfen. */
export function pruefeLocalStorage(u: Umgebung): boolean {
  try {
    const ls = u.localStorage;
    if (!ls) return false;
    const k = 'aims-manager:probe-ls';
    ls.setItem(k, '1');
    const ok = ls.getItem(k) === '1';
    ls.removeItem(k);
    return ok;
  } catch {
    return false;
  }
}

export async function erkenneFaehigkeiten(
  g: FsaUmgebung & Umgebung,
): Promise<{ faehigkeiten: Faehigkeiten; auswahl: Auswahl }> {
  const fsa = erkenneFsa(g);
  const auswahl = await waehleZwischenspeicher(g);
  const art = auswahl.adapter.art;
  return {
    faehigkeiten: {
      fsaOeffnen: fsa.oeffnen,
      fsaSpeichern: fsa.speichern,
      indexedDb: art === 'indexeddb',
      localStorage: art === 'localstorage' || pruefeLocalStorage(g),
      zwischenspeicher: art,
    },
    auswahl,
  };
}
