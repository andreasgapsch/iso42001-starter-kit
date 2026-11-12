// Tor G41 Lesestellen (AF-018, AF-020, QK-09): Inhalte fremder Dateien liest nur das Eingangsmodul (src/eingang/), JSON parst
// nur das Eingangsmodul, und Grenzwerte stehen nicht von Hand in den Texten.
//
// Regeln für src (ts, tsx, ohne src/eingang/ und src/generiert/):
//   1. Kein Leseweg auf Dateiinhalt: `.arrayBuffer(`, `.text()` (auch mit Leerraum), `.bytes(`, `.stream()`, `new Response(`
//      (Blob als Antwort gelesen) und `FileReader`. Dateiinhalt kommt nur über liesBegrenzt, liesTextBegrenzt,
//      liesJsonBegrenzt oder liesStueckweise (Grösse vor dem Lesen).
//   2. Kein `JSON.parse(` in ganz src (ausser src/eingang/): Dateitext läuft über jsonLesen (Grenzen der Art), Text der App
//      selbst über jsonAusVertrauen mit benannter Quelle (kopie, app-daten, tab-nachricht, zwischenstand). Keine Liste von
//      Leseorten, keine Ausnahmeliste. `--liste` zeigt die Aufrufe von jsonAusVertrauen für die Durchsicht.
// Regel für src/i18n (yaml): Keine Grösse mit Einheit (MB, KB, GB) von Hand; Grenzen kommen als Platzhalter {grenze_<art>} aus
//   src/eingang/grenzen.ts (AF-020). Die Diagrammansicht setzt ihre Werte aus den Konstanten der Seite ein.
// Aufruf: npx tsx scripts/pruefen/lesestellen.mts [--liste]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Befund, type Optionen, REPO, alsHauptprogramm, dateienUnter, relativ } from './gemeinsam.mts';

const TOR = 'G41';

export interface Quelle {
  pfad: string;
  text: string;
}

const LESEN = /\.arrayBuffer\s*\(|\.text\s*\(\s*\)|\.bytes\s*\(|\.stream\s*\(\s*\)|\bnew\s+Response\s*\(|\bFileReader\b/;
const PARSE = /\bJSON\s*\.\s*parse\s*\(/;
const VERTRAUEN = /\bjsonAusVertrauen\s*\(/;
const kommentar = (z: string): boolean => /^\s*(?:\/\/|\*|\/\*)/.test(z);

export function pruefeQuellen(quellen: Quelle[]): Befund[] {
  const befunde: Befund[] = [];
  for (const q of quellen) {
    if (q.pfad.startsWith('src/eingang/')) continue;
    q.text.split('\n').forEach((zeile, i) => {
      if (kommentar(zeile)) return;
      const ort = `${q.pfad}:${i + 1}`;
      if (LESEN.test(zeile)) befunde.push({ tor: TOR, datei: ort, meldung: 'Dateiinhalt ausserhalb des Eingangsmoduls gelesen; liesBegrenzt/liesTextBegrenzt aus src/eingang/lesen.ts verwenden', schwere: 'fehler' });
      else if (PARSE.test(zeile)) befunde.push({ tor: TOR, datei: ort, meldung: 'JSON.parse ausserhalb des Eingangsmoduls; Dateitext über jsonLesen, Text der App über jsonAusVertrauen mit Quelle', schwere: 'fehler' });
    });
  }
  return befunde;
}

/** Grösse mit Einheit in einem Text (ohne Platzhalter): «10 MB», «200 KB», «2,5 GB» */
const GROESSE = /(?<![{\w])\d[\d’'.,\s]*\s?(?:MB|KB|GB|kB)\b/;

export function pruefeTexte(dateien: Quelle[]): Befund[] {
  const befunde: Befund[] = [];
  for (const d of dateien) {
    d.text.split('\n').forEach((zeile, i) => {
      if (/^\s*#/.test(zeile)) return;
      if (GROESSE.test(zeile)) befunde.push({ tor: TOR, datei: `${d.pfad}:${i + 1}`, meldung: 'Grenzwert von Hand im Text; Platzhalter {grenze_<art>} aus src/eingang/grenzen.ts verwenden (AF-020)', schwere: 'fehler' });
    });
  }
  return befunde;
}

/** Aufrufe von jsonAusVertrauen (Text der App selbst), als Liste für die Durchsicht */
export function vertrauteStellen(quellen: Quelle[]): string[] {
  const aus: string[] = [];
  for (const q of quellen) {
    if (q.pfad.startsWith('src/eingang/')) continue;
    q.text.split('\n').forEach((z, i) => {
      if (!kommentar(z) && VERTRAUEN.test(z)) aus.push(`${q.pfad}:${i + 1}: ${z.trim().slice(0, 120)}`);
    });
  }
  return aus;
}

export function quellen(repo = REPO): Quelle[] {
  return dateienUnter(join(repo, 'src'), (p) => /\.(?:ts|tsx)$/.test(p) && !/\.d\.ts$/.test(p) && !p.includes('/generiert/')).map((p) => ({ pfad: relativ(p, repo), text: readFileSync(p, 'utf8') }));
}

export function texte(repo = REPO): Quelle[] {
  return dateienUnter(join(repo, 'src', 'i18n'), (p) => /\.ya?ml$/.test(p)).map((p) => ({ pfad: relativ(p, repo), text: readFileSync(p, 'utf8') }));
}

export async function pruefe(_o: Optionen = {}): Promise<Befund[]> {
  const q = quellen();
  if (process.argv.includes('--liste')) for (const z of vertrauteStellen(q)) console.log(`Text der App (jsonAusVertrauen): ${z}`);
  return [...pruefeQuellen(q), ...pruefeTexte(texte())];
}

await alsHauptprogramm(import.meta.url, pruefe);
