// Prüft src/ai-act/artikel-seiten.json (Spike S8, Tor G17): Vollständigkeit und Stichproben.
// Läuft ohne PDFs, nur gegen die erzeugte JSON.
import { describe, expect, it } from 'vitest';
import daten from '../../src/ai-act/artikel-seiten.json' with { type: 'json' };
import { erwarteteSchluessel, findeUeberschriften } from '../../scripts/pdf-seiten.mts';

type Tabelle = Record<string, number>;
const json = daten as unknown as { stand: string; quelle: { de: string; en: string }; de: Tabelle; en: Tabelle; seitenzahl?: { de: number; en: number } };

// Referenzwerte aus einer unabhängigen Lesung (Seitenmarke = PDF-Seite)
const REFERENZ_EN: Tabelle = {
  'art-1': 2, 'art-3': 5, 'art-4': 11, 'art-4a': 12, 'art-5': 13, 'art-6': 17, 'art-9': 21, 'art-10': 22,
  'art-11': 24, 'art-13': 25, 'art-14': 26, 'art-16': 28, 'art-17': 29, 'art-22': 32, 'art-25': 35, 'art-26': 37,
  'art-27': 39, 'art-43': 52, 'art-47': 57, 'art-49': 58, 'art-50': 59, 'art-53': 62, 'art-72': 87, 'art-73': 88,
  'art-86': 108, 'art-99': 115, 'art-111': 124, 'art-113': 127,
  'anhang-i': 128, 'anhang-iii': 131, 'anhang-iv': 134, 'anhang-viii': 141, 'anhang-xiv': 150,
};
const REFERENZ_DE: Tabelle = {
  'art-4': 11, 'art-5': 13, 'art-6': 17, 'art-22': 32, 'art-25': 35, 'art-26': 37, 'art-27': 39, 'art-50': 59,
  'art-113': 127, 'anhang-i': 128, 'anhang-iii': 131,
};

describe('artikel-seiten.json', () => {
  it('hat Stand und Quellnamen', () => {
    expect(json.stand).toBe('2026-07-27');
    expect(json.quelle.de).toMatch(/_DE\.pdf$/);
    expect(json.quelle.en).toMatch(/_EN\.pdf$/);
  });

  it('erwartet 113 Artikel, 6 Einfügungen und 14 Anhänge', () => {
    const s = erwarteteSchluessel();
    expect(s.filter((k) => /^art-\d+$/.test(k))).toHaveLength(113);
    expect(s.filter((k) => /^art-\d+[a-z]$/.test(k))).toEqual(['art-4a', 'art-60a', 'art-75a', 'art-75b', 'art-75c', 'art-75d']);
    expect(s.filter((k) => k.startsWith('anhang-'))).toHaveLength(14);
  });

  for (const sprache of ['de', 'en'] as const) {
    describe(sprache.toUpperCase(), () => {
      const tabelle = json[sprache];

      it('ist vollständig und enthält keine fremden Schlüssel', () => {
        expect(Object.keys(tabelle).sort()).toEqual([...erwarteteSchluessel()].sort());
      });

      it('hat aufsteigende Seiten in Dokumentreihenfolge', () => {
        const seiten = erwarteteSchluessel().map((k) => tabelle[k]!);
        for (let i = 1; i < seiten.length; i++) expect(seiten[i]).toBeGreaterThanOrEqual(seiten[i - 1]!);
        const max = json.seitenzahl?.[sprache] ?? 151;
        for (const s of seiten) {
          expect(Number.isInteger(s)).toBe(true);
          expect(s).toBeGreaterThanOrEqual(1);
          expect(s).toBeLessThanOrEqual(max);
        }
      });

      const referenz = sprache === 'de' ? REFERENZ_DE : REFERENZ_EN;
      it.each(Object.entries(referenz))('%s steht auf Seite %i', (schluessel, seite) => {
        expect(tabelle[schluessel]).toBe(seite);
      });
    });
  }
});

describe('findeUeberschriften (synthetische Seiten)', () => {
  it('zählt nur alleinstehende Überschriften mit Titelzeile, nicht Verweise', () => {
    const seiten = [
      'Kopf\n                 Artikel 1\n        Erfundener Titel eins\nText mit Verweis gemäss\n  Artikel 2\nund weiter im Satz.\n',
      '0000R0000 Kopfzeile\n\n                 Artikel 2\n        Erfundener Titel zwei\n',
    ];
    const r = findeUeberschriften(seiten, 'de');
    expect(r.seiten['art-1']).toBe(1);
    expect(r.seiten['art-2']).toBe(2);
    expect(r.fehlend[0]).toBe('art-3');
  });

  it('findet den Titel auch auf der Folgeseite', () => {
    const seiten = ['Text\n          Article 1\n', '0000R0000 header\n▼M1\n      Invented title\n'];
    expect(findeUeberschriften(seiten, 'en').seiten['art-1']).toBe(1);
  });
});
