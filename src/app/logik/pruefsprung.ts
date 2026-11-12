// Sprungziele der Prüfregeln im Guide: Auf der Prüfseite E13-pruefung führt jeder Befund zu der Seite,
// auf der sich die Angabe im Guide beheben lässt (ohne Umweg über die Formularansicht).
import type { Projekt } from '../../model/typen.ts';
import { aktiveEtappen, aktiveSeiten, seitenIndex } from './gefuehrt.ts';
import type { GefuehrtDaten } from './gefuehrt-typen.ts';
import { istLeer } from './pfad.ts';
import type { Route } from './routen.ts';

interface BefundOrt {
  regel: string;
  id?: string;
  bereich?: string;
  /** Verweisart im Schema (F33): ordnet den Befund einer Seite des Guides zu */
  verweisFeld?: string;
  /** Eintrag und Feld, wenn der Befund sie nennt (F43): Sprung genau dorthin */
  eintrag?: string;
  feld?: string;
}

type Ziel = string[] | ((p: Projekt, b: BefundOrt, g: GefuehrtDaten) => string[]);

const soaSeite = (b: BefundOrt) =>
  b.id?.startsWith('EUAIA') ? ['E8-euaia'] : b.id?.startsWith('RMF-') ? ['E8-rmf'] : b.id?.startsWith('A.') ? ['E8-soa'] : ['E8-eigene'];

const system = (p: Projekt, b: BefundOrt) => p.kiSysteme.find((s) => s.id === b.id);

/** Seiten je Bereich der Zeitregeln (F39 bis F41) und Rückfall für F33; Organisation nach der Kennung des Eintrags */
const BEREICH_SEITEN: Record<string, string[]> = {
  inventar: ['E4-systeme'], risiken: ['E6-register'], folgen: ['E7-freigabe'], managementbewertung: ['E12-mb'], ziele: ['E11-messungen', 'E11-ziele'],
  nachweise: ['E8-nachweise'], audits: ['E12-audit'], feststellungen: ['E12-korrektur'], massnahmen: ['E8-massnahmen'], dokumente: ['E11-dokumente'],
  lieferanten: ['E9-lieferanten'], kommunikation: ['E10-kommunikation'], kompetenz: ['E10-kompetenzen'], nistrmf: ['E12-rmf-profil', 'J-rmf'],
};

function bereichSeiten(_p: Projekt, b: BefundOrt): string[] {
  if (b.bereich === 'soa') return soaSeite(b);
  if (b.bereich === 'organisation') return ({ leitlinie: ['E3-leitlinie-freigabe'], geltungsbereich: ['E2-freigabe'], projektauftrag: ['E1-freigabe'] } as Record<string, string[]>)[b.id ?? ''] ?? ['E3-grundsaetze'];
  return BEREICH_SEITEN[b.bereich ?? ''] ?? [];
}

/** Guide-Seiten, die das Feld der Verweisart (organisation.entscheidungsrechte[].wer.tief) enthalten; sonst nach Bereich (F33) */
function verweisSeiten(b: BefundOrt, g: GefuehrtDaten): string[] {
  const feld = (b.verweisFeld ?? '').replace(/\[\]/g, '');
  if (g && feld) {
    const basis: Record<string, string | undefined> = { liste: undefined, 'auswahl-systeme': 'kiSysteme', folgenabschaetzung: 'folgenabschaetzungen', soa: 'controls' };
    const treffer = g.seiten.filter((s) => (s.felder ?? []).some((f) => {
      const wurzel = s.typ === 'liste' ? s.liste : basis[s.typ];
      const pfade = [f.pfad, ...(f.spalten ?? []).map((sp) => (f.pfad && sp.pfad ? `${f.pfad}.${sp.pfad}` : undefined))];
      return pfade.some((pf) => {
        if (!pf) return false;
        const voll = s.typ === 'formular' ? pf : wurzel ? `${wurzel}.${pf}` : '';
        return voll !== '' && (feld === voll || feld.startsWith(`${voll}.`));
      });
    }));
    if (treffer.length) return treffer.map((s) => s.id);
  }
  return bereichSeiten({} as Projekt, b);
}

/**
 * Regeln ohne Seite im Guide, mit Grund (AF-139). Ein Befund dieser Regeln hält keine Guide-Seite offen: Er betrifft Prozesse
 * (eigene Ansicht), die Bibliothek, die optionale Gestaltung oder einen Stand, den kein Neuling beheben kann.
 */
export const OHNE_GUIDE_SEITE: Record<string, string> = {
  H15: 'Stand der AI-Act-Daten des Kits: hängt am Datum, nicht an Eingaben im Guide',
  ...Object.fromEntries(['F31', 'F32', 'F35', 'H55', 'H56', 'H57', 'H58', 'H59', 'H60', 'H61', 'H62', 'H67', 'H68', 'H71', 'H72', 'H73', 'H74', 'H75', 'H84'].map((r) => [r, 'Prozesse: eigene Ansicht, keine Seite im Guide'])),
  H64: 'Dokumentgestaltung: optionale Seite, zählt nicht zum Fortschritt (Einstellungen)',
  H65: 'Dokumentgestaltung: optionale Seite, zählt nicht zum Fortschritt (Einstellungen)',
  ...Object.fromEntries(['H76', 'H77', 'H78', 'H79', 'H80', 'H87'].map((r) => [r, 'Bibliothek: eigener Bereich, keine Seite im Guide'])),
};

/** Je Regel die Seiten in Vorzugsreihenfolge; die erste aktive Seite gilt. */
const ZIELE: Record<string, Ziel> = {
  F01: ['E4-systeme'],
  F02: ['E6-register'],
  // Vollständige Abschätzung fehlt: zur ersten Lücke (Kurzprüfung, Betroffene, Nutzen und Schaden je Ziel)
  F03: (p, b) => {
    const voll = p.folgenabschaetzungen.find((f) => f.kiSystem === b.id && f.triage.ergebnis === 'voll');
    if (!voll) return ['E7-triage-ergebnis'];
    if (voll.betroffene.length === 0) return ['E7-betroffene'];
    return ['E7-ziele-a'];
  },
  F04: ['E7-freigabe'],
  // Freigabe oder Datum am Ort der Eingabe: Leitlinie und Geltungsbereich im Guide, sonst Register, Audit, Bewertung
  H88: (_p, b) => (b.id === 'D-00' ? ['E1-freigabe'] : b.id === 'D-02' ? ['E2-freigabe'] : ['E3-leitlinie-freigabe']),
  H89: (p, b) => {
    if (b.id === 'D-00') return ['E1-freigabe'];
    if (b.id === 'D-02') return ['E2-freigabe'];
    if (b.id === 'D-03') return ['E3-leitlinie-freigabe'];
    if (p.managementbewertungen.some((m) => m.id === b.id)) return ['E12-mb'];
    if (p.audits.some((x) => x.id === b.id)) return ['E12-audit'];
    if (p.folgenabschaetzungen.some((x) => x.id === b.id)) return ['E7-freigabe'];
    return ['E11-dokumente'];
  },
  F05: (_p, b) => soaSeite(b),
  F06: (_p, b) => soaSeite(b),
  F07: ['E8-umsetzung'],
  F08: ['E8-behandlung'],
  F09: ['E8-restrisiko'],
  F10: ['E8-plan-freigabe', 'E8-plan-freigabe-eb'],
  F11: (p) => (istLeer(p.organisation.geltungsbereich.beschreibung) ? ['E2-grenzen'] : ['E2-freigabe']),
  F12: (p) => (istLeer(p.organisation.leitlinie.grundsaetze) ? ['E3-grundsaetze'] : ['E3-leitlinie-freigabe']),
  F13: (p, b) => {
    const z = p.ziele.find((x) => x.id === b.id);
    return z && !istLeer(z.verantwortlich) && !istLeer(z.termin) && !(istLeer(z.kennzahl) && istLeer(z.sollwert)) ? ['E11-messplan'] : ['E11-ziele'];
  },
  F14: ['E3-pflichtrollen'],
  F15: ['E12-audit'],
  F16: ['E12-mb'],
  F17: ['E12-korrektur'],
  F18: ['E8-massnahmen'],
  F19: (p) => {
    const k = p.organisation.risikokriterien;
    if (istLeer(k.zeitraum)) return ['E6-zeitraum'];
    if (istLeer(k.wahrscheinlichkeit) || istLeer(k.auswirkung)) return ['E6-skalen'];
    return ['E6-akzeptanz'];
  },
  F20: ['E2-parteien'],
  H91: (_p, b) => (b.id === 'quellen' ? ['E4-suche'] : ['E2-themen']),
  F21: ['E8-behandlung'],
  F22: ['E5-rolle'],
  F23: ['E5-risikoklasse'],
  F24: ['E4-systeme'],
  F25: ['E8-euaia'],
  F26: ['E7-triage-ergebnis'],
  // Kennzahl ohne Datenquelle (P14): Antrag und Entscheid im Inventar, Entdeckung und Eindämmung bei den Vorfällen
  F43: (_p, b) => (b.id === 'PR-07' ? ['E4-ueberpruefung'] : b.id === 'PR-19' ? ['E12-feststellungen'] : ['E11-kennzahlen']),
  H01: (_p, b) => ({ inventar: ['E4-ueberpruefung'], dokumente: ['E11-dokumente'], folgen: ['E7-ergebnis'], lieferanten: ['E9-lieferanten'], organisation: ['E3-ausnahmen'] })[b.bereich ?? ''] ?? [],
  H02: ['E4-schatten'],
  H03: ['E6-isms-skalen'],
  H04: (_p, b) => soaSeite(b),
  H05: ['E10-kompetenzen'],
  H06: ['E10-kommunikation'],
  H07: ['E7-triage'],
  H08: ['E9-entwicklung'],
  H09: ['E9-dokumentation'],
  H10: ['E9-meldekanal-soa'],
  H11: ['E12-audit'],
  H12: (_p, b) => soaSeite(b),
  H13: ['E3-grundsaetze'],
  H14: ['E9-betreiber-info'],
  H16: ['E9-anbieter'],
  H17: ['E7-triage-ergebnis'],
  H81: ['E7-ergebnis'],
  H82: ['E6-akzeptanz'],
  H18: ['E7-freigabe'],
  // Datumskonsistenz: Freigabe der Folgenabschätzung, des Behandlungsplans, der SoA bzw. Rolle und Einstufung
  H19: ['E7-freigabe'],
  H20: ['E8-plan-freigabe', 'E8-plan-freigabe-eb'],
  H21: ['E8-soa'],
  H22: ['E7-freigabe'],
  H23: ['E5-rolle'],
  H24: (_p, b) => soaSeite(b),
  H25: ['E11-dokumente'],
  H26: ['E1-auftrag'],
  H27: ['E11-dokumente'],
  // Ab rc.2: handelnde KI zur ersten fehlenden Angabe (Stoppmöglichkeit, Protokolle, Aufsicht)
  H28: (p, b) => {
    const s = system(p, b);
    if (!s || istLeer(s.stoppmoeglichkeit)) return ['E4-handlung'];
    if (istLeer(s.protokollierung)) return ['E9-protokolle-systeme'];
    return ['E4-daten'];
  },
  H29: ['E9-rueckfall'],
  H30: ['E9-ausserbetrieb'],
  H31: ['E7-einsatzentscheid'],
  H32: ['E9-missbrauch'],
  H33: ['E4-generativ'],
  H34: ['E11-ziele'],
  H35: ['E8-wirksamkeit'],
  // Stage-1-Runde 4: Ausnahme und Restrisiko (Risiko), Entscheidungsrechte (System oder Risiko), Lieferant, Prüfvermerk, Wirksamkeit
  H42: ['E8-restrisiko'],
  H43: ['E8-restrisiko'],
  H44: (_p, b) => (b.bereich === 'inventar' ? ['E4-ueberpruefung'] : ['E8-restrisiko']),
  H45: ['E9-lieferanten'],
  H46: ['E11-dokumente'],
  H47: ['E8-wirksamkeit'],
  H48: ['E8-wirksamkeit'],
  // Stage-1-Runde 5: Risiko nach Änderung des Systems neu beurteilen (Seite mit «Beurteilt am»)
  H49: ['E6-bewertung'],
  // ab rc.3
  F30: ['E4-dienst', 'E4-ueberpruefung'],
  H50: ['E4-handlung'],
  H51: ['E6-bewertung'],
  H52: (_p, b) =>
    ({ inventar: ['E4-systeme'], risiken: ['E6-register'], massnahmen: ['E8-massnahmen'], soa: soaSeite(b), lieferanten: ['E9-lieferanten'], folgen: ['E7-triage-ergebnis'], feststellungen: ['E12-korrektur'], organisation: ['E3-grundsaetze'] })[b.bereich ?? ''] ?? [],
  H53: ['E4-dienst'],
  H54: ['E8-behandlung'],
  // ab rc.9: Pflichtprozess nie im Umfang der internen Audits
  H63: ['E12-audit'],
  // Stage-1-Runde 6: Prüfung vor der Freigabe, volle Folgenabschätzung nach D-06, Änderung nach 6.3 planen
  H66: ['E11-dokumente'],
  H69: ['E7-triage-ergebnis'],
  H70: ['E8-massnahmen'],
  // Runde 1: Massnahme ohne Nachweis, Risikostatus gegen offene Massnahmen, Wirksamkeit vor Abschluss
  H83: ['E8-massnahmen'],
  H85: ['E8-behandlung'],
  H86: ['E12-korrektur'],
  // Modul NIST AI RMF: Lücke ohne Entscheid zum Zusatz-Control (SoA) bzw. Präzisierung ohne Notiz (Profil)
  F27: (_p, b) => (b.bereich === 'nistrmf' ? ['E12-rmf-profil', 'J-rmf'] : ['E8-rmf']),
  F28: ['E9-genai'],
  F29: ['E9-messkonzept'],
  // Runde 2b und Verweisregister (AF-139): Felder von Guide-Seiten
  F33: (_p, b, g) => verweisSeiten(b, g),
  F34: (_p, b) => soaSeite(b),
  F36: ['E11-dokumente'],
  F37: ['E3-raci'],
  F38: ['E5-begruendung'],
  F39: (p, b) => bereichSeiten(p, b),
  F40: (p, b) => bereichSeiten(p, b),
  F41: (p, b) => bereichSeiten(p, b),
  F42: ['E11-kennzahlen'],
  // F43: oben (P14), mit Rückfall auf E11-kennzahlen
  // Folgenabschätzung (P14, AF-095): Inhalt der Abschätzung, Ausmass gegen Register, Entscheid nach der Schwelle; F47 Inventar
  F44: ['E7-ergebnis'],
  F45: ['E7-ergebnis'],
  F46: ['E7-einsatzentscheid'],
  F47: ['E4-ueberpruefung'],
  H36: ['J-rmf'],
  H37: ['E12-rmf-profil', 'J-rmf'],
  H38: ['E12-rmf-profil', 'J-rmf'],
  H39: ['E9-genai'],
  H40: ['E9-messkonzept'],
  H41: ['E4-generativ'],
};

/**
 * Eintrag auf der Zielseite: Befunde zu einem KI-System (H19) öffnen auf Seiten der Folgenabschätzung dessen Abschätzung.
 * Auf Listenseiten nur, wenn die Liste einen Eintrag mit dieser ID hat (H34 meldet ein KI-System, die Seite zeigt Ziele).
 */
function eintragAufSeite(seite: string, b: BefundOrt, p: Projekt, g: GefuehrtDaten): string | undefined {
  if (!b.id) return undefined;
  const s = seitenIndex(g).get(seite);
  if (s?.typ === 'folgenabschaetzung' && b.id.startsWith('KI-')) return p.folgenabschaetzungen.find((f) => f.kiSystem === b.id)?.id ?? b.id;
  if (s?.typ === 'liste' && s.liste && !s.eintrag) {
    const liste = (p as unknown as Record<string, { id?: string }[] | undefined>)[s.liste];
    if (Array.isArray(liste) && !liste.some((x) => x.id === b.id)) return undefined;
  }
  return b.id;
}

/** Route im Guide für einen Befund, oder null (dann gilt das Ziel der Formularansicht). */
export function gefuehrtSprung(b: BefundOrt, p: Projekt, g: GefuehrtDaten): Route | null {
  const z = ZIELE[b.regel];
  if (!z) return null;
  const kandidaten = typeof z === 'function' ? z(p, b, g) : z;
  const index = seitenIndex(g);
  for (const e of aktiveEtappen(g, p)) {
    const aktiv = new Set(aktiveSeiten(g, e, p, index).map((s) => s.id));
    const seite = kandidaten.find((k) => aktiv.has(k));
    if (seite) {
      const eintrag = b.eintrag ?? (b.feld ? undefined : eintragAufSeite(seite, b, p, g));
      return { art: 'gefuehrt', etappe: e.id, seite, ...(eintrag ? { eintrag } : {}), ...(b.feld ? { feld: b.feld } : {}) };
    }
  }
  return null;
}

/** Regeln mit Ziel im Guide (für den Vollständigkeitstest gegen pruefregeln.yaml) */
export const REGELN_MIT_GUIDE_SEITE: readonly string[] = Object.keys(ZIELE);
