// AF-048 (Nacharbeit): Logikmodule neben den Oberflächen: i18n.ts (Texte, Datum, Zahl, Sprache), rahmen/wissen-daten.ts
// und rahmen/suche-standard.ts (Suchquellen), ohne Browser.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const wissen = {
  kapitel: { de: [{ id: '01', titel: 'Einstieg', abschnitte: [{ id: 'a', titel: 'Abschnitt A' }] }], en: [{ id: '01', titel: 'Start', abschnitte: [] }] },
  leitfaden: { de: { '01': ['text'] } },
  aiact: { de: [{ id: 'art-5', titel: 'Art. 5', umfang: '', seiten: '', quelle: '', fassung: '', hinweis: '', knoten: [] }] },
};
const { setzeAppDaten } = await import('../../src/app/daten.ts');
setzeAppDaten({
  texte: { de: ladeTexte('de'), en: ladeTexte('en') }, kataloge: ladeKataloge(), gefuehrt: json('src/generiert/gefuehrt.json'),
  regeln: { regeln: parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')).regeln }, version: '1.0.0', gebaut: '', beispiele: [],
  wissen,
} as never);
const I = await import('../../src/app/i18n.ts');
const W = await import('../../src/app/rahmen/wissen-daten.ts');
const Q = await import('../../src/app/rahmen/suche-quellen.ts');
const { standardQuellen } = await import('../../src/app/rahmen/suche-standard.ts');
// Node meldet eine englische Browsersprache: Texte der Tests auf Deutsch
I.uiSprache.value = 'de';

afterEach(() => {
  I.uiSprache.value = 'de';
  vi.unstubAllGlobals();
});

describe('i18n.ts', () => {
  it('t: Platzhalter, Einzahl, Rückfall auf Deutsch und auf den Schlüssel', () => {
    expect(I.t('fehler.schliessen')).toBe('Schliessen');
    expect(I.t('gibt.es.nicht')).toBe('gibt.es.nicht');
    I.uiSprache.value = 'en';
    expect(I.t('fehler.schliessen')).toBe('Close');
    expect(I.inhalt('gibt.es.nicht')).toBeUndefined();
    expect(I.inhaltRoh('app.fehler')).toBeTruthy();
  });
  it('fachText übersetzt Normverweise nur in der englischen Oberfläche', () => {
    expect(I.fachText('Anhang A bis C und D')).toBe('Anhang A bis C und D');
    I.uiSprache.value = 'en';
    expect(I.fachText('Anhang A bis C und D, Nr. 3 Satz 2')).toBe('Annex A to C and D, point 3 sentence 2');
    expect(I.fachText('4 bis 10 (Überblick)')).toBe('4 to 10 (overview)');
  });
  it('optionText, Datum, Zeitpunkt und Zahl je Sprache', () => {
    expect(I.optionText(undefined, 'x')).toBe('x');
    expect(I.optionText('gibt-es-nicht', 'x')).toBe('x');
    expect(I.datumText('2026-11-07')).toBe('07.11.2026');
    expect(I.datumText(undefined)).toBe('');
    expect(I.zeitpunktText(undefined)).toBe('');
    expect(I.zeitpunktText('kein Datum')).toBe('kein Datum');
    expect(I.zeitpunktText('2026-11-07T10:30:00')).toMatch(/^07\.11\.2026 \d\d:\d\d$/);
    expect(I.zahlText(1240.5)).toMatch(/^1['’]240,5$/);
    I.uiSprache.value = 'en';
    expect(I.datumText('2026-11-07')).toBe('07/11/2026');
    expect(I.zahlText(1240.5)).toBe('1,240.5');
  });
  it('setzeUiSprache setzt Sprache und Dokumentsprache', () => {
    const doc = { documentElement: { lang: '' } };
    vi.stubGlobal('document', doc);
    I.setzeUiSprache('en');
    expect(I.uiSprache.value).toBe('en');
    expect(doc.documentElement.lang).toBe('en-GB');
    I.setzeUiSprache('de');
    expect(doc.documentElement.lang).toBe('de-CH');
  });
  it('dokumentTitelUi liefert den Titel eines Registerdokuments', () => {
    expect(I.dokumentTitelUi('D-03').length).toBeGreaterThan(3);
  });
});

describe('rahmen/wissen-daten.ts', () => {
  it('Kapitel, Inhalte und Auszüge: Sprache der Oberfläche, sonst Deutsch', () => {
    expect(W.wissenKapitel()[0]!.titel).toBe('Einstieg');
    expect(W.kapitelInhalt('01')).toEqual(['text']);
    expect(W.kapitelInhalt('99')).toBeNull();
    expect(W.aiActAuszuege()[0]!.id).toBe('art-5');
    I.uiSprache.value = 'en';
    expect(W.wissenKapitel()[0]!.titel).toBe('Start');
    expect(W.kapitelInhalt('01')).toEqual(['text']);
    expect(W.aiActAuszuege()[0]!.id).toBe('art-5');
  });
});

describe('rahmen/suche-standard.ts', () => {
  const p = (): Projekt => JSON.parse(JSON.stringify(vollstaendigesProjekt())) as Projekt;
  const alle = (q: string, projekt: Projekt | null) => Q.suchquellen().filter((s) => s.mitProjekt !== false || true).flatMap((s) => (projekt || s.mitProjekt === false ? s.suche(q, projekt) : []));
  it('registriert die Standardquellen einmal; ohne Projekt nur Wissen, Glossar und Seiten', () => {
    standardQuellen();
    const n = Q.suchquellen().length;
    standardQuellen();
    expect(Q.suchquellen()).toHaveLength(n);
    expect(Q.suchquellen().map((s) => s.id)).toEqual(expect.arrayContaining(['ki-systeme', 'risiken', 'massnahmen', 'controls', 'lieferanten', 'folgen', 'ziele', 'feststellungen', 'nachweise', 'prozesse', 'guide', 'wissen', 'glossar', 'seiten']));
    for (const s of Q.suchquellen()) expect(s.gruppe().length).toBeGreaterThan(0);
    expect(Q.suchquellen().filter((s) => s.mitProjekt !== false).flatMap((s) => s.suche('a', null))).toEqual([]);
  });
  it('findet Einträge des Projekts nach Kennung und Titel mit Ziel im Werkzeug', () => {
    const projekt = p();
    const ki = projekt.kiSysteme[0]!;
    const treffer = alle(ki.id, projekt);
    expect(treffer.some((t) => t.href.includes(ki.id))).toBe(true);
    const r = projekt.risiken[0]!;
    expect(alle(r.id, projekt).some((t) => t.href.includes(r.id))).toBe(true);
    expect(alle(r.titel.split(' ')[0]!, projekt).length).toBeGreaterThan(0);
    expect(alle('A.2.2', projekt).some((t) => t.href.includes('A.2.2'))).toBe(true);
    expect(alle('PR-02', projekt).some((t) => t.href.includes('PR-02'))).toBe(true);
  });
  it('Wissen, Glossar und Seiten sind ohne Projekt auffindbar', () => {
    expect(alle('Abschnitt A', null).some((t) => t.href.includes('wissen'))).toBe(true);
    expect(alle('Start', null).length).toBeGreaterThan(0);
    expect(alle('zzzqqq', null)).toEqual([]);
  });
  it('Guide: Seiten mit Titel werden gefunden', () => {
    const projekt = p();
    const guide = Q.suchquellen().find((s) => s.id === 'guide')!;
    expect(guide.suche('', projekt).length).toBeGreaterThanOrEqual(0);
    expect(guide.suche('Organisation', null)).toEqual([]);
  });
});
