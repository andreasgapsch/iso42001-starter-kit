// Nutzertest: Regressionstests zu den Befunden, die sich ohne Browser prüfen lassen.
// U-01 ein Stichtag, U-02 «Guide», U-04 weiche Trennstellen im Untermenü, U-05 Lage zur Akzeptanzgrenze, U-06 Freigabe
// hebt auf 1.0, U-07 Fehler dosiert, U-09 YAML-Werte mit «#». Die Darstellung prüfen die E2E-Tests (tests/e2e/app).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { strToU8 } from 'fflate';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { freigabeVersion, metadatenSetzen, statusWechseln, versionHinzufuegen } from '../../src/bibliothek/aenderungen.ts';
import { sichtEintraege } from '../../src/bibliothek/sicht.ts';
import { sha256 } from '../../src/bibliothek/pruefsumme.ts';
import { restLage } from '../../src/grafik/daten.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import type { Projekt, Risiko } from '../../src/model/typen.ts';
import type { Umfeld } from '../../src/app/logik/gefuehrt.ts';
import { pruefe } from '../../src/app/logik/pruefung.ts';
import { fehlerDosiert } from '../../src/app/logik/fehler-dosiert.ts';
import { TRENNEN_AB, weichTrennen } from '../../src/app/rahmen/trennen.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const kataloge = ladeKataloge();
const regeln = parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')).regeln;
const { setzeAppDaten } = await import('../../src/app/daten.ts');
setzeAppDaten({ texte: { de: ladeTexte('de'), en: ladeTexte('en') }, kataloge, gefuehrt: json('src/generiert/gefuehrt.json'), regeln: { regeln }, version: '1.0.0', gebaut: '', beispiele: [] });
const store = await import('../../src/app/zustand/store.ts');
const { untermenue, BEREICHE } = await import('../../src/app/rahmen/bereiche.ts');
const { uiSprache } = await import('../../src/app/i18n.ts');

const dateien = (ordner: string, endung: RegExp): string[] =>
  readdirSync(join(REPO, ordner), { recursive: true, withFileTypes: true }).filter((d) => d.isFile() && endung.test(d.name)).map((d) => join(d.parentPath, d.name));

describe('U-01 ein Stichtag für alle Ansichten', () => {
  it('Beispiel mit Datenstand in der Zukunft: Stichtag ist der Datenstand und bleibt nach einer Änderung', () => {
    const p = vollstaendigesProjekt();
    p.meta.geaendert = '2099-02-05T10:00:00.000Z';
    store.projektUebernehmen(p, false);
    expect(store.stichtag.value).toBe('2099-02-05');
    expect(store.stichtagAbweichend.value).toBe(true);
    store.aendere(['organisation', 'name'], 'Geändert AG');
    expect(store.projekt.value!.meta.geaendert.slice(0, 10)).not.toBe('2099-02-05');
    expect(store.stichtag.value).toBe('2099-02-05');
  });
  it('Projekt mit Datenstand in der Vergangenheit: Stichtag ist heute, der Kopf zeigt keinen Stichtag', () => {
    const p = vollstaendigesProjekt();
    p.meta.geaendert = '2020-01-01T10:00:00.000Z';
    store.projektUebernehmen(p, false);
    expect(store.stichtag.value).toBe(store.heute());
    expect(store.stichtagAbweichend.value).toBe(false);
  });
  it('Ansichten lesen den Stichtag, heute() nur für Einträge mit Datum (erfasst am, Version vom, Reife am)', () => {
    // Erlaubte Aufrufe je Datei: schreibende Aktionen, die das echte Datum festhalten
    const erlaubt: Record<string, number> = {
      'src/app/zustand/store.ts': 5, 'src/app/ansichten/bibliothek/zustand.ts': 3, 'src/app/ansichten/prozesse/Prozesse.tsx': 3,
      'src/app/ansichten/gefuehrt/Fragebogen.tsx': 1, 'src/app/ansichten/gefuehrt/Gefuehrt.tsx': 1, 'src/app/ansichten/bibliothek/Bibliothek.tsx': 1,
    };
    const gefunden: Record<string, number> = {};
    for (const f of dateien('src/app', /\.tsx?$/)) {
      const n = (readFileSync(f, 'utf8').match(/\bheute\(\)/g) ?? []).length;
      if (n) gefunden[f.slice(REPO.length + 1)] = n;
    }
    expect(gefunden).toEqual(erlaubt);
  });
});

describe('U-02 ein Begriff: Guide', () => {
  it('Oberfläche, Hilfe, Kurzanleitung, Leitfaden und Skill sagen nicht mehr «Geführter Modus» oder «Guided Mode»', () => {
    const treffer: string[] = [];
    for (const f of [...dateien('src/i18n', /\.yaml$/), ...dateien('src/leitfaden', /\.md$/), ...dateien('src/skill', /\.md$/), ...dateien('src/app/kurzanleitung', /\.html$/), join(REPO, 'src/start/CHANGELOG.txt.tpl')]) {
      readFileSync(f, 'utf8').split('\n').forEach((z, i) => {
        if (/^\s*#/.test(z)) return;
        if (/geführte[nmr]? modus|geführtem modus|guided mode/i.test(z)) treffer.push(`${f.slice(REPO.length + 1)}:${i + 1}`);
      });
    }
    expect(treffer).toEqual([]);
  });
});

describe('U-04 Untermenü ohne Umbruch mitten im Wort', () => {
  it('weiche Trennstellen an Wortfugen, Gross- und Kleinschreibung und Satzzeichen bleiben', () => {
    expect(weichTrennen('Folgenabschätzungen')).toBe('Folgen­abschät­zungen');
    expect(weichTrennen('Stage-1-Bereitschaft')).toBe('Stage-1-Bereit­schaft');
    expect(weichTrennen('Objectives, measurement')).toBe('Objec­tives, measure­ment');
    expect(weichTrennen('Start')).toBe('Start');
  });
  it('jedes lange Wort in den Titeln des Untermenüs hat eine Trennstelle (DE und EN, alle Bereiche, Leitfaden)', () => {
    const p = vollstaendigesProjekt();
    Object.assign(p.meta, { modulAiAct: true, modulNistRmf: true, mitIsms: true });
    const ohne: string[] = [];
    for (const s of ['de', 'en'] as const) {
      uiSprache.value = s;
      const titel = BEREICHE.flatMap((b) => untermenue(b.id, { p, r: { art: 'start' }, stichtag: '2026-10-24', faellig: 1, fehler: 1, hinweise: 1 }).flatMap((g) => [g.name ?? '', ...g.punkte.map((x) => x.titel)]));
      // Kapitel des Leitfadens (Wissen) aus den Überschriften der Quellen
      for (const f of dateien(`src/leitfaden/${s}`, /\.md$/)) titel.push(readFileSync(f, 'utf8').split('\n')[0]!.replace(/^#\s*(\d+\s)?/, ''));
      for (const t of titel) {
        for (const w of weichTrennen(t).split(/[\s/,()-]+/)) if (w.replace(/­/g, '').length >= TRENNEN_AB && !w.includes('­')) ohne.push(`${s}: ${w}`);
      }
    }
    uiSprache.value = 'de';
    expect([...new Set(ohne)]).toEqual([]);
  });
});

describe('U-05 Lage zur Akzeptanzgrenze', () => {
  const kr = { akzeptanzBis: 4, unannehmbarAb: 12 };
  const r = (x: Partial<Risiko>) => ({ art: 'risiko', status: 'offen', w: null, a: null, wNach: null, aNach: null, ...x }) as Risiko;
  it('über der Grenze, Annahme offen, angenommen, unter der Grenze', () => {
    expect(restLage(r({ w: 3, a: 3 }), kr)).toBe('ueber');
    expect(restLage(r({ w: 3, a: 3, wNach: 2, aNach: 3 }), kr)).toBe('annahme-offen');
    expect(restLage(r({ w: 3, a: 3, wNach: 2, aNach: 3, restrisikoAkzeptiert: { von: 'P-001', am: '2026-10-01' } }), kr)).toBe('angenommen');
    expect(restLage(r({ w: 3, a: 3, wNach: 1, aNach: 2 }), kr)).toBe('unter');
    expect(restLage(r({ w: 3, a: 3, status: 'geschlossen' }), kr)).toBeNull();
    expect(restLage(r({ art: 'chance', w: 3, a: 3 }), kr)).toBeNull();
  });
});

describe('U-06 Freigabe hebt den Entwurf auf die Hauptnummer (D-26)', () => {
  const version = async (pfad: string, v: string) => {
    const d = strToU8(v);
    return { version: v, datei: pfad, groesse: d.byteLength, pruefsumme: await sha256(d), datum: '2026-10-20T10:00:00Z' };
  };
  const freigabe = { geprueft: { von: 'P-002', am: '2026-10-18' }, freigabe: { von: 'P-003', am: '2026-10-19' } };
  const projekt = (): Projekt => {
    const p = vollstaendigesProjekt();
    p.personen.push({ id: 'P-002', name: 'Beat Prüfer', funktion: 'Qualität', aimsRollen: [] }, { id: 'P-003', name: 'Clara Leitung', funktion: 'GL', aimsRollen: [] });
    p.dokumente = p.dokumente.filter((d) => d.id !== 'D-12');
    return p;
  };
  it('freigabeVersion: 0.x wird 1.0, ab 1.0 bleibt die Nummer, nach einer Freigabe die nächste Nebennummer', () => {
    expect(freigabeVersion('0.1')).toBe('1.0');
    expect(freigabeVersion('0.3')).toBe('1.0');
    expect(freigabeVersion('1.1')).toBe('1.1');
    expect(freigabeVersion('2.0')).toBe('2.0');
    expect(freigabeVersion('0.2', ['1.0', '0.1'])).toBe('1.1');
  });
  it('Firmendokument: Entwurf 0.2 wird als 1.0 freigegeben, ohne Änderungstext (erste Fassung), Register und Sicht gleich', async () => {
    const p = projekt();
    versionHinzufuegen(p, 'D-12', 'firmendokument', await version('Firmendokumente/D-12_x/v0.1.docx', '0.1'));
    versionHinzufuegen(p, 'D-12', 'firmendokument', await version('Firmendokumente/D-12_x/v0.2.docx', '0.2'));
    metadatenSetzen(p, 'D-12', 'firmendokument', { eigner: 'P-001' });
    statusWechseln(p, 'D-12', 'firmendokument', 'in-pruefung');
    expect(statusWechseln(p, 'D-12', 'firmendokument', 'freigegeben', freigabe).fehler).toBeUndefined();
    expect(p.dokumente.find((d) => d.id === 'D-12')).toMatchObject({ version: '1.0', status: 'freigegeben' });
    const s = sichtEintraege(p).find((e) => e.id === 'D-12')!;
    expect(s).toMatchObject({ version: '1.0', gueltig: '1.0', status: 'freigegeben' });
    expect(s.versionen.at(-1)).toMatchObject({ version: '1.0', entwurf: '0.2', datei: 'Firmendokumente/D-12_x/v0.2.docx' });
  });
});

describe('U-07 neues Projekt ohne Fehlerflut', () => {
  const u: Umfeld = { gefuehrt: json('src/generiert/gefuehrt.json'), controlIds42001: kataloge.controls42001.gruppen.flatMap((g) => g.controls.map((c) => c.id)), euaia: (kataloge as unknown as { aiact_euaiaControls: { controls: Umfeld['euaia'] } }).aiact_euaiaControls.controls };
  it.each([true, false])('mit ISMS %s: alle Fehler kommen aus Etappen, die noch kommen (neutral «offen»), keiner zählt jetzt', (mitIsms) => {
    const p = leeresProjekt({ sprache: 'de', mitIsms, modulAiAct: true });
    const b = pruefe(p, regeln, u.controlIds42001, '2026-07-27', '2026-10-24', kataloge);
    const d = fehlerDosiert(p, u, b);
    expect(b.filter((x) => x.schwere === 'fehler').length).toBeGreaterThan(20);
    expect(d.jetzt).toEqual([]);
    expect(d.spaeter.length).toBe(b.filter((x) => x.schwere === 'fehler').length);
  });
  it('Angaben aus dem Register zählen wie eine begonnene Etappe: im vollständigen Projekt ohne Guide zählen alle Fehler', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme[0]!.eigner = undefined as never;
    const b = pruefe(p, regeln, u.controlIds42001, '2026-07-27', '2026-10-24', kataloge);
    const d = fehlerDosiert(p, u, b);
    expect(d.jetzt.length).toBeGreaterThan(0);
    expect(d.spaeter.map((x) => x.regel)).not.toContain('F01');
  });
  it('Ablauf aus dem Nutzertest: E0 bis E4, ein KI-System, ein behandeltes Risiko, Firmendokumente erzeugt: wenige Fehler jetzt, die SoA bleibt offen', () => {
    const p = leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: false });
    for (const id of ['E0', 'E1', 'E2', 'E3', 'E4']) p.meta.gefuehrt.etappen[id] = { status: 'in-arbeit', spaeter: [], besucht: u.gefuehrt.etappen.etappen.find((x) => x.id === id)!.seiten.slice(0, 2) };
    p.meta.gefuehrt.aktuelleEtappe = 'E4';
    const v = vollstaendigesProjekt();
    p.kiSysteme = [v.kiSysteme[0]!];
    p.risiken = [v.risiken[0]!];
    p.dokumente = v.dokumente.map((d) => ({ id: d.id, version: '0.1', status: 'entwurf' as const, ablageort: '', giltFuerIsms: false }));
    const b = pruefe(p, regeln, u.controlIds42001, '2026-07-27', '2026-10-24', kataloge);
    const d = fehlerDosiert(p, u, b);
    expect(d.jetzt.filter((x) => x.regel === 'F05')).toEqual([]);
    expect(d.jetzt.length).toBeLessThan(10);
  });
  it('begonnene Etappen: ihre Fehler zählen jetzt', () => {
    const p = leeresProjekt({ sprache: 'de', mitIsms: false, modulAiAct: true });
    const b = pruefe(p, regeln, u.controlIds42001, '2026-07-27', '2026-10-24', kataloge);
    for (const e of u.gefuehrt.etappen.etappen) p.meta.gefuehrt.etappen[e.id] = { status: 'in-arbeit', spaeter: [], besucht: [e.seiten[0]!] };
    const d = fehlerDosiert(p, u, b);
    expect(d.jetzt.length).toBeGreaterThan(0);
    expect(d.jetzt.length + d.spaeter.length).toBe(b.filter((x) => x.schwere === 'fehler').length);
  });
});

describe('U-09 YAML-Texte mit «#»', () => {
  it('kein ungequoteter Wert mit « #» (YAML liest den Rest als Kommentar)', () => {
    const treffer: string[] = [];
    for (const f of dateien('src/i18n', /\.yaml$/)) {
      readFileSync(f, 'utf8').split('\n').forEach((z, i) => {
        const m = /^\s*(?:- )?[\w.-]+: (.*)$/.exec(z);
        if (m && !/^["'|>[{]/.test(m[1]!) && / #/.test(m[1]!)) treffer.push(`${f.slice(REPO.length + 1)}:${i + 1}`);
      });
    }
    expect(treffer).toEqual([]);
  });
  it('die Meldung zur Farbe nennt das Beispiel', () => {
    for (const s of ['de', 'en'] as const) expect(JSON.stringify(ladeTexte(s))).toMatch(/(z\. B\.|for example) #1C5D94\./);
  });
});
