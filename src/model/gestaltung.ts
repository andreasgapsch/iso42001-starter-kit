// Gestaltung im Datenmodell: Übernahme des veralteten Felds organisation.logoDataUrl, Gestaltungspaket (Export und Import
// als JSON), Felder, die der Teilimport aus Skill-JSON nie übernimmt. Der KI-Export (logik/prompt.ts) nennt nur die Felder
// der Seite und enthält die Gestaltung damit nie.
import { pngAusDataUrl, pngBereinigen, pngDataUrl, pngInfo } from '../generator/png.ts';
import { svgBereinigen } from '../generator/svg.ts';
import { LOGO_GRENZEN } from '../eingang/grenzen.ts';
import { EingangsFehler, jsonLesen } from '../eingang/lesen.ts';
import type { Gestaltung } from './typen.ts';

/** Grenzen wie im Schema (typen.ts); Quelle ist die Konfiguration des Eingangsmoduls (AF-020) */
export const GESTALTUNG_GRENZEN = LOGO_GRENZEN;

/**
 * Veraltetes Feld organisation.logoDataUrl beim Laden übernehmen (ohne Versionssprung): ein gültiges PNG innerhalb der
 * Grenzen wird ohne Metadaten nach gestaltung.logo geschrieben, sofern dort noch kein Logo steht. Anderes
 * (JPEG, SVG, kaputt) wird verworfen; ein JPEG lässt sich im Werkzeug neu hochladen. Gibt eine Meldung zurück oder undefined.
 */
export function logoDataUrlUebernehmen(roh: Record<string, unknown>): string | undefined {
  const org = roh['organisation'] as Record<string, unknown> | undefined;
  if (!org || typeof org !== 'object' || !('logoDataUrl' in org)) return undefined;
  const url = org['logoDataUrl'];
  delete org['logoDataUrl'];
  if (typeof url !== 'string' || url === '') return undefined;
  const g = (org['gestaltung'] ?? {}) as Gestaltung;
  if (g.logo) return 'organisation.logoDataUrl entfernt (gestaltung.logo vorhanden)';
  const png = pngAusDataUrl(url);
  if (!png) return 'organisation.logoDataUrl verworfen (kein PNG)';
  // Ohne Canvas im Ladepfad: nur Metadaten entfernen; ausserhalb der Grenzen verwerfen (im Werkzeug neu hochladen)
  let bytes: Uint8Array;
  let breite: number;
  let hoehe: number;
  try {
    bytes = pngBereinigen(png);
    ({ breite, hoehe } = pngInfo(bytes));
  } catch {
    return 'organisation.logoDataUrl verworfen (PNG nicht lesbar)';
  }
  const k = GESTALTUNG_GRENZEN;
  if (bytes.length > k.pngBytes || Math.min(breite, hoehe) < k.minKante || Math.max(breite, hoehe) > k.maxKante) return 'organisation.logoDataUrl verworfen (Grenzen)';
  org['gestaltung'] = { ...g, logo: { png: pngDataUrl(bytes), breite, hoehe } } satisfies Gestaltung;
  return 'organisation.logoDataUrl nach organisation.gestaltung.logo übernommen';
}

/**
 * Logo einer Gestaltung bereinigen, bevor es irgendwo verwendet wird (Projektdatei, Gestaltungspaket, Zwischenstand): SVG durch
 * dieselbe Positivliste wie beim Hochladen, sonst verwerfen; das PNG muss wirklich ein PNG sein, sonst fällt das Logo weg.
 * Gibt eine Meldung zurück, wenn sich etwas geändert hat.
 */
export function logoBereinigen(g: Gestaltung | undefined): string | undefined {
  const logo = g?.logo;
  if (!g || !logo || typeof logo !== 'object') return undefined;
  if (typeof logo.png === 'string') {
    let ok = false;
    try {
      const b = pngAusDataUrl(logo.png);
      if (b) {
        pngInfo(b);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      delete (g as { logo?: unknown }).logo;
      return 'organisation.gestaltung.logo verworfen (PNG nicht lesbar)';
    }
  }
  if (typeof logo.svg !== 'string') return undefined;
  try {
    const sauber = svgBereinigen(logo.svg).svg;
    // Die Bereinigung ist idempotent: eine schon bereinigte Datei bleibt bytegleich
    if (sauber === logo.svg) return undefined;
    logo.svg = sauber;
    return 'organisation.gestaltung.logo.svg bereinigt';
  } catch {
    delete logo.svg;
    return 'organisation.gestaltung.logo.svg verworfen (nicht lesbar oder zu aufwendig)';
  }
}

export function logoBereinigenImProjekt(roh: Record<string, unknown>): string | undefined {
  const org = roh['organisation'] as { gestaltung?: Gestaltung } | undefined;
  return org && typeof org === 'object' ? logoBereinigen(org.gestaltung) : undefined;
}

/** Kennung der Datei «Gestaltungspaket» (Transportformat; massgebend ist die Kopie im Projekt) */
export const PAKET_ART = 'aims-gestaltung';
export const PAKET_VERSION = 1;

export interface Gestaltungspaket {
  art: typeof PAKET_ART;
  version: typeof PAKET_VERSION;
  gestaltung: Gestaltung;
}

export function paketErstellen(g: Gestaltung): Gestaltungspaket {
  return { art: PAKET_ART, version: PAKET_VERSION, gestaltung: structuredClone(g) };
}

/** Dateiname des Pakets: «<Kurzname oder Firma>-gestaltung.json», ohne Sonderzeichen */
export function paketDateiname(g: Gestaltung, firmenname: string): string {
  const stamm = (g.kurzname || firmenname || 'Firma')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${stamm || 'Firma'}-gestaltung.json`;
}

export type PaketLesen = { ok: true; gestaltung: Gestaltung } | { ok: false; grund: 'kein-json' | 'kein-paket' | 'version' | 'zu-gross' };

/** Paket lesen (Aufbau); die Schemaprüfung der Gestaltung macht der Aufrufer mit dem Projekt-Validator */
export function paketLesen(text: string): PaketLesen {
  let d: unknown;
  try {
    // Über das Eingangsmodul (AF-018): Grösse, Tiefe und Zahl der Werte begrenzt
    d = jsonLesen(text, 'gestaltungspaket');
  } catch (e) {
    return { ok: false, grund: e instanceof EingangsFehler ? 'zu-gross' : 'kein-json' };
  }
  if (!d || typeof d !== 'object' || (d as { art?: unknown }).art !== PAKET_ART) return { ok: false, grund: 'kein-paket' };
  const p = d as Partial<Gestaltungspaket>;
  if (p.version !== PAKET_VERSION) return { ok: false, grund: 'version' };
  if (!p.gestaltung || typeof p.gestaltung !== 'object' || Array.isArray(p.gestaltung)) return { ok: false, grund: 'kein-paket' };
  return { ok: true, gestaltung: p.gestaltung };
}

/** Felder der Organisation, die nie aus fremden Daten (Skill-JSON, Teilimport) übernommen werden */
export const ORGANISATION_NUR_WERKZEUG = new Set(['gestaltung', 'logoDataUrl']);
