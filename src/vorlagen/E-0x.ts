// Gemeinsame Bausteine der Modulvorlagen E-01 bis E-09 (EU AI Act).
// Liest Pflichten, Zusatz-Controls und Stand aus den Katalogen (src/ai-act) und setzt Fundstellen mit
// Seitenzahl der konsolidierten Fassung (src/ai-act/artikel-seiten.json), z. B. «Art. 26(7), S. 37».
import seiten from '../ai-act/artikel-seiten.json' with { type: 'json' };
import type { Block, Text } from '../generator/ir.ts';
import type { AiActRolle, KiSystem, Projekt, Risikoklasse } from '../model/typen.ts';
import { erstelleHelfer, md, type Helfer, type VorlagenKontext } from './kontext.ts';

export const ROLLEN: AiActRolle[] = ['anbieter', 'betreiber', 'einfuehrer', 'haendler', 'produkthersteller', 'bevollmaechtigter'];
export const KLASSEN: Risikoklasse[] = ['offen', 'verboten', 'hochrisiko-anhang-iii', 'hochrisiko-anhang-i', 'transparenz', 'minimal'];

export interface Pflicht {
  id: string;
  artikel: string;
  rollen: AiActRolle[];
  risikoklassen: (Risikoklasse | 'alle')[];
  bedingung: Record<string, unknown> | null;
  gilt_ab: string;
  gilt_ab_je_klasse?: Record<string, string>;
  gilt_praktisch_ab?: string;
  gilt_praktisch_je_klasse?: Record<string, string>;
  kmu_erleichterung: string;
  abdeckung_42001: { grad: 'ganz' | 'teilweise' | 'nicht'; controls: string[]; klauseln: string[] };
  zusatz_control?: string;
  vorlage: string[];
  kmu_relevanz: string;
}

export interface Frist {
  id: string;
  datum: string;
  art: 'geltung' | 'uebergang' | 'kommission';
  artikel: string;
  /** Fundstelle in einem anderen Rechtsakt (ID unter fassung.aenderungen, z. B. M1) statt der konsolidierten Fassung */
  dokument?: string;
  /** Seite in der PDF dieses Rechtsakts je Sprache */
  seite?: { de: number; en: number };
}

export interface Aenderungsakt {
  id: string;
  rechtsakt: string;
  /** Beigelegte PDF je Sprache im Ordner der Rechtstexte */
  datei?: { de: string; en: string };
}

export interface Stand {
  geprueft_am: string;
  fassung: { datum: string; rechtsakt: string; aenderungen?: Aenderungsakt[] };
  fristen: Frist[];
  hinweise: { id: string; status: 'rechtstext' | 'auslegung' | 'zu_pruefen'; stand?: string }[];
}

const SEITEN = seiten as unknown as { de: Record<string, number>; en: Record<string, number> };

/** Seitenschlüssel aus einer Fundstelle: «26(7)» -> art-26, «Anhang III ...» -> anhang-iii */
/** Fundstellen sind in den Katalogen deutsch notiert; für EN übertragen */
export function aiActAngabeSprache(text: string, sprache: 'de' | 'en'): string {
  if (sprache === 'de') return text;
  return text
    .replace(/\bAnhänge\b/g, 'Annexes')
    .replace(/\bAnhang\b/g, 'Annex')
    .replace(/\bAbschnitt\b/g, 'Section')
    .replace(/\bNr\.\s*/g, 'point ')
    .replace(/\bUAbs\.\s*/g, 'subparagraph ')
    .replace(/\blit\.\s*/g, 'point ')
    .replace(/\bbis\b/g, 'to')
    .replace(/\bund\b/g, 'and')
    .replace(/\bVO\b/g, 'Regulation')
    .replace(/\bin der Fassung von\b/g, 'as amended by');
}

/**
 * Linkziel einer Frist in einem anderen Rechtsakt (Frist.dokument): PDF und Seite in der Sprache, z. B. Art. 8 der
 * Maschinenverordnung in der Änderungsverordnung (EU) 2026/1744. Ohne dokument: undefined (konsolidierte Fassung).
 */
export function fristDokument(stand: Pick<Stand, 'fassung'> | null | undefined, f: Pick<Frist, 'dokument' | 'seite'>, sprache: 'de' | 'en'): { datei: string; seite?: number; rechtsakt: string } | undefined {
  if (!f.dokument) return undefined;
  const akt = stand?.fassung.aenderungen?.find((a) => a.id === f.dokument);
  const datei = akt?.datei?.[sprache];
  return akt && datei ? { datei, rechtsakt: akt.rechtsakt, ...(f.seite ? { seite: f.seite[sprache] } : {}) } : undefined;
}

export function seitenSchluessel(fundstelle: string): string | undefined {
  const anhang = /^(?:Anhang|Annex)\s+([IVX]+)\b/.exec(fundstelle.trim());
  if (anhang) return `anhang-${anhang[1]!.toLowerCase()}`;
  const art = /^(?:Art\.\s*)?(\d{1,3}[a-z]?)\b/.exec(fundstelle.trim());
  return art ? `art-${art[1]}` : undefined;
}

export function istHochrisiko(k: Risikoklasse): boolean {
  return k === 'hochrisiko-anhang-iii' || k === 'hochrisiko-anhang-i';
}

/** Gilt eine Pflicht für ein System (Rolle, Klasse, Bedingung)? Unbestimmbare Bedingungen gelten als erfüllt. */
export function pflichtGiltFuer(p: Pflicht, s: KiSystem, projekt: Projekt): boolean {
  if (!p.rollen.some((r) => s.aiAct.rollen.includes(r))) return false;
  const klasse = s.aiAct.risikoklasse;
  if (klasse !== 'offen' && !p.risikoklassen.includes('alle') && !p.risikoklassen.includes(klasse)) return false;
  const b = p.bedingung ?? {};
  if (Array.isArray(b['transparenz_any']) && !(b['transparenz_any'] as string[]).some((t) => s.aiAct.transparenz.includes(t as never))) return false;
  if (b['gpai'] === true && !s.aiAct.gpai) return false;
  if (b['ausnahme_art_6_3'] === true && !s.aiAct.ausnahmeArt63) return false;
  if (b['org_niederlassung_eu'] === false && projekt.organisation.euBezug.niederlassungEu) return false;
  return true;
}

export function modulHelfer(ctx: VorlagenKontext, h: Helfer) {
  const { u, kataloge } = ctx;
  const g = (s: string) => `vorlagen.E-0x.${s}`;
  const stand = kataloge['aiact_stand'] as Stand;
  const pflichten = (kataloge['aiact_pflichten'] as { pflichten: Pflicht[] }).pflichten;
  const seitenMap = SEITEN[u.sprache];

  const seite = (fundstelle: string): number | undefined => {
    const s = seitenSchluessel(fundstelle);
    return s ? seitenMap[s] : undefined;
  };

  /** «Art. 26(7), S. 37»; Anhänge als «Anhang III, S. 131»; ohne Seite nur die Angabe */
  const fundstelle = (angabe: string): string => {
    const istAnhang = /^(?:Anhang|Annex)\b/.test(angabe);
    // Fundstellen in anderen Rechtsakten (z. B. Maschinenverordnung) ohne Seitenzahl
    const istFremd = /VO \(EU\)|Verordnung|Richtlinie|Regulation|Directive/.test(angabe);
    const text = istAnhang || istFremd || /^Art\./.test(angabe) ? angabe : `${u.t(g('art'))} ${angabe}`;
    const n = istFremd ? undefined : seite(angabe);
    const lokal = aiActAngabeSprache(text, u.sprache);
    return n === undefined ? lokal : u.t(g('fundstelle'), { angabe: lokal, seite: n });
  };

  const datum = (iso: string | undefined): string => h.datum(iso) ?? '';

  /** AI-Act-Bezug: Fundstellen und Stand der Fassung (in allen Modi) */
  const aiActBezug = (angaben: string[]): Block => ({
    typ: 'hinweis',
    art: 'normverweis',
    titel: u.t(g('titel_bezug')),
    text: u.t(g('bezug'), { fundstellen: angaben.map(fundstelle).join('; '), rechtsstand: h.rechtsstand(), geprueft: datum(stand.geprueft_am) }),
  });

  /**
   * Hinweis auf juristische Prüfung (in allen Modi). Leere Vorlage: Anleitung an die Ausfüllenden; Firmendokument:
   * Festlegung der Firma (Schlüssel <schluessel>_firma, sonst der allgemeine Text juristisch_firma).
   */
  const juristisch = (schluessel?: string): Block => ({
    typ: 'hinweis',
    art: 'normverweis',
    titel: u.t(g('titel_juristisch')),
    text: md(h.istLeer ? u.t(schluessel ?? g('juristisch')) : (schluessel ? u.tOpt(`${schluessel}_firma`) : undefined) ?? u.t(g('juristisch_firma'))),
  });

  /** Stand der Rechtslage mit Prüfdatum (Rechtsstand aus src/ai-act/stand.yaml) */
  const standText = (): string => u.t(g('stand'), { rechtsstand: h.rechtsstand(), geprueft: datum(stand.geprueft_am) });

  const rolle = (r: AiActRolle): string => u.liste(g('rollen'))[ROLLEN.indexOf(r)]!;
  const rollenText = (s: KiSystem): string => (s.aiAct.rollen.length ? s.aiAct.rollen.map(rolle).join(', ') : u.t('allgemein.offen'));
  const klasse = (k: Risikoklasse): string => u.liste(g('klassen'))[KLASSEN.indexOf(k)]!;
  const jaNein = [u.t('allgemein.ja'), u.t('allgemein.nein')];
  const jaNeinOffen = [u.t('allgemein.ja'), u.t('allgemein.nein'), u.t('allgemein.offen')];
  const jn = (v: boolean): string => jaNein[v ? 0 : 1]!;

  /** Geltungsbeginn je Klasse als Text, z. B. «02.12.2027 (Anhang III), 02.08.2028 (Anhang I)» */
  const geltung = (einfach: string | undefined, jeKlasse: Record<string, string> | undefined, nurKlassen?: Risikoklasse[]): string => {
    if (jeKlasse) {
      const eintraege = Object.entries(jeKlasse).filter(([kl]) => !nurKlassen?.length || nurKlassen.includes(kl as Risikoklasse));
      const liste = eintraege.length ? eintraege : Object.entries(jeKlasse);
      return liste.map(([kl, d]) => `${datum(d)} (${u.t(g(`klasse_kurz.${kl}`))})`).join(', ');
    }
    return datum(einfach);
  };
  const giltAb = (p: Pflicht, nurKlassen?: Risikoklasse[]) => geltung(p.gilt_ab, p.gilt_ab_je_klasse, nurKlassen);
  const giltPraktisch = (p: Pflicht, nurKlassen?: Risikoklasse[]) =>
    p.gilt_praktisch_ab || p.gilt_praktisch_je_klasse ? geltung(p.gilt_praktisch_ab, p.gilt_praktisch_je_klasse, nurKlassen) : giltAb(p, nurKlassen);

  const frist = (id: string): string => datum(stand.fristen.find((f) => f.id === id)?.datum);

  /** Tabelle aus YAML-Zeilen (Listen von Strings) mit Auszeichnung */
  const tabelle = (kopf: string, zeilen: string, breiten: number[], ersetzen?: (z: string) => string): Block => ({
    typ: 'tabelle',
    kopf: u.liste(kopf),
    zeilen: (u.roh(zeilen) as string[][]).map((z) => z.map((zelle) => md(ersetzen ? ersetzen(zelle) : zelle))),
    breiten,
  });

  /** Ersetzt {fs:26(7)}, {frist:FRIST-13} und {rechtsstand} in Texten durch Fundstelle, Datum bzw. Rechtsstand */
  const fuelle = (text: string): string =>
    text
      .replace(/\{fs:([^}]+)\}/g, (_, a: string) => fundstelle(a))
      .replace(/\{frist:([A-Z0-9-]+)\}/g, (_, id: string) => frist(id))
      .replace(/\{rechtsstand\}/g, () => h.rechtsstand());

  const ph = (text: string): Text => [{ text, platzhalter: true }];

  return { g, stand, pflichten, seite, fundstelle, datum, aiActBezug, juristisch, standText, rolle, rollenText, klasse, jaNein, jaNeinOffen, jn, giltAb, giltPraktisch, frist, tabelle, fuelle, ph };
}

export type ModulHelfer = ReturnType<typeof modulHelfer>;

/** Fusszeile wie in den Kernvorlagen (Klassifikation aus dem Dokumentenregister) */
export function fusszeile(ctx: VorlagenKontext, id: string): Text {
  return erstelleHelfer(ctx).fusszeile(id);
}
