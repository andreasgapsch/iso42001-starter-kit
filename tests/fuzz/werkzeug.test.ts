// AF-024: Zufallsgenerator, Determinismus, Wächter, Meldungstext
import { describe, expect, it } from 'vitest';
import { erzeugeFall, fallListe, fehlerText, STANDARD_SEED, wiederholBefehl } from './kern.ts';
import { laufeZiel } from './lauf.ts';
import { Zufall, fallZufall, seedAus } from './zufall.ts';
import { EINGABEARTEN } from './typen.ts';
import { istRohfehler, svgGift } from './ziele/hilfen.ts';

describe('AF-024 eigener Zufallsgenerator', () => {
  it('gleicher Seed ergibt dieselbe Folge, anderer Seed eine andere', () => {
    const a = new Zufall(77123);
    const b = new Zufall(77123);
    const c = new Zufall(77124);
    const fa = Array.from({ length: 20 }, () => a.naechste());
    expect(Array.from({ length: 20 }, () => b.naechste())).toEqual(fa);
    expect(Array.from({ length: 20 }, () => c.naechste())).not.toEqual(fa);
    expect(fa.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('Folge ist fest (Regressionswert gegen stilles Ändern des Generators)', () => {
    const z = new Zufall(77123);
    expect([z.ganz(1000), z.ganz(1000), z.ganz(1000)]).toEqual([622, 266, 662]);
    expect(seedAus(77123, 'drawio', 1)).toBe(895590556);
  });

  it('Fall hängt nur von Seed, Ziel und Nummer ab', () => {
    expect(fallZufall(1, 'x', 5).naechste()).toBe(fallZufall(1, 'x', 5).naechste());
    expect(fallZufall(1, 'x', 5).naechste()).not.toBe(fallZufall(1, 'x', 6).naechste());
    expect(seedAus('a', 1)).toBe(seedAus('a', 1));
  });
});

describe('AF-024 gleicher Seed ergibt gleiche Fallliste', () => {
  for (const art of EINGABEARTEN) {
    it(`${art}: Abweichungen 0`, () => {
      const a = fallListe(art, STANDARD_SEED, 20);
      const b = fallListe(art, STANDARD_SEED, 20);
      expect(b).toEqual(a);
      expect(new Set(a.map((f) => f.hash)).size, 'Fälle sind verschieden').toBeGreaterThan(10);
      expect(fallListe(art, STANDARD_SEED + 1, 20).map((f) => f.hash)).not.toEqual(a.map((f) => f.hash));
    });
  }

  it('Arbeiter (anderer Thread, frisch geladene Module) erzeugt dieselben Fälle wie der Hauptthread: Abweichungen 0', async () => {
    for (const art of EINGABEARTEN) {
      const r = await laufeZiel({ art, seed: STANDARD_SEED, faelle: 12 });
      expect(r.hashes, art).toEqual(fallListe(art, STANDARD_SEED, 12).map((f) => f.hash));
    }
  }, 240_000);

  it('Fall n lässt sich ohne die davor liegenden erzeugen', () => {
    const liste = fallListe('svg-logo', STANDARD_SEED, 12);
    const f = erzeugeFall('svg-logo', STANDARD_SEED, 12);
    expect(f.name).toBe(liste[11]!.name);
  });
});

describe('AF-024 Meldung und Wiederholbefehl', () => {
  it('jede Fehlermeldung nennt Seed und Wiederholbefehl', () => {
    const t = fehlerText('drawio', 77123, { nummer: 17, name: 'haenger', status: 'fehler', meldung: 'x' });
    expect(t).toContain('Seed 77123');
    expect(t).toContain('npm run fuzz -- --ziel drawio --seed 77123 --fall 17');
    expect(wiederholBefehl('normpaket', 5, 3)).toBe('npm run fuzz -- --ziel normpaket --seed 5 --fall 3');
  });
});

describe('AF-024 Wächter: Zeitlimit je Fall, Speichergrenze, Rohfehler', () => {
  it('ein Hänger wird nach dem Zeitlimit beendet, der Lauf geht weiter', async () => {
    const t0 = Date.now();
    const r = await laufeZiel({ art: 'selbsttest-haenger', seed: 1, faelle: 4, zeitlimitMs: 800 });
    expect(r.faelle).toBe(4);
    expect(r.haenger).toBe(1);
    expect(r.angenommen).toBe(3);
    const h = r.fehlerFaelle[0]!;
    expect(h.nummer).toBe(2);
    expect(h.text).toContain('Seed 1');
    expect(h.text).toContain('--fall 2');
    expect(Date.now() - t0).toBeLessThan(60_000);
  }, 90_000);

  it('ein Speicherabbruch wird als Fehler gezählt, der Lauf geht weiter', async () => {
    const r = await laufeZiel({ art: 'selbsttest-speicher', seed: 1, faelle: 4, speicherMb: 192 });
    expect(r.faelle).toBe(4);
    expect(r.fehler).toBe(1);
    expect(r.fehlerFaelle[0]!.nummer).toBe(3);
    expect(r.fehlerFaelle[0]!.meldung).toMatch(/Speicher/);
  }, 90_000);

  it('ein Rohfehler und eine Ablehnung ohne Meldung sind Fehler, eine Ablehnung mit Meldung nicht', async () => {
    const r = await laufeZiel({ art: 'selbsttest-rohfehler', seed: 1, faelle: 6 });
    expect(r.abgelehnt).toBe(4);
    expect(r.fehler).toBe(2);
    expect(r.fehlerFaelle.map((f) => f.nummer)).toEqual([4, 5]);
    expect(r.fehlerFaelle[0]!.meldung).toMatch(/Rohfehler/);
    expect(r.fehlerFaelle[1]!.meldung).toMatch(/ohne Meldung/);
  }, 90_000);
});

describe('AF-024 Orakel schlagen bei echtem Gift und Rohfehlern an (Gegenprobe)', () => {
  const kopf = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">';
  it('svgGift erkennt Skript, Ereignis, fremden Verweis, url( und DTD, lässt sauberes SVG durch', () => {
    expect(svgGift(`${kopf}<rect width="5" height="5" fill="#0a5"/></svg>`)).toBeUndefined();
    expect(svgGift(`${kopf}<script>alert(1)</script></svg>`)).toMatch(/Element/);
    expect(svgGift(`${kopf}<rect onload="x()"/></svg>`)).toMatch(/Ereignis/);
    expect(svgGift(`${kopf}<a href="https://example.org/"><rect/></a></svg>`)).toMatch(/Verweis/);
    expect(svgGift(`${kopf}<rect fill="url(https://example.org/a"/></svg>`)).toBeDefined();
    expect(svgGift(`<!DOCTYPE svg [<!ENTITY a "b">]>${kopf}</svg>`)).toMatch(/DOCTYPE/);
    expect(svgGift(`${kopf}<rect fill="javascript:x"/></svg>`)).toMatch(/aktiver/);
  });

  it('istRohfehler trennt Systemfehler von Meldungen der App', () => {
    expect(istRohfehler(new TypeError('x'))).toBe(true);
    expect(istRohfehler(new RangeError('x'))).toBe(true);
    expect(istRohfehler(new SyntaxError('x'))).toBe(true);
    expect(istRohfehler(new Error('Datei zu gross'))).toBe(false);
  });
});
