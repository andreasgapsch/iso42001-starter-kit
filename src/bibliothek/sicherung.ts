// Sicherung des Browserspeichers als ZIP (fflate) im selben Layout wie der Bibliotheksordner: bibliothek.json und alle
// Dateien. Läuft im Generator-Worker (src/app/worker/einstieg.ts); isomorph, damit Node-Tests die Rundreise prüfen.
import { zipSync, type Zippable } from 'fflate';
import { entpackeBegrenzt } from '../generator/zip-grenzen.ts';
import { pfadSicher, REGISTER_DATEI } from './layout.ts';
import { GRENZEN } from '../eingang/grenzen.ts';

export interface SicherungsDatei {
  pfad: string;
  daten: Uint8Array;
}

const KOMPRIMIERT = /\.(docx|xlsx|pptx|zip|png|jpe?g|gif|webp|pdf|mp4|heic)$/i;

/** ZIP mit Register und Dateien; Zeitstempel fest, damit gleiche Inhalte gleiche Bytes ergeben */
export function sicherungPacken(dateien: readonly SicherungsDatei[], register: string, zeitpunkt = new Date()): Uint8Array {
  const baum: Zippable = { [REGISTER_DATEI]: [new TextEncoder().encode(register), { level: 6 }] };
  for (const d of dateien) {
    if (!pfadSicher(d.pfad) || d.pfad === REGISTER_DATEI) throw new Error(`Ungültiger Pfad in der Sicherung: ${d.pfad}`);
    if (d.pfad in baum) throw new Error(`Doppelter Pfad in der Sicherung: ${d.pfad}`);
    baum[d.pfad] = [d.daten, { level: KOMPRIMIERT.test(d.pfad) ? 0 : 6 }];
  }
  return zipSync(baum, { mtime: zeitpunkt });
}

/**
 * Grenzen einer Sicherung: Die Dateien landen im Browserspeicher des Worker-Prozesses; 500 MB genügen für eine
 * Bibliothek eines KMU und bleiben unter dem, was ein Browser-Tab sicher verkraftet.
 */
export const SICHERUNG_MAX_BYTES = GRENZEN.sicherung.maxBytes;
export const SICHERUNG_MAX_DATEIEN = GRENZEN.sicherung.maxEintraege;

/** Liest eine Sicherung; Grenzen gelten vor dem Entpacken, unsichere Pfade werden abgelehnt (Zip Slip) */
export function sicherungEntpacken(zip: Uint8Array, maxBytes = SICHERUNG_MAX_BYTES): { register: string | null; dateien: SicherungsDatei[] } {
  const roh = entpackeBegrenzt(zip, { maxBytes, maxEintraege: SICHERUNG_MAX_DATEIEN });
  let register: string | null = null;
  const dateien: SicherungsDatei[] = [];
  for (const [pfad, daten] of Object.entries(roh)) {
    if (pfad.endsWith('/')) continue;
    if (!pfadSicher(pfad)) throw new Error(`Ungültiger Pfad in der Sicherung: ${pfad}`);
    if (pfad === REGISTER_DATEI) register = new TextDecoder().decode(daten);
    else dateien.push({ pfad, daten });
  }
  return { register, dateien: dateien.sort((a, b) => a.pfad.localeCompare(b.pfad)) };
}
