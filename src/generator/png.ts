// PNG lesen, schreiben und bereinigen, rein (ohne DOM, ohne Canvas): läuft in Node, im Worker und im Hauptthread gleich.
// Das Logo der Firma wird beim Import einmal in ein PNG aus diesem Kodierer umgerechnet (src/app/logik/logo.ts). Dadurch
// hängen die Bytes nicht vom Browser ab, enthalten keine Metadaten (EXIF, XMP, tEXt, C2PA) und sind in jedem Dokument
// gleich (Reproduzierbarkeit, Tor G8).
import { unzlibSync, zlibSync } from 'fflate';

const SIGNATUR = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(daten: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < daten.length; i++) c = CRC_TABELLE[(c ^ daten[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function istPng(b: Uint8Array): boolean {
  return b.length >= 33 && SIGNATUR.every((x, i) => b[i] === x);
}

export interface PngTeil {
  typ: string;
  daten: Uint8Array;
}

/** Blöcke eines PNG (ohne Prüfung der CRC) */
export function pngTeile(b: Uint8Array): PngTeil[] {
  if (!istPng(b)) throw new Error('keine PNG-Datei');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const teile: PngTeil[] = [];
  let o = 8;
  while (o + 12 <= b.length) {
    const n = dv.getUint32(o);
    if (o + 12 + n > b.length) throw new Error('PNG abgeschnitten');
    const typ = String.fromCharCode(b[o + 4]!, b[o + 5]!, b[o + 6]!, b[o + 7]!);
    teile.push({ typ, daten: b.subarray(o + 8, o + 8 + n) });
    o += 12 + n;
    if (typ === 'IEND') break;
  }
  if (teile[0]?.typ !== 'IHDR') throw new Error('PNG ohne IHDR');
  return teile;
}

export interface PngInfo {
  breite: number;
  hoehe: number;
  bitTiefe: number;
  farbtyp: number;
  interlace: number;
}

export function pngInfo(b: Uint8Array): PngInfo {
  if (!istPng(b)) throw new Error('keine PNG-Datei');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { breite: dv.getUint32(16), hoehe: dv.getUint32(20), bitTiefe: b[24]!, farbtyp: b[25]!, interlace: b[28]! };
}

function teil(typ: string, daten: Uint8Array): Uint8Array {
  const aus = new Uint8Array(12 + daten.length);
  const dv = new DataView(aus.buffer);
  dv.setUint32(0, daten.length);
  for (let i = 0; i < 4; i++) aus[4 + i] = typ.charCodeAt(i);
  aus.set(daten, 8);
  dv.setUint32(8 + daten.length, crc32(aus.subarray(4, 8 + daten.length)));
  return aus;
}

function verbinden(teile: Uint8Array[]): Uint8Array {
  const aus = new Uint8Array(teile.reduce((n, t) => n + t.length, 0));
  let o = 0;
  for (const t of teile) {
    aus.set(t, o);
    o += t.length;
  }
  return aus;
}

/** Erlaubte Blöcke nach der Bereinigung: Bild und Farbraum, keine Texte, Zeitstempel oder Metadaten */
export const PNG_ERLAUBT = new Set(['IHDR', 'PLTE', 'tRNS', 'sRGB', 'gAMA', 'pHYs', 'IDAT', 'IEND']);

/** Hilfsblöcke ausser PNG_ERLAUBT entfernen (tEXt, zTXt, iTXt, eXIf, tIME, caBX/C2PA …) */
export function pngBereinigen(b: Uint8Array): Uint8Array {
  const teile = pngTeile(b).filter((t) => PNG_ERLAUBT.has(t.typ));
  return verbinden([new Uint8Array(SIGNATUR), ...teile.map((t) => teil(t.typ, t.daten))]);
}

/** RGBA-Bild, 8 Bit je Kanal, Zeile für Zeile */
export interface Rgba {
  breite: number;
  hoehe: number;
  daten: Uint8Array | Uint8ClampedArray;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Zeilen filtern: je Zeile der Filter mit der kleinsten Summe der Beträge (übliche Heuristik) */
function filtern(roh: Uint8Array, zeile: number, hoehe: number, bpp: number): Uint8Array {
  const aus = new Uint8Array(hoehe * (zeile + 1));
  const kandidat = new Uint8Array(zeile);
  for (let y = 0; y < hoehe; y++) {
    const z = roh.subarray(y * zeile, (y + 1) * zeile);
    const v = y > 0 ? roh.subarray((y - 1) * zeile, y * zeile) : undefined;
    let besterTyp = 0;
    let beste = Infinity;
    let besteDaten = new Uint8Array(z);
    for (let typ = 0; typ < 5; typ++) {
      let summe = 0;
      for (let i = 0; i < zeile; i++) {
        const a = i >= bpp ? z[i - bpp]! : 0;
        const b = v ? v[i]! : 0;
        const c = v && i >= bpp ? v[i - bpp]! : 0;
        const x = z[i]!;
        const w = typ === 0 ? x : typ === 1 ? x - a : typ === 2 ? x - b : typ === 3 ? x - ((a + b) >> 1) : x - paeth(a, b, c);
        kandidat[i] = w & 0xff;
        summe += kandidat[i]! < 128 ? kandidat[i]! : 256 - kandidat[i]!;
      }
      if (summe < beste) {
        beste = summe;
        besterTyp = typ;
        besteDaten = new Uint8Array(kandidat);
      }
    }
    aus[y * (zeile + 1)] = besterTyp;
    aus.set(besteDaten, y * (zeile + 1) + 1);
  }
  return aus;
}

function ihdr(breite: number, hoehe: number, bitTiefe: number, farbtyp: number): Uint8Array {
  const d = new Uint8Array(13);
  const dv = new DataView(d.buffer);
  dv.setUint32(0, breite);
  dv.setUint32(4, hoehe);
  d.set([bitTiefe, farbtyp, 0, 0, 0], 8);
  return d;
}

/**
 * RGBA als PNG kodieren, deterministisch und ohne Metadaten: bis 256 Farben als Palettenbild (mit tRNS), sonst RGB
 * (deckend) oder RGBA. Ganz transparente Pixel werden auf Schwarz gesetzt (gleiche Bytes unabhängig vom Browser).
 */
export function pngKodieren(bild: Rgba): Uint8Array {
  const { breite: w, hoehe: h } = bild;
  if (w < 1 || h < 1) throw new Error('leeres Bild');
  const px = new Uint8Array(bild.daten);
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] === 0) px[i] = px[i + 1] = px[i + 2] = 0;
  const farben = new Map<number, number>();
  let deckend = true;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] !== 255) deckend = false;
    if (farben.size <= 256) {
      const k = ((px[i]! << 24) | (px[i + 1]! << 16) | (px[i + 2]! << 8) | px[i + 3]!) >>> 0;
      if (!farben.has(k)) farben.set(k, farben.size);
    }
  }
  const kopf = new Uint8Array(SIGNATUR);
  if (farben.size <= 256) {
    // Palette in Reihenfolge des ersten Auftretens; transparente Einträge zuerst wäre kleiner, ist aber nicht nötig
    const eintraege = [...farben.keys()];
    const plte = new Uint8Array(eintraege.length * 3);
    const trns = new Uint8Array(eintraege.length);
    eintraege.forEach((k, i) => {
      plte[i * 3] = k >>> 24;
      plte[i * 3 + 1] = (k >>> 16) & 0xff;
      plte[i * 3 + 2] = (k >>> 8) & 0xff;
      trns[i] = k & 0xff;
    });
    const roh = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) roh[j] = farben.get(((px[i]! << 24) | (px[i + 1]! << 16) | (px[i + 2]! << 8) | px[i + 3]!) >>> 0)!;
    let letzteTransparenz = trns.length;
    while (letzteTransparenz > 0 && trns[letzteTransparenz - 1] === 255) letzteTransparenz--;
    return verbinden([
      kopf,
      teil('IHDR', ihdr(w, h, 8, 3)),
      teil('PLTE', plte),
      ...(letzteTransparenz > 0 ? [teil('tRNS', trns.subarray(0, letzteTransparenz))] : []),
      teil('IDAT', zlibSync(filtern(roh, w, h, 1), { level: 9 })),
      teil('IEND', new Uint8Array()),
    ]);
  }
  const kanaele = deckend ? 3 : 4;
  const roh = new Uint8Array(w * h * kanaele);
  if (deckend) for (let i = 0, j = 0; i < px.length; i += 4, j += 3) roh.set(px.subarray(i, i + 3), j);
  else roh.set(px);
  return verbinden([
    kopf,
    teil('IHDR', ihdr(w, h, 8, deckend ? 2 : 6)),
    teil('IDAT', zlibSync(filtern(roh, w * kanaele, h, kanaele), { level: 9 })),
    teil('IEND', new Uint8Array()),
  ]);
}

/** PNG in RGBA dekodieren: 8 Bit, Farbtypen 0, 2, 3, 4 und 6, ohne Zeilensprung (genug für Tests und gespeicherte Logos) */
export function pngDekodieren(b: Uint8Array): Rgba {
  const info = pngInfo(b);
  if (info.bitTiefe !== 8 || info.interlace !== 0) throw new Error('nur 8 Bit ohne Zeilensprung');
  const teile = pngTeile(b);
  const kanaele = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[info.farbtyp as 0 | 2 | 3 | 4 | 6];
  if (!kanaele) throw new Error(`Farbtyp ${info.farbtyp}`);
  const plte = teile.find((t) => t.typ === 'PLTE')?.daten;
  const trns = teile.find((t) => t.typ === 'tRNS')?.daten;
  const idat = verbinden(teile.filter((t) => t.typ === 'IDAT').map((t) => t.daten));
  const roh = unzlibSync(idat);
  const { breite: w, hoehe: h } = info;
  const zeile = w * kanaele;
  if (roh.length < h * (zeile + 1)) throw new Error('PNG-Daten zu kurz');
  const ent = new Uint8Array(h * zeile);
  for (let y = 0; y < h; y++) {
    const typ = roh[y * (zeile + 1)]!;
    const q = roh.subarray(y * (zeile + 1) + 1, (y + 1) * (zeile + 1));
    for (let i = 0; i < zeile; i++) {
      const a = i >= kanaele ? ent[y * zeile + i - kanaele]! : 0;
      const bb = y > 0 ? ent[(y - 1) * zeile + i]! : 0;
      const c = y > 0 && i >= kanaele ? ent[(y - 1) * zeile + i - kanaele]! : 0;
      const x = q[i]!;
      ent[y * zeile + i] = (typ === 0 ? x : typ === 1 ? x + a : typ === 2 ? x + bb : typ === 3 ? x + ((a + bb) >> 1) : x + paeth(a, bb, c)) & 0xff;
    }
  }
  const daten = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o = i * kanaele;
    let r: number, g: number, bl: number, al: number;
    if (info.farbtyp === 3) {
      const k = ent[i]!;
      r = plte?.[k * 3] ?? 0;
      g = plte?.[k * 3 + 1] ?? 0;
      bl = plte?.[k * 3 + 2] ?? 0;
      al = trns && k < trns.length ? trns[k]! : 255;
    } else if (info.farbtyp === 0 || info.farbtyp === 4) {
      r = g = bl = ent[o]!;
      al = info.farbtyp === 4 ? ent[o + 1]! : 255;
    } else {
      r = ent[o]!;
      g = ent[o + 1]!;
      bl = ent[o + 2]!;
      al = info.farbtyp === 6 ? ent[o + 3]! : 255;
    }
    daten.set([r, g, bl, al], i * 4);
  }
  return { breite: w, hoehe: h, daten };
}

// Base64 und Data-URL (isomorph: atob/btoa gibt es in Browser, Worker und Node)

export function base64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function ausBase64(s: string): Uint8Array {
  const bin = atob(s);
  const aus = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) aus[i] = bin.charCodeAt(i);
  return aus;
}

export const PNG_DATA_URL = 'data:image/png;base64,';

export function pngDataUrl(b: Uint8Array): string {
  return PNG_DATA_URL + base64(b);
}

/** Bytes aus einer Data-URL «data:image/png;base64,…»; anderes Format: undefined */
export function pngAusDataUrl(url: string | undefined): Uint8Array | undefined {
  if (!url?.startsWith(PNG_DATA_URL)) return undefined;
  try {
    const b = ausBase64(url.slice(PNG_DATA_URL.length));
    return istPng(b) ? b : undefined;
  } catch {
    return undefined;
  }
}
