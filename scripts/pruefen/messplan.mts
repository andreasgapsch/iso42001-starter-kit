// Tor G44 Messplan (AF-098, QK-54): Jede Kennzahl des Prozesskatalogs ist messbar, und Stichproben passen zu den Zählern.
//   1. Quelle: Jeder Prozess mit Kennzahl nennt in src/prozesse/katalog.yaml eine «datenquelle» (Vorlage und Spalte oder
//      Aufzeichnung ausserhalb der Vorlagen). Ausnahmen nur in OFFEN mit dem Paket, das sie schliesst; ein Eintrag, der
//      nicht mehr nötig ist, ist ein Fehler.
//   2. Vorlage und Spalte: Die Vorlage steht im Dokumentenregister (src/kataloge/dokumente.yaml), der Spaltenschlüssel
//      ergibt in DE und EN einen Spaltenkopf (i18n vorlagen.<vorlage>.<spalte>), und die Methode
//      (i18n prozesse.prozesse.<id>.kennzahl_methode, Fakten eingesetzt) nennt in beiden Sprachen die Vorlage und den Kopf
//      in Anführungszeichen («…» bzw. ‘…’, ohne den Zusatz in Klammern).
//   3. Schema: Ein angegebenes «feld» ist ein Pfad im Datenmodell (src/generiert/projekt.schema.json).
//   4. Stichproben in den Beispielen (src/beispiele/*.aims.json): Nennt die Methode eines Ziels oder einer eigenen Kennzahl
//      einen Stichprobenumfang («Stichprobe von 10 X und 10 Y», «ab 2027 zusätzlich 10 Z»), ist der Nenner jedes Messwerts
//      «z von n» gleich dem Umfang am Messdatum und z höchstens n. PR-12 zählt im Zähler höchstens so viele Systeme, wie
//      die Stichproben der Ziele am Messdatum tatsächlich umfassen (je Ziel höchstens die Zahl der aktiven Teilstichproben).
//      Bekannte Abweichungen der Beispiele stehen in OFFEN_STICHPROBE mit dem Paket, das sie behebt (Warnung).
// Die Erkennung des Umfangs ist eine Textregel (Zahl vor einem Wort, «ab <Jahr>» bzw. «from <Jahr>» schaltet die
// folgenden Teilstichproben erst ab diesem Jahr zu; «je System» bzw. «per system» wird nicht ausgewertet).
// Aufruf: npx tsx scripts/pruefen/messplan.mts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { type Befund, type Optionen, REPO, alsHauptprogramm } from './gemeinsam.mts';

const TOR = 'G44';
const KATALOG = 'src/prozesse/katalog.yaml';
const SPRACHEN = ['de', 'en'] as const;
type Sprache = (typeof SPRACHEN)[number];

/** Kennzahlen ohne Datenquelle, die ein anderes Paket nachführt (Prozess-ID: Paket). Leer seit P14 (PR-07, PR-19, AF-104). */
export const OFFEN: Record<string, string> = {};
/** Bekannte Stichprobenabweichungen der Beispiele: Datei, Kennzahl, Paket */
// Leer seit P15a (AF-084, A3-03): PR-12 im Beispiel Präzisionsteile meldet 2 von 3 wie die Stichprobe von Z-002
export const OFFEN_STICHPROBE: { datei: RegExp; kennzahl: string; paket: string }[] = [];

interface Quelle { vorlage?: string; spalte?: string | number; feld?: string; aufzeichnung?: boolean }
export interface MessProzess { id: string; kennzahl_vorschlag?: unknown; datenquelle?: Quelle[] }
interface Messwert { datum: string; wert: string; zaehler?: number; nenner?: number }
export interface MessProjekt {
  ziele: { id: string; messmethode?: string; kiSysteme?: string[]; messungen: Messwert[] }[];
  kennzahlen?: { id: string; messmethode?: string }[];
  kennzahlMessungen?: (Messwert & { kennzahl: string })[];
}
export interface MessEingabe {
  katalog: { prozesse: MessProzess[] };
  dokumente: Set<string>;
  /** Texte je Sprache mit eingesetzten Fakten */
  texte: Record<Sprache, unknown>;
  schema: { $ref?: string; definitions: Record<string, unknown> };
  beispiele: { datei: string; projekt: MessProjekt }[];
}

const ANF: Record<Sprache, [string, string]> = { de: ['«', '»'], en: ['‘', '’'] };

/** Wert unter einem Punktpfad (Listenindex als Zahl) */
export function wertUnter(baum: unknown, pfad: string): unknown {
  let o: unknown = baum;
  for (const t of pfad.split('.')) {
    if (o === null || typeof o !== 'object') return undefined;
    o = Array.isArray(o) ? o[Number(t)] : (o as Record<string, unknown>)[t];
  }
  return o;
}

/** Gibt es den Pfad im Schema? Arrays werden über items, Verweise über definitions aufgelöst. */
export function feldImSchema(schema: MessEingabe['schema'], pfad: string): boolean {
  const def = (x: unknown): Record<string, unknown> | undefined => {
    let o = x as Record<string, unknown> | undefined;
    for (let i = 0; i < 20 && o; i++) {
      if (typeof o['$ref'] === 'string') o = schema.definitions[(o['$ref'] as string).replace('#/definitions/', '')] as Record<string, unknown>;
      else if (o['type'] === 'array' && o['items']) o = o['items'] as Record<string, unknown>;
      else break;
    }
    return o;
  };
  const kandidaten = (x: unknown): Record<string, unknown>[] => {
    const o = def(x);
    if (!o) return [];
    const alt = (o['anyOf'] ?? o['oneOf']) as unknown[] | undefined;
    return alt ? alt.flatMap(kandidaten) : [o];
  };
  let stufe = kandidaten({ $ref: schema.$ref ?? '#/definitions/Projekt' });
  for (const teil of pfad.split('.')) {
    stufe = stufe.flatMap((o) => {
      const p = (o['properties'] as Record<string, unknown> | undefined)?.[teil];
      return p ? kandidaten(p) : [];
    });
    if (!stufe.length) return false;
  }
  return true;
}

/** Spaltenkopf ohne Zusatz in Klammern: «Daten (A.4.3)» → «Daten» */
const kernKopf = (k: string) => k.replace(/\s*\([^)]*\)\s*$/, '').trim();

/** Teilstichproben einer Methode mit dem Jahr, ab dem sie gelten (0 = immer), und dem Abschnitt (durch «;» getrennt) */
export function teilstichproben(methode: string): { n: number; ab: number; abschnitt: number }[] {
  if (!/stichprobe|sample/i.test(methode) || /je System|per system/i.test(methode)) return [];
  const aus: { n: number; ab: number; abschnitt: number }[] = [];
  let ab = 0;
  methode.split(';').forEach((teil, abschnitt) => {
    // Zahl vor einem Wort, nicht Teil einer Kennung (KI-001, A.4.3) und keine Jahreszahl
    const re = /\b(ab|from)\s+(\d{4})\b|(?<![\w.-])(\d+)\s+(?!%|Prozent|per\b|pro\b|je\b|von\b|of\b)(\p{L})/giu;
    for (const m of teil.matchAll(re)) {
      if (m[2]) ab = Number(m[2]);
      else if (m[3]) {
        const n = Number(m[3]);
        if (n >= 1900 && n <= 2100) continue;
        aus.push({ n, ab, abschnitt });
      }
    }
  });
  return aus;
}
type Teil = ReturnType<typeof teilstichproben>[number];
const aktiv = (teile: Teil[], datum: string) => teile.filter((t) => t.ab <= Number(datum.slice(0, 4)));
/** Zulässige Nenner am Datum: Summe je Abschnitt der Methode und Gesamtsumme */
const umfaenge = (teile: Teil[], datum: string): Set<number> => {
  const a = aktiv(teile, datum);
  const je = new Map<number, number>();
  for (const t of a) je.set(t.abschnitt, (je.get(t.abschnitt) ?? 0) + t.n);
  return new Set([...je.values(), a.reduce((x, t) => x + t.n, 0)].filter((n) => n > 0));
};
/** «19 von 20», «19 of 20» oder Felder zaehler/nenner */
export function bruch(m: Messwert): { z: number; n: number } | undefined {
  if (typeof m.zaehler === 'number' && typeof m.nenner === 'number') return { z: m.zaehler, n: m.nenner };
  const t = /(\d+)\s*(?:von|of)\s*(\d+)/.exec(m.wert ?? '');
  return t ? { z: Number(t[1]), n: Number(t[2]) } : undefined;
}
const minusMonate = (iso: string, n: number) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
};

/** Abweichungen zwischen Stichprobenumfang und Messwerten eines Projekts */
export function stichprobenAbweichungen(p: MessProjekt): { kennzahl: string; meldung: string }[] {
  const aus: { kennzahl: string; meldung: string }[] = [];
  const pruefe = (id: string, methode: string | undefined, messungen: Messwert[]) => {
    const teile = teilstichproben(methode ?? '');
    if (!teile.length) return;
    for (const m of messungen) {
      const b = bruch(m);
      if (!b) continue;
      const erlaubt = umfaenge(teile, m.datum);
      if (b.z > b.n) aus.push({ kennzahl: id, meldung: `${id} am ${m.datum}: Zähler ${b.z} über Nenner ${b.n}` });
      if (erlaubt.size && !erlaubt.has(b.n)) aus.push({ kennzahl: id, meldung: `${id} am ${m.datum}: Nenner ${b.n}, Stichprobe laut Methode ${[...erlaubt].join(' oder ')}` });
    }
  };
  for (const z of p.ziele ?? []) pruefe(z.id, z.messmethode, z.messungen ?? []);
  for (const k of p.kennzahlen ?? []) pruefe(k.id, k.messmethode, (p.kennzahlMessungen ?? []).filter((m) => m.kennzahl === k.id));
  // PR-12: Systeme mit Stichprobe im Rhythmus höchstens so viele, wie die Stichproben der Ziele am Messdatum umfassen
  for (const m of (p.kennzahlMessungen ?? []).filter((x) => x.kennzahl === 'PR-12')) {
    const b = bruch(m);
    if (!b) continue;
    const von = minusMonate(m.datum, 3);
    const ziele = (p.ziele ?? []).filter((z) => z.kiSysteme?.length && z.messungen?.some((x) => x.datum <= m.datum && x.datum >= von));
    const alle = new Set(ziele.flatMap((z) => z.kiSysteme!));
    const summe = ziele.reduce((a, z) => {
      const letzte = z.messungen.filter((x) => x.datum <= m.datum && x.datum >= von).map((x) => x.datum).sort().at(-1)!;
      const teile = teilstichproben(z.messmethode ?? '');
      return a + (teile.length ? Math.min(z.kiSysteme!.length, aktiv(teile, letzte).length) : z.kiSysteme!.length);
    }, 0);
    const abgedeckt = Math.min(alle.size, summe);
    if (b.z > abgedeckt) aus.push({ kennzahl: 'PR-12', meldung: `PR-12 am ${m.datum}: Zähler ${b.z}, die Stichproben der Ziele umfassen ${abgedeckt} Systeme` });
  }
  return aus;
}

export function pruefeMessplan(e: MessEingabe): Befund[] {
  const befunde: Befund[] = [];
  const fehler = (meldung: string, datei = KATALOG) => befunde.push({ tor: TOR, datei, meldung, schwere: 'fehler' });
  const warnung = (meldung: string, datei = KATALOG) => befunde.push({ tor: TOR, datei, meldung, schwere: 'warnung' });
  for (const p of e.katalog.prozesse) {
    if (!p.kennzahl_vorschlag) continue;
    const quellen = p.datenquelle ?? [];
    if (!quellen.length) {
      if (OFFEN[p.id]) warnung(`${p.id}: Kennzahl ohne Datenquelle (offen: ${OFFEN[p.id]})`);
      else fehler(`${p.id}: Kennzahl ohne Datenquelle`);
      continue;
    }
    if (OFFEN[p.id]) fehler(`${p.id}: hat jetzt eine Datenquelle, Eintrag in OFFEN streichen`, 'scripts/pruefen/messplan.mts');
    for (const s of SPRACHEN) {
      const methode = wertUnter(e.texte[s], `prozesse.prozesse.${p.id}.kennzahl_methode`);
      if (typeof methode !== 'string' || !methode.trim()) {
        fehler(`${p.id}: keine Messmethode (${s})`, `src/i18n/${s}/prozesse.yaml`);
        continue;
      }
      for (const q of quellen) {
        if (q.aufzeichnung) continue;
        if (!q.vorlage || q.spalte === undefined) {
          if (s === 'de') fehler(`${p.id}: Datenquelle ohne Vorlage und Spalte und ohne «aufzeichnung»`);
          continue;
        }
        if (!e.dokumente.has(q.vorlage)) {
          if (s === 'de') fehler(`${p.id}: Vorlage ${q.vorlage} steht nicht im Dokumentenregister`);
          continue;
        }
        const kopf = wertUnter(e.texte[s], `vorlagen.${q.vorlage}.${q.spalte}`);
        if (typeof kopf !== 'string' || !kopf.trim()) {
          fehler(`${p.id}: Spalte ${q.vorlage} ${q.spalte} gibt es nicht (${s})`, `src/i18n/${s}/vorlagen/${q.vorlage}.yaml`);
          continue;
        }
        if (!methode.includes(q.vorlage)) fehler(`${p.id}: Methode nennt die Vorlage ${q.vorlage} nicht (${s})`, `src/i18n/${s}/prozesse.yaml`);
        const [a, z] = ANF[s];
        const k = kernKopf(kopf);
        if (!methode.includes(`${a}${k}${z}`)) fehler(`${p.id}: Methode nennt die Spalte ${a}${k}${z} aus ${q.vorlage} nicht (${s})`, `src/i18n/${s}/prozesse.yaml`);
      }
    }
    for (const q of quellen) if (q.feld && !feldImSchema(e.schema, q.feld)) fehler(`${p.id}: Feld ${q.feld} gibt es im Datenmodell nicht`);
  }
  for (const b of e.beispiele) {
    const datei = `src/beispiele/${b.datei}`;
    const abw = stichprobenAbweichungen(b.projekt);
    for (const x of abw) {
      const offen = OFFEN_STICHPROBE.find((o) => o.datei.test(b.datei) && o.kennzahl === x.kennzahl);
      if (offen) warnung(`${x.meldung} (offen: ${offen.paket})`, datei);
      else fehler(x.meldung, datei);
    }
    for (const o of OFFEN_STICHPROBE.filter((o) => o.datei.test(b.datei)))
      if (!abw.some((x) => x.kennzahl === o.kennzahl)) fehler(`${o.kennzahl}: Stichprobe stimmt, Eintrag in OFFEN_STICHPROBE für ${b.datei} streichen`, 'scripts/pruefen/messplan.mts');
  }
  return befunde;
}

export function eingabeAusRepo(): MessEingabe {
  const lies = (pfad: string) => readFileSync(join(REPO, pfad), 'utf8');
  const dokumente = new Set((parse(lies('src/kataloge/dokumente.yaml')) as { dokumente: { id: string }[] }).dokumente.map((d) => d.id));
  const beispiele = readdirSync(join(REPO, 'src/beispiele'))
    .filter((n) => n.endsWith('.aims.json'))
    .sort()
    .map((datei) => ({ datei, projekt: JSON.parse(lies(`src/beispiele/${datei}`)) as MessProjekt }));
  return {
    katalog: parse(lies(KATALOG)) as MessEingabe['katalog'],
    dokumente,
    texte: { de: ladeTexte('de'), en: ladeTexte('en') },
    schema: JSON.parse(lies('src/generiert/projekt.schema.json')) as MessEingabe['schema'],
    beispiele,
  };
}

export async function pruefe(_o: Optionen = {}): Promise<Befund[]> {
  return pruefeMessplan(eingabeAusRepo());
}

await alsHauptprogramm(import.meta.url, pruefe);
