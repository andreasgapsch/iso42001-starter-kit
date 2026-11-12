// Eine Zählweise für den Fortschritt (AF-081, QK-49): Guide, Punkteleiste (Lagebild), Übersicht, Prüfung, Bereitschaft und
// Bericht zeigen für dieselben Daten dieselbe Zahl. Leseseiten gelten beim Besuch, Termine in der Zukunft nicht als erledigt.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ohneFreigabeIds } from '../../src/app/ansichten/pruefung/stage1.ts';
import { bereitschaftBerechnen } from '../../src/app/logik/bereitschaft.ts';
import { kapitelFortschritt, type KatalogAusschnitt } from '../../src/app/logik/fortschritt.ts';
import { aktiveEtappen, aktiveSeiten, etappenFortschritt, gesamtFortschritt, OHNE_FORTSCHRITT, seitenStatus, type Umfeld } from '../../src/app/logik/gefuehrt.ts';
import type { GefuehrtDaten, SeiteDef } from '../../src/app/logik/gefuehrt-typen.ts';
import { etappenStand, ueberblickDaten } from '../../src/app/logik/ueberblick.ts';
import type { EuaiaControl } from '../../src/app/logik/vorschlaege.ts';
import type { Kataloge } from '../../src/kataloge/typen.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = <T>(rel: string): T => JSON.parse(readFileSync(join(REPO, rel), 'utf8')) as T;
const gefuehrt = json<GefuehrtDaten>('src/generiert/gefuehrt.json');
const kataloge = json<Kataloge>('src/generiert/kataloge.json');
const euaia = (kataloge['aiact_euaiaControls'] as { controls: EuaiaControl[] }).controls;
const basis: Umfeld = { gefuehrt, controlIds42001: kataloge.controls42001.gruppen.flatMap((g) => g.controls.map((c) => c.id)), euaia };
const HEUTE = '2026-10-20';
const mitStichtag: Umfeld = { ...basis, heute: () => HEUTE };

const seiten = (p: Projekt, id: string) => aktiveSeiten(gefuehrt, aktiveEtappen(gefuehrt, p).find((e) => e.id === id)!, p).filter((s): s is SeiteDef => s.typ !== 'fehlt');
const besuche = (p: Projekt, id: string, ids = seiten(p, id).map((s) => s.id)) => { p.meta.gefuehrt.etappen[id] = { status: 'in-arbeit', spaeter: [], besucht: ids }; };

/** Zahl «erledigt von gesamt» je Anzeigeort für alle aktiven Etappen */
function anzeigeorte(p: Projekt, u: Umfeld) {
  const index = undefined;
  const etappen = aktiveEtappen(gefuehrt, p);
  const guide = etappen.map((e) => etappenFortschritt(e, p, u, index));
  const stand = etappen.map((e) => etappenStand(e, p, u, index));
  const ueberblick = ueberblickDaten(p, u, { heute: HEUTE, befunde: [] });
  const g = gesamtFortschritt(p, u);
  const k = kapitelFortschritt(p, u, kataloge as unknown as KatalogAusschnitt);
  const bereit = bereitschaftBerechnen(p, u, [], []);
  return { etappen, guide, stand, ueberblick, g, k, bereit };
}

describe('AF-081: eine Zählweise für alle Anzeigeorte', () => {
  it('Guide, Punkteleiste, Übersicht und Gesamtstand zählen je Etappe gleich (Abweichungen 0)', () => {
    const p = vollstaendigesProjekt();
    besuche(p, 'E0');
    besuche(p, 'E5');
    besuche(p, 'E8', seiten(p, 'E8').slice(0, 2).map((s) => s.id));
    const a = anzeigeorte(p, mitStichtag);
    const abw: string[] = [];
    a.etappen.forEach((e, i) => {
      const gu = a.guide[i]!;
      const st = a.stand[i]!;
      const ub = a.ueberblick.etappen[i]!;
      const zaehlt = st.seiten.filter((s) => s.status === 'erledigt').length;
      for (const [ort, w] of [['Stand', [st.erledigt, st.gesamt]], ['Übersicht', [ub.erledigt, ub.gesamt]], ['Seitenliste', [zaehlt, st.seiten.length]]] as const) {
        if (w[0] !== gu.erledigt || w[1] !== gu.gesamt) abw.push(`${e.id} ${ort}: ${w.join('/')} statt ${gu.erledigt}/${gu.gesamt}`);
      }
    });
    expect(abw).toEqual([]);
    expect(a.ueberblick.gesamt.erledigt).toBe(a.g.erledigt);
    expect(a.ueberblick.gesamt.gesamt).toBe(a.g.gesamt);
  });

  it('Seiten ohne Fortschritt (Dokumentgestaltung) fehlen in Seitenliste und Bereitschaft, wie im Guide', () => {
    const p = vollstaendigesProjekt();
    const e0 = aktiveEtappen(gefuehrt, p).find((e) => e.id === 'E0')!;
    expect(seiten(p, 'E0').some((s) => OHNE_FORTSCHRITT.has(s.typ))).toBe(true);
    besuche(p, 'E0', seiten(p, 'E0').filter((s) => !OHNE_FORTSCHRITT.has(s.typ)).map((s) => s.id));
    const st = etappenStand(e0, p, basis);
    expect(st.seiten.some((s) => seiten(p, 'E0').find((x) => x.id === s.id && OHNE_FORTSCHRITT.has(x.typ)))).toBe(false);
    expect(st.seiten.length).toBe(etappenFortschritt(e0, p, basis).gesamt);
    // Alle Seiten der Zählung besucht: keine Lücke der Etappe E0 in der Bereitschaft wegen der Gestaltungsseite
    const l = bereitschaftBerechnen(p, basis, [], []).luecken.find((x) => x.art === 'etappe' && x.id === 'E0');
    expect(l?.gesamt ?? st.gesamt).toBe(st.gesamt);
  });

  it('Leseseiten gelten beim Besuch als erledigt, vorher nicht', () => {
    const p = vollstaendigesProjekt();
    const info = seiten(p, 'E1').find((s) => s.typ === 'info');
    expect(info, 'E1 hat eine Leseseite').toBeDefined();
    expect(seitenStatus(info!, 'E1', p, basis)).toBe('offen');
    p.meta.gefuehrt.etappen['E1'] = { status: 'in-arbeit', spaeter: [], besucht: [info!.id] };
    expect(seitenStatus(info!, 'E1', p, basis)).toBe('erledigt');
    const e1 = aktiveEtappen(gefuehrt, p).find((e) => e.id === 'E1')!;
    expect(etappenStand(e1, p, basis).seiten.find((s) => s.id === info!.id)?.status).toBe('erledigt');
    expect(etappenFortschritt(e1, p, basis).erledigt).toBeGreaterThanOrEqual(1);
  });

  it('Freigabe mit Datum in der Zukunft zählt nicht als erledigt (Guide, Stand, Übersicht), mit Datum von heute schon', () => {
    const zaehle = (am: string, u: Umfeld) => {
      const p = vollstaendigesProjekt();
      besuche(p, 'E8');
      p.risiken[0]!.restrisikoAkzeptiert = { von: 'P-001', am };
      const e8 = aktiveEtappen(gefuehrt, p).find((e) => e.id === 'E8')!;
      const f = etappenFortschritt(e8, p, u);
      const s = etappenStand(e8, p, u);
      const o = ueberblickDaten(p, u, { heute: HEUTE, befunde: [] }).etappen.find((x) => x.id === 'E8')!;
      return { guide: f.erledigt, stand: s.erledigt, uebersicht: o.erledigt, gesamt: f.gesamt, zustand: s.zustand, luecken: s.luecken };
    };
    const gestern = zaehle('2026-10-19', mitStichtag);
    const zukunft = zaehle('2099-01-01', mitStichtag);
    // Genau die Seite mit dem Termin in der Zukunft fällt aus der Zählung, an allen Orten gleich
    expect(gestern).toMatchObject({ stand: gestern.guide, uebersicht: gestern.guide });
    expect(zukunft).toMatchObject({ guide: gestern.guide - 1, stand: gestern.guide - 1, uebersicht: gestern.guide - 1 });
    expect(zukunft.luecken).toBeGreaterThan(gestern.luecken);
    // Ohne Stichtag (reine Strukturtests) gilt jedes Datum
    expect(zaehle('2099-01-01', basis).guide).toBe(gestern.guide);
  });

  it('Bereitschaft: Zukunftstermin ist eine Lücke der Etappe, Dokument mit Freigabe in der Zukunft steht ohne Freigabe (wie im Bericht)', () => {
    const p = vollstaendigesProjekt();
    besuche(p, 'E8');
    p.risiken[0]!.restrisikoAkzeptiert = { von: 'P-001', am: '2099-01-01' };
    const luecke = (u: Umfeld) => bereitschaftBerechnen(structuredClone(p), u, [], []).luecken.find((l) => l.art === 'etappe' && l.id === 'E8');
    expect(luecke(mitStichtag)!.erledigt).toBe(luecke(basis)!.erledigt! - 1);
    const q = vollstaendigesProjekt();
    const ids = ohneFreigabeIds(q, kataloge, HEUTE);
    const d07 = q.dokumente.find((d) => d.id === 'D-07')!;
    d07.freigabe = { von: 'P-001', am: '2099-01-01' };
    const mit = ohneFreigabeIds(q, kataloge, HEUTE);
    expect(mit.filter((x) => x === 'D-07').length).toBe(1);
    expect(ids.includes('D-07')).toBe(false);
    expect(ohneFreigabeIds(q, kataloge).includes('D-07')).toBe(false);
  });
});

describe('AF-081: eigener Hinweis bei Freigabe in der Zukunft (N4)', () => {
  const e8 = (p: Projekt) => seiten(p, 'E8').find((s) => s.id === 'E8-restrisiko' || s.liste === 'risiken' && s.typ === 'liste' && (s.felder ?? []).some((f) => f.typ === 'freigabe'))!;
  it('ausgefüllte Freigabe mit Datum nach dem Stichtag: Lücke mit Marke «zukunft»; leere Freigabe: Lücke ohne Marke', async () => {
    const { pflichtLuecken } = await import('../../src/app/logik/gefuehrt.ts');
    const p = vollstaendigesProjekt();
    p.risiken[0]!.restrisikoAkzeptiert = { von: 'P-001', am: '2099-01-01' };
    const seite = e8(p);
    const zukunft = pflichtLuecken(seite, p, mitStichtag).filter((l) => l.eintrag === p.risiken[0]!.id);
    expect(zukunft.map((l) => l.zukunft)).toEqual([true]);
    const q = vollstaendigesProjekt();
    delete q.risiken[0]!.restrisikoAkzeptiert;
    const leer = pflichtLuecken(seite, q, mitStichtag).filter((l) => l.eintrag === q.risiken[0]!.id);
    expect(leer.length).toBe(1);
    expect(leer[0]!.zukunft).toBeUndefined();
  });
  it('Text in DE und EN vorhanden und verschieden vom Text für fehlende Angaben', () => {
    for (const sp of ['de', 'en']) {
      const t = readFileSync(join(REPO, `src/i18n/${sp}/app.yaml`), 'utf8');
      expect(t).toMatch(/pflicht_zukunft: "[^"]{20,}"/);
    }
  });
});

describe('AF-081: Punkteleiste (Kapitel) und Bericht zählen gleich (N5)', () => {
  it('kapitelFortschritt gegen stage1Bericht: dieselben erledigten und gesamten Seiten je Etappe (Abweichungen 0)', async () => {
    const { stage1Bericht } = await import('../../src/app/ansichten/pruefung/stage1.ts');
    const { ladeTexte } = await import('../../src/i18n/laden-node.ts');
    const { erstelleUebersetzer } = await import('../../src/i18n/texte.ts');
    const { ladeKataloge } = await import('../../src/kataloge/laden-node.ts');
    const { parse } = await import('yaml');
    const regeln = (parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')) as { regeln: never[] }).regeln;
    const p = vollstaendigesProjekt();
    besuche(p, 'E0');
    besuche(p, 'E5');
    besuche(p, 'E8', seiten(p, 'E8').slice(0, 3).map((s) => s.id));
    p.risiken[0]!.restrisikoAkzeptiert = { von: 'P-001', am: '2099-01-01' };
    const b = stage1Bericht(p, { u: erstelleUebersetzer('de', ladeTexte('de')), umfeld: mitStichtag, kataloge: ladeKataloge(), regeln, befunde: [], heute: HEUTE });
    const k = kapitelFortschritt(p, mitStichtag, kataloge as unknown as KatalogAusschnitt);
    const bericht = new Map(b.etappen.map((e) => [e.id, e.gesamt ? e.erledigt / e.gesamt : null]));
    const abw: string[] = [];
    for (const kap of kataloge.anforderungen42001.kapitel) {
      const ids = kap.abschnitte.map((a) => a.etappe);
      if (ids.some((id) => !bericht.has(id) && aktiveEtappen(gefuehrt, p).some((e) => e.id === id))) continue;
      const werte = ids.filter((id) => bericht.has(id)).map((id) => bericht.get(id)).filter((w): w is number => w !== null && w !== undefined);
      const erwartet = werte.length ? werte.reduce((a, c) => a + c, 0) / werte.length : 0;
      const ist = k.find((x) => x.id === kap.id)!.anteil;
      if (Math.abs(ist - erwartet) > 1e-9) abw.push(`${kap.id}: ${ist} statt ${erwartet}`);
    }
    expect(abw).toEqual([]);
    for (const e of b.etappen) {
      const g = etappenFortschritt(aktiveEtappen(gefuehrt, p).find((x) => x.id === e.id)!, p, mitStichtag);
      expect([e.erledigt, e.gesamt]).toEqual([g.erledigt, g.gesamt]);
    }
  });
});
