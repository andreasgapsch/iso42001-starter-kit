// Lauf eines Ziels unter Aufsicht: Die Fälle laufen in einem Arbeiter-Prozess. Ein Wächter im Hauptthread beendet ihn, wenn ein
// Fall das Zeitlimit reisst (Hänger, auch Endlosschleife im synchronen Code) oder der Prozess am Speicher stirbt, vermerkt den Fall und
// startet einen neuen Arbeiter beim nächsten. Die Gesamtgrenze für den Speicher setzt scripts/werkzeug/begrenzt.sh.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FEHLERKLASSEN, type Fehlerklasse } from './typen.ts';
import { basename } from 'node:path';
import { erzeugeFall, fallAusDatei, fehlerText, fallHash, fallListe, zeitlimitVon, type FallErgebnis } from './kern.ts';
import type { ZielName } from './typen.ts';

export interface LaufOptionen {
  art: ZielName;
  seed: number;
  /** Fälle 1 bis faelle; mit `nur` genau ein Fall */
  faelle: number;
  nur?: number;
  /** Regressionsmodus: eine feste Datei durch das Ziel schicken (Fall 1) */
  datei?: string;
  zeitlimitMs?: number;
  /** Heap-Grenze je Arbeiter in MB */
  speicherMb?: number;
  /** Fälle mit Fehler als Datei hier ablegen (tests/fixtures/fuzz) */
  fundeOrdner?: string;
}

export interface ZielErgebnis {
  art: ZielName;
  seed: number;
  faelle: number;
  angenommen: number;
  abgelehnt: number;
  fehler: number;
  haenger: number;
  zaehler: Record<string, number>;
  /** Fehler und Hänger je Klasse für die Q9-Zähler (Skript, Absturz, Datenverlust, fehlende Meldung, Hänger) */
  klassen: Record<Fehlerklasse, number>;
  ms: number;
  hashes: string[];
  /** Status je Fall (Nummer, Name, Status), für Kontrollfälle und Auswertung */
  liste: { nummer: number; name: string; status: FallErgebnis['status'] }[];
  fehlerFaelle: (FallErgebnis & { hash: string; text: string; datei?: string })[];
}

const ARBEITER = fileURLToPath(new URL('./arbeiter.mts', import.meta.url));

function legeFundAb(ordner: string, art: ZielName, seed: number, nummer: number): string | undefined {
  const f = erzeugeFall(art, seed, nummer);
  const bytes = typeof f.daten === 'string' ? Buffer.from(f.daten, 'utf8') : Buffer.from(f.daten);
  // Riesige Fälle (Grenzprüfungen mit Füllmaterial) nicht ablegen: Der Befehl erzeugt sie jederzeit neu
  if (bytes.length > 2 * 1024 * 1024) return undefined;
  mkdirSync(ordner, { recursive: true });
  const name = `${art}-${seed}-${nummer}.${f.endung}`;
  writeFileSync(join(ordner, name), bytes);
  if (f.zusatz !== undefined && f.zusatz.length < 2 * 1024 * 1024) writeFileSync(join(ordner, `${art}-${seed}-${nummer}.zusatz.json`), f.zusatz);
  return join(ordner, name);
}

export async function laufeZiel(o: LaufOptionen): Promise<ZielErgebnis> {
  const zeitlimitMs = o.zeitlimitMs ?? zeitlimitVon(o.art);
  const von = o.datei !== undefined ? 1 : (o.nur ?? 1);
  const bis = o.datei !== undefined ? 1 : (o.nur ?? o.faelle);
  // Fall der Erzeugung oder der Datei (für Namen, Prüfsumme und Fundstücke bei Hänger und Absturz)
  const fallVon = (nummer: number) => (o.datei !== undefined ? fallAusDatei(o.art, o.datei) : erzeugeFall(o.art, o.seed, nummer));
  const t0 = performance.now();
  const ergebnisse: FallErgebnis[] = [];
  let naechster = von;

  while (naechster <= bis) {
    const ab = naechster;
    await new Promise<void>((fertig) => {
      const w = fork(ARBEITER, [JSON.stringify({ art: o.art, seed: o.seed, von: ab, bis, zeitlimitMs, ...(o.datei !== undefined ? { datei: o.datei } : {}) })], {
        execArgv: ['--import', 'tsx', `--max-old-space-size=${o.speicherMb ?? 2048}`],
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
      let aktuell = -1;
      let seit = 0;
      let bereit = false;
      let aus = false;
      const beenden = (): void => {
        if (aus) return;
        aus = true;
        clearInterval(wache);
        w.kill('SIGKILL');
        fertig();
      };
      const fehlschlag = (status: 'haenger' | 'fehler', meldung: string): void => {
        if (aktuell >= 0) {
          const f = fallVon(aktuell);
          ergebnisse.push({ nummer: aktuell, name: f.name, status, klasse: status === 'haenger' ? 'haenger' : 'absturz', meldung, ms: Math.round(performance.now() - seit) });
          naechster = aktuell + 1;
        } else {
          // Arbeiter ist schon beim Start gescheitert: nicht endlos neu starten
          ergebnisse.push({ nummer: ab, name: '?', status: 'fehler', klasse: 'absturz', meldung: `Arbeiter nicht gestartet: ${meldung}`, ms: 0 });
          naechster = ab + 1;
        }
      };
      // Wächter: prüft alle 100 ms, ob der laufende Fall über dem Limit liegt
      const wache = setInterval(() => {
        if (bereit && aktuell >= 0 && performance.now() - seit > zeitlimitMs + 1000) {
          fehlschlag('haenger', `Hänger: Fall läuft länger als ${zeitlimitMs} ms, Arbeiter beendet`);
          beenden();
        }
      }, 100);
      w.on('message', (m: { t: string; i?: number; e?: FallErgebnis }) => {
        if (m.t === 'bereit') bereit = true;
        else if (m.t === 'start') {
          aktuell = m.i!;
          seit = performance.now();
        } else if (m.t === 'ende') {
          ergebnisse.push(m.e!);
          naechster = m.e!.nummer + 1;
          aktuell = -1;
        } else if (m.t === 'fertig') beenden();
      });
      w.on('error', (e: Error) => {
        if (aus) return;
        fehlschlag('fehler', `Absturz des Arbeiters: ${e.message}`);
        beenden();
      });
      w.on('close', (code, signal) => {
        if (aus) return;
        if (naechster <= bis) fehlschlag('fehler', signal === 'SIGABRT' || signal === 'SIGKILL' ? `Speicherabbruch: Arbeiter hat die Speichergrenze überschritten (Signal ${signal})` : `Absturz des Arbeiters (Code ${code}, Signal ${signal})`);
        beenden();
      });
    });
  }

  const erg: ZielErgebnis = { art: o.art, seed: o.seed, faelle: ergebnisse.length, angenommen: 0, abgelehnt: 0, fehler: 0, haenger: 0, zaehler: {}, klassen: Object.fromEntries(FEHLERKLASSEN.map((k) => [k, 0])) as Record<Fehlerklasse, number>, ms: Math.round(performance.now() - t0), hashes: [], liste: [], fehlerFaelle: [] };
  for (const e of ergebnisse.sort((a, b) => a.nummer - b.nummer)) {
    erg[e.status]++;
    for (const [k, v] of Object.entries(e.zaehler ?? {})) erg.zaehler[k] = (erg.zaehler[k] ?? 0) + v;
    const hash = e.hash ?? fallHash(fallVon(e.nummer));
    erg.hashes.push(hash);
    erg.liste.push({ nummer: e.nummer, name: e.name, status: e.status });
    if (e.status === 'fehler' || e.status === 'haenger') {
      erg.klassen[e.klasse ?? 'orakel']++;
      const datei = o.fundeOrdner && o.datei === undefined ? legeFundAb(o.fundeOrdner, o.art, o.seed, e.nummer) : undefined;
      erg.fehlerFaelle.push({ ...e, hash, text: o.datei !== undefined ? `${o.art} Datei ${o.datei} ${e.status}: ${e.meldung ?? ''} [Wiederholen: npm run fuzz -- --ziel ${o.art} --datei ${o.datei}]` : fehlerText(o.art, o.seed, e), ...(datei ? { datei } : {}) });
    }
  }
  return erg;
}

export { fallListe };
