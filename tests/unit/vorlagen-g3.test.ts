// Vorlagen D-12 bis D-17 (Betrieb, Daten, Transparenz, Nutzung, Lieferanten, Kompetenz):
// rendern in allen Modi und Formen zu IR und zu echten DOCX-/XLSX-Dateien, ohne fehlende Texte und ohne Kit-Spuren im Firmendokument.
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { renderDocx, renderXlsx } from '../../src/generator/index.ts';
import type { DocxDokument, XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { d12 } from '../../src/vorlagen/D-12.ts';
import { d13 } from '../../src/vorlagen/D-13.ts';
import { d14 } from '../../src/vorlagen/D-14.ts';
import { d15 } from '../../src/vorlagen/D-15.ts';
import { d16, PRUEFFRAGEN } from '../../src/vorlagen/D-16.ts';
import { d17 } from '../../src/vorlagen/D-17.ts';
import type { Form, Modus, Vorlage, VorlagenKontext } from '../../src/vorlagen/kontext.ts';
import { kiSystem, vollstaendigesProjekt } from '../fixtures/projekt.ts';

const kataloge = ladeKataloge();
const sprachen = (['de', 'en'] as const).filter((s) => {
  try { return Object.keys(ladeTexte(s)).length > 0; } catch { return false; }
});

const VORLAGEN: [string, Vorlage, boolean][] = [
  ['D-12', d12, false],
  ['D-13', d13, false],
  ['D-14', d14, true],
  ['D-15', d15, true],
  ['D-16', d16, true],
  ['D-17', d17, true],
];

const istDocx = (ir: DocxDokument | XlsxMappe): ir is DocxDokument => 'bloecke' in ir;

/** Alle XML-Teile eines Pakets als Text */
function paketText(paket: Uint8Array): string {
  return Object.entries(unzipSync(paket))
    .filter(([pfad]) => /\.(xml|rels)$/.test(pfad))
    .map(([, inhalt]) => strFromU8(inhalt))
    .join('\n');
}

describe.each(sprachen)('Vorlagen D-12 bis D-17 %s', (sprache) => {
  const u = erstelleUebersetzer(sprache, ladeTexte(sprache));
  const ctx = (modus: Modus, form: Form, projekt: Projekt): VorlagenKontext => ({ u, modus, form, projekt, kataloge, kitVersion: '1.0.0' });

  for (const [id, vorlage, eb] of VORLAGEN) {
    const formen: Form[] = eb ? ['dokument', 'ergaenzungsblatt'] : ['dokument'];
    for (const form of formen) {
      for (const modus of ['leer', 'firma'] as Modus[]) {
        it.skipIf(sprache === 'en' && u.roh(`vorlagen.${id}`) === undefined)(`${id} ${modus} ${form}`, async () => {
          const projekt = modus === 'leer' ? leeresProjekt({ sprache }) : vollstaendigesProjekt();
          const ir = vorlage(ctx(modus, form, projekt));
          const json = JSON.stringify(ir);
          expect(json).not.toMatch(/undefined/);
          if (modus === 'firma') expect(json).not.toMatch(/kmu-cio/i);
          if (modus === 'leer') expect(json).toMatch(/kmu-cio\.ch/);
          expect(ir.lenkung.dokumentId).toBe(form === 'ergaenzungsblatt' ? `${id}-EB` : id);

          // Echte Datei erzeugen
          const paket = istDocx(ir) ? await renderDocx(ir) : await renderXlsx(ir);
          const xml = paketText(paket);
          expect(xml).toContain(istDocx(ir) ? 'word/document.xml' : 'xl/workbook.xml');
          expect(xml).not.toMatch(/undefined/);
          if (modus === 'firma') expect(xml).not.toMatch(/kmu-cio/i);
        });
      }
    }
  }
});

describe('Inhalte aus dem Projekt (de)', () => {
  const u = erstelleUebersetzer('de', ladeTexte('de'));
  const firma = (projekt: Projekt, form: Form = 'dokument'): VorlagenKontext => ({ u, modus: 'firma', form, projekt, kataloge, kitVersion: '1.0.0' });

  it('D-12 zeigt die Systeme mit Phase und Status', () => {
    const json = JSON.stringify(d12(firma(vollstaendigesProjekt())));
    expect(json).toContain('Copilot');
    expect(json).toContain('Betrieb');
    expect(json).toContain('freigegeben');
  });

  it('D-12 und D-13 lassen die Ausbaustufe weg, wenn nicht entwickelt wird', () => {
    const p = vollstaendigesProjekt();
    p.controls = p.controls.map((c) => (/^A\.(6\.1|6\.2\.[237]|7\.[2356])/.test(c.id) ? { ...c, anwendbar: 'nein' } : c));
    for (const vorlage of [d12, d13]) {
      const ir = vorlage(firma(p)) as DocxDokument;
      expect(ir.bloecke.some((b) => b.typ === 'hinweis' && b.art === 'ausbau')).toBe(false);
      expect(JSON.stringify(ir)).toContain('D-11');
    }
    p.kiSysteme.push(kiSystem({ id: 'KI-002', name: 'Planung', typ: 'eigenbau' }));
    // Die Erklärung zur Anwendbarkeit entscheidet: mit anwendbarem Entwicklungs-Control erscheint Abschnitt 10
    p.controls = p.controls.map((c) => (c.id === 'A.6.1.2' ? { ...c, anwendbar: 'ja' } : c));
    // Mit Entwicklung: Inhalte der Ausbaustufe ja, aber kein Kasten «Ausbaustufe (optional)» im Firmendokument (N-10)
    const mitEntwicklung = d12(firma(p)) as DocxDokument;
    expect(mitEntwicklung.bloecke.some((b) => b.typ === 'hinweis' && b.art === 'ausbau')).toBe(false);
    expect(mitEntwicklung.bloecke.some((b) => b.typ === 'ueberschrift' && b.text.startsWith('10.1 '))).toBe(true);
  });

  it('D-15 ordnet Werkzeuge der Ampel zu', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme.push(kiSystem({ id: 'KI-002', name: 'Gratis-Chatbot', typ: 'schatten', status: 'untersagt' }));
    const json = JSON.stringify(d15(firma(p)));
    expect(json).toContain('Copilot');
    expect(json).toContain('Gratis-Chatbot');
  });

  it('D-14 nennt Systeme mit Transparenzpflicht nur mit Modul', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme[0]!.aiAct.transparenz = ['50-1'];
    expect(JSON.stringify(d14(firma(p)))).toContain('50 Abs. 1');
    p.meta.modulAiAct = false;
    const json = JSON.stringify(d14(firma(p)));
    expect(json).not.toContain('50 Abs. 1');
    expect(json).not.toContain('E-07');
  });

  it('D-16 zeigt je Lieferant eine Antwortspalte mit den Prüfpunkten', () => {
    const p = vollstaendigesProjekt();
    p.lieferanten = [{ id: 'L-001', name: 'Microsoft', leistung: 'M365', pruefstatus: 'geprueft', pruefpunkte: { 'PF-01': 'ja', 'PF-02': 'nein' }, bemerkung: '', naechstePruefung: '2027-06-30' }];
    p.kiSysteme[0]!.lieferant = 'L-001';
    const mappe = d16(firma(p));
    const lieferanten = mappe.blaetter[0]!;
    expect(lieferanten.zeilen[0]).toContain('KI-001 Copilot');
    const fragen = mappe.blaetter[1]!;
    expect(fragen.spalten.map((s) => s.kopf)).toContain('L-001 Microsoft');
    expect(fragen.zeilen).toHaveLength(PRUEFFRAGEN.length);
    expect(fragen.zeilen[0]![4]).toBe('ja');
    expect(fragen.zeilen[1]![4]).toBe('nein');
  });

  it('D-17 übernimmt Kommunikationsplan und lässt Schulungen im Ergänzungsblatt weg', () => {
    const p = vollstaendigesProjekt();
    const mappe = d17(firma(p));
    expect(mappe.blaetter).toHaveLength(4);
    expect(mappe.blaetter[3]!.zeilen[0]).toEqual(['KO-001', 'Leitlinie', 'jährlich', '', 'Kunden', 'Website', 'extern']);
    expect(d17(firma(p, 'ergaenzungsblatt')).blaetter).toHaveLength(3);
  });
});
