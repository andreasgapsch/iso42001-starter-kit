// Rahmen ab rc.12 (Nutzertest rc.10, U-14, U-22, U-34): Optionen der Auswahl aus <option>/<optgroup>, Tippsuche,
// Rollen der Spalten in der Kartenansicht, Aufteilung der unteren Leiste und Quelltext ohne <select>.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { h } from 'preact';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const { setzeAppDaten } = await import('../../src/app/daten.ts');
setzeAppDaten({
  texte: { de: ladeTexte('de'), en: ladeTexte('en') }, kataloge: ladeKataloge(), gefuehrt: json('src/generiert/gefuehrt.json'),
  regeln: { regeln: parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')).regeln }, version: '1.0.0', gebaut: '', beispiele: [],
});
const { kinderText, optionenLesen, tippTreffer } = await import('../../src/app/ui/Auswahl.tsx');
const { kartenRollen } = await import('../../src/app/ui/VListe.tsx');
const { leistenBereiche } = await import('../../src/app/rahmen/Rahmen.tsx');

describe('Auswahl (U-22)', () => {
  it('liest <option> und <optgroup> wie <select>, auch in Listen, Fragmenten und mit gesperrten Optionen', () => {
    const { optionen, gruppen } = optionenLesen([
      h('option', { value: '' }, 'alle'),
      h('optgroup', { label: 'Grenze' }, [h('option', { value: 'ueber' }, 'über der Grenze'), h('option', { value: 'offen', disabled: true }, 'Annahme ', 'offen')]),
      [h('option', { value: 7 }, 'KI-', 7)],
      h('option', {}, 'ohne Wert'),
    ]);
    expect(gruppen).toEqual(['Grenze']);
    expect(optionen).toEqual([
      { wert: '', text: 'alle', aus: false },
      { wert: 'ueber', text: 'über der Grenze', aus: false, gruppe: 0 },
      { wert: 'offen', text: 'Annahme offen', aus: true, gruppe: 0 },
      { wert: '7', text: 'KI-7', aus: false },
      { wert: 'ohne Wert', text: 'ohne Wert', aus: false },
    ]);
    expect(kinderText(['a', 1, null, false, h('b', {}, 'c')])).toBe('a1c');
  });

  it('Tippsuche: Anfang des Texts ohne Akzente, gleicher Buchstabe reihum, gesperrte Optionen übersprungen', () => {
    const o = [{ text: 'dunkel' }, { text: 'hell' }, { text: 'Hochrisiko' }, { text: 'Übersicht' }, { text: 'hart', aus: true }, { text: 'wie System' }];
    expect(tippTreffer(o, 'w', 0)).toBe(5);
    expect(tippTreffer(o, 'ho', 0)).toBe(2);
    expect(tippTreffer(o, 'h', 1)).toBe(2);
    expect(tippTreffer(o, 'h', 2)).toBe(1);
    expect(tippTreffer(o, 'hh', 1)).toBe(2);
    expect(tippTreffer(o, 'ub', 0)).toBe(3);
    expect(tippTreffer(o, 'x', 0)).toBe(-1);
  });
});

describe('Kartenansicht der Register (U-14)', () => {
  it('Rollen aus dem Muster der Spalten: ID, Titel (breiteste fr-Spalte), Status oder Stand, übrige Werte', () => {
    const s = (titel: string, breite: string) => ({ titel, breite, wert: () => '' });
    expect(kartenRollen([s('ID', '7ch'), s('Bezeichnung', '3fr'), s('KI-System', '7ch'), s('Wert', '12ch'), s('Status', '1fr')])).toEqual(['id', 'titel', 'wert', 'wert', 'status']);
    expect(kartenRollen([s('ID', '9ch'), s('Bezeichnung', '3fr'), s('Stand', '11ch'), s('Vorschlag', '10ch')])).toEqual(['id', 'titel', 'status', 'wert']);
    expect(kartenRollen([s('ID', '8ch'), s('Art', '2fr'), s('Termin', '12ch')])).toEqual(['id', 'titel', 'wert']);
    expect(kartenRollen([{ ...s('Name', '1fr'), rolle: 'wert' as const }, { ...s('X', '1fr'), rolle: 'titel' as const }])).toEqual(['wert', 'titel']);
  });
});

describe('Untere Leiste (U-14)', () => {
  it('mit Projekt: Start, Guide, Register, Bibliothek in der Leiste, die übrigen sieben unter «Mehr»', () => {
    const { leiste, mehr } = leistenBereiche(true);
    expect([...leiste]).toEqual(['start', 'guide', 'register', 'bibliothek']);
    expect(mehr.map((b) => b.id)).toEqual(['uebersicht', 'prozesse', 'wissen', 'pruefung', 'hinweise', 'hilfe', 'einstellungen']);
  });
  it('ohne Projekt: alle vier sichtbaren Bereiche in der Leiste, «Mehr» leer', () => {
    const { leiste, mehr } = leistenBereiche(false);
    expect([...leiste]).toEqual(['start', 'wissen', 'hilfe', 'einstellungen']);
    expect(mehr).toEqual([]);
  });
});

describe('Quelltext', () => {
  const dateien = (d: string): string[] => readdirSync(d).flatMap((x) => (statSync(join(d, x)).isDirectory() ? dateien(join(d, x)) : [join(d, x)]));
  const app = dateien(join(REPO, 'src/app')).filter((f) => /\.(tsx|ts|html)$/.test(f));

  it('kein <select> in der App (WebKit meldet jedes als CSP-Verletzung), nur ui/Auswahl.tsx', () => {
    const treffer = app.filter((f) => !f.endsWith('Auswahl.tsx') && /<select\b|createElement\(['"]select/.test(readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')));
    expect(treffer).toEqual([]);
  });

  it('jede Ansicht setzt ihren Titel über den Seitenkopf (nur die Druckansicht und der Stage-1-Druck ohne)', () => {
    const h1 = app.filter((f) => /\.tsx$/.test(f) && !f.endsWith('Seitenkopf.tsx') && /<h1\b/.test(readFileSync(f, 'utf8'))).map((f) => f.replace(`${REPO}/`, ''));
    expect(h1.sort()).toEqual(['src/app/ansichten/dokumente/Dokumente.tsx', 'src/app/ansichten/pruefung/Stage1Bericht.tsx']);
  });

  it('Viewport mit viewport-fit=cover, Leiste und Blätter mit Safe-Area-Abständen', () => {
    expect(readFileSync(join(REPO, 'src/app/index.html'), 'utf8')).toMatch(/viewport-fit=cover/);
    const css = readFileSync(join(REPO, 'src/app/stil.css'), 'utf8');
    expect((css.match(/env\(safe-area-inset-bottom/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});
