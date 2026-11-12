// Gemeinsame Typen des Fuzz-Werkzeugs
import type { Zufall } from './zufall.ts';

/** Die 9 Eingabearten (AF-021). Teilimport gehört zur Projektdatei, die Diagrammansicht läuft nur im Browser (AF-026). */
export const EINGABEARTEN = [
  'projektdatei',
  'ki-ergebnis',
  'sicherung',
  'gestaltungspaket',
  'svg-logo',
  'word-vorlage',
  'drawio',
  'normpaket',
  'norm-pdf',
] as const;
export type Eingabeart = (typeof EINGABEARTEN)[number];

/** Ziele nur für den Selbsttest des Werkzeugs (Wächter, Speichergrenze, Rohfehler); nicht Teil der 9 Eingabearten */
export const SELBSTTEST_ZIELE = ['selbsttest-haenger', 'selbsttest-speicher', 'selbsttest-rohfehler'] as const;
export type ZielName = Eingabeart | (typeof SELBSTTEST_ZIELE)[number];

/** Ein Fall: die Eingabe als Text oder Bytes, dazu optional eine zweite Eingabe (Teilimport-Daten) */
export interface Fall {
  /** Kurzbeschreibung der Erzeugung, erscheint in Meldungen und im Dateinamen der Fundstücke */
  name: string;
  /** Dateiendung für Fundstücke, ohne Punkt */
  endung: string;
  daten: string | Uint8Array;
  zusatz?: string;
  /**
   * Grenzfall: Die Eingabe muss abgelehnt werden, und die Meldung enthält diesen Text (Ablehnungsart). Eine Annahme oder eine
   * Ablehnung aus anderem Grund heisst, dass die Grenze nicht mehr greift.
   */
  erwartet?: string;
}

/**
 * Festes Urteil je Fall: `angenommen` heisst, die App hat die Eingabe übernommen und das Ergebnis ist wieder lesbar;
 * `abgelehnt` heisst, sie hat sie mit einer Meldung zurückgewiesen. Alles andere (Absturz, Rohtext, Datenverlust,
 * unlesbares Ergebnis, Gift im Ergebnis) wirft einen Fehler.
 */
export interface Urteil {
  urteil: 'angenommen' | 'abgelehnt';
  meldung?: string;
  /** Zähler für die Auswertung, z. B. reparaturGueltig */
  zaehler?: Record<string, number>;
}

export interface Ziel {
  art: ZielName;
  /** Reine Funktion von Zufall und Nummer: keine Uhr, kein Dateisystem ausser festen Grundlagen */
  erzeuge(z: Zufall, nummer: number): Fall;
  urteile(f: Fall): Urteil | Promise<Urteil>;
}

/**
 * Fehlerklassen für die Zähler der Q9-Abnahme (docs/entwicklung/ZAEHLWEISE-Q9.md). Das Netz lässt sich ohne Browser nicht
 * messen und kommt hier nicht vor.
 */
export type Fehlerklasse = 'skript' | 'absturz' | 'datenverlust' | 'meldung' | 'haenger' | 'orakel';
export const FEHLERKLASSEN: readonly Fehlerklasse[] = ['skript', 'absturz', 'datenverlust', 'meldung', 'haenger', 'orakel'];

/** Ordnet den Text einer Orakelverletzung einer Klasse zu; die Zählweise nennt dieselbe Tabelle */
export function klasseVon(text: string): Fehlerklasse {
  if (/Gift im|Gestaltung aus dem KI-Ergebnis übernommen|Skript/.test(text)) return 'skript';
  if (/wirft|Rohfehler|Absturz|Speicherabbruch/.test(text)) return 'absturz';
  if (/ohne Meldung|ohne Angabe/.test(text)) return 'meldung';
  if (/Datenverlust|Prüfung vor dem Speichern lehnt|nicht mehr (laden|lesen)|lässt sich nicht mehr|Ergebnis nicht gültig|geht bei der Prüfung verloren|Ergebnis des Imports ist kein gültiges|Doppelte Schrittkennung|Schritt ohne Kennung/.test(text)) return 'datenverlust';
  return 'orakel';
}

/** Fehler des Urteils (Orakelverletzung); die App selbst wirft ihre eigenen Fehler */
export class OrakelFehler extends Error {
  readonly klasse: Fehlerklasse;
  constructor(meldung: string, klasse?: Fehlerklasse) {
    super(meldung);
    this.name = 'OrakelFehler';
    this.klasse = klasse ?? klasseVon(meldung);
  }
}
