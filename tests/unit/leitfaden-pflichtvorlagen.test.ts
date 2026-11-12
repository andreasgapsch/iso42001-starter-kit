// Pflichtvorlagen im Leitfaden und in D-25 (AF-103, QK-55; A3-14): Schritt 2 beschreibt den Weg ohne Werkzeug für D-27,
// jede Pflichtvorlage steht in beiden Zeitplänen und im Freigabekalender (Kapitel 4), D-25 Abschnitt 1 nennt D-27. DE und EN.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { DocxDokument, Text } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import { d25 } from '../../src/vorlagen/D-25.ts';

const SPRACHEN = ['de', 'en'] as const;
type Sprache = (typeof SPRACHEN)[number];
const lies = (pfad: string) => readFileSync(join('src', pfad), 'utf8');
const PFLICHT = (parse(lies('kataloge/dokumente.yaml')) as { dokumente: { id: string; art: string }[] }).dokumente.filter((d) => d.art === 'pflicht').map((d) => d.id);
const UEBERSCHRIFTEN: Record<Sprache, { mit: string; ohne: string; kalender: string; schritt2: string; ohneWerkzeug: string }> = {
  de: { mit: '## 90 Tage mit ISMS', ohne: '## Rund 150 Tage ohne ISMS', kalender: '## Freigabekalender', schritt2: '## Schritt 2:', ohneWerkzeug: '**Ohne Werkzeug.**' },
  en: { mit: '## 90 days with ISMS', ohne: '## About 150 days without ISMS', kalender: '## Approval calendar', schritt2: '## Step 2:', ohneWerkzeug: '**Without the tool.**' },
};

/** Abschnitt ab einer Überschrift bis zur nächsten Überschrift derselben Ebene */
function abschnitt(md: string, kopf: string): string {
  const start = md.indexOf(kopf);
  expect(start, kopf).toBeGreaterThanOrEqual(0);
  const ende = md.indexOf('\n## ', start + kopf.length);
  return md.slice(start, ende < 0 ? undefined : ende);
}
/** Genannte Dokument-IDs, Bereiche «D-12 bis D-17» und «D-12 to D-17» aufgelöst */
function genannt(text: string): Set<string> {
  const ids = new Set<string>(text.match(/\b[DE]-\d{2}\b/g) ?? []);
  for (const m of text.matchAll(/\bD-(\d{2}) (?:bis|to) D-(\d{2})\b/g))
    for (let n = Number(m[1]); n <= Number(m[2]); n++) ids.add(`D-${String(n).padStart(2, '0')}`);
  return ids;
}
const fehlend = (text: string) => PFLICHT.filter((id) => !genannt(text).has(id));

describe('Pflichtvorlagen in Zeitplan und Freigabekalender', () => {
  it('Pflichtvorlagen laut Dokumentenregister: D-00 bis D-17, D-20 bis D-22, D-26, D-27', () => {
    expect(PFLICHT).toContain('D-27');
    expect(PFLICHT.length).toBe(23);
  });

  for (const s of SPRACHEN) {
    const md = lies(`leitfaden/${s}/04-zeitplaene.md`);
    const h = UEBERSCHRIFTEN[s];
    it(`${s}: Pflichtvorlagen ohne Nennung im Zeitplan mit ISMS, ohne ISMS und im Freigabekalender: 0`, () => {
      expect(fehlend(abschnitt(md, h.mit)), 'mit ISMS').toEqual([]);
      expect(fehlend(abschnitt(md, h.ohne)), 'ohne ISMS').toEqual([]);
      expect(fehlend(abschnitt(md, h.kalender)), 'Freigabekalender').toEqual([]);
    });

    it(`${s}: D-27 steht im Freigabekalender in einer Zeile der Geschäftsleitung`, () => {
      const zeilen = abschnitt(md, h.kalender).split('\n').filter((z) => /^\| \d+ \| \d+ \|/.test(z));
      expect(zeilen.filter((z) => genannt(z).has('D-27')).length).toBe(1);
    });

    it(`${s}: Schritt 2 nennt D-27 und beschreibt den Weg ohne Werkzeug`, () => {
      const schritt = abschnitt(lies(`leitfaden/${s}/03-zehn-schritte.md`), h.schritt2);
      expect(schritt).toContain('D-27');
      const ohne = schritt.split('\n').find((z) => z.includes(h.ohneWerkzeug));
      expect(ohne, h.ohneWerkzeug).toBeDefined();
      for (const id of ['D-27', 'D-04', 'D-05', 'D-11', 'PS-02', 'PS-04', 'PS-06']) expect(ohne, id).toContain(id);
    });
  }

  it('Steckbrief Schritt 2: D-27 als weitere Vorlage', () => {
    const schritte = (parse(lies('leitfaden/schritte.yaml')) as { schritte: { nr: number; vorlagen_zusatz: string[] }[] }).schritte;
    expect(schritte.find((x) => x.nr === 2)!.vorlagen_zusatz).toContain('D-27');
  });

  it('App-Freigabekalender: D-27 mit den Richtlinien und Verfahren wie im Leitfaden', () => {
    const f = (parse(lies('gefuehrt/etappen.yaml')) as { fahrplan: { freigaben: { id: string; vorlagen: Record<string, string[]> }[] } }).fahrplan.freigaben;
    const r = f.find((x) => x.id === 'richtlinien')!;
    expect(r.vorlagen['mit_isms']).toContain('D-27');
    expect(r.vorlagen['ohne_isms']).toContain('D-27');
  });
});

describe('D-25 Abschnitt 1 nennt D-27', () => {
  const kataloge = ladeKataloge();
  const text = (t: Text) => (typeof t === 'string' ? t : t.map((l) => l.text).join(''));
  for (const s of SPRACHEN)
    for (const mitIsms of [false, true])
      it(`${s}, leere Vorlage ${mitIsms ? 'mit' : 'ohne'} ISMS: Nachweise der Voraussetzungen umfassen D-00 bis D-17, D-26 und D-27`, () => {
        const u = erstelleUebersetzer(s, ladeTexte(s));
        const projekt = leeresProjekt({ sprache: s, mitIsms, jetzt: '2027-01-01T00:00:00.000Z', projektId: 'd25' });
        const d = d25({ u, modus: 'leer', form: 'dokument', projekt, kataloge, kitVersion: '1.0.0' }) as DocxDokument;
        const i = d.bloecke.findIndex((b) => b.typ === 'ueberschrift' && b.ebene === 1);
        const tabelle = d.bloecke.slice(i).find((b) => b.typ === 'tabelle');
        expect(tabelle?.typ).toBe('tabelle');
        const inhalt = tabelle!.typ === 'tabelle' ? tabelle!.zeilen.flat().map(text).join(' ') : '';
        const ids = genannt(inhalt);
        for (const id of [...PFLICHT.filter((x) => x <= 'D-17'), 'D-26', 'D-27']) expect(ids.has(id), id).toBe(true);
      });
});
