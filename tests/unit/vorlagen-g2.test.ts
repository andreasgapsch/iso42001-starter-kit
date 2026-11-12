// Vorlagen Gruppe 2 (D-06, D-08, D-09, D-10, D-11): Rendern in allen Modi ohne fehlende Texte,
// Kit-Kennung nur in leeren Vorlagen, SoA mit allen 38 Controls, AI-Act-Abschnitt nur mit Modul.
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { renderDocx, renderXlsx } from '../../src/generator/index.ts';
import type { DocxDokument, XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import type { Folgenabschaetzung, Projekt } from '../../src/model/typen.ts';
import { d06 } from '../../src/vorlagen/D-06.ts';
import { d08 } from '../../src/vorlagen/D-08.ts';
import { d09 } from '../../src/vorlagen/D-09.ts';
import { d10 } from '../../src/vorlagen/D-10.ts';
import { d11 } from '../../src/vorlagen/D-11.ts';
import type { Form, Modus, Vorlage } from '../../src/vorlagen/kontext.ts';
import { CONTROLS_42001, vollstaendigesProjekt } from '../fixtures/projekt.ts';

const kataloge = ladeKataloge();
const u = erstelleUebersetzer('de', ladeTexte('de'));

const VORLAGEN: { id: string; vorlage: Vorlage; formen: Form[]; kiSystemId?: string }[] = [
  { id: 'D-06', vorlage: d06, formen: ['dokument', 'ergaenzungsblatt'] },
  { id: 'D-08', vorlage: d08, formen: ['dokument'] },
  { id: 'D-09', vorlage: d09, formen: ['dokument'] },
  { id: 'D-09', vorlage: d09, formen: ['dokument'], kiSystemId: 'KI-001' },
  { id: 'D-10', vorlage: d10, formen: ['dokument', 'ergaenzungsblatt'] },
  { id: 'D-11', vorlage: d11, formen: ['dokument'] },
];

function rendern(vorlage: Vorlage, modus: Modus, projekt: Projekt, form: Form = 'dokument', kiSystemId?: string) {
  return vorlage({ u, modus, form, projekt, kataloge, kitVersion: '1.0.0', kiSystemId });
}

function istDocx(ir: DocxDokument | XlsxMappe): ir is DocxDokument {
  return 'bloecke' in ir;
}

/** XML-Teile des erzeugten Pakets als Text */
async function paketText(ir: DocxDokument | XlsxMappe): Promise<string> {
  const paket = istDocx(ir) ? await renderDocx(ir) : await renderXlsx(ir);
  expect(paket.byteLength).toBeGreaterThan(1000);
  return Object.entries(unzipSync(paket))
    .filter(([pfad]) => /\.(xml|rels)$/.test(pfad))
    .map(([, inhalt]) => strFromU8(inhalt))
    .join('\n');
}

const soaZeilen = (ir: XlsxMappe) => ir.blaetter.find((b) => b.name === u.t('vorlagen.D-11.blaetter.soa'))!.zeilen;

describe('Vorlagen Gruppe 2 (de)', () => {
  for (const { id, vorlage, formen, kiSystemId } of VORLAGEN) {
    for (const form of formen) {
      for (const modus of ['leer', 'firma'] as Modus[]) {
        const name = `${id}${form === 'ergaenzungsblatt' ? '-EB' : ''} ${modus}${kiSystemId ? ` ${kiSystemId}` : ''}`;
        it(name, async () => {
          const projekt = modus === 'leer' ? leeresProjekt() : vollstaendigesProjekt();
          const ir = rendern(vorlage, modus, projekt, form, kiSystemId);
          const json = JSON.stringify(ir);
          expect(json).not.toMatch(/undefined/);
          if (modus === 'firma') expect(json).not.toMatch(/kmu-cio/i);
          if (modus === 'leer') expect(json).toMatch(/kmu-cio\.ch/);
          if (form === 'ergaenzungsblatt') expect(ir.lenkung.dokumentId).toBe(`${id}-EB`);

          const xml = await paketText(ir);
          expect(xml).not.toMatch(/undefined/);
          if (modus === 'firma') expect(xml).not.toMatch(/kmu-cio/i);
        });
      }
    }
  }
});

describe('D-09 Folgenabschätzung je System', () => {
  const folgen = (ergebnis: Folgenabschaetzung['triage']['ergebnis']): Folgenabschaetzung => ({
    id: 'IA-001',
    kiSystem: 'KI-001',
    triage: {
      rechtspositionOderChancen: ergebnis === 'voll',
      gesundheitOderSicherheit: false,
      verletzlicheGruppen: false,
      besondereDaten: false,
      automatisierteEntscheidung: false,
      grosseReichweite: false,
      ergebnis,
      begruendung: 'Bürounterstützung ohne Entscheide über Menschen',
    },
    systembeschreibung: 'Schreibassistent',
    verwendungen: 'Entwürfe',
    fehlanwendungen: 'Rechtsauskunft',
    daten: '',
    einsatzumfeld: 'Schweiz, Deutsch',
    betroffene: [{ gruppe: 'Kundschaft', art: 'indirekt', wirkung: 'erhält Texte', konsultiert: false }],
    nutzenSchaden: { transparenz: { nutzen: 'schneller', schaden: 'KI nicht erkennbar' } },
    ausfaelle: 'falsche Angaben',
    massnahmen: 'M-001',
    sensibleNutzung: ergebnis === 'voll',
    eingeschraenkteNutzung: false,
    ergebnis: 'einsetzen mit Auflagen',
    verknuepfteDsfa: 'DSFA-01',
    freigabe: { von: 'P-001', am: '2026-10-12' },
    naechsteUeberpruefung: '2027-10-12',
  });

  it('zeigt Teil B bei vollständiger Abschätzung und füllt aus dem Projekt', () => {
    const p = vollstaendigesProjekt();
    p.folgenabschaetzungen = [folgen('voll')];
    const json = JSON.stringify(rendern(d09, 'firma', p, 'dokument', 'KI-001'));
    expect(json).toContain(u.t('vorlagen.D-09.teil_b'));
    for (const s of ['KI-001 Copilot (IA-001)', 'Kundschaft', 'KI nicht erkennbar', 'DSFA-01', '12.10.2026', 'beim Lieferanten angefragt']) expect(json).toContain(s);
    expect(json).not.toMatch(/undefined/);
  });

  it('lässt Teil B weg, wenn die Kurzprüfung genügt', () => {
    const p = vollstaendigesProjekt();
    p.folgenabschaetzungen = [folgen('kurz')];
    const json = JSON.stringify(rendern(d09, 'firma', p, 'dokument', 'KI-001'));
    expect(json).not.toContain(u.t('vorlagen.D-09.teil_b'));
    expect(json).toContain(u.t('vorlagen.D-09.teil_c'));
  });

  it('enthält in der leeren Vorlage Teil B und alle acht Ziele', () => {
    const json = JSON.stringify(rendern(d09, 'leer', leeresProjekt()));
    expect(json).toContain(u.t('vorlagen.D-09.teil_b'));
    for (const z of ['Rechenschaft', 'Transparenz', 'Fairness', 'Datenschutz', 'Zuverlässigkeit', 'Sicherheit', 'Erklärbarkeit', 'Umwelt']) expect(json).toContain(z);
  });
});

describe('D-11 Erklärung zur Anwendbarkeit', () => {
  const abschnittEuaia = u.t('vorlagen.D-11.abschnitt_euaia');

  it.each(['leer', 'firma'] as Modus[])('enthält alle 38 Controls aus Anhang A (%s)', (modus) => {
    const projekt = modus === 'leer' ? leeresProjekt() : vollstaendigesProjekt();
    const ir = rendern(d11, modus, projekt) as XlsxMappe;
    const ids = soaZeilen(ir).map((z) => z[0]).filter((v) => CONTROLS_42001.includes(String(v)));
    expect(ids).toHaveLength(38);
    expect(new Set(ids).size).toBe(38);
  });

  it('übernimmt Entscheid, Status und Risikobezug aus dem Projekt', () => {
    const ir = rendern(d11, 'firma', vollstaendigesProjekt()) as XlsxMappe;
    const zeile = soaZeilen(ir).find((z) => z[0] === 'A.9.2')!;
    expect(zeile.slice(2, 7)).toEqual(['ja', 'Risiko R-001', 'R-001', 'umgesetzt', 'gemäss D-15']);
  });

  it('zeigt den Abschnitt EU AI Act nur mit Modul', () => {
    const mit = vollstaendigesProjekt();
    const ohne = vollstaendigesProjekt();
    ohne.meta.modulAiAct = false;
    const jsonMit = JSON.stringify(rendern(d11, 'firma', mit));
    const jsonOhne = JSON.stringify(rendern(d11, 'firma', ohne));
    expect(jsonMit).toContain(abschnittEuaia);
    expect(jsonOhne).not.toContain(abschnittEuaia);
    expect(jsonOhne).not.toMatch(/EUAIA-\d/);
    expect(JSON.stringify(rendern(d11, 'leer', leeresProjekt({ modulAiAct: true })))).toContain(abschnittEuaia);
    expect(JSON.stringify(rendern(d11, 'leer', leeresProjekt()))).not.toContain(abschnittEuaia);
  });

  it('enthält den Abschnitt eigene Controls und das Blatt Auswertung', () => {
    const p = vollstaendigesProjekt();
    p.eigeneControls = [{ id: 'EC-01', titel: 'Freigabe von Prompts', beschreibung: '', quelle: 'R-001' }];
    const ir = rendern(d11, 'firma', p) as XlsxMappe;
    expect(soaZeilen(ir).some((z) => z[0] === 'EC-01')).toBe(true);
    expect(JSON.stringify(ir)).toContain(u.t('vorlagen.D-11.abschnitt_eigene'));
    expect(ir.blaetter.map((b) => b.name)).toContain(u.t('vorlagen.D-11.blaetter.auswertung'));
  });
});

describe('D-10 KI-Inventar', () => {
  it('zeigt die AI-Act-Spalten mit Modul, mit festgelegten Rollen oder als optionale Spalten in der leeren Vorlage', () => {
    const kopf = (ir: XlsxMappe) => ir.blaetter[0]!.spalten.map((s) => s.kopf).join('|');
    const ohne = vollstaendigesProjekt();
    ohne.meta.modulAiAct = false;
    // Ohne Modul: Spalten nur, wenn für ein System eine Rolle nach AI Act festgehalten ist
    expect(kopf(rendern(d10, 'firma', ohne) as XlsxMappe)).toContain('Rolle AI Act');
    for (const s of ohne.kiSysteme) s.aiAct.rollen = [];
    expect(kopf(rendern(d10, 'firma', ohne) as XlsxMappe)).not.toContain('AI Act');
    expect(kopf(rendern(d10, 'firma', vollstaendigesProjekt()) as XlsxMappe)).toContain('Rolle AI Act');
    expect(kopf(rendern(d10, 'leer', leeresProjekt()) as XlsxMappe)).toContain('(optional, Modul)');
  });

  it('hat vier Blätter und einen Fragebogen mit festen Spaltenköpfen', () => {
    const ir = rendern(d10, 'leer', leeresProjekt()) as XlsxMappe;
    expect(ir.blaetter).toHaveLength(4);
    const fragen = ir.blaetter[2]!.spalten.filter((s) => /^\d+ /.test(s.kopf));
    expect(fragen.length).toBeGreaterThanOrEqual(10);
    // 12 Fragen plus zwei zu handelnder KI (ab rc.2)
    expect(fragen.length).toBeLessThanOrEqual(14);
  });
});
