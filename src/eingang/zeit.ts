// Zeitgrenze und Herzschlag für Aufträge an einen Worker (AF-019). Teure fremde Eingaben (Norm-PDF, draw.io, Bibliothekssicherung,
// Word-Vorlage) laufen im Worker; antwortet er nicht in der Zeit oder schweigt er länger als der Herzschlag erlaubt, beendet die
// Wache ihn und der Auftrag endet mit einem EingangsFehler, den die Oberfläche als Meldung zeigt.
import { GRENZEN, type EingangsArt, type Grenze } from './grenzen.ts';
import { EingangsFehler } from './lesen.ts';

export interface Uhr {
  setTimeout(f: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
}

const SYSTEMUHR: Uhr = {
  setTimeout: (f, ms) => globalThis.setTimeout(f, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface Wache {
  /** Lebenszeichen (Fortschritt): setzt den Herzschlag zurück, nicht die Zeitgrenze */
  lebt(): void;
  /** Auftrag beendet: Wache aus */
  ende(): void;
}

/**
 * Wache für einen Auftrag. `abbrechen` beendet den Worker und schliesst den Auftrag mit dem übergebenen Fehler ab. Zeitgrenze und
 * Herzschlag kommen aus der Konfiguration der Art (src/eingang/grenzen.ts), lassen sich für Tests aber setzen.
 */
export function wacheStarten(art: EingangsArt, abbrechen: (f: EingangsFehler) => void, o: { zeitMs?: number; herzschlagMs?: number; uhr?: Uhr } = {}): Wache {
  const g: Grenze = GRENZEN[art];
  const zeitMs = o.zeitMs ?? g.zeitMs;
  const herzschlagMs = o.herzschlagMs ?? g.herzschlagMs;
  const uhr = o.uhr ?? SYSTEMUHR;
  let aus = false;
  let herz: unknown;
  const fehler = (f: EingangsFehler): void => {
    if (aus) return;
    aus = true;
    uhr.clearTimeout(gesamt);
    uhr.clearTimeout(herz);
    abbrechen(f);
  };
  const gesamt = zeitMs !== undefined ? uhr.setTimeout(() => fehler(new EingangsFehler(art, 'zeit', zeitMs)), zeitMs) : undefined;
  const herzStellen = (): void => {
    if (herzschlagMs === undefined) return;
    uhr.clearTimeout(herz);
    herz = uhr.setTimeout(() => fehler(new EingangsFehler(art, 'herzschlag', herzschlagMs)), herzschlagMs);
  };
  herzStellen();
  return {
    lebt: () => {
      if (!aus) herzStellen();
    },
    ende: () => {
      aus = true;
      uhr.clearTimeout(gesamt);
      uhr.clearTimeout(herz);
    },
  };
}
