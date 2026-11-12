// Datenmodell der Bibliothek (R4). Die Projektdatei hält nur Verweise und Metadaten, nie Dateiinhalte.
// Die Dateien liegen im verbundenen Ordner (File System Access, Edge und Chrome) oder im Browserspeicher (IndexedDB).
// Für Firmendokumente mit Eintrag im Dokumentenregister (Projekt.dokumente) und für Nachweise (Projekt.nachweise) bleiben
// diese Register die Quelle von Status, Version, Eigner, Freigabe und Titel; die Bibliothek ergänzt Dateien und Bezüge.
import type { Freigabe, PersonId } from '../model/typen.ts';

/** Art eines Eintrags: Firmendokument (D-xx, E-xx, N-xx), eigene Datei (X-001), Nachweis (N-001), Vorlage und Rechtstext des Kits */
export type BibliothekArt = 'firmendokument' | 'eigene' | 'nachweis' | 'vorlage' | 'rechtstext';

/** Status nach der Dokumentenlenkung (D-26): Entwurf, in Prüfung, freigegeben, ersetzt (durch eine neuere Version), archiviert */
export type BibliothekStatus = 'entwurf' | 'in-pruefung' | 'freigegeben' | 'ersetzt' | 'archiviert';

/** Eine Version eines Eintrags: genau eine Datei mit Prüfsumme. Versionen werden nie überschrieben. */
export interface BibliothekVersion {
  /** Versionsnummer, z. B. 1.4 (Firmendokumente, eigene Dateien) oder 2 (Nachweise) */
  version: string;
  /**
   * Pfad der Datei relativ zum Bibliotheksordner, z. B. «Firmendokumente/D-07_KI-Risikoregister/v1.4.xlsx»
   * @maxLength 400
   */
  datei: string;
  /** Ursprünglicher Dateiname beim Hochladen oder Erzeugen */
  name?: string;
  /** Grösse in Bytes */
  groesse: number;
  /**
   * SHA-256 der Datei (hex, 64 Zeichen)
   * @pattern ^[0-9a-f]{64}$
   */
  pruefsumme: string;
  /** Zeitpunkt des Eincheckens (ISO mit Zeit) */
  datum: string;
  /** Änderungszeit der Datei im Ordner beim letzten Abgleich (Millisekunden seit 1970); erkennt Änderungen ausserhalb */
  geaendert?: number;
  /** Wer die Version eingecheckt hat (Personen-ID oder Name) */
  autor?: PersonId | string;
  /** Status dieser Version; fehlt er, gilt «entwurf» */
  status?: BibliothekStatus;
  /** Prüfung vor der Freigabe durch eine zweite Person (D-26, 7.5.2) */
  geprueft?: Freigabe;
  freigabe?: Freigabe;
  /** Was sich gegenüber der vorigen Version geändert hat (Änderungshistorie D-26) */
  aenderung?: string;
  /**
   * Nummer des Entwurfs, der mit dieser Version freigegeben wurde (D-26: Entwürfe 0.x, die Freigabe hebt auf 1.0). Die
   * Datei behält den Namen des Entwurfs, z. B. v0.1.docx.
   */
  entwurf?: string;
  /** Herkunft: vom Generator erzeugt, hochgeladen, neue Version eingecheckt, aus dem Ordner übernommen */
  quelle?: 'generator' | 'hochgeladen' | 'eingecheckt' | 'ordner';
  /**
   * Die Datei dieser Version wurde nach dem Einchecken ausserhalb überschrieben und als neue Version übernommen; der
   * ursprüngliche Inhalt ist nur noch über die Prüfsumme belegt. Der Abgleich meldet sie nicht mehr.
   */
  ueberschrieben?: boolean;
  /**
   * Nur Generator: SHA-256 des Inhalts ohne Zeitstempel und ohne Versionsangabe; gleicher Wert heisst, das Projekt hat
   * sich für dieses Dokument nicht geändert und eine neue Version ist unnötig
   * @pattern ^[0-9a-f]{64}$
   */
  basis?: string;
}

/** Bezüge eines Eintrags zu anderen Teilen des Projekts (IDs) */
export interface BibliothekVerknuepfungen {
  kiSysteme?: string[];
  risiken?: string[];
  controls?: string[];
  prozesse?: string[];
  nachweise?: string[];
}

export interface BibliothekEintrag {
  /**
   * Kennung: D-07 oder D-09-KI-001 (Firmendokument wie im Dokumentenregister), N-001 (Nachweis), X-001 (eigene Datei),
   * V-D-07 (Vorlage des Kits), RT-01 (Rechtstext)
   * @pattern ^[A-Z][A-Z0-9]*(-[A-Za-z0-9]+)+$
   */
  id: string;
  art: BibliothekArt;
  /**
   * Titel; bei Firmendokumenten aus dem Katalog, bei Nachweisen aus Projekt.nachweise, wenn leer
   * @maxLength 200
   */
  titel?: string;
  /**
   * Status ohne Versionen (z. B. eigene Datei ohne Datei) oder «archiviert» für den ganzen Eintrag. Sonst gilt der Status
   * der neuesten Version; bei Firmendokumenten mit Registereintrag der Status im Register.
   */
  status?: BibliothekStatus;
  /** älteste zuerst */
  versionen: BibliothekVersion[];
  /** Eigner/in; bei Firmendokumenten mit Registereintrag steht sie im Register */
  eigner?: PersonId;
  /** Nächste Überprüfung (JJJJ-MM-TT); bei Firmendokumenten mit Registereintrag im Register */
  naechstePruefung?: string;
  /** Abschnitte und Controls (nur Nummern, z. B. 6.1.2, A.5.4) */
  normbezug?: string[];
  verknuepfungen?: BibliothekVerknuepfungen;
  /** Kurzbeschreibung, z. B. Vertragspartner oder Zweck */
  beschreibung?: string;
  /** Art des Nachweises (wie Nachweis.art), nur bei Nachweisen ohne Eintrag in Projekt.nachweise */
  nachweisArt?: 'dokument' | 'aufzeichnung' | 'protokoll' | 'vertrag' | 'schulung' | 'sonstiges';
}

/** Ergebnis des letzten Abgleichs zwischen Ordner und Register (Grundlage der Prüfregeln H78 und H79) */
export interface BibliothekAbgleich {
  /** Zeitpunkt (ISO mit Zeit) */
  am: string;
  /** Kennungen mit Datei, die ausserhalb geändert und noch nicht als neue Version eingecheckt ist */
  geaendert?: string[];
  /** Kennungen, deren Datei im Ordner fehlt */
  fehlend?: string[];
  /** Kennungen, deren Datei nur in der Cloud liegt (z. B. OneDrive-Platzhalter) */
  nichtLokal?: string[];
}

/** Bibliothek des Projekts (Projekt.bibliothek). Optional. */
export interface Bibliothek {
  /** Wo die Dateien liegen: verbundener Ordner oder Browserspeicher (mit Sicherung als ZIP) */
  ablage?: 'ordner' | 'browser';
  /** Name des zuletzt verbundenen Ordners (nur Anzeige) */
  ordnerName?: string;
  /** Letzte Sicherung des Browserspeichers als ZIP (ISO mit Zeit); Prüfregel H79 */
  gesichertAm?: string;
  abgleich?: BibliothekAbgleich;
  eintraege: BibliothekEintrag[];
}
