// Grenzen aller fremden Eingaben an einer Stelle (AF-018, AF-020). Lesestellen, Meldungen, Hilfe, Worker-Zeitgrenzen, die
// Spezifikation des Fuzz (tests/fuzz/spezifikation.ts) und die Abnahme Q9 lesen die Werte hier. Keine Abhängigkeiten: Das Modul
// läuft im Hauptthread, im Worker und in Node.

/**
 * Eingabearten. Die ersten neun sind die Arten des Fuzz (AF-021, tests/fuzz/typen.ts); dazu kommen die Lesestellen, die keine
 * eigene Fuzz-Art haben: das Logo-Feld (Bild oder Word-Vorlage), der Fragebogen (XLSX) und Dateien der Bibliothek.
 */
export const EINGANGSARTEN = [
  'projektdatei',
  'ki-ergebnis',
  'sicherung',
  'gestaltungspaket',
  'svg-logo',
  'word-vorlage',
  'drawio',
  'normpaket',
  'norm-pdf',
  'bild',
  'fragebogen',
  'bibliotheksdatei',
] as const;
export type EingangsArt = (typeof EINGANGSARTEN)[number];

export interface Grenze {
  /** Höchstgrösse der Datei in Bytes, geprüft vor dem Lesen (bei Text: Zeichen) */
  maxBytes: number;
  /** Höchstzahl der Einträge im ZIP (zentrales Verzeichnis), geprüft vor dem Entpacken */
  maxEintraege?: number;
  /** Höchstzahl der Werte im JSON (Objekte, Listen, Texte, Zahlen), geprüft nach dem Parsen ohne Rekursion */
  maxWerte?: number;
  /** Höchstgrösse nach dem Entpacken (Container) */
  maxEntpackt?: number;
  /** Höchstgrösse eines einzelnen Teils im Container */
  maxTeil?: number;
  /** Höchste Verschachtelung der Daten (JSON, XML) */
  maxTiefe?: number;
  /** Zeitgrenze des Auftrags im Worker in Millisekunden (AF-019); danach wird der Worker beendet, die App meldet es */
  zeitMs?: number;
  /** Höchstzahl der Seiten (PDF), geprüft nach dem Öffnen und vor dem Auslesen und Zerlegen */
  maxSeiten?: number;
  /** Herzschlag: längste Pause zwischen zwei Lebenszeichen des Workers (Fortschritt je Seite), danach Abbruch mit Meldung */
  herzschlagMs?: number;
}

const MiB = 1024 * 1024;

/** Höchste Verschachtelung von XML (src/prozesse/xml.ts, draw.io) */
export const XML_MAX_TIEFE = 200;
/** Höchste Verschachtelung von Projektdaten und KI-Ergebnis (src/app/import/laden.ts) */
export const JSON_MAX_TIEFE = 200;

/** Logo nach der Normalisierung: Grenzen wie im Schema (src/model/typen.ts); gestaltung.ts übernimmt sie */
export const LOGO_GRENZEN = { pngBytes: 200 * 1024, svgZeichen: 102400, minKante: 16, maxKante: 1600 } as const;

export const GRENZEN = {
  projektdatei: { maxBytes: 25 * MiB, maxWerte: 2_000_000, maxTiefe: JSON_MAX_TIEFE },
  'ki-ergebnis': { maxBytes: 25 * MiB, maxWerte: 2_000_000, maxTiefe: JSON_MAX_TIEFE },
  // Die Dateien landen im Browserspeicher des Worker-Prozesses; 500 MB genügen für eine Bibliothek eines KMU
  sicherung: { maxBytes: 500_000_000, maxEintraege: 20_000, maxEntpackt: 500_000_000, zeitMs: 60_000 },
  gestaltungspaket: { maxBytes: 10 * MiB, maxWerte: 10_000, maxTiefe: 50 },
  'svg-logo': { maxBytes: 10 * MiB, zeitMs: 30_000 },
  // Über das Logo-Feld gelesen: dieselbe Dateigrenze wie Bilder; Teile und Summe gelten nach dem Öffnen des ZIP
  'word-vorlage': { maxBytes: 10 * MiB, maxEintraege: 5000, maxEntpackt: 60 * MiB, maxTeil: 20 * MiB, zeitMs: 30_000 },
  drawio: { maxBytes: 2 * MiB, maxEntpackt: 20 * MiB, maxTiefe: XML_MAX_TIEFE, zeitMs: 30_000 },
  normpaket: { maxBytes: 50 * MiB, maxWerte: 500_000, maxTiefe: 20 },
  // Eine Norm-PDF hat einige hundert Seiten (höchstens 400, geprüft vor dem Zerlegen, AF-018); der Worker meldet jede Seite, schweigt er länger, hängt er
  'norm-pdf': { maxBytes: 100 * MiB, maxSeiten: 400, herzschlagMs: 30_000 },
  bild: { maxBytes: 10 * MiB, zeitMs: 30_000 },
  fragebogen: { maxBytes: 10 * MiB, maxEntpackt: 64 * MiB, zeitMs: 30_000 },
  // Nur, wo die Datei ganz in den Speicher muss (Browserspeicher, Vorschau); der Ordner schreibt strömend ohne Grenze
  bibliotheksdatei: { maxBytes: 512 * MiB },
} satisfies Record<EingangsArt, Grenze>;

export const grenzeVon = (art: EingangsArt): Grenze => GRENZEN[art];

/** Grösse für Meldungen und Hilfe: «25 MB», «500 MB», «200 KB». Binär, wenn glatt, sonst dezimal (wie die Grenze gedacht ist). */
export function groesseText(bytes: number): string {
  if (bytes >= MiB && bytes % MiB === 0) return `${bytes / MiB} MB`;
  if (bytes >= 1e6 && bytes % 1e6 === 0) return `${bytes / 1e6} MB`;
  if (bytes >= MiB) return `${(bytes / MiB).toFixed(1)} MB`;
  if (bytes % 1024 === 0) return `${bytes / 1024} KB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Zahl mit Tausendertrennung je Sprache (de-CH: ’, en-GB: ,) */
const zahl = (n: number, sprache: 'de' | 'en'): string => n.toLocaleString(sprache === 'de' ? 'de-CH' : 'en-GB');

/**
 * Platzhalter für die Texte in src/i18n (AF-020): `{grenze_<art>}` für die Dateigrösse jeder Art (Bindestriche als Unterstrich),
 * `{grenze_<art>_eintraege}`, `{grenze_<art>_entpackt}`, dazu die Logo-Grenzen. Die App setzt sie in jeden UI-Text ein; von Hand
 * geschriebene Grenzwerte in den Texten prüft das Tor G41 (scripts/pruefen/lesestellen.mts).
 */
export function grenzPlatzhalter(sprache: 'de' | 'en' = 'de'): Record<string, string> {
  const aus: Record<string, string> = {};
  for (const art of EINGANGSARTEN) {
    const g: Grenze = GRENZEN[art];
    const k = `grenze_${art.replace(/-/g, '_')}`;
    aus[k] = groesseText(g.maxBytes);
    if (g.maxEintraege !== undefined) aus[`${k}_eintraege`] = zahl(g.maxEintraege, sprache);
    if (g.maxEntpackt !== undefined) aus[`${k}_entpackt`] = groesseText(g.maxEntpackt);
    if (g.maxSeiten !== undefined) aus[`${k}_seiten`] = zahl(g.maxSeiten, sprache);
  }
  aus['grenze_logo_png'] = groesseText(LOGO_GRENZEN.pngBytes);
  aus['grenze_logo_svg'] = groesseText(LOGO_GRENZEN.svgZeichen);
  aus['grenze_logo_kante'] = `${LOGO_GRENZEN.maxKante} px`;
  return aus;
}
