// AIMS-Manager: Fahrplan rückwärts mit Kalenderwochen und PT-Prüfung (H3), Teilimport des KI-Ergebnisses (H11),
// Sprungziele der Prüfregeln H19 bis H23, Listen ohne Eintrag («nicht nötig»), Rückweg zur Prüfung in der Route.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { alles, teilimportAnwenden, teilimportMoeglich, teilimportPruefen, vergleiche } from '../../src/app/import/teilimport.ts';
import { berechneFahrplan, erweiterterUmfang, kalenderwoche, montag } from '../../src/app/logik/fahrplan.ts';
import { aktiveEtappen, nichtNoetigMoeglich, pflichtLuecken, seitenIndex, type Umfeld } from '../../src/app/logik/gefuehrt.ts';
import type { FahrplanDef, GefuehrtDaten } from '../../src/app/logik/gefuehrt-typen.ts';
import { gefuehrtSprung } from '../../src/app/logik/pruefsprung.ts';
import { parseRoute, routeZuHash, sprungRoute } from '../../src/app/logik/routen.ts';
import { formularFelder, sichtbareFelder } from '../../src/app/logik/formularfelder.ts';
import { pruefeProjekt, type Regel } from '../../src/regeln/pruefungen.ts';
import type { EuaiaControl } from '../../src/app/logik/vorschlaege.ts';
import type { Kataloge } from '../../src/kataloge/typen.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import type { Folgenabschaetzung, Projekt } from '../../src/model/typen.ts';
import { neuerEintrag } from '../../src/app/logik/eintraege.ts';
import { kiSystem, vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = <T>(rel: string): T => JSON.parse(readFileSync(join(REPO, rel), 'utf8')) as T;
const gefuehrt = json<GefuehrtDaten>('src/generiert/gefuehrt.json');
const kataloge = json<Kataloge>('src/generiert/kataloge.json');
const euaia = (kataloge['aiact_euaiaControls'] as { controls: EuaiaControl[] }).controls;
const u: Umfeld = { gefuehrt, controlIds42001: kataloge.controls42001.gruppen.flatMap((g) => g.controls.map((c) => c.id)), euaia };
const def = gefuehrt.etappen.fahrplan as FahrplanDef;

function projekt(mitIsms: boolean, o: { ziel?: string; pensum?: number; freigabe?: string } = {}): Projekt {
  const p = leeresProjekt({ mitIsms, modulAiAct: false, jetzt: '2026-10-20T08:00:00Z' });
  if (o.ziel) p.organisation.zielterminStage1 = o.ziel;
  p.organisation.projektauftrag = { ...(o.pensum !== undefined ? { pensumProzent: o.pensum } : {}), ...(o.freigabe ? { freigabe: { von: 'P-001', am: o.freigabe } } : {}) };
  return p;
}
const plan = (p: Projekt, heute = '2026-10-20') => berechneFahrplan(p, def, aktiveEtappen(gefuehrt, p), heute);

describe('Kalenderwochen', () => {
  it('rechnet nach ISO 8601 (KW 1 mit dem ersten Donnerstag, Jahreswechsel)', () => {
    expect(kalenderwoche('2026-10-20')).toEqual({ jahr: 2026, woche: 43 });
    expect(kalenderwoche('2027-01-01')).toEqual({ jahr: 2026, woche: 53 });
    expect(kalenderwoche('2027-01-04')).toEqual({ jahr: 2027, woche: 1 });
    expect(kalenderwoche('2025-12-29')).toEqual({ jahr: 2026, woche: 1 });
    expect(montag('2026-10-25')).toBe('2026-10-19');
    expect(montag('2026-10-19')).toBe('2026-10-19');
  });
});

describe('Fahrplan rückwärts vom Ziel Stage-1-Bereitschaft (H3, K5)', () => {
  it('mit ISMS: 13 Wochen, Woche 13 ist die Woche des Ziels, Schritte mit Kalenderwochen aus schritte.yaml', () => {
    // heute in der rückwärts gerechneten Startwoche: Plan genau rückwärts vom Ziel, kein Puffer
    const f = plan(projekt(true, { ziel: '2027-03-26', pensum: 40 }), '2026-12-28');
    expect(f.puffer).toBe(0);
    expect(f.wochen).toBe(13);
    expect(f.start).toBe('2026-12-28');
    expect(f.schritte).toHaveLength(10);
    const s1 = f.schritte[0]!;
    expect(s1.etappen).toEqual(['E0', 'E1']);
    expect(s1.von).toMatchObject({ woche: 1, montag: '2026-12-28', kw: { jahr: 2026, woche: 53 } });
    const s10 = f.schritte[9]!;
    expect(s10.bis).toMatchObject({ woche: 13, montag: '2027-03-22', freitag: '2027-03-26' });
    expect(f.schritte[5]!.etappen).toEqual(['E6', 'E7']);
    expect(f.pt).toEqual([25, 35]);
    expect(f.meilensteine.find((m) => m.id === 'stage1')!.zeit.woche).toBe(13);
    expect(f.meilensteine.find((m) => m.id === 'offerten')!.zeit.woche).toBe(4);
    expect(f.meilensteine.some((m) => m.id === 'lenkung')).toBe(false);
    expect(f.freigaben.find((x) => x.id === 'auftrag')!.vorlagen).toEqual(['D-00']);
  });

  it('Zieltermin mit Luft: Plan beginnt in der Woche von heute, Puffer bis zum Ziel (Rollentest RT-06)', () => {
    const f = plan(projekt(true, { ziel: '2027-06-30', pensum: 40 }), '2026-10-22');
    expect(f.start).toBe('2026-10-19');
    expect(f.puffer).toBeGreaterThan(20);
    expect(f.startVorbei).toBe(false);
    const stage1 = f.meilensteine.find((m) => m.id === 'stage1')!.zeit;
    expect(stage1.freitag! <= '2027-06-30').toBe(true);
  });

  it('Woche des Ziels endet am Zieltermin, nicht am Freitag danach', () => {
    const f = plan(projekt(true, { ziel: '2027-03-24', pensum: 40 }), '2027-01-04');
    expect(f.puffer).toBe(0);
    expect(f.meilensteine.find((m) => m.id === 'stage1')!.zeit.freitag).toBe('2027-03-24');
  });

  it('ohne ISMS: 22 Wochen, 45 bis 65 PT, Kurzfassung D-26 in Woche 2', () => {
    const f = plan(projekt(false, { ziel: '2027-05-28' }));
    expect(f.wochen).toBe(22);
    expect(f.pt).toEqual([45, 65]);
    expect(f.meilensteine.find((m) => m.id === 'lenkung')!.zeit.woche).toBe(2);
    expect(f.freigaben.find((x) => x.id === 'auftrag')!.vorlagen).toEqual(['D-00', 'D-26']);
    expect(f.ptStand).toBe('ohne-pensum');
  });

  it('PT-Prüfung mit Pensum: 40 % reicht für 90 Tage, 20 % nicht; gerechnet ab Auftragsfreigabe', () => {
    // 13 Wochen ab Freigabe, rund 91 Tage: 65 Arbeitstage
    expect(plan(projekt(true, { ziel: '2027-03-26', pensum: 40, freigabe: '2026-12-25' }))).toMatchObject({ ptStand: 'ok', abAuftrag: true, ptAims: [15, 21] });
    expect(plan(projekt(true, { ziel: '2027-03-26', pensum: 25, freigabe: '2026-12-25' })).ptStand).toBe('knapp');
    const knapp = plan(projekt(true, { ziel: '2027-03-26', pensum: 20, freigabe: '2026-12-25' }));
    expect(knapp.ptStand).toBe('reicht-nicht');
    expect(knapp.kapazitaet).toBeCloseTo(13, 0);
    // ohne ISMS bei 20 %: rund 9 Monate nötig (Leitfaden Kapitel 4)
    expect(plan(projekt(false, { ziel: '2027-03-31', pensum: 20 })).ptStand).toBe('reicht-nicht');
    expect(plan(projekt(false, { ziel: '2027-05-31', pensum: 20 })).ptStand).toBe('knapp');
    expect(plan(projekt(false, { ziel: '2027-08-31', pensum: 20 })).ptStand).toBe('ok');
  });

  it('Ziel zu nah: Planstart liegt vor heute', () => {
    expect(plan(projekt(true, { ziel: '2026-12-18', pensum: 50 })).startVorbei).toBe(true);
    expect(plan(projekt(true, { ziel: '2027-06-30', pensum: 50 })).startVorbei).toBe(false);
  });

  it('ohne Ziel: Wochen des Plans ohne Kalenderdaten', () => {
    const f = plan(projekt(true));
    expect(f.ziel).toBeUndefined();
    expect(f.schritte[0]!.von.kw).toBeUndefined();
    expect(f.ptStand).toBe('ohne-termin');
  });

  it('erweiterter Umfang mit ISMS: rund 6 Monate (26 Wochen) und 45 bis 55 PT', () => {
    const p = projekt(true, { ziel: '2027-06-25', pensum: 40 });
    p.organisation.verkauftKiProdukte = true;
    p.kiSysteme = [kiSystem({ id: 'KI-001', aiAct: { ...kiSystem().aiAct, risikoklasse: 'hochrisiko-anhang-iii' } })];
    expect(erweiterterUmfang(p)).toEqual(['produkt', 'hochrisiko']);
    const f = plan(p);
    expect(f).toMatchObject({ gestreckt: true, wochen: 26, pt: [45, 55] });
    expect(f.schritte[0]!.bis.woche).toBe(2);
    expect(f.schritte[9]!.bis.woche).toBe(26);
    expect(f.meilensteine.find((m) => m.id === 'stage1')!.zeit.woche).toBe(26);
    // ohne ISMS bleibt der Plan, mit Hinweis
    const o = projekt(false, { ziel: '2027-06-25' });
    o.organisation.verkauftKiProdukte = true;
    expect(plan(o)).toMatchObject({ gestreckt: false, wochen: 22, erweitert: ['produkt'] });
  });
});

describe('Teilimport des KI-Ergebnisses (H11)', () => {
  const basis = () => vollstaendigesProjekt();
  it('nur bei gleicher meta.projektId und gleicher oder älterer Schemaversion', () => {
    const p = basis();
    expect(teilimportMoeglich(p, { schemaVersion: p.schemaVersion, meta: { projektId: p.meta.projektId } })).toBe(true);
    // AF-003: fehlende Version wird mit Meldung abgelehnt (tests/unit/teilimport-migration.test.ts)
    expect(teilimportMoeglich(p, { meta: { projektId: p.meta.projektId } })).toBe(false);
    expect(teilimportMoeglich(p, { meta: { projektId: 'anderes' } })).toBe(false);
    expect(teilimportMoeglich(p, { schemaVersion: 99, meta: { projektId: p.meta.projektId } })).toBe(false);
    expect(teilimportMoeglich(null, { meta: { projektId: p.meta.projektId } })).toBe(false);
  });

  it('Auszug: zeigt neue und geänderte Einträge, übernimmt nur die gewählten, andere Listen bleiben', () => {
    const p = basis();
    const ki = structuredClone(p.kiSysteme[0]!);
    ki.zweck = 'Geänderter Zweck';
    const neu = kiSystem({ id: 'KI-099', name: 'Neues System' });
    const risikoAlt = structuredClone(p.risiken);
    const auszug = { meta: { projektId: p.meta.projektId }, kiSysteme: [ki, neu], organisation: { name: 'Neuer Name' } } as Record<string, unknown>;
    const v = vergleiche(p, auszug);
    expect(v.listen).toEqual([{ liste: 'kiSysteme', gleich: 0, eintraege: [{ id: ki.id, titel: ki.name, art: 'geaendert' }, { id: 'KI-099', titel: 'Neues System', art: 'neu' }] }]);
    expect(v.bereiche).toEqual([{ pfad: 'organisation.name', art: 'geaendert' }]);
    // nur das neue System, ohne Firmenname
    const r = teilimportPruefen(p, auszug, { eintraege: { kiSysteme: ['KI-099'] }, bereiche: [] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.projekt.kiSysteme.map((s) => s.id)).toEqual([...p.kiSysteme.map((s) => s.id), 'KI-099']);
    expect(r.projekt.kiSysteme[0]!.zweck).toBe(p.kiSysteme[0]!.zweck);
    expect(r.projekt.organisation.name).toBe(p.organisation.name);
    expect(r.projekt.risiken).toEqual(risikoAlt);
    // offenes Projekt bleibt unverändert
    expect(p.kiSysteme.some((s) => s.id === 'KI-099')).toBe(false);
    // alles gewählt: Eintrag mit gleicher ID ersetzt, Bereich übernommen
    const a = teilimportAnwenden(p, auszug, alles(v));
    expect(a.kiSysteme[0]!.zweck).toBe('Geänderter Zweck');
    expect(a.organisation.name).toBe('Neuer Name');
  });

  it('unveränderte Einträge zählen als gleich, auch bei anderer Reihenfolge der Schlüssel', () => {
    const p = basis();
    const umgestellt = Object.fromEntries(Object.entries(p.kiSysteme[0]!).reverse());
    const v = vergleiche(p, { meta: { projektId: p.meta.projektId }, kiSysteme: [umgestellt] });
    expect(v.listen).toEqual([{ liste: 'kiSysteme', gleich: 1, eintraege: [] }]);
  });

  it('prüft das zusammengeführte Projekt gegen das Schema', () => {
    const p = basis();
    const falsch = { ...kiSystem({ id: 'KI-098' }), typ: 'unbekannt' };
    const r = teilimportPruefen(p, { meta: { projektId: p.meta.projektId }, kiSysteme: [falsch] }, { eintraege: { kiSysteme: ['KI-098'] }, bereiche: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.details.join(' ')).toMatch(/kiSysteme\[\d+\]\.typ/);
  });

  it('Checklisten werden je Schlüssel ergänzt', () => {
    const p = basis();
    p.meta.checklisten['E1-c1'] = { erledigt: true };
    const a = teilimportAnwenden(p, { meta: { projektId: p.meta.projektId, checklisten: { 'E2-c1': { erledigt: true } } } }, { eintraege: {}, bereiche: ['meta.checklisten'] });
    expect(Object.keys(a.meta.checklisten).sort()).toEqual(['E1-c1', 'E2-c1']);
  });
});

describe('Sprungziele H19 bis H23', () => {
  it('führen auf die Seiten der Freigaben bzw. der Rolle', () => {
    const p = vollstaendigesProjekt();
    p.meta.mitIsms = false;
    const fa = neuerEintrag(p, 'folgenabschaetzungen', { kiSystem: p.kiSysteme[0]!.id }) as unknown as Folgenabschaetzung;
    p.folgenabschaetzungen.push(fa);
    expect(gefuehrtSprung({ regel: 'H19', id: fa.kiSystem }, p, gefuehrt)).toEqual({ art: 'gefuehrt', etappe: 'E7', seite: 'E7-freigabe', eintrag: fa.id });
    expect(gefuehrtSprung({ regel: 'H22', id: fa.id }, p, gefuehrt)).toMatchObject({ seite: 'E7-freigabe', eintrag: fa.id });
    expect(gefuehrtSprung({ regel: 'H20', id: 'D-07' }, p, gefuehrt)).toMatchObject({ seite: 'E8-plan-freigabe' });
    expect(gefuehrtSprung({ regel: 'H21', id: 'D-11' }, p, gefuehrt)).toMatchObject({ seite: 'E8-soa' });
    expect(gefuehrtSprung({ regel: 'H23' }, p, gefuehrt)).toEqual({ art: 'gefuehrt', etappe: 'E5', seite: 'E5-rolle' });
    p.meta.mitIsms = true;
    expect(gefuehrtSprung({ regel: 'H20', id: 'D-07-EB' }, p, gefuehrt)).toMatchObject({ seite: 'E8-plan-freigabe-eb' });
    // F03: zur ersten Lücke der vollständigen Abschätzung
    expect(gefuehrtSprung({ regel: 'F03', id: fa.kiSystem }, p, gefuehrt)).toMatchObject({ seite: 'E7-triage-ergebnis' });
    fa.triage.ergebnis = 'voll';
    fa.betroffene = [];
    expect(gefuehrtSprung({ regel: 'F03', id: fa.kiSystem }, p, gefuehrt)).toMatchObject({ seite: 'E7-betroffene', eintrag: fa.id });
    fa.betroffene = [{ gruppe: 'Bewerbende', art: 'direkt', wirkung: 'Vorauswahl', konsultiert: false }];
    expect(gefuehrtSprung({ regel: 'F03', id: fa.kiSystem }, p, gefuehrt)).toMatchObject({ seite: 'E7-ziele-a' });
  });
});

describe('Listen ohne Eintrag als «nicht nötig»', () => {
  it('Listenseite mit Pflichtfeldern ohne Eintrag gilt mit Vermerk als vollständig, nicht beim KI-Inventar', () => {
    const p = leeresProjekt({ mitIsms: false, modulAiAct: false });
    const index = seitenIndex(gefuehrt);
    const s = index.get('E12-feststellungen')!;
    expect(pflichtLuecken(s, p, u)).toEqual([{ feld: '*' }]);
    p.meta.gefuehrt.nichtNoetig = ['E12-feststellungen'];
    expect(pflichtLuecken(s, p, u)).toEqual([]);
    expect(nichtNoetigMoeglich(index.get('E4-systeme')!)).toBe(false);
    p.meta.gefuehrt.nichtNoetig = ['E4-systeme'];
    expect(pflichtLuecken(index.get('E4-systeme')!, p, u)).toEqual([{ feld: '*' }]);
  });
});

describe('Route mit Rückweg', () => {
  it('trägt die Herkunft eines Sprungs mit', () => {
    const r = { art: 'gefuehrt' as const, etappe: 'E7', seite: 'E7-freigabe', eintrag: 'IA-001', von: 'gefuehrt-pruefung' };
    expect(routeZuHash(r)).toBe('#/gefuehrt/E7/E7-freigabe?eintrag=IA-001&von=gefuehrt-pruefung');
    expect(parseRoute(routeZuHash(r))).toEqual(r);
    expect(routeZuHash({ art: 'gefuehrt', etappe: 'E4', seite: 'E4-systeme' })).toBe('#/gefuehrt/E4/E4-systeme');
  });
});

// P14 Nacharbeit M1 (AF-104): Antrag, Entscheid, Entdeckung und Eindämmung im Werkzeug erfassbar; F43 springt ins Feld
describe('P14: Felder der Schemaversion 3 im Guide und im Formular, Sprung von F43 ins Feld', () => {
  const index = seitenIndex(gefuehrt);
  const felder = (seite: string) => index.get(seite)!.felder!.map((f) => [f.pfad, f.typ]);
  const texte = (s: 'de' | 'en', etappe: string) =>
    (parse(readFileSync(join(REPO, `src/i18n/${s}/gefuehrt/${etappe}.yaml`), 'utf8')) as Record<string, { felder: Record<string, { label?: string; hilfe?: string }> }>);
  const regeln = (parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')) as { regeln: Regel[] }).regeln;
  const f43 = (p: Projekt) =>
    pruefeProjekt(regeln, { projekt: p, heute: '2027-02-15', controlIds42001: u.controlIds42001, aiActStand: '2026-07-27', kataloge }).filter((b) => b.regel === 'F43');

  it('E4-ueberpruefung: «Antrag am» und «Entscheid am» als Datum; E12-feststellungen: Entdeckung und Eindämmung als Zeitpunkt, DE und EN', () => {
    expect(felder('E4-ueberpruefung')).toEqual(expect.arrayContaining([['antragAm', 'datum'], ['entscheidAm', 'datum']]));
    expect(felder('E12-feststellungen')).toEqual(expect.arrayContaining([['entdecktAm', 'zeitpunkt'], ['eingedaemmtAm', 'zeitpunkt']]));
    for (const s of ['de', 'en'] as const) {
      for (const k of ['antragAm', 'entscheidAm']) expect(texte(s, 'E4')['E4-ueberpruefung']!.felder[k]?.label, `${s} ${k}`).toBeTruthy();
      for (const k of ['entdecktAm', 'eingedaemmtAm']) expect(texte(s, 'E12')['E12-feststellungen']!.felder[k]?.hilfe, `${s} ${k}`).toMatch(/PR-19/);
    }
  });

  it('Formular: Inventar zeigt Antrag und Entscheid; Feststellungen zeigen die Zeitpunkte nur bei Vorfall und Beinahe-Vorfall', () => {
    const p = vollstaendigesProjekt();
    const inv = sichtbareFelder(formularFelder(gefuehrt, 'kiSysteme'), p, p.kiSysteme[0]).map((f) => f.feld.pfad);
    expect(inv).toEqual(expect.arrayContaining(['antragAm', 'entscheidAm']));
    const fs = formularFelder(gefuehrt, 'feststellungen');
    const sicht = (quelle: string) => sichtbareFelder(fs, p, { id: 'F-001', quelle }).map((f) => f.feld.pfad);
    for (const q of ['vorfall', 'beinahe-vorfall']) expect(sicht(q)).toEqual(expect.arrayContaining(['entdecktAm', 'eingedaemmtAm']));
    expect(sicht('audit')).not.toContain('entdecktAm');
    expect(sicht('audit')).not.toContain('eingedaemmtAm');
  });

  it('F43 PR-07: Sprung ins Inventar zum Feld «Antrag am» des entschiedenen Systems (Guide und Formular)', () => {
    const p = vollstaendigesProjekt();
    p.kennzahlMessungen = [{ kennzahl: 'PR-07', datum: '2026-12-31', wert: '5 Tage', sollErreicht: 'ja' }];
    const [b] = f43(p);
    expect(b).toMatchObject({ id: 'PR-07', bereich: 'inventar', eintrag: 'KI-001', feld: 'antragAm', ziel: 'inventar/KI-001' });
    expect(gefuehrtSprung(b!, p, gefuehrt)).toEqual({ art: 'gefuehrt', etappe: 'E4', seite: 'E4-ueberpruefung', eintrag: 'KI-001', feld: 'antragAm' });
    expect(sprungRoute(b!.ziel)).toMatchObject({ art: 'formular', modul: 'inventar', id: 'KI-001' });
    // Antrag da, Entscheid fehlt: zum Feld «Entscheid am»
    p.kiSysteme[0]!.antragAm = '2026-09-01';
    expect(f43(p)[0]).toMatchObject({ eintrag: 'KI-001', feld: 'entscheidAm' });
  });

  it('F43 PR-19: Sprung zu den Vorfällen, zum ersten Vorfall ohne Zeitpunkt und dort ins fehlende Feld', () => {
    const p = vollstaendigesProjekt();
    p.feststellungen.push({ id: 'F-001', quelle: 'vorfall', einstufung: 'nk-leicht', beschreibung: 'Falsche Antwort', normbezug: 'A.8.4', korrektur: 'k', ursache: 'u', massnahmen: [], status: 'offen', datum: '2026-11-03', entdecktAm: '2026-11-03T09:40' });
    p.kennzahlMessungen = [{ kennzahl: 'PR-19', datum: '2026-12-31', wert: '6 Stunden', sollErreicht: 'ja' }];
    const [b] = f43(p);
    expect(b).toMatchObject({ id: 'PR-19', bereich: 'feststellungen', eintrag: 'F-001', feld: 'eingedaemmtAm', ziel: 'feststellungen/F-001' });
    expect(gefuehrtSprung(b!, p, gefuehrt)).toEqual({ art: 'gefuehrt', etappe: 'E12', seite: 'E12-feststellungen', eintrag: 'F-001', feld: 'eingedaemmtAm' });
    expect(sprungRoute(b!.ziel)).toMatchObject({ art: 'gefuehrt', seite: 'E12-feststellungen', eintrag: 'F-001' });
  });

  it('Route mit Feld: hin und zurück', () => {
    const r = { art: 'gefuehrt', etappe: 'E4', seite: 'E4-ueberpruefung', eintrag: 'KI-001', feld: 'antragAm' } as const;
    expect(routeZuHash(r)).toBe('#/gefuehrt/E4/E4-ueberpruefung?eintrag=KI-001&feld=antragAm');
    expect(parseRoute(routeZuHash(r))).toEqual(r);
  });
});
