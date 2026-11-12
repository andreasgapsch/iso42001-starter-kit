// AF-021: Spezifikation je Eingabeart
import { describe, expect, it } from 'vitest';
import { artenOhneSpezifikation, SPEZIFIKATION } from './spezifikation.ts';
import { EINGABEARTEN } from './typen.ts';
import { ZIELE } from './ziele/index.ts';
import { JSON_MAX_TIEFE } from '../../src/app/import/laden.ts';
import { XML_MAX_TIEFE } from '../../src/prozesse/xml.ts';
import { GRENZEN } from '../../src/eingang/grenzen.ts';

describe('AF-021 Spezifikation je Eingabeart', () => {
  it('9 von 9 Arten sind spezifiziert, Arten ohne Spezifikation: 0', () => {
    expect(EINGABEARTEN).toHaveLength(9);
    expect(Object.keys(SPEZIFIKATION).sort()).toEqual([...EINGABEARTEN].sort());
    expect(artenOhneSpezifikation()).toEqual([]);
  });

  it('jede Spezifikation nennt Merkmale, Grösse, Tiefe oder Anzahl und Zeit', () => {
    for (const art of EINGABEARTEN) {
      const s = SPEZIFIKATION[art];
      expect(s.art, art).toBe(art);
      expect(s.merkmale.length, `${art}: Merkmale`).toBeGreaterThanOrEqual(2);
      expect(s.endungen.length, `${art}: Endungen`).toBeGreaterThan(0);
      expect(s.maxBytes, `${art}: Grösse`).toBeGreaterThan(0);
      expect(Object.keys(s.maxAnzahl).length, `${art}: Anzahl`).toBeGreaterThan(0);
      expect(s.maxZeitMs, `${art}: Zeit`).toBeGreaterThan(0);
      expect(s.maxZeitMs, `${art}: Zeit höchstens 5 s (K-SEC-03)`).toBeLessThanOrEqual(5000);
      expect(s.leseort.length, `${art}: Leseort`).toBeGreaterThan(0);
    }
  });

  it('Fuzz-Ziele ohne Spezifikation: 0, Spezifikationen ohne Ziel: 0', () => {
    expect(Object.keys(ZIELE).filter((a) => !(a in SPEZIFIKATION))).toEqual([]);
    expect(EINGABEARTEN.filter((a) => !ZIELE[a])).toEqual([]);
    for (const art of EINGABEARTEN) expect(ZIELE[art].art).toBe(art);
  });

  it('Zahlen, die der Code festlegt, stammen aus dessen Konstanten', () => {
    expect(SPEZIFIKATION.projektdatei.maxBytes).toBe(25 * 1024 * 1024);
    expect(SPEZIFIKATION.sicherung.maxAnzahl['dateien']).toBe(20_000);
    expect(SPEZIFIKATION['svg-logo'].maxAnzahl['elemente']).toBe(20_000);
    expect(SPEZIFIKATION.drawio.maxBytes).toBe(2 * 1024 * 1024);
    // Tiefen aus den exportierten Konstanten des Codes (P8, Nacharbeit P2 Punkt 9)
    expect(SPEZIFIKATION.drawio.maxTiefe).toBe(XML_MAX_TIEFE);
    expect(SPEZIFIKATION.projektdatei.maxTiefe).toBe(JSON_MAX_TIEFE);
    expect(SPEZIFIKATION['ki-ergebnis'].maxTiefe).toBe(JSON_MAX_TIEFE);
    // Grössen aus der Konfiguration des Eingangsmoduls: je Art dieselbe Zahl
    for (const art of EINGABEARTEN) expect(SPEZIFIKATION[art].maxBytes, art).toBe(GRENZEN[art].maxBytes);
  });

  it('Werte, die der Code noch nicht erzwingt, nennen das Paket', () => {
    for (const art of EINGABEARTEN) {
      const s = SPEZIFIKATION[art].sollGrenze;
      if (s) expect(s.paket, art).toMatch(/^P\d+$/);
    }
  });
});
