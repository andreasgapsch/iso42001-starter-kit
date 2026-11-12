// Tor G14 Prüfsummen: die Rechtstexte- und NIST-PDFs im Kit-Ordner müssen bitgleich mit den Quellen sein
// (SHA-256 gemäss $QUELLEN_DIR/eu-ai-act/SHA256SUMS.txt und $QUELLEN_DIR/nist/SHA256SUMS.txt).
// Läuft mit --lokal oder wenn dist/kit existiert.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { type Befund, type Optionen, REPO, alsHauptprogramm, dateienUnter, istOrdner, quellenDir, relativ } from './gemeinsam.mts';

const TOR = 'G14';

/** Liest eine SHA256SUMS-Datei (Format von sha256sum, mit oder ohne «*» vor dem Namen). */
export function leseSummen(text: string): Map<string, string> {
  const summen = new Map<string, string>();
  for (const zeile of text.split('\n')) {
    const m = /^([0-9a-f]{64})\s+\*?(.+?)\s*$/i.exec(zeile);
    if (m) summen.set(basename(m[2]!), m[1]!.toLowerCase());
  }
  return summen;
}

export function sha256(datei: string): string {
  return createHash('sha256').update(readFileSync(datei)).digest('hex');
}

/** Quellordner unter $QUELLEN_DIR mit eigener Prüfsummenliste. */
export const SUMMEN_ORDNER = ['eu-ai-act', 'nist'] as const;

/** Rechtstexte erkennt man am Namen (AI Act, Änderungsverordnung, NIST-Dokumente) oder an der Liste. */
export function istRechtstext(name: string, summen: Map<string, string>): boolean {
  return summen.has(name) || /^(EU-AI-Act|Aenderungsverordnung|NIST)/i.test(name);
}

/** Vergleicht alle Rechtstexte-PDFs unter `kitOrdner` mit einer oder mehreren Prüfsummenlisten. */
export function pruefeSummen(kitOrdner: string, summenDatei: string | string[], repo: string = REPO): Befund[] {
  const befunde: Befund[] = [];
  const dateien = Array.isArray(summenDatei) ? summenDatei : [summenDatei];
  const summen = new Map<string, string>();
  for (const d of dateien) {
    if (!existsSync(d)) {
      befunde.push({ tor: TOR, datei: d, meldung: 'Prüfsummenliste nicht gefunden (QUELLEN_DIR)', schwere: 'warnung' });
      continue;
    }
    for (const [name, hash] of leseSummen(readFileSync(d, 'utf8'))) summen.set(name, hash);
  }
  if (summen.size === 0) return befunde;
  const pdfs = dateienUnter(kitOrdner, (p) => p.toLowerCase().endsWith('.pdf')).filter((p) => istRechtstext(basename(p), summen));
  if (pdfs.length === 0) {
    befunde.push({ tor: TOR, datei: relativ(kitOrdner, repo), meldung: 'keine Rechtstexte-PDFs im Kit gefunden', schwere: 'warnung' });
  }
  for (const pdf of pdfs) {
    const name = basename(pdf);
    const soll = summen.get(name);
    const rel = relativ(pdf, repo);
    if (!soll) {
      befunde.push({ tor: TOR, datei: rel, meldung: `${name} steht nicht in der Prüfsummenliste`, schwere: 'fehler' });
      continue;
    }
    const ist = sha256(pdf);
    if (ist !== soll) befunde.push({ tor: TOR, datei: rel, meldung: `SHA-256 weicht ab (ist ${ist.slice(0, 12)}…, soll ${soll.slice(0, 12)}…)`, schwere: 'fehler' });
  }
  return befunde;
}

export async function pruefe(o: Optionen = {}): Promise<Befund[]> {
  const kit = join(REPO, 'dist', 'kit');
  if (!istOrdner(kit)) {
    return o.lokal ? [{ tor: TOR, datei: 'dist/kit', meldung: 'Kit-Ordner fehlt (erst bauen): Prüfsummen übersprungen', schwere: 'warnung' }] : [];
  }
  return pruefeSummen(kit, SUMMEN_ORDNER.map((o) => join(quellenDir(), o, 'SHA256SUMS.txt')));
}

await alsHauptprogramm(import.meta.url, (o) => pruefe({ ...o, lokal: true }));
