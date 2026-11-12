// Gemeinsame Hilfen der Spike-Tests: file://-URLs, Befundablage, Netzwerkprotokoll.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { BrowserContext } from '@playwright/test';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export function dateiUrl(relativ: string, suche = ''): string {
  return pathToFileURL(join(REPO, relativ)).href + suche;
}

/** Temporäre Dateien gehören in den Ordner für temporäre Dateien (TMPDIR, sonst Vorgabe des Systems). */
export const TMP = join(tmpdir(), 'spikes');

const BEFUNDE = join(REPO, 'spikes/befunde');

/** Hängt Befunde je Spike und Engine an spikes/befunde/<spike>-<engine>.json an (Grundlage des Berichts). */
export function befund(spike: string, engine: string, schluessel: string, wert: unknown): void {
  mkdirSync(BEFUNDE, { recursive: true });
  const datei = join(BEFUNDE, `${spike}-${engine}.json`);
  let alt: Record<string, unknown> = {};
  try {
    alt = JSON.parse(readFileSync(datei, 'utf8')) as Record<string, unknown>;
  } catch {
    // erste Meldung
  }
  alt[schluessel] = wert;
  writeFileSync(datei, `${JSON.stringify(alt, null, 2)}\n`);
}

/** Protokolliert alle Anfragen des Kontexts; «fremd» = alles ausser file:, blob:, data:. */
export function netzProtokoll(ctx: BrowserContext): { alle: string[]; fremd: () => string[] } {
  const alle: string[] = [];
  ctx.on('request', (r) => alle.push(r.url()));
  return { alle, fremd: () => alle.filter((u) => !/^(file|blob|data):/.test(u)) };
}
