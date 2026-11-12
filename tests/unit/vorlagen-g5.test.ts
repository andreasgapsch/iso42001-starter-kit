// Vorlagen der Gruppe 5 (Modul EU AI Act, E-01 bis E-09): IR in beiden Modi ohne fehlende Texte,
// Kit-Kennzeichnung nur in leeren Vorlagen, Pflichtenmatrix vollständig, Checklistenschlüssel, echte DOCX/XLSX-Dateien.
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { renderDocx, renderXlsx } from '../../src/generator/index.ts';
import type { DocxDokument, XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { e01 } from '../../src/vorlagen/E-01.ts';
import { e02 } from '../../src/vorlagen/E-02.ts';
import { e03 } from '../../src/vorlagen/E-03.ts';
import { e04 } from '../../src/vorlagen/E-04.ts';
import { e05 } from '../../src/vorlagen/E-05.ts';
import { e06 } from '../../src/vorlagen/E-06.ts';
import { e07 } from '../../src/vorlagen/E-07.ts';
import { e08 } from '../../src/vorlagen/E-08.ts';
import { e09 } from '../../src/vorlagen/E-09.ts';
import { seitenSchluessel, type Pflicht, type Stand } from '../../src/vorlagen/E-0x.ts';
import { mitEinleitung, VORLAGEN } from '../../src/vorlagen/index.ts';
import { erstelleHelfer } from '../../src/vorlagen/kontext.ts';
import type { Modus, Vorlage, VorlagenKontext } from '../../src/vorlagen/kontext.ts';
import { kiSystem, vollstaendigesProjekt } from '../fixtures/projekt.ts';

const kataloge = ladeKataloge();
const u = erstelleUebersetzer('de', ladeTexte('de'));
const pflichten = (kataloge['aiact_pflichten'] as { pflichten: Pflicht[] }).pflichten;
const stand = kataloge['aiact_stand'] as Stand;

const VORLAGEN_G5: { id: string; vorlage: Vorlage }[] = [
  { id: 'E-01', vorlage: e01 },
  { id: 'E-02', vorlage: e02 },
  { id: 'E-03', vorlage: e03 },
  { id: 'E-04', vorlage: e04 },
  { id: 'E-05', vorlage: e05 },
  { id: 'E-06', vorlage: e06 },
  { id: 'E-07', vorlage: e07 },
  { id: 'E-08', vorlage: e08 },
  { id: 'E-09', vorlage: e09 },
];

function kontext(modus: Modus, projekt?: Projekt): VorlagenKontext {
  const p = projekt ?? (modus === 'leer' ? leeresProjekt({ sprache: 'de' }) : vollstaendigesProjekt());
  return { u, modus, form: 'dokument', projekt: p, kataloge, kitVersion: '1.0.0' };
}

function pruefeIr(ir: DocxDokument | XlsxMappe, modus: Modus): string {
  const json = JSON.stringify(ir);
  expect(json).not.toMatch(/undefined/);
  expect(json).not.toMatch(/\[object Object\]/);
  expect(json).not.toMatch(/[\u00df\u2013\u2014]/);
  expect(json).not.toMatch(/\{(fs|frist):/);
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

/** Projekt mit Hochrisiko-Systemen: Betreiber (Anhang III Nr. 4a) und Anbieter (Anhang III Nr. 5b) */
function hochrisikoProjekt(): Projekt {
  const p = vollstaendigesProjekt();
  p.kiSysteme.push(
    kiSystem({
      id: 'KI-008', name: 'Bewerbungsvorselektion', typ: 'schatten',
      aiAct: { rollen: ['betreiber'], risikoklasse: 'hochrisiko-anhang-iii', anhangIiiBereich: '4a', transparenz: [], gpai: false, begruendung: 'Anhang III Nr. 4a', juristischGeprueft: true },
    }),
    kiSystem({
      id: 'KI-006', name: 'Ersatzteil-Chatbot', typ: 'eigenbau',
      aiAct: { rollen: ['anbieter'], risikoklasse: 'hochrisiko-anhang-iii', anhangIiiBereich: '5b', transparenz: ['50-1'], gpai: false, begruendung: 'Kreditprüfung', juristischGeprueft: false },
    }),
  );
  p.meta.checklisten['E-05.arbeitnehmende.KI-008'] = { erledigt: true, nachweis: 'Info an Personalkommission', datum: '2026-10-01' };
  p.meta.checklisten['E-08.bevollmaechtigter.KI-006'] = { erledigt: false, nachweis: 'Offerte angefragt' };
  return p;
}

describe('Vorlagen G5 Modul AI Act (de)', () => {
  for (const { id, vorlage } of VORLAGEN_G5) {
    for (const modus of ['leer', 'firma'] as Modus[]) {
      it(`${id} ${modus}`, async () => {
        const ir = vorlage(kontext(modus));
        const json = pruefeIr(ir, modus);
        expect(ir.lenkung.dokumentId).toBe(id);
        // Stand-Datum aus stand.yaml
        expect(json).toContain('27.07.2026');
        const teile = await rendern(ir);
        const alles = Object.values(teile).join('\n');
        if (modus === 'firma') expect(alles).not.toMatch(/kmu-cio/i);
        expect(Object.keys(teile).length).toBeGreaterThan(3);
      });
    }
    it(`${id} firma mit Hochrisiko-Systemen`, async () => {
      const ir = vorlage(kontext('firma', hochrisikoProjekt()));
      pruefeIr(ir, 'firma');
      await rendern(ir);
    });
  }

  it('alle E-Vorlagen sind registriert', () => {
    // VORLAGEN leitet die Verweise in den Pfad der Firma um (index.ts, imPfad); die leere Vorlage bleibt gleich bis auf den
    // Normbezug im Kopf, der wie der Kasten aus dem Normverweis der Vorlage kommt (eine Quelle), und den Block «Wozu, Was tun, Nachweis»
    for (const { id, vorlage } of VORLAGEN_G5) {
      const ctx = kontext('leer', hochrisikoProjekt());
      expect(VORLAGEN[id]!(ctx)).toEqual(mitEinleitung(erstelleHelfer(ctx).normbezugVereinheitlichen(vorlage(ctx)), ctx));
    }
  });

  it('firma mit Name «Test AG» aus leerem Projekt', () => {
    const projekt = leeresProjekt({ sprache: 'de' });
    projekt.organisation.name = 'Test AG';
    for (const { vorlage } of VORLAGEN_G5) pruefeIr(vorlage(kontext('firma', projekt)), 'firma');
  });

  it('E-03 enthält in der leeren Vorlage alle Pflicht-IDs', () => {
    const blatt = e03(kontext('leer')).blaetter[0]!;
    expect(blatt.zeilen.map((z) => z[0])).toEqual(pflichten.map((p) => p.id));
    expect(pflichten.length).toBeGreaterThanOrEqual(70);
  });

  it('E-03 filtert im Firmendokument nach Rollen und Klassen', () => {
    // Testprojekt: ein Betreiber-System mit minimalem Risiko
    const ids = e03(kontext('firma')).blaetter[0]!.zeilen.map((z) => String(z[0]));
    expect(ids).toContain('P-ALLE-01');
    expect(ids).toContain('P-ALLE-02');
    expect(ids).not.toContain('P-ANB-01');
    expect(ids).not.toContain('P-BETR-07');
    const hr = e03(kontext('firma', hochrisikoProjekt())).blaetter[0]!.zeilen.map((z) => String(z[0]));
    expect(hr).toContain('P-BETR-07');
    expect(hr).toContain('P-ANB-19');
    expect(hr).toContain('P-TRANSP-ANB-01');
    expect(hr).not.toContain('P-GPAI-01');
  });

  it('E-03 Abdeckung nennt was das AIMS leistet und was nicht', () => {
    const blatt = e03(kontext('leer')).blaetter[1]!;
    const text = JSON.stringify(blatt.zeilen);
    expect(text).toContain(u.t('vorlagen.E-03.abdeckung.leistet'));
    expect(text).toContain(u.t('vorlagen.E-03.abdeckung.leistet_nicht'));
  });

  // Erwartung geändert (Runde 2, F2-03, F-14): Der Schlüssel in der Datei hatte keine Funktion, H14 liest die Projektdaten
  it('E-05 hat zwölf Absätze, ohne Schlüsselspalte in der Datei', () => {
    const leer = e05(kontext('leer')).blaetter[0]!;
    expect(leer.zeilen).toHaveLength(12);
    expect(String(leer.zeilen[6]![1])).toMatch(/^Art\. 26\(7\), S\. 37$/);
    expect(leer.zeilen[6]).toHaveLength(10);
    expect(JSON.stringify(leer)).not.toContain('E-05.arbeitnehmende');
    // Firmendokument: Eintrag aus dem Checklistenschlüssel, die Spalte mit dem Schlüssel selbst entfällt (N-10)
    const firma = e05(kontext('firma', hochrisikoProjekt())).blaetter[0]!;
    const zeile = firma.zeilen.find((z) => String(z[0]).startsWith('KI-008') && String(z[1]).startsWith('Art. 26(7)'))!;
    expect(zeile).toHaveLength(10);
    expect(zeile[6]).toBe(u.t('allgemein.ja'));
    expect(zeile[7]).toBe('Info an Personalkommission');
  });

  // Erwartung geändert (Runde 2, F2-06): Werkzeughinweis und Schlüssel entfallen auch in der leeren Vorlage, H16 liest die Projektdaten
  it('E-08 ohne Schlüssel für den Bevollmächtigten in der Datei (H16)', () => {
    // Schlüssel nur in der leeren Vorlage; das Firmendokument zeigt den Eintrag ohne Werkzeugangabe (N-10)
    expect(JSON.stringify(e08(kontext('leer')))).not.toContain('E-08.bevollmaechtigter');
    const json = JSON.stringify(e08(kontext('firma', hochrisikoProjekt())));
    expect(json).not.toContain('E-08.bevollmaechtigter.KI-006');
    expect(json).toContain('Offerte angefragt');
    expect(json).toContain(u.t('vorlagen.E-08.aussage_titel'));
  });

  it('E-09 enthält alle Fristen aus stand.yaml', () => {
    const tabelle = e09(kontext('leer')).bloecke.find((b) => b.typ === 'tabelle' && b.zeilen.length === stand.fristen.length);
    expect(tabelle).toBeDefined();
    const json = JSON.stringify(e09(kontext('leer')));
    for (const f of stand.fristen) expect(json).toContain(u.t(`stand.fristen.${f.id}`));
    expect(json).toContain(u.t('vorlagen.E-09.auslegung_titel'));
  });

  it('Fundstellen tragen die Seite aus artikel-seiten.json', () => {
    expect(seitenSchluessel('26(7)')).toBe('art-26');
    expect(seitenSchluessel('Anhang III')).toBe('anhang-iii');
    expect(seitenSchluessel('4a(1)')).toBe('art-4a');
    expect(JSON.stringify(e01(kontext('leer')))).toContain('Art. 25(1), S. 35');
    expect(JSON.stringify(e06(kontext('leer')))).toContain('Art. 27, S. 39');
  });

  it('E-06 prüft die Anwendbarkeit auf Seite 1 vor der Abschätzung', () => {
    const ir = e06(kontext('leer'));
    const umbruch = ir.bloecke.findIndex((b) => b.typ === 'seitenumbruch');
    const fragen = ir.bloecke.findIndex((b) => b.typ === 'tabelle');
    expect(fragen).toBeGreaterThan(-1);
    expect(fragen).toBeLessThan(umbruch);
    // Kredit (Anhang III Nr. 5b) als Betreiber: Abschätzung nötig
    const p = hochrisikoProjekt();
    p.kiSysteme.find((s) => s.id === 'KI-006')!.aiAct.rollen = ['betreiber'];
    const firma = JSON.stringify(e06({ ...kontext('firma', p), kiSystemId: 'KI-006' }));
    expect(firma).toContain('KI-006 Ersatzteil-Chatbot');
  });
});
