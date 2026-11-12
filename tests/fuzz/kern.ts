// Kern des Fuzz-Werkzeugs: Fälle erzeugen (rein), Fall ausführen (festes Urteil), Hash und Wiederholbefehl
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { SPEZIFIKATION } from './spezifikation.ts';
import { klasseVon, OrakelFehler, type Fall, type Fehlerklasse, type ZielName } from './typen.ts';
import { fallZufall } from './zufall.ts';
import { ALLE_ZIELE as ZIELE } from './ziele/index.ts';

export const STANDARD_SEED = 77123;
export const PFLICHT_FAELLE = 50;
export const RELEASE_FAELLE = 500;

export type FallStatus = 'angenommen' | 'abgelehnt' | 'fehler' | 'haenger';

export interface FallErgebnis {
  nummer: number;
  name: string;
  status: FallStatus;
  /** Meldung der Ablehnung oder Beschreibung des Fehlers */
  meldung?: string;
  ms: number;
  /** Klasse bei Fehler oder Hänger, für die Zähler der Q9-Abnahme */
  klasse?: Fehlerklasse;
  /** Prüfsumme der Eingabe (Fallliste, Determinismus) */
  hash?: string;
  zaehler?: Record<string, number>;
}

/** Erzeugt Fall Nummer `nummer` des Ziels: hängt nur von Seed, Ziel und Nummer ab */
/** Zeitlimit je Fall aus der Spezifikation (Selbsttest-Ziele: 5 s) */
export const zeitlimitVon = (art: ZielName): number => (art in SPEZIFIKATION ? SPEZIFIKATION[art as keyof typeof SPEZIFIKATION].maxZeitMs : 5000);

export function erzeugeFall(art: ZielName, seed: number, nummer: number): Fall {
  return ZIELE[art].erzeuge(fallZufall(seed, art, nummer), nummer);
}

export function fallHash(f: Fall): string {
  const h = createHash('sha256');
  h.update(f.name).update('\u0000').update(typeof f.daten === 'string' ? Buffer.from(f.daten, 'utf8') : f.daten);
  if (f.zusatz !== undefined) h.update('\u0000').update(f.zusatz);
  return h.digest('hex');
}

/** Fallliste eines Laufs: Nummer, Name, Hash. Gleicher Seed ergibt dieselbe Liste. */
export function fallListe(art: ZielName, seed: number, faelle: number): { nummer: number; name: string; hash: string }[] {
  return Array.from({ length: faelle }, (_, i) => {
    const f = erzeugeFall(art, seed, i + 1);
    return { nummer: i + 1, name: f.name, hash: fallHash(f) };
  });
}

/** Befehl, der genau diesen Fall wiederholt */
export const wiederholBefehl = (art: ZielName, seed: number, nummer: number): string => `npm run fuzz -- --ziel ${art} --seed ${seed} --fall ${nummer}`;

/** Text für jede Fehlermeldung: Seed und Wiederholbefehl gehören dazu (AF-024) */
export function fehlerText(art: ZielName, seed: number, e: Pick<FallErgebnis, 'nummer' | 'name' | 'status' | 'meldung'>): string {
  return `${art} Fall ${e.nummer} (${e.name}) ${e.status}: ${e.meldung ?? ''} [Seed ${seed}; Wiederholen: ${wiederholBefehl(art, seed, e.nummer)}]`;
}

/** Arten, deren Eingabe Bytes sind (ZIP, DOCX, PDF); alle anderen sind Text */
export const BYTE_ARTEN: readonly ZielName[] = ['sicherung', 'word-vorlage', 'norm-pdf'];

/** Fall aus einer Datei (Regressionsmodus): feste Eingabe statt Erzeugung. Die Endung bestimmt nichts, die Art kommt vom Aufrufer. */
export function fallAusDatei(art: ZielName, pfad: string): Fall {
  const bytes = new Uint8Array(readFileSync(pfad));
  const name = basename(pfad);
  return { name, endung: extname(pfad).slice(1) || 'bin', daten: BYTE_ARTEN.includes(art) ? bytes : new TextDecoder().decode(bytes) };
}

/** Fall im selben Prozess ausführen. Das Zeitlimit wird danach geprüft; ein Fall, der nie endet, wird vom Wächter beendet (lauf.ts). */
export async function fuehreAus(art: ZielName, seed: number, nummer: number, zeitlimitMs = zeitlimitVon(art)): Promise<FallErgebnis> {
  return fuehreFallAus(art, () => erzeugeFall(art, seed, nummer), nummer, zeitlimitMs);
}

export async function fuehreFallAus(art: ZielName, quelle: () => Fall, nummer: number, zeitlimitMs = zeitlimitVon(art)): Promise<FallErgebnis> {
  const t0 = performance.now();
  let name = '?';
  let pruefsumme: string | undefined;
  const mit = (): { hash?: string } => (pruefsumme ? { hash: pruefsumme } : {});
  try {
    const f = quelle();
    name = f.name;
    pruefsumme = fallHash(f);
    const u = await ZIELE[art].urteile(f);
    if (f.erwartet !== undefined && !(u.urteil === 'abgelehnt' && (u.meldung ?? '').toLowerCase().includes(f.erwartet.toLowerCase()))) {
      throw new OrakelFehler(`Grenze greift nicht: erwartet Ablehnung «${f.erwartet}», erhalten ${u.urteil}${u.meldung ? ` («${u.meldung.slice(0, 80)}»)` : ''}`);
    }
    const ms = Math.round(performance.now() - t0);
    if (ms > zeitlimitMs) return { nummer, name, status: 'haenger', klasse: 'haenger', meldung: `Zeit ${ms} ms über dem Limit von ${zeitlimitMs} ms (Urteil ${u.urteil})`, ms, ...mit() };
    return { nummer, name, status: u.urteil, ...(u.meldung ? { meldung: u.meldung } : {}), ms, ...mit(), ...(u.zaehler ? { zaehler: u.zaehler } : {}) };
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    const text = e instanceof OrakelFehler ? e.message : `Absturz ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`;
    return { nummer, name, status: 'fehler', klasse: e instanceof OrakelFehler ? e.klasse : klasseVon(text), meldung: text.slice(0, 400), ms, ...mit() };
  }
}
