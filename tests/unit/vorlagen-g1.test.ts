// Vorlagen Gruppe 1 (D-00, D-01, D-02, D-04, D-05): IR in leer und firma, echte Dateien, falls der Generator vorliegt.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Block, DocxDokument, XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { d00 } from '../../src/vorlagen/D-00.ts';
import { d01 } from '../../src/vorlagen/D-01.ts';
import { d02 } from '../../src/vorlagen/D-02.ts';
import { d04 } from '../../src/vorlagen/D-04.ts';
import { d05 } from '../../src/vorlagen/D-05.ts';
import type { Form, Modus, Vorlage } from '../../src/vorlagen/kontext.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const kataloge = ladeKataloge();
const u = erstelleUebersetzer('de', ladeTexte('de'));

const VORLAGEN_G1: { id: string; fn: Vorlage; format: 'docx' | 'xlsx'; formen: Form[] }[] = [
  { id: 'D-00', fn: d00, format: 'xlsx', formen: ['dokument'] },
  { id: 'D-01', fn: d01, format: 'docx', formen: ['dokument'] },
  { id: 'D-02', fn: d02, format: 'docx', formen: ['dokument'] },
  { id: 'D-04', fn: d04, format: 'docx', formen: ['dokument', 'ergaenzungsblatt'] },
  { id: 'D-05', fn: d05, format: 'xlsx', formen: ['dokument'] },
];

const projektFuer = (modus: Modus, variante: 'leer' | 'voll'): Projekt => {
  if (modus === 'leer') return leeresProjekt({ sprache: 'de' });
  if (variante === 'leer') {
    const p = leeresProjekt({ sprache: 'de' });
    p.organisation.name = 'Test AG';
    return p;
  }
  return vollstaendigesProjekt();
};

const render = (fn: Vorlage, modus: Modus, form: Form, variante: 'leer' | 'voll' = 'voll') =>
  fn({ u, modus, form, projekt: projektFuer(modus, variante), kataloge, kitVersion: '1.0.0' });

const generatorDa = ['docx.ts', 'xlsx.ts'].every((d) => existsSync(fileURLToPath(new URL(`../../src/generator/${d}`, import.meta.url))));

describe.each(VORLAGEN_G1)('$id', ({ id, fn, format, formen }) => {
  for (const form of formen) {
    for (const modus of ['leer', 'firma'] as Modus[]) {
      for (const variante of modus === 'firma' ? (['voll', 'leer'] as const) : (['voll'] as const)) {
        it(`${form} ${modus}${modus === 'firma' ? ` (Projekt ${variante})` : ''}`, () => {
          const ir = render(fn, modus, form, variante);
          const json = JSON.stringify(ir);
          expect(json).not.toMatch(/undefined/);
          expect(json).not.toMatch(/\{(?!r\})\w+\}/); // keine unersetzten Platzhalter aus YAML ({r} ist die Zeile in Formeln)
          expect(json).not.toMatch(/[\u00DF\u2013\u2014]/);
          if (modus === 'firma') expect(json).not.toMatch(/kmu-cio/i);
          if (modus === 'leer') expect(json).toMatch(/kmu-cio\.ch/);
          const bloecke: Block[] = format === 'docx' ? (ir as DocxDokument).bloecke : ((ir as XlsxMappe).hinweisBlock ?? []);
          expect(bloecke.some((b) => b.typ === 'hinweis' && b.art === 'normverweis')).toBe(true);
          if (form === 'ergaenzungsblatt') {
            expect(ir.lenkung.dokumentId).toBe(`${id}-EB`);
            expect(json).toContain(modus === 'leer' ? 'Diese Abschnitte in Ihr bestehendes Dokument aufnehmen' : 'Diese Abschnitte ergänzen das Rollen- und Organisationsdokument');
          }
        });
      }
    }
  }
});

describe('Inhalte', () => {
  it('D-00 enthält alle 27 Normabschnitte und 38 Controls', () => {
    const m = render(d00, 'leer', 'dokument') as XlsxMappe;
    expect(m.blaetter.map((b) => b.name)).toEqual(['Projektauftrag', 'Normabschnitte', 'Controls Anhang A', 'Reifegrade', 'Schnellcheck']);
    const [, abschnitte, controls, reifegrade, schnell] = m.blaetter;
    expect(abschnitte!.zeilen).toHaveLength(27);
    expect(abschnitte!.zeilen[0]![0]).toBe('K-4.1');
    expect(abschnitte!.zeilen[26]![0]).toBe('K-10.2');
    expect(controls!.zeilen).toHaveLength(38);
    expect(reifegrade!.zeilen).toHaveLength(6);
    expect(JSON.stringify(reifegrade)).toMatch(/kein Zertifizierungskriterium/);
    expect(schnell!.zeilen).toHaveLength(15);
    expect(schnell!.ampel).toBeDefined();
    // Spaltenbuchstaben der Formeln passen zur Spaltenreihenfolge
    expect(abschnitte!.spalten[6]!.formel).toContain('F{r}-E{r}');
    expect(schnell!.spalten[4]!.formel).toContain('D{r}');
  });

  it('D-01 firma übernimmt Daten und zeigt Platzhalter nur bei Lücken', () => {
    const p = vollstaendigesProjekt();
    p.organisation.kontext.themen = [{ id: 'TH-001', art: 'extern', kategorie: 'recht', beschreibung: 'DSG', auswirkung: 'Datenschutz prüfen' }];
    p.organisation.kontext.klimawandelRelevant = 'nein';
    p.organisation.kontext.klimawandelBegruendung = 'Geringer Energiebedarf';
    p.parteien = [{ id: 'IP-001', name: 'Kunden', art: 'extern', anforderungen: [{ text: 'NDA', quelle: 'vertrag', adressiert: 'ja', begruendung: 'Vertrag' }] }];
    const json = JSON.stringify(d01({ u, modus: 'firma', form: 'dokument', projekt: p, kataloge, kitVersion: '1.0.0' }));
    expect(json).toContain('Datenschutz prüfen');
    expect(json).toContain('Geringer Energiebedarf');
    expect(json).toContain('Kunden (extern)');
    expect(json).not.toContain('Auswirkung ergänzen');
  });

  it('D-04 Ergänzungsblatt lässt Grundsätze und Freigabe weg', () => {
    const eb = JSON.stringify(render(d04, 'firma', 'ergaenzungsblatt'));
    const dok = JSON.stringify(render(d04, 'firma', 'dokument'));
    expect(dok).toContain('Grundsätze');
    expect(eb).not.toContain('Grundsätze');
    expect(eb).toContain('Meldeweg für Bedenken');
    expect(eb).toContain('Anna Muster');
  });

  it('D-05 firma ersetzt die Vorschläge durch die Ziele des Projekts', () => {
    const m = render(d05, 'firma', 'dokument') as XlsxMappe;
    expect(m.blaetter[0]!.zeilen).toHaveLength(1);
    expect(m.blaetter[0]!.zeilen[0]![1]).toBe('Inventar vollständig');
    const leer = render(d05, 'leer', 'dokument') as XlsxMappe;
    expect(leer.blaetter[0]!.zeilen).toHaveLength(6);
    expect(String(leer.blaetter[0]!.zeilen[0]![1])).toMatch(/^\[.+\]$/);
  });
});

describe.skipIf(!generatorDa)('Dateien', () => {
  for (const { id, fn, format, formen } of VORLAGEN_G1) {
    for (const form of formen) {
      for (const modus of ['leer', 'firma'] as Modus[]) {
        it(`${id} ${form} ${modus} erzeugt ${format.toUpperCase()}`, async () => {
          const gen = await import('../../src/generator/index.ts');
          const ir = render(fn, modus, form);
          const datei = format === 'docx' ? await gen.renderDocx(ir as DocxDokument) : await gen.renderXlsx(ir as XlsxMappe);
          expect(datei.byteLength).toBeGreaterThan(2000);
          // ZIP-Signatur PK
          expect([datei[0], datei[1]]).toEqual([0x50, 0x4b]);
        });
      }
    }
  }
});
