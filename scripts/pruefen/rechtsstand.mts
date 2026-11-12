// Tor G37 Rechtsstand (AF-116, QK-64, W10; Q13 «Release-Tore»): Vor jedem Release sind alle Rechtsangaben in
// src/ai-act/stand.yaml höchstens 30 Tage vor dem Release gesichtet (geprueft_am der Datei und je Hinweis), und jeder
// Hinweis mit status zu_pruefen hat ein eigenes Sichtungsdatum.
//   Fehler immer: zu_pruefen ohne Sichtungsdatum, ungültiges Datum, Datum nach dem Stichtag.
//   Sichtung älter als 30 Tage: Fehler im Release-Modus (--release, RELEASE=1 oder Tag-Build), sonst Warnung, damit die
//   CI zwischen zwei Releases nicht nur wegen des Kalenders rot wird.
// Stichtag: --stichtag JJJJ-MM-TT oder RECHTSSTAND_STICHTAG, sonst heute.
// Aufruf: npx tsx scripts/pruefen/rechtsstand.mts [--release] [--stichtag 2026-11-20]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { rechtsstandTor, TOR_TAGE, type RechtsstandQuelle } from '../../src/app/logik/rechtsstand.ts';
import { REPO, formatiere, zaehle, type Befund, type Optionen } from './gemeinsam.mts';
import { istReleaseModus } from './version.mts';

const TOR = 'G37';
const DATEI = 'src/ai-act/stand.yaml';

export interface Eingabe {
  stand?: RechtsstandQuelle;
  stichtag?: string;
  release?: boolean;
  tage?: number;
}

function stichtagArg(): string {
  const i = process.argv.indexOf('--stichtag');
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!;
  return process.env.RECHTSSTAND_STICHTAG ?? new Date().toISOString().slice(0, 10);
}

export async function pruefe(_o: Optionen = {}, e: Eingabe = {}): Promise<Befund[]> {
  const stand = e.stand ?? (parse(readFileSync(join(REPO, DATEI), 'utf8')) as RechtsstandQuelle);
  const release = e.release ?? istReleaseModus();
  const stichtag = e.stichtag ?? stichtagArg();
  return rechtsstandTor(stand, stichtag, e.tage ?? TOR_TAGE).map((b) => ({
    tor: TOR,
    datei: DATEI,
    meldung: `${b.meldung}${b.art === 'alt' ? '. Vor dem Release an der Quelle prüfen und geprueft_am setzen' : ''}`,
    schwere: b.art === 'alt' && !release ? 'warnung' : 'fehler',
  }));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  const befunde = await pruefe();
  for (const b of befunde) console.log(formatiere(b));
  const z = zaehle(befunde);
  console.log(`${TOR} Rechtsstand${istReleaseModus() ? ' (Release)' : ''}, Stichtag ${stichtagArg()}: ${z.fehler} Fehler, ${z.warnungen} Warnungen`);
  process.exitCode = z.fehler ? 1 : 0;
}
