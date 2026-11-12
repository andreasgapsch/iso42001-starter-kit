// Typen des Prozesskatalogs (src/prozesse/katalog.yaml) und der Reifeskala (src/prozesse/reifeskala.yaml).
// Felder siehe Kopfkommentar in katalog.yaml; Texte in src/i18n/<sprache>/prozesse.yaml.
import type { ProzessSchritt, ProzessSchrittArt, RaciWert } from '../model/typen.ts';

export type ProzessGruppe = 'fuehrung' | 'kern' | 'unterstuetzung' | 'bewertung';
export type ProzessArt = 'gemeinsam' | 'gemeinsam-ki' | 'nur-aims' | 'nur-isms';
/** eigen: Prozess der Firma ausserhalb des Katalogs (Projekt.eigeneProzesse, PE-01 ff.) */
export type ProzessPflicht = 'pflicht' | 'control' | 'bedingt' | 'eigen';
export type KennzahlEinheit = 'prozent' | 'anzahl' | 'monate' | 'tage' | 'stunden';

export interface KatalogSchritt {
  id: string;
  art: ProzessSchrittArt;
  bahn: string;
  naechste?: string[];
  raci?: Record<string, RaciWert>;
  verweis?: string[];
  /** Freigabe nach Entscheidungsrechten (D-04) oder D-08 (ProzessSchritt.entscheid, Prüfregel H73) */
  entscheid?: ProzessSchritt['entscheid'];
}

export interface KatalogProzess {
  id: string;
  gruppe: ProzessGruppe;
  art: ProzessArt;
  pflicht: ProzessPflicht;
  /** Pfade im Projekt; [feld=wert] filtert Listen. Eine zutreffende Bedingung genügt. */
  bedingung?: string[];
  /** Nur bei nur-isms: auch ohne ISMS mindestens nötig */
  minimal_ohne_isms?: boolean;
  eigner_rolle: string;
  rhythmus: string | null;
  normbezug_42001: string[];
  normbezug_27001: string[];
  kit_dokumente: string[];
  verbunden: string[];
  gefuehrt_option?: string;
  /** fehlt bei eigenen Prozessen */
  kennzahl_vorschlag?: { einheit: KennzahlEinheit; richtung: 'mindestens' | 'hoechstens'; soll: number };
  ableitung: string[];
  /** Felder mit dem nächsten Termin (z. B. nächste Überprüfung der Leitlinie); der früheste nach der letzten Durchführung gilt */
  faellig_aus?: string[];
  schritte: KatalogSchritt[];
  /** Eigener Prozess der Firma (Projekt.eigeneProzesse): Texte aus dem Projekt, Ablauf nur im Projekt */
  eigen?: boolean;
}

export interface ProzessKatalog {
  rollen: { aus_aims_rolle: string[]; zusatz: string[] };
  gruppen: ProzessGruppe[];
  arten: ProzessArt[];
  pflichtarten: ProzessPflicht[];
  einheiten: KennzahlEinheit[];
  prozesse: KatalogProzess[];
}

export interface Reifeskala {
  stufen: { stufe: 0 | 1 | 2 | 3 | 4; schluessel: string; gap: number[] }[];
}

/** Texte eines Prozesses (i18n prozesse.prozesse.<id>) */
export interface ProzessTexte {
  titel: string;
  zweck: string;
  ausloeser: string[];
  eingaben: string[];
  schritte: Record<string, string>;
  zweige?: Record<string, Record<string, string>>;
  ausgaben: string[];
  kennzahl: string;
  hilfe: string;
  bedingung?: string;
  /** Grund im Firmendokument, wenn die Bedingung zutrifft (D-27 Geltung), z. B. «die Firma betreibt KI-Systeme selbst» */
  bedingung_firma?: string;
  ohne_isms?: string;
}
