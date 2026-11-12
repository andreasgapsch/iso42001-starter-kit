// AF-025: Projektdatei wird nur in laden.ts als JSON gelesen; Start.tsx nutzt die gemeinsame Stelle
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ladeProjektText, projektTextParsen } from '../../src/app/import/laden.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = process.cwd();

function dateien(ordner: string, aus: string[] = []): string[] {
  for (const n of readdirSync(ordner)) {
    const p = join(ordner, n);
    if (statSync(p).isDirectory()) dateien(p, aus);
    else if (/\.tsx?$/.test(n)) aus.push(p);
  }
  return aus;
}

describe('AF-025 Projektdatei nur in laden.ts parsen', () => {
  /** Das Muster für JSON.parse mit der BOM-Behandlung des Projektdateitexts: bis zum Zeilenende, weil charCodeAt(0) selbst Klammern enthält */
  const MUSTER = /JSON\.parse\(.*0xfeff/;
  /** Ausnahmen mit Grund: keine mehr. Das Gestaltungspaket läuft seit P8 über das Eingangsmodul (AF-018). */
  const AUSNAHMEN = new Map<string, string>();
  /** Einzige Stelle mit JSON.parse auf Dateitext: das Eingangsmodul (AF-018); laden.ts ruft es für die Projektdatei auf */
  const PARSESTELLE = 'src/eingang/lesen.ts';

  it('das Muster trifft die alten Zeilen aus Start.tsx (Gegenprobe)', () => {
    expect(MUSTER.test("    const roh = JSON.parse(e.text.charCodeAt(0) === 0xfeff ? e.text.slice(1) : e.text) as unknown;")).toBe(true);
    expect(MUSTER.test("    const roh = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) as unknown;")).toBe(true);
    expect(MUSTER.test('const roh = projektTextParsen(text);')).toBe(false);
  });

  it('JSON.parse der Projektdatei ausserhalb des Eingangsmoduls: 0 (alle Dateien unter src/, Ausnahmen mit Grund)', () => {
    const treffer: string[] = [];
    const ausgenommen: string[] = [];
    for (const d of dateien(join(REPO, 'src'))) {
      const rel = d.slice(REPO.length + 1);
      if (rel === PARSESTELLE) continue;
      const trifft = readFileSync(d, 'utf8').split('\n').some((z) => MUSTER.test(z));
      if (!trifft) continue;
      if (AUSNAHMEN.has(rel)) ausgenommen.push(rel);
      else treffer.push(rel);
    }
    expect(treffer).toEqual([]);
    // Die Ausnahme gilt nur, solange sie nötig ist: Verschwindet der Treffer, gehört der Eintrag weg
    expect(ausgenommen).toEqual([...AUSNAHMEN.keys()]);
  });

  it('Start.tsx liest die Projektdatei über projektTextParsen und enthält kein JSON.parse', () => {
    const start = readFileSync(join(REPO, 'src/app/ansichten/start/Start.tsx'), 'utf8');
    expect(start).not.toMatch(/JSON\.parse\(/);
    expect(start.match(/projektTextParsen\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(start).toMatch(/import \{[^}]*projektTextParsen[^}]*\} from '..\/..\/import\/laden\.ts'/);
  });

  it('projektTextParsen entfernt ein BOM und wirft bei ungültigem JSON', () => {
    expect(projektTextParsen('﻿{"a":1}')).toEqual({ a: 1 });
    expect(projektTextParsen('{"a":1}')).toEqual({ a: 1 });
    expect(() => projektTextParsen('{"a":')).toThrow(SyntaxError);
    expect(() => projektTextParsen('')).toThrow(SyntaxError);
  });

  it('projektTextParsen in laden.ts liest über das Eingangsmodul mit der Art Projektdatei', () => {
    const laden = readFileSync(join(REPO, 'src/app/import/laden.ts'), 'utf8');
    expect(laden).not.toMatch(/JSON\.parse\(/);
    expect(laden).toMatch(/export function projektTextParsen\(text: string\): unknown \{\n {2}return jsonLesen\(text, 'projektdatei'\);/);
  });

  it('ladeProjektText nutzt dieselbe Stelle: gleiche Annahme mit und ohne BOM', () => {
    const text = JSON.stringify(vollstaendigesProjekt());
    expect(ladeProjektText(text).ok).toBe(true);
    expect(ladeProjektText(`﻿${text}`).ok).toBe(true);
    const kaputt = ladeProjektText('{"meta":');
    expect(kaputt.ok).toBe(false);
    if (!kaputt.ok) expect(kaputt.art).toBe('kein-json');
  });
});
