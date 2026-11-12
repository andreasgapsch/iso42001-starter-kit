// Einheitentests ProjektSpeicher mit In-Memory-Adaptern (ohne Browser).

import { describe, expect, it } from 'vitest';
import {
  PRAEFIX,
  ProjektSpeicher,
  SpeicherAdapter,
  pruefeZwischenstand,
  type DateiHandle,
  type DateiZugriff,
  type GeoeffneteDatei,
  type SpeicherErgebnis,
  type Zeitgeber,
  type Zwischenstand,
} from '../../src/app/speicher/index.ts';

interface P {
  id: string;
  name: string;
  n: number;
}

/** Steuerbarer Zeitgeber: Aufgaben laufen erst bei vorruecken(). */
class TestZeit implements Zeitgeber {
  jetztMs = Date.parse('2026-10-20T08:00:00Z');
  private aufgaben = new Map<number, { f: () => void; faellig: number }>();
  private zaehler = 0;
  setTimeout(f: () => void, ms: number): unknown {
    const id = ++this.zaehler;
    this.aufgaben.set(id, { f, faellig: this.jetztMs + ms });
    return id;
  }
  clearTimeout(id: unknown): void {
    this.aufgaben.delete(id as number);
  }
  get offen(): number {
    return this.aufgaben.size;
  }
  async vorruecken(ms: number): Promise<void> {
    this.jetztMs += ms;
    for (const [id, a] of [...this.aufgaben]) {
      if (a.faellig <= this.jetztMs) {
        this.aufgaben.delete(id);
        a.f();
      }
    }
    // Ausstehende Promises abarbeiten.
    for (let i = 0; i < 10; i++) await Promise.resolve();
  }
}

/** Attrappe für Dateizugriff mit oder ohne Handle. */
class TestDatei implements DateiZugriff {
  oeffnenAntwort: GeoeffneteDatei | null = null;
  gespeichert: { inhalt: string; vorschlag: string; handle?: DateiHandle }[] = [];
  abbrechen = false;
  werfen: Error | null = null;
  constructor(readonly art: 'fsa' | 'fallback') {}
  async oeffnen(): Promise<GeoeffneteDatei | null> {
    return this.oeffnenAntwort;
  }
  async speichern(inhalt: string, vorschlag: string, handle?: DateiHandle): Promise<SpeicherErgebnis | null> {
    if (this.werfen) throw this.werfen;
    if (this.abbrechen) return null;
    this.gespeichert.push({ inhalt, vorschlag, ...(handle ? { handle } : {}) });
    if (this.art === 'fallback') return { art: 'download', name: vorschlag };
    const h = handle ?? testHandle(vorschlag);
    // Die Attrappe merkt sich den Inhalt wie eine echte Datei: Vor dem Überschreiben vergleicht der Speicher den Stand (E2-12)
    (h as DateiHandle & { inhalt?: string }).inhalt = inhalt;
    return { art: 'datei', name: h.name, handle: h };
  }
}

function testHandle(name: string): DateiHandle {
  return {
    kind: 'file',
    name,
    getFile: async function (this: DateiHandle & { inhalt?: string }) {
      return new File([this.inhalt ?? ''], name);
    },
    createWritable: async () => ({ write: async () => {}, close: async () => {} }),
  };
}

function aufbau(art: 'fsa' | 'fallback' = 'fallback') {
  const zeit = new TestZeit();
  const datei = new TestDatei(art);
  const zwischen = new SpeicherAdapter();
  const speicher = new ProjektSpeicher<P>({
    datei,
    zwischen,
    schluesselVon: (p) => p.id,
    dateinameVon: (p) => p.name,
    zeitgeber: zeit,
    jetzt: () => new Date(zeit.jetztMs),
  });
  return { zeit, datei, zwischen, speicher };
}

const P1: P = { id: 'abc', name: 'Muster AG', n: 1 };

async function eintrag(zwischen: SpeicherAdapter, id: string): Promise<Zwischenstand> {
  const roh = await zwischen.lesen(PRAEFIX + id);
  if (roh === null) throw new Error('kein Eintrag');
  return JSON.parse(roh) as Zwischenstand;
}

describe('ProjektSpeicher', () => {
  it('speichert Änderungen erst nach der Verzögerung zwischen und entprellt', async () => {
    const { zeit, zwischen, speicher } = aufbau();
    speicher.neu(P1);
    await zeit.vorruecken(1000);
    speicher.aendern({ ...P1, n: 2 });
    await zeit.vorruecken(1500);
    expect(await zwischen.lesen(PRAEFIX + 'abc')).toBeNull();
    await zeit.vorruecken(600);
    const z = await eintrag(zwischen, 'abc');
    expect(JSON.parse(z.inhalt)).toEqual({ ...P1, n: 2 });
    expect(z.gesichertAm).toBeUndefined();
    expect(z.dateiname).toBe('Muster AG.aims.json');
    expect(speicher.status.ungespeichert).toBe(true);
    expect(speicher.status.letzterZwischenstand).toBe('2026-10-20T08:00:03.100Z');
  });

  it('Download-Fallback: Roundtrip verlustfrei, Stand als gesichert markiert, kein Handle', async () => {
    const { datei, zwischen, speicher } = aufbau('fallback');
    const projekt = { ...P1, name: 'Ümlaut «AG» / Zürich', n: 3 };
    speicher.neu(projekt);
    const r = await speicher.speichern();
    expect(r).toEqual({ art: 'download', name: 'Ümlaut «AG» Zürich.aims.json' });
    expect(JSON.parse(datei.gespeichert[0]!.inhalt)).toEqual(projekt);
    expect(speicher.status).toMatchObject({ ungespeichert: false, direkt: false });
    const z = await eintrag(zwischen, 'abc');
    expect(z.gesichertAls).toBe('download');
    expect(await speicher.zwischenstaende()).toEqual([]);
    expect(await speicher.zwischenstaende({ auchGesicherte: true })).toHaveLength(1);
  });

  it('FSA: zweites Speichern geht auf dasselbe Handle, «Speichern unter» nicht', async () => {
    const { datei, speicher } = aufbau('fsa');
    speicher.neu(P1);
    await speicher.speichern();
    expect(datei.gespeichert[0]!.handle).toBeUndefined();
    speicher.aendern({ ...P1, n: 5 });
    expect(speicher.warnenBeimVerlassen()).toBe(true);
    await speicher.speichern();
    expect(datei.gespeichert[1]!.handle?.name).toBe('Muster AG.aims.json');
    expect(speicher.status.direkt).toBe(true);
    await speicher.speichernUnter();
    expect(datei.gespeichert[2]!.handle).toBeUndefined();
    expect(speicher.warnenBeimVerlassen()).toBe(false);
  });

  it('Abbruch beim Speichern lässt «ungespeichert» stehen', async () => {
    const { datei, speicher } = aufbau('fsa');
    speicher.neu(P1);
    datei.abbrechen = true;
    expect(await speicher.speichern()).toBeNull();
    expect(speicher.status.ungespeichert).toBe(true);
  });

  it('Fehler beim Speichern wird gemeldet und weitergereicht', async () => {
    const { datei, speicher } = aufbau('fsa');
    const meldungen: (string | null)[] = [];
    speicher.beobachten((s) => meldungen.push(s.fehler));
    speicher.neu(P1);
    datei.werfen = new Error('Platte voll');
    await expect(speicher.speichern()).rejects.toThrow('Platte voll');
    expect(meldungen.at(-1)).toBe('Speichern: Platte voll');
  });

  it('Öffnen meldet abweichenden, ungesicherten Zwischenstand desselben Projekts', async () => {
    const { zeit, datei, speicher } = aufbau('fsa');
    speicher.neu(P1);
    speicher.aendern({ ...P1, n: 9 });
    await zeit.vorruecken(2000);
    datei.oeffnenAntwort = { name: 'x.aims.json', inhalt: JSON.stringify(P1), handle: testHandle('x.aims.json') };
    const g = await speicher.oeffnen();
    expect(g?.projekt).toEqual(P1);
    expect(JSON.parse(g!.zwischenstand!.inhalt)).toEqual({ ...P1, n: 9 });
    expect(speicher.status).toMatchObject({ ungespeichert: false, direkt: true, dateiname: 'x.aims.json' });
    // Wiederherstellen behält das Handle derselben Datei.
    const w = await speicher.wiederherstellen('abc');
    expect(w.n).toBe(9);
    expect(speicher.status).toMatchObject({ ungespeichert: true, direkt: true, dateiname: 'x.aims.json' });
  });

  it('Öffnen ohne Zwischenstand und Abbruch', async () => {
    const { datei, speicher } = aufbau();
    expect(await speicher.oeffnen()).toBeNull();
    datei.oeffnenAntwort = { name: 'y.json', inhalt: JSON.stringify({ ...P1, id: 'neu' }) };
    const g = await speicher.oeffnen();
    expect(g?.zwischenstand).toBeNull();
    expect(speicher.aktuell?.id).toBe('neu');
  });

  it('ungültige Datei wirft und lässt das geladene Projekt unverändert', async () => {
    const { datei, speicher } = aufbau();
    speicher.neu(P1);
    datei.oeffnenAntwort = { name: 'kaputt.json', inhalt: '{nicht json' };
    await expect(speicher.oeffnen()).rejects.toThrow();
    expect(speicher.aktuell).toEqual(P1);
  });

  it('listet mehrere Projekte getrennt, neueste zuerst; verwerfen löscht', async () => {
    const { zeit, speicher, zwischen } = aufbau();
    speicher.neu(P1);
    await zeit.vorruecken(2000);
    speicher.neu({ id: 'xyz', name: 'Zweite GmbH', n: 1 });
    await zeit.vorruecken(2000);
    await zwischen.schreiben(PRAEFIX + 'kaputt', '{"v":2}');
    const liste = await speicher.zwischenstaende();
    expect(liste.map((z) => z.schluessel)).toEqual(['xyz', 'abc']);
    await speicher.verwerfen('xyz');
    expect((await speicher.zwischenstaende()).map((z) => z.schluessel)).toEqual(['abc']);
    // Wiederherstellen eines anderen Projekts verwirft das Handle.
    await speicher.wiederherstellen('abc');
    expect(speicher.status).toMatchObject({ direkt: false, dateiname: 'Muster AG.aims.json' });
    await expect(speicher.wiederherstellen('fehlt')).rejects.toThrow('nicht gefunden');
  });

  it('Fehler im Zwischenspeicher landet im Status, nicht als Ausnahme', async () => {
    const { zeit, speicher, zwischen } = aufbau();
    zwischen.schreiben = async () => {
      throw new Error('QuotaExceededError');
    };
    speicher.neu(P1);
    await zeit.vorruecken(2000);
    expect(speicher.status.fehler).toBe('Zwischenspeicher: QuotaExceededError');
  });

  it('zwischenspeichern() sofort, ohne Projekt nichts; Timer wird abgebrochen', async () => {
    const { zeit, speicher, zwischen } = aufbau();
    await speicher.zwischenspeichern();
    expect(await zwischen.schluessel(PRAEFIX)).toEqual([]);
    speicher.neu(P1);
    expect(zeit.offen).toBe(1);
    await speicher.zwischenspeichern();
    expect(zeit.offen).toBe(0);
    expect(await zwischen.schluessel(PRAEFIX)).toEqual([PRAEFIX + 'abc']);
    expect(speicher.zwischenspeicherArt).toBe('speicher');
  });

  it('beobachten liefert sofort den Status und lässt sich abmelden', () => {
    const { speicher } = aufbau();
    const n: boolean[] = [];
    const ab = speicher.beobachten((s) => n.push(s.ungespeichert));
    speicher.neu(P1);
    ab();
    speicher.neu(P1);
    expect(n).toEqual([false, true]);
  });

  it('Speichern ohne Projekt wirft', async () => {
    const { speicher } = aufbau();
    await expect(speicher.speichern()).rejects.toThrow('Kein Projekt');
  });
});

describe('pruefeZwischenstand', () => {
  it('akzeptiert nur Format v1 mit Pflichtfeldern', () => {
    const ok = { v: 1, schluessel: 'a', dateiname: 'a.aims.json', geaendertAm: 'x', inhalt: '{}' };
    expect(pruefeZwischenstand(ok)).toEqual(ok);
    expect(pruefeZwischenstand(null)).toBeNull();
    expect(pruefeZwischenstand({ ...ok, v: 2 })).toBeNull();
    expect(pruefeZwischenstand({ ...ok, inhalt: 3 })).toBeNull();
    expect(pruefeZwischenstand({ ...ok, dateiname: undefined })).toBeNull();
    expect(pruefeZwischenstand({ ...ok, gesichertAm: 5 })).toBeNull();
  });
});
