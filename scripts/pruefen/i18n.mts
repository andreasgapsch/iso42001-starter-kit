// Tor G4 i18n: jeder Schlüssel in DE und EN vorhanden, keine leeren Werte, gleiche Platzhalter.
// Zusätzlich: Vergleich zweier erzeugter Kit-Ordner (DE/EN) auf gleiche Dateizahl.
import { readFileSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { type Befund, type Optionen, REPO, alsHauptprogramm, dateienUnter, hatEndung, istOrdner, relativ } from './gemeinsam.mts';

const TOR = 'G4';
const ENDUNGEN = ['.yaml', '.yml', '.json'];

export interface Eintrag {
  wert: unknown;
  datei: string;
}

/** Flacht verschachtelte Objekte zu Punktschlüsseln ab; Listen erhalten den Index als Teil. */
export function flach(objekt: unknown, praefix: string, datei: string, ziel: Map<string, Eintrag> = new Map()): Map<string, Eintrag> {
  if (objekt !== null && typeof objekt === 'object') {
    const eintraege = Array.isArray(objekt) ? objekt.map((v, i) => [String(i), v] as const) : Object.entries(objekt);
    if (eintraege.length === 0) ziel.set(praefix, { wert: objekt, datei });
    for (const [k, v] of eintraege) flach(v, praefix ? `${praefix}.${k}` : k, datei, ziel);
  } else {
    ziel.set(praefix, { wert: objekt, datei });
  }
  return ziel;
}

/** Liest alle YAML/JSON-Dateien eines Sprachordners; der Dateipfad (ohne Endung) wird zum Präfix. */
export function leseSprachordner(ordner: string, repo: string = REPO): { schluessel: Map<string, Eintrag>; befunde: Befund[] } {
  const schluessel = new Map<string, Eintrag>();
  const befunde: Befund[] = [];
  for (const pfad of dateienUnter(ordner, (p) => hatEndung(p, ENDUNGEN))) {
    const rel = relativ(pfad, repo);
    const praefix = relative(ordner, pfad).split(/[\\/]/).join('.').replace(/\.(ya?ml|json)$/i, '');
    try {
      const text = readFileSync(pfad, 'utf8');
      const daten: unknown = extname(pfad).toLowerCase() === '.json' ? JSON.parse(text) : parseYaml(text);
      flach(daten ?? {}, praefix, rel, schluessel);
    } catch (e) {
      befunde.push({ tor: TOR, datei: rel, meldung: `nicht lesbar: ${(e as Error).message.split('\n')[0]}`, schwere: 'fehler' });
    }
  }
  return { schluessel, befunde };
}

/** Platzhalter der Form {name} (ICU-Plural wie {anzahl, plural, …} zählt mit dem Namen). */
export function platzhalter(wert: unknown): string[] {
  if (typeof wert !== 'string') return [];
  return [...new Set([...wert.matchAll(/\{\s*([A-Za-z_][\w.]*)\s*[},]/g)].map((m) => m[1]!))].sort();
}

function istLeer(wert: unknown): boolean {
  if (wert === null || wert === undefined) return true;
  if (typeof wert === 'string') return wert.trim() === '';
  if (typeof wert === 'object') return Object.keys(wert).length === 0;
  return false;
}

/** Vergleicht die Sprachordner DE und EN. */
export function pruefeI18n(deOrdner: string, enOrdner: string, repo: string = REPO): Befund[] {
  const de = leseSprachordner(deOrdner, repo);
  const en = leseSprachordner(enOrdner, repo);
  const befunde = [...de.befunde, ...en.befunde];
  const melde = (datei: string, meldung: string): void => {
    befunde.push({ tor: TOR, datei, meldung, schwere: 'fehler' });
  };
  const paare: [string, typeof de, typeof en, string][] = [
    ['de', de, en, 'en'],
    ['en', en, de, 'de'],
  ];
  for (const [sprache, eigen, ander, andereSprache] of paare) {
    for (const [k, e] of eigen.schluessel) {
      if (!ander.schluessel.has(k)) melde(e.datei, `Schlüssel «${k}» fehlt in ${andereSprache.toUpperCase()}`);
      if (istLeer(e.wert) && !/\.\d+\.\d+$/.test(k)) melde(e.datei, `Schlüssel «${k}» hat einen leeren Wert (${sprache.toUpperCase()})`);
    }
  }
  for (const [k, e] of de.schluessel) {
    const g = en.schluessel.get(k);
    if (!g) continue;
    const a = platzhalter(e.wert).join(', ');
    const b = platzhalter(g.wert).join(', ');
    if (a !== b) melde(e.datei, `Schlüssel «${k}»: Platzhalter unterschiedlich (DE: ${a || 'keine'}; EN: ${b || 'keine'})`);
  }
  return befunde;
}

/** Kennung am Dateianfang, z. B. D-01, E-03, A-12. */
function kennung(name: string): string | undefined {
  return /^([A-Z]{1,3}-\d{2,3})(?=[_\-. ])/.exec(name)?.[1];
}

/**
 * Vergleicht zwei erzeugte Kit-Ordner (DE und EN): gleiche Anzahl Dateien insgesamt und je Endung,
 * gleiche Menge der Dokumentkennungen am Dateianfang. Für den Build (G4, DE/EN-Ordner gleich).
 */
export function vergleicheOrdner(a: string, b: string, repo: string = REPO): Befund[] {
  const befunde: Befund[] = [];
  const da = dateienUnter(a);
  const db = dateienUnter(b);
  const ra = relativ(a, repo);
  const rb = relativ(b, repo);
  if (da.length !== db.length) {
    befunde.push({ tor: TOR, datei: ra, meldung: `ungleiche Dateizahl: ${ra} hat ${da.length}, ${rb} hat ${db.length}`, schwere: 'fehler' });
  }
  const proEndung = (liste: string[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const p of liste) m.set(extname(p).toLowerCase(), (m.get(extname(p).toLowerCase()) ?? 0) + 1);
    return m;
  };
  const ea = proEndung(da);
  const eb = proEndung(db);
  for (const e of new Set([...ea.keys(), ...eb.keys()])) {
    if ((ea.get(e) ?? 0) !== (eb.get(e) ?? 0)) {
      befunde.push({ tor: TOR, datei: ra, meldung: `ungleiche Anzahl «${e || '(ohne Endung)'}»: ${ea.get(e) ?? 0} gegenüber ${eb.get(e) ?? 0}`, schwere: 'fehler' });
    }
  }
  const ka = new Set(da.map((p) => kennung(basename(p))).filter(Boolean));
  const kb = new Set(db.map((p) => kennung(basename(p))).filter(Boolean));
  for (const k of ka) if (!kb.has(k)) befunde.push({ tor: TOR, datei: rb, meldung: `Dokument ${k} fehlt`, schwere: 'fehler' });
  for (const k of kb) if (!ka.has(k)) befunde.push({ tor: TOR, datei: ra, meldung: `Dokument ${k} fehlt`, schwere: 'fehler' });
  return befunde;
}

/** Mögliche Lagen der erzeugten Kit-Sprachordner. */
const KIT_PAARE: [string, string][] = [
  ['dist/kit/DE', 'dist/kit/EN'],
  ['dist/kit/de', 'dist/kit/en'],
];

export async function pruefe(_o: Optionen = {}): Promise<Befund[]> {
  const deOrdner = join(REPO, 'src', 'i18n', 'de');
  const enOrdner = join(REPO, 'src', 'i18n', 'en');
  const befunde = pruefeI18n(deOrdner, enOrdner);
  if (dateienUnter(deOrdner).length + dateienUnter(enOrdner).length === 0) {
    befunde.push({ tor: TOR, datei: 'src/i18n', meldung: 'noch keine Sprachdateien vorhanden', schwere: 'warnung' });
  }
  for (const [a, b] of KIT_PAARE) {
    if (istOrdner(join(REPO, a)) && istOrdner(join(REPO, b))) befunde.push(...vergleicheOrdner(join(REPO, a), join(REPO, b)));
  }
  return befunde;
}

await alsHauptprogramm(import.meta.url, pruefe);
