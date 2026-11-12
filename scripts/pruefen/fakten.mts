// Tor G40 Faktenquelle (AF-072, QK-43): Schwellen, Fristen, Register und Freigabestellen, die Vorlagen und Prozesskatalog
// teilen, stehen nur in src/kataloge/fakten.yaml. Geprüft werden die Rohtexte (src/i18n/<sprache>, ohne eingesetzte Fakten)
// und der Prozesskatalog src/prozesse/katalog.yaml:
//   1. Jeder Fakt hat einen Wert in DE und EN (Text oder Zahl mit bekannter Einheit) und eine Art.
//   2. Jede Stelle eines Fakts gibt es in DE und EN, und sie liest den Fakt über den Platzhalter {{fakt:<id>}}.
//   3. Jeder Platzhalter nennt einen bekannten Fakt und steht an einer seiner Stellen (die Faktenliste ist vollständig).
//   4. Im Bereich eines Fakts steht sein Wert nicht von Hand (ausserhalb von Platzhaltern), ausser in den Ausnahmen mit Grund.
//   5. Freigabestellen: Jeder Katalogschritt mit dem «entscheid» des Fakts (oder, wenn angegeben, jeder Schritt aus
//      «schritte») liegt in der Bahn seiner Rolle und hat sie als A; es gibt mindestens einen solchen Schritt.
// Aufruf: npx tsx scripts/pruefen/fakten.mts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { FAKT_PLATZHALTER, faktIds, faktWert, type FaktenDatei, type FaktSprache } from '../../src/kataloge/fakten.ts';
import { ladeFakten } from '../../src/kataloge/fakten-node.ts';
import { type Befund, type Optionen, REPO, alsHauptprogramm } from './gemeinsam.mts';

const TOR = 'G40';
const DATEI = 'src/kataloge/fakten.yaml';
const SPRACHEN: FaktSprache[] = ['de', 'en'];
const ARTEN = ['frist', 'schwelle', 'register', 'freigabe'];

interface KatalogSchritt { id: string; bahn: string; raci?: Record<string, string>; entscheid?: string }
export interface Eingabe {
  fakten: FaktenDatei;
  /** Rohtexte je Sprache (ohne eingesetzte Fakten) */
  texte: Record<FaktSprache, unknown>;
  katalog: { prozesse: { id: string; schritte: KatalogSchritt[] }[] };
}

/** Alle Zeichenketten eines Textbaums mit Schlüsselpfad (Punkte, Listenindex als Zahl) */
export function flach(w: unknown, pfad = '', aus: [string, string][] = []): [string, string][] {
  if (typeof w === 'string') aus.push([pfad, w]);
  else if (Array.isArray(w)) w.forEach((x, i) => flach(x, `${pfad}.${i}`, aus));
  else if (w && typeof w === 'object') for (const [k, v] of Object.entries(w)) flach(v, pfad ? `${pfad}.${k}` : k, aus);
  return aus;
}

const unter = (schluessel: string, praefix: string) => schluessel === praefix || schluessel.startsWith(`${praefix}.`);
const maskiere = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Muster für den Wert eines Fakts in einer Sprache (Zahl mit beiden Formen der Einheit, sonst der Text; {hoch} beliebig) */
export function wertMuster(f: FaktenDatei, id: string, s: FaktSprache): RegExp {
  const fakt = f.fakten[id]!;
  if (fakt.text) return new RegExp(`(?<![\\w-])${maskiere(fakt.text[s]).replace(maskiere('{hoch}'), '.{1,40}?')}(?![\\w-])`, 'i');
  const formen = f.einheiten[fakt.einheit!]![s].map(maskiere).sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![\\w.,])${fakt.wert}\\s+(?:${formen.join('|')})(?![\\w-])`);
}

export function pruefeFakten(e: Eingabe): Befund[] {
  const befunde: Befund[] = [];
  const fehler = (meldung: string, datei = DATEI) => befunde.push({ tor: TOR, datei, meldung, schwere: 'fehler' });
  const flachJe = Object.fromEntries(SPRACHEN.map((s) => [s, flach(e.texte[s])])) as Record<FaktSprache, [string, string][]>;
  const ids = Object.keys(e.fakten.fakten ?? {});

  for (const id of ids) {
    const f = e.fakten.fakten[id]!;
    if (!ARTEN.includes(f.art)) fehler(`Fakt ${id}: unbekannte Art «${f.art}»`);
    for (const s of SPRACHEN) {
      try {
        if (!faktWert(e.fakten, id, s).trim()) fehler(`Fakt ${id}: leerer Wert (${s})`);
      } catch (x) {
        fehler(`Fakt ${id}: ${(x as Error).message} (${s})`);
      }
    }
    if (!f.stellen?.length) fehler(`Fakt ${id}: keine Stellen`);
    // 2. Stellen lesen den Fakt über den Platzhalter
    for (const stelle of f.stellen ?? []) {
      for (const s of SPRACHEN) {
        const treffer = flachJe[s].filter(([k]) => unter(k, stelle));
        if (!treffer.length) fehler(`Fakt ${id}: Stelle ${stelle} fehlt (${s})`, `src/i18n/${s}`);
        else if (!treffer.some(([, t]) => faktIds(t).includes(id))) fehler(`Fakt ${id}: Stelle ${stelle} liest den Fakt nicht über {{fakt:${id}}} (${s})`, `src/i18n/${s}`);
      }
    }
  }

  // 3. Jeder Platzhalter: bekannter Fakt, an einer seiner Stellen
  for (const s of SPRACHEN) {
    for (const [k, t] of flachJe[s]) {
      for (const id of faktIds(t)) {
        const f = e.fakten.fakten[id];
        if (!f) fehler(`${k}: unbekannter Fakt {{fakt:${id}}} (${s})`, `src/i18n/${s}`);
        else if (!(f.stellen ?? []).some((st) => unter(k, st))) fehler(`${k}: Platzhalter {{fakt:${id}}} steht an keiner Stelle des Fakts; Stelle in ${DATEI} nachtragen (${s})`, `src/i18n/${s}`);
      }
    }
  }

  // 4. Werte von Hand im Bereich eines Fakts
  for (const id of ids) {
    const f = e.fakten.fakten[id]!;
    for (const s of SPRACHEN) {
      let re: RegExp;
      try {
        re = wertMuster(e.fakten, id, s);
      } catch {
        continue; // ungültiger Wert ist schon unter 1. gemeldet
      }
      for (const [k, t] of flachJe[s]) {
        if (!(f.bereich ?? []).some((b) => unter(k, b))) continue;
        if (Object.keys(f.ausnahmen ?? {}).some((a) => unter(k, a))) continue;
        const ohne = t.replace(FAKT_PLATZHALTER, ' ');
        const m = ohne.match(re);
        if (m) fehler(`${k}: Wert «${m[0]}» des Fakts ${id} von Hand; {{fakt:${id}}} verwenden oder Ausnahme mit Grund (${s})`, `src/i18n/${s}`);
      }
    }
  }

  // 5. Freigabestellen im Prozesskatalog
  for (const id of ids) {
    const f = e.fakten.fakten[id]!;
    if (f.art !== 'freigabe') continue;
    if (!f.rolle || (!f.entscheid && !f.schritte?.length)) {
      fehler(`Fakt ${id}: Freigabestelle ohne rolle oder ohne entscheid und schritte`);
      continue;
    }
    // Mit «schritte» genau diese Schritte (Freigaben ohne Entscheidungsrecht nach D-04 oder eine Stufe eines Entscheids),
    // sonst alle Schritte mit dem «entscheid» des Fakts
    const alle = e.katalog.prozesse.flatMap((p) => p.schritte);
    const schritte = f.schritte?.length ? alle.filter((x) => f.schritte!.includes(x.id)) : alle.filter((x) => x.entscheid === f.entscheid);
    for (const sid of f.schritte ?? []) if (!alle.some((x) => x.id === sid)) fehler(`Fakt ${id}: Katalogschritt ${sid} fehlt`, 'src/prozesse/katalog.yaml');
    if (!schritte.length) fehler(`Fakt ${id}: kein Katalogschritt mit entscheid «${f.entscheid}»`, 'src/prozesse/katalog.yaml');
    const was = f.entscheid ?? id;
    for (const x of schritte) {
      if (x.bahn !== f.rolle || x.raci?.[f.rolle] !== 'A') fehler(`${x.id}: Freigabe «${was}» liegt bei ${x.bahn} (A: ${Object.entries(x.raci ?? {}).find(([, w]) => w === 'A')?.[0] ?? 'keine'}), laut Fakt ${id} bei ${f.rolle}`, 'src/prozesse/katalog.yaml');
    }
  }
  return befunde;
}

export function eingabeAusRepo(): Eingabe {
  return {
    fakten: ladeFakten(),
    texte: { de: ladeTexte('de', undefined, null), en: ladeTexte('en', undefined, null) },
    katalog: parse(readFileSync(join(REPO, 'src/prozesse/katalog.yaml'), 'utf8')) as Eingabe['katalog'],
  };
}

export async function pruefe(_o: Optionen = {}): Promise<Befund[]> {
  return pruefeFakten(eingabeAusRepo());
}

await alsHauptprogramm(import.meta.url, pruefe);
