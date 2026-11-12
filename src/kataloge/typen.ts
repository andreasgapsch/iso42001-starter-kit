// Struktur der sprachneutralen Kataloge (src/kataloge/*.yaml, src/ai-act/*.yaml, src/nist-rmf/*.yaml, src/prozesse/*.yaml).
import type { ProzessKatalog, Reifeskala } from '../prozesse/typen.ts';
export interface Control42001 { id: string; dokumentpflicht: boolean; vorlagen: string[]; betreiber_lite: boolean }
export interface Gruppe42001 { id: string; untergruppen?: string[]; controls: Control42001[] }
export interface Abschnitt42001 { id: string; di: 'verfuegbar' | 'aufbewahren' | 'dokumentieren' | 'keine'; vorlagen: string[]; etappe: string }
export interface Dokument {
  id: string;
  format: 'docx' | 'xlsx';
  normbezug: string;
  isms: 'neu' | 'erweitert' | 'wiederverwendet' | 'leitfaden';
  eb: boolean;
  /** modul: Modul EU AI Act (E-xx, meta.modulAiAct); modul_nist: Modul NIST AI RMF (N-xx, meta.modulNistRmf) */
  art: 'pflicht' | 'leitfaden' | 'modul' | 'modul_nist';
  ordner: 'vorlagen' | 'modul' | 'modul_nist' | 'integration';
  je_system?: boolean;
  /**
   * Prozessbeschreibung (D-27): im Firmendokument nur, wenn das Projekt Prozesse führt (Projekt.prozesse); als
   * Prozesshandbuch mit einem Kapitel je anwendbarem Prozess oder je Prozess eine Datei (VorlagenKontext.prozessId)
   */
  je_prozess?: boolean;
  datei: { de: string; en: string };
}
export interface Kataloge {
  controls42001: { gruppen: Gruppe42001[] };
  anforderungen42001: { kapitel: { id: string; abschnitte: Abschnitt42001[] }[] };
  dokumente: { dokumente: Dokument[]; gestrichen: { id: string; ersetzt_durch: string }[] };
  /** Modul NIST AI RMF (src/nist-rmf/*.yaml), Präfix nistrmf_ */
  nistrmf_subkategorien?: NistKern;
  nistrmf_rmfControls?: { schema: number; stand: string; controls: RmfControl[] };
  nistrmf_genaiRisiken?: { schema: number; stand: string; risiken: GenaiRisiko[] };
  nistrmf_merkmale?: { schema: number; stand: string; merkmale: Vertrauensmerkmal[]; ziele_ohne_merkmal: { ziel: string; subkategorien: string[] }[] };
  nistrmf_stand?: NistStand;
  /** Wörtliche Auszüge mit eigener Übersetzung (src/nist-rmf/original-100-1.yaml, original-600-1.yaml) */
  nistrmf_original1001?: NistOriginal100;
  nistrmf_original6001?: NistOriginal600;
  /** Prozesskatalog und Reifeskala (src/prozesse/katalog.yaml, reifeskala.yaml), Präfix prozesse_ */
  prozesse_katalog?: ProzessKatalog;
  prozesse_reifeskala?: Reifeskala;
  /** weitere Kataloge (27001, Mapping, AI Act) werden ergänzt, sobald sie vorliegen */
  [weitere: string]: unknown;
}

// ---------------------------------------------------------------------------------------------
// Modul NIST AI RMF (Felder siehe Kopfkommentare in src/nist-rmf/*.yaml)

export type NistFunktionId = 'govern' | 'map' | 'measure' | 'manage';
export type NistAbdeckung = 'ganz' | 'teilweise' | 'nicht';
export interface NistFunktion { id: NistFunktionId; nist_id: string; kuerzel: 'GV' | 'MP' | 'MS' | 'MG' }
export interface NistKategorie { id: string; nist_id: string; funktion: NistFunktionId }
export interface NistSubkategorie {
  id: string;
  nist_id: string;
  funktion: NistFunktionId;
  kategorie: string;
  /** K-x.y und A.x.y aus ISO/IEC 42001 */
  iso42001: string[];
  /** Abdeckung durch ISO/IEC 42001 (nach Norm) */
  abdeckung: NistAbdeckung;
  /** Abdeckung durch die Vorlagen des Kits ohne Modul (Stand nach den Kernverbesserungen rc.2) */
  abdeckung_kit: NistAbdeckung;
  kit: string[];
  nist_vorlagen?: string[];
  pruefregeln?: string[];
  zusatz_control?: string;
  praezisierung?: boolean;
  stufe: 'lite' | 'ausbau';
  etappe: string;
  genai_600_1: number;
  revision_hinweis?: boolean;
}
export interface NistKern { schema: number; stand: string; funktionen: NistFunktion[]; kategorien: NistKategorie[]; subkategorien: NistSubkategorie[] }

/** Bedingung für den Vorschlag eines RMF-Controls je KI-System (UND über alle Schlüssel, any_of = ODER) */
export interface RmfVorschlagWenn {
  immer?: boolean;
  typ_any?: ('eingekauft' | 'saas' | 'eigenbau' | 'schatten')[];
  eigenes_training?: boolean;
  rollen_any?: string[];
  transparenz_any?: string[];
  triage_rechtsposition?: boolean;
  triage_gesundheit_sicherheit?: boolean;
  generativ?: boolean;
  any_of?: RmfVorschlagWenn[];
}
export interface RmfControl {
  id: string;
  art: 'allgemein' | 'genai';
  subkategorien: string[];
  risiken?: string[];
  verwandt_42001: string[];
  verwandt_27001: string[];
  kit: string[];
  nist_vorlagen: string[];
  betreiber_lite: boolean;
  bezug_600_1: string[];
  vorschlag_wenn: RmfVorschlagWenn;
  voll_wenn?: RmfVorschlagWenn;
}
export type VertrauensmerkmalId = 'gueltig' | 'sicher' | 'geschuetzt' | 'rechenschaft' | 'erklaerbar' | 'datenschutz' | 'fair';
export interface GenaiRisiko {
  id: string;
  nr: number;
  abschnitt_600_1: string;
  kmu_relevanz: 'hoch' | 'mittel' | 'gering';
  merkmale: VertrauensmerkmalId[];
  controls: string[];
  subkategorien: string[];
  praezisierung?: boolean;
}
export interface Vertrauensmerkmal {
  id: VertrauensmerkmalId;
  abschnitt_100_1: string;
  rolle: 'grundlage' | 'querschnitt' | 'merkmal';
  /** Schlüssel aus NUTZEN_SCHADEN_ZIELE (src/model/typen.ts) */
  ziele_d09: string[];
  passung: 'gut' | 'teilweise' | 'vermischt';
  subkategorien: string[];
}
export interface NistFassung {
  id: string;
  dokument: string;
  kurzname: string;
  version: string | null;
  datei: string;
  url: string;
  pdf_url: string;
  seiten: number;
  [weitere: string]: unknown;
}
export interface NistStand {
  schema: number;
  id: string;
  geprueft_am: string;
  naechste_pruefung: string;
  hinweis_nach_monaten: number;
  fassungen: NistFassung[];
  revision: { status: string; geprueft_am: string; angekuendigt: string; quellen: string[]; betroffen_vermutet: string[] };
  weitere: { id: string; status: string; datum: string; im_kit: boolean; [weitere: string]: unknown }[];
  abgleich: { id: string; anbieter: string; verwendung: string; [weitere: string]: unknown }[];
  lizenz: { status: string; grundlage: string; ausserhalb_usa?: string; vermerk?: string; geprueft_am?: string; quellen: string[]; abbildungen_uebernehmen: boolean; pdf_im_kit: boolean };
  pdf_pruefung: { geprueft_am: string; ergebnis: string; dateien: { datei: string; quelle: string; sha256: string }[] };
}
/** Quelle der wörtlichen NIST-Auszüge mit Vermerk und Hinweis zur Übersetzung */
export interface NistZitatQuelle {
  dokument: string;
  titel: string;
  datum: string;
  doi: string;
  datei: string;
  vermerk: string;
  uebersetzung: { de: string; en: string };
  fundstellen: string;
}
/** Wörtlicher Auszug (zitat, Englisch) mit eigener Übersetzung (de); seite = PDF-Seite in quelle.datei */
export interface NistZitat { id: string; seite: number; bis_seite?: number; zitat: string; de: string }
export interface NistOriginal100 {
  schema: number;
  stand: string;
  quelle: NistZitatQuelle;
  funktionen: (NistZitat & { name: string; abschnitt: string; titel_zitat: string; titel_seite?: number })[];
  kategorien: NistZitat[];
  subkategorien: NistZitat[];
  merkmale: (NistZitat & { abschnitt: string })[];
}
export interface NistOriginal600 {
  schema: number;
  stand: string;
  quelle: NistZitatQuelle;
  risiken: (NistZitat & { nr: number; abschnitt: string; titel_zitat: string; abschnitt_titel_zitat: string; titel_de: string })[];
  massnahmen: (NistZitat & { subkategorie: string })[];
}
/** src/nist-rmf/seiten.json: PDF-Seite je Kategorie/Subkategorie (AI 100-1), Subkategorie (Playbook), Risiko (AI 600-1) */
export interface NistSeiten {
  stand: string;
  quelle: Record<'ai-100-1' | 'playbook' | 'ai-600-1', string>;
  seitenzahl: Record<'ai-100-1' | 'playbook' | 'ai-600-1', number>;
  'ai-100-1': Record<string, number>;
  playbook: Record<string, number>;
  'ai-600-1': Record<string, number>;
}

export function alleControls42001(k: Kataloge): Control42001[] {
  return k.controls42001.gruppen.flatMap((g) => g.controls);
}
export function alleAbschnitte42001(k: Kataloge): Abschnitt42001[] {
  return k.anforderungen42001.kapitel.flatMap((kap) => kap.abschnitte);
}
/** Gehört das Dokument zum Projekt? Moduldokumente nur mit eingeschaltetem Modul (E-xx: AI Act, N-xx: NIST AI RMF). */
/**
 * Gehört das Dokument zum Projekt? Module nach Schalter; die Prozessbeschreibung (je_prozess, D-27) nur, wenn das Projekt
 * Prozesse führt (mitProzessen = Projekt.prozesse vorhanden). Ohne Angabe zu mitProzessen gilt sie als enthalten.
 */
export function dokumentImProjekt(d: Pick<Dokument, 'art'> & { je_prozess?: boolean }, meta: { modulAiAct: boolean; modulNistRmf?: boolean }, mitProzessen?: boolean): boolean {
  if (d.je_prozess && mitProzessen === false) return false;
  if (d.art === 'modul') return meta.modulAiAct;
  if (d.art === 'modul_nist') return meta.modulNistRmf === true;
  return true;
}
export function dokument(k: Kataloge, id: string): Dokument {
  const d = k.dokumente.dokumente.find((x) => x.id === id);
  if (!d) throw new Error(`Unbekanntes Dokument ${id}`);
  return d;
}
