// Prüffunktionen zu src/regeln/pruefregeln.yaml. Reine Funktionen ohne Seiteneffekte.
import type { Kataloge } from '../kataloge/typen.ts';
import { ausmassGegenRegister, eingefuehrtOhneDurchfuehrung, entscheidGegenSchwelle, folgenWortgleich, inventarSensibel, juristischOhneBeleg, kennzahlOhneDatenquelle, platzhalterInDokumenten, prozessrollenOhneBesetzung, stichprobeDecktNichtAlle, wirksamTrotzOffenerFeststellung, type StatusBefund } from './stimmigkeit.ts';
import { belegeJuenger, standNachKopfdatum, verweiseVorFreigabe, type StandAngaben, type ZeitAbweichung } from './zeit.ts';
import { PRUEFPUNKTE_LIEFERANT, TARIFE_OHNE_FIRMENVERTRAG, type ControlEintrag, type Entscheid, type Folgenabschaetzung, type KiSystem, type Massnahme, type Projekt, type ProzessSchritt, type Risiko, type Risikostufe } from '../model/typen.ts';
import { istStufe, monateZwischen, nistDaten, rmfVorschlaege } from '../nist-rmf/logik.ts';
import { imDashboard, prozesseImAuditzyklus, prozessStaende, pruefungenDesProzesses, type ProzessStand } from '../prozesse/stand.ts';
import { ablaufVon, einheitVon, personZurRolle, prozesseImProjekt, type Ablauf } from '../prozesse/katalog.ts';
import type { KennzahlEinheit } from '../prozesse/typen.ts';
import { fuerDunklenGrund } from '../generator/bild.ts';
import { palette } from '../generator/palette.ts';
import { pngAusDataUrl, pngDekodieren } from '../generator/png.ts';
import { haengendeVerweise } from '../model/verweise.ts';
import { pruefungFaellig, sichtEintraege, tageBis, type SichtEintrag } from '../bibliothek/sicht.ts';

export interface Treffer {
  /** Fehlende Teile (Schlüssel pruefung.fehlt_*), wenn die Meldung sie nennen soll */
  fehlt?: string[];
  regel: string;
  /** betroffenes Objekt (ID) für den Sprung */
  id?: string;
  /** Anzeigename im Regeltext ({name}) */
  name?: string;
  /** Bereich für Sprungziele mit {bereich} */
  bereich?: string;
  /** Verweisart im Schema (F33, z. B. organisation.entscheidungsrechte[].wer.tief): ordnet den Befund einer Seite des Guides zu */
  verweisFeld?: string;
  /** Eintrag für Sprungziele mit {eintrag} und Sprung im Guide (z. B. KI-System oder Feststellung zu F43) */
  eintrag?: string;
  /** Feld des Eintrags, das der Sprung im Guide fokussiert (z. B. «antragAm») */
  feld?: string;
  /**
   * Schwere dieses Treffers, wenn sie von der Regel abweicht: Pflichtregeln melden einen Fehler erst, wenn der Status
   * erreicht ist, an dem die Pflicht hängt («freigegeben», «erledigt», «wirksam»), vorher einen Hinweis (W2).
   */
  schwere?: 'fehler' | 'hinweis';
  /** Datum für {datum} im Regeltext (JJJJ-MM-TT); die Oberfläche zeigt es im Format der Sprache (F41) */
  datum?: string;
  /** Rollenschlüssel für {name} (F37); die Oberfläche zeigt die Bezeichnungen der Rollen in der Sprache */
  rollen?: string[];
  /**
   * Termin in der Zukunft, an dem die Pflicht fällig wird (F15: geplantes internes Audit, C4-08). Der Befund bleibt ein
   * Fehler für die Stage-1-Bereitschaft; die Fehlerzählung führt ihn bis dahin als «offen aus kommenden Etappen».
   */
  faellig?: string;
}

/** Internes Audit durchgeführt: Datum der Durchführung und Ergebnis oder mindestens ein Prüfpunkt der Checkliste (C4-08) */
export function auditDurchgefuehrt(a: Projekt['audits'][number]): boolean {
  return !leer(a.durchgefuehrt) && (!leer(a.ergebnis) || Object.keys(a.checkliste ?? {}).length > 0);
}

export interface PruefKontext {
  projekt: Projekt;
  /** heutiges Datum JJJJ-MM-TT */
  heute: string;
  /** IDs aller 38 Controls aus Anhang A */
  controlIds42001: string[];
  /** Stand-Datum der AI-Act-Angaben im Kit */
  aiActStand: string;
  /**
   * Kataloge (ab rc.2) für die Regeln des Moduls NIST AI RMF (Subkategorien, Zusatz-Controls, GenAI-Risiken, Stand).
   * Ohne Kataloge entfallen die Modulregeln mit Katalogbezug (F27, F28, H36, H37, H40).
   */
  kataloge?: Kataloge;
}

type Pruefung = (k: PruefKontext) => Treffer[];

/** Stand der Prozesse für die Prozessregeln; leer, solange das Projekt keine Prozesse führt oder der Katalog fehlt */
const prozessCache = new WeakMap<PruefKontext, ProzessStand[]>();
function prozesse(k: PruefKontext): ProzessStand[] {
  if (k.projekt.prozesse === undefined || !k.kataloge) return [];
  let s = prozessCache.get(k);
  if (!s) prozessCache.set(k, (s = prozessStaende(k.projekt, k.kataloge, k.heute)));
  return s;
}
const treffer = (regel: string, id: string, name = id): Treffer => ({ regel, id, name });

/** Einträge der Bibliothek (ohne Vorlagen und Rechtstexte); leer, solange das Projekt keine Bibliothek führt */
const bibliothek = (p: Projekt): SichtEintrag[] => (p.bibliothek ? sichtEintraege(p) : []);
const bibName = (e: SichtEintrag) => (e.titel && e.titel !== e.id ? `${e.id} ${e.titel}` : e.id);

/** Logo für dunklen Grund (H64): Ergebnis je gespeichertem Logo gemerkt, das Dekodieren läuft nur bei einem neuen Logo */
let logoPruefung: { url: string; dunkel: boolean } | undefined;
function logoFuerDunklenGrund(url: string): boolean {
  if (logoPruefung?.url === url) return logoPruefung.dunkel;
  let dunkel = false;
  try {
    const png = pngAusDataUrl(url);
    dunkel = !!png && fuerDunklenGrund(pngDekodieren(png));
  } catch {
    dunkel = false;
  }
  logoPruefung = { url, dunkel };
  return dunkel;
}

const leer = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
const aktiv = (s: KiSystem) => s.status !== 'abgeloest' && s.status !== 'untersagt';
/** Handelnde KI: führt begrenzt aus oder handelt mehrstufig (KiSystem.handlungsbefugnis, ab rc.2) */
const handelt = (s: KiSystem) => s.handlungsbefugnis === 'fuehrt-begrenzt-aus' || s.handlungsbefugnis === 'handelt-mehrstufig';
const wert = (w: number | null, a: number | null) => (w && a ? w * a : 0);
const control = (p: Projekt, id: string): ControlEintrag | undefined => p.controls.find((c) => c.id === id);
const istUmgesetzt = (c?: ControlEintrag) => !!c && c.anwendbar === 'ja' && (c.status === 'umgesetzt' || c.status === 'wirksam' || c.status === 'teilweise');
const tageZwischen = (von: string, bis: string) => (Date.parse(bis) - Date.parse(von)) / 86_400_000;
const PRODUKTNAMEN = /\b(chatgpt|copilot|gemini|claude|openai|anthropic|midjourney|deepl|perplexity|mistral|llama)\b/i;
// Begründung «schon umgesetzt» bei Ausschluss. Ganze Wörter, damit z. B. «bereitstellen» oder «vorhandenen Daten» nicht zählen.
const BEREITS_VORHANDEN = /(?<![\p{L}\p{N}])(bereits|schon vorhanden|vorhanden(?:e[nrms]?)?|already|existing|in place)(?![\p{L}\p{N}])/iu;

/** Höchste erlaubte Datenklasse vertraulich oder streng vertraulich (KiSystem.datenklasse) */
const vertraulich = (s: KiSystem) => s.datenklasse === 'vertraulich' || s.datenklasse === 'streng-vertraulich';
/** Alle Zeichenketten eines Objekts (rekursiv), für die Suche nach veralteten Kennungen */
const texteIn = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(texteIn) : v && typeof v === 'object' ? Object.values(v).flatMap(texteIn) : [];
/**
 * Veraltete Kennung (H52): OWASP-Nummer (LLM01 bis LLM10, ASI01 bis ASI10) ohne Jahr oder mit dem Jahr einer älteren
 * Liste (die Nummern der Listen 2023, 2025 und 2026 bezeichnen verschiedene Risiken), oder Artikel des AI Act in der
 * Bedeutung der Entwurfsfassung: Art. 29 (Betreiberpflichten, heute Art. 26) und Art. 52 als Transparenzpflicht (heute
 * Art. 50). Gibt die gefundene Kennung zurück.
 */
export function veralteteKennung(text: string): string | undefined {
  const owasp = /(?<![\p{L}\p{N}])((?:LLM|ASI)(?:0[1-9]|10))(?![\p{L}\p{N}])(\s*:\s*(\d{4}))?/gu;
  for (const m of text.matchAll(owasp)) if (!m[3] || (m[1]!.startsWith('LLM') && m[3] !== '2026')) return m[0];
  const aiAct = /(?:AI Act|KI-Verordnung|KI-VO|2024\/1689)/i;
  for (const m of text.matchAll(/(?<![\p{L}\p{N}])Art(?:\.|ikel|icle)\s*(29|52)(?![\p{N}])/gu)) {
    const umfeld = text.slice(Math.max(0, m.index! - 80), m.index! + m[0].length + 80);
    if (!aiAct.test(umfeld)) continue;
    if (m[1] === '29' || /transparen/i.test(umfeld)) return m[0];
  }
  return undefined;
}

/** Frühestes bzw. spätestes ISO-Datum einer Liste (leere Werte zählen nicht) */
const fruehestes = (daten: (string | undefined)[]) => daten.filter((d): d is string => !!d).map((d) => d.slice(0, 10)).sort()[0];
const spaetestes = (daten: (string | undefined)[]) => daten.filter((d): d is string => !!d).map((d) => d.slice(0, 10)).sort().at(-1);
/** Freigabedatum des ersten Dokuments mit einer der IDs (z. B. D-07 oder D-07-EB); bei mehreren das jüngste */
const dokFreigabe = (p: Projekt, ids: string[]) => spaetestes(p.dokumente.filter((d) => ids.includes(d.id)).map((d) => d.freigabe?.am));
const DOK_PLAN = ['D-07', 'D-07-EB'];

/**
 * Datum, an dem eine Massnahme entstanden ist, aus den IDs in ihrer Herkunft (ref, auch mehrere wie «R-006, F-002»):
 * Audit AU-… (durchgeführt, sonst geplant), Feststellung F-… (Datum, sonst Datum ihres Audits), Managementbewertung
 * MB-… (Datum). Bei mehreren das jüngste. Andere Herkünfte haben kein festes Datum (der Beginn einer Massnahme darf nach
 * der Freigabe des Plans liegen).
 */
function massnahmeEntstanden(p: Projekt, m: Massnahme): string | undefined {
  if (m.herkunft.art !== 'audit' && m.herkunft.art !== 'managementbewertung') return undefined;
  const audit = (id?: string) => {
    const a = p.audits.find((x) => x.id === id);
    return a?.durchgefuehrt ?? a?.geplant;
  };
  const daten = (m.herkunft.ref ?? '').match(/\b(?:AU|F|MB)-\d+\b/g)?.map((id) => {
    if (id.startsWith('AU-')) return audit(id);
    if (id.startsWith('MB-')) return p.managementbewertungen.find((x) => x.id === id)?.datum;
    const f = p.feststellungen.find((x) => x.id === id);
    return f?.datum ?? audit(f?.audit);
  });
  return spaetestes(daten ?? []);
}

/** Jüngster Eintrag des Behandlungsplans: Restrisiko-Annahmen und Massnahmen mit datierter Herkunft */
function letzteAenderungPlan(p: Projekt): { datum: string; id: string } | undefined {
  const eintraege = [
    ...p.risiken.filter((r) => r.restrisikoAkzeptiert?.am).map((r) => ({ datum: r.restrisikoAkzeptiert!.am.slice(0, 10), id: r.id })),
    ...p.massnahmen.filter((m) => m.status !== 'verworfen').map((m) => ({ datum: massnahmeEntstanden(p, m)?.slice(0, 10), id: m.id })),
  ].filter((e): e is { datum: string; id: string } => !!e.datum);
  return eintraege.sort((a, b) => a.datum.localeCompare(b.datum)).at(-1);
}

/** Ausnahme länger als max Monate: Ende nach dem Tag «am + max Monate» */
function laengerAls(am: string, bis: string, max: number): boolean {
  const d = new Date(`${am.slice(0, 10)}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + max);
  return bis.slice(0, 10) > d.toISOString().slice(0, 10);
}

/** Ab so vielen Controls mit gleichem Text der Wirksamkeitsprüfung meldet H47 */
export const GLEICHE_WIRKSAMKEIT_AB = 6;

/** Risikostufe eines Risikowerts für die Entscheidungsrechte (D-04): tief bis zur Akzeptanzgrenze, hoch ab «unannehmbar» */
export function risikostufe(p: Projekt, wert: number): Risikostufe {
  const k = p.organisation.risikokriterien;
  return wert >= k.unannehmbarAb ? 'hoch' : wert > k.akzeptanzBis ? 'mittel' : 'tief';
}

/** Rang einer Stelle: 1 Eigner/in, 2 AIMS-Verantwortung, 3 Geschäftsleitung */
// Rang des Vorschlags in D-04 Anlage A (vorlagen.D-04.entscheidungsrechte_vorschlag; Fakten freigabe.einfuehren,
// freigabe.einfuehren-hoch, freigabe.restrisiko): 1 Eigner/in, 2 AIMS-Verantwortung, 3 Geschäftsleitung (M4-28, M4-29)
export const RANG_VORSCHLAG: Record<Entscheid, Record<Risikostufe, number>> = {
  einfuehren: { tief: 2, mittel: 2, hoch: 3 },
  restrisiko: { tief: 1, mittel: 3, hoch: 3 },
  ausnahme: { tief: 2, mittel: 3, hoch: 3 },
  stoppen: { tief: 1, mittel: 1, hoch: 1 },
  ausserbetrieb: { tief: 1, mittel: 2, hoch: 3 },
};
function personRang(p: Projekt, id: string, eigner?: string): number {
  const person = p.personen.find((x) => x.id === id);
  if (person?.aimsRollen.includes('gl')) return 3;
  if (p.organisation.aimsVerantwortlich === id || person?.aimsRollen.includes('aims')) return 2;
  return id === eigner ? 1 : 0;
}
/** Verlangter Rang aus der Angabe der Entscheidungsrechte (Person oder Funktion), sonst aus dem Vorschlag in D-04 */
function verlangt(p: Projekt, entscheid: Entscheid, stufe: Risikostufe): { rang: number; person?: string } {
  const wer = p.organisation.entscheidungsrechte?.find((e) => e.entscheid === entscheid)?.wer[stufe]?.trim();
  if (!wer) return { rang: RANG_VORSCHLAG[entscheid][stufe] };
  if (p.personen.some((x) => x.id === wer)) return { rang: personRang(p, wer), person: wer };
  if (/geschäftsleitung|geschäftsführ|verwaltungsrat|\bGL\b|management|board|managing director|ceo/i.test(wer)) return { rang: 3 };
  if (/aims/i.test(wer)) return { rang: 2 };
  return { rang: 1 };
}
/** Entscheid durch eine Person unter der verlangten Stelle (die verlangte Person selbst genügt immer) */
function zuTief(p: Projekt, entscheid: Entscheid, stufe: Risikostufe, von: string, eigner?: string): boolean {
  const v = verlangt(p, entscheid, stufe);
  if (v.person === von) return false;
  return personRang(p, von, eigner) < v.rang;
}

/** Einheit der Zeilen KZ-01 bis KZ-06 der Vorlage D-05 (ohne eigene Bezeichnung im Projekt) */
const VORLAGE_KZ_EINHEIT: Record<string, KennzahlEinheit | undefined> = { 'KZ-02': 'anzahl', 'KZ-03': 'anzahl', 'KZ-04': 'tage', 'KZ-05': 'prozent' };

/** Einheit einer gewählten Kennzahl: aus dem Messwert, sonst aus der Bezeichnung, sonst aus der Zeile der Vorlage D-05 */
function kennzahlEinheit(p: Projekt, id: string, wert: string | undefined, titel: string): KennzahlEinheit | undefined {
  const ziel = p.ziele.find((z) => z.id === id);
  const vorlage = ziel || p.kennzahlen?.find((x) => x.id === id)?.kennzahl ? undefined : VORLAGE_KZ_EINHEIT[id];
  return einheitVon(wert, titel) ?? (ziel ? einheitVon(ziel.sollwert, ziel.kennzahl) : undefined) ?? vorlage;
}

/** Rang der Bahn eines Schritts: Person der Bahn (Angabe oder Rolle), Rolle «gl» ohne Person zählt als Geschäftsleitung */
function bahnRang(p: Projekt, a: Ablauf, schritt: ProzessSchritt): { rang: number; person?: string } {
  const b = a.bahnen.find((x) => x.id === schritt.bahn);
  const rolle = b?.rolle ?? schritt.bahn;
  const person = b?.person ?? personZurRolle(p, rolle);
  if (person) return { rang: personRang(p, person), person };
  return { rang: rolle === 'gl' ? 3 : rolle === 'aims' ? 2 : 1 };
}

/** Widerspruch der Freigabeschritte eines Prozesses zu den Entscheidungsrechten (H73) */
function freigabeWiderspruch(k: PruefKontext, s: ProzessStand): boolean {
  const p = k.projekt;
  const a = ablaufVon({ roh: () => undefined }, s.katalog, s.eintrag);
  const schritte = a.schritte.filter((x) => x.entscheid);
  if (!schritte.length) return false;
  const aktive = p.kiSysteme.filter((x) => aktiv(x));
  // Stufen im Projekt: je System der höchste Risikowert, volle Abschätzung gilt als hohes Risiko (wie H44)
  const stufen = new Set<Risikostufe>(
    aktive.map((x) => {
      const voll = p.folgenabschaetzungen.some((f) => f.kiSystem === x.id && f.triage.ergebnis === 'voll');
      return voll ? 'hoch' : risikostufe(p, Math.max(0, ...p.risiken.filter((r) => r.art === 'risiko' && r.kiSystem === x.id).map((r) => wert(r.w, r.a))));
    }),
  );
  const restStufen = new Set<Risikostufe>(p.risiken.filter((r) => r.art === 'risiko' && r.status !== 'geschlossen').map((r) => risikostufe(p, wert(r.wNach, r.aNach))));
  const entscheide = [...new Set(schritte.map((x) => x.entscheid!))];
  for (const e of entscheide) {
    const freigaben = schritte.filter((x) => x.entscheid === e).map((x) => bahnRang(p, a, x));
    const hoechster = Math.max(...freigaben.map((x) => x.rang));
    if (e === 'kurzpruefung' || e === 'abschaetzung') {
      // Durchführende Person: wer die Kurzprüfungen im Projekt durchgeführt hat (triage.durch); ohne Angabe die Bahn der
      // Folgenabschätzung im Ablauf bzw. der Rollenbereich folgenabschaetzung (D-04)
      const durchIa = [...new Set(p.folgenabschaetzungen.map((f) => f.triage.durch).filter((x): x is string => !!x))];
      const fa = a.bahnen.find((b) => (b.rolle ?? b.id) === 'folgenabschaetzung');
      const durch = durchIa.length ? durchIa : [fa?.person ?? personZurRolle(p, 'folgenabschaetzung')].filter((x): x is string => !!x);
      if (freigaben.every((x) => !!x.person && durch.includes(x.person))) return true;
      if (e === 'kurzpruefung' && hoechster < 2) return true;
      if (e === 'abschaetzung' && hoechster < 3) return true;
      continue;
    }
    const relevant = e === 'restrisiko' ? restStufen : stufen;
    const verlangtRang = Math.max(0, ...[...relevant].map((st) => verlangt(p, e, st).rang));
    if (hoechster < verlangtRang) return true;
  }
  // Volle Abschätzungen im Projekt, aber der Ablauf kennt keine Freigabe durch die Geschäftsleitung
  if (entscheide.includes('kurzpruefung') && !entscheide.includes('abschaetzung') && p.folgenabschaetzungen.some((f) => f.triage.ergebnis === 'voll')) return true;
  return false;
}

/** Schwelle der Kurzprüfung nach D-08 */
export function triageSchwelle(t: Folgenabschaetzung['triage']): 'voll' | 'grenzfall' | 'keine' {
  if (t.rechtspositionOderChancen || t.gesundheitOderSicherheit) return 'voll';
  const n = [t.verletzlicheGruppen, t.besondereDaten, t.automatisierteEntscheidung, t.grosseReichweite].filter(Boolean).length;
  return n >= 2 ? 'voll' : n === 1 ? 'grenzfall' : 'keine';
}

/** Abschätzung mit System für den Regeltext: «IA-001 (Copilot)» */
const iaName = (p: Projekt, id: string) => {
  const f = p.folgenabschaetzungen.find((x) => x.id === id);
  const s = p.kiSysteme.find((x) => x.id === f?.kiSystem);
  return s ? `${id} (${s.name})` : id;
};

/** Treffer einer Statusregel: Objekt mit begründenden Kennungen, vor dem verbindlichen Status als Hinweis (W2) */
const statusTreffer = (regel: string, b: StatusBefund): Treffer => ({
  regel,
  id: b.id,
  name: b.details.length ? `${b.id} (${b.details.join(', ')})` : b.id,
  ...(b.verbindlich ? {} : { schwere: 'hinweis' as const }),
});

/** Treffer der zeitlichen Gültigkeit: einer je Eintrag mit allen Bezügen (W3), ohne Sprungziel nicht im Werkzeug */
function zeitTreffer(regel: string, liste: ZeitAbweichung[]): Treffer[] {
  const je = new Map<string, Treffer & { bezuege: string[] }>();
  for (const x of liste.filter((y) => y.regel === regel && y.bereich && y.id)) {
    const schluessel = `${x.bereich}/${x.id}`;
    const t = je.get(schluessel) ?? { regel, id: x.id, bereich: x.bereich, bezuege: [], ...(x.verbindlich ? {} : { schwere: 'hinweis' as const }) };
    if (x.verbindlich) delete t.schwere;
    if (!t.bezuege.includes(x.bezug)) t.bezuege.push(x.bezug);
    if (x.datum && (!t.datum || x.datum > t.datum)) t.datum = x.datum;
    je.set(schluessel, t);
  }
  // Mit Datum (F41) nennt die Meldung das Datum über {datum} im Format der Sprache, der Name nur das Objekt
  return [...je.values()].map(({ bezuege, ...t }) => ({ ...t, name: t.datum ? t.id : `${t.id} (${bezuege.join(', ')})` }));
}

/** Stand des Kits (AI Act, NIST AI RMF), den Dokumente abdrucken */
const standDesKits = (k?: Kataloge): StandAngaben => ({ aiAct: k?.['aiact_stand'] as StandAngaben['aiAct'], nist: k?.nistrmf_stand as StandAngaben['nist'] });

export const PRUEFUNGEN: Record<string, Pruefung> = {
  F01: ({ projekt }) => projekt.kiSysteme.filter((s) => aktiv(s) && leer(s.eigner)).map((s) => ({ regel: 'F01', id: s.id, name: s.name })),
  F02: ({ projekt }) =>
    projekt.kiSysteme
      .filter((s) => aktiv(s) && !projekt.risiken.some((r) => r.kiSystem === s.id))
      .map((s) => ({ regel: 'F02', id: s.id, name: s.name })),
  // Leitlinie, Geltungsbereich und Projektauftrag: Freigabe durch die Leitung, nicht durch die Eigner/in selbst (5.2, 7.5.3; C2-05)
  H88: ({ projekt }) => {
    const org = projekt.organisation;
    const leitung = /gesch[aä]ftsf|gesch[aä]ftsleit|ceo\b|inhaber|verwaltungsrat|pr[aä]sident|direktor|managing|executive|owner|board|top.?management|vorstand/i;
    return ([['D-00', org.projektauftrag?.freigabe], ['D-02', org.geltungsbereich?.freigabe], ['D-03', org.leitlinie?.freigabe]] as const).flatMap(([id, f]) => {
      if (!f?.von || !f.am) return [];
      const person = projekt.personen.find((x) => x.id === f.von);
      const funktion = person?.funktion ?? '';
      const istLeitung = leitung.test(funktion);
      if (istLeitung) return [];
      return f.von === org.aimsVerantwortlich || funktion.trim() ? [{ regel: 'H88', id, name: `${id}, ${person?.name ?? String(f.von)}` }] : [];
    });
  },
  // Datum in der Zukunft gilt nicht als erledigt: Geplantes darf nicht wie Erfolgtes zählen (C2-06)
  H89: ({ projekt, heute }) => {
    const org = projekt.organisation;
    const t: Treffer[] = [];
    const pruefe = (id: string, am: string | undefined): void => {
      if (am && am.slice(0, 10) > heute) t.push({ regel: 'H89', id, name: `${id}, ${am.slice(0, 10)}` });
    };
    pruefe('D-00', org.projektauftrag?.freigabe?.am);
    pruefe('D-02', org.geltungsbereich?.freigabe?.am);
    pruefe('D-03', org.leitlinie?.freigabe?.am);
    for (const d of projekt.dokumente) pruefe(d.id, d.freigabe?.am);
    for (const f of projekt.folgenabschaetzungen) pruefe(f.id, f.freigabe?.am);
    for (const a of projekt.audits) pruefe(a.id, a.durchgefuehrt);
    for (const m of projekt.managementbewertungen) pruefe(m.id, m.datum);
    return t;
  },
  F03: ({ projekt }) =>
    projekt.kiSysteme
      .filter((s) => aktiv(s))
      .filter((s) => {
        const ias = projekt.folgenabschaetzungen.filter((f) => f.kiSystem === s.id);
        const brauchtVoll = s.sensibleNutzung || ias.some((f) => f.triage.ergebnis === 'voll');
        if (!brauchtVoll) return false;
        return !ias.some((f) => f.triage.ergebnis === 'voll' && f.betroffene.length > 0 && Object.keys(f.nutzenSchaden).length > 0);
      })
      .map((s) => {
        // Die Meldung nennt, was fehlt: Kurzprüfung mit Ergebnis «voll», Betroffene, Nutzen und Schaden je Ziel (C2-01)
        const voll = projekt.folgenabschaetzungen.find((f) => f.kiSystem === s.id && f.triage.ergebnis === 'voll');
        const fehlt = !voll ? ['triage'] : [...(voll.betroffene.length ? [] : ['betroffene']), ...(Object.keys(voll.nutzenSchaden).length ? [] : ['nutzen_schaden'])];
        return { regel: 'F03', id: s.id, name: s.name, fehlt };
      }),
  F04: ({ projekt }) => projekt.folgenabschaetzungen.filter((f) => !f.freigabe).map((f) => ({ regel: 'F04', id: f.id, name: f.id })),
  F05: ({ projekt, controlIds42001 }) => {
    const ids = new Set([...controlIds42001, ...projekt.controls.map((c) => c.id)]);
    return [...ids].filter((id) => (control(projekt, id)?.anwendbar ?? 'offen') === 'offen' && control(projekt, id)?.rahmenwerk !== 'EUAIA').map((id) => ({ regel: 'F05', id, name: id }));
  },
  F06: ({ projekt }) => projekt.controls.filter((c) => c.anwendbar !== 'offen' && leer(c.begruendung)).map((c) => ({ regel: 'F06', id: c.id, name: c.id })),
  F07: ({ projekt }) =>
    projekt.controls.filter((c) => c.anwendbar === 'ja' && (c.status === 'offen' || (leer(c.nachweise) && leer(c.umsetzung)))).map((c) => ({
      regel: 'F07', id: c.id, name: c.id,
      // Stand und Nachweis getrennt: «ohne Status oder Nachweis» traf auch Controls, bei denen nur der Stand offen war (C2-02)
      fehlt: [...(c.status === 'offen' ? ['stand'] : []), ...(leer(c.nachweise) && leer(c.umsetzung) ? ['nachweis'] : [])],
    })),
  F08: ({ projekt }) => {
    const grenze = projekt.organisation.risikokriterien.akzeptanzBis;
    return projekt.risiken.filter((r) => r.art === 'risiko' && wert(r.w, r.a) > grenze && !r.behandlung).map((r) => ({ regel: 'F08', id: r.id, name: `${r.id} ${r.titel}` }));
  },
  F09: ({ projekt }) =>
    projekt.risiken
      .filter((r) => r.art === 'risiko' && r.behandlung && r.status !== 'geschlossen' && !r.restrisikoAkzeptiert)
      .map((r) => ({ regel: 'F09', id: r.id, name: `${r.id} ${r.titel}` })),
  // Risikobehandlungsplan freigegeben: D-07 oder, im Pfad mit ISMS, D-07-EB (Register im ISMS-Risikoregister)
  F10: ({ projekt }) =>
    projekt.risiken.length > 0 && !projekt.dokumente.some((d) => (d.id === 'D-07' || d.id === 'D-07-EB') && d.freigabe)
      ? [{ regel: 'F10', id: projekt.meta.mitIsms ? 'D-07-EB' : 'D-07' }]
      : [],
  F11: ({ projekt }) => {
    const g = projekt.organisation.geltungsbereich;
    return leer(g.beschreibung) || !g.freigabe ? [{ regel: 'F11' }] : [];
  },
  F12: ({ projekt }) => {
    const l = projekt.organisation.leitlinie;
    return leer(l.grundsaetze) || !l.freigabe ? [{ regel: 'F12' }] : [];
  },
  F13: ({ projekt }) =>
    projekt.ziele
      .filter((z) => (leer(z.kennzahl) && leer(z.sollwert)) || leer(z.verantwortlich) || leer(z.termin) || leer(z.bewertung))
      .map((z) => ({ regel: 'F13', id: z.id, name: `${z.id} ${z.ziel}` })),
  F14: ({ projekt }) => {
    const hat = (bereich: string) => projekt.rollen.some((r) => r.bereich === bereich && !leer(r.verantwortlich));
    return hat('konformitaet') && hat('berichterstattung') ? [] : [{ regel: 'F14' }];
  },
  // C4-08: durchgeführt heisst Datum und Ergebnis oder Checkliste (ein Datum allein belegt kein Audit); ein geplantes Audit
  // vor seinem Termin bleibt Fehler (Stage 1 verlangt das Audit), zählt aber mit «faellig» als offen aus kommenden Etappen
  F15: ({ projekt, heute }) => {
    const intern = projekt.audits.filter((a) => a.art === 'intern');
    if (intern.some(auditDurchgefuehrt)) return [];
    const geplant = intern.map((a) => a.geplant ?? '').filter((d) => d >= heute).sort()[0];
    return [{ regel: 'F15', ...(geplant ? { faellig: geplant } : {}) }];
  },
  F16: ({ projekt }) => (projekt.managementbewertungen.some((m) => !leer(m.datum)) ? [] : [{ regel: 'F16' }]),
  F17: ({ projekt }) =>
    projekt.feststellungen
      .filter((f) => f.einstufung.startsWith('nk') && (leer(f.ursache) || (f.status === 'geschlossen' && !f.wirksamkeit)))
      .map((f) => ({ regel: 'F17', id: f.id, name: f.id })),
  F18: ({ projekt }) =>
    projekt.massnahmen
      .filter((m) => (m.status === 'offen' || m.status === 'in-arbeit') && (leer(m.verantwortlich) || leer(m.termin)))
      .map((m) => ({ regel: 'F18', id: m.id, name: `${m.id} ${m.titel}` })),
  F19: ({ projekt }) => {
    const k = projekt.organisation.risikokriterien;
    return leer(k.zeitraum) || leer(k.wahrscheinlichkeit) || leer(k.auswirkung) || !(k.akzeptanzBis < k.unannehmbarAb) ? [{ regel: 'F19' }] : [];
  },
  F20: ({ projekt }) =>
    projekt.parteien.filter((p) => p.anforderungen.some((a) => a.adressiert === 'offen')).map((p) => ({ regel: 'F20', id: p.id, name: p.name })),
  F21: ({ projekt }) =>
    projekt.risiken.filter((r) => r.behandlung === 'vermindern' && leer(r.controls)).map((r) => ({ regel: 'F21', id: r.id, name: `${r.id} ${r.titel}` })),
  F22: ({ projekt }) => projekt.kiSysteme.filter((s) => aktiv(s) && leer(s.aiAct.rollen)).map((s) => ({ regel: 'F22', id: s.id, name: s.name })),
  F23: ({ projekt }) => projekt.kiSysteme.filter((s) => aktiv(s) && s.aiAct.risikoklasse === 'offen').map((s) => ({ regel: 'F23', id: s.id, name: s.name })),
  F24: ({ projekt }) => projekt.kiSysteme.filter((s) => s.aiAct.risikoklasse === 'verboten' && s.status !== 'untersagt').map((s) => ({ regel: 'F24', id: s.id, name: s.name })),
  F25: ({ projekt }) =>
    projekt.controls.filter((c) => c.rahmenwerk === 'EUAIA' && c.anwendbar === 'offen').map((c) => ({ regel: 'F25', id: c.id, name: c.id })),

  H01: ({ projekt, heute }) => {
    const faellig = (d?: string) => !!d && d < heute;
    const t: Treffer[] = [];
    for (const d of projekt.dokumente) if (faellig(d.naechsteUeberpruefung)) t.push({ regel: 'H01', id: d.id, name: d.id, bereich: 'dokumente' });
    for (const s of projekt.kiSysteme) if (faellig(s.naechsteUeberpruefung)) t.push({ regel: 'H01', id: s.id, name: s.name, bereich: 'inventar' });
    for (const f of projekt.folgenabschaetzungen) if (faellig(f.naechsteUeberpruefung)) t.push({ regel: 'H01', id: f.id, name: f.id, bereich: 'folgen' });
    for (const l of projekt.lieferanten) if (faellig(l.naechstePruefung)) t.push({ regel: 'H01', id: l.id, name: l.name, bereich: 'lieferanten' });
    // Wiedervorlage des Einsatzentscheids (Nutzen nachkontrollieren, D-09, ab rc.2); nur, wenn kein Überprüfungsdatum des
    // Systems schon gemeldet ist
    for (const s of projekt.kiSysteme)
      if (aktiv(s) && faellig(s.einsatzentscheid?.wiedervorlage) && !faellig(s.naechsteUeberpruefung)) t.push({ regel: 'H01', id: s.id, name: s.name, bereich: 'inventar' });
    // Externe Dokumente der Dokumentenlenkung (D-26): nächste Prüfung auf eine neue Ausgabe
    for (const e of projekt.organisation.dokumentenlenkung?.externeDokumente ?? [])
      if (faellig(e.naechstePruefung)) t.push({ regel: 'H01', id: 'D-26', name: e.dokument, bereich: 'dokumente' });
    if (faellig(projekt.organisation.leitlinie.naechsteUeberpruefung)) t.push({ regel: 'H01', id: 'leitlinie', name: 'D-03', bereich: 'organisation' });
    return t;
  },
  H02: ({ projekt, heute }) =>
    projekt.kiSysteme
      .filter((s) => s.typ === 'schatten' && s.status === 'in-pruefung' && s.erfasstAm && tageZwischen(s.erfasstAm, heute) > 30)
      .map((s) => ({ regel: 'H02', id: s.id, name: s.name })),
  H03: ({ projekt }) => (projekt.meta.mitIsms && !projekt.organisation.risikokriterien.ausIsmsUebernommen ? [{ regel: 'H03' }] : []),
  H04: ({ projekt }) => {
    const grenze = projekt.organisation.risikokriterien.unannehmbarAb;
    const hoch = projekt.risiken.filter((r: Risiko) => wert(r.w, r.a) >= grenze);
    return projekt.controls
      .filter((c) => c.anwendbar === 'nein' && hoch.some((r) => r.controls.includes(c.id)))
      .map((c) => ({ regel: 'H04', id: c.id, name: c.id }));
  },
  H05: ({ projekt }) => projekt.kompetenzen.filter((k) => leer(k.nachweis)).map((k) => ({ regel: 'H05', id: k.id, name: k.rolle })),
  H06: ({ projekt }) => (projekt.kommunikation.length > 0 && !projekt.kommunikation.some((k) => k.richtung === 'extern') ? [{ regel: 'H06' }] : []),
  H07: ({ projekt }) =>
    projekt.kiSysteme
      .filter((s) => {
        if (!s.geaendertAm) return false;
        // Letzte Freigabe der Abschätzung oder ihrer letzten Neubeurteilung
        const letzte = projekt.folgenabschaetzungen
          .filter((f) => f.kiSystem === s.id && f.freigabe)
          .flatMap((f) => [f.freigabe!.am, ...(f.neubeurteilungen ?? []).map((n) => n.freigabe?.am ?? n.am)])
          .sort()
          .pop();
        return !!letzte && s.geaendertAm > letzte;
      })
      .map((s) => ({ regel: 'H07', id: s.id, name: s.name })),
  H08: ({ projekt }) =>
    projekt.kiSysteme
      .filter((s) => aktiv(s) && s.typ === 'eigenbau' && !['A.6.2.2', 'A.6.2.3', 'A.6.2.4'].every((id) => istUmgesetzt(control(projekt, id))))
      .map((s) => ({ regel: 'H08', id: s.id, name: s.name })),
  H09: ({ projekt }) => (projekt.kiSysteme.length > 0 && !istUmgesetzt(control(projekt, 'A.6.2.8')) ? [{ regel: 'H09' }] : []),
  H10: ({ projekt }) => (projekt.kiSysteme.length > 0 && !istUmgesetzt(control(projekt, 'A.8.3')) ? [{ regel: 'H10' }] : []),
  H11: ({ projekt }) => projekt.audits.filter((a) => a.art === 'intern' && leer(a.unabhaengigkeit)).map((a) => ({ regel: 'H11', id: a.id, name: a.id })),
  H12: ({ projekt }) =>
    projekt.controls.filter((c) => c.anwendbar === 'nein' && BEREITS_VORHANDEN.test(c.begruendung)).map((c) => ({ regel: 'H12', id: c.id, name: c.id })),
  H13: ({ projekt }) => (projekt.organisation.leitlinie.grundsaetze.some((g) => PRODUKTNAMEN.test(g)) ? [{ regel: 'H13' }] : []),
  H14: ({ projekt }) =>
    projekt.kiSysteme
      .filter(
        (s) =>
          aktiv(s) &&
          s.aiAct.risikoklasse === 'hochrisiko-anhang-iii' &&
          (s.aiAct.anhangIiiBereich ?? '').startsWith('4') &&
          s.aiAct.rollen.includes('betreiber') &&
          !projekt.meta.checklisten[`E-05.arbeitnehmende.${s.id}`]?.erledigt,
      )
      .map((s) => ({ regel: 'H14', id: s.id, name: s.name })),
  H15: ({ heute, aiActStand }) => (tageZwischen(aiActStand, heute) > 183 ? [{ regel: 'H15' }] : []),
  // Auch mit EU-Niederlassung: Ist die Schweizer Gesellschaft selbst Anbieterin, braucht sie einen Bevollmächtigten
  H16: ({ projekt }) =>
    projekt.kiSysteme
          .filter(
            (s) =>
              aktiv(s) &&
              s.aiAct.rollen.includes('anbieter') &&
              s.aiAct.risikoklasse.startsWith('hochrisiko') &&
              !projekt.meta.checklisten[`E-08.bevollmaechtigter.${s.id}`]?.erledigt,
          )
          .map((s) => ({ regel: 'H16', id: s.id, name: s.name })),
  // Schwellen nach D-08: Frage 1 oder 2 «ja», oder mindestens zwei der Fragen 3 bis 6 → vollständige Abschätzung
  F26: ({ projekt }) =>
    projekt.folgenabschaetzungen
      .filter((f) => f.triage.ergebnis === 'kurz' && triageSchwelle(f.triage) === 'voll')
      .map((f) => ({ regel: 'F26', id: f.id, name: `${f.id} ${f.kiSystem}` })),
  // Grenzfall (genau eine der Fragen 3 bis 6) ohne begründeten Entscheid
  H17: ({ projekt }) =>
    projekt.folgenabschaetzungen
      .filter((f) => f.triage.ergebnis === 'kurz' && triageSchwelle(f.triage) === 'grenzfall' && leer(f.triage.begruendung))
      .map((f) => ({ regel: 'H17', id: f.id, name: `${f.id} ${f.kiSystem}` })),
  // Vier-Augen-Prinzip: wer die Abschätzung durchführt, gibt sie nicht selbst frei
  H18: ({ projekt }) =>
    projekt.folgenabschaetzungen
      .filter((f) => f.triage.durch && f.freigabe && f.triage.durch === f.freigabe.von)
      .map((f) => ({ regel: 'H18', id: f.id, name: `${f.id} ${f.kiSystem}` })),
  // Datumskonsistenz (H19 bis H23): Ein Dokument oder eine Freigabe darf sich nicht auf Ereignisse stützen, die danach liegen.
  // KI-System freigegeben, bevor eine seiner Folgenabschätzungen freigegeben war (D-08: erst Abschätzung, dann Betrieb)
  H19: ({ projekt }) =>
    projekt.kiSysteme
      .filter((s) => s.status !== 'untersagt' && s.freigabe?.am)
      .filter((s) => {
        const ias = projekt.folgenabschaetzungen.filter((f) => f.kiSystem === s.id);
        return ias.length > 0 && !ias.some((f) => f.freigabe?.am && f.freigabe.am.slice(0, 10) <= s.freigabe!.am.slice(0, 10));
      })
      .map((s) => ({ regel: 'H19', id: s.id, name: s.name })),
  // Behandlungsplan (D-07, mit ISMS D-07-EB) freigegeben vor seinem jüngsten Eintrag (Restrisiko-Annahme, Massnahme aus Audit oder Managementbewertung)
  H20: ({ projekt }) => {
    const id = projekt.dokumente.find((d) => DOK_PLAN.includes(d.id) && d.freigabe)?.id;
    const freigabe = dokFreigabe(projekt, DOK_PLAN);
    const letzte = letzteAenderungPlan(projekt);
    return id && freigabe && letzte && letzte.datum > freigabe ? [{ regel: 'H20', id, name: `${id} (${letzte.id})` }] : [];
  },
  // Erklärung zur Anwendbarkeit (D-11) freigegeben vor dem jüngsten Eintrag oder der jüngsten Freigabe des Behandlungsplans
  H21: ({ projekt }) => {
    const freigabe = dokFreigabe(projekt, ['D-11']);
    if (!freigabe) return [];
    const plan = dokFreigabe(projekt, DOK_PLAN);
    const letzte = [letzteAenderungPlan(projekt), plan ? { datum: plan, id: projekt.dokumente.find((d) => DOK_PLAN.includes(d.id) && d.freigabe)!.id } : undefined]
      .filter((e): e is { datum: string; id: string } => !!e)
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .at(-1);
    return letzte && letzte.datum > freigabe ? [{ regel: 'H21', id: 'D-11', name: `D-11 (${letzte.id})` }] : [];
  },
  // Folgenabschätzung freigegeben, bevor das Verfahren D-08 freigegeben war
  H22: ({ projekt }) => {
    // Massgebend ist die erste Freigabe des Verfahrens; eine spätere Fassung macht ältere Abschätzungen nicht ungültig
    const d08 = projekt.dokumente.find((d) => d.id === 'D-08');
    const verfahren = [...(d08?.aenderungen ?? []).map((a) => a.datum), dokFreigabe(projekt, ['D-08'])].filter((d): d is string => !!d).sort()[0];
    if (!verfahren) return [];
    return projekt.folgenabschaetzungen
      .filter((f) => f.freigabe?.am && f.freigabe.am.slice(0, 10) < verfahren)
      .map((f) => ({ regel: 'H22', id: f.id, name: `${f.id} ${f.kiSystem}` }));
  },
  // Rolle und Einstufung (Etappe E5: Checklisten E5-*, sonst Freigabe von D-24 oder E-01) erst nach Beginn der Risikobeurteilung
  H23: ({ projekt }) => {
    const e5 =
      fruehestes(Object.entries(projekt.meta.checklisten).filter(([k, c]) => k.startsWith('E5-') && c.erledigt).map(([, c]) => c.datum)) ??
      fruehestes([dokFreigabe(projekt, ['D-24']), dokFreigabe(projekt, ['E-01'])]);
    const risiko = fruehestes([
      ...projekt.risiken.map((r) => r.restrisikoAkzeptiert?.am),
      dokFreigabe(projekt, DOK_PLAN),
      ...projekt.folgenabschaetzungen.flatMap((f) => [f.triage.am, f.freigabe?.am]),
    ]);
    return e5 && risiko && e5 > risiko ? [{ regel: 'H23' }] : [];
  },
  // SoA-Status «umgesetzt» oder «wirksam», obwohl die Umsetzung auf eine offene Massnahme verweist (D-11 zeigt «teilweise»)
  H24: ({ projekt }) =>
    projekt.controls
      .filter((c) => c.anwendbar === 'ja' && (c.status === 'umgesetzt' || c.status === 'wirksam'))
      .filter((c) =>
        (c.umsetzung.match(/\bM-\d{3}\b/g) ?? []).some((id) => {
          const m = projekt.massnahmen.find((x) => x.id === id);
          return !!m && m.status !== 'erledigt' && m.status !== 'verworfen';
        }),
      )
      .map((c) => ({ regel: 'H24', id: c.id, name: c.id })),
  // Dokument in Version über 1.0 ohne Eintrag dieser Version in der Änderungshistorie (7.5.3)
  H25: ({ projekt }) =>
    projekt.dokumente
      .filter((d) => d.status === 'freigegeben' && /^\d+\.\d+$/.test(d.version) && Number(d.version) > 1)
      .filter((d) => !(d.aenderungen ?? []).some((a) => a.version === d.version))
      .map((d) => ({ regel: 'H25', id: d.id, name: `${d.id} ${d.version}` })),
  // Interne Auditorin oder interner Auditor im Projektteam (Unabhängigkeit, 9.2)
  H26: ({ projekt }) => {
    const auditoren = new Set([
      ...projekt.personen.filter((p) => p.aimsRollen.includes('auditor')).map((p) => p.id),
      ...projekt.rollen.filter((r) => r.bereich === 'internes-audit' && r.verantwortlich).map((r) => r.verantwortlich!),
    ]);
    return (projekt.organisation.projektauftrag?.team ?? [])
      .filter((id) => auditoren.has(id))
      .map((id) => ({ regel: 'H26', id, name: projekt.personen.find((p) => p.id === id)?.name ?? id }));
  },
  // Dokument von der eigenen Eigner/in freigegeben, obwohl die Regel der Dokumentenlenkung das nicht vorsieht (D-26)
  // Freigabe durch die Eigner/in selbst: zulässig nach Regel «eigner» oder wenn die Person die Stelle der Regel innehat
  // (Geschäftsleitung; bei Regel «aims» auch die AIMS-Verantwortung)
  H27: ({ projekt }) => {
    const regel = projekt.organisation.dokumentenlenkung?.freigabe;
    if (regel === 'eigner') return [];
    const rollen = (id: string) => projekt.personen.find((x) => x.id === id)?.aimsRollen ?? [];
    const stelle = (id: string) =>
      rollen(id).includes('gl') || (regel === 'aims' && (projekt.organisation.aimsVerantwortlich === id || rollen(id).includes('aims')));
    return projekt.dokumente
      .filter((d) => d.eigner && d.freigabe?.von === d.eigner && !stelle(d.eigner))
      .map((d) => ({ regel: 'H27', id: d.id, name: d.id }));
  },

  // Ab rc.2. Handelnde KI (führt begrenzt aus oder handelt mehrstufig) ohne Stoppmöglichkeit, Protokollierung oder Aufsicht
  H28: ({ projekt }) =>
    projekt.kiSysteme
      .filter((s) => aktiv(s) && handelt(s) && (leer(s.stoppmoeglichkeit) || leer(s.protokollierung) || leer(s.aufsicht)))
      .map((s) => ({ regel: 'H28', id: s.id, name: s.name })),
  // Kritisch für den Betrieb ohne Rückfallweg
  H29: ({ projekt }) =>
    projekt.kiSysteme.filter((s) => aktiv(s) && s.kritisch === true && leer(s.rueckfallweg)).map((s) => ({ regel: 'H29', id: s.id, name: s.name })),
  // Ausser Betrieb oder abgelöst ohne «Aufbewahren bis» oder ohne abgeschlossene Ausserbetriebnahme
  H30: ({ projekt }) =>
    projekt.kiSysteme
      .filter((s) => (s.lebenszyklus === 'ausserbetrieb' || s.status === 'abgeloest') && (leer(s.aufbewahrenBis) || !s.ausserbetrieb?.schritteErledigt))
      .map((s) => ({ regel: 'H30', id: s.id, name: s.name })),
  // Freigegebenes System (nicht Schatten-KI) ohne Einsatzentscheid mit Alternative ohne KI
  H31: ({ projekt }) =>
    projekt.kiSysteme
      .filter((s) => (s.status === 'freigegeben' || s.status === 'eingeschraenkt') && s.typ !== 'schatten' && leer(s.einsatzentscheid?.alternativeOhneKi))
      .map((s) => ({ regel: 'H31', id: s.id, name: s.name })),
  // Generatives System, das fremde Inhalte liest oder öffentlich erreichbar ist, ohne Missbrauchsfälle in der Prüfung
  H32: ({ projekt }) =>
    projekt.kiSysteme
      .filter((s) => aktiv(s) && s.generativ === true && (s.fremdeInhalte === true || s.oeffentlich === true) && leer(s.missbrauchsfaelle))
      .map((s) => ({ regel: 'H32', id: s.id, name: s.name })),
  // Eingekauftes System (Software oder Dienst) ohne Modell oder Version
  H33: ({ projekt }) =>
    projekt.kiSysteme
      .filter((s) => aktiv(s) && (s.typ === 'eingekauft' || s.typ === 'saas') && (leer(s.modell?.name) || leer(s.modell?.version)))
      .map((s) => ({ regel: 'H33', id: s.id, name: s.name })),
  // Sensible Nutzung ohne eigene Kennzahl: kein Ziel mit diesem System in ziele[].kiSysteme und keine Nennung von ID
  // oder Name in Ziel oder Kennzahl
  H34: ({ projekt }) =>
    projekt.kiSysteme
      .filter((s) => aktiv(s) && s.sensibleNutzung)
      .filter(
        (s) =>
          !projekt.ziele.some(
            (z) =>
              z.status !== 'verworfen' &&
              ((z.kiSysteme ?? []).includes(s.id) || [z.ziel, z.kennzahl].some((t) => t.includes(s.id) || (s.name.trim() !== '' && t.includes(s.name)))),
          ),
      )
      .map((s) => ({ regel: 'H34', id: s.id, name: s.name })),
  // Anwendbare Controls mit Status «umgesetzt» oder «wirksam» ohne Angabe zur Wirksamkeitsprüfung; ein Treffer für alle
  // (Anzahl im Titel, Sprung zum ersten), damit die Liste der Hinweise nicht je Control wächst
  H35: ({ projekt }) => {
    const ohne = projekt.controls.filter(
      (c) => c.anwendbar === 'ja' && (c.status === 'umgesetzt' || c.status === 'wirksam') && leer(c.wirksamkeit?.wie) && leer(c.wirksamkeit?.wann),
    );
    return ohne.length ? [{ regel: 'H35', id: ohne[0]!.id, name: String(ohne.length) }] : [];
  },

  // Ab rc.2 (Stage-1-Runde 4). Befristete Ausnahme (risiken[].ausnahme) länger gültig, als die KI-Leitlinie erlaubt
  H42: ({ projekt }) => {
    const max = projekt.organisation.leitlinie.ausnahmeHoechstMonate;
    if (!max) return [];
    return projekt.risiken
      .filter((r) => r.ausnahme?.am && r.ausnahme.bis && r.status !== 'geschlossen' && laengerAls(r.ausnahme.am, r.ausnahme.bis, max))
      .map((r) => ({ regel: 'H42', id: r.id, name: `${r.id} ${r.titel}` }));
  },
  // Restrisiko über der Akzeptanzgrenze angenommen ohne schriftliche Begründung; ab der Grenze «unannehmbar» ohne Ausnahme
  H43: ({ projekt }) => {
    const k = projekt.organisation.risikokriterien;
    return projekt.risiken
      .filter((r) => r.art === 'risiko' && r.restrisikoAkzeptiert && r.status !== 'geschlossen')
      .filter((r) => {
        const rest = wert(r.wNach, r.aNach);
        if (rest >= k.unannehmbarAb) return !r.ausnahme;
        return rest > k.akzeptanzBis && leer(r.restrisikoBegruendung) && !r.ausnahme;
      })
      .map((r) => ({ regel: 'H43', id: r.id, name: `${r.id} ${r.titel}` }));
  },
  // Freigabe eines KI-Systems, Annahme eines Restrisikos oder Ausnahme durch eine niedrigere Stelle, als die
  // Entscheidungsrechte (D-04) für die Risikostufe verlangen
  H44: ({ projekt }) => {
    const t: Treffer[] = [];
    for (const s of projekt.kiSysteme.filter((x) => x.freigabe?.von && (x.status === 'freigegeben' || x.status === 'eingeschraenkt'))) {
      const werte = projekt.risiken.filter((r) => r.art === 'risiko' && r.kiSystem === s.id).map((r) => wert(r.w, r.a));
      const voll = projekt.folgenabschaetzungen.some((f) => f.kiSystem === s.id && f.triage.ergebnis === 'voll');
      const stufe = voll ? 'hoch' : risikostufe(projekt, Math.max(0, ...werte));
      if (zuTief(projekt, 'einfuehren', stufe, s.freigabe!.von, s.eigner)) t.push({ regel: 'H44', id: s.id, name: s.name, bereich: 'inventar' });
    }
    for (const r of projekt.risiken.filter((x) => x.art === 'risiko' && x.status !== 'geschlossen')) {
      if (r.restrisikoAkzeptiert?.von && zuTief(projekt, 'restrisiko', risikostufe(projekt, wert(r.wNach, r.aNach)), r.restrisikoAkzeptiert.von, r.eigner))
        t.push({ regel: 'H44', id: r.id, name: `${r.id} ${r.titel}`, bereich: 'risiken' });
      else if (r.ausnahme?.von && zuTief(projekt, 'ausnahme', risikostufe(projekt, wert(r.w, r.a)), r.ausnahme.von, r.eigner))
        t.push({ regel: 'H44', id: r.id, name: `${r.id} ${r.titel}`, bereich: 'risiken' });
    }
    return t;
  },
  // Lieferant «geprüft», obwohl Prüffragen oder Vertragsklauseln offen oder nicht erfüllt sind (dann «mit Auflagen»)
  H45: ({ projekt }) =>
    projekt.lieferanten
      .filter((l) => l.pruefstatus === 'geprueft')
      .filter(
        (l) =>
          PRUEFPUNKTE_LIEFERANT.some((f) => l.pruefpunkte[f] === 'offen' || l.pruefpunkte[f] === 'nein') ||
          Object.values(l.vertragsklauseln ?? {}).some((v) => v === 'offen' || v === 'nein'),
      )
      .map((l) => ({ regel: 'H45', id: l.id, name: l.name })),
  // Prüfung durch die zweite Person nach der Freigabe datiert (D-26, 7.5.2)
  H46: ({ projekt }) =>
    projekt.dokumente
      .filter((d) => d.geprueft?.am && d.freigabe?.am && d.geprueft.am.slice(0, 10) > d.freigabe.am.slice(0, 10))
      .map((d) => ({ regel: 'H46', id: d.id, name: d.id })),
  // Gleicher Text der Wirksamkeitsprüfung (wie und Ergebnis) bei vielen Controls: ein Treffer mit der Anzahl
  H47: ({ projekt }) => {
    const gruppen = new Map<string, ControlEintrag[]>();
    for (const c of projekt.controls.filter((x) => x.anwendbar === 'ja' && !leer(x.wirksamkeit?.wie))) {
      const schluessel = `${c.wirksamkeit!.wie!.trim()}|${(c.wirksamkeit!.ergebnis ?? '').trim()}`;
      gruppen.set(schluessel, [...(gruppen.get(schluessel) ?? []), c]);
    }
    const gross = [...gruppen.values()].filter((g) => g.length >= GLEICHE_WIRKSAMKEIT_AB).sort((a, b) => b.length - a.length)[0];
    return gross ? [{ regel: 'H47', id: gross[0]!.id, name: String(gross.length) }] : [];
  },
  // Wirksamkeit mit einem Audit belegt, dessen Checkliste das Control nicht oder als nicht prüfbar führt
  H48: ({ projekt }) =>
    projekt.controls
      .filter((c) => c.anwendbar === 'ja' && c.wirksamkeit)
      .filter((c) =>
        [...`${c.wirksamkeit!.wie ?? ''} ${c.wirksamkeit!.ergebnis ?? ''}`.matchAll(/\bAU-\d{3}\b/g)].some((m) => {
          const a = projekt.audits.find((x) => x.id === m[0]);
          if (!a?.checkliste) return false;
          const e = a.checkliste[c.id];
          return !e || e.ergebnis === 'nicht-pruefbar' || e.ergebnis === 'nicht-geprueft';
        }),
      )
      .map((c) => ({ regel: 'H48', id: c.id, name: c.id })),
  // Risiko eines KI-Systems vor dessen letzter Änderung beurteilt (z. B. Nachtraining, neues Modell; D-06, D-12): wie H07 für
  // Folgenabschätzungen. Datum der Beurteilung (beurteiltAm), sonst der Annahme des Restrisikos; ohne Datum kein Befund.
  H49: ({ projekt }) =>
    projekt.risiken
      .filter((r) => r.art === 'risiko' && r.status !== 'geschlossen' && r.kiSystem)
      .flatMap((r) => {
        const s = projekt.kiSysteme.find((x) => x.id === r.kiSystem);
        const beurteilt = r.beurteiltAm ?? r.restrisikoAkzeptiert?.am;
        if (!s?.geaendertAm || !beurteilt || !aktiv(s)) return [];
        return beurteilt.slice(0, 10) < s.geaendertAm.slice(0, 10) ? [{ regel: 'H49', id: r.id, name: `${r.id} (${s.name})` }] : [];
      }),

  // Ab rc.3 (Dienst und Tarif, handelnde KI, Kennungen). Vertrauliche oder strengere Datenklasse in einem Gratis- oder
  // Privattarif: ohne Vertrag zur Auftragsbearbeitung und ohne Zusagen zum Training kein tragfähiger Kanal
  F30: ({ projekt }) =>
    projekt.kiSysteme
      .filter((s) => aktiv(s) && s.status !== 'ausgesetzt' && !!s.tarif && TARIFE_OHNE_FIRMENVERTRAG.includes(s.tarif) && vertraulich(s))
      .map((s) => ({ regel: 'F30', id: s.id, name: s.name })),
  // Gefährliche Kombination: liest fremde Inhalte, darf vertrauliche Daten verarbeiten und handelt ohne Bestätigung
  H50: ({ projekt }) =>
    projekt.kiSysteme
      .filter((s) => aktiv(s) && s.status !== 'ausgesetzt' && s.fremdeInhalte === true && vertraulich(s) && handelt(s))
      .map((s) => ({ regel: 'H50', id: s.id, name: s.name })),
  // Handelt ohne Bestätigung, aber alle bewerteten Risiken des Systems haben die tiefste Auswirkung (D-06 Autonomie)
  H51: ({ projekt }) => {
    const tiefste = Math.min(...projekt.organisation.risikokriterien.auswirkung.map((x) => x.stufe));
    return projekt.kiSysteme
      .filter((s) => aktiv(s) && handelt(s))
      .filter((s) => {
        const a = projekt.risiken.filter((r) => r.art === 'risiko' && r.status !== 'geschlossen' && r.kiSystem === s.id && r.a !== null).map((r) => r.a!);
        return a.length > 0 && Number.isFinite(tiefste) && Math.max(...a) <= tiefste;
      })
      .map((s) => ({ regel: 'H51', id: s.id, name: s.name }));
  },
  // Veraltete Kennung in Freitexten: OWASP-Nummer ohne Jahr oder aus einer älteren Liste, AI-Act-Artikel aus der Entwurfsfassung
  H52: ({ projekt }) => {
    const t: Treffer[] = [];
    const pruefe = (bereich: string, id: string, objekt: unknown) => {
      const fund = veralteteKennung(texteIn(objekt).join('\n'));
      if (fund) t.push({ regel: 'H52', id, name: fund, bereich });
    };
    for (const x of projekt.kiSysteme) pruefe('inventar', x.id, x);
    for (const x of projekt.risiken) pruefe('risiken', x.id, x);
    for (const x of projekt.massnahmen) pruefe('massnahmen', x.id, x);
    for (const x of projekt.controls) pruefe('soa', x.id, { b: x.begruendung, u: x.umsetzung });
    for (const x of projekt.lieferanten) pruefe('lieferanten', x.id, x);
    for (const x of projekt.folgenabschaetzungen) pruefe('folgen', x.id, x);
    for (const x of projekt.feststellungen) pruefe('feststellungen', x.id, x);
    pruefe('organisation', 'leitlinie', projekt.organisation.leitlinie);
    return t;
  },
  // Abkündigung des Modells oder Dienstes durch den Anbieter überschritten oder innert 90 Tagen
  H53: ({ projekt, heute }) =>
    projekt.kiSysteme
      .filter((s) => aktiv(s) && s.lebenszyklus !== 'ausserbetrieb' && !leer(s.abkuendigung) && tageZwischen(heute, s.abkuendigung!.slice(0, 10)) <= 90)
      .map((s) => ({ regel: 'H53', id: s.id, name: s.name })),
  // Bewertetes Risiko unter der Akzeptanzgrenze ohne Behandlungsentscheid (6.1.3: auch «akzeptieren» ist ein Entscheid);
  // über der Grenze meldet F08
  H54: ({ projekt }) => {
    const grenze = projekt.organisation.risikokriterien.akzeptanzBis;
    return projekt.risiken
      .filter((r) => r.art === 'risiko' && r.status !== 'geschlossen' && !r.behandlung && typeof r.w === 'number' && typeof r.a === 'number' && wert(r.w, r.a) <= grenze)
      .map((r) => ({ regel: 'H54', id: r.id, name: `${r.id} ${r.titel}` }));
  },

  // Prozesse (nur wenn das Projekt Prozesse führt). Anwendbarer Pflichtprozess ohne Eigner (auch nicht über die Rolle in D-04)
  F31: (k) => prozesse(k).filter((s) => s.sicht === 'aims' && s.anwendbar === 'ja' && s.katalog.pflicht === 'pflicht' && !s.eigner).map((s) => treffer('F31', s.id)),
  // «Nicht anwendbar» ohne Begründung, oder ein Pflichtprozess als nicht anwendbar
  F32: (k) => prozesse(k).filter((s) => s.eintrag?.anwendbar === 'nein' && (s.katalog.pflicht === 'pflicht' || leer(s.eintrag.begruendung))).map((s) => treffer('F32', s.id)),
  // Durchführung nach Rhythmus oder Termin überfällig
  H55: (k) => prozesse(k).filter((s) => imDashboard(s) && s.ueberfaellig).map((s) => treffer('H55', s.id)),
  // Reife ab «eingeführt», aber weder Durchführung noch Nachweis
  H56: (k) => prozesse(k).filter((s) => imDashboard(s) && s.reife >= 2 && !s.letzteDurchfuehrung && !s.nachweise.length).map((s) => treffer('H56', s.id)),
  // Reife ab «wirksam», aber keine Kennzahl oder kein Messwert in den letzten zwölf Monaten
  H57: (k) => prozesse(k).filter((s) => imDashboard(s) && s.reife >= 3 && !s.kennzahl?.aktuell).map((s) => treffer('H57', s.id)),
  // Reife «überprüft», aber kein internes Audit oder keine Managementbewertung der letzten zwölf Monate
  H58: (k) =>
    prozesse(k)
      .filter((s) => imDashboard(s) && s.reife === 4)
      .filter((s) => {
        const pr = pruefungenDesProzesses(k.projekt, s.id, k.heute);
        return !pr.audit || !pr.mb;
      })
      .map((s) => treffer('H58', s.id)),
  // Offene Massnahmen des Prozesses überfällig
  H59: (k) => prozesse(k).filter((s) => imDashboard(s) && s.massnahmenUeberfaellig.length > 0).map((s) => treffer('H59', s.id, `${s.id} (${s.massnahmenUeberfaellig.join(', ')})`)),
  // Widerspruch zu den Projektdaten: Reife ab «eingeführt» mit Durchführung von Hand, die Projektdaten zeigen aber keine
  H60: (k) => prozesse(k).filter((s) => imDashboard(s) && s.reife >= 2 && s.katalog.ableitung.length > 0 && !s.abgeleitet && !!s.eintrag?.letzteDurchfuehrung).map((s) => treffer('H60', s.id)),
  // Übernahme aus draw.io mit Bahnen ohne Rolle oder Formen ohne Zuordnung
  H61: (k) =>
    prozesse(k)
      .filter((s) => (s.eintrag?.drawio?.offen?.bahnen.length ?? 0) + (s.eintrag?.drawio?.offen?.formen.length ?? 0) > 0 || (s.eintrag?.schritte?.length ? (s.eintrag.bahnen ?? []).some((b) => !b.rolle && s.eintrag!.schritte!.some((x) => x.bahn === b.id)) : false))
      .map((s) => treffer('H61', s.id)),
  // Pfad mit ISMS: gemeinsam geführter Prozess oder ISMS-Basisprozess ohne Verweis auf das ISMS
  H62: (k) =>
    k.projekt.meta.mitIsms
      ? prozesse(k).filter((s) => s.anwendbar === 'ja' && (s.katalog.art === 'gemeinsam' || s.katalog.art === 'nur-isms') && leer(s.eintrag?.ismsVerweis)).map((s) => treffer('H62', s.id))
      : [],

  // Auditzyklus (drei Jahre): anwendbarer Pflichtprozess in keinem internen Audit der letzten 36 Monate und in keinem
  // geplanten im Umfang. Nur wenn die Audits den Umfang auf Prozesse eingrenzen (ohne Auswahl umfasst ein Audit alle).
  H63: (k) => {
    const imUmfang = k.projekt.prozesse === undefined ? undefined : prozesseImAuditzyklus(k.projekt, k.heute);
    if (!imUmfang) return [];
    return prozesse(k)
      .filter((s) => imDashboard(s) && s.katalog.pflicht === 'pflicht' && !imUmfang.has(s.id))
      .map((s) => treffer('H63', s.id));
  },

  // Stage-1-Runde 6. Dokument freigegeben ohne Prüfung durch eine zweite Person (D-26, 7.5.2); H46 prüft die Reihenfolge
  H66: ({ projekt }) =>
    projekt.dokumente
      .filter((d) => d.status === 'freigegeben' && !!d.freigabe?.am && !d.geprueft?.von)
      .map((d) => ({ regel: 'H66', id: d.id, name: d.id })),
  // Durchführung überfällig, aber keine offene Massnahme zum Prozess (Entscheid, neuer Termin, Verantwortung)
  H67: (k) => prozesse(k).filter((s) => imDashboard(s) && s.ueberfaellig && s.massnahmenOffen.length === 0).map((s) => treffer('H67', s.id)),
  // Prozesseigner widerspricht der Zuständigkeit in D-04 (Rollenbereich des Prozesses einer anderen Person zugewiesen) oder
  // ist eine externe Person. Die Geschäftsleitung als Eignerin widerspricht nie.
  H68: (k) =>
    prozesse(k)
      .filter((s) => imDashboard(s) && !!s.eintrag?.eigner)
      .filter((s) => {
        const eigner = s.eintrag!.eigner!;
        const person = k.projekt.personen.find((x) => x.id === eigner);
        if (person && /\bextern|\bexternal\b|externe[nrs]?\b/i.test(person.funktion)) return true;
        if (person?.aimsRollen.includes('gl')) return false;
        const zustaendig = k.projekt.rollen.filter((r) => r.bereich === s.katalog.eigner_rolle && r.verantwortlich).map((r) => r.verantwortlich!);
        return zustaendig.length > 0 && !zustaendig.includes(eigner) && !k.projekt.rollen.some((r) => r.bereich === s.katalog.eigner_rolle && r.rechenschaft === eigner);
      })
      .map((s) => treffer('H68', s.id)),
  // Vollständige Folgenabschätzung nötig nach dem Kriterium in D-06 (Risiko mit höchster Auswirkung für Individuen oder
  // Gesellschaft), es liegt aber nur eine Kurzprüfung vor
  H69: ({ projekt }) => {
    const hoechste = Math.max(...projekt.organisation.risikokriterien.auswirkung.map((x) => x.stufe));
    if (!Number.isFinite(hoechste)) return [];
    return projekt.kiSysteme
      .filter((s) => aktiv(s))
      .filter((s) =>
        projekt.risiken.some(
          (r) => r.art === 'risiko' && r.status !== 'geschlossen' && r.kiSystem === s.id && r.a !== null && r.a >= hoechste && r.ebenen.some((e) => e === 'individuen' || e === 'gesellschaft'),
        ),
      )
      .filter((s) => {
        const ias = projekt.folgenabschaetzungen.filter((f) => f.kiSystem === s.id);
        return ias.length > 0 && !ias.some((f) => f.triage.ergebnis === 'voll');
      })
      .map((s) => ({ regel: 'H69', id: s.id, name: s.name }));
  },
  // Prozesse und Prozessbeschreibungen (D-27) eingeführt, aber nicht als Änderung am AIMS geplant (6.3): keine Massnahme
  // mit Herkunft «aenderung» und Bezug auf D-27 oder einen Prozess
  H70: ({ projekt, kataloge }) => {
    if (projekt.prozesse === undefined || !kataloge) return [];
    const eingefuehrt = projekt.dokumente.some((d) => d.id === 'D-27') || (projekt.eigeneProzesse ?? []).length > 0;
    if (!eingefuehrt) return [];
    const geplant = projekt.massnahmen.some((m) => m.herkunft.art === 'aenderung' && m.status !== 'verworfen' && /\b(?:D-27|P[RSE]-\d{2,3})\b/.test(`${m.herkunft.ref ?? ''} ${m.titel}`));
    return geplant ? [] : [{ regel: 'H70', id: 'D-27', name: 'D-27' }];
  },
  // Prozess durch eine externe Stelle ausgeführt, ohne dass die Firma sie steuert: kein geprüfter Lieferant im Register
  // oder keine Angabe zur Steuerung (8.1, A.10.3)
  H71: (k) =>
    prozesse(k)
      .filter((s) => imDashboard(s) && !!s.eintrag?.extern)
      .filter((s) => {
        const x = s.eintrag!.extern!;
        const l = x.lieferant ? k.projekt.lieferanten.find((y) => y.id === x.lieferant) : undefined;
        return !l || l.pruefstatus === 'offen' || l.pruefstatus === 'abgelehnt' || leer(x.steuerung);
      })
      .map((s) => treffer('H71', s.id)),
  // Eigener Prozess (PE-01 ff.) unvollständig beschrieben: Auslöser, Eingaben, Ausgaben und Nachweise, Dokumente,
  // Kennzahl mit Sollwert, Eigner oder Ablauf fehlen
  H72: (k) =>
    prozesse(k)
      .filter((s) => s.katalog.eigen && s.anwendbar === 'ja')
      .filter((s) => {
        const e = k.projekt.eigeneProzesse?.find((x) => x.id === s.id);
        return !e || leer(e.ausloeser) || leer(e.eingaben) || leer(e.ausgaben) || leer(e.dokumente) || !e.kennzahl || leer(e.kennzahl.text) || !s.eigner || !s.eintrag?.schritte?.length;
      })
      .map((s) => treffer('H72', s.id)),
  // Freigabe im Ablauf widerspricht den Entscheidungsrechten (D-04) oder D-08: Bahn der Freigabe tiefer als die Stelle, die
  // die Risikostufen im Projekt verlangen, keine Freigabe durch die Geschäftsleitung bei vollen Abschätzungen, oder
  // Selbstfreigabe (die Person der Folgenabschätzung gibt ihre Kurzprüfung selbst frei)
  H73: (k) => prozesse(k).filter((s) => imDashboard(s) && freigabeWiderspruch(k, s)).map((s) => treffer('H73', s.id)),
  // Gewählte Kennzahl misst eine andere Einheit als die Kennzahl des Prozesses (z. B. Anzahl statt Prozent, Tage statt Stunden)
  H74: (k) =>
    prozesse(k)
      .filter((s) => imDashboard(s) && !!s.kennzahl && !!s.katalog.kennzahl_vorschlag)
      .filter((s) => {
        const e = kennzahlEinheit(k.projekt, s.kennzahl!.id, s.kennzahl!.wert, s.kennzahl!.titel);
        return !!e && e !== s.katalog.kennzahl_vorschlag!.einheit;
      })
      .map((s) => treffer('H74', s.id, `${s.id} (${s.kennzahl!.id})`)),
  // Periodischer Prozess ohne jede Durchführung und ohne nächsten Termin (beschrieben, aber nicht in Betrieb)
  H75: (k) => prozesse(k).filter((s) => imDashboard(s) && !!s.rhythmus && !s.letzteDurchfuehrung && !s.naechsteFaelligkeit).map((s) => treffer('H75', s.id)),

  // Gestaltung der Firmendokumente (ab rc.9): Logo für dunklen Grund (in hellen Dokumenten kaum sichtbar)
  H64: ({ projekt }) => {
    const url = projekt.organisation.gestaltung?.logo?.png;
    return url && logoFuerDunklenGrund(url) ? [{ regel: 'H64', name: projekt.organisation.gestaltung?.logo?.quelle?.dateiname ?? 'Logo' }] : [];
  },
  // Primärfarbe für Text, Grafik oder Fläche zu hell oder zu dunkel: Dokumente nutzen eine korrigierte Farbe
  H65: ({ projekt }) => {
    const farben = projekt.organisation.gestaltung?.farben;
    if (!farben?.primaer) return [];
    const k = palette(farben).hinweise.filter((h) => h.art === 'korrigiert' && h.quelle === 'primaer');
    if (!k.length) return [];
    const ersatz = [...new Set(k.map((h) => (h.art === 'korrigiert' ? `#${h.ersatz}` : '')))].join(', ');
    return [{ regel: 'H65', name: `#${farben.primaer} (${ersatz})` }];
  },

  // Modul NIST AI RMF (ab rc.2). Lücke des AIMS (abdeckung_kit teilweise oder nicht) ohne Entscheid: Zusatz-Control nicht in
  // der SoA, «offen» oder ohne Begründung (je Control ein Treffer mit den Subkategorien); Präzisierung ohne Notiz im Profil
  F27: ({ projekt, kataloge }) => {
    const d = kataloge && nistDaten(kataloge);
    if (!d) return [];
    const ohneEntscheid = (id: string) => {
      const c = control(projekt, id);
      return !c || c.anwendbar === 'offen' || leer(c.begruendung);
    };
    const luecken = d.kern.subkategorien.filter((s) => s.abdeckung_kit !== 'ganz');
    const jeControl = new Map<string, string[]>();
    for (const s of luecken) if (s.zusatz_control && ohneEntscheid(s.zusatz_control)) jeControl.set(s.zusatz_control, [...(jeControl.get(s.zusatz_control) ?? []), s.id]);
    for (const c of projekt.controls) if (c.rahmenwerk === 'NISTRMF' && c.anwendbar === 'offen' && !jeControl.has(c.id)) jeControl.set(c.id, []);
    const t: Treffer[] = [...jeControl].map(([id, subk]) => ({ regel: 'F27', id, name: subk.length ? `${id} (${subk.join(', ')})` : id, bereich: 'soa' }));
    for (const s of luecken) if (s.praezisierung && leer(projekt.nistProfil?.[s.id]?.notiz)) t.push({ regel: 'F27', id: s.id, name: s.id, bereich: 'nistrmf' });
    return t.sort((a, b) => a.id!.localeCompare(b.id!, 'de', { numeric: true }));
  },
  // Aktives generatives System ohne Entscheid zu allen zwölf Risiken nach NIST AI 600-1 (N-04, kiSysteme[].genaiBewertung)
  F28: ({ projekt, kataloge }) => {
    const risiken = (kataloge && nistDaten(kataloge)?.risiken) ?? [];
    if (!risiken.length) return [];
    return projekt.kiSysteme
      .filter((s) => aktiv(s) && s.generativ === true)
      .filter((s) => risiken.some((r) => (s.genaiBewertung?.[r.id]?.relevant ?? 'offen') === 'offen'))
      .map((s) => ({ regel: 'F28', id: s.id, name: s.name }));
  },
  // Freigegebenes System (nicht Schatten-KI) ohne Prüfung im Mess- und Prüfkonzept (N-03, RMF-09): keine Prüfung mit
  // Messgrösse oder begründet nicht messbar; entfällt, wenn RMF-09 in der SoA begründet ausgeschlossen ist. Der
  // Einsatzentscheid (RMF-08) ist schon Gegenstand von H31.
  F29: ({ projekt }) => {
    const rmf09 = control(projekt, 'RMF-09');
    if (rmf09?.anwendbar === 'nein' && !leer(rmf09.begruendung)) return [];
    return projekt.kiSysteme
      .filter((s) => (s.status === 'freigegeben' || s.status === 'eingeschraenkt') && s.typ !== 'schatten')
      .filter((s) => !(s.messkonzept?.pruefungen ?? []).some((x) => !leer(x.messgroesse) || !leer(x.nichtMessbar)))
      .map((s) => ({ regel: 'F29', id: s.id, name: s.name }));
  },
  // Stand des NIST AI RMF (src/nist-rmf/stand.yaml) älter als hinweis_nach_monaten (6 Monate, analog H15)
  H36: ({ heute, kataloge }) => {
    const st = kataloge && nistDaten(kataloge)?.stand;
    return st && monateZwischen(st.geprueft_am, heute) >= (st.hinweis_nach_monaten || 6) ? [{ regel: 'H36' }] : [];
  },
  // Ziel-Profil höher als Ist (Profil oder abgeleitet, N-01) ohne Massnahme; ein Treffer für alle Subkategorien
  H37: ({ projekt, kataloge }) => {
    const d = kataloge && nistDaten(kataloge);
    if (!d || !kataloge) return [];
    const offeneMassnahme = (ids: string[] = []) => ids.some((id) => projekt.massnahmen.some((m) => m.id === id && m.status !== 'verworfen'));
    const ohne = d.kern.subkategorien.filter((s) => {
      const e = projekt.nistProfil?.[s.id];
      return e?.ziel !== undefined && e.ziel > istStufe(projekt, kataloge, s).stufe && !offeneMassnahme(e.massnahmen);
    });
    return ohne.length ? [{ regel: 'H37', id: ohne[0]!.id, name: String(ohne.length), bereich: 'nistrmf' }] : [];
  },
  // Modul eingeschaltet, aber kein Ziel im Profil festgelegt (N-01 zeigt keine Lücken)
  H38: ({ projekt }) => (Object.values(projekt.nistProfil ?? {}).some((e) => e.ziel !== undefined) ? [] : [{ regel: 'H38' }]),
  // Generatives System: Risiko nach NIST AI 600-1 als relevant bewertet, aber ohne Massnahme (N-04)
  H39: ({ projekt }) =>
    projekt.kiSysteme
      .filter((s) => aktiv(s) && s.generativ === true)
      .filter((s) => Object.values(s.genaiBewertung ?? {}).some((b) => b.relevant === 'ja' && leer(b.massnahme)))
      .map((s) => ({ regel: 'H39', id: s.id, name: s.name })),
  // Unabhängige Überprüfung der Messungen (RMF-10) vorgeschlagen (Eigenbau, Produkthersteller, Gesundheit oder Sicherheit),
  // nicht ausgeschlossen und im Messkonzept ohne Angabe, wer oder wann
  H40: ({ projekt, kataloge }) => {
    const d = kataloge && nistDaten(kataloge);
    if (!d || control(projekt, 'RMF-10')?.anwendbar === 'nein') return [];
    const systeme = rmfVorschlaege(projekt, d.controls).find((v) => v.id === 'RMF-10')?.systeme ?? [];
    return projekt.kiSysteme
      .filter((s) => systeme.includes(s.id) && leer(s.messkonzept?.unabhaengig?.wer) && leer(s.messkonzept?.unabhaengig?.wann))
      .map((s) => ({ regel: 'H40', id: s.id, name: s.name }));
  },
  // Bibliothek (ab rc.10): Prüfung überfällig für Einträge mit Prüfdatum in der Bibliothek (Register-Dokumente meldet H01)
  H76: ({ projekt, heute }) =>
    bibliothek(projekt)
      .filter((e) => !e.register && pruefungFaellig(e, heute) === 'ueberfaellig')
      .map((e) => ({ regel: 'H76', id: e.id, name: bibName(e) })),
  // Freigegebene Version ohne Angabe, wer wann freigegeben hat (Nachweise kennen keine Freigabe)
  H77: ({ projekt }) =>
    bibliothek(projekt)
      .filter((e) => e.gespeichert && e.art !== 'nachweis' && e.versionen.some((v) => v.status === 'freigegeben' && !(v.freigabe?.von && v.freigabe.am)))
      .map((e) => ({ regel: 'H77', id: e.id, name: bibName(e) })),
  // Letzter Abgleich: Datei ausserhalb geändert, nicht eingecheckt (H78) bzw. Datei fehlt (H79)
  H78: ({ projekt }) => (projekt.bibliothek?.abgleich?.geaendert ?? []).map((id) => ({ regel: 'H78', id, name: id })),
  H79: ({ projekt }) => (projekt.bibliothek?.abgleich?.fehlend ?? []).map((id) => ({ regel: 'H79', id, name: id })),
  // Browserspeicher: seit 30 Tagen keine Sicherung (ohne Sicherung zählt die älteste Version), und es gibt Ungesichertes
  H80: ({ projekt, heute }) => {
    const b = projekt.bibliothek;
    if (b?.ablage !== 'browser') return [];
    const daten = b.eintraege.flatMap((e) => e.versionen.map((v) => v.datum.slice(0, 10))).sort();
    if (!daten.length) return [];
    const seit = b.gesichertAm?.slice(0, 10) ?? daten[0]!;
    const ungesichert = !b.gesichertAm || daten.some((d) => d > b.gesichertAm!.slice(0, 10));
    return ungesichert && tageBis(seit, heute) > 30 ? [{ regel: 'H80' }] : [];
  },
  // Kurzprüfung: Rechte betroffen, Ergebnis der Folgenabschätzung aber nicht als sensibel markiert
  H81: ({ projekt }) =>
    projekt.folgenabschaetzungen
      .filter((f) => f.triage?.rechtspositionOderChancen === true && f.sensibleNutzung !== true && f.triage.ergebnis === 'voll')
      .map((f) => ({ regel: 'H81', id: f.id, name: projekt.kiSysteme.find((s) => s.id === f.kiSystem)?.name ?? f.kiSystem })),
  // Schwelle über dem höchsten Risikowert der Skala (W mal A): nie erreichbar
  H82: ({ projekt }) => {
    const k = projekt.organisation.risikokriterien;
    const hoechst = Math.max(0, ...(k?.wahrscheinlichkeit ?? []).map((x) => x.stufe)) * Math.max(0, ...(k?.auswirkung ?? []).map((x) => x.stufe));
    // Einstufige Skalen sind unvollständig (andere Regeln, Seite E6-skalen); die Warnung gilt fertigen Skalen
    const fertig = (k?.wahrscheinlichkeit?.length ?? 0) >= 2 && (k?.auswirkung?.length ?? 0) >= 2;
    return fertig && typeof k?.unannehmbarAb === 'number' && k.unannehmbarAb > hoechst ? [{ regel: 'H82' }] : [];
  },
  // Erledigte Massnahme ohne Nachweis: Die Kette Risiko, Control, Massnahme, Nachweis bricht am Ende (8.3)
  H83: ({ projekt }) =>
    projekt.massnahmen
      .filter((m) => {
        if (m.status !== 'erledigt') return false;
        if (!m.nachweise?.length) return true;
        // Nachweis älter als die Massnahme: Er kann die Umsetzung nicht belegen. Massgebend ist das Datum des Nachweises;
        // Dokumente aus dem Register belegen über ihre jüngste Fassung
        const seit = m.erfasstAm ?? m.start;
        return !!seit && m.nachweise.every((id) => {
          const n = projekt.nachweise.find((x) => x.id === id)?.datum;
          const d = projekt.dokumente.find((x) => x.id === id);
          const datum = n ?? d?.freigabe?.am ?? d?.aenderungen?.at(-1)?.datum;
          return !!datum && datum < seit;
        });
      })
      .map((m) => ({ regel: 'H83', id: m.id, name: m.titel })),
  // Prozess ab Stufe «eingeführt» ohne einen Messwert seiner Kennzahl (weder Ziel noch weitere Kennzahl, noch unter der Prozess-ID)
  H84: ({ projekt }) =>
    (projekt.prozesse ?? [])
      .filter((e) => e.anwendbar !== 'nein' && (e.reife ?? 0) >= 2)
      .filter((e) => {
        const kz = e.kennzahl ?? e.id;
        if (projekt.ziele.some((z) => z.id === kz && z.messungen.length)) return false;
        const m = (projekt.kennzahlMessungen ?? []).filter((x) => x.kennzahl === kz || x.kennzahl === e.id);
        if (!m.length) return true;
        // Kennzahl des Prozesses: Sollvergleich oder ausdrücklich keine Messung (kein Anlass, erste Messung offen)
        const prozessMessungen = m.filter((x) => /^P[RSE]-\d/.test(x.kennzahl));
        return prozessMessungen.length > 0 && !prozessMessungen.some((x) => x.sollErreicht || x.keineMessung);
      })
      .map((e) => ({ regel: 'H84', id: e.id, name: e.id })),
  // Mindestzahlen aus den Hilfetexten: je drei Themen, drei Quellen der Inventarsuche (nur, wenn schon etwas erfasst ist)
  H91: ({ projekt }) => {
    const themen = projekt.organisation.kontext?.themen ?? [];
    const quellen = (projekt.meta.gefuehrt?.antworten?.inventar as { quellen?: unknown[] } | undefined)?.quellen ?? [];
    const zaehl = (art: string) => themen.filter((t) => t.art === art).length;
    return [
      ...(themen.length && (zaehl('extern') < 3 || zaehl('intern') < 3) ? [{ regel: 'H91', id: 'themen', name: `${zaehl('extern')}, ${zaehl('intern')}` }] : []),
      ...(quellen.length > 0 && quellen.length < 3 ? [{ regel: 'H91', id: 'quellen', name: String(quellen.length) }] : []),
    ];
  },
  // Runde 2b (AF-076, AF-077, AF-079): Status nur so gut wie die Aufzeichnung, zeitliche Gültigkeit der Belege,
  // Stimmigkeit als Prüfregel. Ein Treffer je Objekt (W3); vor dem verbindlichen Status nur Hinweis (W2).
  F34: ({ projekt }) => wirksamTrotzOffenerFeststellung(projekt).map((b) => statusTreffer('F34', b)),
  F35: ({ projekt, kataloge }) => eingefuehrtOhneDurchfuehrung(projekt, kataloge).map((b) => ({ regel: 'F35', id: b.id, name: b.id })),
  F36: ({ projekt }) => platzhalterInDokumenten(projekt).map((b) => statusTreffer('F36', b)),
  F37: ({ projekt, kataloge }) => prozessrollenOhneBesetzung(projekt, kataloge).map((b) => ({ ...statusTreffer('F37', b), name: b.details.join(', '), rollen: b.details })),
  F38: ({ projekt, kataloge }) =>
    juristischOhneBeleg(projekt, kataloge?.['aiact_stand'] as Parameters<typeof juristischOhneBeleg>[1]).map((b) => ({ regel: 'F38', id: b.id, name: projekt.kiSysteme.find((s) => s.id === b.id)?.name ?? b.id })),
  F39: ({ projekt }) => zeitTreffer('F39', belegeJuenger(projekt)),
  F40: ({ projekt }) => zeitTreffer('F40', verweiseVorFreigabe(projekt)),
  F41: ({ projekt, kataloge }) => zeitTreffer('F41', standNachKopfdatum(projekt, standDesKits(kataloge))),
  F42: ({ projekt }) => stichprobeDecktNichtAlle(projekt).map((b) => statusTreffer('F42', b)),
  // Sprung zum Eintrag und Feld, das die Datenquelle liefert: PR-07 ins Inventar (Antrag, Entscheid), PR-19 in die Vorfälle
  F43: ({ projekt }) =>
    kennzahlOhneDatenquelle(projekt).map((b) => ({ ...statusTreffer('F43', b), name: b.id, bereich: b.ort?.bereich ?? 'prozesse', ...(b.ort?.eintrag ? { eintrag: b.ort.eintrag } : {}), ...(b.ort?.feld ? { feld: b.ort.feld } : {}) })),
  // Runde 3a (P14, AF-095): Folgenabschätzung tragfähig (A3-02b); Fehler mit Freigabe der Abschätzung, vorher Hinweis
  F44: ({ projekt }) => folgenWortgleich(projekt).map((b) => ({ ...statusTreffer('F44', b), name: iaName(projekt, b.id) })),
  F45: ({ projekt }) => ausmassGegenRegister(projekt).map((b) => statusTreffer('F45', b)),
  F46: ({ projekt }) => entscheidGegenSchwelle(projekt).map((b) => ({ ...statusTreffer('F46', b), name: iaName(projekt, b.id) })),
  F47: ({ projekt }) => inventarSensibel(projekt).map((b) => ({ ...statusTreffer('F47', b), name: projekt.kiSysteme.find((s) => s.id === b.id)?.name ?? b.id })),
  // Risiko «behandelt» oder «akzeptiert», obwohl eine zugeordnete Massnahme noch offen ist
  H85: ({ projekt }) => {
    const offen = new Set(projekt.massnahmen.filter((m) => m.status === 'offen' || m.status === 'in-arbeit').map((m) => m.id));
    return projekt.risiken
      .filter((r) => (r.status === 'behandelt' || r.status === 'akzeptiert') && r.massnahmen.some((m) => offen.has(m)))
      .map((r) => ({ regel: 'H85', id: r.id, name: `${r.id} ${r.titel || r.beschreibung.slice(0, 60)}`.trim() }));
  },
  // Wirksamkeit einer Feststellung vor dem Abschluss der letzten zugehörigen Massnahme geprüft
  H86: ({ projekt }) =>
    projekt.feststellungen
      .filter((f) => f.wirksamkeit?.am && f.massnahmen.some((id) => {
        const m = projekt.massnahmen.find((x) => x.id === id);
        return !!m && (m.status === 'offen' || m.status === 'in-arbeit' || (!!m.erledigtAm && m.erledigtAm > f.wirksamkeit!.am));
      }))
      .map((f) => ({ regel: 'H86', id: f.id, name: f.id })),
  // Bibliothek: Verknüpfung mit einem Control, das den Eintrag in der Erklärung zur Anwendbarkeit nicht als Nachweis führt
  H87: ({ projekt }) =>
    (projekt.bibliothek?.eintraege ?? []).flatMap((e) =>
      (e.verknuepfungen?.controls ?? [])
        .filter((c) => {
          const ctrl = projekt.controls.find((x) => x.id === c);
          const nw = [e.id, ...(e.verknuepfungen?.nachweise ?? [])].filter((n) => projekt.nachweise.some((x) => x.id === n));
          return !!ctrl && nw.length > 0 && !nw.some((n) => ctrl.nachweise.includes(n));
        })
        .map((c) => ({ regel: 'H87', id: e.id, name: `${e.titel} (${c})` })),
    ),
  // Generative Eigenentwicklung ohne Grundmodell oder Version (RMF-16); eingekaufte Systeme meldet H33
  H41: ({ projekt }) =>
    projekt.kiSysteme
      .filter((s) => aktiv(s) && s.generativ === true && s.typ === 'eigenbau' && (leer(s.modell?.name) || leer(s.modell?.version)))
      .map((s) => ({ regel: 'H41', id: s.id, name: s.name })),
  // Verweisregister (AF-008): jede Verweisart aus src/model/verweise.ts; Katalogprozesse nur mit geladenem Katalog prüfbar
  F33: ({ projekt, kataloge, controlIds42001 }) =>
    haengendeVerweise(projekt, {
      // Controls aus den Katalogen gelten wie bei F05 auch ohne Eintrag im Projekt
      katalogControls: [...controlIds42001, ...katalogIds(kataloge?.['aiact_euaiaControls']), ...katalogIds(kataloge?.nistrmf_rmfControls)],
      ...(kataloge ? { katalogProzesse: prozesseImProjekt(null, kataloge).map((x) => x.id) } : {}),
    }).map((v) => ({
      regel: 'F33',
      ...(v.quelleId ? { id: v.quelleId } : {}),
      // Ort lesbar: Eintrag (oder Bereich) und die Kennung, die ins Leere zeigt; «gesucht» übersetzt die Oberfläche
      name: `${v.quelleId ?? v.wurzel} → ${v.wert}`,
      fehlt: [`verweis_${v.zielliste}`],
      bereich: VERWEIS_BEREICH[v.wurzel] ?? 'uebersicht',
      verweisFeld: v.feld,
      // Personen und Rollen liegen im Reiter «Rollen» der Organisation
      ...(v.wurzel === 'personen' || v.wurzel === 'rollen' ? { id: 'rollen' } : {}),
    })),
};

/** Kennungen aus einem Katalog mit Feld `controls` (EUAIA, RMF) */
const katalogIds = (k: unknown): string[] => ((k as { controls?: { id: string }[] } | undefined)?.controls ?? []).map((c) => c.id);

/** Bereich im Werkzeug je Wurzelliste, für den Sprung zum Eintrag mit dem hängenden Verweis (F33) */
const VERWEIS_BEREICH: Record<string, string> = {
  audits: 'audits', bibliothek: 'bibliothek', controls: 'soa', dokumente: 'dokumente', eigeneProzesse: 'prozesse', feststellungen: 'feststellungen',
  folgenabschaetzungen: 'folgen', kennzahlen: 'ziele', kennzahlMessungen: 'ziele', kiSysteme: 'inventar', kommunikation: 'kommunikation', kompetenzen: 'kompetenz',
  lieferanten: 'lieferanten', managementbewertungen: 'managementbewertung', massnahmen: 'massnahmen', meldungen: 'feststellungen', nistProfil: 'nistrmf', organisation: 'organisation',
  personen: 'organisation', prozesse: 'prozesse', risiken: 'risiken', rollen: 'organisation', ziele: 'ziele',
};

export interface Regel {
  id: string;
  schwere: 'fehler' | 'hinweis';
  /** true: nur mit Modul EU AI Act; «nistrmf»: nur mit Modul NIST AI RMF (ab rc.2) */
  modul?: boolean | 'nistrmf';
  ziel: string;
  norm: string;
}

export interface Befund extends Treffer {
  schwere: 'fehler' | 'hinweis';
  ziel: string;
  norm: string;
}

/** Führt alle Regeln aus. Modulregeln nur bei eingeschaltetem Modul (EU AI Act bzw. NIST AI RMF). */
export function pruefeProjekt(regeln: Regel[], k: PruefKontext): Befund[] {
  const befunde: Befund[] = [];
  for (const r of regeln) {
    if (r.modul === 'nistrmf' ? k.projekt.meta.modulNistRmf !== true : r.modul && !k.projekt.meta.modulAiAct) continue;
    const pruefung = PRUEFUNGEN[r.id];
    if (!pruefung) throw new Error(`Prüffunktion fehlt: ${r.id}`);
    for (const t of pruefung(k)) {
      const ziel = r.ziel.replace('{id}', t.id ?? '').replace('{bereich}', t.bereich ?? '').replace('{eintrag}', t.eintrag ?? '').replace(/\/$/, '');
      befunde.push({ ...t, schwere: t.schwere ?? r.schwere, ziel, norm: r.norm });
    }
  }
  return befunde;
}
