// Logo-Import im Browser, offline: Datei lesen, Format erkennen, über createImageBitmap bzw. <img> mit data:-URL auf ein
// Canvas zeichnen und die Pixel an den Generator-Worker geben (src/app/worker/logo.ts: Normalisierung, Farbvorschläge,
// SVG-Bereinigung, Word-Vorlage; bei Bedarf geladen). Ein SVG als Bild führt keine Skripte aus und lädt nichts nach (CSP
// connect-src 'none'); es wird vor dem Rastern bereinigt und, wenn klein genug, für Word ab 2019 mitgespeichert. Ergebnis
// ist immer ein PNG ohne Metadaten mit festen Bytes (eigener Kodierer, generator/png.ts).
import type { LogoForm, LogoHinweis } from '../../generator/bild.ts';
import { base64, pngDataUrl, type Rgba } from '../../generator/png.ts';
import { svgMitGroesse, svgMitMassen, svgZuschneiden, type SvgVorbereitet } from '../../generator/svg.ts';
import type { BildFormat, VorlagenVorschlag } from '../../generator/vorlage-import.ts';
import type { GestaltungLogo } from '../../model/typen.ts';
import { logoImWorker } from '../worker/client.ts';
import { GRENZEN, LOGO_GRENZEN } from '../../eingang/grenzen.ts';
import { liesBegrenzt } from '../../eingang/lesen.ts';

/** Grenze der Eingabe aus der Konfiguration des Eingangsmoduls (normalisiert wird auf LOGO_GRENZEN.pngBytes) */
export const MAX_EINGABE = GRENZEN.bild.maxBytes;
/** Höchstens 50 Megapixel vor dem Zeichnen (Schutz vor Dekompressionsbomben) */
export const MAX_PIXEL = 50_000_000;
/** Zeichengrösse: längste Kante beim Rastern (danach Ränder ab und auf 1600 px) */
const ZEICHEN_KANTE = 2400;
/** SVG nur bis zur Grenze der Konfiguration zusätzlich speichern */
const MAX_SVG = LOGO_GRENZEN.svgZeichen;
/**
 * Rastern eines SVG lässt sich nicht unterbrechen und nicht in den Worker legen (createImageBitmap liest dort kein SVG, und
 * <img> gibt es im Worker nicht). Darum in Stufen: Jede Stufe zeichnet die doppelte Kante; sagt die gemessene Zeit für die
 * nächste Stufe mehr voraus, als die Grenze erlaubt, endet der Import mit Meldung, bevor die teure Stufe beginnt.
 */
export const RASTER_STUFEN = [150, 300, 600, 1200];
/** Grenze für eine Stufe im Hauptthread; die Oberfläche steht so lange still */
export const RASTER_GRENZE_MS = 4000;
/** Doppelte Kante heisst vierfache Fläche; gemessen wachsen teure Clip-Bäume stärker (Faktor bis 7 je Verdopplung) */
const RASTER_FAKTOR = 6;

/** Darf die nächste Stufe gezeichnet werden? Reine Rechnung, getrennt testbar. */
export function rasterStufeErlaubt(ms: number): boolean {
  return ms * RASTER_FAKTOR <= RASTER_GRENZE_MS;
}

export type EingabeFormat = BildFormat | 'docx' | 'bmp';

export type LogoImportFehler =
  | 'zu-gross'
  | 'leer'
  | 'format-pdf'
  | 'format-eps'
  | 'format-unbekannt'
  | 'nicht-lesbar'
  | 'zu-viele-pixel'
  | 'svg-ungueltig'
  | 'svg-aufwand'
  | 'logo-zu-gross'
  | 'vorlage-ohne-logo';

export class LogoImportFehlerMeldung extends Error {
  constructor(readonly art: LogoImportFehler, readonly detail?: string) {
    super(art);
  }
}

/** Format aus den ersten Bytes (nicht aus der Endung) */
export function formatErkennen(b: Uint8Array): EingabeFormat | 'pdf' | 'eps' | undefined {
  const s = (n: number, l: number) => String.fromCharCode(...b.subarray(n, n + l));
  if (b[0] === 0x89 && s(1, 3) === 'PNG') return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (s(0, 4) === 'GIF8') return 'gif';
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'webp';
  if (s(0, 2) === 'BM') return 'bmp';
  if (s(0, 4) === 'PK\u0003\u0004') return 'docx';
  if (s(0, 5) === '%PDF-') return 'pdf';
  if (s(0, 4) === '%!PS' || (b[0] === 0xc5 && b[1] === 0xd0 && b[2] === 0xd3 && b[3] === 0xc6)) return 'eps';
  const kopf = new TextDecoder().decode(b.subarray(0, 4096)).replace(/^\uFEFF/, '').trimStart();
  if (kopf.startsWith('<') && /<svg[\s>]/i.test(kopf)) return 'svg';
  return undefined;
}

const MIME: Record<string, string> = { png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml' };

async function sha256(b: Uint8Array): Promise<string | undefined> {
  try {
    const h = await crypto.subtle.digest('SHA-256', b as BufferSource);
    return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
  } catch {
    return undefined;
  }
}

/** Bild über <img> mit data:-URL laden (CSP img-src data:, kein Netz) */
function ladeBild(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, fehler) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => ok(img);
    img.onerror = () => fehler(new LogoImportFehlerMeldung('nicht-lesbar'));
    img.src = url;
  });
}

/** Zeichnen und Pixel lesen; Grösse höchstens ZEICHEN_KANTE, Seitenverhältnis bleibt */
function pixel(quelle: CanvasImageSource, breite: number, hoehe: number): Rgba {
  if (!breite || !hoehe) throw new LogoImportFehlerMeldung('nicht-lesbar');
  if (breite * hoehe > MAX_PIXEL) throw new LogoImportFehlerMeldung('zu-viele-pixel');
  const f = Math.min(1, ZEICHEN_KANTE / Math.max(breite, hoehe));
  const w = Math.max(1, Math.round(breite * f));
  const h = Math.max(1, Math.round(hoehe * f));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new LogoImportFehlerMeldung('nicht-lesbar');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(quelle, 0, 0, w, h);
  try {
    return { breite: w, hoehe: h, daten: ctx.getImageData(0, 0, w, h).data };
  } catch {
    throw new LogoImportFehlerMeldung('nicht-lesbar');
  }
}

/** SVG in Stufen zeichnen, siehe RASTER_STUFEN. Die Messung schliesst das Lesen der Pixel ein, weil Browser erst dann zeichnen. */
function svgStufenweise(img: HTMLImageElement, breite: number, hoehe: number): Rgba {
  const lang = Math.max(breite, hoehe);
  for (const kante of RASTER_STUFEN) {
    if (kante >= lang) break;
    const f = kante / lang;
    const start = performance.now();
    pixel(img, Math.max(1, Math.round(breite * f)), Math.max(1, Math.round(hoehe * f)));
    if (!rasterStufeErlaubt(performance.now() - start)) throw new LogoImportFehlerMeldung('svg-aufwand');
  }
  return pixel(img, breite, hoehe);
}

async function rasterPixel(b: Uint8Array, format: EingabeFormat): Promise<Rgba> {
  const blob = new Blob([b as BlobPart], { type: MIME[format] ?? 'application/octet-stream' });
  // createImageBitmap prüft keine Herkunft (Canvas bleibt lesbar, auch unter file://); Rückfall <img> mit data:-URL
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob);
      try {
        return pixel(bmp, bmp.width, bmp.height);
      } finally {
        bmp.close();
      }
    } catch (e) {
      if (e instanceof LogoImportFehlerMeldung && e.art === 'zu-viele-pixel') throw e;
    }
  }
  const img = await ladeBild(`data:${MIME[format]};base64,${base64(b)}`);
  return pixel(img, img.naturalWidth, img.naturalHeight);
}

export interface LogoImport {
  logo: GestaltungLogo;
  form: LogoForm;
  hinweise: (LogoHinweis | 'svg-bereinigt' | 'svg-zu-gross' | 'erstes-bild')[];
  /** Farbvorschläge aus dem Logo (bis 3, Hex ohne #) */
  vorschlaege: string[];
  /** Grösse des PNG in Bytes */
  bytes: number;
}

/** Bilddaten in ein normalisiertes Logo umrechnen */
export async function logoAusBytes(b: Uint8Array, dateiname: string, format?: EingabeFormat | 'pdf' | 'eps'): Promise<LogoImport> {
  if (b.length > MAX_EINGABE) throw new LogoImportFehlerMeldung('zu-gross');
  if (b.length === 0) throw new LogoImportFehlerMeldung('leer');
  const f = format ?? formatErkennen(b);
  if (f === 'pdf') throw new LogoImportFehlerMeldung('format-pdf');
  if (f === 'eps') throw new LogoImportFehlerMeldung('format-eps');
  if (!f || f === 'docx') throw new LogoImportFehlerMeldung('format-unbekannt');
  const hinweise: LogoImport['hinweise'] = [];
  let rgba: Rgba;
  let svg: SvgVorbereitet | undefined;
  if (f === 'svg') {
    const r = await logoImWorker({ aufgabe: 'svg', text: new TextDecoder().decode(b) });
    if (!r.ok) throw new LogoImportFehlerMeldung('svg-ungueltig', r.detail);
    svg = svgMitMassen(r.wert);
    if (svg.entfernt.length) hinweise.push('svg-bereinigt');
    const k = ZEICHEN_KANTE / Math.max(svg.breite, svg.hoehe);
    const text = svgMitGroesse(svg.svg, svg.breite * k, svg.hoehe * k, svg.viewBox.join(' '));
    const img = await ladeBild(`data:image/svg+xml;base64,${base64(new TextEncoder().encode(text))}`);
    rgba = svgStufenweise(img, Math.round(svg.breite * k), Math.round(svg.hoehe * k));
  } else {
    if (f === 'gif') hinweise.push('erstes-bild');
    rgba = await rasterPixel(b, f);
  }
  const n = await logoImWorker({ aufgabe: 'normalisieren', bild: rgba });
  if (!n.ok) throw new LogoImportFehlerMeldung(n.fehler);
  hinweise.push(...n.wert.hinweise);
  let svgText: string | undefined;
  if (svg) {
    const zu = svgZuschneiden(svg, n.wert.rahmen, rgba);
    if (zu.length <= MAX_SVG) svgText = zu;
    else hinweise.push('svg-zu-gross');
  }
  const hash = await sha256(b);
  const name = dateiname.split(/[\\/]/).pop()!.slice(0, 120);
  const logo: GestaltungLogo = {
    png: pngDataUrl(n.wert.png),
    breite: n.wert.breite,
    hoehe: n.wert.hoehe,
    ...(svgText ? { svg: svgText } : {}),
    ...(hash ? { quelle: { dateiname: name, format: f === 'bmp' ? 'png' : f, sha256: hash } } : {}),
  };
  return { logo, form: n.wert.form, hinweise, vorschlaege: n.wert.vorschlaege, bytes: n.wert.png.length };
}

export interface VorlageImport {
  vorschlag: VorlagenVorschlag;
  logo?: LogoImport;
}

/** Vorschlag aus einer Word-Vorlage (.dotx/.docx): Designfarben, Schriften, Kopfzeilenlogo */
export async function ausVorlage(b: Uint8Array, dateiname: string): Promise<VorlageImport> {
  if (b.length > MAX_EINGABE) throw new LogoImportFehlerMeldung('zu-gross');
  const r = await logoImWorker({ aufgabe: 'vorlage', daten: b });
  if (!r.ok) throw new LogoImportFehlerMeldung('format-unbekannt');
  const vorschlag = r.wert;
  let logo: LogoImport | undefined;
  if (vorschlag.logo) {
    try {
      logo = await logoAusBytes(vorschlag.logo.daten, vorschlag.logo.name, vorschlag.logo.format);
      if (logo.logo.quelle) logo.logo.quelle = { ...logo.logo.quelle, dateiname: dateiname.split(/[\\/]/).pop()!.slice(0, 120), format: 'docx' };
    } catch {
      logo = undefined;
    }
  }
  return { vorschlag, ...(logo ? { logo } : {}) };
}

/** Datei aus einem Eingabefeld oder Ablegen: Bild oder Word-Vorlage */
export async function dateiLesen(datei: File): Promise<{ art: 'bild'; ergebnis: LogoImport } | { art: 'vorlage'; ergebnis: VorlageImport }> {
  if (datei.size > MAX_EINGABE) throw new LogoImportFehlerMeldung('zu-gross');
  const b = await liesBegrenzt(datei, 'bild');
  const f = formatErkennen(b);
  if (f === 'docx') return { art: 'vorlage', ergebnis: await ausVorlage(b, datei.name) };
  return { art: 'bild', ergebnis: await logoAusBytes(b, datei.name, f) };
}

/** Prüfung des gespeicherten Logos im Worker: Farbvorschläge, Logo für dunklen Grund, Höhe */
export async function logoAnalyse(png: Uint8Array): Promise<{ vorschlaege: string[]; dunkel: boolean; hoehe: number } | undefined> {
  const r = await logoImWorker({ aufgabe: 'analyse', png });
  return r.ok ? r.wert : undefined;
}
