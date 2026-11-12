// AF-048: Kernlogik des Zustands (zustand/kern.ts, zustand/store.ts) ohne Browser: Änderungen, Öffnen und Neuanlegen,
// Rückfrage beim Wechsel, Speicherstart mit Ersatzumgebung, Meldungen, Theme, Stichtag.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';
import { beantworte } from '../fixtures/bestaetigen.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const { setzeAppDaten } = await import('../../src/app/daten.ts');
setzeAppDaten({
  texte: { de: ladeTexte('de'), en: ladeTexte('en') }, kataloge: ladeKataloge(), gefuehrt: json('src/generiert/gefuehrt.json'),
  regeln: { regeln: parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')).regeln }, version: '1.0.0', gebaut: '', beispiele: [],
});
const { uiSprache } = await import('../../src/app/i18n.ts');
uiSprache.value = 'de';
const { erstelleZustand } = await import('../../src/app/zustand/kern.ts');
const S = await import('../../src/app/zustand/store.ts');

const neu = (): Projekt => JSON.parse(JSON.stringify(vollstaendigesProjekt())) as Projekt;

describe('zustand/kern.ts', () => {
  it('aendere setzt Wert, Änderungszeit und meldet dem Beobachter; gleicher Wert ändert nichts', () => {
    const beobachtet: string[] = [];
    const z = erstelleZustand({ beiAenderung: (p) => beobachtet.push(p.organisation.name), jetzt: () => '2026-11-07T10:00:00.000Z' });
    z.aendere(['organisation', 'name'], 'ohne Projekt');
    expect(beobachtet).toEqual([]);
    z.aendereMit(() => undefined);
    expect(z.projekt.value).toBeNull();
    z.laden(neu());
    expect(z.ungespeichert.value).toBe(false);
    z.aendere(['organisation', 'name'], 'Neu AG');
    expect(z.projekt.value!.organisation.name).toBe('Neu AG');
    expect(z.projekt.value!.meta.geaendert).toBe('2026-11-07T10:00:00.000Z');
    expect(z.ungespeichert.value).toBe(true);
    expect(z.lies(['organisation', 'name'])).toBe('Neu AG');
    z.aendere(['organisation', 'name'], 'Neu AG');
    expect(beobachtet).toEqual(['Neu AG']);
  });
  it('aendereMit arbeitet auf einer Kopie und übernimmt Entwurf oder Rückgabe', () => {
    const z = erstelleZustand();
    const p = neu();
    z.laden(p, false);
    z.aendereMit((e) => {
      e.organisation.name = 'Entwurf';
    });
    expect(p.organisation.name).not.toBe('Entwurf');
    expect(z.projekt.value!.organisation.name).toBe('Entwurf');
    z.aendereMit((e) => ({ ...e, organisation: { ...e.organisation, name: 'Rückgabe' } }));
    expect(z.projekt.value!.organisation.name).toBe('Rückgabe');
    z.laden(null, true);
    expect(z.projekt.value).toBeNull();
    expect(z.ungespeichert.value).toBe(true);
  });
  it('ohne Optionen: Zeitstempel aus der Uhr', () => {
    const z = erstelleZustand();
    z.laden(neu());
    z.aendere(['organisation', 'name'], 'Uhr');
    expect(Date.parse(z.projekt.value!.meta.geaendert!)).not.toBeNaN();
  });
});

describe('zustand/store.ts: Öffnen, Neuanlegen, Rückfrage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    S.zustand.laden(null);
    S.beispielUnveraendert.value = false;
  });

  it('deserialisieren liefert das Projekt oder wirft LadeFehler mit Art, Details und Rohtext bei Schemafehlern', () => {
    const p = neu();
    expect(S.deserialisieren(JSON.stringify(p)).meta.projektId).toBe(p.meta.projektId);
    expect(() => S.deserialisieren('')).toThrowError(S.LadeFehler);
    const kaputt = neu();
    kaputt.kiSysteme[0]!.name = 'x'.repeat(600);
    try {
      S.deserialisieren(JSON.stringify(kaputt));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(S.LadeFehler);
      const f = e as InstanceType<typeof S.LadeFehler>;
      expect(f.art).toBe('schema');
      expect(f.text).toBeTruthy();
      expect(f.message).toContain('schema');
    }
    try {
      S.deserialisieren('{ kein json');
    } catch (e) {
      expect((e as InstanceType<typeof S.LadeFehler>).text).toBeUndefined();
    }
  });

  it('vorDemSpeichern: gültig unverändert, ungültig mit Vorschlag und Rohdaten', () => {
    const p = neu();
    expect(S.vorDemSpeichern(p)).toBe(p);
    p.kiSysteme[0]!.name = 'x'.repeat(600);
    const f = (() => {
      try {
        S.vorDemSpeichern(p);
      } catch (e) {
        return e as InstanceType<typeof S.SpeicherPruefFehler>;
      }
    })()!;
    expect(f.name).toBe('SpeicherPruefFehler');
    expect(f.reparatur).not.toBeNull();
    expect(JSON.parse(f.roh).kiSysteme[0].name.length).toBe(600);
  });

  it('wechselErlaubt: ohne Projekt, ohne Änderung und bei unverändertem Beispiel ohne Rückfrage, sonst mit', async () => {
    const frage = vi.fn((_text: string) => false);
    beantworte(frage);
    expect(await S.wechselErlaubt()).toBe(true);
    S.zustand.laden(neu(), false);
    expect(await S.wechselErlaubt()).toBe(true);
    S.zustand.laden(neu(), true);
    S.beispielUnveraendert.value = true;
    expect(await S.wechselErlaubt()).toBe(true);
    S.beispielUnveraendert.value = false;
    expect(await S.wechselErlaubt()).toBe(false);
    expect(frage).toHaveBeenCalledTimes(1);
    expect(frage.mock.calls[0]![0]).toContain(S.projekt.value!.organisation.name);
    frage.mockReturnValue(true);
    expect(await S.wechselErlaubt()).toBe(true);
    const ohneName = neu();
    ohneName.organisation.name = '';
    S.zustand.laden(ohneName, true);
    await S.wechselErlaubt();
    expect(frage.mock.calls.at(-1)![0]).not.toContain('undefined');
  });

  it('Stichtag geht an Umfeld und Bereitschaft: Freigabe nach dem Stichtag zählt nicht (AF-081)', () => {
    const mit = (am: string) => {
      const p = neu();
      p.meta.geaendert = '2999-01-02T00:00:00.000Z';
      p.dokumente.find((d) => d.id === 'D-07')!.freigabe = { von: 'P-001', am };
      S.projektUebernehmen(p, false);
      return p;
    };
    const ohneFreigabe = () => S.bereitschaftStand.value!.luecken.find((l) => l.art === 'dokumente')?.ids ?? [];
    const p1 = mit('3000-01-01');
    expect(S.umfeld.value.heute!(p1)).toBe('2999-01-02');
    expect(S.umfeld.value.heute!(neu())).toBe(S.stichtagVon(neu()));
    expect(ohneFreigabe()).toContain('D-07');
    mit('2998-12-31');
    expect(ohneFreigabe()).not.toContain('D-07');
  });

  it('projektUebernehmen setzt den Datenstand für den Stichtag; stichtagVon wählt das spätere Datum', () => {
    const p = neu();
    p.meta.geaendert = '2999-01-02T00:00:00.000Z';
    S.projektUebernehmen(p, false);
    expect(S.stichtag.value).toBe('2999-01-02');
    expect(S.stichtagAbweichend.value).toBe(true);
    expect(S.stichtagVon(p)).toBe('2999-01-02');
    const alt = neu();
    alt.meta.geaendert = '2020-01-01T00:00:00.000Z';
    expect(S.stichtagVon(alt)).toBe(S.heute());
    const ohne = neu();
    delete (ohne.meta as { geaendert?: string }).geaendert;
    expect(S.stichtagVon(ohne)).toBe(S.heute());
    S.projektUebernehmen(alt, true);
    expect(S.stichtag.value).toBe(S.heute());
    expect(S.stichtagAbweichend.value).toBe(false);
    S.zustand.laden(null);
    expect(S.stichtag.value).toBe(S.heute());
    expect(S.befunde.value).toEqual([]);
    expect(S.bereitschaftStand.value).toBeNull();
    expect(S.fehlerStand.value).toEqual({ jetzt: [], spaeter: [], hinweise: [] });
  });

  it('abgeleitete Werte rechnen mit dem offenen Projekt', () => {
    S.projektUebernehmen(neu(), false);
    expect(Array.isArray(S.befunde.value)).toBe(true);
    expect(S.bereitschaftStand.value).not.toBeNull();
    expect(S.fehlerStand.value.jetzt).toBeDefined();
    expect(S.umfeld.value.controlIds42001.length).toBeGreaterThan(0);
  });

  it('holeSpeicher ohne Start wirft; zwischenstaende ohne Speicher ist leer', async () => {
    expect(() => S.holeSpeicher()).toThrowError('Speicher nicht bereit');
    expect(await S.zwischenstaende()).toEqual([]);
  });

  it('Route: navigiere setzt Hash und Signal, theme merkt die Wahl, Meldungen verschwinden nach der Dauer', () => {
    const el: { dataset: Record<string, string> } = { dataset: {} };
    const ort = { hash: '' };
    vi.stubGlobal('location', ort);
    vi.stubGlobal('document', { documentElement: el });
    S.navigiere({ art: 'start' });
    expect(ort.hash).toBe('#/start');
    expect(S.route.value).toEqual({ art: 'start' });
    S.navigiere({ art: 'start' });
    expect(S.themeAusGemerkt('hell')).toBe('hell');
    expect(S.themeAusGemerkt('system')).toBe('system');
    expect(S.themeAusGemerkt('quatsch')).toBe('dunkel');
    S.setzeTheme('hell');
    expect(el.dataset['theme']).toBe('hell');
    S.setzeTheme('system');
    expect(el.dataset['theme']).toBeUndefined();
    S.setzeTheme('dunkel');
    expect(el.dataset['theme']).toBe('dunkel');
    vi.useFakeTimers();
    S.melde('Text', 'ok', 100);
    expect(S.meldung.value).toEqual({ text: 'Text', art: 'ok' });
    vi.advanceTimersByTime(101);
    expect(S.meldung.value).toBeNull();
    S.melde('Standard');
    expect(S.meldung.value!.art).toBe('info');
    vi.useRealTimers();
  });

  it('neuesProjekt legt das Projekt an, setzt die Wahl zum ISMS und fragt den Speicher', async () => {
    // Speicher mit Ersatzumgebung starten: kein FSA, kein IndexedDB, kein localStorage (Node)
    await S.speicherStarten();
    expect(S.zwischenspeicherArt.value).toBeTruthy();
    const ort = { hash: '' };
    vi.stubGlobal('location', ort);
    S.neuesProjekt({ sprache: 'de', mitIsms: true, modulAiAct: false, ismsAntwort: 'zertifiziert' });
    expect(S.projekt.value!.meta.ismsZertifiziert).toBe(true);
    expect(S.projekt.value!.meta.gefuehrt.antworten['isms']).toBe('zertifiziert');
    expect(S.ungespeichert.value).toBe(true);
    expect(ort.hash).toContain('E0');
    expect(S.holeSpeicher().aktuell).toBe(S.projekt.value);
    // Änderung geht an den Speicher, setzt beispielUnveraendert zurück
    S.beispielUnveraendert.value = true;
    S.aendere(['organisation', 'name'], 'Geändert AG');
    expect(S.beispielUnveraendert.value).toBe(false);
    expect(S.holeSpeicher().aktuell!.organisation.name).toBe('Geändert AG');
    S.neuesProjekt({ sprache: 'en', mitIsms: false, modulAiAct: true });
    expect(S.projekt.value!.meta.ismsZertifiziert).toBe(false);
    S.aendereMit((p) => {
      p.organisation.name = 'Liste';
    });
    expect(S.holeSpeicher().aktuell!.organisation.name).toBe('Liste');
    // Der Wechsel hat den Stand des ersten Projekts gesichert
    await S.holeSpeicher().zwischenspeichern();
    expect((await S.zwischenstaende()).length).toBeGreaterThan(0);
    expect(S.speicherStatus.value).not.toBeNull();
  });
});
