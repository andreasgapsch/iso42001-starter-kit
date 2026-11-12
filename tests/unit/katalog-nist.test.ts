// Konsistenz des Moduls NIST AI RMF: Kern (Funktionen, Kategorien, Subkategorien), Zusatz-Controls RMF-xx,
// GenAI-Risiken, Vertrauensmerkmale, Stand, Seitenverweise und Texte DE/EN.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { alleAbschnitte42001, alleControls42001, type NistKern, type NistSeiten, type NistStand, type RmfControl, type GenaiRisiko, type Vertrauensmerkmal } from '../../src/kataloge/typen.ts';
import { NUTZEN_SCHADEN_ZIELE } from '../../src/model/typen.ts';
import { leseSummen } from '../../scripts/pruefen/pruefsummen.mts';
import { erwarteteSchluessel, findeKern, findePlaybook, findeRisiken, kitId } from '../../scripts/nist-seiten.mts';

const wurzel = new URL('../../', import.meta.url);
const lies = (pfad: string): any => parse(readFileSync(new URL(pfad, wurzel), 'utf8'));

const kataloge = ladeKataloge();
const kern = kataloge.nistrmf_subkategorien as NistKern;
const controls = (kataloge.nistrmf_rmfControls as { controls: RmfControl[] }).controls;
const risiken = (kataloge.nistrmf_genaiRisiken as { risiken: GenaiRisiko[] }).risiken;
const merkmaleDatei = kataloge.nistrmf_merkmale as { merkmale: Vertrauensmerkmal[]; ziele_ohne_merkmal: { ziel: string; subkategorien: string[] }[] };
const stand = kataloge.nistrmf_stand as NistStand;
const seiten = JSON.parse(readFileSync(new URL('src/nist-rmf/seiten.json', wurzel), 'utf8')) as NistSeiten;
const texte = { de: lies('src/i18n/de/nist.yaml'), en: lies('src/i18n/en/nist.yaml') };

const subk = kern.subkategorien;
const subkIds = new Set(subk.map((s) => s.id));
const kategorieIds = new Set(kern.kategorien.map((k) => k.id));
const controlNachId = new Map(controls.map((c) => [c.id, c]));
const risikoIds = new Set(risiken.map((r) => r.id));
const MERKMALE = ['gueltig', 'sicher', 'geschuetzt', 'rechenschaft', 'erklaerbar', 'datenschutz', 'fair'];

const ids42001 = new Set([...alleControls42001(kataloge).map((c) => c.id), ...alleAbschnitte42001(kataloge).map((a) => a.id)]);
const ids27001 = new Set((kataloge['controls27001'] as { controls: { id: string }[] }).controls.map((c) => c.id));
const dokumente = new Set(kataloge.dokumente.dokumente.map((d) => d.id));
const gestrichen = new Set(kataloge.dokumente.gestrichen.map((g) => g.id));
const regeln = new Set((lies('src/regeln/pruefregeln.yaml').regeln as { id: string }[]).map((r) => r.id));
const etappen = new Set((lies('src/gefuehrt/etappen.yaml').etappen as { id: string }[]).map((e) => e.id));
const NIST_VORLAGEN = ['N-01', 'N-02', 'N-03', 'N-04'];
const BEDINGUNG = ['immer', 'typ_any', 'eigenes_training', 'rollen_any', 'transparenz_any', 'triage_rechtsposition', 'triage_gesundheit_sicherheit', 'generativ', 'any_of'];
const KI_TYPEN = ['eingekauft', 'saas', 'eigenbau', 'schatten'];
const ROLLEN = ['anbieter', 'betreiber', 'einfuehrer', 'haendler', 'produkthersteller', 'bevollmaechtigter'];
const NIST_FUNKTION = { govern: 'GOVERN', map: 'MAP', measure: 'MEASURE', manage: 'MANAGE' } as const;

function istDatum(wert: unknown): boolean {
  if (typeof wert !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) return false;
  return new Date(`${wert}T00:00:00Z`).toISOString().slice(0, 10) === wert;
}

function pruefeBedingung(b: any, pfad: string): string[] {
  const fehler: string[] = [];
  if (!b || typeof b !== 'object' || Object.keys(b).length === 0) return [`${pfad}: leer`];
  for (const [k, v] of Object.entries(b)) {
    if (!BEDINGUNG.includes(k)) fehler.push(`${pfad}: unbekannter Schlüssel ${k}`);
    if (k === 'typ_any') for (const t of v as string[]) if (!KI_TYPEN.includes(t)) fehler.push(`${pfad}: Typ ${t}`);
    if (k === 'rollen_any') for (const r of v as string[]) if (!ROLLEN.includes(r)) fehler.push(`${pfad}: Rolle ${r}`);
    if (k === 'transparenz_any') for (const t of v as string[]) if (!['50-1', '50-2', '50-3', '50-4'].includes(t)) fehler.push(`${pfad}: Transparenz ${t}`);
    if (k === 'any_of') (v as any[]).forEach((u, i) => fehler.push(...pruefeBedingung(u, `${pfad}.any_of[${i}]`)));
    if (!['typ_any', 'rollen_any', 'transparenz_any', 'any_of'].includes(k) && v !== true) fehler.push(`${pfad}: ${k} muss true sein`);
  }
  return fehler;
}

describe('NIST AI RMF: Kern (src/nist-rmf/subkategorien.yaml)', () => {
  it('4 Funktionen, 19 Kategorien, 72 Subkategorien', () => {
    expect(kern.funktionen.map((f) => f.id)).toEqual(['govern', 'map', 'measure', 'manage']);
    expect(kern.kategorien).toHaveLength(19);
    expect(subk).toHaveLength(72);
    expect(subkIds.size).toBe(72);
    expect(kategorieIds.size).toBe(19);
  });

  it('Verteilung je Funktion wie AI 100-1 (19/18/22/13 Subkategorien, 6/5/4/4 Kategorien)', () => {
    const zahl = (f: string) => subk.filter((s) => s.funktion === f).length;
    expect([zahl('govern'), zahl('map'), zahl('measure'), zahl('manage')]).toEqual([19, 18, 22, 13]);
    const kat = (f: string) => kern.kategorien.filter((k) => k.funktion === f).length;
    expect([kat('govern'), kat('map'), kat('measure'), kat('manage')]).toEqual([6, 5, 4, 4]);
  });

  it('IDs, NIST-Bezeichnung, Funktion und Kategorie passen zusammen', () => {
    const fehler: string[] = [];
    const kuerzel = new Map(kern.funktionen.map((f) => [f.id, f.kuerzel]));
    for (const k of kern.kategorien) {
      if (!/^(GV|MP|MS|MG)-\d$/.test(k.id)) fehler.push(`${k.id}: Muster`);
      if (k.nist_id !== `${NIST_FUNKTION[k.funktion]} ${k.id.slice(3)}`) fehler.push(`${k.id}: nist_id ${k.nist_id}`);
      if (!k.id.startsWith(`${kuerzel.get(k.funktion)}-`)) fehler.push(`${k.id}: Funktion ${k.funktion}`);
    }
    for (const s of subk) {
      if (!/^(GV|MP|MS|MG)-\d\.\d{1,2}$/.test(s.id)) fehler.push(`${s.id}: Muster`);
      if (s.nist_id !== `${NIST_FUNKTION[s.funktion]} ${s.id.slice(3)}`) fehler.push(`${s.id}: nist_id ${s.nist_id}`);
      if (!kategorieIds.has(s.kategorie) || !s.id.startsWith(`${s.kategorie}.`)) fehler.push(`${s.id}: Kategorie ${s.kategorie}`);
      if (kern.kategorien.find((k) => k.id === s.kategorie)?.funktion !== s.funktion) fehler.push(`${s.id}: Funktion`);
      if (kitId(NIST_FUNKTION[s.funktion], s.id.slice(3)) !== s.id) fehler.push(`${s.id}: kitId`);
    }
    expect(fehler).toEqual([]);
  });

  it('Abdeckung nach Norm 31 ganz, 40 teilweise, 1 nicht (Runde 1, B-07); abdeckung_kit hat gültige Werte', () => {
    const zahl = (g: string) => subk.filter((s) => s.abdeckung === g).length;
    expect([zahl('ganz'), zahl('teilweise'), zahl('nicht')]).toEqual([31, 40, 1]);
    expect(subk.filter((s) => s.abdeckung === 'nicht').map((s) => s.id)).toEqual(['MS-2.2']);
    for (const s of subk) expect(['ganz', 'teilweise', 'nicht'], s.id).toContain(s.abdeckung_kit);
  });

  it('abdeckung_kit nach den Kernverbesserungen nachgeführt und plausibel (Bilanz 60 ganz, 12 teilweise, 0 nicht)', () => {
    const zahl = (g: string) => subk.filter((s) => s.abdeckung_kit === g).length;
    expect([zahl('ganz'), zahl('teilweise'), zahl('nicht')]).toEqual([60, 12, 0]);
    // nicht mehr vorläufig gleich abdeckung
    expect(readFileSync(new URL('src/nist-rmf/subkategorien.yaml', wurzel), 'utf8')).not.toMatch(/vorläufig|VORLÄUFIG/);
    const fehler: string[] = [];
    const rang = { nicht: 0, teilweise: 1, ganz: 2 } as const;
    for (const s of subk) {
      // Die Vorlagen setzen die Norm um: nie schlechter als die Abdeckung durch ISO/IEC 42001
      if (rang[s.abdeckung_kit] < rang[s.abdeckung]) fehler.push(`${s.id}: Kit schlechter als Norm`);
      // Über der Norm nur mit Kit-Dokumenten, die das Ergebnis tragen
      if (rang[s.abdeckung_kit] > rang[s.abdeckung] && s.kit.filter((d) => /^D-/.test(d)).length < 2) fehler.push(`${s.id}: über der Norm mit weniger als zwei Vorlagen`);
      // Verbleibende Lücke: Zusatz-Control oder Präzisierung (siehe oben) und für Ausbau-Subkategorien kein «nicht»
      if (s.abdeckung_kit === 'nicht') fehler.push(`${s.id}: nach rc.2 ohne jede Abdeckung`);
    }
    expect(fehler).toEqual([]);
    // Stichproben aus den Kernverbesserungen rc.2: Einsatzentscheid mit Lösung ohne KI, Ausserbetriebnahme, Einspruch,
    // Modell und Version; weiterhin offen: Zielkonflikte (RMF-01), Tests mit Personen, unabhängige Messprüfung
    const kit = Object.fromEntries(subk.map((s) => [s.id, s.abdeckung_kit]));
    expect([kit['MG-2.1'], kit['GV-1.7'], kit['MS-3.3'], kit['MG-3.2']]).toEqual(['ganz', 'ganz', 'ganz', 'ganz']);
    expect([kit['GV-1.2'], kit['MS-2.2'], kit['MS-1.3'], kit['GV-3.1']]).toEqual(['teilweise', 'teilweise', 'teilweise', 'teilweise']);
  });

  it('jede Subkategorie mit Abdeckung teilweise oder nicht hat ein Zusatz-Control oder eine Präzisierung', () => {
    const fehler: string[] = [];
    for (const s of subk) {
      if (s.abdeckung !== 'ganz' && !s.zusatz_control && !s.praezisierung) fehler.push(`${s.id}: weder Zusatz-Control noch Präzisierung`);
      if (s.abdeckung_kit !== 'ganz' && !s.zusatz_control && !s.praezisierung) fehler.push(`${s.id}: abdeckung_kit ohne Behandlung`);
      if (s.zusatz_control && s.praezisierung) fehler.push(`${s.id}: beides gesetzt`);
      if (s.zusatz_control) {
        const c = controlNachId.get(s.zusatz_control);
        if (!c) fehler.push(`${s.id}: ${s.zusatz_control} unbekannt`);
        else if (!c.subkategorien.includes(s.id)) fehler.push(`${s.id}: fehlt in ${c.id}.subkategorien`);
      }
    }
    expect(fehler).toEqual([]);
    expect(subk.filter((s) => s.praezisierung).map((s) => s.id)).toEqual(['GV-1.6', 'GV-2.2', 'MS-2.1', 'MS-2.5', 'MS-2.9', 'MS-2.10', 'MS-2.12']);
  });

  it('alle iso42001-Bezüge existieren im 42001-Katalog (Abschnitte K-x und Controls A.x)', () => {
    const fehler = subk.flatMap((s) => [
      ...(s.iso42001.length ? [] : [`${s.id}: keine Bezüge`]),
      ...s.iso42001.filter((x) => !ids42001.has(x)).map((x) => `${s.id}: ${x}`),
      ...(new Set(s.iso42001).size !== s.iso42001.length ? [`${s.id}: doppelt`] : []),
    ]);
    expect(fehler).toEqual([]);
  });

  it('alle Kit-Dokumente existieren im Dokumentenkatalog; N-Vorlagen, Prüfregeln, Etappen und Stufen gültig', () => {
    const fehler: string[] = [];
    for (const s of subk) {
      if (!s.kit.length) fehler.push(`${s.id}: kein Kit-Dokument`);
      for (const d of s.kit) if (!dokumente.has(d) || gestrichen.has(d)) fehler.push(`${s.id}: Dokument ${d}`);
      for (const n of s.nist_vorlagen ?? []) if (!NIST_VORLAGEN.includes(n)) fehler.push(`${s.id}: Vorlage ${n}`);
      for (const r of s.pruefregeln ?? []) if (!regeln.has(r)) fehler.push(`${s.id}: Prüfregel ${r}`);
      if (!etappen.has(s.etappe)) fehler.push(`${s.id}: Etappe ${s.etappe}`);
      if (!['lite', 'ausbau'].includes(s.stufe)) fehler.push(`${s.id}: Stufe ${s.stufe}`);
    }
    expect(fehler).toEqual([]);
  });

  it('GenAI-Profil: 213 Massnahmen in 49 Subkategorien', () => {
    expect(subk.reduce((n, s) => n + s.genai_600_1, 0)).toBe(213);
    expect(subk.filter((s) => s.genai_600_1 > 0)).toHaveLength(49);
  });

  it('Revisionshinweise stimmen mit stand.yaml überein', () => {
    const markiert = subk.filter((s) => s.revision_hinweis).map((s) => s.id);
    expect(markiert).toEqual(['GV-3.1', 'MS-2.12']);
    for (const id of stand.revision.betroffen_vermutet) expect(subkIds.has(id) || kategorieIds.has(id), id).toBe(true);
  });
});

describe('NIST AI RMF: Zusatz-Controls (src/nist-rmf/rmf-controls.yaml)', () => {
  it('RMF-01 bis RMF-16 und RMF-G01 bis RMF-G07', () => {
    const soll = [...Array.from({ length: 16 }, (_, i) => `RMF-${String(i + 1).padStart(2, '0')}`), ...Array.from({ length: 7 }, (_, i) => `RMF-G0${i + 1}`)];
    expect(controls.map((c) => c.id)).toEqual(soll);
    for (const c of controls) expect(c.art, c.id).toBe(c.id.startsWith('RMF-G') ? 'genai' : 'allgemein');
  });

  it('Bezüge auf Subkategorien, 42001, 27001, Kit-Dokumente und Vorlagen existieren', () => {
    const fehler: string[] = [];
    for (const c of controls) {
      if (!c.subkategorien.length) fehler.push(`${c.id}: keine Subkategorie`);
      for (const s of c.subkategorien) if (!subkIds.has(s)) fehler.push(`${c.id}: Subkategorie ${s}`);
      if (!c.verwandt_42001.length) fehler.push(`${c.id}: kein 42001-Bezug`);
      for (const x of c.verwandt_42001) if (!ids42001.has(x)) fehler.push(`${c.id}: 42001 ${x}`);
      for (const x of c.verwandt_27001) if (!ids27001.has(x)) fehler.push(`${c.id}: 27001 ${x}`);
      if (!c.kit.length) fehler.push(`${c.id}: kein Kit-Dokument`);
      for (const d of c.kit) if (!dokumente.has(d) || gestrichen.has(d)) fehler.push(`${c.id}: Dokument ${d}`);
      for (const n of c.nist_vorlagen) if (!NIST_VORLAGEN.includes(n)) fehler.push(`${c.id}: Vorlage ${n}`);
      for (const b of c.bezug_600_1) if (!/^(GV|MP|MS|MG)-\d\.\d{1,2}-\d{3}$/.test(b) || !subkIds.has(b.slice(0, -4))) fehler.push(`${c.id}: 600-1 ${b}`);
      if (c.art === 'genai') {
        if (!c.risiken?.length) fehler.push(`${c.id}: keine Risiken`);
        for (const r of c.risiken ?? []) if (!risikoIds.has(r)) fehler.push(`${c.id}: Risiko ${r}`);
      } else if (c.risiken) fehler.push(`${c.id}: risiken nur bei genai`);
    }
    expect(fehler).toEqual([]);
  });

  it('jedes allgemeine Control schliesst die Lücke mindestens einer Subkategorie', () => {
    const genutzt = new Set(subk.map((s) => s.zusatz_control).filter(Boolean));
    for (const c of controls.filter((x) => x.art === 'allgemein')) expect(genutzt.has(c.id), c.id).toBe(true);
  });

  it('vorschlag_wenn und voll_wenn haben gültige Schlüssel; GenAI-Controls nur bei generativer KI', () => {
    const fehler: string[] = [];
    for (const c of controls) {
      fehler.push(...pruefeBedingung(c.vorschlag_wenn, `${c.id}.vorschlag_wenn`));
      if (c.voll_wenn) {
        fehler.push(...pruefeBedingung(c.voll_wenn, `${c.id}.voll_wenn`));
        if (!c.betreiber_lite) fehler.push(`${c.id}: voll_wenn nur bei betreiber_lite`);
      }
      if (c.art === 'genai' && c.vorschlag_wenn.generativ !== true) fehler.push(`${c.id}: generativ fehlt`);
    }
    expect(fehler).toEqual([]);
    expect(controls.filter((c) => !c.betreiber_lite).map((c) => c.id)).toEqual(['RMF-10', 'RMF-11']);
  });
});

describe('NIST AI RMF: GenAI-Risiken und Vertrauensmerkmale', () => {
  it('12 Risiken nach AI 600-1 Abschnitt 2.1 bis 2.12', () => {
    expect(risiken).toHaveLength(12);
    risiken.forEach((r, i) => {
      expect(r.nr).toBe(i + 1);
      expect(r.abschnitt_600_1).toBe(`2.${i + 1}`);
      expect(['hoch', 'mittel', 'gering']).toContain(r.kmu_relevanz);
    });
  });

  it('Risiken: Merkmale, Controls und Subkategorien existieren; Controls und Risiken verweisen gegenseitig', () => {
    const fehler: string[] = [];
    for (const r of risiken) {
      if (!r.merkmale.length) fehler.push(`${r.id}: keine Merkmale`);
      for (const m of r.merkmale) if (!MERKMALE.includes(m)) fehler.push(`${r.id}: Merkmal ${m}`);
      for (const c of r.controls) {
        const ctl = controlNachId.get(c);
        if (!ctl) fehler.push(`${r.id}: Control ${c}`);
        else if (ctl.art === 'genai' && !ctl.risiken?.includes(r.id)) fehler.push(`${r.id}: fehlt in ${c}.risiken`);
      }
      for (const s of r.subkategorien) if (!subkIds.has(s)) fehler.push(`${r.id}: Subkategorie ${s}`);
      if (!r.controls.length && !r.praezisierung) fehler.push(`${r.id}: weder Control noch Präzisierung`);
    }
    for (const c of controls) for (const r of c.risiken ?? []) if (!risiken.find((x) => x.id === r)?.controls.includes(c.id)) fehler.push(`${c.id}: fehlt in ${r}.controls`);
    expect(fehler).toEqual([]);
  });

  it('7 Merkmale; Ziele aus NUTZEN_SCHADEN_ZIELE; alle 8 Ziele von D-09 sind zugeordnet', () => {
    const m = merkmaleDatei.merkmale;
    expect(m.map((x) => x.id)).toEqual(MERKMALE);
    expect(m.map((x) => x.abschnitt_100_1)).toEqual(['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7']);
    const ziele = new Set<string>(NUTZEN_SCHADEN_ZIELE);
    const fehler: string[] = [];
    for (const x of m) {
      for (const z of x.ziele_d09) if (!ziele.has(z)) fehler.push(`${x.id}: Ziel ${z}`);
      for (const s of x.subkategorien) if (!subkIds.has(s)) fehler.push(`${x.id}: Subkategorie ${s}`);
    }
    for (const z of merkmaleDatei.ziele_ohne_merkmal) if (!ziele.has(z.ziel)) fehler.push(`ohne Merkmal: ${z.ziel}`);
    expect(fehler).toEqual([]);
    const abgedeckt = new Set([...m.flatMap((x) => x.ziele_d09), ...merkmaleDatei.ziele_ohne_merkmal.map((z) => z.ziel)]);
    expect([...abgedeckt].sort()).toEqual([...NUTZEN_SCHADEN_ZIELE].sort());
  });
});

describe('NIST AI RMF: Stand (src/nist-rmf/stand.yaml)', () => {
  it('Fassungen, Revision, IR 8596 und Lizenz', () => {
    expect(istDatum(stand.geprueft_am)).toBe(true);
    expect(stand.hinweis_nach_monaten).toBe(6);
    expect(stand.fassungen.map((f) => f.id)).toEqual(['ai-100-1', 'ai-600-1', 'playbook']);
    const f = new Map(stand.fassungen.map((x) => [x.id, x]));
    expect(f.get('ai-100-1')).toMatchObject({ version: '1.0', datum: '2023-01-26', doi: '10.6028/NIST.AI.100-1', seiten: 48 });
    expect(f.get('ai-600-1')).toMatchObject({ datum: '2024-07', doi: '10.6028/NIST.AI.600-1', seiten: 64 });
    expect(f.get('playbook')).toMatchObject({ seiten: 147, pdf_url: 'https://airc.nist.gov/docs/AI_RMF_Playbook.pdf' });
    expect(stand.revision).toMatchObject({ status: 'angekuendigt-ohne-entwurf', geprueft_am: '2026-10-21' });
    expect(stand.weitere.find((w) => w.id === 'ir-8596')).toMatchObject({ status: 'vorentwurf', datum: '2025-12-16', im_kit: false });
    expect(stand.lizenz).toMatchObject({ status: 'gemeinfrei-us-regierungswerk', grundlage: '17 U.S.C. § 105', abbildungen_uebernehmen: false });
  });

  it('Dateinamen der Fassungen stehen in der Prüfung der PDFs; SHA-256 wie in $QUELLEN_DIR/nist/SHA256SUMS.txt', () => {
    expect(stand.pdf_pruefung.dateien.map((d) => d.datei)).toEqual(stand.fassungen.map((f) => f.datei));
    for (const d of stand.pdf_pruefung.dateien) expect(d.sha256).toMatch(/^[0-9a-f]{64}$/);
    const datei = join(process.env['QUELLEN_DIR'] ?? join(homedir(), 'work', 'iso42001-quellen'), 'nist', 'SHA256SUMS.txt');
    if (!existsSync(datei)) return;
    const summen = leseSummen(readFileSync(datei, 'utf8'));
    expect(summen.size).toBe(3);
    for (const d of stand.pdf_pruefung.dateien) expect(summen.get(d.datei), d.datei).toBe(d.sha256);
  });
});

describe('NIST AI RMF: Seitenverweise (src/nist-rmf/seiten.json)', () => {
  it('Stand und Quellnamen wie stand.yaml', () => {
    expect(seiten.stand).toBe(stand.id);
    for (const f of stand.fassungen) expect(seiten.quelle[f.id as keyof NistSeiten['quelle']]).toBe(f.datei);
    for (const f of stand.fassungen) expect(seiten.seitenzahl[f.id as keyof NistSeiten['seitenzahl']]).toBe(f.seiten);
  });

  for (const dok of ['ai-100-1', 'playbook', 'ai-600-1'] as const) {
    it(`${dok}: vollständig, gültige und aufsteigende Seiten`, () => {
      const t = seiten[dok];
      const soll = erwarteteSchluessel(dok);
      expect(Object.keys(t).sort()).toEqual([...soll].sort());
      for (const k of soll) {
        expect(Number.isInteger(t[k]), k).toBe(true);
        expect(t[k]).toBeGreaterThanOrEqual(1);
        expect(t[k]).toBeLessThanOrEqual(seiten.seitenzahl[dok]);
      }
      // Playbook ordnet die Funktionen alphabetisch (GOVERN, MANAGE, MAP, MEASURE): aufsteigend nur innerhalb der Funktion
      const gruppen = dok === 'playbook' ? ['GV', 'MP', 'MS', 'MG'].map((f) => soll.filter((k) => k.startsWith(f))) : [soll];
      for (const g of gruppen) for (let i = 1; i < g.length; i++) expect(t[g[i]!]!, g[i]).toBeGreaterThanOrEqual(t[g[i - 1]!]!);
    });
  }

  it('Stichproben aus einer unabhängigen Lesung', () => {
    expect(seiten['ai-100-1']).toMatchObject({ 'GV-1': 27, 'GV-1.1': 27, 'GV-6.2': 29, 'MP-1.1': 31, 'MS-2.6': 35, 'MG-4.3': 38 });
    expect(seiten.playbook).toMatchObject({ 'GV-1.1': 6, 'GV-6.2': 35, 'MG-1.1': 38, 'MP-1.1': 62, 'MS-1.1': 98, 'MS-4.3': 145 });
    expect(seiten['ai-600-1']).toMatchObject({ 'gai-cbrn': 9, 'gai-konfabulation': 10, 'gai-sicherheit': 14 });
  });

  it('Erkennung mit synthetischen Seiten', () => {
    const kernSeiten = ['Inhalt\nTable 1 Categories\n', 'GOVERN 1:  Text   GOVERN 1.1: Text\nsiehe GOVERN 1.2 ohne Doppelpunkt\n', 'GOVERN 1.2: Text\n'];
    expect(findeKern(kernSeiten, ['GV-1', 'GV-1.1', 'GV-1.2', 'GV-1.3'])).toEqual({ seiten: { 'GV-1': 2, 'GV-1.1': 2, 'GV-1.2': 3 }, fehlend: ['GV-1.3'] });
    const toc = Array.from({ length: 10 }, (_, i) => `GOVERN 1.${i + 1}`).join('\n');
    expect(findePlaybook([toc, 'Text\nGOVERN 1.1\nText', 'GOVERN 1.2\n'], ['GV-1.1', 'GV-1.2']).seiten).toEqual({ 'GV-1.1': 2, 'GV-1.2': 3 });
    const tocR = ['2.1. A', '2.2. B', '2.3. C', '2.4. D', '2.5. E'].join('\n');
    const r = findeRisiken([tocR, 'x\n2.1. Erstes\n2.2. Zweites', 'y\n2.10.   Zehntes'], [{ id: 'a', abschnitt: '2.1' }, { id: 'b', abschnitt: '2.2' }, { id: 'j', abschnitt: '2.10' }]);
    expect(r.seiten).toEqual({ a: 2, b: 2, j: 3 });
  });
});

describe('NIST AI RMF: Texte DE und EN (src/i18n/{de,en}/nist.yaml)', () => {
  for (const sprache of ['de', 'en'] as const) {
    const t = texte[sprache];
    const voll = (wert: unknown) => typeof wert === 'string' && wert.trim().length > 0;

    it(`${sprache}: Funktionen, Kategorien, Subkategorien vollständig und ohne fremde Schlüssel`, () => {
      const fehler: string[] = [];
      expect(Object.keys(t.funktionen)).toEqual(kern.funktionen.map((f) => f.id));
      expect(Object.keys(t.kategorien)).toEqual(kern.kategorien.map((k) => k.id));
      expect(Object.keys(t.subkategorien)).toEqual(subk.map((s) => s.id));
      for (const f of kern.funktionen) if (!voll(t.funktionen[f.id]?.titel) || !voll(t.funktionen[f.id]?.kurz)) fehler.push(`Funktion ${f.id}`);
      for (const k of kern.kategorien) if (!voll(t.kategorien[k.id]?.titel)) fehler.push(`Kategorie ${k.id}`);
      for (const s of subk) {
        const e = t.subkategorien[s.id];
        if (!voll(e?.titel)) fehler.push(`${s.id}: titel`);
        if (!Array.isArray(e?.massnahmen) || !e.massnahmen.length || !e.massnahmen.every(voll)) fehler.push(`${s.id}: massnahmen`);
        if (!Array.isArray(e?.nachweise) || !e.nachweise.length || !e.nachweise.every(voll)) fehler.push(`${s.id}: nachweise`);
        if (s.praezisierung !== undefined && !voll(e?.praezisierung)) fehler.push(`${s.id}: praezisierung`);
        if (s.praezisierung === undefined && e?.praezisierung !== undefined) fehler.push(`${s.id}: praezisierung ohne Kennzeichen`);
        if (s.revision_hinweis && !voll(e?.revision)) fehler.push(`${s.id}: revision`);
      }
      expect(fehler).toEqual([]);
    });

    it(`${sprache}: Controls, GenAI-Risiken, Merkmale und Stand vollständig`, () => {
      const fehler: string[] = [];
      expect(Object.keys(t.controls)).toEqual(controls.map((c) => c.id));
      for (const c of controls) for (const f of ['titel', 'zweck', 'umsetzung', 'nachweis']) if (!voll(t.controls[c.id]?.[f])) fehler.push(`${c.id}: ${f}`);
      expect(Object.keys(t.genai_risiken)).toEqual(risiken.map((r) => r.id));
      for (const r of risiken) {
        for (const f of ['titel', 'kmu_fall']) if (!voll(t.genai_risiken[r.id]?.[f])) fehler.push(`${r.id}: ${f}`);
        if (r.praezisierung && !voll(t.genai_risiken[r.id]?.praezisierung)) fehler.push(`${r.id}: praezisierung`);
      }
      expect(Object.keys(t.merkmale)).toEqual(MERKMALE);
      for (const m of MERKMALE) for (const f of ['titel', 'beschreibung', 'd09_hinweis']) if (!voll(t.merkmale[m]?.[f])) fehler.push(`${m}: ${f}`);
      for (const z of merkmaleDatei.ziele_ohne_merkmal) if (!voll(t.ziele_ohne_merkmal?.[z.ziel])) fehler.push(`ziele_ohne_merkmal ${z.ziel}`);
      for (const f of stand.fassungen) if (!voll(t.stand.fassungen?.[f.id])) fehler.push(`stand.fassungen ${f.id}`);
      for (const w of stand.weitere) if (!voll(t.stand.weitere?.[w.id])) fehler.push(`stand.weitere ${w.id}`);
      for (const a of stand.abgleich) if (!voll(t.stand.abgleich?.[a.id])) fehler.push(`stand.abgleich ${a.id}`);
      for (const f of ['kurz', 'botschaft', 'revision', 'veraltet', 'lizenz', 'quellenangabe', 'pdf_pruefung']) if (!voll(t.stand[f])) fehler.push(`stand.${f}`);
      expect(fehler).toEqual([]);
    });
  }

  it('DE und EN haben gleich viele Massnahmen und Nachweise je Subkategorie', () => {
    for (const s of subk) {
      expect(texte.en.subkategorien[s.id].massnahmen.length, s.id).toBe(texte.de.subkategorien[s.id].massnahmen.length);
      expect(texte.en.subkategorien[s.id].nachweise.length, s.id).toBe(texte.de.subkategorien[s.id].nachweise.length);
    }
  });

  it('eigene Kurztitel: kein Titel ist die NIST-Bezeichnung selbst', () => {
    for (const s of subk) for (const sp of ['de', 'en'] as const) expect(texte[sp].subkategorien[s.id].titel, s.id).not.toMatch(/\b(GOVERN|MAP|MEASURE|MANAGE)\b/);
  });
});

describe('NIST AI RMF: Ladelogik', () => {
  it('ladeKataloge liefert die Kataloge mit Präfix nistrmf_', () => {
    for (const n of ['nistrmf_subkategorien', 'nistrmf_rmfControls', 'nistrmf_genaiRisiken', 'nistrmf_merkmale', 'nistrmf_stand']) expect(kataloge[n], n).toBeTruthy();
    expect(kataloge['subkategorien']).toBeUndefined();
  });

  it('kit-ordner.yaml kennt Modulordner und Ordner für die NIST-Dokumente', () => {
    const ko = lies('src/kataloge/kit-ordner.yaml');
    expect(ko.sprachen.de.modul_nist).toBe('02_Modul_NIST-AI-RMF');
    expect(ko.sprachen.en.modul_nist).toBe('02_Module_NIST-AI-RMF');
    expect(ko.rechtstexte_nist).toBe('Rechtstexte_Legal-Texts/NIST-AI-RMF');
  });
});

describe('Vorschlagsliste GenAI-Sicherheit (src/kataloge/genai-risiken.yaml, ab rc.3)', () => {
  const gs = (kataloge['genaiRisiken'] as { risiken: { id: string; bereich: string; owasp?: string; nur_handelnd?: boolean; controls: string[]; nist_600_1: string[] }[] }).risiken;
  const texteGs = { de: lies('src/i18n/de/genai-risiken.yaml'), en: lies('src/i18n/en/genai-risiken.yaml') };
  it('GS-01 bis GS-22 fortlaufend, mit Bereich, gültigen Controls und Bezug auf NIST AI 600-1', () => {
    expect(gs.map((r) => r.id)).toEqual(Array.from({ length: 22 }, (_, i) => `GS-${String(i + 1).padStart(2, '0')}`));
    for (const r of gs) {
      expect(['llm', 'agenten', 'daten'], r.id).toContain(r.bereich);
      for (const c of r.controls) expect(ids42001.has(c), `${r.id} ${c}`).toBe(true);
      expect(r.nist_600_1.length, r.id).toBeGreaterThan(0);
      for (const n of r.nist_600_1) expect(risikoIds.has(n), `${r.id} ${n}`).toBe(true);
      for (const s of ['de', 'en'] as const) expect(texteGs[s][r.id]?.titel, `${s} ${r.id}`).toBeTruthy();
    }
  });
  it('OWASP-Verweise immer mit Jahr; Agenten nur handelnd mit ASI-Nummer; Datenrisiken ohne OWASP-Verweis', () => {
    for (const r of gs) {
      if (r.bereich === 'llm') expect(r.owasp, r.id).toMatch(/^LLM(0[1-9]|10):2026$/);
      if (r.bereich === 'agenten') { expect(r.owasp, r.id).toMatch(/^ASI(0[1-9]|10):2026$/); expect(r.nur_handelnd, r.id).toBe(true); }
      if (r.bereich === 'daten') expect(r.owasp, r.id).toBeUndefined();
    }
  });
});
