// AIMS-Manager ab rc.2: Bedingungen modulNistRmf und generativ, Seiten des Moduls NIST AI RMF, Zusatz-Controls RMF-xx in
// der Erklärung zur Anwendbarkeit, Ist-Vorschlag des Profils, Moduldokumente, Fahrplan mit Zuschlag, Sprungziele H28 bis H35,
// ODER-Filter (filterEines), Tabellenzeilen mit verschachtelten Spalten.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { erfuellt } from '../../src/app/logik/bedingungen.ts';
import { neueTabellenZeile, neuerControlEintrag, rahmenwerkVon } from '../../src/app/logik/eintraege.ts';
import { berechneFahrplan } from '../../src/app/logik/fahrplan.ts';
import { feldAktiv, formularFelder } from '../../src/app/logik/formularfelder.ts';
import { aktiveEtappen, aktiveSeiten, seitenEintraege, seitenIndex, type Umfeld } from '../../src/app/logik/gefuehrt.ts';
import type { FahrplanDef, GefuehrtDaten } from '../../src/app/logik/gefuehrt-typen.ts';
import { dokumentImModul, funktionStand, istVorschlag, luecke, standVeraltet } from '../../src/app/logik/nistrmf.ts';
import { gefuehrtSprung } from '../../src/app/logik/pruefsprung.ts';
import { sprungRoute } from '../../src/app/logik/routen.ts';
import { soaVorschlaege, type EuaiaControl } from '../../src/app/logik/vorschlaege.ts';
import type { Kataloge } from '../../src/kataloge/typen.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { kiSystem, vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = <T>(rel: string): T => JSON.parse(readFileSync(join(REPO, rel), 'utf8')) as T;
const gefuehrt = json<GefuehrtDaten>('src/generiert/gefuehrt.json');
const kataloge = json<Kataloge>('src/generiert/kataloge.json');
const euaia = (kataloge['aiact_euaiaControls'] as { controls: EuaiaControl[] }).controls;
const rmf = kataloge.nistrmf_rmfControls!.controls;
const u: Umfeld = { gefuehrt, controlIds42001: kataloge.controls42001.gruppen.flatMap((g) => g.controls.map((c) => c.id)), euaia, rmf };
const index = seitenIndex(gefuehrt);
const seite = (id: string) => index.get(id)!;
const NIST_SEITEN = ['E3-merkmale', 'E8-rmf', 'E9-messkonzept', 'E9-genai', 'E12-rmf-profil', 'J-rmf'];

function aktiveIds(p: Projekt): string[] {
  return aktiveEtappen(gefuehrt, p).flatMap((e) => aktiveSeiten(gefuehrt, e, p, index).map((s) => s.id));
}

describe('Bedingungen modulNistRmf und generativ', () => {
  it('Seiten des Moduls erscheinen nur mit Modul, E9-genai zusätzlich nur mit generativer KI', () => {
    const p = vollstaendigesProjekt();
    expect(aktiveIds(p).filter((id) => NIST_SEITEN.includes(id))).toEqual([]);
    p.meta.modulNistRmf = true;
    expect(aktiveIds(p).filter((id) => NIST_SEITEN.includes(id))).toEqual(['E3-merkmale', 'E8-rmf', 'E9-messkonzept', 'E12-rmf-profil', 'J-rmf']);
    p.kiSysteme[0]!.generativ = true;
    expect(aktiveIds(p)).toEqual(expect.arrayContaining(['E9-genai', 'E6-genai']));
    // Abgelöste Systeme zählen nicht
    p.kiSysteme[0]!.status = 'abgeloest';
    expect(erfuellt({ generativ: true }, p)).toBe(false);
    expect(erfuellt({ generativ: false }, p)).toBe(true);
    expect(erfuellt({ modulNistRmf: false }, { ...p, meta: { ...p.meta, modulNistRmf: undefined } })).toBe(true);
  });
  it('Vorschläge GenAI-Sicherheit (E6) gelten ohne Modul', () => {
    const p = vollstaendigesProjekt();
    expect(aktiveIds(p)).not.toContain('E6-genai');
    p.kiSysteme[0]!.generativ = true;
    expect(aktiveIds(p)).toContain('E6-genai');
    expect(seite('E6-genai')).toMatchObject({ typ: 'vorschlaege', katalog: 'genaiRisiken' });
  });
});

describe('Zusatz-Controls RMF-xx', () => {
  it('Vorschläge nur mit Modul; E8-rmf zeigt Vorschläge und entschiedene RMF-Controls', () => {
    const p = vollstaendigesProjekt();
    expect(soaVorschlaege(p, euaia, rmf).some((v) => v.grund === 'nistrmf')).toBe(false);
    expect(seitenEintraege(seite('E8-rmf'), p, u)).toEqual([]);
    p.meta.modulNistRmf = true;
    const ids = seitenEintraege(seite('E8-rmf'), p, u).map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['RMF-01', 'RMF-08', 'RMF-16']));
    expect(ids.some((id) => id.startsWith('RMF-G'))).toBe(false);
    p.kiSysteme[0]!.generativ = true;
    expect(seitenEintraege(seite('E8-rmf'), p, u).map((e) => e.id)).toEqual(expect.arrayContaining(['RMF-G01', 'RMF-G07']));
    // Ein entschiedenes Control bleibt sichtbar, auch wenn es nicht mehr vorgeschlagen wird
    p.controls.push({ ...neuerControlEintrag('RMF-11'), anwendbar: 'nein', begruendung: 'keine Maschinen' });
    expect(seitenEintraege(seite('E8-rmf'), p, u).map((e) => e.id)).toContain('RMF-11');
    expect(rahmenwerkVon('RMF-G03')).toBe('NISTRMF');
  });
});

describe('Profil NIST AI RMF', () => {
  const k = kataloge;
  const sub = k.nistrmf_subkategorien!.subkategorien;
  it('Ist-Vorschlag ist unabhängig von einem eingetragenen Ist; Lücken und Stand je Funktion', () => {
    const p = vollstaendigesProjekt();
    p.meta.modulNistRmf = true;
    const s = sub.find((x) => x.id === 'GV-1.6')!;
    const ohne = istVorschlag(p, k, s).stufe;
    p.nistProfil = { 'GV-1.6': { ist: 3, ziel: 3 } };
    expect(istVorschlag(p, k, s).stufe).toBe(ohne);
    expect(luecke(p.nistProfil['GV-1.6'])).toBe(false);
    p.nistProfil['GV-1.1'] = { ist: 1, ziel: 3 };
    const st = funktionStand(p, sub, 'govern');
    expect(st).toMatchObject({ bewertet: 2, luecken: 1, ohneMassnahme: 1 });
    expect(st.gesamt).toBe(sub.filter((x) => x.funktion === 'govern').length);
    expect(k.nistrmf_subkategorien!.subkategorien).toHaveLength(72);
  });
  it('Stand gilt als veraltet nach der Frist aus stand.yaml', () => {
    expect(standVeraltet({ geprueft_am: '2026-10-21', hinweis_nach_monaten: 6 }, '2027-04-20')).toBe(false);
    expect(standVeraltet({ geprueft_am: '2026-10-21', hinweis_nach_monaten: 6 }, '2027-04-21')).toBe(true);
  });
});

describe('Moduldokumente und Fahrplan', () => {
  it('N-01 bis N-04 nur mit Modul NIST, E-xx nur mit Modul AI Act', () => {
    const p = vollstaendigesProjekt();
    const docs = k(['N-01', 'E-01', 'D-01']);
    expect(docs.map((d) => dokumentImModul(d, p))).toEqual([false, true, true]);
    p.meta.modulAiAct = false;
    p.meta.modulNistRmf = true;
    expect(docs.map((d) => dokumentImModul(d, p))).toEqual([true, false, true]);
  });
  it('Modul NIST erhöht die Personentage um den Richtwert aus etappen.yaml', () => {
    const def = gefuehrt.etappen.fahrplan as FahrplanDef;
    const p = vollstaendigesProjekt();
    const ohne = berechneFahrplan(p, def, aktiveEtappen(gefuehrt, p), '2026-10-20');
    expect(ohne.ptNist).toBeUndefined();
    p.meta.modulNistRmf = true;
    const mit = berechneFahrplan(p, def, aktiveEtappen(gefuehrt, p), '2026-10-20');
    expect(def.module?.nistRmf?.pt).toEqual([3, 5]);
    expect(mit.ptNist).toEqual([3, 5]);
    expect(mit.pt).toEqual([ohne.pt[0] + 3, ohne.pt[1] + 5]);
    expect(mit.ptAims[1]).toBeGreaterThan(ohne.ptAims[1]);
  });
});

function k(ids: string[]) {
  return ids.map((id) => kataloge.dokumente.dokumente.find((d) => d.id === id)!);
}

describe('Sprungziele H28 bis H35 im Guide', () => {
  it('führen auf die Seiten der neuen Kernfelder', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme = [kiSystem({ handlungsbefugnis: 'handelt-mehrstufig' })];
    const sprung = (regel: string, id?: string) => gefuehrtSprung({ regel, ...(id ? { id } : {}) }, p, gefuehrt);
    expect(sprung('H28', 'KI-001')).toEqual({ art: 'gefuehrt', etappe: 'E4', seite: 'E4-handlung', eintrag: 'KI-001' });
    p.kiSysteme[0]!.stoppmoeglichkeit = 'Konnektor sperren';
    expect(sprung('H28', 'KI-001')).toMatchObject({ seite: 'E9-protokolle-systeme' });
    p.kiSysteme[0]!.protokollierung = 'Aktionsprotokoll';
    expect(sprung('H28', 'KI-001')).toMatchObject({ seite: 'E4-daten' });
    expect(sprung('H29', 'KI-001')).toMatchObject({ etappe: 'E9', seite: 'E9-rueckfall', eintrag: 'KI-001' });
    expect(sprung('H30', 'KI-001')).toMatchObject({ etappe: 'E9', seite: 'E9-ausserbetrieb' });
    expect(sprung('H31', 'KI-001')).toMatchObject({ etappe: 'E7', seite: 'E7-einsatzentscheid' });
    expect(sprung('H32', 'KI-001')).toMatchObject({ etappe: 'E9', seite: 'E9-missbrauch' });
    expect(sprung('H33', 'KI-001')).toMatchObject({ etappe: 'E4', seite: 'E4-generativ' });
    // H34 meldet ein KI-System; die Zielseite zeigt Ziele, deshalb ohne Eintrag
    expect(sprung('H34', 'KI-001')).toEqual({ art: 'gefuehrt', etappe: 'E11', seite: 'E11-ziele' });
    expect(sprung('H35', 'A.6.2.4')).toEqual({ art: 'gefuehrt', etappe: 'E8', seite: 'E8-wirksamkeit', eintrag: 'A.6.2.4' });
    // Ohne Modul gibt es die Seite E8-rmf nicht: kein Sprung im Guide (Formularansicht gilt)
    expect(sprung('H24', 'RMF-04')).toBeNull();
  });
  it('Sprung auf ein RMF-Control führt mit Modul auf E8-rmf; Formularziel nistrmf', () => {
    const p = vollstaendigesProjekt();
    p.meta.modulNistRmf = true;
    expect(gefuehrtSprung({ regel: 'F05', id: 'RMF-04' }, p, gefuehrt)).toMatchObject({ seite: 'E8-rmf', eintrag: 'RMF-04' });
    expect(sprungRoute('nistrmf/stand')).toEqual({ art: 'formular', modul: 'nistrmf', id: 'stand', filter: undefined });
    expect(sprungRoute('nistrmf')).toMatchObject({ art: 'formular', modul: 'nistrmf' });
  });
});

describe('Sprungziele F27 bis F29 und H36 bis H41 (Modul NIST AI RMF)', () => {
  it('führen auf die Seiten des Moduls', () => {
    const p = vollstaendigesProjekt();
    p.meta.modulNistRmf = true;
    p.kiSysteme[0]!.generativ = true;
    const sprung = (regel: string, id?: string, bereich?: string) => gefuehrtSprung({ regel, ...(id ? { id } : {}), ...(bereich ? { bereich } : {}) }, p, gefuehrt);
    expect(sprung('F27', 'RMF-04', 'soa')).toMatchObject({ etappe: 'E8', seite: 'E8-rmf', eintrag: 'RMF-04' });
    expect(sprung('F27', 'MS-2.9', 'nistrmf')).toMatchObject({ etappe: 'E12', seite: 'E12-rmf-profil', eintrag: 'MS-2.9' });
    expect(sprung('F28', 'KI-001')).toMatchObject({ etappe: 'E9', seite: 'E9-genai', eintrag: 'KI-001' });
    expect(sprung('F29', 'KI-001')).toMatchObject({ seite: 'E9-messkonzept' });
    expect(sprung('H36')).toEqual({ art: 'gefuehrt', etappe: 'J', seite: 'J-rmf' });
    expect(sprung('H37', 'GV-1.1', 'nistrmf')).toMatchObject({ seite: 'E12-rmf-profil' });
    expect(sprung('H38')).toMatchObject({ seite: 'E12-rmf-profil' });
    expect(sprung('H39', 'KI-001')).toMatchObject({ seite: 'E9-genai' });
    expect(sprung('H40', 'KI-001')).toMatchObject({ seite: 'E9-messkonzept' });
    expect(sprung('H41', 'KI-001')).toMatchObject({ seite: 'E4-generativ' });
    // Formularziele der Regeln
    expect(sprungRoute('nistrmf/GV-1.1')).toEqual({ art: 'formular', modul: 'nistrmf', id: 'profil', filter: { eintrag: 'GV-1.1' } });
    expect(sprungRoute('nistrmf/profil')).toMatchObject({ modul: 'nistrmf', id: 'profil' });
  });
});

describe('ODER-Filter und Tabellen', () => {
  it('E9-ausserbetrieb zeigt Systeme ausser Betrieb oder abgelöst, auch in der Formularansicht', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme = [kiSystem({ id: 'KI-001' }), kiSystem({ id: 'KI-002', lebenszyklus: 'ausserbetrieb' }), kiSystem({ id: 'KI-003', status: 'abgeloest' })];
    expect(seitenEintraege(seite('E9-ausserbetrieb'), p, u).map((e) => e.id)).toEqual(['KI-002', 'KI-003']);
    const f = formularFelder(gefuehrt, 'kiSysteme').find((x) => x.feld.pfad === 'aufbewahrenBis')!;
    expect(p.kiSysteme.map((s) => feldAktiv(f, p, s))).toEqual([false, true, true]);
    p.kiSysteme[0]!.fremdeInhalte = true;
    expect(seitenEintraege(seite('E9-missbrauch'), p, u).map((e) => e.id)).toEqual(['KI-001']);
  });
  it('neue Tabellenzeilen: verschachtelte Spalten, nächster Entscheid, nächstes Merkmal', () => {
    const spalten = seite('E3-entscheidungsrechte').felder![0]!.spalten!;
    expect(neueTabellenZeile('organisation.entscheidungsrechte', [], spalten)).toEqual({ entscheid: 'einfuehren', wer: {} });
    expect(neueTabellenZeile('organisation.entscheidungsrechte', [{ entscheid: 'einfuehren' }], spalten)).toMatchObject({ entscheid: 'restrisiko' });
    const pruefungen = seite('E9-messkonzept').felder![0]!.spalten!;
    expect(neueTabellenZeile('messkonzept.pruefungen', [{ merkmal: 'gueltig' }], pruefungen)).toEqual({ merkmal: 'sicher' });
  });
});
