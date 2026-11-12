// AF-028: `npm run abnahme:q9` schreibt eine Messung mit festen Zählern, Seed, Fallzahl und Commit; AF-019: Grenzmessung des
// Eingangsmoduls (10-fache Grenze: Meldung in höchstens 5 s). Kleine Läufe, damit der Test schnell bleibt; der volle Lauf ist der
// Befehl selbst.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GRENZ_ARTEN, GRENZ_ZEIT_MS, ZAEHLER, grenzMessen, messe, netzPruefen } from '../../scripts/abnahme-q9.mts';

describe('AF-028 Abnahme Q9 als ein Befehl', () => {
  it('zwei Messungen haben dieselben Zählerschlüssel in fester Reihenfolge, mit Seed, Fallzahl und Commit', async () => {
    const a = await messe({ ziele: ['normpaket'], faelle: 2, klassen: false, regression: false, seed: 1 });
    const b = await messe({ ziele: ['drawio'], faelle: 3, klassen: false, regression: false, seed: 2 });
    expect(Object.keys(a.zaehler)).toEqual([...ZAEHLER]);
    expect(Object.keys(b.zaehler)).toEqual(Object.keys(a.zaehler));
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    expect(a.seed).toBe(1);
    expect(a.faelle).toBe(2);
    expect(a.commit).toMatch(/^[0-9a-f]{7,}$/);
    // Unter der Mindestzahl und mit nicht gemessenen Zielen ist die Messung nie erfüllt
    expect(a.erfuellt).toBe(false);
    expect(a.ziele['projektdatei']).toBe('nicht gemessen');
    expect(a.gruende.join(' ')).toMatch(/Mindestzahl/);
  });

  it('die Zähler sind die der Zählweise Q9 (ZAEHLWEISE-Q9.md)', () => {
    const zw = readFileSync(join(process.cwd(), 'docs/entwicklung/ZAEHLWEISE-Q9.md'), 'utf8');
    for (const name of ['Skript', 'Absturz', 'Datenverlust', 'Netz', 'Fehlende Meldung', 'Hänger']) expect(zw).toContain(`| ${name} |`);
    expect(ZAEHLER).toEqual(['skript', 'absturz', 'datenverlust', 'netz', 'meldung', 'haenger']);
  });

  it('Netzprüfung ohne Browser: 0 Befunde im Stand', () => {
    expect(netzPruefen()).toEqual([]);
  });
});

describe('AF-019 Grenzmessung: Datei mit 10-facher Grenze', () => {
  it(`je teure Art Meldung vor dem Lesen in höchstens ${GRENZ_ZEIT_MS} ms`, async () => {
    const g = await grenzMessen();
    expect(g.map((x) => x.art)).toEqual(GRENZ_ARTEN);
    for (const x of g) {
      expect(x.meldung, x.art).toBe(true);
      expect(x.ms, x.art).toBeLessThanOrEqual(GRENZ_ZEIT_MS);
    }
  });
});
