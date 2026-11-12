// Zwischenformat des Dokumentengenerators.
// Vorlagen (src/vorlagen) + Projektdaten + Sprachtexte  ->  IR  ->  DOCX / XLSX.
// Dasselbe IR wird im Node-Build (leere Vorlagen, Beispielsets) und im Browser-Worker verwendet.
import type { DruckGestaltung } from './gestaltung.ts';

/** Ein Textlauf. Platzhalter werden farbig hinterlegt und sind vor der Freigabe zu ersetzen. */
export interface Lauf {
  text: string;
  fett?: boolean;
  kursiv?: boolean;
  platzhalter?: boolean;
}

/** Fliesstext: einfacher String oder Läufe. */
export type Text = string | Lauf[];

export type HinweisArt =
  | 'ausfuellhinweis' // farbig, vor Freigabe löschen
  | 'namensnennung' // nur in leeren Vorlagen, gestaltet wie Ausfüllhinweis
  | 'normverweis' // «Anforderungstext siehe ISO/IEC 42001, Abschnitt X»
  | 'ausbau' // optionale Ausbaustufe, sichtbar markiert
  | 'beispiel'; // Kennzeichnung «Beispiel aus dem Starter-Kit»

export type Block =
  | { typ: 'ueberschrift'; ebene: 1 | 2 | 3; text: string }
  | { typ: 'absatz'; text: Text }
  | { typ: 'liste'; nummeriert?: boolean; punkte: Text[] }
  /** breiten: relative Gewichte je Spalte (z. B. [1, 3, 2]), werden auf die Satzbreite verteilt */
  | { typ: 'tabelle'; kopf: string[]; zeilen: Text[][]; breiten?: number[]; leereZeilen?: number }
  | {
      typ: 'hinweis';
      art: HinweisArt;
      titel?: string;
      text: Text;
      /**
       * Normverweis des Dokuments (Abschnitte, z. B. «5.3, A.3.2»): eine Quelle für Kasten und Normbezug im Kopf. In
       * Firmendokumenten entfällt der Kasten, der Kopf nennt die Abschnitte (vorlagen/index.ts).
       */
      normbezug?: string;
    }
  | { typ: 'felder'; felder: { label: string; wert: Text }[] } // zweispaltige Feldtabelle
  /** Je Zeile ein Unterschriftsfeld: Beschriftung (z. B. «Name, Funktion») oder eine bekannte Freigabe mit Funktion, Name und Datum */
  | { typ: 'unterschriften'; felder: (string | Unterschrift)[] }
  | { typ: 'seitenumbruch' }
  | MatrixBlock
  | DiagrammBlock
  | AblaufBlock;

/**
 * Farbrolle statt Farbe: Der Renderer setzt die Druckpalette (generator/palette.ts, helle Tokens des Design Systems), die
 * App-Vorschau die Tokens der App. Bedeutung nie nur über Farbe: Zellen und Knoten tragen immer Text (Stufe, Wert, Status).
 */
export type Farbrolle =
  | 'risiko-tief'
  | 'risiko-mittel'
  | 'risiko-hoch'
  | 'status-gut'
  | 'status-warnung'
  | 'status-kritisch'
  | 'status-neutral'
  | 'status-info'
  | 'status-gut-stark'
  | 'kopf'
  | 'leer'
  | 'kat-1'
  | 'kat-2'
  | 'kat-3'
  | 'kat-4'
  | 'kat-5'
  | 'kat-6'
  | 'seq-1'
  | 'seq-2'
  | 'seq-3'
  | 'seq-4'
  | 'seq-5';

/** Zelle einer Matrix: erste Zeile fett (z. B. «H 16»), weitere klein (z. B. «2 Risiken: R-003, R-007») */
export interface MatrixZelle {
  zeilen: Text[];
  rolle?: Farbrolle;
}

/**
 * Farbige Kreuztabelle als echte Tabelle (Risikomatrix, Zeitraster): Kopfzeile wiederholt, Zeilenköpfe links, Legende
 * darunter. Textalternative: `alt` als Absatz unter der Tabelle (in Word nicht ausgeblendet, damit sie gedruckt mitläuft).
 */
export interface MatrixBlock {
  typ: 'matrix';
  /** Beschriftung über der Tabelle (fett) */
  titel?: string;
  /** Zelle oben links, z. B. «A \ W» */
  ecke: Text;
  spalten: Text[];
  zeilen: { kopf: Text; zellen: MatrixZelle[] }[];
  /** Legende unter der Tabelle: Farbfeld mit Text */
  legende?: { rolle: Farbrolle; text: Text }[];
  /** Kurzbeschreibung mit allen Werten (Satz), steht klein unter der Matrix */
  alt?: string;
  /** Relative Breite der Kopfspalte gegenüber einer Datenspalte (Standard 1,4) */
  kopfbreite?: number;
}

export interface DiagrammReihe {
  name: string;
  werte: (number | null)[];
  rolle: Farbrolle;
  /** Linie gestrichelt (z. B. Sollwert) */
  gestrichelt?: boolean;
  /** Punkte an den Messwerten (Linie) */
  marker?: boolean;
  /** Farbe je Kategorie (nur Balken), z. B. Fälligkeit überfällig, bald, später */
  rollen?: Farbrolle[];
}

/**
 * Natives Word-Diagramm (docx/charts, «Daten bearbeiten» in Word). balken: waagrechte Balken je Reihe nebeneinander;
 * stapel: waagrechte gestapelte Balken; linie: Linie über die Kategorien (z. B. Messungen mit Sollwert).
 */
export interface DiagrammBlock {
  typ: 'diagramm';
  art: 'balken' | 'stapel' | 'linie';
  titel: string;
  kategorien: string[];
  reihen: DiagrammReihe[];
  achse?: { titel?: string; min?: number; max?: number; schritt?: number; format?: string };
  /** Höhe in Pixeln (Breite = Satzbreite); Standard nach Anzahl Kategorien */
  hoehe?: number;
  /** Alternativtext: Titel und Beschreibung mit allen Werten */
  alt: { titel: string; beschreibung: string };
}

export type AblaufForm = 'start' | 'schritt' | 'frage' | 'ergebnis' | 'ende';
export type AblaufSeite = 'top' | 'right' | 'bottom' | 'left';

export interface AblaufKnoten {
  id: string;
  form: AblaufForm;
  text: string;
  /** Rasterposition (0-basiert) */
  spalte: number;
  zeile: number;
  /** Breite in Rasterspalten (Standard 1) */
  breite?: number;
  /** Höhe in Rasterzeilen (Standard 1) */
  hoehe?: number;
  rolle?: Farbrolle;
}

export interface AblaufKante {
  von: string;
  vonSeite: AblaufSeite;
  nach: string;
  nachSeite: AblaufSeite;
  /** Beschriftung nahe am Start, z. B. «Ja» */
  text?: string;
  weg?: 'gerade' | 'winkel';
}

/**
 * Ablauf aus bearbeitbaren Formen (docx/shapes, Zeichenbereich mit Rückfallgruppe). Positionen im Raster, der Renderer
 * rechnet Pixel; Konnektoren immer mit expliziten Seiten, damit Word und LibreOffice sie gleich führen.
 */
export interface AblaufBlock {
  typ: 'ablauf';
  spalten: number;
  zeilen: number;
  knoten: AblaufKnoten[];
  kanten: AblaufKante[];
  /** Höhe einer Rasterzeile in Pixeln (Standard 64) */
  zeilenHoehe?: number;
  /** Relative Breiten der Rasterspalten (Standard: gleich breit) */
  spaltenGewichte?: number[];
  /** Schriftgrösse in den Formen in Punkt (Standard 7,5) */
  schriftgroesse?: number;
  /**
   * Senkrechte Bahnen (Swimlanes, Prozessbeschreibung D-27): Rechteck je Bahn hinter den Formen, Rolle im Kopf. Die Formen
   * beginnen unter dem Kopf (kopfHoehe, Standard 34 px). Ohne Bahnen unverändert.
   */
  bahnen?: { id: string; text: string; spalte: number; breite?: number }[];
  kopfHoehe?: number;
  alt: { titel: string; beschreibung: string };
}

export interface Unterschrift {
  funktion: string;
  name: string;
  datum: string;
}

export interface Dokumentkopf {
  /** Kopfzeile gehört der Firma: Firmenname oder Platzhalter, optional Logo */
  firmenname: Text;
  /** Logo ohne Gestaltung (ältere Aufrufer, Tests); mit Gestaltung gilt gestaltung.logo */
  logoPng?: Uint8Array;
  /** Fusszeile der Firma (Klassifikation, Seitenzahl kommt automatisch) */
  fusszeile: Text;
}

export interface Lenkungsangaben {
  dokumentId: string;
  titel: string;
  version: Text;
  eigner: Text;
  /** Prüfung vor der Freigabe durch eine zweite Person (optional; leer: Feld wird nicht ausgegeben) */
  geprueftDurch?: Text;
  freigabeDurch: Text;
  datum: Text;
  /** Letzter Eintrag der Änderungshistorie, z. B. «1.1 vom 24.11.2026: …» (optional; leer: Feld wird nicht ausgegeben) */
  aenderung?: Text;
  /** Letzte Überprüfung ohne Änderung, z. B. «Daniel Keller, 02.02.2027» (optional; leer: Feld wird nicht ausgegeben) */
  bestaetigt?: Text;
  klassifikation: Text;
  normbezug: string;
  ismsBezug: string; // wiederverwendet / erweitert / neu
  pfad: string; // gilt im Pfad mit/ohne ISMS; leer in Firmendokumenten (Feld wird dann nicht ausgegeben)
}

/** Dateieigenschaften (docProps); erstellt, geaendert und revision optional (sonst Zeitpunkt des Builds, Revision 1) */
export interface Dateieigenschaften {
  titel: string;
  autor: string;
  betreff?: string;
  erstellt?: string;
  geaendert?: string;
  revision?: number;
}

export interface DocxDokument {
  sprache: 'de' | 'en';
  /**
   * Gestaltung der Firma (Logo, CI-Farben, Schrift, Titelseite, Wasserzeichen), fertig abgeleitet (generator/gestaltung.ts).
   * Gesetzt an einer Stelle nach der Vorlage (vorlagen/gestaltung.ts); fehlt sie, gilt das Kit-Design.
   */
  gestaltung?: DruckGestaltung;
  kopf: Dokumentkopf;
  lenkung: Lenkungsangaben;
  /** Dateieigenschaften. Nie Kit-Absender; Autor = Firma oder leer. Erstellt/geändert: Freigabedaten des Dokuments (ISO). */
  eigenschaften: Dateieigenschaften;
  bloecke: Block[];
}

export type Zellwert = string | number | boolean | null;

export interface XlsxSpalte {
  kopf: string;
  breite?: number; // Zeichen
  typ?: 'text' | 'zahl' | 'datum' | 'liste' | 'formel';
  liste?: string[]; // Auswahlwerte (Datenüberprüfung)
  formel?: string; // Excel-Formel mit {r} als Zeilennummer, z. B. "=E{r}*F{r}"; ein Wert der Zeile in dieser Spalte ist das zwischengespeicherte Ergebnis
  umbruch?: boolean;
  /** Spalte ausblenden (technische Schlüssel) */
  versteckt?: boolean;
}

export interface XlsxBlatt {
  name: string; // max. 31 Zeichen
  titel?: string;
  hinweise?: string[]; // Ausfüllhinweise oberhalb der Tabelle, farbig
  spalten: XlsxSpalte[];
  zeilen: Zellwert[][];
  leereZeilen?: number; // vorformatierte Leerzeilen mit Auswahllisten
  fixiert?: boolean;
  /**
   * Bedingte Farben auf einer oder mehreren Spalten, z. B. Risikowert vor und nach Behandlung.
   * spalte: 0-basierter Index in `spalten`; Wert <= gruenBis erste Stufe, <= gelbBis zweite Stufe, sonst dritte.
   * palette: «risiko» (tief, mittel, hoch) oder «status» (gut, warnung, kritisch; Standard).
   */
  ampel?: XlsxAmpel | XlsxAmpel[];
  /** Weitere bedingte Formate je Spalte (Datenbalken, Farbskala, Farbe nach Text) */
  formate?: XlsxFormat[];
  /** Matrix-Blätter: Kreuztabellen mit COUNTIFS über ein anderes Blatt, unter Titel und Hinweisen (statt `spalten`) */
  matrizen?: XlsxMatrix[];
}

export interface XlsxAmpel {
  spalte: number;
  gruenBis: number;
  gelbBis: number;
  palette?: 'risiko' | 'status';
}

export type XlsxFormat =
  /** Datenbalken zwischen festen Grenzen (z. B. Reifegrad 0 bis 5, Umsetzung 0 bis 100) */
  | { art: 'datenbalken'; spalte: number; min: number; max: number; rolle?: Farbrolle }
  /** Farbskala in drei Stufen (wenig hell, viel kräftig) */
  | { art: 'farbskala'; spalte: number; min: number; max: number }
  /** Farbe nach Zellinhalt (Text gleich), z. B. «konform» -> status-gut */
  | { art: 'text'; spalte: number; regeln: { text: string; rolle: Farbrolle }[] }
  /** Farbe nach Zahlenbereich: erste passende Regel (Wert <= bis) gilt */
  | { art: 'stufen'; spalte: number; regeln: { bis: number; rolle: Farbrolle }[]; sonst?: Farbrolle };

/**
 * Kreuztabelle mit Formeln: je Zelle COUNTIFS über zwei Spalten eines Datenblatts (Zeilenkopf und Spaltenkopf als Zahl),
 * zwischengespeichertes Ergebnis aus JS (sichtbar ohne Neuberechnung). Zonen färben per Ausdruck aus Zeilen- mal
 * Spaltenwert (Risikostufe aus W×A), so stimmen Farbe und Grenzen auch nach Änderungen.
 */
export interface XlsxMatrix {
  titel: string;
  /** Datenblatt (Name wie in `blaetter[].name`) und 0-basierte Spalten in dessen `spalten` */
  quelle: { blatt: string; zeilenSpalte: number; spaltenSpalte: number; bedingungen?: { spalte: number; kriterium: string }[] };
  ecke: string;
  /** Zeilenköpfe von oben nach unten, z. B. Auswirkung absteigend */
  zeilen: { wert: number; text: string }[];
  /** Spaltenköpfe von links nach rechts, z. B. Wahrscheinlichkeit aufsteigend */
  spalten: { wert: number; text: string }[];
  /** Zwischengespeicherte Anzahl je Zelle [zeile][spalte] */
  ergebnisse: number[][];
  /** Zonen aus Zeilenwert mal Spaltenwert: bis tiefBis «tief», ab hochAb «hoch», dazwischen «mittel» */
  zonen: { tiefBis: number; hochAb: number; kuerzel: [string, string, string] };
}

export interface XlsxMappe {
  sprache: 'de' | 'en';
  /** Gestaltung der Firma wie bei DocxDokument */
  gestaltung?: DruckGestaltung;
  eigenschaften: Dateieigenschaften;
  /** Lenkungsangaben als erstes Blatt «Dokument» */
  lenkung: Lenkungsangaben;
  firmenname: Text;
  hinweisBlock?: Block[]; // Namensnennung, Normverweis auf dem Lenkungsblatt
  blaetter: XlsxBlatt[];
}
