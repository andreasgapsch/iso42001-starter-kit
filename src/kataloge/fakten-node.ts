// Lädt die Faktenquelle src/kataloge/fakten.yaml (nur Node: Build, Tests, Skripte).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { FaktenDatei } from './fakten.ts';

export const FAKTEN_DATEI = fileURLToPath(new URL('./fakten.yaml', import.meta.url));

export function ladeFakten(datei: string = FAKTEN_DATEI): FaktenDatei {
  return parse(readFileSync(datei, 'utf8')) as FaktenDatei;
}
