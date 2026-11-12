// Bereitschaft für Stage 1 (Bericht C, C-01): «Bereit» darf nur erscheinen, wenn die Pflichtteile wirklich da sind. Die Dosierung
// der Fehler aus logik/fehler-dosiert.ts gilt nur für das Abzeichen in der Symbolleiste, nicht hier: Gezählt werden alle Fehler
// und alle Lücken. Lücken sind unbearbeitete oder unvollständige Etappen, leere Pflichtregister und Pflichtdokumente ohne Freigabe.
import type { Projekt } from '../../model/typen.ts';
import { aktiveEtappen, seitenIndex, type Umfeld } from './gefuehrt.ts';
import { etappenStand } from './ueberblick.ts';

export type BereitStufe = 'gruen' | 'gelb' | 'rot';

export interface Luecke {
  art: 'etappe' | 'register' | 'dokumente' | 'regel';
  /** Etappe (E9), Register (ziele) oder Anzahl Dokumente */
  id: string;
  erledigt?: number;
  gesamt?: number;
  ids?: string[];
}

export interface Bereitschaft {
  stufe: BereitStufe;
  fehler: number;
  hinweise: number;
  luecken: Luecke[];
}

/** Register, die für Stage 1 nicht leer sein dürfen (ISO/IEC 42001 6.1, 6.2, 7.2, 7.4, Inventar und Risikobeurteilung) */
const PFLICHT_REGISTER = ['kiSysteme', 'risiken', 'ziele', 'kompetenzen', 'kommunikation'] as const;

/**
 * Die Schlussetappe (E13) enthält die Prüfung selbst und das Einreichen; sie zählt als Lücke nur, solange sie nicht begonnen
 * ist. Der Stand J (Modul-Etappe mit eigenen Fristen) bleibt draussen wie im Bericht.
 */
const SCHLUSS = 'E13';

/** Eigene Controls sind freiwillig: Eine leere Seite ist keine Lücke (6.1.3 verlangt nur den Abgleich mit Anhang A) */
const WAHLWEISE = new Set(['E8-eigene']);

/** Hinweise, die für Stage 1 als Lücke binden (Vier-Augen H88, Datum in der Zukunft H89); Prüfung und Tests lesen sie hier */
export const BEREITSCHAFT_REGELN = ['H88', 'H89'] as const;

export function bereitschaftBerechnen(p: Projekt, u: Umfeld, befunde: readonly { schwere: 'fehler' | 'hinweis'; regel?: string }[], ohneFreigabe: readonly string[]): Bereitschaft {
  const fehler = befunde.filter((b) => b.schwere === 'fehler').length;
  const hinweise = befunde.length - fehler;
  const luecken: Luecke[] = [];
  const index = seitenIndex(u.gefuehrt);
  for (const e of aktiveEtappen(u.gefuehrt, p)) {
    if (e.id === 'J') continue;
    const s = etappenStand(e, p, u, index);
    const offeneSeiten = s.seiten.filter((x) => x.status !== 'erledigt' && !(WAHLWEISE.has(x.id) && !p.eigeneControls.length));
    const offen = e.id === SCHLUSS ? s.erledigt === 0 : offeneSeiten.length > 0;
    if (offen) luecken.push({ art: 'etappe', id: e.id, erledigt: s.erledigt, gesamt: s.gesamt });
  }
  for (const r of PFLICHT_REGISTER) if (!p[r]?.length) luecken.push({ art: 'register', id: r });
  if (ohneFreigabe.length) luecken.push({ art: 'dokumente', id: String(ohneFreigabe.length), ids: [...ohneFreigabe] });
  // Vier-Augen und Daten in der Zukunft: Hinweise in der Prüfung, aber «Bereit» darf damit nicht erscheinen (C2-05, C2-06)
  for (const r of BEREITSCHAFT_REGELN) {
    const n = befunde.filter((b) => b.regel === r).length;
    if (n) luecken.push({ art: 'regel', id: r, erledigt: n });
  }
  return { stufe: fehler || luecken.length ? 'rot' : hinweise ? 'gelb' : 'gruen', fehler, hinweise, luecken };
}
