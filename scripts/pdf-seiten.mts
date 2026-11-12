// Spike S8: erzeugt aus den konsolidierten AI-Act-PDFs (DE/EN) die Zuordnung
// Artikel/Anhang zu PDF-Seite und schreibt sie nach src/ai-act/artikel-seiten.json.
// Die JSON enthält nur Seitenzahlen, keinen Gesetzestext.
//
// Aufruf: npx tsx scripts/pdf-seiten.mts
// Quellordner: Umgebungsvariable QUELLEN_DIR, Standard ~/work/iso42001-quellen
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Sprache = 'de' | 'en';

export const STAND = '2026-07-27';
export const PDF_NAMEN: Record<Sprache, string> = {
  de: `EU-AI-Act_2024-1689_konsolidiert-${STAND}_DE.pdf`,
  en: `EU-AI-Act_2024-1689_konsolidiert-${STAND}_EN.pdf`,
};

/** Durch Änderungsverordnungen eingefügte Artikel (Stand 27.07.2026). */
export const EINGEFUEGTE_ARTIKEL = ['4a', '60a', '75a', '75b', '75c', '75d'] as const;
export const ANZAHL_ARTIKEL = 113;
export const ANHAENGE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'] as const;

const WORT: Record<Sprache, { artikel: string; anhang: string }> = {
  de: { artikel: 'Artikel', anhang: 'ANHANG' },
  en: { artikel: 'Article', anhang: 'ANNEX' },
};

/** Schlüssel in der erwarteten Reihenfolge: art-1 … art-113 (mit Einfügungen), dann anhang-i … anhang-xiv. */
export function erwarteteSchluessel(): string[] {
  const schluessel: string[] = [];
  for (let n = 1; n <= ANZAHL_ARTIKEL; n++) {
    schluessel.push(`art-${n}`);
    for (const e of EINGEFUEGTE_ARTIKEL) if (e.replace(/[a-z]$/, '') === String(n)) schluessel.push(`art-${e}`);
  }
  for (const a of ANHAENGE) schluessel.push(`anhang-${a.toLowerCase()}`);
  return schluessel;
}

/** Zeilen ohne Inhalt für die Überschriftenerkennung: Leerzeilen, Seitenkopf, Änderungsmarken. */
function istRauschen(zeile: string): boolean {
  const t = zeile.trim();
  return t === '' || /^0?\d{4}R\d{4}\s/.test(t) || /^▼/.test(t) || /^►/.test(t);
}

interface Kandidat {
  schluessel: string;
  seite: number;
}

/**
 * Findet Überschriften in den Seitentexten (Index 0 = PDF-Seite 1).
 * Überschrift = Zeile, die nur aus «Artikel N» bzw. «Article N» (oder «ANHANG/ANNEX römisch»,
 * in Grossbuchstaben) besteht, und deren nächste Inhaltszeile mit einem Grossbuchstaben beginnt
 * (Titel). Verweise im Fliesstext stehen nie allein auf einer Zeile oder werden kleingeschrieben
 * fortgesetzt. Zusätzlich wird die erwartete Reihenfolge erzwungen: ein Treffer zählt nur, wenn er
 * der nächste erwartete Schlüssel ist.
 */
export function findeUeberschriften(seiten: string[], sprache: Sprache): {
  seiten: Record<string, number>;
  fehlend: string[];
  unerwartet: Kandidat[];
} {
  const w = WORT[sprache];
  const reArtikel = new RegExp(`^\\s*${w.artikel}\\s+(\\d{1,3}[a-z]?)\\s*$`);
  const reAnhang = new RegExp(`^\\s*${w.anhang}\\s+([IVX]+)\\s*$`);

  const zeilen: { text: string; seite: number }[] = [];
  seiten.forEach((text, i) => {
    for (const z of text.split('\n')) zeilen.push({ text: z, seite: i + 1 });
  });

  const kandidaten: Kandidat[] = [];
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i]!;
    const mArt = reArtikel.exec(z.text);
    const mAnh = mArt ? null : reAnhang.exec(z.text);
    if (!mArt && !mAnh) continue;
    // nächste Inhaltszeile (auch auf der Folgeseite) muss ein Titel sein
    let j = i + 1;
    while (j < zeilen.length && istRauschen(zeilen[j]!.text)) j++;
    const titel = zeilen[j]?.text.trim() ?? '';
    if (!/^[A-ZÄÖÜ]/.test(titel)) continue;
    const schluessel = mArt ? `art-${mArt[1]}` : `anhang-${mAnh![1]!.toLowerCase()}`;
    kandidaten.push({ schluessel, seite: z.seite });
  }

  const erwartet = erwarteteSchluessel();
  const ergebnis: Record<string, number> = {};
  const unerwartet: Kandidat[] = [];
  let zeiger = 0;
  for (const k of kandidaten) {
    if (zeiger < erwartet.length && k.schluessel === erwartet[zeiger]) {
      ergebnis[k.schluessel] = k.seite;
      zeiger++;
    } else if (!erwartet.includes(k.schluessel)) {
      unerwartet.push(k);
    }
  }
  return { seiten: ergebnis, fehlend: erwartet.slice(zeiger), unerwartet };
}

function seitenzahl(pdf: string): number {
  const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
  const m = /^Pages:\s+(\d+)/m.exec(info);
  if (!m) throw new Error(`Seitenzahl nicht lesbar: ${pdf}`);
  return Number(m[1]);
}

function leseSeiten(pdf: string): string[] {
  const n = seitenzahl(pdf);
  const seiten: string[] = [];
  for (let p = 1; p <= n; p++) {
    seiten.push(execFileSync('pdftotext', ['-f', String(p), '-l', String(p), '-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
  }
  return seiten;
}

export function quellenDir(): string {
  return process.env.QUELLEN_DIR ?? join(homedir(), 'work', 'iso42001-quellen');
}

async function main(): Promise<void> {
  const ordner = join(quellenDir(), 'eu-ai-act');
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const ziel = join(repo, 'src', 'ai-act', 'artikel-seiten.json');

  const ausgabe: Record<string, unknown> = { stand: STAND, quelle: { ...PDF_NAMEN } };
  const seitenzahlen: Record<string, number> = {};
  let fehler = false;
  for (const sprache of ['de', 'en'] as const) {
    const pdf = join(ordner, PDF_NAMEN[sprache]);
    if (!existsSync(pdf)) throw new Error(`PDF fehlt: ${pdf}`);
    const seiten = leseSeiten(pdf);
    seitenzahlen[sprache] = seiten.length;
    const r = findeUeberschriften(seiten, sprache);
    const gefunden = Object.keys(r.seiten).length;
    console.log(`${sprache.toUpperCase()}: ${gefunden} von ${erwarteteSchluessel().length} Überschriften gefunden (${seiten.length} Seiten)`);
    for (const u of r.unerwartet) console.warn(`  Warnung: unerwartete Überschrift ${u.schluessel} auf Seite ${u.seite}`);
    if (r.fehlend.length > 0) {
      fehler = true;
      console.error(`  Fehler: nicht gefunden: ${r.fehlend.join(', ')}`);
    }
    ausgabe[sprache] = r.seiten;
  }
  ausgabe.seitenzahl = seitenzahlen;
  if (fehler) {
    console.error('Abbruch: Zuordnung unvollständig, JSON wird nicht geschrieben.');
    process.exit(1);
  }
  mkdirSync(dirname(ziel), { recursive: true });
  writeFileSync(ziel, JSON.stringify(ausgabe, null, 2) + '\n', 'utf8');
  console.log(`geschrieben: ${ziel}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
