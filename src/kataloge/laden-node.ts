// Lädt alle Katalog-YAML-Dateien (nur Node). Dateiname ohne Endung, Bindestriche zu camelCase: iso42001-controls -> controls42001 (Sonderregeln unten).
// Modulordner erhalten ein Präfix: src/ai-act -> aiact_, src/nist-rmf -> nistrmf_ (z. B. nistrmf_rmfControls), src/prozesse -> prozesse_
// (prozesse_katalog, prozesse_reifeskala).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { Kataloge } from './typen.ts';

const SRC = fileURLToPath(new URL('..', import.meta.url));

export function katalogName(datei: string): string {
  const stamm = datei.replace(/\.yaml$/, '').replace(/^iso(\d+)-(.*)$/, '$2$1');
  return stamm.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
}

/** Katalogordner unter src/ mit Präfix der Katalognamen */
export const KATALOG_ORDNER: Record<string, string> = { kataloge: '', 'ai-act': 'aiact_', 'nist-rmf': 'nistrmf_', prozesse: 'prozesse_' };

export function ladeKataloge(): Kataloge {
  const ergebnis: Record<string, unknown> = {};
  for (const [ordner, praefix] of Object.entries(KATALOG_ORDNER)) {
    const pfad = join(SRC, ordner);
    if (!existsSync(pfad)) continue;
    for (const datei of readdirSync(pfad).filter((d) => d.endsWith('.yaml')).sort()) {
      const name = praefix + katalogName(datei);
      ergebnis[name] = parse(readFileSync(join(pfad, datei), 'utf8'));
    }
  }
  return ergebnis as Kataloge;
}
