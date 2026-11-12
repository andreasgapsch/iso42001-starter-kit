// Gemeinsame Typen des Speichermoduls (Projektdatei und Zwischenspeicher).

/** Wo der Zwischenspeicher liegt. «speicher» = nur im Arbeitsspeicher, geht beim Neuladen verloren. */
export type ZwischenspeicherArt = 'indexeddb' | 'localstorage' | 'speicher';

/** Schlüssel-Wert-Ablage für Zwischenstände. Alle Werte sind Zeichenketten (JSON). */
export interface ZwischenspeicherAdapter {
  readonly art: ZwischenspeicherArt;
  lesen(schluessel: string): Promise<string | null>;
  schreiben(schluessel: string, wert: string): Promise<void>;
  loeschen(schluessel: string): Promise<void>;
  /** Alle Schlüssel mit diesem Präfix. */
  schluessel(praefix: string): Promise<string[]>;
}

/** Minimale Sicht auf ein Dateihandle der File System Access API (bzw. OPFS). */
export interface DateiHandle {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(daten: Blob | string): Promise<void>; close(): Promise<void> }>;
  queryPermission?(o: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

export interface GeoeffneteDatei {
  name: string;
  inhalt: string;
  /** Nur bei File System Access: erlaubt späteres Speichern auf dieselbe Datei. */
  handle?: DateiHandle;
}

export interface SpeicherErgebnis {
  /** «datei» = direkt in die Datei geschrieben; «download» = Browser hat einen Download angestossen. */
  art: 'datei' | 'download';
  name: string;
  handle?: DateiHandle;
}

/** Öffnen und Speichern der Projektdatei. */
export interface DateiZugriff {
  readonly art: 'fsa' | 'fallback';
  /** Liefert null, wenn die Auswahl abgebrochen wurde. */
  oeffnen(): Promise<GeoeffneteDatei | null>;
  /** Mit handle: dieselbe Datei überschreiben. Ohne: «Speichern unter» bzw. Download. Null = abgebrochen. */
  speichern(inhalt: string, vorschlag: string, handle?: DateiHandle): Promise<SpeicherErgebnis | null>;
}

export interface Faehigkeiten {
  fsaOeffnen: boolean;
  fsaSpeichern: boolean;
  indexedDb: boolean;
  localStorage: boolean;
  /** Bevorzugte Ablage nach der Fallback-Kette. */
  zwischenspeicher: ZwischenspeicherArt;
}

/** Ein abgelegter Zwischenstand (Format v1). */
export interface Zwischenstand {
  v: 1;
  schluessel: string;
  dateiname: string;
  /** ISO-Zeitpunkt der letzten Änderung, die abgelegt wurde. */
  geaendertAm: string;
  /** ISO-Zeitpunkt, zu dem dieser Stand in eine Datei gespeichert oder heruntergeladen wurde. */
  gesichertAm?: string;
  /** Wie gesichert: Download ist nicht sicher bestätigt (Benutzer kann den Download verwerfen). */
  gesichertAls?: 'datei' | 'download';
  inhalt: string;
}
