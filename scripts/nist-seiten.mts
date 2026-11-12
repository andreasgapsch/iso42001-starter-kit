// Erzeugt aus den NIST-PDFs die Zuordnung Kategorie/Subkategorie bzw. GenAI-Risiko zu PDF-Seite und
// schreibt sie nach src/nist-rmf/seiten.json (analog src/ai-act/artikel-seiten.json).
// Die JSON enthält nur Seitenzahlen (PDF-Seite, 1 = erste Seite der Datei), keinen NIST-Text.
//
//   ai-100-1   NIST AI 100-1 (AI RMF 1.0), Tabellen 1 bis 4: Kategorien und Subkategorien
//   playbook   NIST AI RMF Playbook: Abschnitt je Subkategorie
//   ai-600-1   NIST AI 600-1 (GenAI-Profil), Abschnitt 2: die 12 Risiken
//
// Aufruf: npx tsx scripts/nist-seiten.mts
// Quellordner: Umgebungsvariable QUELLEN_DIR, Standard ~/work/iso42001-quellen (Unterordner nist)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const STAND = 'ai-rmf-1.0';
export const PDF_NAMEN = {
  'ai-100-1': 'NIST.AI.100-1_AI-RMF-1.0.pdf',
  playbook: 'NIST_AI-RMF-Playbook.pdf',
  'ai-600-1': 'NIST.AI.600-1_GenAI-Profile.pdf',
} as const;
export type Dokument = keyof typeof PDF_NAMEN;

interface Kern {
  kategorien: { id: string; nist_id: string }[];
  subkategorien: { id: string; nist_id: string }[];
}
interface Risiken {
  risiken: { id: string; abschnitt_600_1: string }[];
}

function kern(): Kern {
  return parse(readFileSync(join(REPO, 'src', 'nist-rmf', 'subkategorien.yaml'), 'utf8')) as Kern;
}
function risiken(): Risiken {
  return parse(readFileSync(join(REPO, 'src', 'nist-rmf', 'genai-risiken.yaml'), 'utf8')) as Risiken;
}

/** Erwartete Schlüssel je Dokument in Katalogreihenfolge. */
export function erwarteteSchluessel(dok: Dokument): string[] {
  if (dok === 'ai-600-1') return risiken().risiken.map((r) => r.id);
  const k = kern();
  if (dok === 'playbook') return k.subkategorien.map((s) => s.id);
  // Kategorie vor ihren Subkategorien, wie in den Tabellen von AI 100-1
  return k.kategorien.flatMap((c) => [c.id, ...k.subkategorien.filter((s) => s.id.startsWith(`${c.id}.`)).map((s) => s.id)]);
}

/** Kit-ID aus der NIST-Bezeichnung («GOVERN 1.1» -> GV-1.1, «MAP 2» -> MP-2). */
export function kitId(funktion: string, nummer: string): string {
  const k = { GOVERN: 'GV', MAP: 'MP', MEASURE: 'MS', MANAGE: 'MG' }[funktion];
  if (!k) throw new Error(`Unbekannte Funktion ${funktion}`);
  return `${k}-${nummer}`;
}

export interface Ergebnis {
  seiten: Record<string, number>;
  fehlend: string[];
}

/**
 * AI 100-1: In den Tabellen 1 bis 4 steht jede Kategorie und Subkategorie genau einmal mit Doppelpunkt
 * («GOVERN 1.1:»). Erster Treffer zählt (Index 0 = PDF-Seite 1).
 */
export function findeKern(seiten: string[], erwartet: string[]): Ergebnis {
  const gefunden: Record<string, number> = {};
  seiten.forEach((text, i) => {
    for (const m of text.matchAll(/\b(GOVERN|MAP|MEASURE|MANAGE) (\d+(?:\.\d+)?):/g)) {
      const id = kitId(m[1]!, m[2]!);
      gefunden[id] ??= i + 1;
    }
  });
  return auswahl(gefunden, erwartet);
}

/**
 * Playbook: Abschnitt je Subkategorie beginnt mit einer Zeile «GOVERN 1.1» am Zeilenanfang.
 * Inhaltsverzeichnis-Seiten (viele Treffer auf einer Seite) werden übersprungen; erster Treffer danach zählt.
 */
export function findePlaybook(seiten: string[], erwartet: string[], tocAb = 10): Ergebnis {
  const gefunden: Record<string, number> = {};
  seiten.forEach((text, i) => {
    const treffer = [...text.matchAll(/^\s*(GOVERN|MAP|MEASURE|MANAGE) (\d+\.\d+)\b/gm)].map((m) => kitId(m[1]!, m[2]!));
    if (new Set(treffer).size >= tocAb) return;
    for (const id of treffer) gefunden[id] ??= i + 1;
  });
  return auswahl(gefunden, erwartet);
}

/**
 * AI 600-1: Risiken stehen als Überschriften «2.1. CBRN …» am Zeilenanfang. Inhaltsverzeichnis-Seiten
 * werden übersprungen; die Abschnitte müssen in aufsteigender Reihenfolge stehen.
 */
export function findeRisiken(seiten: string[], abschnitte: { id: string; abschnitt: string }[], tocAb = 5): Ergebnis {
  const gefunden: Record<string, number> = {};
  const nachAbschnitt = new Map(abschnitte.map((a) => [a.abschnitt, a.id]));
  let zuletzt = 0;
  seiten.forEach((text, i) => {
    const treffer = [...text.matchAll(/^\s*(2\.\d+)\.\s+\p{Lu}/gmu)].map((m) => m[1]!);
    if (new Set(treffer).size >= tocAb) return;
    for (const a of treffer) {
      const id = nachAbschnitt.get(a);
      if (id && gefunden[id] === undefined && i + 1 >= zuletzt) {
        gefunden[id] = i + 1;
        zuletzt = i + 1;
      }
    }
  });
  return auswahl(gefunden, abschnitte.map((a) => a.id));
}

function auswahl(gefunden: Record<string, number>, erwartet: string[]): Ergebnis {
  const seiten: Record<string, number> = {};
  for (const k of erwartet) if (gefunden[k] !== undefined) seiten[k] = gefunden[k]!;
  return { seiten, fehlend: erwartet.filter((k) => seiten[k] === undefined) };
}

function leseSeiten(pdf: string): string[] {
  const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
  const n = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]);
  if (!n) throw new Error(`Seitenzahl nicht lesbar: ${pdf}`);
  const seiten: string[] = [];
  for (let p = 1; p <= n; p++) {
    seiten.push(execFileSync('pdftotext', ['-f', String(p), '-l', String(p), '-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
  }
  return seiten;
}

async function main(): Promise<void> {
  const ordner = join(process.env.QUELLEN_DIR ?? join(homedir(), 'work', 'iso42001-quellen'), 'nist');
  const ziel = join(REPO, 'src', 'nist-rmf', 'seiten.json');
  const ausgabe: Record<string, unknown> = { stand: STAND, quelle: { ...PDF_NAMEN } };
  const seitenzahl: Record<string, number> = {};
  let fehler = false;
  for (const dok of Object.keys(PDF_NAMEN) as Dokument[]) {
    const pdf = join(ordner, PDF_NAMEN[dok]);
    if (!existsSync(pdf)) throw new Error(`PDF fehlt: ${pdf}`);
    const seiten = leseSeiten(pdf);
    seitenzahl[dok] = seiten.length;
    const r =
      dok === 'ai-100-1'
        ? findeKern(seiten, erwarteteSchluessel(dok))
        : dok === 'playbook'
          ? findePlaybook(seiten, erwarteteSchluessel(dok))
          : findeRisiken(seiten, risiken().risiken.map((x) => ({ id: x.id, abschnitt: x.abschnitt_600_1 })));
    console.log(`${dok}: ${Object.keys(r.seiten).length} von ${erwarteteSchluessel(dok).length} gefunden (${seiten.length} Seiten)`);
    if (r.fehlend.length) {
      fehler = true;
      console.error(`  Fehler: nicht gefunden: ${r.fehlend.join(', ')}`);
    }
    ausgabe[dok] = r.seiten;
  }
  ausgabe.seitenzahl = seitenzahl;
  if (fehler) {
    console.error('Abbruch: Zuordnung unvollständig, JSON wird nicht geschrieben.');
    process.exit(1);
  }
  writeFileSync(ziel, JSON.stringify(ausgabe, null, 2) + '\n', 'utf8');
  console.log(`geschrieben: ${ziel}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
