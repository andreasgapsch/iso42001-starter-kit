// Modul NIST AI RMF: Vorlagen N-01 bis N-04, Zusatz-Controls RMF-xx in D-11, Modulabschnitte in D-09, D-12, D-24, D-25,
// Vorschlagslogik (src/nist-rmf/logik.ts) und Erzeugung im Werkzeug (Worker-Set).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dokumentSet, erzeugeIr } from '../../src/app/worker/set.ts';
import type { DocxDokument, XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { NistKern, RmfControl } from '../../src/kataloge/typen.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import type { Projekt, Sprache } from '../../src/model/typen.ts';
import { istStufe, rmfVorschlaege } from '../../src/nist-rmf/logik.ts';
import { klartext, type Modus } from '../../src/vorlagen/kontext.ts';
import { VORLAGEN } from '../../src/vorlagen/index.ts';
import { kiSystem, vollstaendigesProjekt } from '../fixtures/projekt.ts';

const kataloge = ladeKataloge();
const kern = kataloge.nistrmf_subkategorien as NistKern;
const rmf = (kataloge.nistrmf_rmfControls as { controls: RmfControl[] }).controls;
const texte = { de: ladeTexte('de'), en: ladeTexte('en') };

function erzeuge(id: string, p: Projekt, modus: Modus, sprache: Sprache = 'de', kiSystemId?: string) {
  return VORLAGEN[id]!({ u: erstelleUebersetzer(sprache, texte[sprache]), modus, form: 'dokument', projekt: p, kataloge, kitVersion: '1.0.0', kiSystemId });
}
const zellen = (m: XlsxMappe, blatt = 0) => m.blaetter[blatt]!.zeilen;
const text = (ir: DocxDokument | XlsxMappe): string => JSON.stringify(ir);
const leer = (sprache: Sprache = 'de') => {
  const p = leeresProjekt({ sprache, projektId: 't' });
  p.meta.modulNistRmf = true;
  return p;
};
const mitModul = () => {
  const p = vollstaendigesProjekt();
  p.meta.modulNistRmf = true;
  return p;
};

describe('N-01 bis N-04: leere Vorlagen', () => {
  for (const sprache of ['de', 'en'] as const) {
    it(`${sprache}: Namensnennung, Quellenhinweis «gemeinfrei, eigene Kurztitel» und Ablage der PDFs`, () => {
      for (const id of ['N-01', 'N-02', 'N-03', 'N-04']) {
        const m = erzeuge(id, leer(sprache), 'leer', sprache) as XlsxMappe;
        const block = m.hinweisBlock ?? [];
        expect(block.some((b) => b.typ === 'hinweis' && b.art === 'namensnennung'), id).toBe(true);
        const bezug = block.find((b) => b.typ === 'hinweis' && b.art === 'normverweis' && b.titel);
        const t = bezug && bezug.typ === 'hinweis' ? klartext(bezug.text) : '';
        expect(t, id).toMatch(sprache === 'de' ? /gemeinfrei; eigene Kurztitel/ : /public domain in the United States; own short titles/);
        expect(t, id).toContain('Rechtstexte_Legal-Texts/NIST-AI-RMF');
        expect(t, id).toContain(id === 'N-04' ? '600-1' : '100-1');
      }
    });
  }

  it('N-01 und N-02 enthalten alle 72 Subkategorien mit Fundstelle; N-02 alle 23 Zusatz-Controls; N-04 die 12 Risiken', () => {
    const n01 = zellen(erzeuge('N-01', leer(), 'leer') as XlsxMappe).filter((z) => z[0]);
    expect(n01.map((z) => z[0])).toEqual(kern.subkategorien.map((s) => s.id));
    expect(n01.every((z) => /AI 100-1 S\. \d+; Playbook S\. \d+/.test(String(z[15])))).toBe(true);
    const n02 = erzeuge('N-02', leer(), 'leer') as XlsxMappe;
    expect(zellen(n02).filter((z) => z[0]).length).toBe(72);
    expect(zellen(n02, 1).map((z) => z[0])).toEqual(rmf.map((c) => c.id));
    expect(zellen(erzeuge('N-04', leer(), 'leer') as XlsxMappe).length).toBe(12);
  });

  it('N-02 Blatt «Stand»: Bilanz Norm 31/40/1 und AIMS 60/12/0', () => {
    const stand = zellen(erzeuge('N-02', leer(), 'leer') as XlsxMappe, 2);
    expect(stand.slice(1, 4).map((z) => [z[1], z[2]])).toEqual([[31, 60], [40, 12], [1, 0]]);
  });
});

describe('N-01: Ist aus dem Projekt, Ziel aus dem Profil', () => {
  it('Ist abgeleitet aus Dokumenten und Controls; Profil überschreibt; Lücke = Ziel minus Ist', () => {
    const p = mitModul();
    const s = kern.subkategorien.find((x) => x.id === 'GV-1.3')!;
    // GV-1.3: D-06, D-07, D-08; nur D-07 ist im Fixture freigegeben
    expect(istStufe(p, kataloge, s)).toMatchObject({ stufe: 1, quelle: 'abgeleitet' });
    for (const id of ['D-06', 'D-08']) p.dokumente.push({ id, version: '1.0', status: 'freigegeben', freigabe: { von: 'P-001', am: '2026-10-10' }, ablageort: 'x', giltFuerIsms: false });
    expect(istStufe(p, kataloge, s).stufe).toBe(2);
    p.nistProfil = { 'GV-1.3': { ziel: 3, prioritaet: 'hoch' }, 'GV-1.1': { ist: 3, ziel: 2 } };
    const z = zellen(erzeuge('N-01', p, 'firma') as XlsxMappe);
    const zeile = (id: string) => z.find((x) => x[0] === id)!;
    expect([zeile('GV-1.3')[8], zeile('GV-1.3')[10], zeile('GV-1.3')[11], zeile('GV-1.3')[12]]).toEqual([2, 3, 1, 'hoch']);
    expect([zeile('GV-1.1')[8], zeile('GV-1.1')[11]]).toEqual([3, 0]);
    expect(String(zeile('GV-1.1')[9])).toBe('erfasst im Profil');
  });

  it('Lücke des AIMS ohne umgesetztes Zusatz-Control begrenzt das Ist auf 1', () => {
    const p = mitModul();
    const s = kern.subkategorien.find((x) => x.id === 'MS-2.2')!;
    for (const id of ['D-12', 'D-13']) p.dokumente.push({ id, version: '1.0', status: 'freigegeben', freigabe: { von: 'P-001', am: '2026-10-10' }, ablageort: 'x', giltFuerIsms: false });
    expect(istStufe(p, kataloge, s)).toMatchObject({ stufe: 1, luecke: true });
    p.controls.push({ id: 'RMF-09', rahmenwerk: 'NISTRMF', anwendbar: 'ja', begruendung: 'x', status: 'umgesetzt', nachweise: [], umsetzung: 'N-03', iso27001: [], kiSysteme: [] });
    expect(istStufe(p, kataloge, s)).toMatchObject({ stufe: 2, luecke: false });
  });
});

describe('N-03 und N-04: Firmendokument', () => {
  it('N-03: Rang der Merkmale und Prüfungen aus dem Messkonzept, sonst Kennzahlen des Systems', () => {
    const p = mitModul();
    p.ziele[0]!.kiSysteme = ['KI-001'];
    let m = erzeuge('N-03', p, 'firma') as XlsxMappe;
    expect(zellen(m, 1)[0]!.slice(0, 7)).toEqual(['KI-001', 'Copilot', 'Gültig und zuverlässig', 'Zuverlässigkeit', '', 'Z-001 Anteil erfasst', '100 %']);
    p.kiSysteme[0]!.messkonzept = { merkmale: ['datenschutz', 'gueltig'], zielkonflikte: 'Nutzen vor Datensparsamkeit', pruefungen: [{ merkmal: 'datenschutz', nichtMessbar: 'nur qualitativ' }] };
    m = erzeuge('N-03', p, 'firma') as XlsxMappe;
    const merkmale = zellen(m)[0]!;
    expect([merkmale[2], merkmale[7], merkmale[9]]).toEqual([2, 1, 'Nutzen vor Datensparsamkeit']);
    expect(zellen(m, 1)[0]![8]).toBe('nur qualitativ');
  });

  it('N-04: nur Systeme mit generativ, 12 Zeilen je System, Entscheid zu RMF-Gxx aus der SoA', () => {
    const p = mitModul();
    expect(zellen(erzeuge('N-04', p, 'firma') as XlsxMappe)).toEqual([]);
    p.kiSysteme[0]!.generativ = true;
    p.kiSysteme.push(kiSystem({ id: 'KI-002', name: 'Prognose', typ: 'eigenbau' }));
    p.kiSysteme[0]!.genaiBewertung = { 'gai-konfabulation': { relevant: 'ja', begruendung: 'Offerten', massnahme: 'M-001' } };
    p.controls.push({ id: 'RMF-G01', rahmenwerk: 'NISTRMF', anwendbar: 'ja', begruendung: 'x', status: 'umgesetzt', nachweise: [], umsetzung: '', iso27001: [], kiSysteme: [] });
    const z = zellen(erzeuge('N-04', p, 'firma') as XlsxMappe);
    expect(z).toHaveLength(12);
    expect(z.every((x) => x[0] === 'KI-001')).toBe(true);
    const k = z.find((x) => x[2] === 2)!;
    expect([k[5], k[6], k[7]]).toEqual(['ja', 'Offerten', 'M-001']);
    expect(String(k[8])).toContain('RMF-G01 in die SoA aufgenommen, Stand: umgesetzt');
  });
});

describe('Vorschlagslogik RMF-xx (vorschlag_wenn, voll_wenn)', () => {
  const ids = (p: Projekt, system = 'KI-001') => rmfVorschlaege(p, rmf).filter((v) => v.systeme.includes(system)).map((v) => v.id);
  it('ohne Modul keine Vorschläge; eingekauftes System: allgemeine Controls, keine RMF-Gxx', () => {
    const p = vollstaendigesProjekt();
    expect(rmfVorschlaege(p, rmf)).toEqual([]);
    p.meta.modulNistRmf = true;
    expect(ids(p)).toEqual(['RMF-01', 'RMF-02', 'RMF-03', 'RMF-04', 'RMF-05', 'RMF-06', 'RMF-07', 'RMF-08', 'RMF-09', 'RMF-12', 'RMF-14', 'RMF-16']);
  });
  it('generativ, Eigenbau, Personenbezug (Triage) und Anbieterrolle', () => {
    const p = mitModul();
    p.kiSysteme[0]!.generativ = true;
    expect(ids(p).filter((x) => x.startsWith('RMF-G'))).toEqual(['RMF-G01', 'RMF-G02', 'RMF-G03', 'RMF-G04', 'RMF-G05', 'RMF-G07']);
    p.kiSysteme[0]!.aiAct.rollen = ['anbieter'];
    expect(ids(p)).toEqual(expect.arrayContaining(['RMF-G06', 'RMF-15']));
    p.kiSysteme[0]!.typ = 'eigenbau';
    const v = rmfVorschlaege(p, rmf);
    expect(ids(p)).toEqual(expect.arrayContaining(['RMF-10', 'RMF-11']));
    expect(v.find((x) => x.id === 'RMF-09')!.voll).toEqual(['KI-001']);
    expect(ids(p)).not.toContain('RMF-13');
    p.folgenabschaetzungen.push({ id: 'IA-001', kiSystem: 'KI-001', triage: { rechtspositionOderChancen: true, gesundheitOderSicherheit: false, verletzlicheGruppen: false, besondereDaten: false, automatisierteEntscheidung: false, grosseReichweite: false, ergebnis: 'voll', begruendung: '' }, systembeschreibung: '', verwendungen: '', fehlanwendungen: '', daten: '', einsatzumfeld: '', betroffene: [], nutzenSchaden: {}, ausfaelle: '', massnahmen: '', sensibleNutzung: true, eingeschraenkteNutzung: false, ergebnis: '' });
    expect(ids(p)).toContain('RMF-13');
  });
});

describe('D-11: Zusatz-Controls RMF-xx', () => {
  it('leer mit Modul: alle 23; ohne Modul keine', () => {
    const z = zellen(erzeuge('D-11', leer(), 'leer') as XlsxMappe).map((x) => x[0]);
    for (const c of rmf) expect(z).toContain(c.id);
    expect(JSON.stringify(zellen(erzeuge('D-11', leeresProjekt({ projektId: 't' }), 'leer') as XlsxMappe))).not.toContain('RMF-');
  });
  it('Firmendokument: nur erfasste RMF-Controls, Sammelzeilen «vorgeschlagen, offen» und «nicht zutreffend»; Auswertung NISTRMF', () => {
    const p = mitModul();
    p.controls.push({ id: 'RMF-01', rahmenwerk: 'NISTRMF', anwendbar: 'ja', begruendung: 'Lücke', status: 'umgesetzt', nachweise: [], umsetzung: 'N-03', iso27001: [], kiSysteme: [] });
    const m = erzeuge('D-11', p, 'firma') as XlsxMappe;
    const z = zellen(m);
    expect(z.filter((x) => /^RMF-/.test(String(x[0]))).map((x) => x[0])).toEqual(['RMF-01']);
    const sammel = z.filter((x) => x[0] === '' && /RMF-/.test(String(x[1]))).map((x) => String(x[1]));
    expect(sammel[0]).toMatch(/^Für unsere KI-Systeme vorgeschlagen, Entscheid offen: RMF-02, /);
    expect(sammel[1]).toMatch(/^Nicht aufgenommen, .*RMF-10, RMF-11, RMF-13, RMF-15, RMF-G01/);
    expect(zellen(m, 1).some((x) => x[1] === 'NISTRMF')).toBe(true);
  });
});

describe('Modulabschnitte in D-09, D-12, D-24, D-25', () => {
  it('nur mit Modul (Firmendokument), in der leeren Vorlage mit Kennzeichnung', () => {
    const p = vollstaendigesProjekt();
    const docs = (q: Projekt, modus: Modus) => ['D-09', 'D-12', 'D-24', 'D-25'].map((id) => text(erzeuge(id, q, modus, 'de', 'KI-001')));
    for (const t of docs(p, 'firma')) expect(t).not.toMatch(/NIST|N-0[1-4]|RMF-/);
    p.meta.modulNistRmf = true;
    for (const t of docs(p, 'firma')) expect(t).toMatch(/NIST AI RMF/);
    for (const t of docs(leeresProjekt({ projektId: 't' }), 'leer')) expect(t).toContain('Nur mit Modul NIST AI RMF');
  });
  it('D-25: Zertifizierung ohne NIST, Zusatz-Controls RMF getrennt gezählt', () => {
    const p = mitModul();
    p.controls.push({ id: 'RMF-01', rahmenwerk: 'NISTRMF', anwendbar: 'ja', begruendung: 'x', status: 'geplant', nachweise: [], umsetzung: '', iso27001: [], kiSysteme: [] });
    const t = text(erzeuge('D-25', p, 'firma'));
    expect(t).toContain('38 von 38 Controls umgesetzt; 0 von 1 Zusatz-Controls NIST AI RMF');
    expect(t).toContain('NIST zertifiziert nicht');
  });
  it('D-09: Rangfolge der Vertrauensmerkmale aus dem Messkonzept', () => {
    const p = mitModul();
    p.kiSysteme[0]!.messkonzept = { merkmale: ['gueltig', 'datenschutz'], zielkonflikte: 'Genauigkeit vor Erklärbarkeit.' };
    expect(text(erzeuge('D-09', p, 'firma', 'de', 'KI-001'))).toContain('Wichtigste Vertrauensmerkmale: Gültig und zuverlässig, Datenschutzfördernd. Zielkonflikte: Genauigkeit vor Erklärbarkeit. Prüfungen');
  });
});

describe('Werkzeug: Generator-Set', () => {
  it('N-01 bis N-04 nur mit Modul; Erzeugung im Modus firma ohne undefined', () => {
    const p = vollstaendigesProjekt();
    expect(dokumentSet(p, kataloge, 'de').dateien.some((d) => d.id.startsWith('N-'))).toBe(false);
    p.meta.modulNistRmf = true;
    const set = dokumentSet(p, kataloge, 'en').dateien.filter((d) => d.id.startsWith('N-'));
    expect(set.map((d) => d.dateiname)).toEqual(['N-01_AI-RMF-Profile.xlsx', 'N-02_Coverage-AI-RMF-42001.xlsx', 'N-03_Measurement-and-Test-Plan.xlsx', 'N-04_Generative-AI-Risks.xlsx']);
    for (const e of set) expect(JSON.stringify(erzeugeIr(e, p, texte.en, kataloge, 'en', '1.0.0'))).not.toMatch(/undefined|\[object Object\]/);
  });
  it('Beispielprojekte mit eingeschaltetem Modul erzeugen alle Dokumente', () => {
    for (const datei of ['muster-maschinenbau.de', 'praezisionsteile.en']) {
      const p = JSON.parse(readFileSync(`src/beispiele/${datei}.aims.json`, 'utf8')) as Projekt;
      p.meta.modulNistRmf = true;
      const s = p.meta.dokumentSprache;
      for (const e of dokumentSet(p, kataloge, s).dateien) expect(JSON.stringify(erzeugeIr(e, p, texte[s], kataloge, s, '1.0.0')), e.dateiname).not.toMatch(/undefined|\[object Object\]/);
    }
  });
});
