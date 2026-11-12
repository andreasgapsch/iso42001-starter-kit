// Nachrichten zwischen Hauptthread und Generator-Worker.
import type { DocxDokument, XlsxMappe } from '../../generator/ir.ts';
import type { Texte } from '../../i18n/texte.ts';
import type { Kataloge } from '../../kataloge/typen.ts';
import type { Projekt, ProzessBahn, ProzessSchritt, Sprache } from '../../model/typen.ts';
import type { NormtexteLaufzeit } from '../../normtexte/typen.ts';
import type { LogoAufgabe, LogoErgebnis } from './logo.ts';

export interface Grunddaten {
  texte: Texte;
  kataloge: Kataloge;
  kitVersion: string;
}

export type Auftrag =
  | { nr: number; art: 'daten'; daten: Grunddaten; sprache: Sprache }
  /**
   * Ganzes Set (oder Auswahl) als ZIP; einzeln: genau eine Datei ohne ZIP. normtexte: Normtexte der Firma nur als
   * Laufzeitparameter nach der Bestätigung der Lizenz (nie Teil des Projekts)
   */
  | { nr: number; art: 'set'; projekt: Projekt; sprache: Sprache; ids?: string[]; einzeln?: boolean; zipName?: string; normtexte?: NormtexteLaufzeit; prozessId?: string }
  /** Zwischenformat eines Dokuments (Live-Vorschau, Druckansicht) */
  | { nr: number; art: 'ir'; projekt: Projekt; sprache: Sprache; id: string; kiSystemId?: string; prozessId?: string; normtexte?: NormtexteLaufzeit }
  /** Fragebogen für Fachbereiche (Blatt aus D-10) als XLSX */
  | { nr: number; art: 'fragebogen'; projekt: Projekt; sprache: Sprache; fachbereich?: string }
  /** Fertiges Zwischenformat als Datei (Musterdokument der Dokumentgestaltung) */
  | { nr: number; art: 'render'; ir: DocxDokument | XlsxMappe; name: string }
  /** Bildarbeit der Dokumentgestaltung (Logo normalisieren, prüfen, SVG bereinigen, Word-Vorlage lesen) */
  | { nr: number; art: 'logo'; auftrag: LogoAufgabe }
  /** Arbeitsmappe lesen (ausgefüllter Fragebogen): Zellwerte je Blatt */
  | { nr: number; art: 'xlsx-lesen'; daten: Uint8Array }
  /** Prozesse als Datei für draw.io (alle anwendbaren mit Landkarte oder die genannten) */
  | { nr: number; art: 'drawio-export'; projekt: Projekt; sprache: Sprache; ids?: string[] }
  /** Datei aus draw.io lesen: je Seite Ablauf, offene Zuordnungen und Unterschied zum Stand im Projekt */
  | { nr: number; art: 'drawio-lesen'; projekt: Projekt; sprache: Sprache; daten: Uint8Array; datei: string; prozessId?: string }
  /** Bibliothek (ab rc.10): Firmendokumente einzeln erzeugen, je Datei mit neuer Version (Entwurf) und Inhaltsprüfsumme */
  | { nr: number; art: 'bibliothek-freigabe'; projekt: Projekt; sprache: Sprache; id: string; normtexte?: NormtexteLaufzeit }
  | { nr: number; art: 'bibliothek-set'; projekt: Projekt; sprache: Sprache; ids?: string[]; normtexte?: NormtexteLaufzeit }
  /** Bibliothek: leere Vorlage des Kits (wie im Ordner 01_Vorlagen) */
  | { nr: number; art: 'vorlage'; sprache: Sprache; id: string }
  /** Bibliothek: Sicherung als ZIP packen bzw. entpacken; Textvorschau einer Word-Datei */
  | { nr: number; art: 'zip-packen'; dateien: { pfad: string; daten: Uint8Array }[]; register: string }
  | { nr: number; art: 'zip-entpacken'; daten: Uint8Array }
  | { nr: number; art: 'docx-text'; daten: Uint8Array };

/** Erzeugte Datei für die Bibliothek */
export interface BibliothekDatei {
  /** Register-ID (D-07, D-09-KI-001, D-26-Register) */
  id: string;
  katalogId: string;
  dateiname: string;
  format: 'docx' | 'xlsx';
  daten: Uint8Array;
  version: string;
  /** Inhaltsprüfsumme ohne Zeitstempel und Versionsangabe */
  basis: string;
  /** Zusatzdatei (z. B. Register zu D-26): Bezeichnung */
  zusatz?: string;
  /** Datei trägt eine schon erteilte Freigabe (Guide, Register), kein Entwurf */
  freigegeben?: boolean;
}

/** Vorschau einer gelesenen draw.io-Seite für den Dialog «Unterschied» */
export interface DrawioVorschau {
  seiteId: string;
  seiteName: string;
  prozessId?: string;
  datei?: string;
  bahnen: ProzessBahn[];
  schritte: ProzessSchritt[];
  offen: { bahnen: string[]; formen: string[] };
  roh: string;
  hash: string;
  hinweise: string[];
  unterschied: { neu: string[]; geaendert: string[]; entfernt: string[] };
  /** Seite ohne bekannten Prozess: Vorschlag eines eigenen Prozesses (Kennung und Titel aus dem Seitennamen) */
  eigen?: { id: string; titel: string };
}

export interface DateiFehler {
  id: string;
  datei: string;
  meldung: string;
}

export type Antwort =
  | { nr: number; art: 'bereit' }
  | { nr: number; art: 'fortschritt'; fertig: number; gesamt: number; datei: string }
  | { nr: number; art: 'set'; daten: Uint8Array; name: string; dateien: string[]; fehler: DateiFehler[]; ausgelassen: { id: string; grund: string }[]; ms: number }
  | { nr: number; art: 'ir'; ir: DocxDokument | XlsxMappe | null; fehler?: string }
  | { nr: number; art: 'datei'; daten: Uint8Array; name: string }
  | { nr: number; art: 'xlsx-gelesen'; blaetter: { name: string; zeilen: (string | number | boolean | null)[][] }[] }
  | { nr: number; art: 'logo'; ergebnis: LogoErgebnis }
  | { nr: number; art: 'drawio'; text: string; name: string }
  | { nr: number; art: 'drawio-gelesen'; seiten: DrawioVorschau[] }
  | { nr: number; art: 'bibliothek-freigabe'; datei: { daten: Uint8Array; basis: string; dateiname: string } | null }
  | { nr: number; art: 'bibliothek-set'; dateien: BibliothekDatei[]; unveraendert: string[]; fehler: DateiFehler[]; ausgelassen: { id: string; grund: string }[] }
  | { nr: number; art: 'zip-entpackt'; register: string | null; dateien: { pfad: string; daten: Uint8Array }[] }
  | { nr: number; art: 'docx-text'; absaetze: { text: string; ebene?: number; tabelle?: boolean }[] }
  | { nr: number; art: 'fehler'; meldung: string };
