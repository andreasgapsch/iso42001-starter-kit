// Normpaket: Normtexte aus der eigenen, lizenzierten Normausgabe einer Firma (ISO/IEC 42001, ISO/IEC 27001).
// Der Text stammt immer aus dem PDF, das die Firma im Browser lädt. Das Kit, das Repo und die Projektdatei (*.aims.json)
// enthalten nie Normtext; das Normpaket liegt getrennt im Browser (IndexedDB «aims-normpaket») oder als eigene Datei.

export type NormNr = '42001' | '27001';
export type NormSprache = 'de' | 'en';
export type NormArt = 'titel' | 'text';

/**
 * IDs der Einträge (wie in den Katalogen des Kits):
 *   42001  K-4 (Kapitel), K-4.1 (Abschnitt), A.2 und A.6.1 (Gruppe), A.2.2 (Control)
 *   27001  27001-5.1 (Control), 27001-K-4.1 (Abschnitt Kapitel 4 bis 10, falls im PDF)
 */
export type NormId = string;

export interface NormEintrag {
  titel: string;
  /** Anforderungstext (Kapitel 4 bis 10) oder Control-Text (Anhang A); bei Kapiteln und Gruppen leer */
  text: string;
  /** Von Hand korrigiert in der Vorschau */
  manuell?: boolean;
}

export interface NormTeil {
  norm: NormNr;
  sprache: NormSprache;
  /** Bezeichnung der Ausgabe, z. B. «SN EN ISO/IEC 42001:2026» oder «ISO/IEC 27001:2022» */
  bezeichnung: string;
  /** Ausgabe der internationalen Norm («2023», «2022») */
  ausgabe: string;
  /** Änderung, z. B. «Amd 1:2024» (27001, Klimawandel) */
  amd?: string;
  /** Dateiname des PDF (nur zur Anzeige) */
  quelle: string;
  /** Zeitpunkt des Imports (ISO 8601) */
  importiert: string;
  eintraege: Record<NormId, NormEintrag>;
}

export interface Lizenzangaben {
  /** Bestätigung «Wir besitzen eine gültige Lizenz» beim Import (ISO 8601) */
  bestaetigtAm?: string;
  /** Ausdrückliche Bestätigung «Unsere Lizenz erlaubt die Übernahme in interne Dokumente»; Standard aus */
  dokumente: boolean;
  dokumenteBestaetigtAm?: string;
  /** Für den Quellenvermerk in Dokumenten */
  lizenzgeber: string;
  lizenznummer: string;
}

export interface Normpaket {
  format: 'aims-normpaket';
  version: 1;
  teile: NormTeil[];
  lizenz: Lizenzangaben;
}

/** Was der Generator-Worker als Laufzeitparameter erhält (nie Teil des Projekts), nur nach Bestätigung. */
export interface NormtexteLaufzeit {
  teile: NormTeil[];
  lizenzgeber: string;
  lizenznummer: string;
}

export function leeresNormpaket(): Normpaket {
  return { format: 'aims-normpaket', version: 1, teile: [], lizenz: { dokumente: false, lizenzgeber: '', lizenznummer: '' } };
}
