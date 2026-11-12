// Treffer der Regeln aus Runde 2b (P11, AF-076, AF-077, AF-079) und 3a (P14, AF-095: F44 bis F47) in den Beispielen, DE und
// EN gleich: von den Regeln richtig gefunden, Korrektur der Beispiele in P15a (Präzision: AF-082, AF-083, AF-084, AF-085) und
// P15b (Muster: AF-087, AF-090, AF-127, AF-091), F43 zu PR-19: die Felder «Entdeckt» und «Eingedämmt» gibt es seit P14
// (AF-104, Schemaversion 3), die Beispiele tragen die Zeitpunkte in P15a und P15b nach. tests/unit/beispiele.test.ts prüft, dass die Liste genau
// stimmt; andere Tests nehmen nur diese Treffer aus. Mit jeder Korrektur wird die Liste kürzer, nach P15 ist sie leer.
import type { Befund } from '../../src/regeln/pruefungen.ts';

export const ERWARTET_BIS_P15: Record<'muster' | 'praezision', string[]> = {
  // P15b: alle Muster-Treffer behoben (AF-086 bis AF-090, AF-127, AF-091; F43 mit «Entdeckt» und «Eingedämmt»)
  muster: [],
  // P15a (AF-082 bis AF-085, F43 PR-19 mit Entdeckung und Eindämmung): Präzision ohne Treffer, Einträge gestrichen
  praezision: [],
};

export const befundSchluessel = (b: Pick<Befund, 'schwere' | 'regel' | 'id'>) => `${b.schwere} ${b.regel} ${b.id ?? ''}`;

/** Erwarteter Treffer bis P15 für ein Beispiel (Dateiname oder Kurzname mit «muster» bzw. «praezision») */
export const erwartetBisP15 = (beispiel: string) => (b: Pick<Befund, 'schwere' | 'regel' | 'id'>) =>
  ERWARTET_BIS_P15[beispiel.startsWith('muster') ? 'muster' : 'praezision'].includes(befundSchluessel(b));
