// Ableitung der Druckgestaltung aus organisation.gestaltung: genau einmal, rein (Node, Worker, Hauptthread). DOCX, XLSX und
// die Vorschau (IrVorschau) nutzen dieselben Werte. Ohne Gestaltung: undefined, die Renderer bleiben beim Kit-Design.
import type { Gestaltung } from '../model/typen.ts';
import { logoForm, type LogoForm } from './bild.ts';
import { palette, SCHRIFT, type Druckpalette } from './palette.ts';
import { pngAusDataUrl, pngInfo } from './png.ts';

export type SchriftPaar = NonNullable<NonNullable<Gestaltung['schrift']>['paar']>;

export interface Schriften {
  /** Titel, Überschriften, Tabellen, Kopf- und Fusszeile, XLSX */
  titel: string;
  /** Lesetext */
  text: string;
  tabelle: string;
}

/** Sichere Schriftpaare: mit Office auf Windows und macOS vorhanden; LibreOffice ersetzt Arial, Cambria und Calibri metrisch gleich */
export const SCHRIFTPAARE: Record<Exclude<SchriftPaar, 'eigen'>, Schriften> = {
  'arial-cambria': { ...SCHRIFT },
  arial: { titel: 'Arial', text: 'Arial', tabelle: 'Arial' },
  calibri: { titel: 'Calibri', text: 'Calibri', tabelle: 'Calibri' },
  aptos: { titel: 'Aptos', text: 'Aptos', tabelle: 'Aptos' },
  georgia: { titel: 'Georgia', text: 'Georgia', tabelle: 'Georgia' },
  verdana: { titel: 'Verdana', text: 'Verdana', tabelle: 'Verdana' },
};

/** Schriften der Gestaltung; eigene CI-Schrift nur mit Bestätigung «auf allen Rechnern installiert», sonst Arial/Cambria */
export function schriften(s?: Gestaltung['schrift']): Schriften {
  const paar = s?.paar ?? 'arial-cambria';
  if (paar !== 'eigen') return { ...SCHRIFTPAARE[paar] };
  const name = (x: string | undefined) => x?.replace(/[;,"<>]/g, '').trim().slice(0, 60) || undefined;
  const titel = name(s?.titel);
  const text = name(s?.text);
  if (!s?.installiertBestaetigt || (!titel && !text)) return { ...SCHRIFT };
  return { titel: titel ?? text!, text: text ?? titel!, tabelle: titel ?? text! };
}

/** Pixel bei 96 dpi (wie docx transformation und Excel) */
export const mmZuPx = (mm: number) => (mm * 96) / 25.4;

/** Höhe des Logos in der Kopfzeile je Form (mm): quer 9 (wie bisher 34 px), breit 10, quadratisch und hoch 12 */
export const KOPF_HOEHE_MM: Record<LogoForm, number> = { quer: 9, breit: 10, quadratisch: 12, hoch: 12 };
/** Breite höchstens 53 mm (200 px, rund ein Drittel der Satzbreite) */
export const KOPF_MAX_BREITE_PX = 200;
/** Titelseite: Höhe bis 25 mm, Breite bis 80 mm */
export const TITEL_HOEHE_MM: Record<LogoForm, number> = { quer: 16, breit: 20, quadratisch: 25, hoch: 25 };
export const TITEL_MAX_BREITE_PX = Math.round(mmZuPx(80));

export interface Masse {
  breite: number;
  hoehe: number;
}

/** Anzeigegrösse in px: Höhe nach Form oder Vorgabe, Breite höchstens maxBreite (Seitenverhältnis bleibt) */
export function logoMasse(breite: number, hoehe: number, hoeheMm: number, maxBreite: number): Masse {
  let h = mmZuPx(hoeheMm);
  let w = (breite / hoehe) * h;
  if (w > maxBreite) {
    w = maxBreite;
    h = (hoehe / breite) * w;
  }
  return { breite: Math.max(1, Math.round(w)), hoehe: Math.max(1, Math.round(h)) };
}

export interface DruckLogo {
  png: Uint8Array;
  /** bereinigtes SVG (UTF-8) für Word ab 2019, PNG als Ersatzbild */
  svg?: Uint8Array;
  /** Pixel des PNG */
  breite: number;
  hoehe: number;
  form: LogoForm;
  kopf: Masse;
  titel: Masse;
  alt: string;
}

export interface DruckGestaltung {
  palette: Druckpalette;
  schrift: Schriften;
  logo?: DruckLogo;
  logoPosition: 'links' | 'rechts';
  /** Firmenname in der Kopfzeile (ohne Logo immer) */
  firmennameZeigen: boolean;
  /** Name in der Kopfzeile: Kurzname, sonst Firmenname */
  kopfname?: string;
  fusszeileZusatz?: string;
  /** Titelseite für dieses Dokument (nur DOCX) */
  titelseite: boolean;
  /** Text des Wasserzeichens, wenn das Dokument nicht freigegeben ist */
  wasserzeichen?: string;
  kennungPraefix?: string;
}

/** Dokumente mit Titelseite bei «grundlagen»: Geltungsbereich, KI-Leitlinie, Erklärung zur Anwendbarkeit */
export const TITELSEITE_GRUNDLAGEN = new Set(['D-02', 'D-03', 'D-11']);

const enc = new TextEncoder();
let zwischenspeicher: { url: string; png: Uint8Array } | undefined;

/** PNG-Bytes eines gespeicherten Logos (die letzte Umrechnung wird gemerkt: ein Logo, viele Dokumente) */
export function logoBytes(url: string | undefined): Uint8Array | undefined {
  if (!url) return undefined;
  if (zwischenspeicher?.url === url) return zwischenspeicher.png;
  const png = pngAusDataUrl(url);
  if (png) zwischenspeicher = { url, png };
  return png;
}

export interface GestaltungsAnlass {
  sprache: 'de' | 'en';
  /** Firmenname (Alternativtext des Logos) */
  firmenname: string;
  /** Kennung des Dokuments (Titelseite «grundlagen»); leer bei Verzeichnissen */
  dokumentId?: string;
  /** Dokument ist nicht freigegeben (Wasserzeichen) */
  entwurf: boolean;
}

/**
 * Druckgestaltung eines Dokuments. Ohne organisation.gestaltung: undefined (Kit-Design wie bisher). Wasserzeichen nur mit
 * Gestaltung (Standard an), damit Projekte ohne Gestaltung unverändert bleiben.
 */
export function druckGestaltung(g: Gestaltung | undefined, a: GestaltungsAnlass): DruckGestaltung | undefined {
  if (!g) return undefined;
  const png = logoBytes(g.logo?.png);
  let logo: DruckLogo | undefined;
  if (png && g.logo) {
    const { breite, hoehe } = pngInfo(png);
    const form = logoForm(breite, hoehe);
    const hoeheMm = g.kopfzeile?.logoHoeheMm ?? KOPF_HOEHE_MM[form];
    logo = {
      png,
      ...(g.logo.svg ? { svg: enc.encode(g.logo.svg) } : {}),
      breite,
      hoehe,
      form,
      kopf: logoMasse(breite, hoehe, Math.min(15, Math.max(6, hoeheMm)), KOPF_MAX_BREITE_PX),
      titel: logoMasse(breite, hoehe, TITEL_HOEHE_MM[form], TITEL_MAX_BREITE_PX),
      alt: g.logo.alt?.trim() || `Logo ${a.firmenname}`.trim(),
    };
  }
  const basisId = (a.dokumentId ?? '').replace(/-EB$/, '').replace(/^(D-09)-KI-\d+$/, '$1');
  const titelseite = !!a.dokumentId && (g.titelseite === 'alle' || (g.titelseite === 'grundlagen' && TITELSEITE_GRUNDLAGEN.has(basisId)));
  const kurz = g.kurzname?.trim();
  const zusatz = g.fusszeileZusatz?.replace(/[\r\n]+/g, ' ').trim();
  const praefix = g.kennungPraefix?.trim();
  return {
    palette: palette(g.farben),
    schrift: schriften(g.schrift),
    ...(logo ? { logo } : {}),
    logoPosition: g.kopfzeile?.logoPosition ?? 'rechts',
    firmennameZeigen: !logo || firmennameZeigen(g),
    ...(kurz ? { kopfname: kurz } : {}),
    ...(zusatz ? { fusszeileZusatz: zusatz } : {}),
    titelseite,
    ...(a.entwurf && g.wasserzeichenEntwurf !== false ? { wasserzeichen: a.sprache === 'en' ? 'DRAFT' : 'ENTWURF' } : {}),
    ...(praefix ? { kennungPraefix: praefix } : {}),
  };
}

/**
 * Name (oder Kurzname) neben dem Logo in der Kopfzeile: Angabe der Firma, sonst nur, wenn das Logo keine Wortmarke trägt.
 * Ein Logo als Wortmarke oder mit Bild- und Wortmarke zeigt den Namen schon; der Text daneben wäre doppelt.
 */
export function firmennameZeigen(g: Pick<Gestaltung, 'kopfzeile' | 'logo'> | undefined): boolean {
  const angabe = g?.kopfzeile?.firmennameZeigen;
  if (angabe !== undefined) return angabe;
  return !(g?.logo?.art === 'wortmarke' || g?.logo?.art === 'kombiniert');
}

/** Kennung zur Anzeige (Präfix nur vor Kennungen, die es noch nicht tragen) */
export function kennungAnzeige(id: string, g?: Pick<DruckGestaltung, 'kennungPraefix'>): string {
  const p = g?.kennungPraefix;
  return p && id && !id.startsWith(p) ? `${p}${id}` : id;
}
