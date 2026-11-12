// Überblick des Guides: Stand je Etappe (vollständig, teilweise, offen), Daten der Seite «Überblick»
// (Gesamtfortschritt, Weitermachen, nächste und zurückgestellte Seiten, Zeitbezug zum Fahrplan, Prüfampel, Module).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { aktiveEtappen, aktiveSeiten, gesamtFortschritt, type Umfeld } from '../../src/app/logik/gefuehrt.ts';
import type { GefuehrtDaten, SeiteDef } from '../../src/app/logik/gefuehrt-typen.ts';
import { etappenStand, ueberblickDaten, zeitBezug } from '../../src/app/logik/ueberblick.ts';
import type { EuaiaControl } from '../../src/app/logik/vorschlaege.ts';
import type { Kataloge } from '../../src/kataloge/typen.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = <T>(rel: string): T => JSON.parse(readFileSync(join(REPO, rel), 'utf8')) as T;
const gefuehrt = json<GefuehrtDaten>('src/generiert/gefuehrt.json');
const kataloge = json<Kataloge>('src/generiert/kataloge.json');
const euaia = (kataloge['aiact_euaiaControls'] as { controls: EuaiaControl[] }).controls;
const u: Umfeld = { gefuehrt, controlIds42001: kataloge.controls42001.gruppen.flatMap((g) => g.controls.map((c) => c.id)), euaia };

const etappe = (p: Projekt, id: string) => aktiveEtappen(gefuehrt, p).find((e) => e.id === id)!;
const seitenIds = (p: Projekt, id: string) => aktiveSeiten(gefuehrt, etappe(p, id), p).filter((s): s is SeiteDef => s.typ !== 'fehlt').map((s) => s.id);
const besuche = (p: Projekt, id: string, seiten = seitenIds(p, id), spaeter: string[] = []) => {
  p.meta.gefuehrt.etappen[id] = { status: 'in-arbeit', spaeter, besucht: seiten };
};

describe('Stand je Etappe', () => {
  it('ohne besuchte Seite: offen, 0 %, Leiste «offen»', () => {
    const p = vollstaendigesProjekt();
    const st = etappenStand(etappe(p, 'E5'), p, u);
    expect(st).toMatchObject({ id: 'E5', zustand: 'offen', leiste: 'offen', erledigt: 0, prozent: 0 });
    expect(st.gesamt).toBeGreaterThan(0);
    expect(st.seiten.every((s) => s.status === 'offen')).toBe(true);
  });

  it('alle aktiven Seiten erledigt und keine Pflichtlücke: vollständig mit 100 %', () => {
    const p = vollstaendigesProjekt();
    besuche(p, 'E5');
    const st = etappenStand(etappe(p, 'E5'), p, u);
    expect(st).toMatchObject({ zustand: 'erledigt', leiste: 'erledigt', prozent: 100, luecken: 0, unvollstaendig: 0 });
    expect(st.erledigt).toBe(st.gesamt);
  });

  it('eine Seite fehlt noch: teilweise, Anteil nach erledigten Seiten', () => {
    const p = vollstaendigesProjekt();
    const ids = seitenIds(p, 'E5');
    besuche(p, 'E5', ids.slice(0, -1));
    const st = etappenStand(etappe(p, 'E5'), p, u);
    expect(st).toMatchObject({ zustand: 'teilweise', leiste: 'in-arbeit', erledigt: ids.length - 1, gesamt: ids.length });
    expect(st.prozent).toBe(Math.round((100 * (ids.length - 1)) / ids.length));
  });

  it('alle Seiten besucht, aber Pflichtangaben fehlen: nicht vollständig, Seiten «unvollstaendig»', () => {
    const p = vollstaendigesProjekt();
    besuche(p, 'E0');
    p.organisation.name = '';
    const st = etappenStand(etappe(p, 'E0'), p, u);
    expect(st.zustand).toBe('teilweise');
    expect(st.luecken).toBeGreaterThan(0);
    expect(st.seiten.find((s) => s.id === 'E0-firma')?.status).toBe('unvollstaendig');
  });

  it('auf später verschobene Seite: zählt als begonnen und als «später», nicht als erledigt', () => {
    const p = vollstaendigesProjekt();
    const ids = seitenIds(p, 'E5');
    besuche(p, 'E5', ids.slice(1), [ids[0]!]);
    const st = etappenStand(etappe(p, 'E5'), p, u);
    expect(st).toMatchObject({ zustand: 'teilweise', spaeter: 1, erledigt: ids.length - 1 });
  });

  it('der gespeicherte Status «erledigt» allein macht eine Etappe nicht vollständig', () => {
    const p = vollstaendigesProjekt();
    p.meta.gefuehrt.etappen['E5'] = { status: 'erledigt', spaeter: [], besucht: [] };
    expect(etappenStand(etappe(p, 'E5'), p, u).zustand).toBe('offen');
  });
});

describe('Daten des Überblicks', () => {
  const heute = '2026-10-21';

  it('Gesamtfortschritt stimmt mit gesamtFortschritt überein; Etappen nach Zustand gezählt', () => {
    const p = vollstaendigesProjekt();
    besuche(p, 'E5');
    besuche(p, 'E4', seitenIds(p, 'E4').slice(0, 3));
    const d = ueberblickDaten(p, u, { heute, befunde: [] });
    const g = gesamtFortschritt(p, u);
    expect(d.gesamt).toMatchObject({ erledigt: g.erledigt, gesamt: g.gesamt, vollstaendig: 1, teilweise: 1 });
    expect(d.gesamt.offen).toBe(d.etappen.length - 2);
    expect(d.gesamt.prozent).toBe(Math.round((100 * g.erledigt) / g.gesamt));
    expect(d.etappen.map((e) => e.id)).toEqual(aktiveEtappen(gefuehrt, p).map((e) => e.id));
  });

  it('Weitermachen: gemerkte Stelle mit Seitennummer; nächste offene Seiten ab dort, ohne zurückgestellte', () => {
    const p = vollstaendigesProjekt();
    const ids = seitenIds(p, 'E4');
    besuche(p, 'E4', ids.slice(0, 2), [ids[2]!]);
    p.meta.gefuehrt.aktuelleEtappe = 'E4';
    p.meta.gefuehrt.aktuelleSeite = ids[3]!;
    const d = ueberblickDaten(p, u, { heute, befunde: [] });
    expect(d.aktuell).toEqual({ etappe: 'E4', seite: ids[3], nummer: 4, anzahl: ids.length });
    expect(d.naechste[0]).toEqual({ etappe: 'E4', seite: ids[3], status: 'offen' });
    expect(d.naechste).toHaveLength(5);
    expect(d.naechste.some((n) => n.seite === ids[2])).toBe(false);
    expect(d.spaeter).toEqual([{ etappe: 'E4', seite: ids[2], status: 'spaeter' }]);
  });

  it('nächste offene Seiten laufen nach der letzten Etappe vorne weiter', () => {
    const p = vollstaendigesProjekt();
    const letzte = aktiveEtappen(gefuehrt, p).at(-1)!.id;
    for (const e of aktiveEtappen(gefuehrt, p)) if (e.id !== 'E0') besuche(p, e.id);
    p.meta.gefuehrt.aktuelleEtappe = letzte;
    const d = ueberblickDaten(p, u, { heute, befunde: [], naechsteAnzahl: 50 });
    expect(d.naechste.some((n) => n.etappe === 'E0')).toBe(true);
  });

  it('Prüfampel und Module', () => {
    const p = vollstaendigesProjekt();
    p.meta.modulNistRmf = true;
    const d = ueberblickDaten(p, u, { heute, befunde: [{ schwere: 'fehler' }, { schwere: 'hinweis' }, { schwere: 'hinweis' }] });
    expect(d.pruefung).toEqual({ ampel: 'rot', fehler: 1, hinweise: 2 });
    expect(d.module).toEqual({ aiAct: true, nistRmf: true });
    expect(ueberblickDaten(p, u, { heute, befunde: [] }).pruefung.ampel).toBe('gruen');
    expect(ueberblickDaten(p, u, { heute, befunde: [{ schwere: 'hinweis' }] }).pruefung.ampel).toBe('gelb');
  });
});

describe('Zeitbezug zum Fahrplan', () => {
  const staende = (p: Projekt) => aktiveEtappen(gefuehrt, p).map((e) => etappenStand(e, p, u));

  it('ohne Zieltermin: Kalenderwoche heute, kein Urteil über Verzug', () => {
    const p = vollstaendigesProjekt();
    delete (p.organisation as { zielterminStage1?: string }).zielterminStage1;
    const z = zeitBezug(p, u, staende(p), '2026-10-21');
    expect(z).toMatchObject({ mitTermin: false, kw: { jahr: 2026, woche: 43 }, faelligOffen: [] });
    expect(z.verzug).toBeUndefined();
  });

  it('Zieltermin mit Luft: Plan beginnt in der Woche von heute (Planwoche 1), Puffer, nicht im Verzug', () => {
    const p = vollstaendigesProjekt();
    p.organisation.zielterminStage1 = '2027-12-31';
    delete p.organisation.projektauftrag?.freigabe;
    const z = zeitBezug(p, u, staende(p), '2026-10-21');
    expect(z.mitTermin).toBe(true);
    expect(Math.floor(z.planWoche!)).toBe(1);
    expect(z.fahrplan!.puffer).toBeGreaterThan(0);
    expect(z.verzug).toBe(false);
  });

  it('mitten im Plan: Soll-Schritt heute; fällige, nicht vollständige Etappen heissen Verzug', () => {
    const p = vollstaendigesProjekt();
    const def = gefuehrt.etappen.fahrplan!;
    const wochen = def.wochen.ohne_isms;
    // Ziel so, dass heute in Planwoche 8 liegt
    const heute = '2026-10-21';
    const ziel = new Date(Date.parse(`${heute}T00:00:00Z`) + (wochen - 8) * 7 * 86_400_000).toISOString().slice(0, 10);
    p.organisation.zielterminStage1 = ziel;
    const z = zeitBezug(p, u, staende(p), heute);
    expect(z.planWoche).toBe(8);
    expect(z.sollSchritt).toBeDefined();
    expect(z.sollSchritt!.von.woche).toBeLessThanOrEqual(8);
    expect(z.sollSchritt!.bis.woche).toBeGreaterThanOrEqual(8);
    expect(z.verzug).toBe(true);
    expect(z.faelligOffen).toContain('E0');
    // Alle fälligen Etappen vollständig: nicht mehr im Verzug
    const fertig = staende(p).map((st) => (z.faelligOffen.includes(st.id) ? { ...st, zustand: 'erledigt' as const } : st));
    expect(zeitBezug(p, u, fertig, heute)).toMatchObject({ verzug: false, faelligOffen: [] });
  });

  it('nach dem Zieltermin: alle Schritte fällig', () => {
    const p = vollstaendigesProjekt();
    p.organisation.zielterminStage1 = '2026-01-30';
    const z = zeitBezug(p, u, staende(p), '2026-10-21');
    expect(z.planWoche!).toBeGreaterThan(z.wochen);
    expect(z.sollSchritt).toBeUndefined();
    expect(z.faelligOffen).toEqual(expect.arrayContaining(['E0', 'E13']));
    expect(z.verzug).toBe(true);
  });
});

describe('Knoten mit Fortschrittsform (src/grafik/svg/formen.ts)', () => {
  it('Form trägt den Zustand: Haken, Teilkreis, Dreieck, gestrichelt, hohl', async () => {
    const { fortschrittsKnoten } = await import('../../src/grafik/svg/formen.ts');
    const klassen = (z: Parameters<typeof fortschrittsKnoten>[0], a?: number) => fortschrittsKnoten(z, 7, 7, 6, a).map((k) => k.a?.['class']);
    expect(klassen('erledigt')).toEqual(['g-knoten-gut', 'g-haken']);
    expect(klassen('teilweise', 0.3)).toEqual(['g-knoten-teil', 'g-knoten-sektor']);
    expect(klassen('unvollstaendig')).toEqual(['g-knoten-warnung']);
    expect(klassen('spaeter')).toEqual(['g-knoten-spaeter']);
    expect(klassen('offen')).toEqual(['g-knoten-offen']);
    // Teilkreis: kleiner und grosser Bogen je nach Anteil, Anteil auf 15 bis 85 % begrenzt
    const bogen = (a: number) => String(fortschrittsKnoten('teilweise', 7, 7, 6, a)[1]!.a?.['d']);
    expect(bogen(0.3)).toMatch(/A5 5 0 0 1/);
    expect(bogen(0.7)).toMatch(/A5 5 0 1 1/);
    expect(bogen(0)).toBe(bogen(0.15));
    expect(bogen(1)).toBe(bogen(0.85));
  });
});
