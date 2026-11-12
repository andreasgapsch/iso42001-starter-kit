// Modellbasierter Test (AF-011, QK-05): Zufallsfolgen aus Anlegen, Ändern, Löschen, Rückgängig, Speichern und Laden über die
// 16 Listentypen mit IDs und die eigenen Prozesse (PE-), durch die Aktionen und den Store der App. Eigener Zufallsgenerator mit Seed (mulberry32): jede
// Fehlermeldung nennt Seed und Schritt; nachstellen mit MODELL_SEED=<seed> MODELL_FOLGEN=1 npx vitest run tests/unit/modell-folgen.test.ts.
//
// Invarianten nach jedem Schritt: hängende Verweise 0 (Verweisregister), Doppelvergaben 0 (eine ID je Liste höchstens
// einmal), Wiederverwendungen 0 (eine einmal vergebene ID wird nie neu vergeben) und Zähler sinkt nie.
// «Rückgängig» gibt es in der App noch nicht als Funktion; das Modell stellt den Stand vor dem letzten Schritt wieder her
// (zustand.laden), wie es eine Rückgängig-Funktion täte. Was im zurückgenommenen Schritt vergeben wurde, gilt danach als nie
// vergeben; das Modell führt die Menge der vergebenen IDs deshalb je Stand mit. Laden setzt Stand und Menge der gespeicherten
// Datei (der Zähler steht in der Datei, meta.idZaehler).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import { ID_PRAEFIX, type Projekt } from '../../src/model/typen.ts';
import { VERWEISE, haengendeVerweise, teile, type Verweisart } from '../../src/model/verweise.ts';
import { abhaengigeEintraege, istLoeschListe, type LoeschListe } from '../../src/app/logik/eintraege.ts';
import { zaehlerVon, type ListenName } from '../../src/app/logik/ids.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = (rel: string) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const { setzeAppDaten } = await import('../../src/app/daten.ts');
setzeAppDaten({
  texte: { de: ladeTexte('de'), en: ladeTexte('en') }, kataloge: ladeKataloge(), gefuehrt: json('src/generiert/gefuehrt.json'),
  regeln: { regeln: parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')).regeln }, version: '1.0.0', gebaut: '', beispiele: [],
});
const S = await import('../../src/app/zustand/store.ts');
const A = await import('../../src/app/ansichten/gefuehrt/aktionen.ts');
const PZ = await import('../../src/app/logik/prozesse.ts');

const FOLGEN = Number(process.env['MODELL_FOLGEN'] ?? 1000);
const START_SEED = Number(process.env['MODELL_SEED'] ?? 20261107);
/** Die 16 Listen mit ID-Präfix und die eigenen Prozesse (angelegt und gelöscht über die Aktionen der Prozessansicht) */
const LISTEN: LoeschListe[] = [...(Object.keys(ID_PRAEFIX) as ListenName[]), 'eigeneProzesse'];
/** Zielliste des Registers, unter der Einträge der Liste stehen: Controls sind hier eigene Controls, Prozesse eigene Prozesse */
const alsListe = (z: string): LoeschListe | null => (z === 'controls' ? 'eigeneControls' : z === 'prozesse' ? 'eigeneProzesse' : istLoeschListe(z) ? z : null);

/** mulberry32: kleiner, reproduzierbarer Zufallsgenerator (32 Bit) */
function zufall(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

type Objekt = Record<string, unknown>;

/** Verweisarten, die das Modell direkt am Eintrag setzt: `liste[].feld` oder `liste[].feld[]`, Quelle und Ziel aus den Listen */
interface Setzbar {
  art: Verweisart;
  quelle: LoeschListe;
  feld: string;
  liste: boolean;
  /** mögliche Ziellisten mit Wert für das Geschwisterfeld (massnahmen[].herkunft.ref) */
  ziele: { liste: LoeschListe; je?: string }[];
}
const SETZBAR: Setzbar[] = VERWEISE.flatMap((art): Setzbar[] => {
  const t = teile(art.feld);
  const quelle = t[0]!;
  if (!istLoeschListe(quelle) || t[1] !== '[]') return [];
  if (art.je && art.feld === 'massnahmen[].herkunft.ref') {
    const ziele = Object.entries(art.je.ziele).flatMap(([je, z]) => (alsListe(z) ? [{ liste: alsListe(z)!, je }] : []));
    return [{ art, quelle, feld: 'herkunft', liste: false, ziele }];
  }
  if (t.length < 3 || t.length > 4 || (t.length === 4 && t[3] !== '[]')) return [];
  const ziele = art.ziel.flatMap((z) => (alsListe(z) ? [{ liste: alsListe(z)! }] : []));
  return ziele.length ? [{ art, quelle, feld: t[2]!, liste: t.length === 4, ziele }] : [];
});

/** Listen, auf die mindestens eine setzbare Verweisart zeigt */
const ZIELLISTEN = [...new Set(SETZBAR.flatMap((s) => s.ziele.map((z) => z.liste)))];

interface Stand {
  projekt: Projekt;
  vergeben: Record<string, Set<string>>;
}
const kopie = (v: Record<string, Set<string>>) => Object.fromEntries(Object.entries(v).map(([k, s]) => [k, new Set(s)]));

type Art = 'anlegen' | 'verweis' | 'text' | 'loeschen' | 'rueckgaengig' | 'speichern' | 'laden';
const GEWICHTE: [Art, number][] = [['anlegen', 34], ['verweis', 26], ['text', 5], ['loeschen', 16], ['rueckgaengig', 7], ['speichern', 6], ['laden', 6]];

interface Statistik {
  folgen: number;
  schritte: number;
  je: Record<Art, number>;
  listenAngelegt: Set<string>;
  loeschenMitVerweisen: number;
  verweiseBeimLoeschen: number;
  haengend: number;
  doppelt: number;
  wiederverwendet: number;
  gesunken: number;
}

function folge(seed: number, st: Statistik): void {
  const z = zufall(seed);
  const wahl = <T,>(l: readonly T[]): T => l[Math.floor(z() * l.length)]!;
  const art = (): Art => {
    let r = z() * GEWICHTE.reduce((s, [, g]) => s + g, 0);
    for (const [a, g] of GEWICHTE) if ((r -= g) < 0) return a;
    return 'anlegen';
  };
  const fehler = (schritt: number, was: string, text: string): never => {
    throw new Error(`Seed ${seed}, Schritt ${schritt} (${was}): ${text}`);
  };

  S.zustand.laden(leeresProjekt({ jetzt: '2026-11-07T10:00:00.000Z', projektId: `modell-${seed}` }));
  let vergeben: Record<string, Set<string>> = Object.fromEntries(LISTEN.map((l) => [l, new Set<string>()]));
  const verlauf: Stand[] = [];
  let gespeichert: { text: string; vergeben: Record<string, Set<string>> } | null = null;
  const p = () => S.projekt.value!;
  const eintraege = (l: LoeschListe) => (p()[l] ?? []) as unknown as Objekt[];
  const merken = () => verlauf.push({ projekt: structuredClone(p()), vergeben: kopie(vergeben) });
  const laenge = 20 + Math.floor(z() * 51);

  for (let i = 0; i < laenge; i++) {
    const a = art();
    const zaehlerVorher = Object.fromEntries(LISTEN.map((l) => [l, zaehlerVon(p(), l)]));
    st.schritte++;
    st.je[a]++;
    if (a === 'anlegen') {
      const l = wahl(LISTEN);
      merken();
      const id = l === 'eigeneProzesse' ? PZ.eigenenProzessAnlegen({ titel: `Prozess ${seed}-${i}`, gruppe: 'kern', art: 'nur-aims' }, []) : A.eintragHinzufuegen({ id: 'modell', liste: l } as never);
      if (!id) fehler(i, a, `keine ID für ${l}`);
      if (vergeben[l]!.has(id)) {
        st.wiederverwendet++;
        fehler(i, a, `${l}: ${id} wurde schon einmal vergeben (Wiederverwendung)`);
      }
      vergeben[l]!.add(id);
      st.listenAngelegt.add(l);
    } else if (a === 'verweis') {
      // Nur Verweisarten, deren Quell- und Zielliste Einträge haben
      const moeglich = SETZBAR.filter((x) => eintraege(x.quelle).length && x.ziele.some((y) => eintraege(y.liste).length));
      if (!moeglich.length) continue;
      const s = wahl(moeglich);
      const quellen = eintraege(s.quelle);
      const ziel = wahl(s.ziele.filter((y) => eintraege(y.liste).length));
      const ziele = eintraege(ziel.liste);
      const q = String(wahl(quellen)['id']);
      const zid = String(wahl(ziele)['id']);
      merken();
      S.aendereMit((e) => {
        const eintrag = (e[s.quelle] as unknown as Objekt[]).find((x) => x['id'] === q)!;
        if (s.feld === 'herkunft') eintrag['herkunft'] = { art: ziel.je, ref: zid };
        else if (s.liste) {
          const l = (Array.isArray(eintrag[s.feld]) ? eintrag[s.feld] : (eintrag[s.feld] = [])) as string[];
          if (!l.includes(zid)) l.push(zid);
        } else eintrag[s.feld] = zid;
      });
    } else if (a === 'text') {
      const l = wahl(LISTEN);
      const e = eintraege(l);
      if (!e.length) continue;
      const id = String(wahl(e)['id']);
      merken();
      S.aendereMit((x) => {
        const eintrag = (x[l] as unknown as Objekt[]).find((y) => y['id'] === id)!;
        const feld = ['name', 'titel', 'beschreibung', 'was', 'bereich', 'anforderung', 'umfang', 'ziel'].find((f) => typeof eintrag[f] === 'string');
        if (feld) eintrag[feld] = `Text ${seed}-${i}`;
      });
    } else if (a === 'loeschen') {
      // Meist ein Eintrag, auf den Verweise zeigen (sonst prüft das Löschen wenig), sonst irgendeiner
      const verwiesen = z() < 0.6 ? ZIELLISTEN.flatMap((l) => eintraege(l).filter((x) => abhaengigeEintraege(p(), l, String(x['id'])).length).map((x) => [l, String(x['id'])] as const)) : [];
      const mit = LISTEN.filter((l) => eintraege(l).length);
      if (!mit.length) continue;
      const [l, id] = verwiesen.length ? wahl(verwiesen) : ((x: LoeschListe) => [x, String(wahl(eintraege(x))['id'])] as const)(wahl(mit));
      const abh = abhaengigeEintraege(p(), l, id).length;
      if (abh) {
        st.loeschenMitVerweisen++;
        st.verweiseBeimLoeschen += abh;
      }
      merken();
      if (l === 'eigeneProzesse') PZ.eigenenProzessLoeschen(id);
      else A.eintragEntfernen(l, id);
      if (eintraege(l).some((x) => x['id'] === id)) fehler(i, a, `${l} ${id} nicht gelöscht`);
    } else if (a === 'rueckgaengig') {
      const vorher = verlauf.pop();
      if (!vorher) continue;
      S.zustand.laden(vorher.projekt, true);
      vergeben = vorher.vergeben;
    } else if (a === 'speichern') {
      let text = '';
      try {
        text = JSON.stringify(S.vorDemSpeichern(p()));
      } catch (e) {
        fehler(i, a, `Prüfung vor dem Speichern: ${(e as Error).message.slice(0, 300)}`);
      }
      gespeichert = { text, vergeben: kopie(vergeben) };
    } else if (a === 'laden') {
      if (!gespeichert) continue;
      let geladen: Projekt | null = null;
      try {
        geladen = S.deserialisieren(gespeichert.text);
      } catch (e) {
        fehler(i, a, `Laden: ${(e as Error).message.slice(0, 300)}`);
      }
      S.zustand.laden(geladen);
      vergeben = kopie(gespeichert.vergeben);
      verlauf.length = 0;
    }

    // ---- Invarianten ----
    const h = haengendeVerweise(p());
    if (h.length) {
      st.haengend += h.length;
      fehler(i, a, `hängende Verweise ${h.length}: ${h.slice(0, 3).map((x) => `${x.pfad}=${x.wert}`).join(', ')}`);
    }
    for (const l of LISTEN) {
      const ids = eintraege(l).map((x) => String(x['id']));
      if (new Set(ids).size !== ids.length) {
        st.doppelt++;
        fehler(i, a, `${l}: doppelt vergebene ID (${ids.join(', ')})`);
      }
      if (a !== 'rueckgaengig' && a !== 'laden' && zaehlerVon(p(), l) < zaehlerVorher[l]!) {
        st.gesunken++;
        fehler(i, a, `${l}: Zähler gesunken (${zaehlerVorher[l]} auf ${zaehlerVon(p(), l)})`);
      }
    }
  }
  st.folgen++;
}

describe('Modellbasierter Test: Zufallsfolgen über 16 Listentypen und eigene Prozesse (AF-011)', () => {
  it('der Zufallsgenerator ist reproduzierbar und gleichmässig genug', () => {
    const a = zufall(42);
    const b = zufall(42);
    const werte = Array.from({ length: 1000 }, () => a());
    expect(Array.from({ length: 1000 }, () => b())).toEqual(werte);
    expect(werte.every((w) => w >= 0 && w < 1)).toBe(true);
    const mittel = werte.reduce((s, w) => s + w, 0) / werte.length;
    expect(mittel).toBeGreaterThan(0.45);
    expect(mittel).toBeLessThan(0.55);
    expect(zufall(43)()).not.toBe(zufall(42)());
  });

  it('die Folgen legen in allen 16 Listen und bei eigenen Prozessen an und setzen Verweise aus mindestens zehn Listen auf Ziele in mindestens acht', () => {
    expect(LISTEN).toHaveLength(17);
    expect(ZIELLISTEN).toContain('eigeneProzesse');
    expect(SETZBAR.length).toBeGreaterThan(25);
    expect(new Set(SETZBAR.map((s) => s.quelle)).size).toBeGreaterThanOrEqual(10);
    expect(ZIELLISTEN.length).toBeGreaterThanOrEqual(8);
  });

  it(`${FOLGEN} Folgen ab Seed ${START_SEED}: hängende Verweise 0, Doppelvergaben 0, Wiederverwendungen 0`, () => {
    const st: Statistik = {
      folgen: 0, schritte: 0, je: { anlegen: 0, verweis: 0, text: 0, loeschen: 0, rueckgaengig: 0, speichern: 0, laden: 0 },
      listenAngelegt: new Set(), loeschenMitVerweisen: 0, verweiseBeimLoeschen: 0, haengend: 0, doppelt: 0, wiederverwendet: 0, gesunken: 0,
    };
    for (let n = 0; n < FOLGEN; n++) folge(START_SEED + n, st);
    expect(st.folgen).toBe(FOLGEN);
    expect({ haengend: st.haengend, doppelt: st.doppelt, wiederverwendet: st.wiederverwendet, gesunken: st.gesunken }).toEqual({ haengend: 0, doppelt: 0, wiederverwendet: 0, gesunken: 0 });
    if (FOLGEN >= 1000) {
      // Die Folgen üben, was sie prüfen sollen: jede Art von Schritt oft, alle Listen, Löschen mit stehenden Verweisen
      for (const [a, n] of Object.entries(st.je)) expect(n, a).toBeGreaterThan(500);
      expect(st.listenAngelegt.size).toBe(17);
      expect(st.loeschenMitVerweisen).toBeGreaterThan(300);
    }
  });
});
