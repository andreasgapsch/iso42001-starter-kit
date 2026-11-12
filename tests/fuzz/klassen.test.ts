// AF-022: Mutationsklassen je Sicherheitsbefund der Runden 1 und 2 zu Eingaben. Je Klasse mindestens 50 Varianten je Lauf,
// Rückfälle derselben Klasse 0, Originalfall als Regressionsdatei, Gegenprobe ohne die Behebung (W28).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STANDARD_SEED } from './kern.ts';
import { KLASSEN, MIN_VARIANTEN, klassenFehlerText, laufeKlasse, variante } from './klassen/index.ts';
import { fallHash } from './kern.ts';

/** Befunde der Runden 1 und 2 zu Eingaben der vier Muss-Arten (V4) */
const BEFUNDE_MUSS: Record<string, string[]> = {
  projektdatei: ['E-11', 'E-15', 'E-18', 'E-20', 'E2-01', 'E2-15', 'E2-17', 'E2-18', 'E2-20'],
  gestaltungspaket: ['E-04', 'E-05', 'E-06', 'E2-06', 'E2-07', 'E2-11'],
  drawio: ['E-07', 'E-08', 'E-20', 'E2-03', 'E2-04', 'E2-05'],
  sicherung: ['E-01', 'E-09', 'E-22', 'E2-09'],
};

describe('AF-022 Mutationsklassen', () => {
  it('jeder Befund der vier Muss-Arten hat eine Klasse (100 %)', () => {
    for (const [art, befunde] of Object.entries(BEFUNDE_MUSS)) {
      const abgedeckt = new Set(KLASSEN.filter((k) => k.art === art).flatMap((k) => k.befunde));
      expect(befunde.filter((b) => !abgedeckt.has(b)), art).toEqual([]);
    }
  });

  it('jede Klasse hat eine Regressionsdatei mit dem Originalfall', () => {
    for (const k of KLASSEN) expect(existsSync(join(process.cwd(), k.regression)), k.regression).toBe(true);
  });

  it('Varianten sind wiederholbar und verschieden (gleicher Seed gleiche Fälle)', () => {
    for (const k of KLASSEN) {
      const a = [1, 2, 3].map((i) => fallHash(variante(k, STANDARD_SEED, i)));
      expect([1, 2, 3].map((i) => fallHash(variante(k, STANDARD_SEED, i))), k.id).toEqual(a);
      const alle = new Set(Array.from({ length: MIN_VARIANTEN }, (_, i) => fallHash(variante(k, STANDARD_SEED, i + 1))));
      expect(alle.size, `${k.id}: verschiedene Varianten`).toBeGreaterThanOrEqual(MIN_VARIANTEN / 5);
    }
  });

  for (const k of KLASSEN) {
    it(`${k.id} (${k.befunde.join(', ')}): ${MIN_VARIANTEN} Varianten, Rückfälle 0, Regressionsdatei, Gegenprobe`, async () => {
      const e = await laufeKlasse(k, STANDARD_SEED, MIN_VARIANTEN);
      expect(e.varianten).toBeGreaterThanOrEqual(MIN_VARIANTEN);
      expect(e.fehler.map((f) => klassenFehlerText(k, STANDARD_SEED, f))).toEqual([]);
      expect(e.regression.status === 'fehler' ? e.regression.meldung : 'ok', `${k.regression}`).toBe('ok');
      // Gegenprobe (Modellwert, ohneSchutz): Ohne die Behebung löst der Originalfall den Befund aus, und die Klasse trifft ihn in
      // mindestens 80 % der Varianten. Die reale Nachmessung gegen den Code ohne Behebung macht der Prüf-Agent (AF-059).
      expect(e.regression.ohneSchutz, `${k.id}: Originalfall ohne Schutz`).toBe(true);
      expect(e.gegenprobe, `${k.id}: Varianten, die den Befund ohne Behebung auslösen`).toBeGreaterThanOrEqual(Math.ceil(MIN_VARIANTEN * 0.8));
    });
  }
});
