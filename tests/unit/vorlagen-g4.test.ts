// Vorlagen der Gruppe 4 (D-20 bis D-26, Ergänzungsblätter): IR in allen Modi und Formen ohne fehlende Texte,
// Kit-Kennzeichnung nur in leeren Vorlagen, D-20-Checkliste vollständig, echte DOCX/XLSX-Dateien.
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { renderDocx, renderXlsx } from '../../src/generator/index.ts';
import type { DocxDokument, XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { alleAbschnitte42001, alleControls42001 } from '../../src/kataloge/typen.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { d10 } from '../../src/vorlagen/D-10.ts';
import { d20 } from '../../src/vorlagen/D-20.ts';
import { d21 } from '../../src/vorlagen/D-21.ts';
import { d22 } from '../../src/vorlagen/D-22.ts';
import { d23 } from '../../src/vorlagen/D-23.ts';
import { d24 } from '../../src/vorlagen/D-24.ts';
import { d25 } from '../../src/vorlagen/D-25.ts';
import { d26, d26Register } from '../../src/vorlagen/D-26.ts';
import { ergaenzungsblaetter, ergaenzungsblatt } from '../../src/vorlagen/ergaenzungsblatt.ts';
import type { Form, Modus, Vorlage, VorlagenKontext } from '../../src/vorlagen/kontext.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const kataloge = ladeKataloge();
const u = erstelleUebersetzer('de', ladeTexte('de'));

/** eb: Vorlage unterstützt die Form «ergaenzungsblatt» */
const VORLAGEN_G4: { id: string; vorlage: Vorlage; eb: boolean }[] = [
  { id: 'D-20', vorlage: d20, eb: true },
  { id: 'D-21', vorlage: d21, eb: true },
  { id: 'D-22', vorlage: d22, eb: true },
  { id: 'D-23', vorlage: d23, eb: false },
  { id: 'D-24', vorlage: d24, eb: false },
  { id: 'D-25', vorlage: d25, eb: false },
  { id: 'D-26', vorlage: d26, eb: true },
  { id: 'D-26 Register', vorlage: d26Register, eb: true },
];

function kontext(modus: Modus, form: Form = 'dokument', projekt?: Projekt): VorlagenKontext {
  const p = projekt ?? (modus === 'leer' ? leeresProjekt({ sprache: 'de' }) : vollstaendigesProjekt());
  if (form === 'ergaenzungsblatt' && modus !== 'leer') p.meta.mitIsms = true;
  return { u, modus, form, projekt: p, kataloge, kitVersion: '1.0.0' };
}

function pruefeIr(ir: DocxDokument | XlsxMappe, modus: Modus): string {
  const json = JSON.stringify(ir);
  expect(json).not.toMatch(/undefined/);
  expect(json).not.toMatch(/\[object Object\]/);
  if (modus === 'firma') expect(json).not.toMatch(/kmu-cio/i);
  if (modus === 'leer') expect(json).toMatch(/kmu-cio\.ch/);
  return json;
}

async function rendern(ir: DocxDokument | XlsxMappe): Promise<Record<string, string>> {
  const bytes = 'bloecke' in ir ? await renderDocx(ir) : await renderXlsx(ir);
  const teile: Record<string, string> = {};
  for (const [pfad, inhalt] of Object.entries(unzipSync(bytes))) if (/\.xml$/.test(pfad)) teile[pfad] = strFromU8(inhalt);
  return teile;
}

describe('Vorlagen G4 (de)', () => {
  for (const { id, vorlage, eb } of VORLAGEN_G4) {
    const formen: Form[] = eb ? ['dokument', 'ergaenzungsblatt'] : ['dokument'];
    for (const form of formen) {
      for (const modus of ['leer', 'firma'] as Modus[]) {
        it(`${id} ${modus} ${form}`, async () => {
          const ir = vorlage(kontext(modus, form));
          pruefeIr(ir, modus);
          if (form === 'ergaenzungsblatt') expect(ir.lenkung.dokumentId).toMatch(/-EB$/);
          const teile = await rendern(ir);
          const alles = Object.values(teile).join('\n');
          if (modus === 'firma') expect(alles).not.toMatch(/kmu-cio/i);
          expect(Object.keys(teile).length).toBeGreaterThan(3);
        });
      }
    }
  }

  it('firma mit Name «Test AG» aus leerem Projekt', () => {
    const projekt = leeresProjekt({ sprache: 'de' });
    projekt.organisation.name = 'Test AG';
    for (const { vorlage } of VORLAGEN_G4) pruefeIr(vorlage(kontext('firma', 'dokument', projekt)), 'firma');
  });

  it('D-20 Checkliste enthält alle 27 Abschnitte und 38 Controls', () => {
    const ir = d20(kontext('leer'));
    const blatt = ir.blaetter.find((b) => b.name === u.t('vorlagen.D-20.blaetter.checkliste'))!;
    const bezuege = blatt.zeilen.map((z) => String(z[0]));
    const abschnitte = alleAbschnitte42001(kataloge).map((a) => a.id.replace(/^K-/, ''));
    const controls = alleControls42001(kataloge).map((c) => c.id);
    expect(abschnitte).toHaveLength(27);
    expect(controls).toHaveLength(38);
    expect(bezuege).toEqual([...abschnitte, ...controls]);
    // Jede Zeile hat Titel und Prüffrage
    for (const z of blatt.zeilen) {
      expect(String(z[1]).length).toBeGreaterThan(3);
      expect(String(z[2])).toMatch(/\?|:/);
    }
  });

  it('D-20 Ergänzungsblatt enthält Programm, Checkliste und Stichproben', () => {
    const ir = d20(kontext('leer', 'ergaenzungsblatt'));
    expect(ir.blaetter.map((b) => b.name)).toEqual([u.t('vorlagen.D-20.blaetter.programm'), u.t('vorlagen.D-20.blaetter.checkliste'), u.t('vorlagen.D-20.blaetter.stichproben')]);
  });

  it('D-20 Auditprogramm übernimmt Audits aus dem Projekt', () => {
    const ir = d20(kontext('firma'));
    const programm = ir.blaetter[0]!;
    expect(programm.zeilen.map((z) => String(z[1]))).toEqual([expect.stringContaining('AU-001')]);
  });

  it('D-21 nennt alle Pflichteingaben, ISMS-Punkte nur mit ISMS', () => {
    const ohne = JSON.stringify(d21(kontext('firma')));
    const projekt = vollstaendigesProjekt();
    projekt.meta.mitIsms = true;
    const mit = JSON.stringify(d21(kontext('firma', 'dokument', projekt)));
    // Erste Bewertung: statt der Massnahmen aus früheren Bewertungen der Stand der Massnahmen aus dem Aufbau
    const pflicht = (u.roh('vorlagen.D-21.pflicht') as { punkt: string }[]).map((p) => p.punkt);
    for (const p of pflicht.slice(1)) expect(ohne).toContain(p);
    expect(ohne).not.toContain(pflicht[0]!);
    expect(ohne).toContain((u.roh('vorlagen.D-21.erste_massnahmen') as { punkt: string }).punkt);
    const isms = (u.roh('vorlagen.D-21.isms') as { punkt: string }[])[0]!.punkt;
    expect(ohne).not.toContain(isms);
    expect(mit).toContain(isms);
  });

  it('D-26 Register: Kit-Liste in leeren Vorlagen, Projektdokumente im Firmendokument', () => {
    const leer = d26Register(kontext('leer')).blaetter[0]!;
    const ids = leer.zeilen.map((z) => z[0]);
    for (const d of kataloge.dokumente.dokumente) expect(ids).toContain(d.id);
    const firma = d26Register(kontext('firma')).blaetter[0]!;
    expect(firma.zeilen.map((z) => z[0])).toEqual(vollstaendigesProjekt().dokumente.map((d) => d.id));
  });

  it('D-23 Mapping kennzeichnet die Zuordnung als fachliche Einschätzung', () => {
    const ir = d23(kontext('firma'));
    const mapping = ir.blaetter.find((b) => b.name === u.t('vorlagen.D-23.blaetter.mapping'))!;
    expect(mapping.hinweise?.join(' ')).toContain(u.t('vorlagen.D-23.hinweis_einschaetzung'));
    expect(mapping.zeilen.length).toBeGreaterThanOrEqual(38);
  });

  describe('Ergänzungsblätter', () => {
    const blaetter = ergaenzungsblaetter(kataloge);
    it('Katalog enthält das Blatt zur Informationssicherheitsleitlinie', () => {
      expect(blaetter.map((b) => b.id)).toContain('D-03-EB');
    });
    for (const b of blaetter) {
      for (const modus of ['leer', 'firma'] as Modus[]) {
        it(`${b.id} ${modus}`, async () => {
          const ir = ergaenzungsblatt(kontext(modus, 'ergaenzungsblatt'), b.id);
          const json = pruefeIr(ir, modus);
          expect(ir.lenkung.dokumentId).toBe(b.id);
          for (const a of b.abschnitte) expect(json).toContain(u.t(`ergaenzungsblaetter.blaetter.${b.id}.abschnitte.${a}.titel`));
          await rendern(ir);
        });
      }
    }
  });
});

// AF-104 (A3-15): Datenquellen der Kennzahlen PR-19 (D-22 «Entdeckt», «Eingedämmt» mit Uhrzeit) und PR-07 (D-10
// Freigabeliste «Antrag am», «Entscheid am») als Spalten, gefüllt aus den Feldern der Schemaversion 3; DE und EN
describe('AF-104: Spalten für Entdeckung, Eindämmung, Antrag und Entscheid', () => {
  const projekt = () => {
    const p = vollstaendigesProjekt();
    p.feststellungen.push({ id: 'F-001', quelle: 'vorfall', einstufung: 'nk-leicht', beschreibung: 'Falsche Antwort versendet', normbezug: 'A.8.4', korrektur: 'k', ursache: 'u', massnahmen: [], status: 'geschlossen', datum: '2026-11-03', entdecktAm: '2026-11-03T09:40', eingedaemmtAm: '2026-11-03T15:10' });
    p.kiSysteme[0]!.antragAm = '2026-09-01';
    p.kiSysteme[0]!.entscheidAm = '2026-09-15';
    return p;
  };
  for (const s of ['de', 'en'] as const) {
    const us = erstelleUebersetzer(s, ladeTexte(s));
    const ctx = (modus: Modus, form: Form = 'dokument', p: Projekt = projekt()): VorlagenKontext => ({ u: us, modus, form, projekt: modus === 'leer' ? leeresProjekt({ sprache: s, mitIsms: form === 'ergaenzungsblatt' }) : p, kataloge, kitVersion: '1.0.0' });
    it(`D-22 ${s}: Spalten nach «Schwere», Zeitpunkt mit Uhrzeit; Ergänzungsblatt nennt beide Felder`, () => {
      const sv = us.liste('vorlagen.D-22.spalten_vorfall');
      const schwere = us.liste('vorlagen.D-22.spalten_nk')[8]!;
      const nk = (d22(ctx('firma')) as XlsxMappe).blaetter[0]!;
      const kopf = nk.spalten.map((x) => x.kopf);
      expect(kopf.indexOf(sv[0]!)).toBe(kopf.indexOf(schwere) + 1);
      expect(kopf.indexOf(sv[1]!)).toBe(kopf.indexOf(schwere) + 2);
      const zeile = nk.zeilen.find((z) => z[0] === 'F-001')!;
      expect([zeile[kopf.indexOf(sv[0]!)], zeile[kopf.indexOf(sv[1]!)]]).toEqual(s === 'de' ? ['03.11.2026 09:40', '03.11.2026 15:10'] : ['03/11/2026 09:40', '03/11/2026 15:10']);
      expect((d22(ctx('leer')) as XlsxMappe).blaetter[0]!.spalten.map((x) => x.kopf)).toEqual(expect.arrayContaining(sv));
      const zusatz = (d22(ctx('leer', 'ergaenzungsblatt')) as XlsxMappe).blaetter[0]!;
      expect(zusatz.zeilen.map((z) => z[0])).toEqual(expect.arrayContaining(sv));
    });
    it(`D-10 ${s}: Freigabeliste mit «Antrag am» und «Entscheid am»`, () => {
      const sa = us.liste('vorlagen.D-10.spalten_antrag');
      const fl = (d10(ctx('firma')) as XlsxMappe).blaetter.find((b) => b.name === us.t('vorlagen.D-10.blaetter.freigabe'))!;
      const kopf = fl.spalten.map((x) => x.kopf);
      const z = fl.zeilen.find((x) => x[1] === 'KI-001')!;
      expect([z[kopf.indexOf(sa[0]!)], z[kopf.indexOf(sa[1]!)]]).toEqual(['2026-09-01', '2026-09-15']);
      expect(z.length).toBe(kopf.length);
    });
  }
});
