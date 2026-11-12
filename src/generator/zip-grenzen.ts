// Entpacken mit Grenzen: Zahl der Einträge, Summe und einzelne Grösse werden aus den Kopfdaten geprüft, bevor auch nur ein
// Eintrag entpackt wird. fflate entpackt in einen Puffer der angegebenen Grösse: Kopfdaten, die kleiner lügen, begrenzen
// den Speicher also ebenfalls. Namen wie __proto__ gehen in fflate still verloren und werden hier abgewiesen.
import { Inflate, unzipSync } from 'fflate';

export type ZipGrenzenArt = 'zu-gross' | 'zu-viele' | 'name' | 'lesbar';

export class ZipGrenzenFehler extends Error {
  constructor(readonly art: ZipGrenzenArt, meldung: string) {
    super(meldung);
    this.name = 'ZipGrenzenFehler';
  }
}

export interface ZipGrenzen {
  /** Summe der entpackten Grössen aller gewählten Einträge */
  maxBytes: number;
  /** Zahl aller Einträge im ZIP */
  maxEintraege: number;
  /** Grösse je gewähltem Eintrag; darüber: Fehler */
  maxTeil?: number;
  /** Nur diese Einträge entpacken */
  waehlen?: (name: string) => boolean;
}

const VERBOTEN = new Set(['__proto__', 'constructor', 'prototype']);

/** Kopfdaten lesen und prüfen, dann die gewählten Einträge entpacken. Wirft ZipGrenzenFehler. */
export function entpackeBegrenzt(zip: Uint8Array, g: ZipGrenzen): Record<string, Uint8Array> {
  // Erster Durchgang ohne Entpacken: die Grenzen gelten über die ganze Datei, nicht erst ab dem Eintrag, der sie reisst
  let eintraege = 0;
  let summe = 0;
  const pruefen = (f: { name: string; originalSize: number }): boolean => {
    if (++eintraege > g.maxEintraege) throw new ZipGrenzenFehler('zu-viele', 'ZIP mit zu vielen Einträgen');
    if (f.name.split('/').some((t) => VERBOTEN.has(t))) throw new ZipGrenzenFehler('name', `Unzulässiger Name im ZIP: ${f.name.slice(0, 80)}`);
    if (g.waehlen && !g.waehlen(f.name)) return false;
    if (g.maxTeil !== undefined && f.originalSize > g.maxTeil) throw new ZipGrenzenFehler('zu-gross', 'Eintrag im ZIP zu gross');
    summe += f.originalSize;
    if (summe > g.maxBytes) throw new ZipGrenzenFehler('zu-gross', 'ZIP entpackt zu gross');
    return false;
  };
  try {
    unzipSync(zip, { filter: pruefen });
    return unzipSync(zip, { filter: (f) => !g.waehlen || g.waehlen(f.name) }) as Record<string, Uint8Array>;
  } catch (e) {
    if (e instanceof ZipGrenzenFehler) throw e;
    throw new ZipGrenzenFehler('lesbar', 'ZIP nicht lesbar');
  }
}

/** Einträge des zentralen Verzeichnisses, also genau das, was ein anderer Leser (exceljs, JSZip) danach entpackt */
function verzeichnis(zip: Uint8Array): { name: string; art: number; gepackt: number; offen: number; start: number }[] {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let e = zip.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new ZipGrenzenFehler('lesbar', 'ZIP nicht lesbar');
  const anzahl = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  // ZIP64 und Kommentartricks prüft diese Schranke nicht: nicht lesen, was sie nicht sieht
  if (anzahl === 0xffff || p === 0xffffffff) throw new ZipGrenzenFehler('lesbar', 'ZIP nicht lesbar');
  const liste = [];
  for (let i = 0; i < anzahl; i++) {
    if (p + 46 > zip.length || dv.getUint32(p, true) !== 0x02014b50) throw new ZipGrenzenFehler('lesbar', 'ZIP nicht lesbar');
    const nl = dv.getUint16(p + 28, true);
    const lokal = dv.getUint32(p + 42, true);
    if (lokal + 30 > zip.length) throw new ZipGrenzenFehler('lesbar', 'ZIP nicht lesbar');
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nl));
    liste.push({
      name,
      art: dv.getUint16(p + 10, true),
      gepackt: dv.getUint32(p + 20, true),
      offen: dv.getUint32(p + 24, true),
      start: lokal + 30 + dv.getUint16(lokal + 26, true) + dv.getUint16(lokal + 28, true),
    });
    p += 46 + nl + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  return liste;
}

/**
 * Prüft, was ein anderer Leser danach entpacken würde: Kopfdaten gegen die Grenzen, dann wirklich entpacken und verwerfen und
 * mitzählen, weil Kopfdaten lügen können. Für Dateien, die exceljs danach ohne Grenze liest.
 */
export function zipPruefen(zip: Uint8Array, g: ZipGrenzen): void {
  const liste = verzeichnis(zip);
  if (liste.length > g.maxEintraege) throw new ZipGrenzenFehler('zu-viele', 'ZIP mit zu vielen Einträgen');
  let kopf = 0;
  for (const f of liste) {
    if (f.name.split('/').some((t) => VERBOTEN.has(t))) throw new ZipGrenzenFehler('name', `Unzulässiger Name im ZIP: ${f.name.slice(0, 80)}`);
    if (g.maxTeil !== undefined && f.offen > g.maxTeil) throw new ZipGrenzenFehler('zu-gross', 'Eintrag im ZIP zu gross');
    kopf += f.offen;
    if (kopf > g.maxBytes) throw new ZipGrenzenFehler('zu-gross', 'ZIP entpackt zu gross');
  }
  let summe = 0;
  for (const f of liste) {
    if (f.art === 0) {
      summe += f.gepackt;
    } else {
      if (f.art !== 8) throw new ZipGrenzenFehler('lesbar', 'ZIP nicht lesbar');
      const strom = new Inflate((teil) => {
        summe += teil.length;
        if (summe > g.maxBytes) throw new ZipGrenzenFehler('zu-gross', 'ZIP entpackt zu gross');
      });
      try {
        // In Stücken, damit der Wächter greift, bevor grosse Puffer entstehen
        const ende = Math.min(zip.length, f.start + f.gepackt);
        for (let p = f.start; p < ende; p += 65_536) strom.push(zip.subarray(p, Math.min(ende, p + 65_536)), p + 65_536 >= ende);
      } catch (e) {
        if (e instanceof ZipGrenzenFehler) throw e;
        throw new ZipGrenzenFehler('lesbar', 'ZIP nicht lesbar');
      }
    }
    if (summe > g.maxBytes) throw new ZipGrenzenFehler('zu-gross', 'ZIP entpackt zu gross');
  }
}
