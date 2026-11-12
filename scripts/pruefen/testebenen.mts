// Tor G39 Testebenen (AF-049, AF-048, QK-27): Jedes Modul unter src/ (ohne src/generiert) hat in tests/testebenen.json eine
// Testebene (unit, dokument, e2e, fuzz) mit den Tests, die es prüfen. Für ein Modul gilt der erste passende Eintrag
// (Besonderes steht vor Allgemeinem). Das Tor prüft die Modulliste gegen die Quelldateien:
//   - Module ohne Testebene: Fehler. Einträge, die für kein Modul der erste passende sind (tot oder verdeckt): Fehler.
//   - Jeder genannte Test existiert und liegt zur Ebene (unit: tests/unit, dokument: tests/dokumente, e2e: tests/e2e,
//     fuzz: tests/fuzz).
//   - Kernlogik (Liste `kern`) hat die Ebene unit.
// Liegt ein Abdeckungsbericht vor (coverage/coverage-summary.json, `npm run test:cov`), gilt zusätzlich:
//   - Kernlogik: Zeilen mindestens `kernZeilen` %, Verzweigungen mindestens `kernVerzweigungen` %.
//   - Modul unter `untergrenze` % Zeilen: nur mit Eintrag in `ausnahmen` (mit Grund) oder mit ausschliesslich der Ebene e2e
//     (die Messung der Unit-Tests sieht den Browser nicht); sonst Fehler. Damit erbt ein neues, ungetestetes Modul in einem
//     Ordner mit Ebene unit keine Abdeckung: es fällt unter die Untergrenze.
//   - Eine Ausnahme gilt je Modul: nennt sie ein Modul, das die Untergrenze erreicht, ist sie zu breit oder überholt (Fehler).
// Aufruf: npx tsx scripts/pruefen/testebenen.mts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Befund, type Optionen, REPO, alsHauptprogramm, relativ } from './gemeinsam.mts';
import { quelldateien } from './ratsche.mts';

const TOR = 'G39';
const DATEI = 'tests/testebenen.json';
const BERICHT = 'coverage/coverage-summary.json';
export const EBENEN = ['unit', 'dokument', 'e2e', 'fuzz'] as const;
type Ebene = (typeof EBENEN)[number];
const ORDNER: Record<Ebene, string> = { unit: 'tests/unit/', dokument: 'tests/dokumente/', e2e: 'tests/e2e/', fuzz: 'tests/fuzz/' };

export interface Eintrag {
  muster: string;
  ebenen: Ebene[];
  tests: string[];
}
export interface Testebenen {
  stand?: string;
  hinweis?: string;
  schwellen: { kernZeilen: number; kernVerzweigungen: number; untergrenze: number };
  kern: string[];
  /** Module (genaue Pfade) unter der Untergrenze mit Grund */
  ausnahmen: { datei: string; grund: string }[];
  module: Eintrag[];
}
type Summary = Record<string, { lines?: { pct: number | string }; branches?: { pct: number | string } }>;

/** Muster mit `**` (beliebig tief) und `*` (innerhalb eines Ordners) als regulärer Ausdruck */
export function musterRegex(m: string): RegExp {
  const re = m.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
  return new RegExp(`^${re}$`);
}

/** Erster passender Eintrag eines Moduls */
function ersterEintrag(res: { e: Eintrag; re: RegExp }[], modul: string): Eintrag | undefined {
  return res.find((r) => r.re.test(modul))?.e;
}

/** Bewertet die Modulliste gegen die Quelldateien; `vorhanden` sagt, ob eine Testdatei existiert. */
export function bewerteListe(t: Testebenen, quellen: string[], vorhanden: (pfad: string) => boolean): Befund[] {
  const befunde: Befund[] = [];
  const fehler = (datei: string, meldung: string) => befunde.push({ tor: TOR, datei, meldung, schwere: 'fehler' });
  const res = t.module.map((e) => ({ e, re: musterRegex(e.muster) }));
  const benutzt = new Set<Eintrag>();
  for (const q of quellen) {
    const e = ersterEintrag(res, q);
    if (!e) fehler(q, 'Modul ohne Testebene (Eintrag in tests/testebenen.json fehlt)');
    else benutzt.add(e);
  }
  for (const { e } of res) {
    if (!benutzt.has(e)) fehler(DATEI, `Eintrag «${e.muster}» passt auf kein Modul (tot oder von einem früheren Eintrag verdeckt)`);
    if (!e.ebenen.length) fehler(DATEI, `Eintrag «${e.muster}» ohne Testebene`);
    for (const eb of e.ebenen) {
      if (!EBENEN.includes(eb)) fehler(DATEI, `Eintrag «${e.muster}»: unbekannte Ebene «${eb}»`);
      else if (!e.tests.some((p) => p.startsWith(ORDNER[eb]))) fehler(DATEI, `Eintrag «${e.muster}»: Ebene ${eb} ohne Test unter ${ORDNER[eb]}`);
    }
    for (const p of e.tests) if (!vorhanden(p)) fehler(DATEI, `Eintrag «${e.muster}»: Test ${p} existiert nicht`);
  }
  for (const k of t.kern) {
    if (!quellen.includes(k)) fehler(DATEI, `Kernmodul ${k} existiert nicht`);
    else if (!ersterEintrag(res, k)?.ebenen.includes('unit')) fehler(DATEI, `Kernmodul ${k} ohne Ebene unit`);
  }
  return befunde;
}

/** Bewertet den Abdeckungsbericht gegen Kernlogik und Untergrenze. */
export function bewerteAbdeckung(t: Testebenen, summary: Summary, quellen: string[]): Befund[] {
  const befunde: Befund[] = [];
  const fehler = (datei: string, meldung: string) => befunde.push({ tor: TOR, datei, meldung, schwere: 'fehler' });
  const je = new Map<string, { zeilen: number; zweige: number }>();
  for (const [k, v] of Object.entries(summary)) if (k !== 'total') je.set(k.startsWith('/') ? relativ(k) : k, { zeilen: Number(v.lines?.pct), zweige: Number(v.branches?.pct) });
  const res = t.module.map((e) => ({ e, re: musterRegex(e.muster) }));
  for (const k of t.kern) {
    const w = je.get(k);
    if (!w) fehler(BERICHT, `Kernmodul ${k} ohne Messwert`);
    else {
      if (!(w.zeilen >= t.schwellen.kernZeilen)) fehler(k, `Kernlogik: Zeilen ${w.zeilen} % unter ${t.schwellen.kernZeilen} %`);
      if (!(w.zweige >= t.schwellen.kernVerzweigungen)) fehler(k, `Kernlogik: Verzweigungen ${w.zweige} % unter ${t.schwellen.kernVerzweigungen} %`);
    }
  }
  // Ausnahmen je Modul: genauer Pfad, Grund, und das Modul liegt wirklich unter der Untergrenze
  const ausnahmen = new Set<string>();
  for (const a of t.ausnahmen) {
    ausnahmen.add(a.datei);
    if (a.grund.trim().split(/\s+/).length < 4) fehler(DATEI, `Ausnahme ${a.datei} ohne Begründung`);
    if (!quellen.includes(a.datei)) fehler(DATEI, `Ausnahme ${a.datei}: Modul existiert nicht (genauer Pfad nötig, keine Muster)`);
    else if (!((je.get(a.datei)?.zeilen ?? 0) < t.schwellen.untergrenze)) fehler(DATEI, `Ausnahme ${a.datei} zu breit oder überholt: Abdeckung ${je.get(a.datei)?.zeilen ?? '?'} % erreicht ${t.schwellen.untergrenze} %`);
  }
  for (const q of quellen) {
    const w = je.get(q);
    if (!w || !(w.zeilen < t.schwellen.untergrenze)) continue;
    const ebenen = ersterEintrag(res, q)?.ebenen ?? [];
    const nurBrowser = ebenen.length > 0 && ebenen.every((x) => x === 'e2e');
    if (!nurBrowser && !ausnahmen.has(q)) fehler(q, `Abdeckung ${w.zeilen} % unter ${t.schwellen.untergrenze} % ohne Begründung (Ausnahme in tests/testebenen.json)`);
  }
  return befunde;
}

export async function pruefe(_o: Optionen = {}): Promise<Befund[]> {
  const pfad = join(REPO, DATEI);
  if (!existsSync(pfad)) return [{ tor: TOR, datei: DATEI, meldung: 'fehlt', schwere: 'fehler' }];
  const t = JSON.parse(readFileSync(pfad, 'utf8')) as Testebenen;
  const quellen = quelldateien();
  const befunde = bewerteListe(t, quellen, (p) => existsSync(join(REPO, p)));
  const bericht = join(REPO, BERICHT);
  if (existsSync(bericht)) befunde.push(...bewerteAbdeckung(t, JSON.parse(readFileSync(bericht, 'utf8')) as Summary, quellen));
  else befunde.push({ tor: TOR, datei: BERICHT, meldung: 'kein Abdeckungsbericht: Kernlogik und Untergrenze nur mit `npm run test:cov` prüfbar', schwere: 'warnung' });
  return befunde;
}

await alsHauptprogramm(import.meta.url, pruefe);
