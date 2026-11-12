// AF-024: Regressionsmodus, feste Dateien früherer Runden und Fall-Dateien der bekannten Funde laufen durch das Ziel
import { describe, expect, it } from 'vitest';
import { BEKANNTE_FUNDE } from './bekannte-funde.ts';
import { laufeZiel } from './lauf.ts';
import { bewerteRegression, regressionsDateien, type RegressionsDatei } from './regression.ts';

describe('AF-024 Regressionsmodus', () => {
  const liste = regressionsDateien();

  it('umfasst die 6 Eingaben und die 30 Hänger-Dateien aus Runde 2 und alle Fall-Dateien der bekannten Funde', () => {
    expect(liste.filter((r) => r.datei.startsWith('tests/fixtures/runde2/eingaben/'))).toHaveLength(6);
    expect(liste.filter((r) => r.datei.startsWith('tests/fixtures/runde2/drawio-haenger/')).length).toBeGreaterThanOrEqual(30);
    expect(liste.filter((r) => r.erwartung === 'fund').map((r) => r.datei)).toEqual(BEKANNTE_FUNDE.map((f) => f.datei));
  });

  it('jede Datei erfüllt ihre Erwartung (DTD-Umgehungen abgelehnt, Hänger beendet, Funde schlagen weiter fehl)', async () => {
    const fehler: string[] = [];
    // Je Datei ein Arbeiterprozess unter Aufsicht; die Fall-Dateien laufen mit der Datei, nicht mit dem erzeugten Fall
    const warteschlange = [...liste];
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        for (let r = warteschlange.shift(); r; r = warteschlange.shift()) {
          const e = await laufeZiel({ art: r.art, seed: 1, faelle: 1, datei: r.datei });
          const f = bewerteRegression(r, e);
          if (f) fehler.push(f);
        }
      }),
    );
    expect(fehler).toEqual([]);
  }, 300_000);

  it('bewertet Abweichungen: Annahme einer abzulehnenden Datei, behobener Fund, Fund aus anderem Grund', () => {
    const leer = { angenommen: 0, abgelehnt: 0, fehler: 0, haenger: 0, fehlerFaelle: [] };
    const abgelehnt: RegressionsDatei = { art: 'drawio', datei: 'x.drawio', erwartung: 'abgelehnt' };
    expect(bewerteRegression(abgelehnt, { ...leer, angenommen: 1 })).toMatch(/wurde angenommen/);
    expect(bewerteRegression(abgelehnt, { ...leer, abgelehnt: 1 })).toBeUndefined();
    const fund: RegressionsDatei = { art: 'normpaket', datei: 'f.json', erwartung: 'fund', meldung: 'norm' };
    expect(bewerteRegression(fund, { ...leer, angenommen: 1 })).toMatch(/behoben/);
    const anders = { ...leer, fehler: 1, fehlerFaelle: [{ meldung: 'etwas anderes', text: '' }] } as never;
    expect(bewerteRegression(fund, anders)).toMatch(/aus anderem Grund/);
  });
});
