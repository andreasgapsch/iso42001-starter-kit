// Tor G38 Rohtexte (AF-015, QK-07): Laufzeittexte (err.message, String(e), JSON.stringify(e)) erreichen die Oberfläche nicht.
// Alle Fehlertexte laufen über worker/fehlertext.ts (Abbildung auf Ursache und nächsten Schritt). Der Rohtext eines Fehlers
// gehört nur in die Technikzeile (Fehlerbericht, Speicherstatus), erreichbar über technikText() aus speicher/technik.ts.
//
// Regeln für src/app (ts, tsx):
//   1. Kein Zugriff auf `.message` (auch `(x as Error).message`, eigene Fehlerklassen, umbenannte Variablen), kein
//      `String(e)` oder `JSON.stringify(e)` mit den üblichen Namen e, x, err, ex, error, reason.
//   2. Die Fehlervariablen einer Datei (Bindung von catch, von `.catch((x) =>` und von Rückrufen `(x: unknown) =>`) stehen,
//      gleich wie sie heissen, nicht in einer Zeichenkette `${x}`, in `String(x)`, `JSON.stringify(x)` oder in einer
//      Verkettung mit `+`.
//   3. technikText() steht nie in einer Zeile mit einer Ausgabe an die Oberfläche (melde, setFehler, textContent, alert, t).
//   Ausnahmen: die Abbildung selbst (fehlertext.ts, technik.ts), der Worker, der Technikzeilen an den Hauptthread reicht und
//   dessen Anzeige über fehlerVerstaendlich läuft (worker/einstieg.ts), und Zeilen mit dem Vermerk `roh-ok: Grund`.
// Aufruf: npx tsx scripts/pruefen/rohtexte.mts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Befund, type Optionen, REPO, alsHauptprogramm, dateienUnter, relativ } from './gemeinsam.mts';

const TOR = 'G38';
const FEHLEROBJEKT = '(?:e|x|err|ex|error|reason)';

/** Dateien, in denen Rohtexte zulässig sind, mit Grund */
export const AUSNAHMEN: Record<string, string> = {
  'src/app/worker/fehlertext.ts': 'die Abbildung selbst: Muster und Technikzeile',
  'src/app/speicher/technik.ts': 'Technikzeile: liest den Rohtext für Fehlerbericht und Status',
  'src/app/worker/einstieg.ts': 'Worker reicht den Rohtext als Technikzeile an den Hauptthread; die Anzeige läuft über fehlerVerstaendlich',
};

const REGELN: { name: string; re: RegExp }[] = [
  { name: 'instanceof Error ? …message : String(…)', re: /instanceof Error \? [\w.]+\.message : String\(/ },
  { name: '.message', re: /\.message\b/ },
  { name: 'String(Fehlerobjekt)', re: new RegExp(`\\bString\\(${FEHLEROBJEKT}\\)`) },
  { name: 'JSON.stringify(Fehlerobjekt)', re: new RegExp(`\\bJSON\\.stringify\\(${FEHLEROBJEKT}\\)`) },
];
const SENKE = /\b(?:melde|setFehler|alert|textContent|meldeFehler)\b|[^\w.]t\(/;

/** Wie viele Zeilen nach der Bindung eine Fehlervariable gilt (ein catch-Block oder Rückruf ist kurz) */
const REICHWEITE = 12;

/** Fehlervariablen mit Zeile der Bindung: catch, `.catch((x) =>` und der Rückruf für Fehler in `.then(ok, (x: unknown) =>` */
export function fehlervariablen(text: string): { name: string; zeile: number }[] {
  const liste: { name: string; zeile: number }[] = [];
  text.split('\n').forEach((z, i) => {
    for (const m of z.matchAll(/\bcatch\s*\(\s*(\w+)/g)) liste.push({ name: m[1]!, zeile: i });
    for (const m of z.matchAll(/\.catch\(\s*\(?\s*(\w+)/g)) liste.push({ name: m[1]!, zeile: i });
    for (const m of z.matchAll(/,\s*\(\s*(\w+)\s*:\s*unknown\s*\)\s*=>/g)) liste.push({ name: m[1]!, zeile: i });
  });
  return liste;
}

/** Regeln für eine Fehlervariable `v` (Name aus der Datei) */
function variablenRegel(v: string): { name: string; re: RegExp } {
  const alternativen = [
    `\\$\\{\\s*\\(*\\s*${v}\\b(?!\\.)[^}]*\\}`, // Zeichenkette mit der Variablen (Eigenschaften wie e.art sind kein Rohtext)
    `\\bString\\(\\s*${v}\\s*\\)`,
    `\\bJSON\\.stringify\\(\\s*${v}\\s*\\)`,
    `\\b${v}\\s*\\+\\s*['"\`]`, // Verkettung mit +
    `['"\`]\\s*\\+\\s*${v}\\b(?!\\s*[.\\[(])`,
  ];
  return { name: `Fehlervariable «${v}» in Text, String(), JSON.stringify() oder Verkettung`, re: new RegExp(alternativen.join('|')) };
}

export interface Quelle {
  pfad: string;
  text: string;
}

/** Bewertet Quelltexte; `pfad` relativ zum Repo mit Schrägstrichen. */
export function pruefeQuellen(quellen: Quelle[]): Befund[] {
  const befunde: Befund[] = [];
  for (const q of quellen) {
    const bindungen = fehlervariablen(q.text).map((b) => ({ ...b, regel: variablenRegel(b.name) }));
    q.text.split('\n').forEach((zeile, i) => {
      const regeln = [...REGELN, ...bindungen.filter((b) => i >= b.zeile && i <= b.zeile + REICHWEITE).map((b) => b.regel)];
      if (/^\s*(?:\/\/|\*|\/\*)/.test(zeile)) return;
      const ort = `${q.pfad}:${i + 1}`;
      if (/\btechnikText\(/.test(zeile) && SENKE.test(zeile) && !zeile.includes('roh-ok:') && !/^\s*import\b/.test(zeile)) {
        befunde.push({ tor: TOR, datei: ort, meldung: 'technikText() in einer Ausgabe an die Oberfläche; stattdessen fehlerVerstaendlich()', schwere: 'fehler' });
      }
      if (AUSNAHMEN[q.pfad] || zeile.includes('roh-ok:')) return;
      for (const r of regeln) {
        if (r.re.test(zeile)) {
          befunde.push({ tor: TOR, datei: ort, meldung: `Laufzeittext direkt ausgegeben (${r.name}); über worker/fehlertext.ts abbilden`, schwere: 'fehler' });
          break;
        }
      }
    });
  }
  return befunde;
}

export async function pruefe(_o: Optionen = {}): Promise<Befund[]> {
  const dateien = dateienUnter(join(REPO, 'src', 'app'), (p) => /\.(?:ts|tsx)$/.test(p) && !/\.d\.ts$/.test(p));
  return pruefeQuellen(dateien.map((p) => ({ pfad: relativ(p), text: readFileSync(p, 'utf8') })));
}

await alsHauptprogramm(import.meta.url, pruefe);
