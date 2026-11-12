// Tor G33 Erwartungen nur begründet ändern (AF-060, QK-35; sperrt auch das Absenken der Abdeckungsbasis, AF-047).
// Vergleicht den Stand mit dem Vergleichs-Commit und listet jede Änderung an Snapshots, Referenzbildern, Schwellen,
// Erwartungswerten (entfernte oder geänderte `expect`-Zeilen und Tests, auch mehrzeilige Werte, Hilfsdateien unter tests/,
// die Spezifikation des Fuzz) und der Abdeckungsbasis. Neu eingefügte Schalter wie `updateSnapshots` in vitest- und
// playwright-Konfiguration oder `-u` in package.json zählen ebenfalls.
//
// Vermerke: «Erwartung geändert: <Grund>» in einer Commit-Nachricht des Bereichs (Vergleichs-Commit bis HEAD), in einer neu
// angehängten Zeile der Begründungsdatei oder über `--vermerk "<Text>"`. Ein Vermerk deckt nur seinen Gegenstand:
//   - Absenken der Abdeckungsbasis: der Vermerk nennt «Abdeckungsbasis», «abdeckung-basis» oder «Abdeckung». Geprüft wird die ganze Geschichte der
//     Basisdatei (jeder Commit, der sie senkt, braucht den Vermerk in seiner Nachricht oder in seiner Begründungszeile)
//     und der Arbeitsbaum gegen HEAD. Anheben ist frei.
//   - Referenzbild: der Vermerk nennt eine Befund-ID (AF-123, D2-01 ...) und den Bildnamen (Dateiname mit oder ohne Endung,
//     oder ein Präfix mit Stern, z. B. `gefuehrt-*`).
//   - alles andere: der Vermerk nennt den Dateinamen (Pfad oder Name der Datei).
// Ein Grund trägt mit mindestens 20 Zeichen und vier verschiedenen Wörtern und ist kein Platzhalter.
//
// Vergleichs-Commit: `--basis <ref>` (verbindlich); in einem Pull Request die Merge-Basis (GITHUB_BASE_REF); in CI bei Push
// ERWARTUNGEN_BASIS (Stand vor dem Push), bei Nullsumme oder unlesbar (neuer Zweig, Force-Push) die Merge-Basis zu
// origin/main (ERWARTUNGEN_STANDARDZWEIG) mit Warnung, sonst Fehler; sonst bei geänderten, nicht committeten Dateien HEAD,
// bei sauberem Baum der Vorgänger HEAD~1. In CI braucht das Tor die Vorgeschichte (`fetch-depth: 0`); ist kein
// Vergleichs-Commit lesbar, bricht es (kein stilles Grün).
//
// Dokumentierte Grenzen: Das Tor erkennt Zeilenmuster, keine Bedeutung. Nicht erkannt werden eingefügte Zeilen, die einen
// Test unwirksam machen (`return;` am Testanfang, `if (false)` vor `expect`, Test in einen toten Zweig verschoben) und ein
// lockerer neuer Test ohne entfernte Zeile; das fängt erst ein Mutationstest (QK-28, zurückgestellt). Erwartungen in
// Konstanten ohne Schwellenwort fallen nur über entfernte `expect`-Zeilen auf. Mehrzeilige Werte erkennt eine einfache
// Klammerzählung (Zeichenketten mit Klammern können sie täuschen). Eine neue eigene Prüffunktion oder Konstante in einer Hilfsdatei
// (statt Änderung einer vorhandenen Zeile) und ein Wert, der nach einer Zeile mit «).toEqual(» allein steht und nicht zu einer
// geänderten expect-Zeile gehört, werden nicht erkannt. Bearbeitete alte Zeilen der Begründungsdatei zählen nicht
// als neue Vermerke.
// Aufruf: npx tsx scripts/pruefen/erwartungen.mts [--basis <ref>] [--vermerk "<Text>"]
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { type Befund, type Optionen, REPO, alsHauptprogramm } from './gemeinsam.mts';

const TOR = 'G33';
export const BASIS_DATEI = 'tests/abdeckung-basis.json';
export const BEGRUENDUNGSDATEI = 'docs/entwicklung/erwartungen-begruendung.md';
const KENNZAHLEN = ['lines', 'statements', 'functions', 'branches'] as const;

export type Klasse = 'snapshot' | 'referenzbild' | 'schwelle' | 'erwartungswert' | 'basis';

export interface Aenderung {
  klasse: Klasse;
  datei: string;
  zeile?: number;
  text: string;
  /** Eigene Vermerke (z. B. Nachricht des Commits, der die Basis senkt); sonst gelten die gemeinsamen. */
  vermerke?: string[];
}

const KLASSENNAME: Record<Klasse, string> = {
  snapshot: 'Snapshot geändert',
  referenzbild: 'Referenzbild geändert oder gelöscht',
  schwelle: 'Schwelle oder Schalter geändert',
  erwartungswert: 'Erwartung geändert oder entfernt',
  basis: 'Abdeckungsbasis abgesenkt',
};

const SCHWELLE = /maxDiffPixels|maxDiffPixelRatio|\bthresholds?\b|Mindestquote|Mindestfallzahl|Mindestzahl|\bMINDEST\w*\b|\bLIMIT\w*\b/;
const SCHALTER = /updateSnapshots|\bupdate\s*:\s*(?:true|['"])|--update\b|\s-u(?:\s|['"]|$)/;
const ERWARTUNG = /\bexpect(?:\.\w+)?\s*\(|\.to[A-Z]\w*\s*\(|\bassert\w*\s*[.(]/;
const TESTDATEI = /^tests\/.*\.(?:test|e2e|spec)\.(?:ts|tsx|mts)$/;
const TESTHILFE = /^tests\/(?!fixtures\/).*\.(?:ts|tsx|mts)$/;
const SPEZIFIKATION = new Set(['tests/fuzz/spezifikation.ts']);
const SCHWELLENDATEI = /^(?:vitest(?:\.\w+)?\.config\.ts|playwright\.config\.ts)$/;
const BILD = /\.(?:png|jpe?g|webp|gif)$/i;
const BEFUND_ID = /\b(?:AF-\d{3}|[A-Z]{1,4}\d?-\d{2,3}[A-Z]?)\b/;

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Zeilen einer Unified-Diff-Ausgabe mit -U0: je Datei entfernte und hinzugefügte Zeilen mit Zeilennummer im alten Stand. */
export interface DateiDiff {
  datei: string;
  entfernt: { zeile: number; text: string }[];
  hinzu: string[];
}

export function parseDiff(diff: string): DateiDiff[] {
  const ergebnis: DateiDiff[] = [];
  let akt: DateiDiff | undefined;
  let altZeile = 0;
  for (const z of diff.split('\n')) {
    if (z.startsWith('diff --git ')) {
      akt = undefined;
    } else if (z.startsWith('--- ')) {
      const p = z.slice(4).replace(/^a\//, '');
      if (p !== '/dev/null') {
        akt = { datei: p, entfernt: [], hinzu: [] };
        ergebnis.push(akt);
      }
    } else if (z.startsWith('+++ ')) {
      const p = z.slice(4).replace(/^b\//, '');
      if (!akt && p !== '/dev/null') {
        akt = { datei: p, entfernt: [], hinzu: [] };
        ergebnis.push(akt);
      }
    } else if (z.startsWith('@@')) {
      const m = /^@@ -(\d+)/.exec(z);
      altZeile = m ? Number(m[1]) : 0;
    } else if (akt && z.startsWith('-')) {
      akt.entfernt.push({ zeile: altZeile++, text: z.slice(1) });
    } else if (akt && z.startsWith('+')) {
      akt.hinzu.push(z.slice(1));
    }
  }
  return ergebnis;
}

/** Abgesenkte Kennzahlen der Abdeckungsbasis (alt gegen neu); gelöschte oder unlesbare neue Basis zählt als Absenkung. */
export function basisAbsenkungen(alt: string | null, neu: string | null): string[] {
  if (alt === null) return [];
  let a: { gesamt?: Record<string, number> };
  try {
    a = JSON.parse(alt) as typeof a;
  } catch {
    return [];
  }
  if (neu === null) return [`${BASIS_DATEI} gelöscht`];
  let n: { gesamt?: Record<string, number> };
  try {
    n = JSON.parse(neu) as typeof n;
  } catch {
    return [`${BASIS_DATEI} nicht lesbar`];
  }
  const aus: string[] = [];
  for (const k of KENNZAHLEN) {
    const vorher = Number(a.gesamt?.[k]);
    const nachher = Number(n.gesamt?.[k]);
    if (!Number.isFinite(vorher)) continue;
    if (!Number.isFinite(nachher)) aus.push(`${k}: Wert fehlt (vorher ${vorher} %)`);
    else if (nachher < vorher) aus.push(`${k}: ${vorher} % auf ${nachher} %`);
  }
  return aus;
}

/** Liegt Zeile `n` (1-basiert) des alten Standes innerhalb einer mehrzeiligen Erwartung (offene Klammern ab einer expect-Zeile)? */
export function inMehrzeiligerErwartung(alt: string, n: number): boolean {
  const zeilen = alt.split('\n');
  for (let start = n - 2; start >= Math.max(0, n - 40); start--) {
    if (!ERWARTUNG.test(zeilen[start] ?? '')) continue;
    let offen = 0;
    for (let i = start; i < n - 1; i++) {
      const ohneText = (zeilen[i] ?? '').replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, '');
      for (const c of ohneText) {
        if ('([{'.includes(c)) offen++;
        else if (')]}'.includes(c)) offen--;
      }
    }
    return offen > 0;
  }
  return false;
}

export interface Eingabe {
  /** Ausgabe von `git diff --name-status --no-renames <basis>`: «M\tpfad». */
  namensstatus: string;
  /** Ausgabe von `git diff -U0 --no-renames <basis> -- <Pfade>`. */
  diff: string;
  basisAlt: string | null;
  basisNeu: string | null;
  /** Alter Inhalt einer Datei (für mehrzeilige Erwartungen); ohne Angabe wird nur zeilenweise geprüft. */
  alt?: (datei: string) => string | null;
}

/** Sammelt alle Änderungen an Erwartungen. Hinzugefügte Dateien und Zeilen sind keine Änderung der Erwartung (ausser Schalter). */
export function sammle(e: Eingabe): Aenderung[] {
  const aus: Aenderung[] = [];
  for (const zeile of e.namensstatus.split('\n').filter(Boolean)) {
    const [status, pfad] = zeile.split('\t');
    if (!pfad) continue;
    if (BILD.test(pfad) && pfad.includes('__screenshots__/') && status !== 'A') {
      aus.push({ klasse: 'referenzbild', datei: pfad, text: status === 'D' ? 'gelöscht' : 'Bild ersetzt' });
    }
  }
  for (const t of basisAbsenkungen(e.basisAlt, e.basisNeu)) aus.push({ klasse: 'basis', datei: BASIS_DATEI, text: t });
  for (const d of parseDiff(e.diff)) {
    const hinzu = new Set(d.hinzu.map(norm));
    const verschwunden = d.entfernt.filter((x) => norm(x.text) !== '' && !hinzu.has(norm(x.text)));
    const kurz = (s: string) => norm(s).slice(0, 100);
    if (/\.snap$/.test(d.datei) || d.datei.includes('__snapshots__/')) {
      for (const x of verschwunden) aus.push({ klasse: 'snapshot', datei: d.datei, zeile: x.zeile, text: kurz(x.text) });
      continue;
    }
    if (SCHWELLENDATEI.test(d.datei)) {
      for (const x of verschwunden) if (SCHWELLE.test(x.text)) aus.push({ klasse: 'schwelle', datei: d.datei, zeile: x.zeile, text: kurz(x.text) });
      for (const z of d.hinzu) if (SCHALTER.test(z)) aus.push({ klasse: 'schwelle', datei: d.datei, text: `Schalter eingefügt: ${kurz(z)}` });
      continue;
    }
    if (d.datei === 'package.json') {
      for (const z of d.hinzu) if (/\b(?:vitest|playwright)\b[^\n]*(?:\s-u(?:\s|"|$)|--update)/.test(z)) aus.push({ klasse: 'schwelle', datei: d.datei, text: `Schalter eingefügt: ${kurz(z)}` });
      continue;
    }
    if (!TESTHILFE.test(d.datei)) continue;
    const istTest = TESTDATEI.test(d.datei);
    const altText = e.alt?.(d.datei) ?? null;
    for (const x of verschwunden) {
      if (SCHWELLE.test(x.text)) aus.push({ klasse: 'schwelle', datei: d.datei, zeile: x.zeile, text: kurz(x.text) });
      else if (SPEZIFIKATION.has(d.datei)) aus.push({ klasse: 'erwartungswert', datei: d.datei, zeile: x.zeile, text: kurz(x.text) });
      else if (ERWARTUNG.test(x.text) || (istTest && /^\s*(?:it|test)(?:\.\w+)?\s*\(/.test(x.text)) || (altText !== null && inMehrzeiligerErwartung(altText, x.zeile))) {
        aus.push({ klasse: 'erwartungswert', datei: d.datei, zeile: x.zeile, text: kurz(x.text) });
      }
    }
  }
  return aus;
}

/** Gründe aus «Erwartung geändert: <Grund>» (Zeilenanfang oder nach Zeilenumbruch, Rest der Zeile). */
export function vermerkeAus(texte: string[]): string[] {
  const gruende: string[] = [];
  for (const t of texte) {
    for (const m of t.matchAll(/^\s*(?:[-*]\s*)?Erwartung geändert:[ \t]*(.*)$/gm)) gruende.push((m[1] ?? '').trim());
  }
  return gruende;
}

/** Ein Grund trägt, wenn er mindestens vier verschiedene Wörter und 20 Zeichen hat und kein Platzhalter ist. */
export function tragend(grund: string): boolean {
  const g = grund.trim();
  if (g.length < 20 || new Set(g.toLowerCase().split(/\s+/)).size < 4) return false;
  return !/^(?:n\/?a|tbd|todo|siehe oben|test angepasst|angepasst|erwartung angepasst|wegen änderung)\W*$/i.test(g);
}

const dateiname = (p: string): string => p.slice(p.lastIndexOf('/') + 1);

/** Nennt der Grund die Datei: vollständiger Pfad, Dateiname oder (bei Bildern) Name ohne Endung, auch als Präfix mit Stern. */
export function nennt(grund: string, datei: string, bild = false): boolean {
  if (grund.includes(datei) || grund.includes(dateiname(datei))) return true;
  if (!bild) return false;
  const ohneEndung = dateiname(datei).replace(/\.[^.]+$/, '');
  if (ohneEndung.length >= 3 && new RegExp(`(?<![\\w-])${ohneEndung.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(grund)) return true;
  for (const m of grund.matchAll(/([\w.-]{3,})\*/g)) if (ohneEndung.startsWith(m[1]!)) return true;
  return false;
}

/** Bewertet die Änderungen gegen die Vermerke; jeder Vermerk deckt nur seinen Gegenstand. Ohne Änderung kein Befund. */
export function bewerte(aenderungen: Aenderung[], vermerke: string[]): Befund[] {
  const befunde: Befund[] = [];
  const fehler = (datei: string, meldung: string, zeile?: number) => befunde.push({ tor: TOR, datei, zeile, meldung, schwere: 'fehler' });
  // Je (Klasse, Datei, Vermerkkreis) ein Befund mit Zahl der Zeilen, damit eine grosse Änderung nicht hunderte Meldungen macht
  const ungedeckt = new Map<string, { a: Aenderung; n: number; grund: string }>();
  for (const a of aenderungen) {
    const alle = a.vermerke ?? vermerke;
    const tragende = alle.filter(tragend);
    let ok: boolean;
    let grund: string;
    if (alle.length === 0) {
      ok = false;
      grund = 'ohne Vermerk «Erwartung geändert: Grund»';
    } else if (tragende.length === 0) {
      ok = false;
      grund = 'mit Vermerk ohne tragenden Grund (mindestens 4 Wörter, 20 Zeichen, kein Platzhalter)';
    } else if (a.klasse === 'basis') {
      ok = tragende.some((g) => /abdeckungsbasis|abdeckung-basis|\babdeckung\b/i.test(g));
      grund = 'ohne Vermerk, der Abdeckungsbasis oder Abdeckung nennt (fremde Vermerke, auch «Merge-Basis», decken das Absenken nicht)';
    } else if (a.klasse === 'referenzbild') {
      ok = tragende.some((g) => BEFUND_ID.test(g) && nennt(g, a.datei, true));
      grund = 'ohne Vermerk mit Befund-ID und Bildname (Referenzbilder ohne Befund ändern ist nicht erlaubt)';
    } else {
      ok = tragende.some((g) => nennt(g, a.datei));
      grund = 'ohne Vermerk, der die Datei nennt';
    }
    if (ok) continue;
    const schluessel = `${a.klasse}|${a.datei}|${grund}`;
    const eintrag = ungedeckt.get(schluessel);
    if (eintrag) eintrag.n++;
    else ungedeckt.set(schluessel, { a, n: 1, grund });
  }
  for (const { a, n, grund } of ungedeckt.values()) {
    fehler(a.datei, `${KLASSENNAME[a.klasse]} ${grund}: ${a.text}${n > 1 ? ` (und ${n - 1} weitere in dieser Datei)` : ''}`, a.zeile);
  }
  return befunde;
}

function git(args: string[], zulaessigFehler = false, wurzel: string = REPO): string | null {
  try {
    return execFileSync('git', args, { cwd: wurzel, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    if (zulaessigFehler) return null;
    throw e;
  }
}

export interface Vergleich {
  ref: string;
  fehler?: string;
  warnung?: string;
}

/** Löst den Vergleichs-Commit auf; `null` heisst: es gibt keinen Vorgänger (erster Commit, lokal). */
export function vergleichsCommit(env: NodeJS.ProcessEnv, argv: string[], lesen: (args: string[]) => string | null = (a) => git(a, true)): Vergleich | null {
  const i = argv.indexOf('--basis');
  const pruefeRef = (ref: string) => lesen(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  const imAufruf = i >= 0 ? argv[i + 1] : undefined;
  if (imAufruf) {
    return pruefeRef(imAufruf) ? { ref: imAufruf } : { ref: imAufruf, fehler: `Vergleichs-Commit ${imAufruf} nicht lesbar (flacher Klon? \`fetch-depth: 0\`)` };
  }
  if (env.GITHUB_BASE_REF) {
    const mb = lesen(['merge-base', 'HEAD', `origin/${env.GITHUB_BASE_REF}`])?.trim();
    if (mb) return { ref: mb };
    return { ref: `origin/${env.GITHUB_BASE_REF}`, fehler: `Merge-Basis zu origin/${env.GITHUB_BASE_REF} nicht lesbar (flacher Klon? \`fetch-depth: 0\`)` };
  }
  const ausEnv = env.ERWARTUNGEN_BASIS;
  if (ausEnv) {
    if (!/^0+$/.test(ausEnv) && pruefeRef(ausEnv)) return { ref: ausEnv };
    // Neuer Zweig (Nullsumme) oder Force-Push (Stand vor dem Push nicht erreichbar): Merge-Basis zum Standardzweig
    const zweig = env.ERWARTUNGEN_STANDARDZWEIG || 'main';
    const grund = /^0+$/.test(ausEnv) ? 'neuer Zweig' : `Stand vor dem Push ${ausEnv.slice(0, 9)} nicht lesbar (Force-Push?)`;
    const mb = lesen(['merge-base', 'HEAD', `origin/${zweig}`])?.trim();
    const kopf = pruefeRef('HEAD')?.trim();
    if (mb && mb !== kopf) return { ref: mb, warnung: `${grund}: Vergleich gegen die Merge-Basis zu origin/${zweig} (${mb.slice(0, 9)})` };
    if (mb && mb === kopf && pruefeRef('HEAD~1')) return { ref: 'HEAD~1', warnung: `${grund}: HEAD liegt auf origin/${zweig}, Vergleich nur mit dem Vorgänger-Commit` };
    // HEAD ist der erste Commit des Repos (Wurzel, z. B. neue Geschichte per Force-Push): es gibt nichts zu vergleichen
    if (mb && kopf && mb === kopf && (lesen(['rev-list', '--max-parents=0', 'HEAD']) ?? '').split('\n').map((z) => z.trim()).includes(kopf)) return null;
    return { ref: `origin/${zweig}`, fehler: `${grund}, und origin/${zweig} ist nicht lesbar (flacher Klon? \`fetch-depth: 0\`): kein Vergleichs-Commit` };
  }
  const schmutzig = (lesen(['status', '--porcelain', '--untracked-files=no']) ?? '').trim() !== '';
  if (schmutzig) return { ref: 'HEAD' };
  if (pruefeRef('HEAD~1')) return { ref: 'HEAD~1' };
  if (env.CI) return { ref: 'HEAD~1', fehler: 'Vorgänger-Commit nicht lesbar (flacher Klon? `fetch-depth: 0`)' };
  return null;
}

/** Ähnlichkeit zweier Zeilen von 0 bis 1 (Editierabstand durch die längere Länge). */
export function aehnlichkeit(a: string, b: string): number {
  if (a === b) return 1;
  const n = Math.max(a.length, b.length);
  if (n === 0) return 1;
  let vor = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const akt = [i];
    for (let j = 1; j <= b.length; j++) akt[j] = Math.min(vor[j]! + 1, akt[j - 1]! + 1, vor[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    vor = akt;
  }
  return 1 - vor[b.length]! / n;
}

/**
 * Zeilen der Begründungsdatei, die im Vergleichsstand nicht stehen und keine bearbeitete alte Zeile sind. Als bearbeitet gilt nur
 * eine neue Zeile, die eine **weggefallene** alte Zeile fortsetzt (beginnt mit ihr) oder ihr zu mindestens 85 % gleicht; jede
 * weggefallene alte Zeile erklärt höchstens eine neue. Eine zusätzliche Zeile mit gleichem Anfang (zweiter Vermerk zur selben
 * Datei) zählt neu, solange die alte Zeile unverändert dasteht.
 */
export function neueBegruendungen(jetzt: string, vorher: string): string[] {
  const alt = vorher.split('\n').filter((z) => z.trim() !== '');
  const neu = jetzt.split('\n').filter((z) => z.trim() !== '');
  const altMenge = new Set(alt);
  const neuMenge = new Set(neu);
  const weggefallen = alt.filter((a) => !neuMenge.has(a) && a.length >= 20);
  const ergebnis: string[] = [];
  for (const z of neu) {
    if (altMenge.has(z)) continue;
    const i = weggefallen.findIndex((a) => z.startsWith(a) || aehnlichkeit(a, z) >= 0.85);
    if (i >= 0) weggefallen.splice(i, 1);
    else ergebnis.push(z);
  }
  return ergebnis;
}

export async function pruefe(_o: Optionen = {}, argv: string[] = process.argv, env: NodeJS.ProcessEnv = process.env, wurzel: string = REPO): Promise<Befund[]> {
  const g = (args: string[], zulaessig = false) => git(args, zulaessig, wurzel);
  const basis = vergleichsCommit(env, argv, (a) => g(a, true));
  if (!basis) return [];
  if (basis.fehler) return [{ tor: TOR, datei: '-', meldung: basis.fehler, schwere: 'fehler' }];
  const befunde: Befund[] = [];
  if (basis.warnung) befunde.push({ tor: TOR, datei: '-', meldung: basis.warnung, schwere: 'warnung' });
  const ref = basis.ref;
  const pfade = ['tests', ':(glob)vitest*.ts', 'playwright.config.ts', 'package.json'];
  const namensstatus = g(['diff', '--name-status', '--no-renames', ref, '--', 'tests']) ?? '';
  const diff = g(['diff', '-U0', '--no-renames', '--no-color', ref, '--', ...pfade]) ?? '';
  // Basis im Arbeitsbaum gegen HEAD (nicht Eingecheckte Senkung); eingecheckte Senkungen prüft die Geschichte unten
  const platte = `${wurzel}/${BASIS_DATEI}`;
  const neu = existsSync(platte) ? readFileSync(platte, 'utf8') : null;
  const imKopf = g(['show', `HEAD:${BASIS_DATEI}`], true);
  const aenderungen = sammle({ namensstatus, diff, basisAlt: imKopf, basisNeu: neu, alt: (d) => g(['show', `${ref}:${d}`], true) });
  // Geschichte der Basisdatei: jeder Commit, der sie senkt, braucht den Vermerk in seiner Nachricht oder seiner Begründungszeile
  const commits = (g(['log', '--format=%H', '--', BASIS_DATEI], true) ?? '').split('\n').filter(Boolean);
  for (const c of commits) {
    const vorher = g(['show', `${c}^:${BASIS_DATEI}`], true);
    const nachher = g(['show', `${c}:${BASIS_DATEI}`], true);
    const senkungen = basisAbsenkungen(vorher, nachher);
    if (senkungen.length === 0) continue;
    const nachricht = g(['log', '-1', '--format=%B', c], true) ?? '';
    const begrDiff = parseDiff(g(['diff', '-U0', '--no-renames', '--no-color', `${c}^`, c, '--', BEGRUENDUNGSDATEI], true) ?? '');
    const eigene = vermerkeAus([nachricht, ...begrDiff.map((d) => d.hinzu.join('\n'))]);
    for (const t of senkungen) aenderungen.push({ klasse: 'basis', datei: BASIS_DATEI, text: `${t} (Commit ${c.slice(0, 9)})`, vermerke: eigene });
  }
  const i = argv.indexOf('--vermerk');
  const texte: string[] = [];
  if (i >= 0 && argv[i + 1]) texte.push(argv[i + 1]!);
  if (env.ERWARTUNGEN_VERMERK) texte.push(env.ERWARTUNGEN_VERMERK);
  texte.push(g(['log', '--format=%B', `${ref}..HEAD`], true) ?? '');
  // Begründungsdatei von der Platte (auch ungetrackt): nur neu angehängte Zeilen, keine bearbeiteten alten
  const begrDatei = `${wurzel}/${BEGRUENDUNGSDATEI}`;
  if (existsSync(begrDatei)) texte.push(neueBegruendungen(readFileSync(begrDatei, 'utf8'), g(['show', `${ref}:${BEGRUENDUNGSDATEI}`], true) ?? '').join('\n'));
  // Die gemeinsamen Vermerke gelten auch für die Basis im Arbeitsbaum (Absenkung noch nicht eingecheckt); eingecheckte Absenkungen tragen eigene
  befunde.push(...bewerte(aenderungen, vermerkeAus(texte)));
  return befunde;
}

await alsHauptprogramm(import.meta.url, (o) => pruefe(o));
