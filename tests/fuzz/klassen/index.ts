// Alle Mutationsklassen (AF-022) und ihr Lauf. Muss nach V4: Projektdatei, Gestaltungspaket mit SVG, draw.io, Bibliothekssicherung;
// das Normpaket (Fund F1) kommt als Soll-Klasse dazu.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STANDARD_SEED } from '../kern.ts';
import { istRohfehler } from '../ziele/hilfen.ts';
import { klasseVon, OrakelFehler, type Fehlerklasse } from '../typen.ts';
import { Zufall, seedAus } from '../zufall.ts';
import { DRAWIO_KLASSEN } from './drawio.ts';
import { GESTALTUNG_KLASSEN } from './gestaltung.ts';
import { NORMPAKET_KLASSEN } from './normpaket.ts';
import { PROJEKT_KLASSEN } from './projektdatei.ts';
import { SICHERUNG_KLASSEN } from './sicherung.ts';
import type { Klasse, KlassenFall } from './typen.ts';

export const KLASSEN: Klasse[] = [...PROJEKT_KLASSEN, ...GESTALTUNG_KLASSEN, ...DRAWIO_KLASSEN, ...SICHERUNG_KLASSEN, ...NORMPAKET_KLASSEN];

/** Mindestzahl der Varianten je Klasse und Lauf (AF-022) */
export const MIN_VARIANTEN = 50;
/** Zeit bis Urteil je Variante (K-SEC-03) */
export const ZEIT_MS = 5000;

export interface VariantenErgebnis {
  nummer: number;
  name: string;
  status: 'angenommen' | 'abgelehnt' | 'fehler';
  meldung?: string;
  klasse?: Fehlerklasse;
  ms: number;
  ohneSchutz: boolean;
}

export const variante = (k: Klasse, seed: number, nummer: number): KlassenFall => k.variante(new Zufall(seedAus(seed, 'klasse', k.id, nummer)), nummer);

/** Ein Fall durch die Klasse: festes Urteil, Zeitgrenze, Ablehnung nur mit Meldung, Pflichtablehnung */
export async function pruefeFall(k: Klasse, f: KlassenFall, nummer: number): Promise<VariantenErgebnis> {
  const t0 = performance.now();
  const ohneSchutz = (() => {
    try {
      return k.ohneSchutz(f);
    } catch {
      return true;
    }
  })();
  try {
    const u = await k.urteile(f);
    const ms = Math.round(performance.now() - t0);
    if (u.urteil === 'abgelehnt' && !(u.meldung ?? '').trim()) throw new OrakelFehler('Ablehnung ohne Meldung');
    if (f.mussAbgelehnt && u.urteil !== 'abgelehnt') throw new OrakelFehler(`Grenze greift nicht: erwartet Ablehnung, erhalten ${u.urteil}`);
    if (ms > ZEIT_MS) return { nummer, name: f.name, status: 'fehler', klasse: 'haenger', meldung: `Zeit ${ms} ms über ${ZEIT_MS} ms`, ms, ohneSchutz };
    return { nummer, name: f.name, status: u.urteil, ...(u.meldung ? { meldung: u.meldung } : {}), ms, ohneSchutz };
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    const text = e instanceof OrakelFehler ? e.message : `Absturz ${istRohfehler(e) ? 'Rohfehler ' : ''}${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`;
    return { nummer, name: f.name, status: 'fehler', klasse: e instanceof OrakelFehler ? e.klasse : klasseVon(text), meldung: text.slice(0, 300), ms, ohneSchutz };
  }
}

export interface KlassenErgebnis {
  id: string;
  befunde: string[];
  varianten: number;
  fehler: VariantenErgebnis[];
  /** Modellwert der Gegenprobe: Varianten, die nach dem Modell `ohneSchutz` ohne die Behebung den Befund auslösen. Keine Messung gegen den Code; die reale Nachmessung (Behebung zurückgenommen) steht im Bericht. */
  gegenprobe: number;
  regression: VariantenErgebnis;
}

export async function laufeKlasse(k: Klasse, seed = STANDARD_SEED, varianten = MIN_VARIANTEN): Promise<KlassenErgebnis> {
  const fehler: VariantenErgebnis[] = [];
  let gegenprobe = 0;
  for (let i = 1; i <= varianten; i++) {
    const e = await pruefeFall(k, variante(k, seed, i), i);
    if (e.ohneSchutz) gegenprobe++;
    if (e.status === 'fehler') fehler.push(e);
  }
  const regression = await pruefeFall(k, k.ausDatei(new Uint8Array(readFileSync(join(process.cwd(), k.regression)))), 0);
  return { id: k.id, befunde: k.befunde, varianten, fehler, gegenprobe, regression };
}

/** Text einer fehlgeschlagenen Variante mit Wiederholbefehl */
export const klassenFehlerText = (k: Klasse, seed: number, e: VariantenErgebnis): string =>
  `Klasse ${k.id} (${k.befunde.join(', ')}) Variante ${e.nummer} (${e.name}): ${e.meldung ?? e.status} [Seed ${seed}; Wiederholen: npm run fuzz -- --klasse ${k.id} --seed ${seed}]`;
