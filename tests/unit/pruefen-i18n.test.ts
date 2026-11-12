// Tor G4: i18n-Vollständigkeit und Vergleich der Kit-Ordner.
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { flach, platzhalter, pruefeI18n, vergleicheOrdner } from '../../scripts/pruefen/i18n.mts';

const FIX = join(import.meta.dirname, '..', 'fixtures', 'pruefen');

describe('flach und platzhalter', () => {
  it('flacht verschachtelte Objekte und Listen ab', () => {
    const m = flach({ a: { b: 'x', c: ['y', 'z'] }, d: {} }, 'datei', 'f');
    expect([...m.keys()]).toEqual(['datei.a.b', 'datei.a.c.0', 'datei.a.c.1', 'datei.d']);
  });

  it('findet Platzhalter einschliesslich ICU-Plural', () => {
    expect(platzhalter('Hallo {name}, {anzahl, plural, one {# Datei} other {# Dateien}}')).toEqual(['anzahl', 'name']);
    expect(platzhalter(42)).toEqual([]);
  });
});

describe('pruefeI18n', () => {
  const befunde = pruefeI18n(join(FIX, 'i18n', 'de'), join(FIX, 'i18n', 'en'), FIX);
  const texte = befunde.map((b) => b.meldung);

  it('meldet fehlende Schlüssel in beide Richtungen', () => {
    expect(texte).toContain('Schlüssel «app.nur_de» fehlt in EN');
    expect(texte).toContain('Schlüssel «app.nur_en» fehlt in DE');
  });

  it('meldet leere Werte', () => {
    expect(texte.some((t) => t.startsWith('Schlüssel «app.leer» hat einen leeren Wert (DE)'))).toBe(true);
  });

  it('meldet ungleiche Platzhalter, akzeptiert gleiche', () => {
    expect(texte.some((t) => t.includes('«app.gruss»') && t.includes('Platzhalter'))).toBe(true);
    expect(texte.some((t) => t.includes('sub.ui.knopf'))).toBe(false);
  });

  it('meldet genau diese vier Befunde', () => {
    expect(befunde).toHaveLength(4);
    expect(befunde.every((b) => b.tor === 'G4' && b.schwere === 'fehler')).toBe(true);
  });
});

describe('vergleicheOrdner', () => {
  it('meldet ungleiche Dateizahl, Endungen und fehlende Kennungen', () => {
    const b = vergleicheOrdner(join(FIX, 'kit-de'), join(FIX, 'kit-en'), FIX).map((x) => x.meldung);
    expect(b).toContain('ungleiche Dateizahl: kit-de hat 4, kit-en hat 3');
    expect(b.some((m) => m.includes('«.xlsx»'))).toBe(true);
    expect(b).toContain('Dokument D-02 fehlt');
    expect(b).toContain('Dokument E-01 fehlt');
    expect(b).toContain('Dokument D-03 fehlt');
  });

  it('meldet nichts bei gleichen Ordnern', () => {
    expect(vergleicheOrdner(join(FIX, 'kit-de'), join(FIX, 'kit-de'), FIX)).toEqual([]);
  });
});

// V-13 (Designsystem AIMS Nachtblau, D-24, U-28): ein Aktionswort für neue Registereinträge. In den Texten der Oberfläche
// (src/i18n/de ohne die Inhalte des NIST-Katalogs) heisst es «erfassen», nie «anlegen»; ein Projekt darf
// weiterhin angelegt werden (kein Registereintrag).
describe('V-13 Aktionswort «erfassen» für Registereinträge (DE)', () => {
  const DE = join(import.meta.dirname, '..', '..', 'src', 'i18n', 'de');
  const INHALT = new Set(['nist.yaml']);
  const ANLEGEN = /\ban(zu)?legen\b|\bangelegt\b|\b[Ll]egen Sie (ihn|sie|es|den ersten|die erste|das erste|eine|einen|ein) [^.;]*?\ban\b(?! (einem|einer|einen|dem|den|der|die|das)\b)/;
  const dateien = (ordner: string): string[] => readdirSync(ordner, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dateien(join(ordner, e.name)) : e.name.endsWith('.yaml') ? [join(ordner, e.name)] : []));
  it('kein «anlegen» in Aktionstexten für Registereinträge', () => {
    const treffer: string[] = [];
    for (const d of dateien(DE)) {
      if (INHALT.has(basename(d))) continue;
      for (const [k, { wert: v }] of flach(parse(readFileSync(d, 'utf8')), basename(d), d)) {
        if (typeof v !== 'string' || !ANLEGEN.test(v.replace(/(neues )?Projekt (an)?legen|Projekt anlegen|Projekt angelegt/gi, ''))) continue;
        treffer.push(`${k}: ${v}`);
      }
    }
    expect(treffer).toEqual([]);
  });
});
