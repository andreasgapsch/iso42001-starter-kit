// Mutationstest der Prüfregeln (AF-052, QK-29; mit V2: neue und geänderte Regeln F33 bis F47 mit Positiv- und
// Negativbeispiel; AF-081: eine Zählweise für den Fortschritt).
// Aus Kopien der vier ausgelieferten Beispiele (Muster und Präzision, DE und EN) baut jeder Mutator einen gezielten Fehler
// ein (Eintrag löschen, unbekannte ID, Datum nach Dokumentdatum, «wirksam» bei offener Feststellung, Datum im Freitext,
// dazu die Klassen aus AF-079 und AF-095). Jede Mutation muss einen neuen Befund der zugehörigen Regel auslösen; die
// harmlose Gegenseite (gleiche Felder, gültiger Wert) darf keinen auslösen. Befunde, die ein Beispiel schon vor der
// Mutation hat (bis P15a und P15b), zählen weder als Fund noch als Fehlalarm. Die Beispieldateien werden nie verändert.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { afterAll, describe, expect, it } from 'vitest';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { pruefeProjekt, type Regel } from '../../src/regeln/pruefungen.ts';
import { kennzahlenGegenAufzeichnungen, stimmigkeit } from '../../src/regeln/stimmigkeit.ts';
import { CONTROLS_42001, kiSystem, vollstaendigesProjekt } from '../fixtures/projekt.ts';
import { MUTATOREN, type Marke } from '../fixtures/mutationen/mutatoren.ts';

const kataloge = ladeKataloge();
const regeln = (parse(readFileSync('src/regeln/pruefregeln.yaml', 'utf8')) as { regeln: Regel[] }).regeln;
const DATEIEN = [
  'src/beispiele/muster-maschinenbau.de.aims.json',
  'src/beispiele/muster-maschinenbau.en.aims.json',
  'src/beispiele/praezisionsteile.de.aims.json',
  'src/beispiele/praezisionsteile.en.aims.json',
];
const hash = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');
const VORHER = new Map(DATEIEN.map((f) => [f, hash(f)]));
const kopie = (f: string): Projekt => JSON.parse(readFileSync(f, 'utf8')) as Projekt;

interface Fund {
  regel?: string;
  art?: string;
  id: string;
  text: string;
}
/** Alle Befunde der Prüfregeln und der Stimmigkeitsprüfung in einheitlicher Gestalt */
function befunde(p: Projekt): Fund[] {
  const r = pruefeProjekt(regeln, { projekt: p, heute: '2027-02-15', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge });
  const s = stimmigkeit(p, { kataloge });
  return [...r.map((b) => ({ regel: b.regel, id: b.id ?? '', text: b.name ?? '' })), ...s.map((a) => ({ art: a.art, id: a.wo, text: a.was }))];
}
function trifft(m: Marke, f: Fund): boolean {
  if (m.regel && f.regel !== m.regel) return false;
  if (m.stimm && f.art !== m.stimm.art) return false;
  if (m.id !== undefined && !(typeof m.id === 'string' ? f.id === m.id : m.id.test(f.id))) return false;
  return !m.text || m.text.test(f.text);
}

const schl = (f: Fund) => `${f.regel ?? f.art}|${f.id}`;
const grundlage = new Map<string, Fund[]>(DATEIEN.map((f) => [f, befunde(kopie(f))]));

/** Befunde des Beispiels nach der Vorbereitung des Mutators (Grundlage, wenn das Beispiel den Befund schon hat) */
function sauberBefunde(m: (typeof MUTATOREN)[number], datei: string): Fund[] {
  const p = kopie(datei);
  m.sauber?.(p);
  return befunde(p);
}

interface Zaehler { eingebaut: number; gefunden: number; negativ: number; fehlalarm: number }
const BILANZ = new Map<string, Zaehler>();
const schluessel = (m: { regel: string; art: string }) => `${m.regel} ${m.art}`;

describe('AF-052: Mutator erzeugt gezielte Fehler in Kopien der Beispiele', () => {
  for (const m of MUTATOREN) {
    it(`${m.regel}: ${m.art}`, () => {
      const z: Zaehler = { eingebaut: 0, gefunden: 0, negativ: 0, fehlalarm: 0 };
      const verpasst: string[] = [];
      const eigene: string[] = [];
      for (const datei of DATEIEN) {
        const vorher = grundlage.get(datei)!;
        const pos = kopie(datei);
        m.sauber?.(pos);
        const marke = m.positiv(pos);
        if (marke && !(m.sauber ? sauberBefunde(m, datei) : vorher).some((f) => trifft(marke, f))) {
          z.eingebaut++;
          if (befunde(pos).some((f) => trifft(marke, f))) z.gefunden++;
          else verpasst.push(datei);
        }
        const neg = kopie(datei);
        m.sauber?.(neg);
        const vorNeg = JSON.stringify(neg);
        const gegen = m.negativ(neg);
        // Nur echte Änderungen zählen (N2): Eine Gegenseite ohne Änderung beweist nichts
        if (gegen && JSON.stringify(neg) !== vorNeg) {
          const grund = m.sauber ? sauberBefunde(m, datei) : vorher;
          if (!grund.some((f) => trifft(gegen, f))) {
            z.negativ++;
            const nachher = befunde(neg);
            if (nachher.some((f) => trifft(gegen, f))) z.fehlalarm++;
            // Harmlos heisst auch: kein anderer neuer Befund, weder dieser noch einer anderen Regel
            const bekannt = new Set(grund.map(schl));
            for (const f of nachher) if (!bekannt.has(schl(f))) eigene.push(`${datei}: ${schl(f)}`);
          }
        }
      }
      BILANZ.set(schluessel(m), z);
      expect(verpasst, 'Mutation nicht erkannt in').toEqual([]);
      expect(z.eingebaut, 'Mutator passt zu mindestens einem Beispiel').toBeGreaterThan(0);
      expect(z.negativ, 'Gegenseite passt zu mindestens einem Beispiel').toBeGreaterThan(0);
      expect(z.fehlalarm, 'Fehlalarm der harmlosen Gegenseite').toBe(0);
      expect(eigene, 'harmlose Gegenseite ohne eigene Befunde').toEqual([]);
    });
  }

  it('gemeldete Mutationsarten 100 %, Fehlalarme 0 (Mutationsquote je Regel)', () => {
    const je = new Map<string, Zaehler>();
    for (const m of MUTATOREN) {
      const z = BILANZ.get(schluessel(m)) ?? { eingebaut: 0, gefunden: 0, negativ: 0, fehlalarm: 0 };
      const s = je.get(m.regel) ?? { eingebaut: 0, gefunden: 0, negativ: 0, fehlalarm: 0 };
      je.set(m.regel, { eingebaut: s.eingebaut + z.eingebaut, gefunden: s.gefunden + z.gefunden, negativ: s.negativ + z.negativ, fehlalarm: s.fehlalarm + z.fehlalarm });
    }
    const zeilen = [...je].map(([regel, z]) => `${regel}: ${z.gefunden} von ${z.eingebaut} eingebauten Fehlern gefunden, ${z.fehlalarm} Fehlalarme bei ${z.negativ} harmlosen Änderungen`);
    // Ausgabe der Quote je Regel für den Bericht (npx vitest run tests/unit/regeln-mutation.test.ts)
    console.log(`Mutationsquote\n${zeilen.join('\n')}`);
    for (const z of je.values()) {
      expect(z.eingebaut).toBeGreaterThan(0);
      expect(z.gefunden).toBe(z.eingebaut);
      expect(z.fehlalarm).toBe(0);
    }
  });

  it('Mutationsarten der Aufgabe sind alle vertreten', () => {
    const arten = MUTATOREN.map((m) => m.art.toLowerCase()).join('|');
    for (const a of ['eintrag löschen', 'unbekannte id', 'datum nach dokumentdatum', 'wirksam bei offener feststellung', 'datum im freitext']) expect(arten, a).toContain(a);
  });
});

describe('AF-052 (V2): neue und geänderte Regeln mit Positiv- und Negativbeispiel', () => {
  const neu = Array.from({ length: 15 }, (_, i) => `F${33 + i}`);
  it('jede Regel F33 bis F47 ist in pruefregeln.yaml, hat einen Mutator und beide Beispiele (100 %)', () => {
    const ids = new Set(regeln.map((r) => r.id));
    for (const id of neu) {
      expect(ids.has(id), `${id} in pruefregeln.yaml`).toBe(true);
      const zs = MUTATOREN.filter((m) => m.regel === id).map((m) => BILANZ.get(schluessel(m)));
      expect(zs.length, `${id} hat einen Mutator`).toBeGreaterThan(0);
      expect(zs.some((z) => z && z.eingebaut > 0 && z.gefunden === z.eingebaut), `${id} Positivbeispiel`).toBe(true);
      expect(zs.some((z) => z && z.negativ > 0 && z.fehlalarm === 0), `${id} Negativbeispiel`).toBe(true);
    }
  });
  it('geänderte Regel: H90 ist durch F35 ersetzt', () => {
    expect(regeln.some((r) => r.id === 'H90')).toBe(false);
    expect(MUTATOREN.some((m) => m.regel === 'F35')).toBe(true);
  });
  it('ausgelieferte Beispiele bleiben unverändert (Mutation nur an Kopien)', () => {
    for (const f of DATEIEN) expect(hash(f), f).toBe(VORHER.get(f));
  });
  afterAll(() => {
    for (const f of DATEIEN) expect(hash(f), f).toBe(VORHER.get(f));
  });
});

// ------------------------------------------------------------------------------------------------- PR-19 (Nacharbeit P15b)

describe('PR-19: Stunden aus den Zeitfeldern, Rückfall auf den Korrekturtext nur wenn sie fehlen', () => {
  /** Eigene Fixture: Vorfall von Mittwoch 09:40 bis Freitag 09:40 (48 Stunden); der Korrekturtext nennt nur den Donnerstag (24 Stunden) */
  function fall(zeitfelder: boolean, wert: string): Projekt {
    const p = vollstaendigesProjekt();
    p.kiSysteme = [kiSystem()];
    p.feststellungen = [{
      id: 'F-001', quelle: 'vorfall', einstufung: 'nk-leicht', beschreibung: 'Falsche Antwort versendet', normbezug: 'A.8.4',
      korrektur: 'Am 04.11.2026 gesperrt.', ursache: 'u', massnahmen: [], status: 'geschlossen', datum: '2026-11-03',
      ...(zeitfelder ? { entdecktAm: '2026-11-03T09:40', eingedaemmtAm: '2026-11-05T09:40' } : {}),
    }];
    p.kennzahlMessungen = [{ kennzahl: 'PR-19', datum: '2026-12-31', wert, sollErreicht: 'ja', bemerkung: 'Aus dem Register D-22' }];
    return p;
  }
  const abweichung = (p: Projekt) => kennzahlenGegenAufzeichnungen(p, kataloge).filter((a) => a.wo === 'PR-19' && /Register ergibt/.test(a.was));

  it('mit Zeitfeldern gelten 48 Stunden, 24 Stunden aus dem Korrekturtext sind eine Abweichung (Gegenprobe zur alten Rechnung)', () => {
    expect(abweichung(fall(true, '48 Stunden'))).toEqual([]);
    expect(abweichung(fall(true, '24 Stunden')).map((a) => a.was)).toEqual(['24 Stunden, das Register ergibt 48']);
  });
  it('ohne Zeitfelder rechnet der Rückfall tagesgenau aus dem Korrekturtext', () => {
    expect(abweichung(fall(false, '24 Stunden'))).toEqual([]);
    expect(abweichung(fall(false, '48 Stunden')).map((a) => a.was)).toEqual(['48 Stunden, das Register ergibt 24']);
  });
  it('ist nur eines der beiden Zeitfelder leer, gilt der Rückfall', () => {
    const p = fall(true, '24 Stunden');
    delete p.feststellungen[0]!.eingedaemmtAm;
    expect(abweichung(p)).toEqual([]);
  });
  it('ein Vorfall, der erst nach dem Messdatum entdeckt wird, zählt nicht (Beginn aus dem Zeitfeld)', () => {
    const p = fall(true, '48 Stunden');
    p.feststellungen[0]!.datum = '2026-11-03';
    p.feststellungen[0]!.entdecktAm = '2027-01-02T09:40';
    p.feststellungen[0]!.eingedaemmtAm = '2027-01-03T09:40';
    expect(abweichung(p)).toEqual([]);
  });
});
