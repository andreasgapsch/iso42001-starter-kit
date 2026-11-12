// Prozesskatalog im Projekt: Sicht im Pfad (mit/ohne ISMS), Anwendbarkeit, Eigner, Texte und wirksamer Ablauf.
// Reine Funktionen ohne DOM; gelten im Werkzeug, im Generator (D-02, D-21, D-27) und in den Prüfregeln.
import type { Kataloge } from '../kataloge/typen.ts';
import type { EigenerProzess, JaNeinOffen, PersonId, Projekt, ProzessBahn, ProzessEintrag, ProzessSchritt } from '../model/typen.ts';
import type { KatalogProzess, KennzahlEinheit, ProzessKatalog, ProzessTexte, Reifeskala } from './typen.ts';

/** Zugriff auf Sprachtexte (Uebersetzer.roh im Generator, inhaltRoh in der App) */
export interface TextQuelle {
  roh(schluessel: string): unknown;
}

export const LEERER_KATALOG: ProzessKatalog = { rollen: { aus_aims_rolle: [], zusatz: [] }, gruppen: ['fuehrung', 'kern', 'unterstuetzung', 'bewertung'], arten: [], pflichtarten: [], einheiten: [], prozesse: [] };

export function prozessKatalog(k: Kataloge | undefined): ProzessKatalog {
  return k?.prozesse_katalog ?? LEERER_KATALOG;
}

// ---------------------------------------------------------------------------------------------
// Eigene Prozesse der Firma (Projekt.eigeneProzesse, PE-01 ff.)

/**
 * Eigener Prozess als Katalogeintrag: gleiche Logik wie Katalogprozesse (Stand, Dashboard, Prüfregeln, D-02, D-27,
 * draw.io). Verbindlichkeit «eigen», Eigner-Vorschlag AIMS-Verantwortliche, ereignisgesteuert, ohne Ableitung; Dokumente,
 * Schnittstellen und Kennzahl aus dem Projekt. Der Ablauf steht nur im Projekt (prozesse[].schritte).
 */
export function eigenerKatalogProzess(e: EigenerProzess): KatalogProzess {
  return {
    id: e.id,
    gruppe: e.gruppe,
    art: e.art,
    pflicht: 'eigen',
    eigner_rolle: 'aims',
    rhythmus: null,
    normbezug_42001: [...(e.normbezug ?? [])],
    normbezug_27001: [],
    kit_dokumente: [...(e.dokumente ?? [])],
    verbunden: [...(e.schnittstellen ?? [])],
    ...(e.kennzahl ? { kennzahl_vorschlag: { einheit: e.kennzahl.einheit, richtung: e.kennzahl.richtung, soll: e.kennzahl.soll } } : {}),
    ableitung: [],
    schritte: [],
    eigen: true,
  };
}

/** Prozesse eines Projekts: Katalog, danach die eigenen Prozesse (ohne Projekt: nur der Katalog) */
export function prozesseImProjekt(p: Pick<Projekt, 'eigeneProzesse'> | null | undefined, k: Kataloge | undefined): KatalogProzess[] {
  const kat = prozessKatalog(k).prozesse;
  const eigene = p?.eigeneProzesse ?? [];
  return eigene.length ? [...kat, ...eigene.map(eigenerKatalogProzess)] : kat;
}

export const EIGENE_ID = /^PE-\d{2,3}$/;

/**
 * Nächste freie Kennung eines eigenen Prozesses (PE-01, PE-02 …); vergeben zählt zusätzlich (z. B. mehrere Seiten einer Datei).
 * Der Zähler meta.idZaehler.eigeneProzesse (AF-010) zählt mit: Eine gelöschte Kennung wird nicht wieder vergeben.
 */
export function naechsteEigeneId(p: Pick<Projekt, 'eigeneProzesse' | 'prozesse'> & { meta?: Pick<Projekt['meta'], 'idZaehler'> }, vergeben: readonly string[] = []): string {
  const z = p.meta?.idZaehler?.eigeneProzesse;
  let max = typeof z === 'number' && Number.isInteger(z) && z > 0 ? z : 0;
  for (const id of [...(p.eigeneProzesse ?? []).map((e) => e.id), ...(p.prozesse ?? []).map((e) => e.id), ...vergeben]) {
    const m = /^PE-(\d{2,3})$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `PE-${String(max + 1).padStart(2, '0')}`;
}

export function reifeskala(k: Kataloge | undefined): Reifeskala {
  return k?.prozesse_reifeskala ?? { stufen: [] };
}

/** Reifestufe 0 bis 4 als Schlüssel (nicht-begonnen, definiert, eingefuehrt, wirksam, ueberprueft) */
export const REIFE_SCHLUESSEL = ['nicht-begonnen', 'definiert', 'eingefuehrt', 'wirksam', 'ueberprueft'] as const;

// ---------------------------------------------------------------------------------------------
// Pfade im Projekt (Bedingungen und Ableitungen des Katalogs)

/** Teile eines Pfads, z. B. «audits[art=intern].durchgefuehrt» -> audits[art=intern], durchgefuehrt */
function teile(pfad: string): string[] {
  return pfad.split(/\.(?![^[]*\])/);
}

function lies(o: unknown, pfad: string): unknown {
  let x = o;
  for (const t of pfad.split('.')) {
    if (x === null || typeof x !== 'object') return undefined;
    x = (x as Record<string, unknown>)[t];
  }
  return x;
}

/** Wert gesetzt: nicht leer, keine leere Liste, nicht false */
const gesetzt = (v: unknown) => v !== undefined && v !== null && v !== false && v !== '' && !(Array.isArray(v) && v.length === 0);

/** Alle Werte unter einem Pfad; Listen werden aufgefaltet, [feld=wert] filtert Listeneinträge, [feld] auf nicht leere Felder. */
export function pfadWerte(objekt: unknown, pfad: string): unknown[] {
  let aktuell: unknown[] = [objekt];
  for (const teil of teile(pfad)) {
    const m = /^(\w+)(?:\[([\w.]+)(?:=([\w-]+))?\])?$/.exec(teil);
    if (!m) return [];
    const [, name, filterFeld, filterWert] = m;
    const neu: unknown[] = [];
    for (const o of aktuell) {
      if (o === null || typeof o !== 'object') continue;
      const w = (o as Record<string, unknown>)[name!];
      const liste = Array.isArray(w) ? w : w === undefined ? [] : [w];
      for (const e of liste) {
        if (!filterFeld) neu.push(e);
        else if (filterWert === undefined ? gesetzt(lies(e, filterFeld)) : String(lies(e, filterFeld)) === filterWert) neu.push(e);
      }
    }
    aktuell = neu;
  }
  return aktuell;
}

/** Trifft eine Bedingung des Katalogs zu? (wahrer Wert oder mindestens ein passender Listeneintrag) */
export function bedingungErfuellt(p: Projekt, pfad: string): boolean {
  return pfadWerte(p, pfad).some((w) => w !== false && w !== null && w !== undefined && w !== '');
}

/** Jüngstes Datum (JJJJ-MM-TT) unter den Ableitungspfaden, nicht nach dem Stichtag */
export function abgeleitetesDatum(p: Projekt, pfade: readonly string[], stichtag?: string): string | undefined {
  let best: string | undefined;
  // Im Pfad mit ISMS führt die Firma manche Dokumente als Ergänzungsblatt (D-04-EB statt D-04): beide Kennungen zählen.
  // Die Bestätigung eines Dokuments ohne Änderung (z. B. in der Managementbewertung) ist ebenfalls eine Durchführung.
  const mitBestaetigung = pfade.flatMap((x) => (/^dokumente(\[[^\]]*\])?\.freigabe\.am$/.test(x) ? [x, x.replace(/\.freigabe\.am$/, '.bestaetigt.am')] : [x]));
  const alle = mitBestaetigung.flatMap((x) => (/\[id=D-\d\d\]/.test(x) ? [x, x.replace(/\[id=(D-\d\d)\]/, '[id=$1-EB]')] : [x]));
  for (const pfad of alle)
    for (const w of pfadWerte(p, pfad)) {
      if (typeof w !== 'string' || !/^\d{4}-\d\d-\d\d/.test(w)) continue;
      const d = w.slice(0, 10);
      if (stichtag && d > stichtag) continue;
      if (!best || d > best) best = d;
    }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Sicht im Pfad und Anwendbarkeit

/**
 * Rolle des Prozesses im Pfad: aims (AIMS-Prozess), verweis (ISMS-Basisprozess mit ISMS: nur Verweis), minimal (ohne
 * ISMS: Mindestumfang, schlank führen), empfohlen (ohne ISMS: Empfehlung, Status freiwillig)
 */
export type ProzessSicht = 'aims' | 'verweis' | 'minimal' | 'empfohlen';

export function sichtImPfad(kp: KatalogProzess, mitIsms: boolean): ProzessSicht {
  // Eigene Prozesse führt die Firma immer im AIMS-Manager, auch wenn sie einen ISMS-Ablauf beschreiben
  if (kp.art !== 'nur-isms' || kp.eigen) return 'aims';
  if (mitIsms) return 'verweis';
  return kp.minimal_ohne_isms ? 'minimal' : 'empfohlen';
}

export function eintragVon(p: Pick<Projekt, 'prozesse'>, id: string): ProzessEintrag | undefined {
  return p.prozesse?.find((e) => e.id === id);
}

/** Vorschlag zur Anwendbarkeit aus dem Katalog (ohne Eintrag im Projekt) */
export function anwendbarVorschlag(p: Projekt, kp: KatalogProzess): JaNeinOffen {
  if (sichtImPfad(kp, p.meta.mitIsms) === 'empfohlen') return 'offen';
  if (kp.pflicht === 'bedingt') return (kp.bedingung ?? []).some((b) => bedingungErfuellt(p, b)) ? 'ja' : 'nein';
  return 'ja';
}

/** Anwendbarkeit im Projekt: Eintrag, sonst Vorschlag. Pflichtprozesse bleiben anwendbar (F32 meldet den Widerspruch). */
export function anwendbar(p: Projekt, kp: KatalogProzess): JaNeinOffen {
  return eintragVon(p, kp.id)?.anwendbar ?? anwendbarVorschlag(p, kp);
}

/**
 * Gehört der Prozess zum Prozesssystem der Firma (D-02, D-21, D-27, draw.io, Dashboard)? Anwendbare AIMS-Prozesse, ohne
 * ISMS der Mindestumfang und jeder empfohlene Basisprozess, den die Firma ausdrücklich als anwendbar entschieden hat.
 */
export function imProzesssystem(p: Projekt, kp: KatalogProzess): boolean {
  return sichtImPfad(kp, p.meta.mitIsms) !== 'verweis' && anwendbar(p, kp) === 'ja';
}

/**
 * Prozesse, auf die Firmendokumente verweisen dürfen: das Prozesssystem und mit ISMS die Basisprozesse, die das ISMS
 * führt (nicht als «nicht anwendbar» entschieden). Verweise auf andere Prozesse entfallen (D-27, draw.io).
 */
export function gefuehrteProzesse(p: Projekt, k: Kataloge | undefined): Set<string> {
  return new Set(
    prozesseImProjekt(p, k)
      .filter((kp) => imProzesssystem(p, kp) || (p.meta.mitIsms && sichtImPfad(kp, true) === 'verweis' && anwendbar(p, kp) !== 'nein'))
      .map((kp) => kp.id),
  );
}

/** Ablauf ohne Verweise auf Prozesse, die die Firma nicht führt (gefuehrteProzesse) */
export function ablaufImSystem(a: Ablauf, gefuehrt: ReadonlySet<string>): Ablauf {
  return {
    ...a,
    schritte: a.schritte.map((s) => {
      if (!s.verweis?.length) return s;
      const v = s.verweis.filter((x) => gefuehrt.has(x));
      if (v.length === s.verweis.length) return s;
      const { verweis: _, ...rest } = s;
      return v.length ? { ...rest, verweis: v } : rest;
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// Rollen und Eigner

/**
 * Funktionen der Personen («Rolle im Projekt», Optionsgruppe aimsRolle), deren Schlüssel vom Rollenbereich der Bahn abweicht
 * (C4-02): Informationssicherheit, Datenschutz und interne Auditorin besetzen die gleichnamigen Bahnen. Die übrigen Funktionen
 * (gl, aims, recht, it, hr, fachbereich, einkauf, kommunikation) heissen wie ihre Bahn.
 */
export const BAHN_DER_AIMSROLLE: Readonly<Record<string, string>> = { ism: 'informationssicherheit', dsb: 'datenschutz', auditor: 'internes-audit' };

/** Bahnrolle, die eine Funktion aus aimsRolle besetzt */
export const bahnDerAimsRolle = (funktion: string): string => BAHN_DER_AIMSROLLE[funktion] ?? funktion;

/** Hat die Person über ihre «Rolle im Projekt» (aimsRollen) die Rolle der Bahn? */
export function personHatRolle(person: { aimsRollen: readonly string[] }, rolle: string): boolean {
  return person.aimsRollen.some((f) => f === rolle || bahnDerAimsRolle(f) === rolle);
}

/** Person zu einer Rolle: Rollenbereich (D-04), sonst Funktion aus aimsRolle (AIMS-Verantwortliche zuerst) */
export function personZurRolle(p: Projekt, rolle: string | undefined): PersonId | undefined {
  if (!rolle) return undefined;
  const r = p.rollen.find((x) => x.bereich === rolle && x.verantwortlich);
  if (r) return r.verantwortlich;
  if (rolle === 'aims' && p.organisation.aimsVerantwortlich) return p.organisation.aimsVerantwortlich;
  return p.personen.find((x) => personHatRolle(x, rolle))?.id;
}

/** Eigner: Eintrag im Projekt, sonst Person der vorgeschlagenen Rolle */
export function eignerVon(p: Projekt, kp: KatalogProzess): { person?: PersonId; quelle?: 'eintrag' | 'rolle' } {
  const e = eintragVon(p, kp.id)?.eigner;
  if (e) return { person: e, quelle: 'eintrag' };
  const r = personZurRolle(p, kp.eigner_rolle);
  return r ? { person: r, quelle: 'rolle' } : {};
}

/** Bezeichnung einer Rolle im Ablauf: Rollenname des Katalogs (prozesse.rollen), sonst Rollenbereich (D-04), sonst Funktion aus aimsRolle */
export function rollenText(q: TextQuelle, rolle: string): string {
  for (const s of [`prozesse.rollen.${rolle}`, `gefuehrt.optionen.rollenBereich.${rolle}`, `gefuehrt.optionen.aimsRolle.${rolle}`]) {
    const t = q.roh(s);
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  return rolle;
}

// ---------------------------------------------------------------------------------------------
// Texte und Ablauf

/** Texte eines Prozesses: Katalog aus den Sprachtexten, eigene Prozesse (PE-01) aus dem Projekt */
export function prozessTexte(q: TextQuelle, id: string, p?: Pick<Projekt, 'eigeneProzesse'> | null): ProzessTexte | undefined {
  const eigen = p?.eigeneProzesse?.find((x) => x.id === id);
  if (eigen)
    return {
      titel: eigen.titel,
      zweck: eigen.zweck ?? '',
      ausloeser: [...(eigen.ausloeser ?? [])],
      eingaben: [...(eigen.eingaben ?? [])],
      schritte: {},
      ausgaben: [...(eigen.ausgaben ?? [])],
      kennzahl: eigen.kennzahl?.text ?? '',
      hilfe: '',
    };
  const t = q.roh(`prozesse.prozesse.${id}`);
  return t && typeof t === 'object' ? (t as ProzessTexte) : undefined;
}

export function prozessTitel(q: TextQuelle, id: string, p?: Pick<Projekt, 'eigeneProzesse'> | null): string {
  return prozessTexte(q, id, p)?.titel ?? id;
}

export interface Ablauf {
  bahnen: ProzessBahn[];
  schritte: ProzessSchritt[];
  /** eigener Ablauf aus dem Projekt (bearbeitet oder importiert) statt Katalogablauf */
  eigen: boolean;
}

/** Ablauf des Katalogs mit Texten der Sprache; Bahnen in der Reihenfolge ihres ersten Auftretens */
export function katalogAblauf(q: TextQuelle, kp: KatalogProzess): Ablauf {
  const tx = prozessTexte(q, kp.id);
  const bahnen: ProzessBahn[] = [];
  for (const s of kp.schritte) if (!bahnen.some((b) => b.id === s.bahn)) bahnen.push({ id: s.bahn, rolle: s.bahn });
  const schritte: ProzessSchritt[] = kp.schritte.map((s) => ({
    id: s.id,
    art: s.art,
    text: tx?.schritte[s.id] ?? s.id,
    bahn: s.bahn,
    ...(s.naechste?.length ? { naechste: [...s.naechste] } : {}),
    ...(tx?.zweige?.[s.id] ? { zweige: { ...tx.zweige[s.id] } } : {}),
    ...(s.raci ? { raci: { ...s.raci } } : {}),
    ...(s.verweis?.length ? { verweis: [...s.verweis] } : {}),
    ...(s.entscheid ? { entscheid: s.entscheid } : {}),
  }));
  return { bahnen, schritte, eigen: false };
}

/** Wirksamer Ablauf: eigener Ablauf aus dem Projekt, sonst Katalog */
export function ablaufVon(q: TextQuelle, kp: KatalogProzess, e: ProzessEintrag | undefined): Ablauf {
  if (e?.schritte?.length) {
    const bahnen = [...(e.bahnen ?? [])];
    for (const s of e.schritte) if (!bahnen.some((b) => b.id === s.bahn)) bahnen.push({ id: s.bahn, rolle: s.bahn });
    return { bahnen, schritte: e.schritte, eigen: true };
  }
  return katalogAblauf(q, kp);
}

/** Beschriftung einer Bahn: eigener Text, sonst Rolle; mit Person, wenn bekannt */
export function bahnText(q: TextQuelle, b: ProzessBahn): string {
  return b.text?.trim() || (b.rolle ? rollenText(q, b.rolle) : b.id);
}

// ---------------------------------------------------------------------------------------------
// Dokumente und Texte im Pfad der Firma

/** Gehört ein Dokument zum Projekt? E-xx nur mit Modul EU AI Act, N-xx nur mit Modul NIST AI RMF, D-23 nur mit ISMS */
export function dokumentImPfad(id: string, p: Pick<Projekt, 'meta'>): boolean {
  if (/^E-\d\d/.test(id)) return p.meta.modulAiAct;
  if (/^N-\d\d/.test(id)) return p.meta.modulNistRmf === true;
  if (/^D-23/.test(id)) return p.meta.mitIsms;
  return true;
}

/** Dokumente eines Prozesses im Pfad der Firma (leere Vorlage: alle) */
export function prozessDokumente(kp: KatalogProzess, p: Pick<Projekt, 'meta'>, leer: boolean): string[] {
  return leer ? kp.kit_dokumente : kp.kit_dokumente.filter((d) => dokumentImPfad(d, p));
}

/**
 * Listeneinträge der Prozesstexte (Auslöser, Eingaben, Ausgaben) im Firmendokument: Verweise auf Dokumente ausgeschalteter
 * Module oder ohne ISMS entfallen; ein Eintrag, der nur auf solche Dokumente verweist oder ohne ISMS das ISMS nennt,
 * entfällt ganz.
 */
export function texteImPfad(liste: readonly string[], p: Pick<Projekt, 'meta'>, leer: boolean): string[] {
  if (leer) return [...liste];
  const aus: string[] = [];
  for (const text of liste) {
    // Ohne ISMS entfallen Einträge, die nur mit ISMS gelten (z. B. «bestehender Geltungsbereich des ISMS»)
    if (!p.meta.mitIsms && /\bISMS\b/.test(text)) continue;
    const refs = [...text.matchAll(/\b[DEN]-\d\d\b/g)].map((m) => m[0]);
    const weg = refs.filter((r) => !dokumentImPfad(r, p));
    if (!weg.length) {
      aus.push(text);
      continue;
    }
    if (weg.length === refs.length) continue;
    let t = text;
    for (const r of weg) t = t.replace(new RegExp(`(?:,\\s*)?\\b${r}\\b(?:,\\s*)?`), (m) => (m.startsWith(',') && m.endsWith(' ') ? ', ' : ''));
    aus.push(t.replace(/\(\s*,\s*/g, '(').replace(/,\s*\)/g, ')').replace(/\s*\(\s*\)/g, ''));
  }
  return aus;
}

// ---------------------------------------------------------------------------------------------
// Kennzahlen

/**
 * Sollwert als Text in Fachsprache: «mindestens 95 %», «höchstens 10 Tage», «100 %» (statt «mindestens 100 %»),
 * «0 (kein Fall)» (statt «höchstens 0 Anzahl»), Anzahl ohne Einheit («mindestens 1»).
 */
export function sollText(t: (schluessel: string, werte?: Record<string, string>) => string, kz: NonNullable<KatalogProzess['kennzahl_vorschlag']>): string {
  const zahl = String(kz.soll);
  // Prozent nach der Schreibweise der Sprache (DE «95 %», EN «95%»)
  const prozent = t('prozesse.soll.prozent', { zahl });
  if (kz.einheit === 'prozent' && kz.richtung === 'mindestens' && kz.soll >= 100) return prozent;
  if (kz.einheit === 'anzahl' && kz.richtung === 'hoechstens' && kz.soll === 0) return t('prozesse.soll.keiner');
  const wert = kz.einheit === 'prozent' ? prozent : kz.einheit === 'anzahl' ? zahl : `${zahl} ${t(`prozesse.einheiten.${kz.einheit}`)}`;
  return `${t(`prozesse.richtungen.${kz.richtung}`)} ${wert}`;
}

/**
 * Einheit eines Messwerts oder einer Kennzahl (für den Abgleich mit der Prozesskennzahl, H74): Prozent, Tage, Stunden,
 * Monate aus dem ersten Wert mit Einheit im Text, sonst Anzahl bei einer blossen Zahl oder «Anzahl …» in der
 * Bezeichnung, sonst «Anteil …» als Prozent. Unbekannt: undefined (keine Aussage).
 */
export function einheitVon(wert: string | undefined, titel = ''): KennzahlEinheit | undefined {
  const w = (wert ?? '').trim();
  const m = /(\d+(?:[.,]\d+)?)\s*(%|prozent|per cent|percent|arbeitstag\w*|tag\w*|days?|working days?|stunden?|std\.?|hours?|h\b|monat\w*|months?)/i.exec(w);
  if (m) {
    const e = m[2]!.toLowerCase();
    if (/%|prozent|cent/.test(e)) return 'prozent';
    if (/stund|std|hour|^h$/.test(e)) return 'stunden';
    if (/monat|month/.test(e)) return 'monate';
    return 'tage';
  }
  if (/^\d+(?:\s*(?:meldungen?|fälle?|faelle|reports?|cases?|incidents?|vorfälle?))?\s*(?:\(|$)/i.test(w)) return 'anzahl';
  if (/^(anzahl|number of)\b/i.test(titel.trim())) return 'anzahl';
  if (/^(anteil|quote|share|proportion|percentage)\b/i.test(titel.trim())) return 'prozent';
  return undefined;
}
