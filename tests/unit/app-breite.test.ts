// AIMS-Manager, Breite: Reiter und Sprungziele, EU AI Act (Pflichten, Fristen), 27001-Brücke, Fragebogen (Export/Import),
// Import des KI-Ergebnisses, Jahreskalender.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { ergaenzeKiErgebnis, extrahiereJson, ladeKiErgebnis } from '../../src/app/import/ki-ergebnis.ts';
import { fehlerOrt, schemaFehlerText } from '../../src/app/import/laden.ts';
import { fristenUebersicht, offenePflichten, pflichtenJeSystem, pflichtenKatalog, pflichtStand, standKatalog } from '../../src/app/logik/aiact.ts';
import { ergaenzungsblaetterKatalog, staerksteEntsprechung, vorgeschlagene27001, wiederverwendung, zuordnungen } from '../../src/app/logik/bruecke.ts';
import { fragebogenText, liesFragebogen, type FragebogenUmfeld } from '../../src/app/logik/fragebogen.ts';
import type { GefuehrtDaten } from '../../src/app/logik/gefuehrt-typen.ts';
import { kalenderEintraege } from '../../src/app/logik/kalender.ts';
import { REITER, sprungRoute, sprungZiel } from '../../src/app/logik/routen.ts';
import { fragebogenMappe, liesArbeitsmappe } from '../../src/app/worker/fragebogen.ts';
import { renderXlsx } from '../../src/generator/xlsx.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import type { Kataloge } from '../../src/kataloge/typen.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import { kiSystem, vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = <T>(rel: string): T => JSON.parse(readFileSync(join(REPO, rel), 'utf8')) as T;
const kataloge = json<Kataloge>('src/generiert/kataloge.json');
const gefuehrt = json<GefuehrtDaten>('src/generiert/gefuehrt.json');
const controlIds = kataloge.controls42001.gruppen.flatMap((g) => g.controls.map((c) => c.id));
const texte = { de: ladeTexte('de'), en: ladeTexte('en') };

describe('Reiter und Sprungziele', () => {
  it('Prüfregeln springen in die neuen Formularmodule', () => {
    expect(sprungRoute('organisation/geltungsbereich')).toEqual({ art: 'formular', modul: 'organisation', id: 'geltungsbereich', filter: undefined });
    expect(sprungRoute('organisation/risikokriterien')).toMatchObject({ modul: 'organisation', id: 'risikokriterien' });
    expect(sprungRoute('aiact/stand')).toMatchObject({ modul: 'aiact', id: 'fristen' });
    expect(sprungRoute('aiact/pflichten')).toMatchObject({ modul: 'aiact', id: 'vorschlaege' });
    expect(sprungRoute('kommunikation')).toMatchObject({ modul: 'kompetenz', id: 'kommunikation' });
    expect(sprungRoute('kompetenz')).toMatchObject({ modul: 'kompetenz', id: 'kompetenzen' });
    expect(sprungRoute('ziele/Z-002')).toMatchObject({ modul: 'ziele', id: 'Z-002' });
  });
  it('Bereiche ohne Formularmodul führen in den Guide', () => {
    expect(sprungRoute('managementbewertung')).toMatchObject({ art: 'gefuehrt', etappe: 'E12', seite: 'E12-mb' });
    expect(sprungRoute('feststellungen/F-001')).toMatchObject({ art: 'gefuehrt', seite: 'E12-feststellungen', eintrag: 'F-001' });
  });
  it('unbekanntes Unterziel eines Reitermoduls wird zur Auswahl im ersten Reiter', () => {
    expect(sprungZiel('organisation/IP-003')).toEqual({ art: 'formular', modul: 'organisation', id: 'kontext', filter: { eintrag: 'IP-003' } });
  });
  it('jede Seite, die die Organisation-Reiter verwenden, existiert', () => {
    const ids = new Set(gefuehrt.seiten.map((s) => s.id));
    const quelle = readFileSync(join(REPO, 'src/app/ansichten/formular/Organisation.tsx'), 'utf8');
    for (const m of quelle.matchAll(/'(E\d+-[a-z-]+)'/g)) expect(ids.has(m[1]!), m[1]).toBe(true);
    expect(REITER.organisation).toHaveLength(6);
  });
});

describe('EU AI Act', () => {
  const pflichten = pflichtenKatalog(kataloge);
  it('Katalog geladen', () => expect(pflichten.length).toBeGreaterThan(50));
  it('Pflichten je System nur mit Modul; Hochrisiko-Betreiber hat mehr Pflichten als minimal', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme.push(kiSystem({ id: 'KI-002', name: 'Bewerbungen', aiAct: { rollen: ['betreiber'], risikoklasse: 'hochrisiko-anhang-iii', anhangIiiBereich: '4a', transparenz: [], gpai: false, begruendung: '', juristischGeprueft: false } }));
    const r = pflichtenJeSystem(p, pflichten);
    expect(r).toHaveLength(2);
    expect(r[1]!.zeilen.length).toBeGreaterThan(r[0]!.zeilen.length);
    p.meta.modulAiAct = false;
    expect(pflichtenJeSystem(p, pflichten)).toEqual([]);
  });
  it('Stand einer Pflicht folgt dem Zusatz-Control', () => {
    const p = vollstaendigesProjekt();
    const pf = pflichten.find((x) => x.zusatz_control && x.abdeckung_42001.grad !== 'ganz')!;
    expect(pflichtStand(p, pf)).toBe('offen');
    p.controls.push({ id: pf.zusatz_control!, rahmenwerk: 'EUAIA', anwendbar: 'ja', begruendung: 'x', status: 'umgesetzt', nachweise: [], umsetzung: '', iso27001: [], kiSysteme: [] });
    expect(pflichtStand(p, pf)).toBe('umgesetzt');
    p.controls.at(-1)!.anwendbar = 'nein';
    expect(pflichtStand(p, pf)).toBe('abgelehnt');
    const ganz = pflichten.find((x) => x.abdeckung_42001.grad === 'ganz');
    if (ganz) expect(pflichtStand(p, ganz)).toBe('abgedeckt');
  });
  it('offene Pflichten; Massnahme mit Referenz wird erkannt', () => {
    const p = vollstaendigesProjekt();
    const offen = offenePflichten(p, pflichten);
    expect(offen.length).toBeGreaterThan(0);
    const z = offen[0]!;
    p.massnahmen.push({ id: 'M-001', titel: 't', beschreibung: '', status: 'offen', prioritaet: 'mittel', herkunft: { art: 'aiact', ref: `${z.pflicht.id}:${z.system.id}` } });
    expect(offenePflichten(p, pflichten).find((x) => x.pflicht.id === z.pflicht.id && x.system.id === z.system.id)?.massnahme?.id).toBe('M-001');
  });
  it('Fristen sortiert, nächste Frist ab heute', () => {
    const f = fristenUebersicht(standKatalog(kataloge), '2026-10-21');
    expect(f.fristen.map((x) => x.datum)).toEqual([...f.fristen.map((x) => x.datum)].sort());
    const naechste = f.fristen.find((x) => x.id === f.naechste)!;
    expect(naechste.datum >= '2026-10-21').toBe(true);
    expect(f.fristen.filter((x) => x.vorbei).every((x) => x.datum < '2026-10-21')).toBe(true);
  });
});

describe('ISO 27001-Brücke', () => {
  it('Wiederverwendungsgrad aus dem Katalog', () => {
    const w = wiederverwendung(kataloge, controlIds);
    expect(w.gesamt).toBe(38);
    expect(w.hoch).toBeGreaterThan(0);
    expect(w.mindestensMittel).toBeGreaterThanOrEqual(w.hoch);
    expect(w.grad).toBeGreaterThan(0);
    expect(w.grad).toBeLessThanOrEqual(1);
  });
  it('Projektanteil verknüpfter Controls', () => {
    const p = vollstaendigesProjekt();
    expect(wiederverwendung(kataloge, controlIds, p)).toMatchObject({ anwendbar: 38, verknuepft: 0 });
    p.controls[0]!.iso27001 = ['27001-5.1'];
    expect(wiederverwendung(kataloge, controlIds, p).verknuepft).toBe(1);
  });
  it('stärkste Entsprechung und Vorschläge ohne «tief»', () => {
    const z = zuordnungen(kataloge).find((x) => x.verwandt.some((v) => v.staerke === 'hoch'))!;
    expect(staerksteEntsprechung(z)).toBe('hoch');
    expect(staerksteEntsprechung(undefined)).toBeUndefined();
    for (const id of vorgeschlagene27001(kataloge, z.id)) expect(z.verwandt.find((v) => v.control === id)?.staerke).not.toBe('tief');
  });
  it('ISMS-Dokumente mit Ergänzungsblatt', () => {
    const b = ergaenzungsblaetterKatalog(kataloge);
    expect(b.length).toBeGreaterThanOrEqual(10);
    for (const x of b) expect(x.id).toMatch(/^D-\d\d-EB$/);
  });
});

function umfeld(): FragebogenUmfeld {
  return {
    sprachen: [fragebogenText(texte.de), fragebogenText(texte.en)],
    fachbereiche: [{ wert: 'hr', texte: ['HR', 'Personal'] }, { wert: 'verkauf', texte: ['Verkauf', 'Sales'] }],
    beschriftung: { ausgefuelltVon: 'Ausgefüllt von', personen: 'Nutzende', haeufigkeit: 'Nutzung', anbieter: 'Anbieter', bemerkungen: 'Bemerkungen', unklar: 'unklar' },
  };
}

async function ausfuellen(bytes: Uint8Array, zeilen: (string | number)[][]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const ws = wb.worksheets.find((w) => w.name !== wb.worksheets[0]!.name) ?? wb.worksheets[0]!;
  let kopf = 0;
  ws.eachRow((row, nr) => {
    if (!kopf && row.values && (row.values as unknown[]).some((v) => typeof v === 'string' && /^1 /.test(v))) kopf = nr;
  });
  zeilen.forEach((z, i) => z.forEach((w, j) => (ws.getCell(kopf + 1 + i, j + 1).value = w)));
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

describe('Fragebogen für Fachbereiche', () => {
  it('Export enthält nur das Fragebogen-Blatt (plus Lenkung), Kopfzeile wiedererkennbar', async () => {
    const p = vollstaendigesProjekt();
    const { mappe, name } = fragebogenMappe(p, texte.de, kataloge, 'de', '1.0.0', 'Personal');
    expect(mappe.blaetter).toHaveLength(1);
    expect(name).toMatch(/^D-10_.*Personal\.xlsx$/);
    expect(JSON.stringify(mappe)).not.toMatch(/kmu-cio/i);
    const bytes = await renderXlsx(mappe);
    const gelesen = await liesArbeitsmappe(bytes);
    expect(liesFragebogen(gelesen, p, umfeld())).toEqual([]);
  });
  it('Import DE: Zuordnung der Spalten, Schatten-KI, unklare Angaben, Dubletten', async () => {
    const p = vollstaendigesProjekt();
    const { mappe } = fragebogenMappe(p, texte.de, kataloge, 'de', '1.0.0');
    const bytes = await ausfuellen(await renderXlsx(mappe), [
      ['Personal', 'Eva', 'CV-Screener', 'Bewerbungen vorsortieren', 'selbst beschafft oder Gratisversion', 'Recruit AI', 3, 'täglich', 'Lebensläufe', 'ja', 'weiss nicht', 'Bewerbende', 'selten oder nie', 'Bitte prüfen'],
      ['Verkauf', 'Max', 'Copilot', 'Mails', 'von der Firma bereitgestellt', '', 20, 'täglich', 'Mails', 'nein', 'nein', 'Kunden', 'immer', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['Marketing', '', 'Bildgenerator', 'Bilder', 'selbst entwickelt', '', '', '', '', '', '', '', 'meistens', ''],
    ]);
    const z = liesFragebogen(await liesArbeitsmappe(bytes), p, umfeld())!;
    expect(z).toHaveLength(3);
    expect(z[0]!.werte).toMatchObject({ name: 'CV-Screener', typ: 'schatten', status: 'in-pruefung', fachbereich: 'hr', personendaten: true, besondereDaten: true, automatisierung: 'vollautomatisiert', betroffene: 'Bewerbende' });
    expect(z[0]!.hinweise).toEqual(expect.arrayContaining(['schatten', 'besondere-unklar']));
    expect(z[0]!.werte.beschreibung).toContain('Recruit AI');
    expect(z[1]!.doppelt).toBe('KI-001'); // «Copilot» ist im Testprojekt erfasst
    expect(z[1]!.werte).toMatchObject({ typ: 'eingekauft', personendaten: false, automatisierung: 'unterstuetzend', fachbereich: 'verkauf' });
    expect(z[2]!.werte).toMatchObject({ typ: 'eigenbau', automatisierung: 'teilautomatisiert', fachbereich: 'Marketing' });
    expect(z[2]!.hinweise).toContain('fachbereich-frei');
  });
  it('Import der Fragen 13 und 14 (ab rc.2): handelnde KI und Zugriffe', async () => {
    const p = leeresProjekt();
    const { mappe } = fragebogenMappe(p, texte.de, kataloge, 'de', '1.0.0');
    const leer = ['', '', '', '', '', '', '', '', '', ''];
    const bytes = await ausfuellen(await renderXlsx(mappe), [
      ['Verkauf', 'Max', 'Mail-Agent', 'Antworten versenden', ...leer, 'ja', 'Postfach Verkauf, CRM'],
      ['Verkauf', 'Max', 'Planer', 'Termine', ...leer, 'weiss nicht', ''],
      ['Verkauf', 'Max', 'Übersetzer', 'Texte', ...leer, 'nein', ''],
      ['Verkauf', 'Max', 'Alt', 'Ohne Spalten 15 und 16'],
    ]);
    const z = liesFragebogen(await liesArbeitsmappe(bytes), p, umfeld())!;
    expect(z.map((x) => x.werte.name)).toEqual(['Mail-Agent', 'Planer', 'Übersetzer', 'Alt']);
    expect(z[0]!.werte).toMatchObject({ handlungsbefugnis: 'fuehrt-begrenzt-aus', zugriffe: 'Postfach Verkauf, CRM' });
    expect(z[0]!.hinweise).toContain('handelnd');
    expect(z[1]!.werte.handlungsbefugnis).toBe('fuehrt-begrenzt-aus');
    expect(z[1]!.hinweise).toContain('handlung-unklar');
    expect(z[2]!.werte.handlungsbefugnis).toBeUndefined();
    expect(z[3]!.werte.handlungsbefugnis).toBeUndefined();
    expect(z[3]!.werte.zugriffe).toBeUndefined();
  });
  it('Import EN-Fragebogen und fremde Arbeitsmappe', async () => {
    const p = leeresProjekt();
    const { mappe } = fragebogenMappe(p, texte.en, kataloge, 'en', '1.0.0');
    const bytes = await ausfuellen(await renderXlsx(mappe), [['Sales', 'Ann', 'DeepL', 'Translate', 'AI feature in existing software', 'DeepL SE', 2, 'weekly', 'texts', 'no', 'no', 'customers', 'always', '']]);
    const z = liesFragebogen(await liesArbeitsmappe(bytes), p, umfeld())!;
    expect(z[0]!.werte).toMatchObject({ name: 'DeepL', typ: 'eingekauft', fachbereich: 'verkauf' });
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Tabelle1').addRow(['Name', 'Wert']);
    const fremd = new Uint8Array(await wb.xlsx.writeBuffer());
    expect(liesFragebogen(await liesArbeitsmappe(fremd), p, umfeld())).toBeNull();
  });
});

describe('Ergebnis des KI-Assistenten', () => {
  const minimal = () => {
    const p = leeresProjekt({ jetzt: '2026-10-20T08:00:00Z', projektId: '3f6c2a9e-8b1d-4e7a-9c55-0d2f7b41a6e3' }) as unknown as Record<string, unknown>;
    p['organisation'] = { ...(p['organisation'] as object), name: 'Muster Treuhand AG' };
    return p;
  };
  it('reines JSON, Codeblock mit Erklärung, Objekt im Fliesstext', () => {
    const j = JSON.stringify(minimal(), null, 2);
    expect(ladeKiErgebnis(j).ok).toBe(true);
    expect(ladeKiErgebnis(`Hier ist Ihre Projektdatei:\n\n\`\`\`json\n${j}\n\`\`\`\n\nSpeichern Sie sie als muster.aims.json.`).ok).toBe(true);
    expect(ladeKiErgebnis(`Ergebnis: ${JSON.stringify(minimal())} Ende.`).ok).toBe(true);
    expect(extrahiereJson('kein json').ok).toBe(false);
  });
  it('fehlende leere Listen und Standardangaben werden ergänzt und gemeldet', () => {
    const p = minimal();
    delete p['audits'];
    delete p['feststellungen'];
    delete (p['meta'] as Record<string, unknown>)['checklisten'];
    const r = ladeKiErgebnis(JSON.stringify(p));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ergaenzt).toEqual(expect.arrayContaining(['audits', 'feststellungen', 'meta.checklisten']));
      expect(r.projekt.audits).toEqual([]);
    }
    expect(ergaenzeKiErgebnis(minimal())).toEqual([]);
  });
  it('verständliche Meldungen bei Schemafehlern (Ort, erlaubte Werte)', () => {
    const p = minimal();
    p['kiSysteme'] = [{ ...kiSystem(), typ: 'cloud', extra: 1 }];
    const r = ladeKiErgebnis(JSON.stringify(p));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.art).toBe('schema');
      const text = schemaFehlerText(r.schema!).join('\n');
      expect(text).toContain('kiSysteme[0].typ: unzulässiger Wert (erlaubt: eingekauft, saas, eigenbau, schatten)');
      expect(text).toContain('unbekanntes Feld «extra»');
    }
  });
  it('kein Projekt, leer, ungültiges JSON', () => {
    expect(ladeKiErgebnis('')).toMatchObject({ ok: false, art: 'leer' });
    expect(ladeKiErgebnis('{"hallo": 1}')).toMatchObject({ ok: false, art: 'kein-projekt' });
    expect(ladeKiErgebnis('```json\n{ "meta": { , }\n```')).toMatchObject({ ok: false, art: 'kein-json' });
    expect(fehlerOrt('/kiSysteme/2/aiAct/rollen/0')).toBe('kiSysteme[2].aiAct.rollen[0]');
  });
});

describe('Jahreskalender', () => {
  const aufgaben = gefuehrt.seiten.find((s) => s.typ === 'kalender')!.aufgaben!;
  it('überfällige Einträge, Monat aus Antworten, Sortierung, erledigt', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme.push(kiSystem({ id: 'KI-002', name: 'Alt', naechsteUeberpruefung: '2026-01-31' }));
    p.meta.gefuehrt.antworten['jahr'] = { monatAudit: 'maerz', monatMb: 'november' };
    const k = kalenderEintraege(p, aufgaben, '2026-10-21');
    const inv = k.find((x) => x.aufgabe.id === 'inventar')!;
    expect(inv).toMatchObject({ stand: 'ueberfaellig', faellig: '2026-01-31', ueberfaelligeEintraege: 1 });
    expect(inv.betroffen[0]).toMatchObject({ id: 'KI-002', name: 'Alt' });
    expect(k.find((x) => x.aufgabe.id === 'internes-audit')).toMatchObject({ faellig: '2026-03-31', stand: 'ueberfaellig' });
    expect(k.find((x) => x.aufgabe.id === 'managementbewertung')).toMatchObject({ faellig: '2026-11-30', stand: 'geplant' });
    expect(k[0]!.stand).toBe('ueberfaellig');
    p.meta.checklisten['J-internes-audit-2026'] = { erledigt: true };
    expect(kalenderEintraege(p, aufgaben, '2026-10-21').find((x) => x.aufgabe.id === 'internes-audit')!.stand).toBe('erledigt');
  });
  it('Modulaufgaben nur mit Modul', () => {
    const p = vollstaendigesProjekt();
    expect(kalenderEintraege(p, aufgaben, '2026-10-21').some((x) => x.aufgabe.id === 'aiact-stand')).toBe(true);
    p.meta.modulAiAct = false;
    expect(kalenderEintraege(p, aufgaben, '2026-10-21').some((x) => x.aufgabe.id === 'aiact-stand')).toBe(false);
  });
});
