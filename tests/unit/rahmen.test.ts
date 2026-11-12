// Rahmen ab rc.10 (R2, R5, R6): neue Hash-Routen, Abbildung der bisherigen Routen auf die Bereiche, Untermenüs, fällige
// Aufgaben (inklusive Bibliothek), Suche mit Erweiterungsstelle, Wissen-Daten (Baum ohne innerHTML) und Theme-Übernahme.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { htmlZuKnoten, markdownHtml } from '../../scripts/wissen.mts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { parseRoute, routeZuHash, type Route } from '../../src/app/logik/routen.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));

const { setzeAppDaten } = await import('../../src/app/daten.ts');
setzeAppDaten({
  texte: { de: ladeTexte('de'), en: ladeTexte('en') }, kataloge: ladeKataloge(), gefuehrt: json('src/generiert/gefuehrt.json'),
  regeln: { regeln: parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')).regeln }, version: '1.0.0', gebaut: '', beispiele: [],
});
const { bereichVon, untermenue, BEREICHE } = await import('../../src/app/rahmen/bereiche.ts');
const { faelligeAufgaben } = await import('../../src/app/rahmen/faellig.ts');
const { registriereSuchquelle, suchen, trefferRang } = await import('../../src/app/rahmen/suche-quellen.ts');
const { themeAusGemerkt } = await import('../../src/app/zustand/store.ts');
const { uiSprache } = await import('../../src/app/i18n.ts');
// Node meldet eine englische Browsersprache: Texte der Tests auf Deutsch
uiSprache.value = 'de';

describe('Routen', () => {
  it('neue Routen hin und zurück', () => {
    const routen: Route[] = [
      { art: 'start', unter: 'projekte' }, { art: 'uebersicht', unter: 'faellig' }, { art: 'uebersicht', unter: 'bereitschaft' },
      { art: 'wissen', unter: 'leitfaden', id: '03/schritt-1-auftrag-und-ausgangslage' }, { art: 'wissen', unter: 'regelwerk', id: '42001/A.2.2' },
      { art: 'wissen', unter: 'glossar' }, { art: 'hinweise' }, { art: 'hilfe', unter: 'tasten' }, { art: 'pruefung', unter: 'stage1' },
      { art: 'einstellungen', bereich: 'darstellung' }, { art: 'einstellungen', bereich: 'speicher' },
    ];
    for (const r of routen) expect(parseRoute(routeZuHash(r)), routeZuHash(r)).toEqual(r);
    // #/uebersicht ohne Unterseite ist das Lagebild
    expect(parseRoute('#/uebersicht')).toEqual({ art: 'formular', modul: 'uebersicht' });
  });

  it('bisherige Routen gehören zum passenden Bereich', () => {
    const faelle: [string, string][] = [
      ['#/start', 'start'], ['#/formular/uebersicht', 'uebersicht'], ['#/formular/risiken', 'register'], ['#/formular/mitarbeitende', 'register'],
      ['#/formular/generator', 'bibliothek'], ['#/dokumente', 'bibliothek'], ['#/gefuehrt/E4/E4-systeme', 'guide'], ['#/prozesse/PR-07', 'prozesse'],
      ['#/pruefung', 'pruefung'], ['#/einstellungen/gestaltung', 'einstellungen'], ['#/ueber', 'einstellungen'], ['#/wissen', 'wissen'],
    ];
    for (const [h, b] of faelle) expect(bereichVon(parseRoute(h)), h).toBe(b);
  });
});

describe('Untermenüs', () => {
  const p = vollstaendigesProjekt();
  const umfeld = (r: Route) => ({ p, r, stichtag: '2026-10-24', faellig: 2, fehler: 1, hinweise: 3 });

  it('Register gruppiert nach Grundlagen, Umsetzung, Bewertung; Module nur wenn eingeschaltet', () => {
    p.meta.modulAiAct = false;
    p.meta.modulNistRmf = false;
    p.meta.mitIsms = false;
    const g = untermenue('register', umfeld({ art: 'formular', modul: 'risiken' }));
    expect(g.map((x) => x.name)).toEqual(['Grundlagen', 'Umsetzung', 'Bewertung']);
    expect(g.flatMap((x) => x.punkte).filter((x) => x.aktiv).map((x) => x.id)).toEqual(['risiken']);
    p.meta.modulAiAct = true;
    expect(untermenue('register', umfeld({ art: 'formular', modul: 'aiact' })).at(-1)!.punkte.map((x) => x.id)).toEqual(['aiact']);
  });

  it('Guide: Etappen 0 bis 13 mit Stand und Jahreskalender', () => {
    const g = untermenue('guide', umfeld({ art: 'gefuehrt', etappe: 'E4' }));
    const etappen = g.find((x) => x.name === 'Etappen')!.punkte;
    expect(etappen.map((x) => x.id)).toEqual(expect.arrayContaining(['E0', 'E4', 'E13']));
    expect(etappen.every((x) => ['offen', 'laeuft', 'erledigt'].includes(x.schritt!))).toBe(true);
    expect(etappen.find((x) => x.id === 'E4')!.aktiv).toBe(true);
    expect(g.at(-1)!.punkte[0]!.href).toBe('#/gefuehrt/J');
  });

  it('jeder Bereich hat ein Ziel und ein Untermenü mit mindestens einem Eintrag', () => {
    for (const b of BEREICHE) {
      const g = untermenue(b.id, umfeld(b.ziel));
      expect(g.flatMap((x) => x.punkte).length, b.id).toBeGreaterThan(0);
      expect(bereichVon(b.ziel), b.id).toBe(b.id);
    }
  });
});

describe('Fällige Aufgaben', () => {
  it('Massnahmen, Überprüfungen und Bibliothek (Prüftermin, Datei geändert oder fehlend)', () => {
    const p = vollstaendigesProjekt();
    p.massnahmen.push({ id: 'M-901', titel: 'Testmassnahme', beschreibung: '', status: 'offen', prioritaet: 'mittel', herkunft: { art: 'sonstige' }, termin: '2026-10-01' });
    p.bibliothek = {
      ablage: 'ordner',
      eintraege: [{ id: 'X-001', art: 'eigene', titel: 'Vertrag HR-SaaS', versionen: [], naechstePruefung: '2026-11-05' }],
      abgleich: { am: '2026-10-20T10:00:00Z', geaendert: ['X-001'], fehlend: ['N-001'] },
    };
    const liste = faelligeAufgaben(p, '2026-10-24');
    expect(liste[0]!.stand).toBe('ueberfaellig');
    expect(liste.find((a) => a.art === 'massnahme')).toMatchObject({ id: 'M-901', stand: 'ueberfaellig' });
    expect(liste.find((a) => a.art === 'bibliothek')).toMatchObject({ id: 'X-001', titel: 'Vertrag HR-SaaS', stand: 'bald', datum: '2026-11-05' });
    expect(liste.find((a) => a.art === 'geaendert')).toMatchObject({ id: 'X-001', stand: 'ueberfaellig', ziel: { art: 'bibliothek' } });
    expect(liste.find((a) => a.art === 'fehlt')).toMatchObject({ id: 'N-001', stand: 'ueberfaellig' });
  });
});

describe('Suche', () => {
  it('Treffer am Wortanfang vor Treffern im Wort, alle Wörter nötig, Akzente egal', () => {
    expect(trefferRang('ris', 'Risiken')).toBeGreaterThan(trefferRang('ris', 'Ausrisiko'));
    expect(trefferRang('ki risiko', 'KI-Risiko')).toBeGreaterThan(0);
    expect(trefferRang('ki xyz', 'KI-Risiko')).toBe(0);
    expect(trefferRang('ubersicht', 'Übersicht')).toBeGreaterThan(0);
  });

  it('Erweiterungsstelle: registrierte Quelle liefert gruppierte Treffer, Fehler einer Quelle stören nicht', () => {
    const weg = registriereSuchquelle({ id: 'test', gruppe: () => 'Test', mitProjekt: false, suche: (q) => [{ titel: `Treffer ${q}`, href: '#/test' }] });
    const kaputt = registriereSuchquelle({ id: 'kaputt', gruppe: () => 'Kaputt', mitProjekt: false, suche: () => { throw new Error('x'); } });
    const r = suchen('abc', null);
    expect(r.find((g) => g.id === 'test')).toMatchObject({ titel: 'Test', treffer: [{ titel: 'Treffer abc' }] });
    expect(r.find((g) => g.id === 'kaputt')).toBeUndefined();
    expect(suchen('a', null)).toEqual([]);
    weg();
    kaputt();
    expect(suchen('abc', null).find((g) => g.id === 'test')).toBeUndefined();
  });
});

describe('Wissen', () => {
  it('Markdown und Bausteine als Baum ohne Skript, Stil, Abbildungen und Adressen mit Schema', () => {
    const { html } = markdownHtml('# Titel\n\nText **fett** https://example.org\n\n<figure><figcaption>Abbildung 1 Fahrplan</figcaption><svg><text>x</text></svg></figure>\n\n<script>alert(1)</script>\n\n| a | b |\n|---|---|\n| 1 | 2 |');
    const k = htmlZuKnoten(html);
    const text = JSON.stringify(k);
    expect(k[0]).toEqual(['h1', { id: 'titel' }, 'Titel']);
    expect(text).toContain('["strong",0,"fett"]');
    expect(text).toContain('["abb",{"titel":"Abbildung 1 Fahrplan"}]');
    expect(text).not.toMatch(/https?:|svg|script|alert/);
    expect(text).toContain('["table"');
  });
});

describe('Darstellung', () => {
  it('dunkel ist Standard, bisherige Wahl bleibt', () => {
    expect(themeAusGemerkt(null)).toBe('dunkel');
    expect(themeAusGemerkt('hell')).toBe('hell');
    expect(themeAusGemerkt('system')).toBe('system');
    expect(themeAusGemerkt('quatsch')).toBe('dunkel');
  });
});
