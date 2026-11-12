// Tor G30 Testmarker (AF-061, QK-35): `.only` bricht immer. Ein unbedingtes `.skip`, `.todo` oder `.fixme` (Titel statt
// Bedingung als erstes Argument, `xit`, `xdescribe`) braucht einen Vermerk `skip-bis: JJJJ-MM-TT Grund` in derselben
// oder einer der drei Zeilen davor (der nächste, ein Vermerk gilt nur für einen Marker); ohne Vermerk oder mit abgelaufenem Datum bricht das Tor.
// Bedingte Auslassungen (`skipIf`, `runIf`, Playwright `test.skip(Bedingung, 'Grund')`) hängen von der Umgebung ab
// (fehlende Quell-PDFs, ungebautes Werkzeug, Browser) und werden gezählt, nicht gesperrt.
// Aufruf: npx tsx scripts/pruefen/testmarker.mts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Befund, type Optionen, REPO, alsHauptprogramm, dateienUnter, relativ } from './gemeinsam.mts';

const TOR = 'G30';

// Ketten wie test.concurrent.only, test.describe.serial.only, it.skip.concurrent gehören dazu
const ONLY = /\b(?:it|test|describe|suite|bench)(?:\.\w+)*\.only\b|\b(?:fit|fdescribe)\s*\(|^\s*\.only\b/;
// Unbedingt: erstes Argument ist ein Textliteral, leer oder `true`
const SKIP_UNBEDINGT = /\b(?:it|test|describe|suite)(?:\.(?!skip\b|todo\b|fixme\b)\w+)*\.(?:skip|todo|fixme)(?:\.(?!each\b)\w+)*(?:\.each\([^)]*\))?\s*\(\s*(?:['"`]|\)|true\b)|\b(?:xit|xtest|xdescribe)\s*\(/;
const BEDINGT = /\.(?:skipIf|runIf)\s*\(|\btest\.skip\s*\(\s*[^'"`)\s]/;
const VERMERK = /skip-bis:\s*(\d{4}-\d{2}-\d{2})\s+(\S.*)/;

export interface Marker {
  datei: string;
  zeile: number;
  art: 'only' | 'skip' | 'bedingt';
  text: string;
}

/** Findet Marker in einem Quelltext. Kommentarzeilen zählen nicht. */
export function findeMarker(datei: string, text: string): Marker[] {
  const treffer: Marker[] = [];
  text.split('\n').forEach((zeile, i) => {
    if (/^\s*(?:\/\/|\*|\/\*)/.test(zeile)) return;
    const art = ONLY.test(zeile) ? 'only' : SKIP_UNBEDINGT.test(zeile) ? 'skip' : BEDINGT.test(zeile) ? 'bedingt' : undefined;
    if (art) treffer.push({ datei, zeile: i + 1, art, text: zeile.trim() });
  });
  return treffer;
}

/**
 * Bewertet den Text einer Datei: Befunde für `.only` und für unbedingte `.skip` ohne gültigen Vermerk.
 * Je Marker gilt der nächste Vermerk in derselben oder den drei Zeilen davor; ein Vermerk gilt nur für einen Marker.
 */
export function pruefeText(datei: string, text: string, heute: string): { befunde: Befund[]; bedingt: number } {
  const vermerke = text.split('\n').flatMap((z, i) => {
    const v = VERMERK.exec(z);
    return v ? [{ zeile: i + 1, datum: v[1]!, benutzt: false }] : [];
  });
  const befunde: Befund[] = [];
  const fehler = (zeile: number, meldung: string) => befunde.push({ tor: TOR, datei, zeile, meldung, schwere: 'fehler' });
  let bedingt = 0;
  for (const m of findeMarker(datei, text)) {
    if (m.art === 'bedingt') bedingt++;
    else if (m.art === 'only') fehler(m.zeile, `.only schliesst andere Tests aus und ist verboten: ${m.text}`);
    else {
      const v = vermerke.filter((x) => !x.benutzt && x.zeile <= m.zeile && x.zeile >= m.zeile - 3).sort((x, y) => y.zeile - x.zeile)[0];
      if (!v) fehler(m.zeile, `.skip ohne Vermerk «skip-bis: JJJJ-MM-TT Grund»: ${m.text}`);
      else {
        v.benutzt = true;
        if (v.datum < heute) fehler(m.zeile, `.skip abgelaufen seit ${v.datum}: ${m.text}`);
      }
    }
  }
  return { befunde, bedingt };
}

export const heuteIso = (): string => new Date().toISOString().slice(0, 10);

export async function pruefe(_o: Optionen = {}, heute: string = heuteIso()): Promise<Befund[]> {
  const befunde: Befund[] = [];
  let bedingt = 0;
  for (const pfad of dateienUnter(join(REPO, 'tests'), (p) => /\.(?:ts|mts|tsx)$/.test(p))) {
    const r = pruefeText(relativ(pfad), readFileSync(pfad, 'utf8'), heute);
    befunde.push(...r.befunde);
    bedingt += r.bedingt;
  }
  if (bedingt > 0) befunde.push({ tor: TOR, datei: 'tests', meldung: `${bedingt} bedingte Auslassungen (skipIf, runIf, test.skip mit Bedingung); sie hängen von der Umgebung ab und sind nicht gesperrt`, schwere: 'warnung' });
  return befunde;
}

await alsHauptprogramm(import.meta.url, pruefe);
