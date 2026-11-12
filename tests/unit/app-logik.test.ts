// AIMS-Manager: reine Logik (Pfade, IDs, Bedingungen, Engine des Guides, Vorschläge, Laden, Routen, Dokumentset).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ladeProjektText, MAX_BYTES } from '../../src/app/import/laden.ts';
import { erfuellt, filterPasst, wertPasst } from '../../src/app/logik/bedingungen.ts';
import { musterEintrag, neuerEintrag, neueTabellenZeile } from '../../src/app/logik/eintraege.ts';
import { controlPunkte, faelligeUeberpruefungen, gruppenFortschritt, kapitelFortschritt } from '../../src/app/logik/fortschritt.ts';
import { formularFelder, sichtbareFelder } from '../../src/app/logik/formularfelder.ts';
import {
  aktiveEtappen, aktiveSeiten, checklisteIds, etappenFortschritt, gesamtFortschritt, pflichtLuecken, seitenEintraege, seitenIndex,
  seitenStatus, soaIds, weitermachenZiel, type Umfeld,
} from '../../src/app/logik/gefuehrt.ts';
import type { GefuehrtDaten, SeiteDef } from '../../src/app/logik/gefuehrt-typen.ts';
import { naechsteId } from '../../src/app/logik/ids.ts';
import { istLeer, lies, segmente, setze } from '../../src/app/logik/pfad.ts';
import { baueprompt, wertText } from '../../src/app/logik/prompt.ts';
import { parseRoute, routeZuHash, sprungRoute, sprungZiel } from '../../src/app/logik/routen.ts';
import { feldVorschlag, soaVorschlaege, type EuaiaControl } from '../../src/app/logik/vorschlaege.ts';
import { dokumentSet, erzeugeIr } from '../../src/app/worker/set.ts';
import { erstelleZustand } from '../../src/app/zustand/kern.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import type { Projekt } from '../../src/model/typen.ts';
import type { Kataloge } from '../../src/kataloge/typen.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { kiSystem, vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = <T>(rel: string): T => JSON.parse(readFileSync(join(REPO, rel), 'utf8')) as T;
const gefuehrt = json<GefuehrtDaten>('src/generiert/gefuehrt.json');
const kataloge = json<Kataloge>('src/generiert/kataloge.json');
const regeln = json<{ regeln: { id: string; ziel: string }[] }>('src/generiert/regeln.json');
const euaia = (kataloge['aiact_euaiaControls'] as { controls: EuaiaControl[] }).controls;
const controlIds42001 = kataloge.controls42001.gruppen.flatMap((g) => g.controls.map((c) => c.id));
const u: Umfeld = { gefuehrt, controlIds42001, euaia };
const seite = (id: string) => seitenIndex(gefuehrt).get(id)!;

describe('Pfade', () => {
  it('zerlegt Punkt- und Indexpfade', () => {
    expect(segmente('a.b[2].c')).toEqual(['a', 'b', 2, 'c']);
    expect(segmente('x[0][1]')).toEqual(['x', 0, 1]);
  });
  it('setzt unveränderlich und legt Zwischenstufen an', () => {
    const o = { a: { b: 1 }, c: [1, 2] };
    const n = setze(o, 'a.d.e', 5);
    expect(n).toEqual({ a: { b: 1, d: { e: 5 } }, c: [1, 2] });
    expect(o).toEqual({ a: { b: 1 }, c: [1, 2] });
    expect(n.c).toBe(o.c);
    expect(setze({}, 'l[1]', 'x')).toEqual({ l: [undefined, 'x'] });
    expect(setze({ a: 1, b: 2 }, 'a', undefined)).toEqual({ b: 2 });
    expect(lies(n, 'a.d.e')).toBe(5);
  });
  it('erkennt leere Werte, false und 0 gelten als gesetzt', () => {
    expect([undefined, null, '  ', [], {}, { a: '' }].every(istLeer)).toBe(true);
    expect([false, 0, 'x', ['a']].some(istLeer)).toBe(false);
  });
});

describe('IDs und Einträge', () => {
  it('vergibt fortlaufende IDs mit Präfix', () => {
    expect(naechsteId('KI', [{ id: 'KI-001' }, { id: 'KI-009' }, { id: 'X' }])).toBe('KI-010');
    expect(naechsteId('EC', [])).toBe('EC-01');
  });
  it('neue Einträge sind schemagültig', () => {
    const p = vollstaendigesProjekt();
    for (const liste of ['kiSysteme', 'risiken', 'massnahmen', 'lieferanten', 'audits', 'ziele', 'kompetenzen', 'kommunikation', 'feststellungen', 'managementbewertungen', 'parteien', 'personen', 'rollen', 'nachweise', 'eigeneControls', 'folgenabschaetzungen'] as const) {
      const e = neuerEintrag(p, liste, liste === 'folgenabschaetzungen' ? { kiSystem: 'KI-001' } : {});
      (p[liste] as unknown[]).push(e);
    }
    const r = ladeProjektText(JSON.stringify(p));
    expect(r.ok ? [] : r.details).toEqual([]);
  });
  it('Vorgaben mit Objekten setzen Unterfelder', () => {
    const e = neuerEintrag(leeresProjekt(), 'massnahmen', { herkunft: { art: 'checkliste', ref: 'E1-c1' } });
    expect(e['herkunft']).toEqual({ art: 'checkliste', ref: 'E1-c1' });
  });
  it('Tabellenzeilen erhalten die Pflichtfelder des Modells', () => {
    expect(neueTabellenZeile('organisation.kontext.themen', [{ id: 'TH-002' }], [])).toMatchObject({ id: 'TH-003', art: 'extern' });
    expect(neueTabellenZeile('anforderungen', [], [])).toMatchObject({ quelle: 'intern', adressiert: 'offen' });
    expect(musterEintrag('controls')).toBeDefined();
  });
});

describe('Bedingungen', () => {
  it('Listenfelder: ein gemeinsamer Wert genügt, * heisst gesetzt', () => {
    expect(wertPasst(['a', 'b'], ['b'])).toBe(true);
    expect(wertPasst('', ['*'])).toBe(false);
    expect(filterPasst({ aiAct: { rollen: ['betreiber'] } }, { 'aiAct.rollen': ['betreiber'] })).toBe(true);
  });
  it('Pfad, Modul, Rolle und Typ', () => {
    const p = vollstaendigesProjekt();
    expect(erfuellt({ mitIsms: false, modul: true }, p)).toBe(true);
    expect(erfuellt({ rolle: 'anbieter' }, p)).toBe(false);
    p.kiSysteme.push(kiSystem({ id: 'KI-002', typ: 'eigenbau', aiAct: { ...kiSystem().aiAct, rollen: ['anbieter'] } }));
    expect(erfuellt({ rolle: 'anbieter', typ: 'eigenbau' }, p)).toBe(true);
    expect(erfuellt({ eintrag: { typ: ['saas'] } }, p, p.kiSysteme[0])).toBe(true);
  });
});

describe('Guide', () => {
  it('Modul aus blendet Etappen mit modul: true aus, Pfad mit ISMS ändert Seiten', () => {
    const p = leeresProjekt({ modulAiAct: false });
    const mitModul = leeresProjekt({ modulAiAct: true });
    const a = aktiveEtappen(gefuehrt, p).map((e) => e.id);
    const b = aktiveEtappen(gefuehrt, mitModul).map((e) => e.id);
    expect(b.length).toBeGreaterThanOrEqual(a.length);
    for (const e of gefuehrt.etappen.etappen.filter((e) => e.wenn?.modul === true)) expect(a).not.toContain(e.id);
    const isms = leeresProjekt({ mitIsms: true });
    const anzahl = (q: Projekt) => aktiveEtappen(gefuehrt, q).flatMap((e) => aktiveSeiten(gefuehrt, e, q)).map((s) => s.id).join();
    expect(anzahl(isms)).not.toBe(anzahl(leeresProjekt({ mitIsms: false })));
  });
  it('jede Seite der Etappen hat eine Struktur', () => {
    const index = seitenIndex(gefuehrt);
    const fehlend = gefuehrt.etappen.etappen.flatMap((e) => e.seiten.filter((s) => !index.has(s)));
    expect(fehlend).toEqual([]);
  });
  it('Pflichtlücken je Seitentyp', () => {
    const p = leeresProjekt();
    expect(pflichtLuecken(seite('E0-firma'), p, u).length).toBeGreaterThan(0);
    p.organisation.name = 'X';
    p.organisation.branche = 'industrie';
    expect(pflichtLuecken(seite('E0-firma'), p, u)).toEqual([]);
    const systeme = seite('E4-systeme');
    expect(pflichtLuecken(systeme, p, u)).toEqual([{ feld: '*' }]);
  });
  it('Status, Fortschritt und Weitermachen', () => {
    const p = leeresProjekt();
    const e0 = gefuehrt.etappen.etappen[0]!;
    expect(seitenStatus(seite('E0-start'), 'E0', p, u)).toBe('offen');
    p.meta.gefuehrt.etappen['E0'] = { status: 'in-arbeit', spaeter: ['E0-firma'], besucht: ['E0-start', 'E0-firma'] };
    expect(seitenStatus(seite('E0-start'), 'E0', p, u)).toBe('erledigt');
    expect(seitenStatus(seite('E0-firma'), 'E0', p, u)).toBe('spaeter');
    const f = etappenFortschritt(e0, p, u);
    expect(f).toMatchObject({ erledigt: 1, spaeter: 1, status: 'in-arbeit' });
    expect(weitermachenZiel(p, u)).toEqual({ etappe: 'E0', seite: 'E0-firma' });
    expect(gesamtFortschritt(p, u).gesamt).toBeGreaterThan(100);
  });
  it('Einträge für SoA, Folgenabschätzung und festen Eintrag', () => {
    const p = vollstaendigesProjekt();
    const soa = seite('E8-soa');
    expect(soaIds(soa, p, u)).toEqual(controlIds42001);
    expect(seitenEintraege(soa, p, u)).toHaveLength(controlIds42001.length);
    const fa = seitenEintraege(seite('E7-triage'), p, u);
    expect(fa.map((e) => e.kiSystem)).toEqual(['KI-001']);
    const fest = gefuehrt.seiten.find((s): s is SeiteDef => !!s.eintrag)!;
    const e = seitenEintraege(fest, p, u);
    expect(e).toHaveLength(1);
    expect(e[0]!.id).toBe(fest.eintrag);
  });
  it('Checklisten berücksichtigen Bedingungen', () => {
    const p = leeresProjekt({ modulAiAct: false });
    for (const e of gefuehrt.etappen.etappen) expect(checklisteIds(e, p).every((id) => typeof id === 'string')).toBe(true);
  });
  it('Formularansicht leitet Felder aus den Seiten ab', () => {
    const p = vollstaendigesProjekt();
    const f = sichtbareFelder(formularFelder(gefuehrt, 'kiSysteme'), p, p.kiSysteme[0]).map((x) => x.feld.pfad ?? x.feld.schluessel);
    expect(f).toContain('name');
    expect(new Set(f).size).toBe(f.length);
    expect(formularFelder(gefuehrt, 'controls').map((x) => x.feld.pfad)).toContain('anwendbar');
  });
  it('Formularansicht: Felder je Auditart (intern, Stage 1, Überwachung), je Pfad einmal', () => {
    const p = vollstaendigesProjekt();
    const ff = formularFelder(gefuehrt, 'audits');
    const pfade = (art: string) => sichtbareFelder(ff, p, { id: 'AU-9', art }).map((x) => x.feld.pfad);
    for (const art of ['intern', 'extern-stage1', 'extern-stage2', 'ueberwachung']) {
      const f = pfade(art);
      expect(f, art).toContain('geplant');
      expect(f, art).toContain('auditor');
      expect(new Set(f).size, art).toBe(f.length);
    }
    expect(pfade('intern')).toContain('unabhaengigkeit');
    expect(pfade('extern-stage2')).toContain('zertifikatAm');
  });
});

describe('Vorschläge und Fortschritt', () => {
  it('SoA-Vorschläge aus Risiken und AI Act (nur mit Modul)', () => {
    const p = vollstaendigesProjekt();
    p.risiken[0]!.controls = ['A.6.2.4'];
    const mit = soaVorschlaege(p, euaia);
    expect(mit.find((v) => v.id === 'A.6.2.4')).toMatchObject({ grund: 'risiko' });
    expect(mit.some((v) => v.grund === 'aiact')).toBe(true);
    p.meta.modulAiAct = false;
    expect(soaVorschlaege(p, euaia).some((v) => v.grund === 'aiact')).toBe(false);
  });
  it('Feldvorschlag nur bei wahrem Pfad und abweichendem Wert', () => {
    const p = vollstaendigesProjekt();
    expect(feldVorschlag({ wert: true, wennEines: ['meta.modulAiAct'] }, p, false)).toBe(true);
    expect(feldVorschlag({ wert: true, wennEines: ['meta.modulAiAct'] }, p, true)).toBeUndefined();
    expect(feldVorschlag({ wert: true, wennEines: ['meta.mitIsms'] }, p, false)).toBeUndefined();
  });
  it('Fortschritt je Kapitel und Control-Gruppe', () => {
    const p = vollstaendigesProjekt();
    expect(kapitelFortschritt(p, u, kataloge).length).toBe(7);
    const g = gruppenFortschritt(p, kataloge);
    expect(g.every((x) => x.anteil >= 0 && x.anteil <= 1)).toBe(true);
    expect(controlPunkte({ id: 'A.2.2', rahmenwerk: 'ISO42001', anwendbar: 'nein', begruendung: 'x', status: 'offen', nachweise: [], umsetzung: '', iso27001: [], kiSysteme: [] })).toBe(1);
    expect(faelligeUeberpruefungen(p, '2027-06-15').map((f) => f.id)).toContain('KI-001');
  });
});

describe('Laden', () => {
  const p = vollstaendigesProjekt();
  it('lädt gültige Dateien, auch mit BOM', () => {
    expect(ladeProjektText(`﻿${JSON.stringify(p)}`).ok).toBe(true);
  });
  it.each([
    ['', 'leer'],
    ['{kaputt', 'kein-json'],
    ['[1,2]', 'kein-projekt'],
    [JSON.stringify({ ...p, schemaVersion: 99 }), 'zu-neu'],
    [JSON.stringify({ ...p, schemaVersion: 'x' }), 'keine-version'],
    [JSON.stringify({ ...p, fremd: 1 }), 'schema'],
  ])('meldet %#: %s', (text, art) => {
    const r = ladeProjektText(text);
    expect(r.ok ? 'ok' : r.art).toBe(art);
  });
  it('lehnt zu grosse Dateien ab', () => {
    expect(ladeProjektText(' '.repeat(10) + 'x'.repeat(MAX_BYTES)).ok).toBe(false);
  });
});

describe('Routen', () => {
  it('Hin und zurück', () => {
    for (const r of [
      { art: 'gefuehrt', etappe: 'E4', seite: 'E4-systeme', eintrag: 'KI-002' },
      { art: 'formular', modul: 'risiken', filter: { ki: 'KI-001' } },
      { art: 'pruefung' },
    ] as const) expect(parseRoute(routeZuHash(r))).toMatchObject(r);
  });
  it('jedes Sprungziel der Prüfregeln führt in eine vorhandene Ansicht', () => {
    const index = seitenIndex(gefuehrt);
    for (const r of regeln.regeln) {
      const ziel = sprungRoute(r.ziel.replace('{id}', 'X-001'));
      if (ziel.art === 'gefuehrt') expect(index.has(ziel.seite!), `${r.id} ${r.ziel}`).toBe(true);
      // Prozessregeln (F31, F32, H55 bis H62) führen in den Bereich Prozesse mit Detailseite
      else if (r.ziel.startsWith('prozesse/')) expect(ziel).toEqual({ art: 'prozesse', id: 'X-001' });
      // Gestaltung (H64, H65) führt in die Einstellungen, Unterseite Dokumentgestaltung
      else if (r.ziel.startsWith('einstellungen/')) expect(ziel).toEqual({ art: 'einstellungen', bereich: 'gestaltung' });
      // Bibliothek (H76 bis H80) führt in «Alle Dokumente» mit gewähltem Eintrag
      else if (r.ziel.startsWith('bibliothek')) expect(ziel).toMatchObject({ art: 'bibliothek', unter: 'alle' });
      else expect(ziel.art, `${r.id} ${r.ziel}`).toBe('formular');
    }
    expect(sprungZiel('risiken?ki=KI-001')).toEqual({ art: 'formular', modul: 'risiken', id: undefined, filter: { ki: 'KI-001' } });
  });
});

describe('Dokumentset', () => {
  const texte = { de: ladeTexte('de'), en: ladeTexte('en') };
  it('ohne ISMS, Modul aus: nur D-Dokumente, keine Ergänzungsblätter', () => {
    const p = vollstaendigesProjekt();
    p.meta.modulAiAct = false;
    const { dateien } = dokumentSet(p, kataloge, 'de');
    expect(dateien.some((d) => d.id.startsWith('E-'))).toBe(false);
    expect(dateien.some((d) => d.form === 'ergaenzungsblatt')).toBe(false);
    expect(dateien.find((d) => d.id === 'D-09')?.dateiname).toBe('D-09_Folgenabschaetzung_KI-001_Copilot.docx');
  });
  it('mit ISMS und Modul: Ergänzungsblätter, D-03 und D-03-EB, E-01 bis E-09', () => {
    const p = vollstaendigesProjekt();
    p.meta.mitIsms = true;
    const { dateien, ausgelassen } = dokumentSet(p, kataloge, 'en');
    const ids = dateien.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['D-03', 'D-03-EB', 'D-06-EB', 'D-23', 'E-01', 'E-09']));
    expect(ids).not.toContain('D-06');
    // Modul NIST AI RMF aus: N-01 bis N-04 entfallen mit Grund «modul-aus»
    expect(ausgelassen.filter((a) => !a.id.startsWith('N-'))).toEqual([]);
    expect(ausgelassen.filter((a) => a.id.startsWith('N-')).every((a) => a.grund === 'modul-aus')).toBe(true);
    p.meta.modulNistRmf = true;
    expect(dokumentSet(p, kataloge, 'en').ausgelassen.some((a) => a.grund === 'modul-aus')).toBe(false);
    p.meta.modulNistRmf = false;
    expect(dokumentSet(p, kataloge, 'de', ['D-03']).dateien.map((d) => d.id)).toEqual(['D-03']);
    expect(dokumentSet(p, kataloge, 'de', ['D-03-EB']).dateien.map((d) => d.id)).toEqual(['D-03-EB']);
  });
  it('alle Dateien lassen sich als Zwischenformat erzeugen (DE und EN, beide Pfade)', () => {
    for (const mitIsms of [false, true]) {
      const p = vollstaendigesProjekt();
      p.meta.mitIsms = mitIsms;
      for (const s of ['de', 'en'] as const) {
        for (const d of dokumentSet(p, kataloge, s).dateien) {
          const ir = erzeugeIr(d, p, texte[s], kataloge, s, '1.0.0');
          expect(ir.lenkung.dokumentId, d.dateiname).toBeTruthy();
        }
      }
    }
  });
});

describe('Zustand und Prompt', () => {
  it('Änderungen setzen geaendert und melden sich', () => {
    const gemeldet: Projekt[] = [];
    const z = erstelleZustand({ beiAenderung: (p) => gemeldet.push(p), jetzt: () => '2026-10-20T10:00:00.000Z' });
    z.laden(leeresProjekt());
    z.aendere('organisation.name', 'A');
    z.aendere('organisation.name', 'A');
    z.aendereMit((p) => void p.personen.push({ id: 'P-001', name: 'B', funktion: '', aimsRollen: [] }));
    expect(gemeldet).toHaveLength(2);
    expect(z.projekt.value?.meta.geaendert).toBe('2026-10-20T10:00:00.000Z');
    expect(z.ungespeichert.value).toBe(true);
  });
  it('Prompt lässt abgewählte Felder weg', () => {
    const text = baueprompt({
      einleitung: 'Hallo', seite: { titel: 'Seite', norm: '4.1' }, firma: [{ label: 'Firma', wert: 'Geheim AG' }],
      felder: [{ schluessel: 'a', label: 'Name', wert: 'Anna', vertraulich: true }, { schluessel: 'b', label: 'Zweck', wert: 'Texte', vertraulich: false }],
      auftrag: 'Prüfe', abgewaehlt: new Set(['a', 'firma.Firma']),
      labels: { seite: 'S', frage: 'F', norm: 'N', vorlage: 'V', firma: 'U', angaben: 'A', leer: '-', auftrag: 'T' },
    });
    expect(text).not.toMatch(/Anna|Geheim/);
    expect(text).toContain('Zweck: Texte');
    expect(wertText({ a: ['x', 'y'], b: '' })).toBe('a: x; y');
  });
});

describe('UI-Texte', () => {
  it('DE und EN haben dieselben Schlüssel unter app.*', () => {
    const schluessel = (o: unknown, p = ''): string[] =>
      Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (v && typeof v === 'object' ? schluessel(v, `${p}${k}.`) : [`${p}${k}`]));
    const de = ladeTexte('de')['app'];
    const en = ladeTexte('en')['app'];
    expect(schluessel(en).sort()).toEqual(schluessel(de).sort());
  });
  it('alle im Code verwendeten festen Schlüssel t("…") existieren', () => {
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process');
    const roh = execFileSync('grep', ['-rhoE', "\\bt\\('[a-z_0-9.-]+'", join(REPO, 'src/app')], { encoding: 'utf8' });
    const de = ladeTexte('de')['app'] as Record<string, unknown>;
    const fehlend = [...new Set(roh.split('\n').filter(Boolean).map((z) => z.slice(3, -1)))].filter((k) => typeof lies(de, k) !== 'string');
    expect(fehlend).toEqual([]);
  });
});

describe('Neues Ziel: Mehrfachfeld KI-Systeme als Liste (Fund im Volldurchlauf nach P14/P16)', () => {
  it('musterEintrag(ziele) führt kiSysteme als leere Liste, damit das Feld eine Mehrfachauswahl ist und die Datei speicherbar bleibt', () => {
    expect(musterEintrag('ziele')?.['kiSysteme']).toEqual([]);
  });
});
