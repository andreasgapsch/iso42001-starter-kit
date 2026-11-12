// Struktur des Guides (src/generiert/gefuehrt.json, Format: src/gefuehrt/FORMAT.md).
export type Wenn = {
  mitIsms?: boolean;
  modul?: boolean;
  entwickeltKi?: boolean;
  verkauftKiProdukte?: boolean;
  rolle?: string;
  typ?: string;
  /** Modul NIST AI RMF eingeschaltet (meta.modulNistRmf) */
  modulNistRmf?: boolean;
  /** mindestens ein aktives KI-System mit generativer KI (kiSysteme[].generativ) */
  generativ?: boolean;
  eintrag?: Record<string, unknown[]>;
};

export type FeldTyp =
  | 'text' | 'textarea' | 'zahl' | 'datum' | 'zeitpunkt' | 'auswahl' | 'mehrfach' | 'janein' | 'liste-text'
  | 'person' | 'personen' | 'freigabe' | 'verweis' | 'tabelle' | 'checkliste' | 'pruefliste';

export interface FeldDef {
  /** Werte, die für ein Pflichtfeld nicht zählen: Die Vorbelegung «offen» ist keine Antwort */
  ungueltig?: string[];
  pfad?: string;
  schluessel?: string;
  typ: FeldTyp;
  optionen?: string;
  vorschlaege?: string;
  pflicht?: boolean;
  wenn?: Wenn;
  setzt?: Record<string, Record<string, unknown>>;
  vorschlag?: { wert: unknown; wennEines: string[] };
  spalten?: FeldDef[];
  quelle?: string;
  /** Zahl als Auswahl der Stufen aus den Risikokriterien des Projekts (statt freier Eingabe) */
  skala?: 'wahrscheinlichkeit' | 'auswirkung';
}

export type SeitenTyp =
  | 'info' | 'formular' | 'liste' | 'auswahl-systeme' | 'folgenabschaetzung' | 'soa' | 'pruefung' | 'fahrplan' | 'kalender'
  | 'vorschlaege' | 'nist-profil' | 'gestaltung';

export interface KalenderAufgabe {
  id: string;
  rhythmus: string;
  seite: string;
  norm: string;
  wenn?: Wenn;
  monatAus?: string;
  faelligAus?: string;
}

export interface SeiteDef {
  id: string;
  typ: SeitenTyp;
  norm?: string;
  vorlage?: string;
  leitfaden?: number;
  aiact?: string[];
  /** Modul NIST AI RMF: Originaltexte auf der Seite und Sprunglinks ins PDF (kern, merkmale, messen, risiken, massnahmen) */
  nist?: string[];
  wenn?: Wenn;
  beispiel?: string;
  felder?: FeldDef[];
  liste?: string;
  filter?: Record<string, unknown[]>;
  /** auswahl-systeme: Eintrag passt, wenn mindestens einer der Schlüssel passt (ODER, zusätzlich zu filter) */
  filterEines?: Record<string, unknown[]>;
  vorgabe?: Record<string, unknown>;
  startwerte?: Record<string, unknown>[];
  anlegen?: boolean;
  /** Die Norm verlangt mindestens einen Eintrag (z. B. 4.2, 5.3): «kein Eintrag nötig» wird nicht angeboten */
  mindestensEiner?: boolean;
  eintrag?: string;
  filterSystem?: Record<string, unknown[]>;
  rahmenwerk?: string;
  controls?: string[];
  fragebogen?: boolean;
  aufgaben?: KalenderAufgabe[];
  /** vorschlaege: Katalog mit Vorschlägen für das Risikoregister (genaiRisiken, nistrmf_genaiRisiken) */
  katalog?: string;
  /** nist-profil: zusätzlich Stand des NIST AI RMF zeigen (Jahreskalender) */
  nistStand?: boolean;
}

export type CheckEintrag = string | { id: string; wenn?: Wenn };

export interface EtappeDef {
  id: string;
  norm?: string;
  vorlagen?: string[];
  leitfaden?: number;
  dauer_h?: { mit_isms: number; ohne_isms: number };
  beteiligte?: string[];
  wenn?: Wenn;
  seiten: string[];
  checkliste?: CheckEintrag[];
}

export type PfadSchluessel = 'mit_isms' | 'ohne_isms';

/** Fahrplan (etappen.yaml, Abschnitt fahrplan): Wochen und Personentage je Schritt wie src/leitfaden/schritte.yaml. */
export interface FahrplanDef {
  wochen: Record<PfadSchluessel, number>;
  erweitert: { wochen: number; pt: [number, number] };
  anteilAims: number;
  schritte: { nr: number; wochen: Record<PfadSchluessel, [number, number]>; pt: Record<PfadSchluessel, [number, number]> }[];
  meilensteine: { id: string; wochen: Partial<Record<PfadSchluessel, number>> }[];
  freigaben: { id: string; wochen: Partial<Record<PfadSchluessel, number>>; vorlagen: Partial<Record<PfadSchluessel, string[]>> }[];
  /** Zusätzliche Personentage je eingeschaltetem Modul (Richtwert), z. B. nistRmf: [3, 5] */
  module?: { nistRmf?: { pt: [number, number] } };
}

export interface GefuehrtDaten {
  etappen: { etappen: EtappeDef[]; fahrplan?: FahrplanDef };
  seiten: SeiteDef[];
  /** Optionsgruppen aus src/gefuehrt/optionen.yaml */
  optionen?: Record<string, (string | number | boolean)[]>;
}
