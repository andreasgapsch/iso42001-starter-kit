// Tor G18 NIST-Zitate (nur lokal, mit --lokal): prüft die wörtlichen Auszüge aus NIST AI 100-1 und NIST AI 600-1
// (src/nist-rmf/original-100-1.yaml, original-600-1.yaml, Felder zitat, titel_zitat, abschnitt_titel_zitat) Wort für Wort
// gegen den Text der PDFs in $QUELLEN_DIR/nist (pdftotext -layout, Poppler).
//
// Normalisiert werden nur Darstellungsunterschiede: Ligaturen (NFKC), typografische Anführungszeichen, Silbentrennung und
// Bindestriche innerhalb von Wörtern (am Zeilenende im PDF nicht von Trennstrichen zu unterscheiden), Zeilenumbrüche und
// Leerraum. Wörter, Reihenfolge und übrige Satzzeichen (auch Halbgeviertstriche) müssen übereinstimmen. Im PDF übersprungen
// werden nur reine Zahlenfolgen (Fussnotenzeichen, Seitenzahlen, angeschnittene Massnahmen-IDs der Nachbarspalte).
//
// Tabellenspalten liest das Skript getrennt (Ausschnitt mit pdftotext -x/-W), damit die Spalten nicht ineinanderlaufen:
//   AI 100-1 Tabellen 1 bis 4: Kategorien links (x < 200 pt), Subkategorien rechts (x >= 200 pt)
//   AI 600-1 Abschnitt 3: Spalte «Suggested Action» (x 80 bis 428 pt)
// Ein Zitat läuft nur mit Angabe bis_seite über einen Seitenumbruch (Anfang auf seite, Rest am Anfang von bis_seite).
//
// Aufruf: npx tsx scripts/pruefen/nist-zitate.mts [--lokal]
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { type Befund, type Optionen, REPO, alsHauptprogramm, quellenDir } from './gemeinsam.mts';

const TOR = 'G18';

export const DATEIEN = { 'ai-100-1': 'src/nist-rmf/original-100-1.yaml', 'ai-600-1': 'src/nist-rmf/original-600-1.yaml' } as const;
export type NistDok = keyof typeof DATEIEN;

/** Spaltenausschnitt in Punkten (x, Breite); ohne Angabe ganze Seite. */
export type Bereich = 'voll' | 'links' | 'rechts' | 'mitte';
const AUSSCHNITT: Record<Bereich, [number, number] | null> = { voll: null, links: [0, 200], rechts: [200, 420], mitte: [80, 348] };

/** Zeilenende in der Zeichenfolge einer PDF-Seite (beim Vergleich übergangen, markiert den Seitenumbruch). */
export const ZEILENENDE = '\u00B6';

/** Wörter und Satzzeichen eines Textes nach der Normalisierung (siehe Kopf); mitZeilen: Zeilenenden als ZEILENENDE. */
export function zeichenfolge(text: string, mitZeilen = false): string[] {
  const t = text
    .normalize('NFKC')
    .replace(/\u00AD/g, '')
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, '$1$2')
    .replace(/(\p{L})-(?=\p{L})/gu, '$1');
  return (mitZeilen ? t.replace(/\n/g, ` ${ZEILENENDE} `) : t).match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) ?? [];
}

/** Im PDF übergehbar: Zeilenenden und reine Zahlen (Fussnotenzeichen, Seitenzahlen, Reste von IDs). */
function uebergehbar(t: string): boolean {
  return t === ZEILENENDE || /^\d+$/.test(t);
}

/** Längster Anfang von `zitat`, der ab Position `start` in `seite` steht; ende = Index nach dem letzten Treffer. */
function anfangAb(zitat: string[], seite: string[], start: number): { laenge: number; ende: number } {
  let q = 0;
  let p = start;
  let ende = start;
  while (q < zitat.length && p < seite.length) {
    if (seite[p] === zitat[q]) {
      q++;
      p++;
      ende = p;
    } else if (q > 0 && uebergehbar(seite[p]!)) p++;
    else break;
  }
  return { laenge: q, ende };
}

/** Längster Anfang des Zitats, der irgendwo auf der Seite steht. */
export function laengsterAnfang(zitat: string[], seite: string[]): { laenge: number; ende: number } {
  let best = { laenge: 0, ende: 0 };
  for (let i = 0; i < seite.length; i++) {
    if (seite[i] !== zitat[0]) continue;
    const a = anfangAb(zitat, seite, i);
    if (a.laenge > best.laenge) best = a;
    if (best.laenge === zitat.length) break;
  }
  return best;
}

/** Steht die ganze Folge zusammenhängend auf der Seite? */
export function enthaelt(seite: string[], zitat: string[]): boolean {
  return zitat.length > 0 && laengsterAnfang(zitat, seite).laenge === zitat.length;
}

/** Endet die Zeile nach Position `ende` (nur Zahlen bis zum Zeilenende, oder Seitenende)? */
function zeileEndetBei(seite: string[], ende: number): boolean {
  for (let i = ende; i < seite.length; i++) {
    if (seite[i] === ZEILENENDE) return true;
    if (!uebergehbar(seite[i]!)) return false;
  }
  return true;
}

/** Ein Zitat über einen Seitenumbruch muss auf der Folgeseite in den ersten Zeichen weiterlaufen (Kopfzeile, Tabellenkopf). */
export const FOLGESEITE_START = 60;

/**
 * Prüft ein Zitat gegen eine Seite. Mit `folgeseite` (Zitat mit bis_seite) darf es über den Seitenumbruch laufen: der
 * längste Anfang steht auf `seite` und endet mit einer Zeile, der Rest beginnt auf der Folgeseite in den ersten
 * FOLGESEITE_START Zeichen. Liefert null bei Erfolg, sonst die Stelle der ersten Abweichung.
 */
export function vergleiche(zitat: string, seite: string[], folgeseite?: string[]): string | null {
  const z = zeichenfolge(zitat);
  if (!z.length) return 'leeres Zitat';
  if (enthaelt(seite, z)) return null;
  const anfang = laengsterAnfang(z, seite);
  let rest = 0;
  if (folgeseite && anfang.laenge > 0 && zeileEndetBei(seite, anfang.ende)) {
    const r = z.slice(anfang.laenge);
    for (let i = 0, n = 0; i < folgeseite.length && n < FOLGESEITE_START; i++) {
      if (folgeseite[i] === ZEILENENDE) continue;
      n++;
      if (folgeseite[i] !== r[0]) continue;
      const a = anfangAb(r, folgeseite, i).laenge;
      if (a === r.length) return null;
      rest = Math.max(rest, a);
    }
  }
  const pos = anfang.laenge + rest;
  return `weicht ab nach ${pos} von ${z.length} Zeichen: «${z.slice(Math.max(0, pos - 4), pos).join(' ')} [${z[pos] ?? ''}]»`;
}

interface Eintrag {
  id: string;
  seite: number;
  /** Seite der Überschrift, wenn sie nicht auf der Seite des Zitats steht */
  titel_seite?: number;
  /** Folgeseite, wenn das Zitat über den Seitenumbruch läuft */
  bis_seite?: number;
  zitat?: string;
  titel_zitat?: string;
  abschnitt_titel_zitat?: string;
  abschnitt?: string;
}
type Datei = { quelle: { datei: string }; [liste: string]: unknown };

export interface Pruefling {
  dok: NistDok;
  ort: string;
  feld: string;
  text: string;
  seite: number;
  bis_seite?: number;
  bereich: Bereich;
}

/** Alle Zitate der beiden Dateien mit Seite und Spaltenausschnitt. */
export function prueflinge(repo: string = REPO): Pruefling[] {
  const ergebnis: Pruefling[] = [];
  const seiten = JSON.parse(readFileSync(join(repo, 'src', 'nist-rmf', 'seiten.json'), 'utf8')) as Record<string, Record<string, number>>;
  for (const dok of Object.keys(DATEIEN) as NistDok[]) {
    const d = parse(readFileSync(join(repo, DATEIEN[dok]), 'utf8')) as Datei;
    for (const [liste, wert] of Object.entries(d)) {
      if (!Array.isArray(wert)) continue;
      for (const e of wert as Eintrag[]) {
        const bereich: Bereich = dok === 'ai-100-1' ? (liste === 'subkategorien' ? 'rechts' : liste === 'kategorien' ? 'links' : 'voll') : liste === 'massnahmen' ? 'mitte' : 'voll';
        const ort = `${dok} ${liste} ${e.id}`;
        if (e.zitat) ergebnis.push({ dok, ort, feld: 'zitat', text: e.zitat, seite: e.seite, ...(e.bis_seite ? { bis_seite: e.bis_seite } : {}), bereich });
        if (e.titel_zitat) ergebnis.push({ dok, ort, feld: 'titel_zitat', text: e.titel_zitat, seite: e.titel_seite ?? e.seite, bereich });
        if (e.abschnitt_titel_zitat) {
          const s = seiten[dok]?.[e.id];
          ergebnis.push({ dok, ort, feld: 'abschnitt_titel_zitat', text: e.abschnitt_titel_zitat, seite: s ?? e.seite, bereich: 'voll' });
        }
      }
    }
  }
  return ergebnis;
}

export function pdfDatei(dok: NistDok, repo: string = REPO): string {
  const d = parse(readFileSync(join(repo, DATEIEN[dok]), 'utf8')) as Datei;
  return join(quellenDir(), 'nist', d.quelle.datei);
}

const cache = new Map<string, string[]>();
/** Text einer PDF-Seite (oder eines Spaltenausschnitts) als Zeichenfolge. */
export function seitenFolge(pdf: string, seite: number, bereich: Bereich): string[] {
  const schluessel = `${pdf}|${seite}|${bereich}`;
  const vorhanden = cache.get(schluessel);
  if (vorhanden) return vorhanden;
  const a = AUSSCHNITT[bereich];
  const args = ['-q', '-layout', '-enc', 'UTF-8', '-f', String(seite), '-l', String(seite), ...(a ? ['-x', String(a[0]), '-y', '0', '-W', String(a[1]), '-H', '1000'] : []), pdf, '-'];
  let text = '';
  try {
    text = execFileSync('pdftotext', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch {
    text = '';
  }
  // Spalte «Suggested Action»: am Zeilenanfang angeschnittene Reste der Massnahmen-ID (z. B. «003» oder «3») entfernen
  if (bereich === 'mitte') text = text.replace(/^[ \t]*\d{1,3}(?=[ \t]|$)/gm, '');
  const f = zeichenfolge(text, true);
  cache.set(schluessel, f);
  return f;
}

export function pruefeAlle(repo: string = REPO): Befund[] {
  const befunde: Befund[] = [];
  for (const dok of Object.keys(DATEIEN) as NistDok[]) {
    const pdf = pdfDatei(dok, repo);
    if (!existsSync(pdf)) {
      befunde.push({ tor: TOR, datei: DATEIEN[dok], meldung: `PDF nicht gefunden: ${pdf} (QUELLEN_DIR)`, schwere: 'fehler' });
    }
  }
  if (befunde.length) return befunde;
  for (const p of prueflinge(repo)) {
    const pdf = pdfDatei(p.dok, repo);
    const fehler = vergleiche(p.text, seitenFolge(pdf, p.seite, p.bereich), p.bis_seite ? seitenFolge(pdf, p.bis_seite, p.bereich) : undefined);
    if (fehler) befunde.push({ tor: TOR, datei: DATEIEN[p.dok], meldung: `${p.ort} ${p.feld} (S. ${p.seite}): ${fehler}`, schwere: 'fehler' });
  }
  return befunde;
}

export async function pruefe(o: Optionen = {}): Promise<Befund[]> {
  if (!o.lokal) return [];
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
  } catch {
    return [{ tor: TOR, datei: '-', meldung: 'pdftotext (Poppler) nicht gefunden', schwere: 'fehler' }];
  }
  return pruefeAlle();
}

await alsHauptprogramm(import.meta.url, (o) => pruefe({ ...o, lokal: true }));
