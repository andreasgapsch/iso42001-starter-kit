// Abnahme Q9 als ein Befehl (AF-028, QK-15): `npm run abnahme:q9` führt Fuzz mit Rundreise über die 9 Eingabearten, die
// Regressionsdateien, die Mutationsklassen (AF-022), die Skript- und die Netzprüfung sowie die Grenzmessung des Eingangsmoduls
// (AF-019) aus und schreibt docs/entwicklung/messung/q9-<commit>.json mit festen Zählern (Zählweise:
// docs/entwicklung/ZAEHLWEISE-Q9.md), Seed, Fallzahl und Commit. Stufe ohne Browser; ein Browserlauf trägt das
// Netlog der Diagrammansicht nach.
//   npm run abnahme:q9                         Pflichtteil: 50 Fälle je Ziel, Seed 77123
//   npm run abnahme:q9 -- --faelle 500         Release-Lauf
//   Weitere: --seed <n>, --ausgabe <Datei>, --ohne-klassen, --ziele a,b (nur für Tests: Messung gilt dann als nicht erfüllt)
import { execFileSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, openAsBlob, ftruncateSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EingangsFehler, liesBegrenzt } from '../src/eingang/lesen.ts';
import { GRENZEN, type EingangsArt } from '../src/eingang/grenzen.ts';
import { STRENGE_CSP } from './csp.mts';
import { PFLICHT_FAELLE, RELEASE_FAELLE, STANDARD_SEED } from '../tests/fuzz/kern.ts';
import { laufeZiel, type ZielErgebnis } from '../tests/fuzz/lauf.ts';
import { bewerteRegression, regressionsDateien } from '../tests/fuzz/regression.ts';
import { KLASSEN, MIN_VARIANTEN, laufeKlasse, type KlassenErgebnis } from '../tests/fuzz/klassen/index.ts';
import { EINGABEARTEN, type Eingabeart, type Fehlerklasse } from '../tests/fuzz/typen.ts';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Die festen Zähler der Zählweise Q9, in dieser Reihenfolge. Änderung nur mit Eintrag im Änderungsprotokoll der Zählweise. */
export const ZAEHLER = ['skript', 'absturz', 'datenverlust', 'netz', 'meldung', 'haenger'] as const;
export type Zaehler = (typeof ZAEHLER)[number];

/** Arten der Grenzmessung (AF-019): teure fremde Eingaben im Worker */
export const GRENZ_ARTEN: EingangsArt[] = ['norm-pdf', 'drawio', 'sicherung', 'word-vorlage'];
/** Kriterium AF-019: Meldung bei 10-facher Grenze nach höchstens 5 s, Spitzenspeicher höchstens 1 GB */
export const GRENZ_ZEIT_MS = 5000;
export const GRENZ_SPEICHER_MB = 1024;

export interface Messung {
  messung: 'Q9 ohne Browser';
  commit: string;
  /** Ungespeicherte Änderungen machen die Messung nach der Zählweise ungültig */
  sauber: boolean;
  datum: string;
  seed: number;
  faelle: number;
  mindestFaelle: number;
  ziele: Record<string, { faelle: number; angenommen: number; abgelehnt: number; fehler: number; haenger: number; klassen: Record<Fehlerklasse, number> } | 'nicht gemessen'>;
  regression: { dateien: number; fehler: string[] };
  klassen: { id: string; befunde: string[]; varianten: number; rueckfaelle: number; gegenprobe: number }[] | 'nicht gemessen';
  netz: { art: string; befunde: string[]; browser: 'nicht gemessen (P18)' };
  grenzmessung: { art: EingangsArt; dateiBytes: number; ms: number; meldung: boolean }[];
  spitzenspeicherMb: number;
  zaehler: Record<Zaehler, number>;
  /** Orakelverletzungen ohne Zuordnung: lassen die Messung scheitern */
  orakel: number;
  erfuellt: boolean;
  gruende: string[];
}

function git(args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/** Netzprüfung ohne Browser: strenge CSP ohne Verbindungen und keine Netz-Schnittstelle in den Quellen */
export function netzPruefen(): string[] {
  const befunde: string[] = [];
  if (!STRENGE_CSP.includes("connect-src 'none'") || !STRENGE_CSP.includes("default-src 'none'")) befunde.push("CSP ohne connect-src 'none' oder default-src 'none'");
  const dateien = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'src'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter((p) => /\.(ts|tsx|tpl)$/.test(p) && !p.startsWith('src/generiert/'));
  const NETZ = /\bfetch\(|XMLHttpRequest|new WebSocket|EventSource|sendBeacon|importScripts\(|\.open\(\s*['"](GET|POST)/;
  for (const d of dateien) {
    let text: string;
    try {
      text = readFileSync(join(REPO, d), 'utf8');
    } catch {
      continue;
    }
    text.split('\n').forEach((z, i) => {
      if (!/^\s*(\/\/|\*)/.test(z) && NETZ.test(z)) befunde.push(`${d}:${i + 1}`);
    });
  }
  return befunde;
}

/** Grenzmessung: Datei mit 10-facher Grenze (dünn, ohne Inhalt auf der Platte) wird vor dem Lesen mit Meldung abgelehnt */
export async function grenzMessen(arten = GRENZ_ARTEN): Promise<Messung['grenzmessung']> {
  const ordner = join(process.env['TMPDIR'] ?? '/tmp', `q9-grenze-${process.pid}`);
  mkdirSync(ordner, { recursive: true });
  const aus: Messung['grenzmessung'] = [];
  try {
    for (const art of arten) {
      const pfad = join(ordner, `${art}.bin`);
      const groesse = GRENZEN[art].maxBytes * 10;
      const fd = openSync(pfad, 'w');
      ftruncateSync(fd, groesse);
      closeSync(fd);
      const t0 = performance.now();
      let meldung = false;
      try {
        await liesBegrenzt((await openAsBlob(pfad)) as never, art);
      } catch (e) {
        meldung = e instanceof EingangsFehler && e.grund === 'zu-gross' && e.message.length > 0;
      }
      aus.push({ art, dateiBytes: groesse, ms: Math.round(performance.now() - t0), meldung });
      rmSync(pfad, { force: true });
    }
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
  return aus;
}

export interface MessOptionen {
  seed?: number;
  faelle?: number;
  ziele?: Eingabeart[];
  klassen?: boolean;
  regression?: boolean;
}

export async function messe(o: MessOptionen = {}): Promise<Messung> {
  const seed = o.seed ?? STANDARD_SEED;
  const faelle = o.faelle ?? PFLICHT_FAELLE;
  const ziele = o.ziele ?? [...EINGABEARTEN];
  const gruende: string[] = [];
  const zaehler = Object.fromEntries(ZAEHLER.map((k) => [k, 0])) as Record<Zaehler, number>;
  let orakel = 0;
  const zu = (k: Fehlerklasse, n = 1): void => {
    if (k === 'orakel') orakel += n;
    else zaehler[k] += n;
  };

  // 1. Fuzz mit Rundreise je Ziel (höchstens drei Arbeiter gleichzeitig)
  const ergebnisse: ZielErgebnis[] = [];
  const schlange = [...ziele];
  await Promise.all(Array.from({ length: Math.min(3, schlange.length) }, async () => {
    for (let a = schlange.shift(); a; a = schlange.shift()) ergebnisse.push(await laufeZiel({ art: a, seed, faelle }));
  }));
  const zielAus: Messung['ziele'] = {};
  for (const art of EINGABEARTEN) {
    const e = ergebnisse.find((x) => x.art === art);
    if (!e) {
      zielAus[art] = 'nicht gemessen';
      gruende.push(`Ziel ${art} nicht gemessen`);
      continue;
    }
    zielAus[art] = { faelle: e.faelle, angenommen: e.angenommen, abgelehnt: e.abgelehnt, fehler: e.fehler, haenger: e.haenger, klassen: e.klassen };
    for (const [k, n] of Object.entries(e.klassen)) zu(k as Fehlerklasse, n);
    if (e.faelle < PFLICHT_FAELLE) gruende.push(`Ziel ${art}: ${e.faelle} Fälle, Mindestzahl ${PFLICHT_FAELLE}`);
  }

  // 2. Regressionsdateien früherer Runden und behobener Funde
  const regression: Messung['regression'] = { dateien: 0, fehler: [] };
  if (o.regression !== false) {
    for (const r of regressionsDateien().filter((x) => ziele.includes(x.art))) {
      regression.dateien++;
      const e = await laufeZiel({ art: r.art, seed, faelle: 1, datei: r.datei });
      const f = bewerteRegression(r, e);
      if (f) regression.fehler.push(f);
      for (const [k, n] of Object.entries(e.klassen)) zu(k as Fehlerklasse, n);
    }
    if (regression.fehler.length) gruende.push(`Regression: ${regression.fehler.length} Fehler`);
  }

  // 3. Mutationsklassen (AF-022): Rückfälle zählen in den Klassen der Zählweise
  let klassen: Messung['klassen'] = 'nicht gemessen';
  if (o.klassen !== false) {
    const liste: KlassenErgebnis[] = [];
    for (const k of KLASSEN.filter((x) => ziele.includes(x.art))) liste.push(await laufeKlasse(k, seed, Math.max(MIN_VARIANTEN, Math.min(faelle, RELEASE_FAELLE))));
    klassen = liste.map((e) => ({ id: e.id, befunde: e.befunde, varianten: e.varianten, rueckfaelle: e.fehler.length + (e.regression.status === 'fehler' ? 1 : 0), gegenprobe: e.gegenprobe }));
    for (const e of liste) for (const f of [...e.fehler, ...(e.regression.status === 'fehler' ? [e.regression] : [])]) zu(f.klasse ?? 'orakel');
  } else gruende.push('Mutationsklassen nicht gemessen');

  // 4. Netz ohne Browser
  const netzBefunde = netzPruefen();
  zaehler.netz += netzBefunde.length;

  // 5. Grenzmessung des Eingangsmoduls (AF-019)
  const grenzmessung = await grenzMessen();
  for (const g of grenzmessung) {
    if (!g.meldung) zaehler.meldung++;
    if (g.ms > GRENZ_ZEIT_MS) zaehler.haenger++;
  }
  const spitzenspeicherMb = Math.round(process.resourceUsage().maxRSS / 1024);
  if (spitzenspeicherMb > GRENZ_SPEICHER_MB) gruende.push(`Spitzenspeicher ${spitzenspeicherMb} MB über ${GRENZ_SPEICHER_MB} MB`);

  const commit = git(['rev-parse', '--short', 'HEAD']) || 'unbekannt';
  const sauber = git(['status', '--porcelain']) === '';
  if (!sauber) gruende.push('ungespeicherte Änderungen im Arbeitsstand (Messung nach Zählweise ungültig)');
  if (faelle < PFLICHT_FAELLE) gruende.push(`Fallzahl ${faelle} unter der Mindestzahl ${PFLICHT_FAELLE}`);
  for (const k of ZAEHLER) if (zaehler[k] > 0) gruende.push(`Zähler ${k}: ${zaehler[k]}`);
  if (orakel > 0) gruende.push(`Orakelverletzungen ohne Zuordnung: ${orakel}`);
  return {
    messung: 'Q9 ohne Browser',
    commit,
    sauber,
    datum: new Date().toISOString(),
    seed,
    faelle,
    mindestFaelle: PFLICHT_FAELLE,
    ziele: zielAus,
    regression,
    klassen,
    netz: { art: "statisch: Quellen ohne Netz-Schnittstelle, CSP mit connect-src 'none'", befunde: netzBefunde, browser: 'nicht gemessen (P18)' },
    grenzmessung,
    spitzenspeicherMb,
    zaehler,
    orakel,
    erfuellt: gruende.length === 0,
    gruende,
  };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const m = await messe({
    ...(arg('seed') ? { seed: Number(arg('seed')) } : {}),
    ...(arg('faelle') ? { faelle: Number(arg('faelle')) } : {}),
    ...(arg('ziele') ? { ziele: arg('ziele')!.split(',') as Eingabeart[] } : {}),
    klassen: !process.argv.includes('--ohne-klassen'),
  });
  const datei = arg('ausgabe') ?? join(REPO, 'docs', 'entwicklung', 'messung', `q9-${m.commit}.json`);
  mkdirSync(dirname(datei), { recursive: true });
  writeFileSync(datei, `${JSON.stringify(m, null, 2)}\n`);
  console.log(`Q9 ohne Browser, Commit ${m.commit}${m.sauber ? '' : ' (mit ungespeicherten Änderungen)'}, Seed ${m.seed}, ${m.faelle} Fälle je Ziel`);
  console.log(ZAEHLER.map((k) => `${k} ${m.zaehler[k]}`).join(', '));
  for (const g of m.grenzmessung) console.log(`Grenze ${g.art}: ${(g.dateiBytes / 1048576).toFixed(0)} MB, Meldung ${g.meldung ? 'ja' : 'nein'} nach ${g.ms} ms`);
  console.log(`Spitzenspeicher ${m.spitzenspeicherMb} MB; ${m.erfuellt ? 'erfüllt' : `nicht erfüllt: ${m.gruende.join('; ')}`}`);
  console.log(`Datei: ${datei}`);
  // Ungespeicherte Änderungen allein lassen den Befehl nicht scheitern (Entwicklung); jeder Zähler über 0 schon
  const hart = m.gruende.filter((g) => !g.startsWith('ungespeicherte'));
  process.exit(hart.length ? 1 : 0);
}
