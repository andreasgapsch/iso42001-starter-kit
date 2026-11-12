// Lädt alle Sprachtexte aus den YAML-Dateien (nur Node: Build, Tests, Skripte).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { Texte } from './texte.ts';
import { setzeFakten, type FaktenDatei } from '../kataloge/fakten.ts';
import { ladeFakten } from '../kataloge/fakten-node.ts';

const I18N_DIR = fileURLToPath(new URL('.', import.meta.url));

function* yamlDateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner).sort()) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) yield* yamlDateien(pfad);
    else if (name.endsWith('.yaml')) yield pfad;
  }
}

/**
 * Texte einer Sprache. Faktplatzhalter {{fakt:<id>}} (src/kataloge/fakten.yaml, AF-072) werden eingesetzt; mit
 * `fakten: null` bleiben sie stehen (Tor G40 und Tests lesen die Rohtexte), mit eigener Datei gilt diese.
 */
export function ladeTexte(sprache: 'de' | 'en', basis = I18N_DIR, fakten: FaktenDatei | null = ladeFakten()): Texte {
  const wurzel = join(basis, sprache);
  const ergebnis: Texte = {};
  for (const datei of yamlDateien(wurzel)) {
    const teile = relative(wurzel, datei).replace(/\.yaml$/, '').split(sep);
    let ziel = ergebnis;
    for (const teil of teile.slice(0, -1)) {
      ziel[teil] ??= {};
      if (typeof ziel[teil] !== 'object') throw new Error(`Textbereich ${teil} ist kein Objekt: ${datei}`);
      ziel = ziel[teil] as Texte;
    }
    const letzter = teile[teile.length - 1]!;
    const inhalt = (parse(readFileSync(datei, 'utf8')) ?? {}) as Texte;
    // Datei a.yaml und Ordner a/ dürfen nebeneinander stehen; ihre Schlüssel werden zusammengeführt
    const bestehend = ziel[letzter];
    if (bestehend && typeof bestehend === 'object' && !Array.isArray(bestehend)) {
      for (const [k, v] of Object.entries(inhalt)) {
        if (k in bestehend) throw new Error(`Doppelter Textschlüssel ${letzter}.${k}: ${datei}`);
        (bestehend as Texte)[k] = v;
      }
    } else if (bestehend !== undefined) {
      throw new Error(`Doppelter Textbereich: ${datei}`);
    } else ziel[letzter] = inhalt;
  }
  return fakten ? setzeFakten(ergebnis, sprache, fakten) : ergebnis;
}
