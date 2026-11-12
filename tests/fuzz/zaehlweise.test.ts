// AF-029: Zählweise Q9 als Datei mit Definition je Zähler und Regel «Änderung nur mit Begründung»
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FEHLERKLASSEN, klasseVon, OrakelFehler } from './typen.ts';

const text = readFileSync(join(process.cwd(), 'docs/entwicklung/ZAEHLWEISE-Q9.md'), 'utf8');
/** Zähler der Messung (AF-028): Skript, Absturz, Datenverlust, Netz, fehlende Meldung, Hänger */
const ZAEHLER = ['Skript', 'Absturz', 'Datenverlust', 'Netz', 'Fehlende Meldung', 'Hänger'];

describe('AF-029 Zählweise Q9', () => {
  it('definiert jeden Zähler aus AF-028 in einer Tabellenzeile mit Definition, Zählt, Zählt nicht und Messort', () => {
    for (const z of ZAEHLER) {
      const zeile = text.split('\n').find((l) => l.startsWith(`| ${z} |`));
      expect(zeile, `Zeile für ${z}`).toBeDefined();
      const zellen = zeile!.split('|').slice(1, -1).map((c) => c.trim());
      expect(zellen, z).toHaveLength(5);
      expect(zellen.slice(1).every((c) => c.length > 10), `${z}: alle Spalten gefüllt`).toBe(true);
    }
  });

  it('enthält die Kopfdaten Seed, Fallzahl und Commit und die Mindestfallzahlen 50 und 500', () => {
    for (const w of ['Seed', 'Fallzahl', 'Commit', 'Pflichtteil', 'Release-Lauf', '| 50 |', '| 500 |', '77123']) expect(text, w).toContain(w);
  });

  it('enthält die Regel «Änderung nur mit Begründung» und ein Änderungsprotokoll mit Begründung', () => {
    expect(text).toMatch(/## \d+\. Regel: Änderung nur mit Begründung/);
    expect(text).toMatch(/## Änderungsprotokoll/);
    const zeilen = text.slice(text.indexOf('## Änderungsprotokoll')).split('\n').filter((l) => /^\| \d\d\.\d\d\.\d{4} \|/.test(l));
    expect(zeilen.length).toBeGreaterThan(0);
    for (const z of zeilen) expect(z.split('|').slice(2, -1).every((c) => c.trim().length > 10)).toBe(true);
  });

  it('hält die Schreibregeln ein (kein Eszett, keine Gedankenstriche)', () => {
    expect(text).not.toMatch(/\u00df|\u2013|\u2014/);
  });

  it('die Zuordnung der Orakeltexte zu Klassen entspricht der Datei', () => {
    expect(klasseVon('SVG: Gift im bereinigten SVG (Ereignisattribut)')).toBe('skript');
    expect(klasseVon('x: Rohfehler statt Meldung (TypeError: y)')).toBe('absturz');
    expect(klasseVon('ladeProjektText wirft statt Ergebnis zu liefern (x)')).toBe('absturz');
    expect(klasseVon('sicherungEntpacken: Ablehnung ohne Meldung')).toBe('meldung');
    expect(klasseVon('angenommene Datei: Datenverlust in der Rundreise (x)')).toBe('datenverlust');
    expect(klasseVon('reparierte Datei: Ergebnis nicht gültig (x)')).toBe('datenverlust');
    expect(klasseVon('etwas Neues')).toBe('orakel');
    expect(new OrakelFehler('Prüfung vor dem Speichern lehnt eine gültig geladene Datei ab').klasse).toBe('datenverlust');
    expect(FEHLERKLASSEN).toEqual(['skript', 'absturz', 'datenverlust', 'meldung', 'haenger', 'orakel']);
    for (const w of ['Skript', 'Absturz', 'Datenverlust', 'fehlende Meldung', 'Hänger', 'orakel']) expect(text, w).toContain(w);
  });
});
