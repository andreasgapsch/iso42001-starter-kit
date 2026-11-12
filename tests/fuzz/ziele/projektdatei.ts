// Ziel «Projektdatei»: Laden, Reparatur, Teilimport und Rundreise Speichern/Laden (Node, ohne Browser)
import { ladeProjektText, projektReparieren, projektTextParsen } from '../../../src/app/import/laden.ts';
import { teilimportPruefen, vergleiche, alles, teilimportMoeglich } from '../../../src/app/import/teilimport.ts';
import type { Projekt } from '../../../src/model/typen.ts';
import { mutiereJson, mutiereText, tiefJson } from '../mutation.ts';
import { OrakelFehler, type Fall, type Urteil, type Ziel } from '../typen.ts';
import type { Zufall } from '../zufall.ts';
import { grundProjekt, projektLesbar, rundreise } from './hilfen.ts';

/** Zeichenfolge aus n Emoji (je 2 UTF-16-Einheiten) */
const emoji = (n: number): string => '\u{1F600}'.repeat(n);

/** Kurzfelder, die die Reparatur kürzen muss: Pflichtfelder der Organisation und der Personen (Grenze 500 UTF-16-Einheiten) */
function emojiFeld(p: Record<string, unknown>, z: Zufall): void {
  const n = z.wahl([250, 251, 252, 300, 500]);
  const text = z.mit(0.5) ? emoji(n) : `a${emoji(n)}`;
  const org = (p['organisation'] ?? {}) as Record<string, unknown>;
  const personen = Array.isArray(p['personen']) ? (p['personen'] as Record<string, unknown>[]) : [];
  if (personen.length > 0 && z.mit(0.4)) personen[personen.length - 1]![z.wahl(['name', 'funktion'])] = text;
  else org[z.wahl(['name', 'kurzname', 'branche'])] = text;
  p['organisation'] = org;
}

function einzelnesSurrogat(p: Record<string, unknown>, z: Zufall): void {
  const stellen: Record<string, unknown>[] = [p, (p['organisation'] ?? {}) as Record<string, unknown>];
  for (const l of ['personen', 'risiken', 'massnahmen', 'kiSysteme', 'dokumente']) {
    const liste = p[l];
    if (Array.isArray(liste)) for (const e of liste) if (e && typeof e === 'object') stellen.push(e as Record<string, unknown>);
  }
  const ziel = z.wahl(stellen);
  const lone = z.wahl(['\ud800', '\udfff', 'a\ud83d', '\ude00b']);
  const schluessel = Object.keys(ziel).filter((k) => typeof ziel[k] === 'string' && k !== 'id');
  if (z.mit(0.3) || schluessel.length === 0) ziel[`feld${lone}`] = 'x';
  else ziel[z.wahl(schluessel)] = lone;
  // Auch als Kennung (Sprungziel, E2-17)
  if (z.mit(0.3) && typeof ziel['id'] === 'string') ziel['id'] = `${ziel['id']}${lone}`;
}

/** Grenzfälle mit erwarteter Ablehnungsart: Ohne die jeweilige Prüfung würde die Datei angenommen oder aus anderem Grund abgelehnt */
function grenzfall(z: Zufall, art: 'gross' | 'tief'): Fall {
  const p = grundProjekt(z);
  const text = JSON.stringify(p);
  if (art === 'gross') {
    // Gültiges Projekt, durch Leerraum über die Grösse gehoben: Ohne Grössengrenze würde es angenommen
    return { name: 'ueber-grenze', endung: 'json', daten: text + ' '.repeat(25 * 1024 * 1024 + 1 - text.length + z.ganz(100)), erwartet: 'zu-gross' };
  }
  // Gültiges Projekt mit eingebettetem tiefen Wert: ab 200 Ebenen muss die Tiefenprüfung ablehnen («kein-projekt»). Als Text
  // zusammengesetzt: JSON.stringify selbst läuft bei 5000 Ebenen in den Stapelüberlauf.
  const n = z.wahl([100, 250, 5000, 250]);
  return { name: 'tief-eingebettet', endung: 'json', daten: `${text.slice(0, -1)},"zusatz":${'['.repeat(n)}1${']'.repeat(n)}}`, ...(n > 200 ? { erwartet: 'kein-projekt' } : {}) };
}

function erzeuge(z: Zufall, nummer: number): Fall {
  const art = z.ganz(100);
  // Jeder zehnte Fall bleibt gültig: Die Rundreise muss ohne Mutation bestehen
  if (nummer % 10 === 0) return { name: 'gueltig', endung: 'json', daten: JSON.stringify(grundProjekt(z)), zusatz: JSON.stringify(mutiereJson(z, grundProjekt(z), 1)) };
  // Gezielte Fallarten für die Fehler der Runde 2, damit sie in jedem Pflichtteil vorkommen
  if (nummer % 7 === 3) {
    const p = grundProjekt(z);
    emojiFeld(p, z);
    return { name: 'emoji-ueber-grenze', endung: 'json', daten: JSON.stringify(p) };
  }
  if (nummer % 11 === 5) {
    const p = grundProjekt(z);
    einzelnesSurrogat(p, z);
    return { name: 'einzelnes-surrogat', endung: 'json', daten: JSON.stringify(p) };
  }
  // Grenzfälle in jedem Pflichtteil: Grösse über der Grenze und Tiefe über der Grenze
  if (nummer % 17 === 9 || nummer % 19 === 4) return grenzfall(z, nummer % 17 === 9 ? 'gross' : 'tief');
  if (art < 50) {
    const p = mutiereJson(z, grundProjekt(z));
    return { name: 'json-mutation', endung: 'json', daten: JSON.stringify(p), zusatz: JSON.stringify(mutiereJson(z, grundProjekt(z))) };
  }
  if (art < 72) return { name: 'text-mutation', endung: 'json', daten: mutiereText(z, JSON.stringify(grundProjekt(z))) };
  if (art < 77) return { name: 'tief', endung: 'json', daten: tiefJson(z) };
  if (art < 90) return grenzfall(z, art < 85 ? 'tief' : 'gross');
  if (art < 95) return { name: 'leer-bom', endung: 'json', daten: z.wahl(['', ' ', '﻿', '﻿{}', 'null', '[]', '{}', '"text"', '{"meta":{}}', '{"schemaVersion":"99.0"}', '{"schemaVersion":1}']) };
  return { name: 'umgebung', endung: 'json', daten: z.wahl(['{"meta":null}', '{"schemaVersion":"1.0","meta":[]}', '{"__proto__":{"x":1},"meta":{}}']) };
}

function urteile(f: Fall): Urteil {
  const text = f.daten as string;
  const zaehler: Record<string, number> = {};
  let r;
  try {
    r = ladeProjektText(text);
  } catch (e) {
    throw new OrakelFehler(`ladeProjektText wirft statt Ergebnis zu liefern (${e instanceof Error ? `${e.name}: ${e.message}` : String(e)})`.slice(0, 300));
  }
  if (r.ok) {
    rundreise(r.projekt, 'angenommene Datei');
    if (f.zusatz) teilimport(r.projekt, f.zusatz, zaehler);
    return { urteil: 'angenommen', zaehler: { ...zaehler, angenommen: 1 } };
  }
  if (!r.art) throw new OrakelFehler('Ablehnung ohne Art');
  if (r.art === 'schema') {
    // Reparaturweg wie in Start.tsx: Probe rechnen; der Knopf erscheint nur, wenn sie gelingt
    zaehler['reparaturVersucht'] = 1;
    let roh: unknown;
    try {
      roh = projektTextParsen(text);
    } catch (e) {
      throw new OrakelFehler(`Schemafehler bei Text, der sich nicht parsen lässt (${String(e)})`);
    }
    let rep;
    try {
      rep = projektReparieren(roh);
    } catch (e) {
      throw new OrakelFehler(`projektReparieren wirft (${e instanceof Error ? `${e.name}: ${e.message}` : String(e)})`.slice(0, 300));
    }
    if (!rep) throw new OrakelFehler('Reparatur scheitert bei einer Datei mit Schemafehlern: Die Probe liefert nichts, die Datei bleibt unbrauchbar (Datenverlust, E2-15, reparaturKeine muss 0 sein)');
    else {
      projektLesbar(rep.projekt, 'reparierte Datei');
      if (rep.aenderungen.length === 0) throw new OrakelFehler('Reparatur ohne genannte Änderung bei ungültiger Datei');
      rundreise(rep.projekt, 'reparierte Datei');
      zaehler['reparaturGueltig'] = 1;
    }
  }
  return { urteil: 'abgelehnt', meldung: `${r.art}${r.details.length ? `: ${r.details[0]}` : ''}`.slice(0, 200), zaehler: { ...zaehler, abgelehnt: 1 } };
}

/** Teilimport: Auswahl aller Listen aus einer zweiten, mutierten Datei; Ergebnis gültig oder abgelehnt mit Angaben */
function teilimport(aktuell: Projekt, zusatz: string, zaehler: Record<string, number>): void {
  let daten: unknown;
  try {
    daten = projektTextParsen(zusatz);
  } catch {
    return;
  }
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) return;
  const d = daten as Record<string, unknown>;
  let moeglich: boolean;
  try {
    moeglich = teilimportMoeglich(aktuell, d);
  } catch (e) {
    throw new OrakelFehler(`teilimportMoeglich wirft (${e instanceof Error ? `${e.name}: ${e.message}` : String(e)})`.slice(0, 300));
  }
  if (!moeglich) return;
  zaehler['teilimportVersucht'] = 1;
  try {
    const v = vergleiche(aktuell, d);
    const e = teilimportPruefen(aktuell, d, alles(v));
    if (e.ok) {
      projektLesbar(e.projekt, 'Teilimport');
      zaehler['teilimportGueltig'] = 1;
    } else if (e.details.length === 0 && e.schema.length === 0) throw new OrakelFehler('Teilimport abgelehnt ohne Angabe');
  } catch (e) {
    if (e instanceof OrakelFehler) throw e;
    throw new OrakelFehler(`Teilimport wirft (${e instanceof Error ? `${e.name}: ${e.message}` : String(e)})`.slice(0, 300));
  }
}

export const projektdatei: Ziel = { art: 'projektdatei', erzeuge, urteile };
