// Gemeinsame Typen und Hilfsfunktionen der Prüfskripte (Qualitätstore G4 bis G8, G14, G15, G18).
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';

export type Schwere = 'fehler' | 'warnung';

export interface Befund {
  tor: string;
  datei: string;
  zeile?: number;
  meldung: string;
  schwere: Schwere;
}

export interface Optionen {
  /** Lokale Tore zuschalten (G6 Urheberrecht, G14 Prüfsummen). */
  lokal?: boolean;
}

/** Wurzel des Repos (zwei Ebenen über scripts/pruefen/). */
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function quellenDir(): string {
  return process.env.QUELLEN_DIR ?? join(homedir(), 'work', 'iso42001-quellen');
}

/** Pfad relativ zum Repo mit Schrägstrichen, für Meldungen und Ausnahmelisten. */
export function relativ(pfad: string, basis: string = REPO): string {
  return relative(basis, pfad).split(sep).join('/');
}

/** Listet alle Dateien unter `ordner` rekursiv; fehlende Ordner ergeben eine leere Liste. */
export function dateienUnter(ordner: string, filter?: (pfad: string) => boolean): string[] {
  if (!existsSync(ordner)) return [];
  const ergebnis: string[] = [];
  const stapel = [ordner];
  while (stapel.length > 0) {
    const akt = stapel.pop()!;
    for (const eintrag of readdirSync(akt, { withFileTypes: true })) {
      if (eintrag.name === 'node_modules' || eintrag.name === '.git') continue;
      const pfad = join(akt, eintrag.name);
      if (eintrag.isDirectory()) stapel.push(pfad);
      else if (eintrag.isFile() && (!filter || filter(pfad))) ergebnis.push(pfad);
    }
  }
  return ergebnis.sort();
}

export function istOrdner(pfad: string): boolean {
  return existsSync(pfad) && statSync(pfad).isDirectory();
}

export const TEXT_ENDUNGEN = ['.yaml', '.yml', '.json', '.md', '.txt', '.html', '.htm', '.csv', '.xml', '.svg'];

export function hatEndung(pfad: string, endungen: string[]): boolean {
  const klein = pfad.toLowerCase();
  return endungen.some((e) => klein.endsWith(e));
}

/** Einfacher Musterabgleich für Ausnahmelisten: `*` passt auf alles ausser `/`, `**` auf alles. */
export function passtMuster(pfad: string, muster: string): boolean {
  const re = muster
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${re}$`).test(pfad) || pfad.startsWith(muster.endsWith('/') ? muster : `${muster}/`);
}

/** Liest eine Liste (eine Angabe pro Zeile, `#` leitet Kommentare ein). */
export function leseListe(text: string): string[] {
  return text
    .split('\n')
    .map((z) => z.replace(/(^|\s)#.*$/, '').trim())
    .filter((z) => z !== '');
}

/** Entfernt Tags und dekodiert die häufigsten Entitäten (für HTML und Office-XML). */
export function ohneTags(xml: string): string {
  return xml
    .replace(/<w:tab\/>|<w:br\/>|<\/w:p>|<\/a:p>|<\/si>|<\/c>|<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/h\d>|<\/tr>/gi, '\n')
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

/** Extrahiert lesbaren Text aus DOCX/XLSX/PPTX (alle XML-Teile) oder HTML. */
export function textAusDokument(name: string, inhalt: Uint8Array): string {
  const klein = name.toLowerCase();
  if (/\.(docx|xlsx|pptx|dotx|xltx)$/.test(klein)) {
    const teile = unzipSync(inhalt);
    const texte: string[] = [];
    for (const [teil, daten] of Object.entries(teile)) {
      if (!/\.xml$/.test(teil) || teil.startsWith('[Content_Types]') || /\/_rels\/|^_rels\//.test(teil)) continue;
      if (/^(word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)|xl\/(sharedStrings|worksheets\/sheet\d+|comments\d*)|ppt\/slides\/slide\d+|docProps\/(core|app))\.xml$/.test(teil)) {
        texte.push(ohneTags(strFromU8(daten)));
      }
    }
    return texte.join('\n');
  }
  const text = strFromU8(inhalt);
  return /\.html?$/.test(klein) ? ohneTags(text) : text;
}

/** Zählt Fehler und Warnungen. */
export function zaehle(befunde: Befund[]): { fehler: number; warnungen: number } {
  return {
    fehler: befunde.filter((b) => b.schwere === 'fehler').length,
    warnungen: befunde.filter((b) => b.schwere === 'warnung').length,
  };
}

export function formatiere(b: Befund): string {
  const ort = b.zeile ? `${b.datei}:${b.zeile}` : b.datei;
  return `  [${b.schwere === 'fehler' ? 'FEHLER ' : 'WARNUNG'}] ${b.tor} ${ort}  ${b.meldung}`;
}

/** Startet ein Prüfskript als eigenes Programm, wenn es direkt aufgerufen wird. */
export async function alsHauptprogramm(url: string, pruefe: (o: Optionen) => Promise<Befund[]>): Promise<void> {
  if (!process.argv[1] || resolve(process.argv[1]) !== fileURLToPath(url)) return;
  const befunde = await pruefe({ lokal: process.argv.includes('--lokal') });
  for (const b of befunde) console.log(formatiere(b));
  const z = zaehle(befunde);
  console.log(`${z.fehler} Fehler, ${z.warnungen} Warnungen`);
  process.exitCode = z.fehler > 0 ? 1 : 0;
}
