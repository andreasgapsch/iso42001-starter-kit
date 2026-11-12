// Gemeinsames Datenmodell der Projektdatei (*.aims.json).
// Gilt für Werkzeug, Dokumentengenerator, XLSX-Vorlagen und Skill-Ausgabe.
// Änderungen nur mit neuer schemaVersion und Migration (src/model/migrationen.ts).
// Ausnahme: zusätzliche optionale Felder (mit «optional», «optional» oder «optional» oder «Optional, ab 1.1» kommentiert) sind abwärtsverträglich
// und brauchen keine neue Version. Ältere Dateien ohne diese Felder bleiben gültig.

import type { Bibliothek } from '../bibliothek/modell.ts';

/**
 * Version des Dateiformats. 1: veröffentlichte Fassung bis 1.0.0-test.3. 2 (ab 1.0.0-test.4): meta.idZaehler (Zähler der
 * fortlaufenden IDs je Liste, AF-010). 3 (ab 1.0.0-test.4, AF-104): Antrag und Entscheid je KI-System (D-10, Kennzahl
 * PR-07), Entdeckung und Eindämmung mit Uhrzeit je Feststellung (D-22, Kennzahl PR-19).
 */
export const SCHEMA_VERSION = 3;

export type Sprache = 'de' | 'en';
export type JaNeinOffen = 'ja' | 'nein' | 'offen';
/** «NISTRMF» (optional): Zusatz-Control RMF-xx aus dem Modul NIST AI RMF (meta.modulNistRmf). */
export type Rahmenwerk = 'ISO42001' | 'ISO27001' | 'EUAIA' | 'EIGENE' | 'NISTRMF';

/** Personen-ID, z. B. P-001 */
export type PersonId = string;

export interface Freigabe {
  von: PersonId | string;
  am: string; // ISO-Datum JJJJ-MM-TT
}

export interface Meta {
  /** Eindeutige Kennung (UUID) für den Zwischenspeicher im Browser */
  projektId: string;
  erstellt: string;
  geaendert: string;
  dokumentSprache: Sprache;
  mitIsms: boolean;
  ismsZertifiziert: boolean;
  modulAiAct: boolean;
  /**
   * Optionales Modul NIST AI RMF eingeschaltet: Vorlagen N-01 bis N-04, Zusatz-Controls RMF-xx in D-11, Prüfregeln mit
   * modul «nistrmf» (Profil je Subkategorie in Projekt.nistProfil). Optional.
   */
  modulNistRmf?: boolean;
  gefuehrt: {
    aktuelleEtappe: string;
    /** besucht (optional, ab Werkzeug 1.0): Seiten, die mit «Weiter» verlassen wurden; Grundlage des Fortschritts */
    etappen: Record<string, { status: 'offen' | 'in-arbeit' | 'erledigt'; spaeter: string[]; besucht?: string[] }>;
    /**
     * Antworten des Geführten Modus ohne eigenes Feld im Datenmodell (Arbeitsstand, z. B. Auswahl der Quellen
     * für das Inventar). Inhalte, die ein Dokument braucht, haben ein eigenes Feld (z. B. organisation.meldeweg).
     */
    antworten: Record<string, unknown>;
    /** zuletzt geöffnete Seite (optional), für «Weitermachen» */
    aktuelleSeite?: string;
    /**
     * Listenseiten, auf denen ausdrücklich kein Eintrag nötig ist (Seiten-IDs, z. B. «E12-feststellungen» ohne
     * Feststellungen). Die Seite gilt dann ohne Eintrag als vollständig. Optional.
     */
    nichtNoetig?: string[];
  };
  checklisten: Record<string, { erledigt: boolean; nachweis?: string; datum?: string }>;
  /**
   * Zähler der fortlaufenden IDs je Liste (ab Schemaversion 2, AF-010): höchste je vergebene Nummer der Liste, auch wenn der
   * Eintrag inzwischen gelöscht ist. Sinkt nie; neue IDs erhalten die nächste Nummer über Zähler und höchster vorhandener ID,
   * damit eine gelöschte ID nie wieder vergeben wird und alte Verweise nicht still auf einen neuen Eintrag zeigen.
   * Fehlt der Zähler einer Liste, gilt die höchste vorhandene Nummer.
   */
  idZaehler?: IdZaehler;
}

/** Zähler je Liste mit fortlaufenden IDs (Schlüssel wie in ID_PRAEFIX, dazu eigeneProzesse), Wert: höchste vergebene Nummer */
export interface IdZaehler {
  /** @asType integer @minimum 0 */
  personen?: number;
  /** @asType integer @minimum 0 */
  parteien?: number;
  /** @asType integer @minimum 0 */
  rollen?: number;
  /** @asType integer @minimum 0 */
  kiSysteme?: number;
  /** @asType integer @minimum 0 */
  risiken?: number;
  /** @asType integer @minimum 0 */
  folgenabschaetzungen?: number;
  /** @asType integer @minimum 0 */
  eigeneControls?: number;
  /** @asType integer @minimum 0 */
  nachweise?: number;
  /** @asType integer @minimum 0 */
  massnahmen?: number;
  /** @asType integer @minimum 0 */
  lieferanten?: number;
  /** @asType integer @minimum 0 */
  ziele?: number;
  /** @asType integer @minimum 0 */
  kompetenzen?: number;
  /** @asType integer @minimum 0 */
  kommunikation?: number;
  /** @asType integer @minimum 0 */
  audits?: number;
  /** @asType integer @minimum 0 */
  feststellungen?: number;
  /** @asType integer @minimum 0 */
  managementbewertungen?: number;
  /** @asType integer @minimum 0 */
  eigeneProzesse?: number;
}

export interface Thema {
  id: string; // TH-001
  art: 'extern' | 'intern';
  kategorie: string; // z. B. recht, regulierung, markt, kultur, governance, vertrag, zweck
  beschreibung: string;
  auswirkung?: string;
}

/** Meldeweg für Bedenken von Mitarbeitenden (D-04, 5.3 und A.3.3). Optional. */
export interface Meldeweg {
  /** Kanäle aus der Optionsgruppe meldekanal (vorgesetzte, aims, whistleblowing, postfach, formular) */
  kanaele: string[];
  /** Kanal im Wortlaut, z. B. Adresse des Postfachs oder Name der Meldestelle */
  kanal?: string;
  /** Ausweichstelle, falls die Meldung die zuständige Person betrifft */
  ausweichstelle?: PersonId;
  /** Vertrauliche (oder anonyme) Meldung möglich */
  vertraulich?: boolean;
  /** Frist für die Eingangsbestätigung in Arbeitstagen (gleiche Einheit wie MeldekanalExtern.fristTage) */
  fristTage?: number;
  /** Frist für die Rückmeldung zum Ergebnis in Tagen */
  fristErgebnisTage?: number;
  eskalation?: string;
  /** Wie der Meldeweg bekannt gemacht wird, z. B. Schulung, Intranet */
  bekanntmachung?: string;
}

/** Meldekanal für Externe: Nutzende, Kunden, Betroffene (D-14, A.8.3). Optional. */
export interface MeldekanalExtern {
  /** Adresse oder Formular, z. B. E-Mail-Adresse */
  adresse: string;
  /** Wo der Kanal veröffentlicht ist, z. B. Website, Kundenportal */
  ort?: string;
  /** Person, die Meldungen bearbeitet */
  bearbeitung?: PersonId;
  /** Frist für die Eingangsbestätigung in Arbeitstagen */
  fristTage?: number;
  /** Frist für die Antwort in Tagen */
  fristAntwortTage?: number;
  /** Bestehendes Vorfallverfahren, in das Meldungen einfliessen (mit ISMS) */
  vorfallVerfahren?: string;
  /**
   * Späteste Frist in Stunden, innert der betroffene Kunden bei einem KI-Vorfall informiert werden, z. B. aus
   * Qualitätssicherungsvereinbarungen (D-14, Kommunikation bei KI-Vorfällen). Optional.
   */
  fristKundenStunden?: number;
}

/** Gremium, das KI-Themen behandelt (D-04). Optional. */
export interface Gremium {
  name: string;
  /** neue KI-Themen im Gremium */
  themen: string;
  rhythmus: string;
  vorsitz?: PersonId;
}

/** Projektauftrag für den Aufbau des AIMS (D-00, Blatt «Projektauftrag»). Optional. */
export interface Projektauftrag {
  ziel?: string;
  nutzen?: string;
  /** interner Aufwand in Personentagen */
  aufwandPt?: number;
  /** externe Kosten in der Landeswährung (Beratung, Schulung, Werkzeuge, Zertifizierungsstelle) */
  budget?: number;
  /** Pensum der AIMS-Verantwortung in Prozent */
  pensumProzent?: number;
  sponsor?: PersonId;
  meilensteine?: { was: string; termin?: string }[];
  risiken?: string;
  freigabe?: Freigabe;
  /** wie oft der Stand in der Geschäftsleitung traktandiert ist (Optionsgruppe glTakt, früher rhythmus; z. B. vierzehntaeglich) */
  glTraktandum?: string;
  /**
   * Mitglieder des Projektteams (Personen-IDs, D-00). Leer: D-00 bildet das Team aus den Personen mit AIMS-Rollen ohne
   * interne Auditorinnen und Auditoren (Unabhängigkeit des internen Audits, 9.2). Optional.
   */
  team?: PersonId[];
  /**
   * Grober Geltungsbereich zum Zeitpunkt des Projektauftrags (D-00). Leer: Aussage aus organisation.geltungsbereich.
   * Die genaue Abgrenzung folgt in D-02. Optional.
   */
  geltungsbereich?: string;
}

/** Abgleich der KI-Leitlinie mit bestehenden Richtlinien (D-03, 5.2); «nicht-vorhanden»: keine solche Richtlinie */
export type LeitlinienAbgleich = 'angepasst' | 'verweis' | 'keine' | 'nicht-vorhanden';

/** Grundregeln der Dokumentenlenkung (D-26, 7.5). Optional. */
export interface Dokumentenlenkung {
  /** Mit ISMS: Die Lenkungsregeln des ISMS gelten auch für das AIMS */
  ismsRegelnGelten?: boolean;
  ablage?: string;
  namensregel?: string;
  /** wer Dokumente freigibt (Optionsgruppe dokumentFreigabe: geschaeftsleitung, eigner, aims) */
  freigabe?: string;
  /** Standard-Aufbewahrung in Jahren, wenn ein Dokument nichts anderes festlegt */
  aufbewahrungJahre?: number;
  /** Standard-Klassifikation für die Fusszeile, wenn ein Dokument keine eigene hat (z. B. «intern») */
  klassifikation?: string;
  /** Umgang mit Dokumenten externer Herkunft */
  extern?: string;
  /** Register der Dokumente externer Herkunft (D-26, Blatt «Externe Dokumente»); sonst Vorschlag der Vorlage. Optional. */
  externeDokumente?: ExternesDokument[];
}

/** Dokument externer Herkunft (D-26, 7.5.3): Norm, Rechtstext, Lieferanten- oder Kundendokument. Optional. */
export interface ExternesDokument {
  dokument: string;
  herausgeber: string;
  /** Ausgabe oder Stand, z. B. «2023» oder «2022 mit Amd 1:2024» */
  stand: string;
  ablage: string;
  zustaendig?: PersonId;
  naechstePruefung?: string;
}

/** Thema der Bewusstseinsbildung mit Durchführung und Nachweis (D-17, Blatt «Bewusstsein», 7.3). Optional. */
export interface Bewusstseinsthema {
  thema: string;
  inhalt: string;
  zielgruppe: string;
  kanal: string;
  datum?: string;
  nachweis?: string;
}

/** Vorgaben zur Protokollierung von KI-Systemen (D-12 Abschnitt Protokolle, E-05). Optional. */
export interface Protokollvorgaben {
  /** Inhalte aus der Optionsgruppe protokollInhalt (eingaben, ausgaben, fehler, aenderungen, nutzende) */
  inhalt?: string[];
  /** Standard-Aufbewahrung in Monaten; Abweichungen je System in kiSysteme[].protokollierung */
  aufbewahrungMonate?: number;
  /** Rhythmus der Auswertung (Optionsgruppe rhythmus) */
  auswertung?: string;
}

/** Risikobereitschaft der Geschäftsleitung (D-03). Optional. */
export interface Risikobereitschaft {
  /** Was nie erlaubt ist, z. B. «KI entscheidet allein über Anstellung oder Kündigung» */
  nie?: string[];
  /** Was nur mit Freigabe der Geschäftsleitung geht, z. B. «KI mit Wirkung auf Kunden» */
  nurGl?: string[];
  /** Was die AIMS-Verantwortung allein entscheiden darf, z. B. «Restrisiken bis zur Akzeptanzgrenze» */
  aimsAllein?: string[];
}

/** Entscheide mit festgelegten Entscheidungsrechten (D-04, Liste vorlagen.D-04.entscheide in dieser Reihenfolge) */
export const ENTSCHEIDE = ['einfuehren', 'restrisiko', 'ausnahme', 'stoppen', 'ausserbetrieb'] as const;
export type Entscheid = (typeof ENTSCHEIDE)[number];
/**
 * Risikostufen für Entscheidungsrechte (D-04): tief bis zur Akzeptanzgrenze (risikokriterien.akzeptanzBis), hoch ab der
 * Grenze «unannehmbar» (risikokriterien.unannehmbarAb), mittel dazwischen; bei Systemen ohne Risikowert die höchste
 * Stufe ihrer Risiken. Optional.
 */
export const RISIKOSTUFEN = ['tief', 'mittel', 'hoch'] as const;
export type Risikostufe = (typeof RISIKOSTUFEN)[number];

/** Wer einen Entscheid je Risikostufe trifft (D-04). wer: Personen-ID oder Funktion, z. B. «Geschäftsleitung». Optional. */
export interface Entscheidungsrecht {
  entscheid: Entscheid;
  wer: Partial<Record<Risikostufe, PersonId | string>>;
}

/** Logo der Firma, beim Import im Browser normalisiert (src/app/logik/logo.ts). Optional, ab 1.1. */
export interface GestaltungLogo {
  /**
   * Normalisiertes PNG als data:image/png;base64 (ohne Metadaten, Ränder abgeschnitten), höchstens 200 KB binär,
   * Kanten 16 bis 1600 px
   * @pattern ^data:image/png;base64,[A-Za-z0-9+/]+=*$
   * @maxLength 280000
   */
  png: string;
  /**
   * Breite des PNG in Pixeln
   * @minimum 16
   * @maximum 1600
   */
  breite: number;
  /**
   * Höhe des PNG in Pixeln
   * @minimum 16
   * @maximum 1600
   */
  hoehe: number;
  /**
   * Bereinigtes SVG (Whitelist, src/generator/svg.ts) zusätzlich für Word ab 2019; das PNG bleibt Ersatzbild. Höchstens 100 KB.
   * @maxLength 102400
   */
  svg?: string;
  art?: 'bildmarke' | 'wortmarke' | 'kombiniert';
  /**
   * Alternativtext; leer: «Logo <Firmenname>»
   * @maxLength 120
   */
  alt?: string;
  /** Herkunft für die Anzeige, ohne Pfad */
  quelle?: {
    /** @maxLength 120 */
    dateiname: string;
    format: 'png' | 'jpeg' | 'svg' | 'webp' | 'gif' | 'docx';
    /** @pattern ^[0-9a-f]{64}$ */
    sha256: string;
  };
}

/**
 * Erscheinungsbild der Firmendokumente (organisation.gestaltung). Semantische Farben (Risikostufen, Status, Ampel,
 * Hinweiskästen, Platzhalter) sind nicht wählbar, damit sie in allen Firmen dasselbe bedeuten. Optional, ab 1.1.
 */
export interface Gestaltung {
  logo?: GestaltungLogo;
  kopfzeile?: {
    /** Standard rechts */
    logoPosition?: 'links' | 'rechts';
    /** Standard true; false nur mit Logo (Wortmarke), der Name bleibt im Alternativtext und in den Dateieigenschaften */
    firmennameZeigen?: boolean;
    /**
     * Höhe des Logos in der Kopfzeile in mm; ohne Angabe nach Form (quer 9, breit 10, quadratisch und hoch 12)
     * @minimum 6
     * @maximum 15
     */
    logoHoeheMm?: number;
  };
  farben?: {
    /**
     * Primärfarbe als Hex RRGGBB ohne «#»
     * @pattern ^[0-9A-F]{6}$
     */
    primaer?: string;
    /** @pattern ^[0-9A-F]{6}$ */
    sekundaer?: string;
    /** @pattern ^[0-9A-F]{6}$ */
    akzent?: string;
    /** CI-Farbe für Titel und Überschriften (Standard true; false: Überschriften schwarz) */
    ueberschriften?: boolean;
    /** CI-Hauch für Tabellenkopf und Feldbeschriftung (Standard true) */
    tabellenkopf?: boolean;
    /** CI-Farben für neutrale Diagrammreihen (Standard true) */
    diagramme?: boolean;
    /** Tabellenkopf als Primärfläche mit weisser Schrift statt Hauch */
    tabellenkopfKraeftig?: boolean;
  };
  schrift?: {
    paar?: 'arial-cambria' | 'arial' | 'calibri' | 'aptos' | 'georgia' | 'verdana' | 'eigen';
    /**
     * Schrift für Titel, Tabellen, Kopf- und Fusszeile (nur bei paar «eigen»)
     * @maxLength 60
     * @pattern ^[^;,"<>]*$
     */
    titel?: string;
    /**
     * Schrift für den Lesetext (nur bei paar «eigen»)
     * @maxLength 60
     * @pattern ^[^;,"<>]*$
     */
    text?: string;
    /** Bestätigt: Die Schrift ist auf allen Rechnern installiert, auf denen die Dokumente bearbeitet werden. Ohne: Arial/Cambria. */
    installiertBestaetigt?: boolean;
  };
  /**
   * Kurzname für Kopfzeile und Dateinamen, z. B. «MMB»
   * @maxLength 30
   */
  kurzname?: string;
  /**
   * Zweite Zeile der Fusszeile (Adresse, Handelsregister, Website), eine Zeile
   * @maxLength 160
   * @pattern ^[^\r\n]*$
   */
  fusszeileZusatz?: string;
  /** Titelseite: keine (Standard), nur Geltungsbereich, Leitlinie und SoA (grundlagen) oder alle Word-Dokumente */
  titelseite?: 'keine' | 'grundlagen' | 'alle';
  /** Wasserzeichen «Entwurf» in nicht freigegebenen Word-Dokumenten, Vermerk in Excel (Standard true) */
  wasserzeichenEntwurf?: boolean;
  /**
   * Anzeigepräfix der Dokumentkennung, z. B. «AIMS-» ergibt «AIMS-D-07» im Dokumentkopf; intern bleibt D-07
   * @pattern ^[A-Za-z0-9._-]{0,12}$
   */
  kennungPraefix?: string;
  /**
   * Präfix auch vor die Dateinamen der erzeugten Dokumente setzen («AIMS-D-07_Risikoregister.xlsx»); Inhaltsverzeichnis
   * des Satzes folgt, Kennungen in Register und Verweisen bleiben D-07. Standard false. Optional.
   */
  kennungPraefixDateien?: boolean;
}

export interface Organisation {
  name: string;
  branche: string;
  mitarbeitende: number | null;
  standorte: string;
  /** Fragen des Startinterviews: offen, bis beantwortet (keine stille Vorbelegung «Nein») */
  euBezug: { kundenEu?: boolean; outputEu?: boolean; niederlassungEu?: boolean };
  entwickeltKi?: boolean;
  verkauftKiProdukte?: boolean;
  /** Gewünschter Termin für das Zertifikat (D-00 «Zieltermin Zertifizierung»); Stage 2 und Zertifizierungsentscheid liegen davor. */
  zielterminZertifizierung?: string;
  /**
   * Ziel Stage-1-Bereitschaft: internes Audit und Managementbewertung durchgeführt, Unterlagen bereit (Leitfaden Kapitel 4).
   * Grundlage des Fahrplans im Geführten Modus (E0), der von diesem Datum rückwärts rechnet. Optional.
   */
  zielterminStage1?: string;
  aimsVerantwortlich?: PersonId;
  /**
   * Veraltet: Logo als Data-URL (ohne Grenzen). Beim Laden übernimmt das Werkzeug ein gültiges PNG nach gestaltung.logo
   * und entfernt das Feld (src/model/gestaltung.ts); neu nur noch gestaltung.logo.
   * @deprecated
   * @maxLength 280000
   */
  logoDataUrl?: string;
  /**
   * Erscheinungsbild der Firmendokumente: Logo, CI-Farben, Schrift, Kopf- und Fusszeile, Titelseite, Wasserzeichen.
   * Gilt für Firmendokumente (Werkzeug) und Beispielsets; leere Vorlagen des Kits nutzen es nie. Der Skill setzt es nicht.
   * Optional, ab 1.1.
   */
  gestaltung?: Gestaltung;
  /** Meldeweg für Bedenken intern (D-04). Optional. */
  meldeweg?: Meldeweg;
  /** Meldekanal für Externe (D-14). Optional. */
  meldekanalExtern?: MeldekanalExtern;
  /** Bezeichnung der Meldestelle in Richtlinien und Verfahren (D-12, D-13, D-15), z. B. «AIMS-Verantwortliche, ki-meldung@firma.example». Optional. */
  meldestelle?: string;
  /** Gremien mit KI-Themen (D-04). Optional. */
  gremien?: Gremium[];
  /** Projektauftrag (D-00). Optional. */
  projektauftrag?: Projektauftrag;
  /** Grundregeln der Dokumentenlenkung (D-26). Optional. */
  dokumentenlenkung?: Dokumentenlenkung;
  /** Themen der Bewusstseinsbildung mit Datum und Nachweis (D-17); sonst Vorschlag der Vorlage. Optional. */
  bewusstsein?: Bewusstseinsthema[];
  /** Vorgaben zur Protokollierung (D-12); früher unter meta.gefuehrt.antworten.protokolle. Optional. */
  protokollierung?: Protokollvorgaben;
  /**
   * EU AI Act Art. 27: Die Organisation ist eine Einrichtung des öffentlichen Rechts oder eine private Einrichtung,
   * die öffentliche Dienste erbringt (Grundrechte-Folgenabschätzung, E-06). Optional.
   */
  oeffentlicheDienste?: boolean;
  /**
   * Risikobereitschaft der Geschäftsleitung (D-03, D-06): was nie erlaubt ist, was nur mit Freigabe der Geschäftsleitung
   * geht und was die AIMS-Verantwortung allein entscheiden darf. Je Eintrag ein kurzer Satz. Optional.
   */
  risikobereitschaft?: Risikobereitschaft;
  /**
   * Stelle über der Geschäftsleitung, die entscheidet, wenn die Geschäftsleitung selbst ein KI-System beantragt, betreibt
   * oder ein Risiko verantwortet (D-04, keine Selbstfreigabe ab hohem Risiko), z. B. «Verwaltungsrat» oder
   * «Gesellschafterversammlung». Optional.
   */
  naechsthoehereStelle?: string;
  /**
   * Entscheidungsrechte nach Risikostufe (D-04): je Entscheid, wer ihn bei tiefem, mittlerem und hohem Risiko trifft.
   * Ohne Angabe gilt der Vorschlag in D-04. Optional.
   */
  entscheidungsrechte?: Entscheidungsrecht[];
  /** Bewusst nicht gemessene Themen mit Begründung (D-05, 9.1). Optional. */
  nichtGemessen?: { was: string; begruendung: string }[];
  kontext: {
    themen: Thema[];
    klimawandelRelevant: JaNeinOffen;
    klimawandelBegruendung: string;
  };
  /** Rollen nach ISO/IEC 22989 bzw. 42001 4.1 Anm. 1 */
  rollenIso: { rolle: 'anbieter' | 'produzent' | 'kunde' | 'partner' | 'betroffene' | 'behoerde'; bemerkung: string }[];
  geltungsbereich: {
    beschreibung: string;
    grenzenOrganisation: string;
    grenzenTechnik: string;
    grenzenStandorte: string;
    schnittstellen: string;
    ausschluesse: { was: string; begruendung: string }[];
    /** ausdrücklich bestätigt, dass es keine Ausschlüsse gibt (D-02). Optional. */
    keineAusschluesseBestaetigt?: boolean;
    freigabe?: Freigabe;
  };
  leitlinie: {
    version: string;
    grundsaetze: string[];
    ausnahmeprozess: string;
    freigabe?: Freigabe;
    kommuniziertAm?: string;
    naechsteUeberpruefung?: string;
    /**
     * Höchste Gültigkeit einer Ausnahme von der Leitlinie in Monaten (D-03 Abschnitt Ausnahmen, Prüfregel H42), z. B. 6.
     * Optional.
     */
    ausnahmeHoechstMonate?: number;
    /**
     * Abgleich mit bestehenden Richtlinien (D-03). Schlüssel aus der Optionsgruppe leitlinienBezug
     * (informationssicherheit, datenschutz, qualitaet, personal, beschaffung, verhaltenskodex, nachhaltigkeit).
     * Optional.
     */
    abgleich?: Partial<Record<string, LeitlinienAbgleich>>;
    /** Bemerkung zum Abgleich, z. B. Datum und Nachweis. Optional. */
    abgleichNotiz?: string;
  };
  risikokriterien: {
    zeitraum: string; // Bezugszeitraum der Wahrscheinlichkeit, z. B. «pro Jahr»
    wahrscheinlichkeit: { stufe: number; bezeichnung: string; beschreibung: string }[];
    auswirkung: { stufe: number; bezeichnung: string; beschreibung: string }[];
    akzeptanzBis: number; // Risikowert (W x A) bis zu dem ohne Behandlung akzeptiert wird
    unannehmbarAb: number;
    ausIsmsUebernommen: boolean;
  };
}

export interface Person {
  id: PersonId;
  name: string;
  funktion: string;
  aimsRollen: string[];
}

export interface InteressiertePartei {
  id: string; // IP-001
  name: string;
  art: 'intern' | 'extern';
  anforderungen: {
    text: string;
    quelle: 'gesetz' | 'vertrag' | 'norm' | 'intern' | 'markt';
    adressiert: JaNeinOffen;
    begruendung?: string;
  }[];
}

export interface Rolle {
  id: string; // RO-001
  bereich: string; // z. B. risikomanagement, folgenabschaetzung, menschliche-aufsicht
  verantwortlich?: PersonId;
  rechenschaft?: PersonId;
  /** Stellvertretung der verantwortlichen Person. Optional. */
  stellvertretung?: PersonId;
  konsultiert: PersonId[];
  informiert: PersonId[];
}

export type KiTyp = 'eingekauft' | 'saas' | 'eigenbau' | 'schatten';
/**
 * Status eines KI-Systems. «ausgesetzt»: vorübergehend deaktiviert, z. B. bis Auflagen erfüllt sind;
 * bleibt wie «untersagt» Gegenstand des AIMS und steht mit Status im Geltungsbereich. Nur «abgeloest» entfällt dort.
 */
export type KiStatus = 'erfasst' | 'in-pruefung' | 'freigegeben' | 'eingeschraenkt' | 'ausgesetzt' | 'abgeloest' | 'untersagt';
export type AiActRolle = 'anbieter' | 'betreiber' | 'einfuehrer' | 'haendler' | 'produkthersteller' | 'bevollmaechtigter';
/** Art. 2(1) Bst. a, b, c (KiSystem.aiAct.anwendungsbereich) */
export const ANWENDUNGSBEREICHE = ['a', 'b', 'c'] as const;
export type Anwendungsbereich = (typeof ANWENDUNGSBEREICHE)[number];
/** Ergebnis der Prüfung nach Art. 5(1): keine verbotene Praktik, Buchstabe der Praktik oder unklar (KiSystem.aiAct.art5) */
export const ART5_ERGEBNISSE = ['keine', 'a', 'b', 'ba', 'bb', 'c', 'd', 'e', 'f', 'g', 'h', 'unklar'] as const;
export type Art5Ergebnis = (typeof ART5_ERGEBNISSE)[number];
/** Bezug zu Anhang I (KiSystem.aiAct.produkt.anhangI) */
export const ANHANG_I = ['nein', 'abschnitt-a', 'abschnitt-b', 'offen'] as const;
export type AnhangI = (typeof ANHANG_I)[number];
export type Risikoklasse =
  | 'offen'
  | 'verboten'
  | 'hochrisiko-anhang-iii'
  | 'hochrisiko-anhang-i'
  | 'transparenz'
  | 'minimal';

export interface KiSystem {
  id: string; // KI-001
  name: string;
  typ: KiTyp;
  beschreibung: string;
  zweck: string;
  fachbereich: string;
  eigner?: PersonId;
  lieferant?: string; // L-001
  /** Offen, bis die Frage beantwortet ist (keine stille Vorbelegung «Nein») */
  personendaten?: boolean;
  besondereDaten?: boolean;
  betroffene: string;
  automatisierung: 'unterstuetzend' | 'teilautomatisiert' | 'vollautomatisiert';
  lebenszyklus: 'idee' | 'entwicklung' | 'test' | 'betrieb' | 'ausserbetrieb';
  status: KiStatus;
  ressourcen: { daten: string; werkzeuge: string; rechenressourcen: string; personal: string };
  sensibleNutzung: boolean;
  /**
   * Das System wird mit eigenen Daten trainiert, nachtrainiert, feinabgestimmt oder angepasst, auch wenn es eingekauft
   * ist (D-13: Datenblätter für Trainings- und Testdaten, A.7.2 bis A.7.6). Eigenentwicklungen gelten ohne Angabe als
   * solche; false bei einer Eigenentwicklung heisst: eigene Anwendung auf einem fremden, vortrainierten Modell, das wir
   * nicht trainieren (D-09 verweist dann für die Trainingsdaten auf den Anbieter; D-13 führt die Daten der
   * Eigenentwicklung weiterhin). Optional.
   */
  eigenesTraining?: boolean;
  /** Messbare Anforderung an die Qualität der Daten dieses Systems, z. B. Labelgenauigkeit und Ausgewogenheit (D-13, A.7.4). Optional. */
  datenqualitaet?: string;
  aiAct: {
    rollen: AiActRolle[];
    risikoklasse: Risikoklasse;
    anhangIiiBereich?: string; // z. B. «4a»
    ausnahmeArt63?: boolean; // Art. 6(3)
    transparenz: ('50-1' | '50-2' | '50-3' | '50-4')[];
    /**
     * Verfahren der maschinenlesbaren Kennzeichnung erzeugter Inhalte nach Art. 50(2), z. B. Metadaten oder Wasserzeichen
     * (E-07). Leer: Umsetzung des Controls EUAIA-06 aus der Erklärung zur Anwendbarkeit. Optional.
     */
    kennzeichnung?: string;
    /**
     * true nur, wenn die Organisation selbst ein KI-Modell mit allgemeinem Verwendungszweck (GPAI-Modell) in Verkehr
     * bringt, also Anbieterin des Modells ist (Art. 53 ff.). Die blosse Nutzung eines GPAI-Modells oder ein System,
     * das auf einem fremden GPAI-Modell beruht (z. B. Copilot, ChatGPT), ist false. Grundlage für den Vorschlag von EUAIA-39.
     */
    gpai: boolean;
    begruendung: string;
    juristischGeprueft: boolean;
    /**
     * Räumlicher Anwendungsbereich nach Art. 2(1) je System (E-01, Spalte «Bezug»): Bst. a Inverkehrbringen oder
     * Inbetriebnahme in der EU, Bst. b Betreiber mit Sitz oder Niederlassung in der EU, Bst. c Ausgabe wird in der EU
     * verwendet. Leere Liste: kein EU-Bezug. Fehlt das Feld, leitet E-01 einen Vorschlag aus organisation.euBezug ab.
     * Optional.
     */
    anwendungsbereich?: Anwendungsbereich[];
    /** Prüfung auf verbotene Praktiken nach Art. 5(1) (E-02): «keine», Buchstabe der Praktik oder «unklar». Optional. */
    art5?: { ergebnis: Art5Ergebnis; begruendung?: string };
    /**
     * Produktbezug nach Art. 6(1) und Anhang I (E-02): Abschnitt von Anhang I, Sicherheitsbauteil (Art. 6(1) Bst. a),
     * nur nicht sicherheitsrelevante Funktionen (Art. 6(1a)), Gefährdung bei Ausfall (Art. 6(1b)), Drittprüfung
     * (Art. 6(1) Bst. b, 6(1c)) und Begründung. Optional.
     */
    produkt?: {
      anhangI: AnhangI;
      sicherheitsbauteil?: JaNeinOffen;
      nurNichtSicherheitsrelevant?: JaNeinOffen;
      ausfallGefaehrdet?: JaNeinOffen;
      drittpruefung?: JaNeinOffen;
      begruendung?: string;
    };
    /** Profiling natürlicher Personen (Art. 6(3) letzter Unterabsatz, E-02). Optional. */
    profiling?: JaNeinOffen;
    /** Registrierung in der EU-Datenbank (Art. 49(2), E-02). Optional. */
    registrierung?: 'ja' | 'nein' | 'nicht-noetig';
    /**
     * Rollenwechsel nach Art. 25(1) bei Hochrisiko-Systemen (E-01, Spalte «Rollenwechsel»): nein, Bst. a, b oder c, offen.
     * Bei Systemen ohne Hochrisiko-Bezug setzt E-01 «nicht relevant». Optional.
     */
    rollenwechsel?: 'nein' | 'a' | 'b' | 'c' | 'offen';
    /** Wer die Rolle juristisch geprüft hat und wann (E-01, Spalte «Geprüft durch, am»). Optional. */
    geprueft?: Freigabe;
    /** Wer die Risikoklasse festgelegt hat und wann (E-02, Spalte «Eingestuft durch, am»). Optional. */
    eingestuft?: Freigabe;
  };
  naechsteUeberpruefung?: string;
  erfasstAm?: string;
  geaendertAm?: string;
  /**
   * Datum des Antrags auf Nutzung (JJJJ-MM-TT; D-10 Freigabeliste, Spalte «Antrag am»; PR-07.01). Mit entscheidAm die
   * Datenquelle der Kennzahl PR-07 (Tage vom Antrag bis zum Entscheid). Ab Schemaversion 3 (AF-104).
   */
  antragAm?: string;
  /**
   * Datum des Entscheids über den Antrag (JJJJ-MM-TT; D-10 Freigabeliste, Spalte «Entscheid am»; PR-07.05 oder PR-07.10):
   * Freigabe, Freigabe mit Auflagen oder Ablehnung. Ab Schemaversion 3 (AF-104).
   */
  entscheidAm?: string;
  /** Freigabe zur Nutzung bzw. Inbetriebnahme (D-10, D-12). Optional. */
  freigabe?: Freigabe;
  /** Was protokolliert wird, wo und wie lange (D-12, D-26, E-05). Optional. */
  protokollierung?: string;
  /** Wie Nutzende und Betroffene über das System informiert werden, z. B. Hinweistext (D-14, E-07). Optional. */
  nutzerinformation?: string;
  /** Erlaubte Nutzung und Auflagen für die Freigabeliste (D-10), z. B. «nur mit menschlicher Prüfung». Optional. */
  auflagen?: string;
  /** Höchste erlaubte Datenklasse (D-10, D-15). Optional. */
  datenklasse?: Datenklasse;
  /** Begründung der Freigabe, Einschränkung oder Untersagung (D-10). Optional. */
  freigabeBegruendung?: string;
  /** Mit ISMS: Asset-ID im Inventar der Informationswerte (D-10-EB, Blatt «Ressourcen»). Optional. */
  ismsAsset?: string;
  /** Wer die Ergebnisse prüft und das System beaufsichtigt (menschliche Aufsicht, D-10, D-04). Optional. */
  aufsicht?: string;
  /**
   * Regel für Nachtrainieren und Änderungen am Modell: wer ändert, womit getestet wird, wer freigibt und wann eine
   * Änderung wesentlich ist (D-12, A.6.2.5). Optional.
   */
  aenderungsregel?: string;
  /**
   * Handlungsbefugnis (D-10, Spalte «Handlungsbefugnis»): informiert (gibt Auskunft oder entwirft), empfiehlt, bereitet vor
   * (z. B. Entwurf einer Buchung zur Bestätigung), führt begrenzt aus (einzelne Aktionen ohne Bestätigung), handelt
   * mehrstufig (plant und führt mehrere Schritte mit Werkzeugen aus, «Agent»). Prüfregel H28 ab «fuehrt-begrenzt-aus».
   * Optional.
   */
  handlungsbefugnis?: Handlungsbefugnis;
  /** Zugriffe und Werkzeuge: Systeme, Schnittstellen, Konnektoren und Werkzeuge, die das System lesen oder bedienen kann (D-10). Optional. */
  zugriffe?: string;
  /** Das System speichert ein Gedächtnis über einzelne Sitzungen hinaus (D-10, D-12 Auslöser). Optional. */
  gedaechtnis?: boolean;
  /** Wie das System gestoppt oder seine Rechte entzogen werden, und wer das darf (D-10, D-12). Optional. */
  stoppmoeglichkeit?: string;
  /** Art der KI-Aufgabe (D-10). Optional. */
  aufgabenart?: Aufgabenart;
  /** Generative KI: erzeugt Texte, Bilder, Code oder Audio (D-10; Grundlage der Vorschläge GenAI-Sicherheit in D-07). Optional. */
  generativ?: boolean;
  /**
   * Eingesetztes Modell mit Anbieter, Name und Version (D-10; Modellwechsel ist Auslöser in D-12). Bei eingekauften
   * Diensten die Angabe des Anbieters, z. B. «Modellfamilie laut Anbieter, Stand 10/2026». Optional.
   */
  modell?: { anbieter?: string; name?: string; version?: string };
  /** Kritisch für den Betrieb: Ein Ausfall stört wichtige Abläufe (D-10; Rückfallweg in rueckfallweg, Prüfregel H29). Optional. */
  kritisch?: boolean;
  /** Rückfallweg bei Ausfall oder Abschaltung, z. B. «manuelle Bearbeitung nach Checkliste» (D-10, D-12). Optional. */
  rueckfallweg?: string;
  /** Abhängigkeiten: Systeme und Abläufe vor und nach dem KI-System (D-10, Blatt Ressourcen). Optional. */
  abhaengigkeiten?: string;
  /**
   * Das System liest Inhalte Dritter, z. B. eingehende Mails, Webseiten oder Dokumente von Kunden (D-12 Missbrauchsfälle,
   * Prüfregel H32). Optional.
   */
  fremdeInhalte?: boolean;
  /** Das System ist für Personen ausserhalb der Organisation erreichbar, z. B. Chatbot auf der Website (D-12, H32). Optional. */
  oeffentlich?: boolean;
  /**
   * Missbrauchsfälle in der Prüfung vor dem Einsatz: Anzahl, Beispiele, Ergebnis und Datum, z. B. «12 Fälle,
   * bestanden am 01.10.2026» (D-12, Prüfregel H32). Optional.
   */
  missbrauchsfaelle?: string;
  /** Unterlagen aufbewahren bis (Datum, D-10), für Systeme ausser Betrieb oder abgelöst. Optional. */
  aufbewahrenBis?: string;
  /**
   * Einsatzentscheid (D-09, D-15): erwarteter Nutzen, geprüfte Lösung ohne KI und warum sie nicht genügt, Datum der
   * Wiedervorlage (Nutzen nachkontrollieren, Prüfregel H01). Optional.
   */
  einsatzentscheid?: { nutzen?: string; alternativeOhneKi?: string; wiedervorlage?: string };
  /**
   * Ausserbetriebnahme (D-12): Auslöser, alle Schritte erledigt (abhängige Abläufe, Nachfolger, Information,
   * Aufbewahrung, Löschung), Datum. Optional.
   */
  ausserbetrieb?: { ausloeser?: string; schritteErledigt?: boolean; am?: string };
  /**
   * Mess- und Prüfkonzept (Modul NIST AI RMF, Vorlage N-03; Zusatz-Controls RMF-01 und RMF-09 bis RMF-13): wichtigste
   * Vertrauensmerkmale, entschiedene Zielkonflikte, Prüfungen je Merkmal und unabhängige Überprüfung. Prüfregeln F29, H40.
   * Optional.
   */
  messkonzept?: Messkonzept;
  /**
   * Bewertung der zwölf Risiken generativer KI nach NIST AI 600-1 (Modul NIST AI RMF, Vorlage N-04). Schlüssel: Risiko-ID
   * aus src/nist-rmf/genai-risiken.yaml (z. B. «gai-konfabulation»). Nur für Systeme mit generativ. Prüfregeln F28, H39.
   * Optional.
   */
  genaiBewertung?: Record<string, GenaiBewertung>;
  /**
   * Dienst und Tarif (D-10, D-16): Die Zusagen eines Anbieters zu Training, Aufbewahrung und Vertrag hängen am Angebot,
   * nicht am Anbieter. gratis (Gratiskonto), privat (Einzel- oder Privatabo), business (Team- oder Geschäftsangebot),
   * enterprise (Unternehmensvertrag), eigenbetrieb (eigener Betrieb, eigene Plattform oder lokal). Prüfregel F30.
   * Optional.
   */
  tarif?: Tarif;
  /**
   * Funktionsschalter des Dienstes (D-10 Freigabeliste, D-16 Blatt «Dienste»): je Funktion «an» oder «aus»; fehlt ein
   * Schlüssel, ist die Einstellung offen. Schlüssel aus FUNKTIONEN. Optional.
   */
  funktionen?: Partial<Record<Funktion, FunktionStand>>;
  /** Abkündigung oder Abschaltung des Modells oder Dienstes durch den Anbieter (Datum, D-10, D-16; Prüfregel H53). Optional. */
  abkuendigung?: string;
  /**
   * Herkunft der Anbieterangaben zu Tarif, Funktionen, Modell und Abkündigung (D-10, D-16): Fundstelle beim Hersteller
   * oder Anbieter (z. B. Vertragsbedingungen, Systemkarte mit Link) und Abrufdatum. Optional.
   */
  quelleAngaben?: { fundstelle?: string; abgerufen?: string };
}

/** Tarif oder Vertragsart eines Dienstes (KiSystem.tarif, Liste vorlagen.D-10.listen.tarif in dieser Reihenfolge). */
export const TARIFE = ['gratis', 'privat', 'business', 'enterprise', 'eigenbetrieb'] as const;
export type Tarif = (typeof TARIFE)[number];
/** Tarife ohne Vertrag für Unternehmen: keine vertraulichen Daten (Prüfregel F30). */
export const TARIFE_OHNE_FIRMENVERTRAG: readonly Tarif[] = ['gratis', 'privat'];
/**
 * Funktionsschalter eines Dienstes (KiSystem.funktionen, Texte vorlagen.D-10.funktionen.<schluessel> in dieser
 * Reihenfolge): Websuche, Codeausführung, Datei-Upload, Gedächtnis, Konnektoren und Werkzeugserver, eigene Assistenten
 * und Agenten, Teilen nach aussen.
 */
export const FUNKTIONEN = ['websuche', 'codeausfuehrung', 'dateiupload', 'gedaechtnis', 'konnektoren', 'agenten', 'teilen'] as const;
export type Funktion = (typeof FUNKTIONEN)[number];
export type FunktionStand = 'an' | 'aus';

/** Vertrauensmerkmale des NIST AI RMF (Schlüssel aus src/nist-rmf/merkmale.yaml, Reihenfolge wie dort). */
export const VERTRAUENSMERKMALE = ['gueltig', 'sicher', 'geschuetzt', 'rechenschaft', 'erklaerbar', 'datenschutz', 'fair'] as const;
export type VertrauensmerkmalSchluessel = (typeof VERTRAUENSMERKMALE)[number];

/** Mess- und Prüfkonzept eines KI-Systems (KiSystem.messkonzept, N-03). Optional. */
export interface Messkonzept {
  /** Die drei bis vier wichtigsten Vertrauensmerkmale, wichtigstes zuerst (RMF-01) */
  merkmale?: VertrauensmerkmalSchluessel[];
  /** Entschiedene Zielkonflikte mit Entscheid und Begründung, z. B. «Genauigkeit vor Erklärbarkeit, weil …» (RMF-01) */
  zielkonflikte?: string;
  /** Prüfungen je Merkmal (RMF-09, RMF-11 bis RMF-13) */
  pruefungen?: MessPruefung[];
  /** Unabhängige Überprüfung der Messgrössen und Tests (RMF-10): wer (Personen-ID oder Funktion), wann, Ergebnis */
  unabhaengig?: { wer?: PersonId | string; wann?: string; ergebnis?: string };
}

/** Prüfung im Mess- und Prüfkonzept (Messkonzept.pruefungen). Optional. */
export interface MessPruefung {
  merkmal: VertrauensmerkmalSchluessel;
  /** Prüffälle aus dem Einsatz, z. B. «15 typische und 5 schwierige Anfragen» */
  prueffaelle?: string;
  messgroesse?: string;
  /** Schwelle, ab der gehandelt wird */
  schwelle?: string;
  haeufigkeit?: string;
  /** Nicht messbar: Begründung und wie stattdessen beobachtet wird */
  nichtMessbar?: string;
  /** Letztes Ergebnis mit Datum */
  ergebnis?: string;
}

/** Bewertung eines Risikos generativer KI (KiSystem.genaiBewertung, N-04). Optional. */
export interface GenaiBewertung {
  relevant: JaNeinOffen;
  begruendung?: string;
  /** Massnahme oder Verweis auf Massnahme (M-xxx) bzw. Control */
  massnahme?: string;
}

/** Handlungsbefugnis eines KI-Systems (D-10, Liste vorlagen.D-10.listen.handlungsbefugnis in dieser Reihenfolge). */
export const HANDLUNGSBEFUGNISSE = ['informiert', 'empfiehlt', 'bereitet-vor', 'fuehrt-begrenzt-aus', 'handelt-mehrstufig'] as const;
export type Handlungsbefugnis = (typeof HANDLUNGSBEFUGNISSE)[number];
/** Art der KI-Aufgabe (D-10, Liste vorlagen.D-10.listen.aufgabenart in dieser Reihenfolge). */
export const AUFGABENARTEN = ['erzeugt-inhalte', 'klassifiziert', 'prognostiziert', 'empfiehlt', 'steuert'] as const;
export type Aufgabenart = (typeof AUFGABENARTEN)[number];

/** Datenklassen der Freigabeliste (D-10, Liste vorlagen.D-10.listen.datenklasse in dieser Reihenfolge) */
export const DATENKLASSEN = ['oeffentlich', 'intern', 'vertraulich', 'streng-vertraulich'] as const;
export type Datenklasse = (typeof DATENKLASSEN)[number];

export type Behandlung = 'vermeiden' | 'vermindern' | 'teilen' | 'tragen' | 'nutzen';

export interface Risiko {
  id: string; // R-001
  art: 'risiko' | 'chance';
  titel: string;
  beschreibung: string;
  kiSystem?: string;
  quelle: string; // Risikoquelle (eigene Kategorien, angelehnt an 42001 Anhang C)
  ebenen: ('organisation' | 'individuen' | 'gesellschaft')[];
  ursache: string;
  folge: string;
  bestehendeMassnahmen: string;
  w: number | null;
  a: number | null;
  wNach: number | null;
  aNach: number | null;
  behandlung?: Behandlung;
  controls: string[];
  massnahmen: string[];
  eigner?: PersonId;
  restrisikoAkzeptiert?: Freigabe;
  /**
   * Schriftliche Begründung der Annahme eines Restrisikos über der Akzeptanzgrenze (D-06, D-07; Prüfregel H43), z. B.
   * warum das Risiko bis zum Abschluss einer Massnahme getragen wird. Optional.
   */
  restrisikoBegruendung?: string;
  /**
   * Befristete Ausnahme für ein Risiko, das vor oder nach der Behandlung nicht annehmbar ist (D-03 Ausnahmen, D-07,
   * D-10): wer sie erteilt hat und wann, gültig bis, Begründung. Prüfregeln H42 (länger als
   * organisation.leitlinie.ausnahmeHoechstMonate) und H44 (Stelle laut Entscheidungsrechten). Optional.
   */
  ausnahme?: { von: PersonId; am: string; bis: string; begruendung?: string };
  /** Datum der letzten Beurteilung oder Neubeurteilung (D-07, 8.2). Optional. */
  beurteiltAm?: string;
  /**
   * Datum der Erfassung im Register: Die Beurteilung (beurteiltAm) und die Annahme des Restrisikos liegen nicht davor
   * (Datumsprüfung der Beispiele). Optional.
   */
  erfasstAm?: string;
  ismsRisiko?: string; // Verweis auf Eintrag im ISMS-Register
  /**
   * Vorschlag aus einem Katalog, dem das Risiko entspricht, z. B. «GS-01» aus den Vorschlägen GenAI-Sicherheit (D-07):
   * gesetzt bei der Übernahme oder von Hand zugeordnet. Optional, ab Rollentest (früher nur am Text «GS-01 (» in der Beschreibung erkannt).
   */
  vorschlag?: string;
  status: 'offen' | 'in-behandlung' | 'behandelt' | 'akzeptiert' | 'geschlossen';
}

export const NUTZEN_SCHADEN_ZIELE = [
  'rechenschaft',
  'transparenz',
  'fairness',
  'datenschutz',
  'zuverlaessigkeit',
  'sicherheit',
  'erklaerbarkeit',
  'umwelt',
] as const;
export type NutzenSchadenZiel = (typeof NUTZEN_SCHADEN_ZIELE)[number];

export interface Folgenabschaetzung {
  id: string; // IA-001
  kiSystem: string;
  /** Antworten der Kurzprüfung: ohne Vorbelegung, jede Frage wird bewusst beantwortet (optional, ab Testversion 1) */
  triage: {
    rechtspositionOderChancen?: boolean;
    gesundheitOderSicherheit?: boolean;
    verletzlicheGruppen?: boolean;
    besondereDaten?: boolean;
    automatisierteEntscheidung?: boolean;
    grosseReichweite?: boolean;
    ergebnis: 'kurz' | 'voll' | 'offen';
    begruendung: string;
    /** wer die Kurzprüfung durchgeführt hat. Optional. */
    durch?: PersonId;
    /** Datum der Kurzprüfung. Optional. */
    am?: string;
  };
  systembeschreibung: string;
  verwendungen: string;
  fehlanwendungen: string;
  daten: string;
  einsatzumfeld: string;
  betroffene: { gruppe: string; art: 'direkt' | 'indirekt'; wirkung: string; konsultiert: boolean }[];
  /**
   * Nutzen und Schaden je Ziel (D-09). ausmass: Ausmass des Schadens vor Massnahmen auf der Auswirkungsskala aus D-06 (1 gering
   * bis 4 schwer), wie A vor der Behandlung in D-07 und in D-08 «Ausmass eines Schadens» festgelegt (Prüfregeln F45, F46). ausmass optional.
   */
  nutzenSchaden: Partial<Record<NutzenSchadenZiel, { nutzen: string; schaden: string; ausmass?: number | null }>>;
  /** Auswirkungen auf die Gesellschaft über die direkt Betroffenen hinaus (D-09). Optional. */
  gesellschaft?: string;
  ausfaelle: string;
  massnahmen: string;
  sensibleNutzung: boolean;
  eingeschraenkteNutzung: boolean;
  ergebnis: string;
  verknuepfteDsfa?: string;
  /**
   * Grundrechte-Folgenabschätzung nach EU AI Act Art. 27 (E-06): ob sie nötig ist und warum,
   * Verweis auf die FRIA und Mitteilung an die Behörde. Optional.
   */
  fria?: {
    erforderlich: JaNeinOffen;
    begruendung: string;
    /** Kennung oder Ablage der FRIA */
    ref?: string;
    durch?: PersonId;
    am?: string;
    behoerde?: string;
    mitgeteiltAm?: string;
    /** Zeitraum und Häufigkeit der Verwendung (E-06, Inhalt b nach Art. 27(1)(b)). Optional. */
    zeitraumHaeufigkeit?: string;
    /** Umsetzung der menschlichen Aufsicht nach der Betriebsanleitung (E-06, Inhalt e nach Art. 27(1)(e)). Optional. */
    aufsicht?: string;
  };
  freigabe?: Freigabe;
  naechsteUeberpruefung?: string;
  /**
   * Neubeurteilungen nach der ersten Freigabe, z. B. nach einem Nachtraining oder Update (D-09, 8.4): Datum, Person,
   * Anlass, Ergebnis und Freigabe. Die erste Kurzprüfung bleibt in triage. Optional.
   */
  neubeurteilungen?: Neubeurteilung[];
  /**
   * Personen oder Funktionen, die an der Abschätzung mitgewirkt haben (D-09), z. B. Fachbereich, Datenschutz, Vertretung
   * der Betroffenen: Personen-IDs oder Funktionen. Optional.
   */
  mitgewirkt?: (PersonId | string)[];
}

/** Neubeurteilung einer Folgenabschätzung (D-09). Optional. */
export interface Neubeurteilung {
  am: string;
  durch?: PersonId;
  anlass: string;
  ergebnis: string;
  freigabe?: Freigabe;
}

export type ControlStatus = 'offen' | 'geplant' | 'teilweise' | 'umgesetzt' | 'wirksam';

/** SoA-Eintrag. Katalogtexte stehen nicht in der Projektdatei, nur die ID. */
export interface ControlEintrag {
  id: string; // A.5.2, EUAIA-07, EC-01
  rahmenwerk: Rahmenwerk;
  anwendbar: JaNeinOffen;
  begruendung: string;
  status: ControlStatus;
  verantwortlich?: PersonId;
  nachweise: string[]; // N-001
  umsetzung: string;
  iso27001: string[]; // zugeordnete 27001-Controls, deren Nachweise wiederverwendet werden
  kiSysteme: string[]; // leer = alle
  /** Herkunft des Vorschlags; «nistrmf»: Zusatz-Control RMF-xx aus dem Modul NIST AI RMF */
  vorschlag?: 'risiko' | 'aiact' | 'nistrmf';
  /**
   * Prüfung der Wirksamkeit (D-11, Spalte «Wirksamkeit geprüft»): wie geprüft (z. B. Stichprobe, Test, Auswertung), wann,
   * durch wen (Personen-ID oder Funktion) und Ergebnis. Prüfregel H35. Optional.
   */
  wirksamkeit?: { wie?: string; wann?: string; wer?: PersonId | string; ergebnis?: string };
}

export interface EigenesControl {
  id: string; // EC-01
  titel: string;
  beschreibung: string;
  quelle: string;
}

export interface Nachweis {
  id: string; // N-001
  titel: string;
  art: 'dokument' | 'aufzeichnung' | 'protokoll' | 'vertrag' | 'schulung' | 'sonstiges';
  ablageort: string;
  datum?: string;
}

export interface DokumentEintrag {
  id: string; // D-03, D-06-EB, E-01
  version: string;
  status: 'entwurf' | 'in-pruefung' | 'freigegeben' | 'veraltet';
  eigner?: PersonId;
  freigabe?: Freigabe;
  naechsteUeberpruefung?: string;
  ablageort: string;
  giltFuerIsms: boolean;
  /** Klassifikation für die Fusszeile, z. B. «intern». Optional; sonst organisation.dokumentenlenkung.klassifikation. */
  klassifikation?: string;
  /** Aufbewahrungsfrist, z. B. «10 Jahre». Optional. */
  aufbewahrung?: string;
  /**
   * Ergänzungsblätter (D-xx-EB): bestehendes ISMS-Dokument mit Kennung und Version, in das die Abschnitte aufgenommen sind;
   * andere Dokumente mit Bezug «erweitert»: das ISMS-Dokument, das sie erweitern (Dokumentkopf, D-23). Optional.
   */
  aufgenommenIn?: string;
  /** Prüfung vor der Freigabe durch eine zweite Person (D-26, 7.5.2). Optional. */
  geprueft?: Freigabe;
  /**
   * Letzte Überprüfung ohne Änderung, z. B. in der Managementbewertung (D-21) oder bei der jährlichen Überprüfung: wer den
   * Inhalt als weiterhin gültig bestätigt hat und wann. Das Dokument gilt zu diesem Datum als geprüft; Verweise auf
   * Dokumente, die bis dahin freigegeben waren, erhalten keinen Zusatz «in Erarbeitung» mehr. Erscheint im Dokumentkopf
   * und im Register (D-26). Nicht vor der Freigabe der aktuellen Version. Optional.
   */
  bestaetigt?: Freigabe;
  /**
   * Änderungshistorie: je Version Datum, Änderung und Freigabe, älteste zuerst; die letzte Zeile entspricht version und
   * freigabe (D-26, Lenkungskopf, D-02). Optional.
   */
  aenderungen?: Aenderung[];
}

/** Eintrag der Änderungshistorie eines Dokuments. Optional. */
export interface Aenderung {
  version: string;
  /** Datum der Freigabe dieser Version */
  datum: string;
  /** Was geändert wurde */
  was: string;
  /** Wer die Version freigegeben hat */
  von?: PersonId;
}

export interface Massnahme {
  id: string; // M-001
  titel: string;
  beschreibung: string;
  verantwortlich?: PersonId;
  termin?: string;
  status: 'offen' | 'in-arbeit' | 'erledigt' | 'verworfen';
  prioritaet: 'hoch' | 'mittel' | 'tief';
  /** «aenderung»: geplante Änderung am AIMS (6.3, D-26); «prozess»: Massnahme zu einem Prozess (ref = PR-08, ab Prozesse) */
  herkunft: { art: 'risiko' | 'audit' | 'managementbewertung' | 'pruefung' | 'checkliste' | 'aiact' | 'ziel' | 'aenderung' | 'prozess' | 'sonstige'; ref?: string };
  /** Beginn (Verbesserungen, D-22). Optional. */
  start?: string;
  /** Abschluss am. Optional. */
  erledigtAm?: string;
  /** Datum der Erfassung; IDs werden in der Reihenfolge der Erfassung vergeben. Optional. */
  erfasstAm?: string;
  /** Nachweise der Umsetzung und Wirksamkeit (N-xxx): letztes Glied der Kette Risiko, Control, Massnahme, Nachweis (D-07, 8.3). Optional. */
  nachweise?: string[];
}

/**
 * Prüffragen vor dem Einkauf (D-16, Blatt «Prüffragen»). Die IDs sind die Schlüssel in Lieferant.pruefpunkte;
 * Themen und Fragen stehen in i18n vorlagen.D-16.fragen.<id>.
 *   PF-01 Training mit unseren Daten   PF-06 Ankündigung von Änderungen   PF-11 Protokolle
 *   PF-02 Speicherort und Region       PF-07 Meldung von Vorfällen        PF-12 Zentrale Steuerung
 *   PF-03 Aufbewahrung und Löschung    PF-08 Sicherheitsnachweise         PF-13 Rechte an Ergebnissen
 *   PF-04 Unterauftragnehmer           PF-09 Datenschutz                  PF-14 Test vor dem Kauf
 *   PF-05 Dokumentation                PF-10 Rolle nach EU AI Act (Modul) PF-15 Ausstieg
 * (Sicherheit generativer KI und Lieferkette):
 *   PF-16 Schutz vor manipulierten Eingaben   PF-18 Erweiterungen und Aktionen   PF-20 Darstellung von Antworten
 *   PF-17 Berechtigungen bei der Suche        PF-19 Kosten und Verbrauch         PF-21 Modell, Version und Komponenten
 * (handelnde KI, Einsicht des Anbieters, Nutzungsbedingungen):
 *   PF-22 Werkzeugserver und Konnektoren      PF-24 Einsicht des Anbieters       PF-26 Notstopp und Entzug
 *   PF-23 Identität von Agenten               PF-25 Zwischenspeicher, Gedächtnis PF-27 Nutzungsbedingungen, Lizenz
 * Massgebend sind Thema und Frage in D-16; der Geführte Modus (E9-lieferanten) fragt dieselben Schlüssel ab.
 */
export const PRUEFPUNKTE_LIEFERANT = ['PF-01', 'PF-02', 'PF-03', 'PF-04', 'PF-05', 'PF-06', 'PF-07', 'PF-08', 'PF-09', 'PF-10', 'PF-11', 'PF-12', 'PF-13', 'PF-14', 'PF-15', 'PF-16', 'PF-17', 'PF-18', 'PF-19', 'PF-20', 'PF-21', 'PF-22', 'PF-23', 'PF-24', 'PF-25', 'PF-26', 'PF-27'] as const;
/** Prüffragen */
export const PRUEFPUNKTE_LIEFERANT_RC2 = ['PF-16', 'PF-17', 'PF-18', 'PF-19', 'PF-20', 'PF-21'] as const;
/** Prüffragen */
export const PRUEFPUNKTE_LIEFERANT_RC3 = ['PF-22', 'PF-23', 'PF-24', 'PF-25', 'PF-26', 'PF-27'] as const;
export type PruefpunktLieferant = (typeof PRUEFPUNKTE_LIEFERANT)[number];

/**
 * Vertragsklauseln (D-16, Blatt «Vertragsklauseln»), Schlüssel in Lieferant.vertragsklauseln; Texte in i18n
 * vorlagen.D-16.klauseln.<id>. VK-13 bis VK-15 (VERTRAGSKLAUSELN_RC2), VK-16 bis VK-19
 * (VERTRAGSKLAUSELN_RC3); der Geführte Modus (E9-vertragsklauseln) fragt dieselben Schlüssel ab.
 */
export const VERTRAGSKLAUSELN = ['VK-01', 'VK-02', 'VK-03', 'VK-04', 'VK-05', 'VK-06', 'VK-07', 'VK-08', 'VK-09', 'VK-10', 'VK-11', 'VK-12', 'VK-13', 'VK-14', 'VK-15', 'VK-16', 'VK-17', 'VK-18', 'VK-19'] as const;
export const VERTRAGSKLAUSELN_RC2 = ['VK-13', 'VK-14', 'VK-15'] as const;
export const VERTRAGSKLAUSELN_RC3 = ['VK-16', 'VK-17', 'VK-18', 'VK-19'] as const;
export type Vertragsklausel = (typeof VERTRAGSKLAUSELN)[number];
export type KlauselStand = 'ja' | 'nein' | 'offen' | 'nicht-noetig';

export interface Lieferant {
  id: string; // L-001
  name: string;
  leistung: string;
  pruefstatus: 'offen' | 'in-pruefung' | 'geprueft' | 'mit-auflagen' | 'abgelehnt';
  /** Antworten auf die Prüffragen; Schlüssel PF-01 bis PF-27 (PRUEFPUNKTE_LIEFERANT). Andere Schlüssel aus älteren Dateien bleiben zulässig, werden aber nicht ausgewertet. */
  pruefpunkte: Record<string, JaNeinOffen>;
  bemerkung: string;
  naechstePruefung?: string;
  /** Stand der Vertragsklauseln; Schlüssel VK-01 bis VK-19. Optional. */
  vertragsklauseln?: Partial<Record<Vertragsklausel, KlauselStand>>;
  /** Abweichende Aufteilung der Verantwortung zum Vorschlag in D-16. Optional. */
  verantwortung?: string;
  /** Wer die Prüfung durchgeführt hat und wann (D-16, Prüfstatus). Optional. */
  geprueft?: Freigabe;
}

export interface Ziel {
  id: string; // Z-001
  ziel: string;
  kennzahl: string;
  sollwert: string;
  messmethode: string;
  haeufigkeit: string;
  verantwortlich?: PersonId;
  ressourcen: string;
  termin?: string;
  bewertung: string;
  /** sollErreicht optional */
  messungen: { datum: string; wert: string; sollErreicht?: 'ja' | 'teilweise' | 'nein'; bemerkung?: string }[];
  /** Bezug zum Grundsatz der Leitlinie (D-05). Optional. */
  bezugLeitlinie?: string;
  /** Was getan wird, um das Ziel zu erreichen. Optional. */
  massnahmen?: string;
  /** Optional. */
  status?: 'geplant' | 'in-arbeit' | 'erreicht' | 'nicht-erreicht' | 'verworfen';
  /** Wer misst (Messplan); sonst verantwortlich. Optional. */
  werMisst?: PersonId;
  /** Wann ausgewertet wird, z. B. «nach jeder Messung». Optional. */
  auswertungWann?: string;
  /** Optional. */
  werWertetAus?: PersonId;
  /** Wer das Ergebnis erhält, z. B. «Geschäftsleitung». Optional. */
  empfaenger?: string;
  /** KI-Systeme, für die das Ziel oder die Kennzahl gilt (IDs; leer = alle). Prüfregel H34. Optional. */
  kiSysteme?: string[];
}

export interface Kompetenz {
  id: string; // K-001
  rolle: string;
  anforderung: string;
  personen: PersonId[];
  /** Weitere Personen ohne eigenen Eintrag, z. B. «zwei CAM-Programmierer» (D-17). Optional. */
  gruppe?: string;
  massnahme: string;
  nachweis: string;
  wirksamkeit: string;
  /** Status «teilweise» */
  status: 'offen' | 'teilweise' | 'erfuellt';
}

export interface Kommunikation {
  id: string; // KO-001
  was: string;
  wann: string;
  wer?: PersonId;
  mitWem: string;
  wie: string;
  richtung: 'intern' | 'extern';
}

export interface Audit {
  id: string; // AU-001
  art: 'intern' | 'extern-stage1' | 'extern-stage2' | 'ueberwachung';
  kombiniertMitIsms: boolean;
  geplant?: string;
  /** Erster Audittag */
  durchgefuehrt?: string;
  /** Letzter Audittag bei mehrtägigen Audits (D-20). Optional. */
  durchgefuehrtBis?: string;
  /**
   * Datum, an dem die Zertifizierungsstelle nach diesem Audit (Stage 2, Rezertifizierung) das Zertifikat erteilt hat. Erst
   * danach sprechen die Dokumente vom «zertifizierten AIMS» (D-25). Optional.
   */
  zertifikatAm?: string;
  umfang: string;
  kriterien: string;
  auditor: string;
  unabhaengigkeit: string;
  ergebnis: string;
  /** Ziel des Audits (D-20). Optional. */
  ziel?: string;
  /** Ort oder «remote». Optional. */
  ort?: string;
  /** Methoden und Stichproben, z. B. Interviews, Dokumente, Vorführung am System. Optional. */
  methode?: string;
  /** Empfänger des Berichts. Optional. */
  berichtAn?: string;
  /** Controls im Umfang (IDs); leer = alle anwendbaren. Optional. */
  umfangControls?: string[];
  /** Prozesse im Umfang (PR-08, PS-04); leer = keine Auswahl. Optional, ab Prozesse. */
  umfangProzesse?: string[];
  /** Auditierte Personen oder Funktionen. Optional. */
  auditierte?: string;
  /** Ablauf oder Agenda. Optional. */
  agenda?: string;
  /** Auditbericht mit Kennung, Version und Ablage, z. B. im ISMS (D-20). Optional. */
  bericht?: string;
  /**
   * Ergebnisse der Checkliste je Prüfpunkt (D-20, Blatt «Checkliste 42001»). Schlüssel: Normabschnitt ohne «K-»
   * (z. B. «6.1.2») oder Control (z. B. «A.6.2.4»). Optional.
   */
  checkliste?: Record<string, ChecklistenEintrag>;
  /**
   * Stichproben und Prüftests des Audits (D-20, Blatt «Stichproben»): je Zeile Nummer des Schritts oder Tests (1 bis 13
   * wie in der Vorlage), gesehener Nachweis und Ergebnis. Optional.
   */
  stichproben?: AuditStichprobe[];
}

/** Stichprobe im internen Audit (D-20, Blatt «Stichproben»). Optional. */
export interface AuditStichprobe {
  /** Nummer der Zeile im Blatt «Stichproben» (1 bis 13) */
  nr: number;
  /** Gesehener Nachweis, z. B. KI-System, Dokument mit Version, Aufzeichnung */
  nachweis?: string;
  ergebnis?: ChecklistenEintrag['ergebnis'];
}

/** Ergebnis eines Prüfpunkts im internen Audit (D-20). Optional. */
export interface ChecklistenEintrag {
  /** Gesehener Nachweis: Dokument mit Version, Aufzeichnung oder Nachweis-ID */
  nachweis?: string;
  /** Geprüfte Stichprobe, z. B. KI-System, Datum, Person */
  stichprobe?: string;
  /**
   * Leer: aus den Feststellungen des Audits, sonst «konform», wenn ein Nachweis gesehen wurde. «nicht-pruefbar»
   *: zum Auditzeitpunkt nicht belegbar, z. B. Managementbewertung erst geplant.
   */
  ergebnis?: 'konform' | 'beobachtung' | 'nk-leicht' | 'nk-schwer' | 'nicht-geprueft' | 'nicht-pruefbar';
  /**
   * Stand des Controls in der Erklärung zur Anwendbarkeit zum Zeitpunkt des Audits (D-20, Spalte «SoA»). Die Checkliste
   * ist eine Aufzeichnung und zeigt diesen Stand, nicht den aktuellen. Ohne Angabe: aktueller Stand. Optional.
   */
  soaStand?: ControlStatus;
}

export interface Feststellung {
  id: string; // F-001
  audit?: string;
  /** «beinahe-vorfall»: Ereignis ohne Schaden, das ohne Glück oder Eingreifen ein Vorfall geworden wäre (D-22, D-14) */
  quelle: 'audit' | 'managementbewertung' | 'vorfall' | 'beinahe-vorfall' | 'pruefung' | 'meldung';
  einstufung: 'nk-schwer' | 'nk-leicht' | 'beobachtung' | 'verbesserung';
  beschreibung: string;
  normbezug: string;
  korrektur: string;
  ursache: string;
  massnahmen: string[];
  wirksamkeit?: { am: string; ergebnis: string };
  /** Geplantes Datum der Wirksamkeitsprüfung (D-22). Optional. */
  wirksamkeitGeplant?: string;
  status: 'offen' | 'in-arbeit' | 'geschlossen';
  /** Datum der Feststellung (D-22). Optional. */
  datum?: string;
  /**
   * Datum der Erfassung im Register (D-22), falls später als das Ereignis (datum), z. B. bei einem nachgetragenen
   * Vorfall. Ab diesem Datum ist die Kennung (F-xxx) vergeben; Aufzeichnungen davor nennen das Ereignis ohne Kennung.
   * Optional.
   */
  erfasstAm?: string;
  /** betroffenes KI-System. Optional. */
  kiSystem?: string;
  /** betroffener Bereich oder Prozess. Optional. */
  bereich?: string;
  /**
   * Betroffene Prozesse (PR-12, PE-01) für den Stand der Prozesse (D-21, D-27). Ohne Angabe gelten der Bereich, wenn er
   * eine Prozess-ID ist, sonst die Prozesse, deren Normbezug ein Control der Feststellung enthält. Optional.
   */
  prozesse?: string[];
  /** Methode der Ursachenanalyse, z. B. «5 Warum». Optional. */
  ursacheMethode?: string;
  /** Prüfung auf ähnliche Fälle und Ergebnis. Optional. */
  aehnlicheFaelle?: string;
  /** Risikobeurteilung angepasst (D-07). Optional. */
  risikoAngepasst?: boolean;
  /** Objektiver Nachweis: was gesehen wurde (Dokument, Aufzeichnung, Stichprobe, Aussage) (D-20, D-22). Optional. */
  nachweis?: string;
  /**
   * Ursachenkategorie KI (D-22, Spalte «Ursachenkategorie KI»), Wert aus der Liste vorlagen.D-22.listen.ursache_ki,
   * z. B. «Daten» oder «Kompetenz»; freie Angaben bleiben zulässig. Optional.
   */
  ursacheKategorie?: string;
  /** Prüfung, ob die Abweichung Dritten oder Behörden gemeldet werden muss (D-22, A.8.4, A.8.5). Optional. */
  meldepflicht?: 'ja' | 'nein' | 'nicht-noetig';
  /**
   * Schweregrad bei Vorfällen und Beinahe-Vorfällen nach D-14 (1 gering, 2 mittel, 3 erheblich, 4 schwer). Optional.
   */
  schwere?: 1 | 2 | 3 | 4;
  /**
   * Zeitpunkt der Entdeckung bei Vorfällen und Beinahe-Vorfällen (JJJJ-MM-TTThh:mm, Ortszeit; D-22 Spalte «Entdeckt»;
   * PR-19.00). Mit eingedaemmtAm die Datenquelle der Kennzahl PR-19 (Stunden bis zur Eindämmung). Ab Schemaversion 3 (AF-104).
   */
  entdecktAm?: string;
  /** Zeitpunkt der Eindämmung (JJJJ-MM-TTThh:mm, Ortszeit; D-22 Spalte «Eingedämmt»; PR-19.02). Ab Schemaversion 3 (AF-104). */
  eingedaemmtAm?: string;
}

/** Weitere Traktanden der Managementbewertung (D-21, Liste vorlagen.D-21.empfohlen in dieser Reihenfolge) */
export const MB_TRAKTANDEN = ['inventar', 'risiken', 'meldungen', 'lieferanten', 'ziele', 'ressourcen', 'aiact', 'leitlinie'] as const;
export type MbTraktandum = (typeof MB_TRAKTANDEN)[number];

export interface Managementbewertung {
  id: string; // MB-001
  datum?: string;
  kombiniertMitIsms: boolean;
  teilnehmende: string;
  eingaben: {
    statusMassnahmen: string;
    aenderungenThemen: string;
    aenderungenParteien: string;
    /** Leistung: Nichtkonformitäten und Korrekturmassnahmen (D-21 Nr. 4) */
    leistung: string;
    verbesserungen: string;
    weitere: string;
    /**
     * Leistung: Ergebnisse von Überwachung und Messung, Erreichung der KI-Ziele (D-21 Nr. 5). Leer: D-21 fasst die
     * Messungen der Ziele (ziele[].messungen) bis zum Datum der Bewertung zusammen. Optional.
     */
    messung?: string;
    /**
     * Leistung: Ergebnisse interner und externer Audits (D-21 Nr. 6). Leer: D-21 fasst die Audits bis zum Datum der
     * Bewertung mit ihren Feststellungen zusammen. Optional.
     */
    audits?: string;
    /** Stand der Prozesse (Reife, Fälligkeiten, Befunde). Leer: D-21 fasst den Prozessstand zum Datum zusammen. Optional, ab Prozesse. */
    prozesse?: string;
  };
  /**
   * Ergebnis und Bewertung je weiterem Traktandum (D-21 Abschnitt 2.2, D-21-EB «Zusätzliche Traktanden»). Schlüssel:
   * inventar, risiken, meldungen, lieferanten, ziele, ressourcen, aiact, leitlinie (Überprüfung der KI-Leitlinie, A.2.4).
   * Optional.
   */
  ergebnisse?: Partial<Record<MbTraktandum, string>>;
  entscheide: string;
  massnahmen: string[];
  /** Optional. */
  ort?: string;
  /** Sitzungsleitung. Optional. */
  leitung?: PersonId;
  /** Berichtszeitraum. Optional. */
  zeitraum?: { von: string; bis: string };
  /** Gesamturteil der Geschäftsleitung: geeignet, angemessen, wirksam (9.3). Optional. */
  gesamtbeurteilung?: {
    geeignet?: { urteil: JaNeinOffen; begruendung: string };
    angemessen?: { urteil: JaNeinOffen; begruendung: string };
    wirksam?: { urteil: JaNeinOffen; begruendung: string };
  };
  /** Entscheide einzeln (art: verbesserung, aenderung, ressourcen, ziele, restrisiko). Optional; ergänzt den Text entscheide. */
  /** Stand der Prozesse zum Datum der Bewertung (eingefroren, für «Veränderung seit der letzten Bewertung»). Optional, ab Prozesse. */
  prozesse?: { id: string; reife: ProzessReife }[];
  entscheideListe?: { art: 'verbesserung' | 'aenderung' | 'ressourcen' | 'ziele' | 'restrisiko'; text: string; verantwortlich?: PersonId; termin?: string; massnahme?: string }[];
}

/** Grobe Reife je Kapitel im Geführten Modus (Optionsgruppe reife) */
export type ReifeGrob = 'fehlt' | 'begonnen' | 'weitgehend' | 'erfuellt';
/** Reifegrad 0 bis 5 (D-00, Blatt «Reifegrade») */
export type Reifegrad = 0 | 1 | 2 | 3 | 4 | 5;

export interface GapEintrag {
  ist?: Reifegrad;
  /** leer lassen heisst: noch nicht festgelegt (typisch 3) */
  soll?: Reifegrad;
  /** heutiger Stand (Ist-Beschreibung) */
  beschreibung?: string;
}

/** Gap-Analyse (D-00). Optional. */
export interface GapAnalyse {
  datum?: string;
  /** grobe Einschätzung je Kapitel aus dem Startinterview (E1) */
  kapitel?: { k4?: ReifeGrob; k5?: ReifeGrob; k6?: ReifeGrob; inventar?: ReifeGrob; k7?: ReifeGrob; k8?: ReifeGrob; k9?: ReifeGrob; k10?: ReifeGrob };
  /** Schlüssel: Normabschnitt wie im Katalog (K-4.1 bis K-10.2) */
  abschnitte?: Record<string, GapEintrag>;
  /** Schlüssel: Control aus Anhang A (A.2.2 bis A.10.4) */
  controls?: Record<string, GapEintrag>;
}

export interface Projekt {
  schemaVersion: number;
  kitVersion: string;
  meta: Meta;
  organisation: Organisation;
  personen: Person[];
  parteien: InteressiertePartei[];
  rollen: Rolle[];
  kiSysteme: KiSystem[];
  risiken: Risiko[];
  folgenabschaetzungen: Folgenabschaetzung[];
  controls: ControlEintrag[];
  eigeneControls: EigenesControl[];
  nachweise: Nachweis[];
  dokumente: DokumentEintrag[];
  massnahmen: Massnahme[];
  lieferanten: Lieferant[];
  ziele: Ziel[];
  kompetenzen: Kompetenz[];
  kommunikation: Kommunikation[];
  audits: Audit[];
  feststellungen: Feststellung[];
  managementbewertungen: Managementbewertung[];
  /** Gap-Analyse (D-00). Optional. */
  gapAnalyse?: GapAnalyse;
  /**
   * Profil NIST AI RMF (Modul, meta.modulNistRmf): je Subkategorie (Schlüssel z. B. «GV-1.1») Ist- und Zielstufe
   * 0 bis 3, Priorität, Massnahmen (M-IDs) und Notiz (Vorlage N-01). Ohne Eintrag «ist» leitet N-01 die Stufe aus dem
   * Projekt ab (src/nist-rmf/logik.ts). Bei Subkategorien mit Präzisierung statt Zusatz-Control hält die Notiz den Entscheid
   * fest (Prüfregel F27). Optional.
   */
  nistProfil?: Record<string, NistProfilEintrag>;
  /**
   * Register der Meldungen, Rückmeldungen und Einsprüche von Mitarbeitenden, Kunden und Betroffenen (D-22, Blatt
   * «Meldungen»; D-04 Meldeweg, D-14 Meldekanal und Einspruch, A.3.3, A.8.3). Optional.
   */
  meldungen?: Meldung[];
  /**
   * Weitere Kennzahlen ohne eigenes Ziel (D-05, Messplan «weitere Messungen», 9.1). IDs KZ-01 bis KZ-06 entsprechen den
   * Zeilen der Vorlage (Wirksamkeit der Controls, interne Audits, Anzahl Meldungen, Reaktionszeit, Korrekturquote, Eignung
   * der Kennzahlen) und ersetzen deren Angaben; weitere IDs ergänzen den Messplan. Optional.
   */
  kennzahlen?: Kennzahl[];
  /** Messwerte der weiteren Kennzahlen (D-05, Blatt «Messwerte»), kennzahl = ID aus kennzahlen bzw. KZ-01 bis KZ-06. Optional. */
  kennzahlMessungen?: KennzahlMessung[];
  /**
   * Stand der Prozesse (Status-Dashboard, D-02, D-27): je Prozess aus dem Katalog src/prozesse/katalog.yaml (PR-01 bis
   * PR-27, PS-01 bis PS-11) Anwendbarkeit, Eigner, Reife, Termine, Kennzahl und optional ein eigener Ablauf. Fehlende
   * Angaben kommen aus dem Katalog. Ohne Feld nutzt das Projekt die Prozesse noch nicht (keine Prüfregeln, D-02 aus dem
   * Katalog ohne Stand). Optional, ab Prozesse.
   */
  prozesse?: ProzessEintrag[];
  /**
   * Eigene Prozesse der Firma ausserhalb des Katalogs (PE-01 ff.): Titel, Zweck, Gruppe und Art. Stand und Ablauf
   * (Bahnen, Schritte, draw.io) stehen wie bei Katalogprozessen in prozesse[] unter derselben ID. Optional.
   */
  eigeneProzesse?: EigenerProzess[];
  /**
   * Bibliothek (src/bibliothek/modell.ts): Verweise und Metadaten der Dokumente, Versionen und Nachweise; die Dateien
   * liegen im verbundenen Ordner oder im Browserspeicher, nie in der Projektdatei. Optional.
   */
  bibliothek?: Bibliothek;
}

/** Eigener Prozess der Firma (Projekt.eigeneProzesse); gleiche Gruppen und Arten wie der Katalog. Optional. */
export interface EigenerProzess {
  /**
   * PE-01, PE-02 …
   * @pattern ^PE-\d{2,3}$
   */
  id: string;
  /** @maxLength 160 */
  titel: string;
  zweck?: string;
  gruppe: 'fuehrung' | 'kern' | 'unterstuetzung' | 'bewertung';
  /** gemeinsam, gemeinsam-ki (mit ISMS gemeinsam geführt), nur-aims oder nur-isms */
  art: 'gemeinsam' | 'gemeinsam-ki' | 'nur-aims' | 'nur-isms';
  /** Abschnitte und Controls von ISO/IEC 42001 (nur Nummern, z. B. 8.1, A.6.2.6) */
  normbezug?: string[];
  /** Auslöser (D-27 «Auslöser»), je Eintrag ein kurzer Satz. Optional. */
  ausloeser?: string[];
  /** Eingaben (D-27 «Eingaben»). Optional. */
  eingaben?: string[];
  /** Ausgaben und Nachweise (D-27): was der Prozess erzeugt und wo es abgelegt ist. Optional. */
  ausgaben?: string[];
  /** Dokumente, in denen der Prozess geregelt und belegt ist (D-02 Spalte «Dokument», D-27), z. B. D-22, D-14. Optional. */
  dokumente?: string[];
  /** Kennzahl mit Sollwert (D-27 «Kennzahl»); der Messwert kommt aus prozesse[].kennzahl. Optional. */
  kennzahl?: EigeneKennzahl;
  /** Verbundene Prozesse (PR-18, PE-02): Übergaben und gemeinsame Aufzeichnungen. Optional. */
  schnittstellen?: string[];
  /** Festlegung der Schnittstellen in einem Satz, z. B. wer welche Aufzeichnung führt. Optional. */
  schnittstellenText?: string;
}

/** Kennzahl eines eigenen Prozesses (EigenerProzess.kennzahl), Einheiten und Richtung wie im Prozesskatalog. Optional. */
export interface EigeneKennzahl {
  /** Was gemessen wird, z. B. «Anteil der Rückmeldungen, die innert zwei Arbeitstagen beantwortet sind» */
  text: string;
  einheit: 'prozent' | 'anzahl' | 'monate' | 'tage' | 'stunden';
  richtung: 'mindestens' | 'hoechstens';
  soll: number;
}

/**
 * Ausführung eines Prozesses durch eine externe Stelle (ProzessEintrag.extern), z. B. IT-Partner für Zugänge oder
 * Datensicherung. Die Firma bleibt verantwortlich und steuert die Stelle (8.1, A.10.3). Optional.
 */
export interface ProzessExtern {
  /** Dienstleister im Lieferantenregister (L-004) */
  lieferant?: string;
  /** Name, falls (noch) kein Eintrag im Lieferantenregister */
  name?: string;
  /** Wie die Firma die Ausführung steuert: Vertrag, Auftrag, Bericht, Kontrolle */
  steuerung?: string;
}

/** Reife eines Prozesses (src/prozesse/reifeskala.yaml): 0 nicht begonnen, 1 definiert, 2 eingeführt, 3 wirksam, 4 überprüft */
export type ProzessReife = 0 | 1 | 2 | 3 | 4;
/** Art eines Schritts wie im Katalog: Start, Aufgabe, Entscheidung (Frage mit Zweigen), Ende */
export type ProzessSchrittArt = 'start' | 'aufgabe' | 'entscheidung' | 'ende';
/** R führt aus, A verantwortet, C wirkt mit, I wird informiert */
export type RaciWert = 'R' | 'A' | 'C' | 'I';

/** Bahn (Rolle) im Ablauf eines Prozesses: Rollenbereich (D-04), Funktion aus aimsRolle oder Zusatzrolle des Katalogs */
export interface ProzessBahn {
  /** Kennung der Bahn im Ablauf; bei Katalogbahnen gleich der Rolle */
  id: string;
  /** Eigene Beschriftung (z. B. aus draw.io); leer: Bezeichnung der Rolle */
  text?: string;
  /** Rolle: Schlüssel aus rollenBereich, aimsRolle oder prozesse.rollen; leer = noch nicht zugeordnet */
  rolle?: string;
  person?: PersonId;
}

/** Schritt eines eigenen Ablaufs (nach Bearbeitung oder draw.io-Import); gleiche Felder wie der Katalog */
export interface ProzessSchritt {
  /** PR-08.03; neue Schritte aus draw.io erhalten die nächste freie Nummer */
  id: string;
  art: ProzessSchrittArt;
  text: string;
  /** ProzessBahn.id */
  bahn: string;
  /** Nachfolger; bei Entscheidungen zwei oder mehr */
  naechste?: string[];
  /** Beschriftung der Ausgänge einer Entscheidung: Nachfolger-ID zu Text («ja», «nein») */
  zweige?: Record<string, string>;
  raci?: Record<string, RaciWert>;
  /** Verweis auf andere Prozesse (PR-09) */
  verweis?: string[];
  /** Dokumente und Nachweise (D-07, N-012) */
  dokumente?: string[];
  /**
   * Freigabe nach den Entscheidungsrechten (D-04) oder nach D-08: einfuehren, restrisiko, ausnahme, ausserbetrieb
   * (Risikostufe nach D-04), kurzpruefung (AIMS-Verantwortung, nicht die durchführende Person), abschaetzung
   * (Geschäftsleitung). Prüfregel H73. Optional.
   */
  entscheid?: 'einfuehren' | 'restrisiko' | 'ausnahme' | 'ausserbetrieb' | 'kurzpruefung' | 'abschaetzung';
}

/** Rohdaten einer draw.io-Seite für die verlustfreie Rundreise (Export mischt die Kit-Formen in diese Seite) */
export interface ProzessDrawio {
  /** Seite als unkomprimiertes XML (diagram-Element), höchstens 200 KB */
  roh: string;
  /** SHA-256 (hex) der normalisierten Seite beim Import */
  hash: string;
  importiertAm: string;
  datei?: string;
  /**
   * Beim Import offen geblieben: Bahnen ohne Rolle, Formen ohne Zuordnung (Prüfregel H61). Ordnet die Firma einer Bahn
   * in der App eine Rolle zu, entfällt sie hier.
   */
  offen?: { bahnen: string[]; formen: string[] };
}

/** Projektstand eines Prozesses (Projekt.prozesse). Optional, ab Prozesse. */
export interface ProzessEintrag {
  /** PR-08, PS-04 oder eigener Prozess PE-01 */
  id: string;
  /** ja, nein (nur bei Control- und bedingten Prozessen, mit Begründung) oder offen; leer = Vorschlag aus dem Katalog */
  anwendbar?: JaNeinOffen;
  begruendung?: string;
  eigner?: PersonId;
  stellvertretung?: PersonId;
  reife?: ProzessReife;
  /** Datum der letzten Einstufung */
  reifeAm?: string;
  /** Rhythmus (Optionsgruppe rhythmus); leer: Vorschlag des Katalogs */
  rhythmus?: string;
  /** Letzte Durchführung von Hand; sonst aus den Projektdaten abgeleitet */
  letzteDurchfuehrung?: string;
  /** Nächste Fälligkeit von Hand; sonst letzte Durchführung plus Rhythmus */
  naechsteFaelligkeit?: string;
  /** Kennzahl: Ziel (Z-001) oder weitere Kennzahl (KZ-01) */
  kennzahl?: string;
  /** Nachweise (N-012) */
  nachweise?: string[];
  /** Mit ISMS: Fundstelle im ISMS, z. B. «ISMS-Handbuch, Prozess IS-07» */
  ismsVerweis?: string;
  /** Ausführung durch eine externe Stelle (Dienstleister) und deren Steuerung (Prüfregel H71). Optional. */
  extern?: ProzessExtern;
  notiz?: string;
  /** Eigener Ablauf statt Katalogablauf (nach Bearbeitung oder draw.io-Import) */
  schritte?: ProzessSchritt[];
  bahnen?: ProzessBahn[];
  /** Rohdaten der draw.io-Seite (nach Import) */
  drawio?: ProzessDrawio;
}

/** Weitere Kennzahl im Messplan (Projekt.kennzahlen, D-05). Leere Felder übernehmen die Angabe der Vorlage. Optional. */
export interface Kennzahl {
  /** KZ-01 bis KZ-06 (Zeilen der Vorlage) oder eigene ID ab KZ-07 */
  id: string;
  kennzahl?: string;
  messmethode?: string;
  /** Rhythmus (Optionsgruppe rhythmus) */
  haeufigkeit?: string;
  werMisst?: PersonId;
  auswertungWann?: string;
  werWertetAus?: PersonId;
  empfaenger?: string;
}

/** Messwert einer weiteren Kennzahl (Projekt.kennzahlMessungen, D-05). Optional. */
export interface KennzahlMessung {
  kennzahl: string;
  datum: string;
  /** Messwert mit Herleitung, z. B. «29 von 33 (88 %)»; ohne Messung der Text aus keineMessung */
  wert: string;
  /** Vergleich mit dem Sollwert; fehlt, wenn keine Messung möglich war */
  sollErreicht?: 'ja' | 'teilweise' | 'nein';
  /** Zähler und Nenner einer Quote, aus den Aufzeichnungen ausgezählt */
  zaehler?: number;
  nenner?: number;
  /** Keine Messung möglich: kein Anlass im Zeitraum oder erste Messung noch offen; die Bemerkung nennt den Grund */
  keineMessung?: 'kein-anlass' | 'erste-offen';
  bemerkung?: string;
}

/** Meldung, Rückmeldung oder Einspruch (Projekt.meldungen, D-22). Optional. */
export interface Meldung {
  /** Kennung, z. B. ME-001 */
  id: string;
  /** Eingang am (JJJJ-MM-TT) */
  datum: string;
  /** bedenken (intern, D-04), rueckmeldung (Fehler, Hinweis), einspruch (gegen ein Ergebnis, D-14), beschwerde */
  art: 'bedenken' | 'rueckmeldung' | 'einspruch' | 'beschwerde';
  /** Herkunft: intern (Mitarbeitende) oder extern (Kunden, Betroffene, Lieferanten) */
  herkunft: 'intern' | 'extern';
  /** Eingangskanal, z. B. Postfach, Formular im Kundenportal */
  kanal?: string;
  kiSystem?: string;
  beschreibung: string;
  /** Wer bearbeitet (Personen-ID) */
  bearbeitung?: PersonId;
  /** Eingangsbestätigung am */
  bestaetigtAm?: string;
  /** Erledigt am (Antwort oder Abschluss) */
  erledigtAm?: string;
  /** Ergebnis und Antwort, Verweis auf Feststellung (F-xxx), Massnahme oder Risiko */
  ergebnis?: string;
  status: 'offen' | 'in-arbeit' | 'erledigt';
}

/** Eintrag im Profil NIST AI RMF (Projekt.nistProfil). Optional. */
export interface NistProfilEintrag {
  ist?: 0 | 1 | 2 | 3;
  ziel?: 0 | 1 | 2 | 3;
  prioritaet?: string;
  massnahmen?: string[];
  notiz?: string;
}

/** Präfixe der fortlaufenden IDs im ganzen Kit */
export const ID_PRAEFIX = {
  personen: 'P',
  parteien: 'IP',
  rollen: 'RO',
  kiSysteme: 'KI',
  risiken: 'R',
  folgenabschaetzungen: 'IA',
  eigeneControls: 'EC',
  nachweise: 'N',
  massnahmen: 'M',
  lieferanten: 'L',
  ziele: 'Z',
  kompetenzen: 'K',
  kommunikation: 'KO',
  audits: 'AU',
  feststellungen: 'F',
  managementbewertungen: 'MB',
} as const;
