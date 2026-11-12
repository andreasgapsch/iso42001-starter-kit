// Engine des Guides: aktive Etappen, Seiten, Felder, Einträge je Seite, Pflichtprüfung, Fortschritt.
// Reine Funktionen über Projekt + Struktur (gefuehrt.json); keine UI.
import type { Projekt } from '../../model/typen.ts';
import type { Befund } from '../../regeln/pruefungen.ts';
import { erfuellt, filterEinesPasst, filterPasst } from './bedingungen.ts';
import { musterEintrag, neuerControlEintrag, neuerDokumentEintrag } from './eintraege.ts';
import type { EtappeDef, FeldDef, GefuehrtDaten, SeiteDef } from './gefuehrt-typen.ts';
import { istLeer, lies, type Segment } from './pfad.ts';
import { soaVorschlaege, type EuaiaControl, type RmfControlVorschlag } from './vorschlaege.ts';

export interface Umfeld {
  gefuehrt: GefuehrtDaten;
  controlIds42001: string[];
  euaia: EuaiaControl[];
  /** Zusatz-Controls des Moduls NIST AI RMF (src/nist-rmf/rmf-controls.yaml) */
  rmf?: RmfControlVorschlag[];
  /**
   * Befunde der Prüfregeln je Seite des Guides (AF-139): «erledigt» heisst, die Prüfung hat zur Seite nichts mehr zu melden.
   * Fehlt die Funktion (Tests, reine Strukturprüfungen), zählen nur die Pflichtfelder.
   */
  befundeJeSeite?: (p: Projekt) => ReadonlyMap<string, readonly Befund[]>;
  /**
   * Stichtag des Projekts (AF-081): Eine Freigabe mit Datum in der Zukunft steht noch aus und lässt die Pflichtangabe
   * offen, in allen Anzeigen gleich. Fehlt die Funktion (Tests), gilt jedes Datum.
   */
  heute?: (p: Projekt) => string;
}

export interface SeitenEintrag {
  /** ID des Eintrags (KI-001, A.5.2) */
  id: string;
  /** aktueller Inhalt (bei noch nicht angelegten Einträgen ein Standardobjekt) */
  objekt: Record<string, unknown>;
  /** Liste im Projekt, in die geschrieben wird */
  liste: string;
  /** Eintrag existiert noch nicht und wird beim ersten Schreiben angelegt */
  neu: boolean;
  /** zugehöriges KI-System (Folgenabschätzung) */
  kiSystem?: string;
}

export function seitenIndex(g: GefuehrtDaten): Map<string, SeiteDef> {
  return new Map(g.seiten.map((s) => [s.id, s]));
}

export function aktiveEtappen(g: GefuehrtDaten, p: Projekt): EtappeDef[] {
  return g.etappen.etappen.filter((e) => erfuellt(e.wenn, p));
}

export function etappeVonSeite(g: GefuehrtDaten, seitenId: string): EtappeDef | undefined {
  return g.etappen.etappen.find((e) => e.seiten.includes(seitenId));
}

/** Aktive Seiten einer Etappe; Seiten-IDs ohne Struktur werden als «fehlt» geliefert (ruhige Ersatzanzeige). */
export function aktiveSeiten(g: GefuehrtDaten, e: EtappeDef, p: Projekt, index = seitenIndex(g)): (SeiteDef | { id: string; typ: 'fehlt' })[] {
  const r: (SeiteDef | { id: string; typ: 'fehlt' })[] = [];
  for (const id of e.seiten) {
    const s = index.get(id);
    if (!s) r.push({ id, typ: 'fehlt' });
    else if (erfuellt(s.wenn, p)) r.push(s);
  }
  return r;
}

export function aktiveFelder(s: SeiteDef, p: Projekt, eintrag?: unknown): FeldDef[] {
  return (s.felder ?? []).filter((f) => erfuellt(f.wenn, p, eintrag));
}

const aktivSystem = (status: string) => status !== 'abgeloest' && status !== 'untersagt';

/** IDs der Controls, die eine SoA-Seite zeigt. */
export function soaIds(s: SeiteDef, p: Projekt, u: Umfeld): string[] {
  if (s.controls) return s.controls;
  if (s.rahmenwerk === 'ISO42001') return u.controlIds42001;
  if (s.rahmenwerk === 'EUAIA') {
    const ids = new Set(soaVorschlaege(p, u.euaia).filter((v) => v.grund === 'aiact').map((v) => v.id));
    for (const c of p.controls) if (c.rahmenwerk === 'EUAIA') ids.add(c.id);
    return [...ids].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  }
  if (s.rahmenwerk === 'NISTRMF') {
    const ids = new Set(soaVorschlaege(p, u.euaia, u.rmf ?? []).filter((v) => v.grund === 'nistrmf').map((v) => v.id));
    for (const c of p.controls) if (c.rahmenwerk === 'NISTRMF') ids.add(c.id);
    return [...ids].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  }
  if (s.rahmenwerk === 'EIGENE') return p.eigeneControls.map((c) => c.id);
  const ids = new Set([...u.controlIds42001, ...p.controls.map((c) => c.id)]);
  return [...ids];
}

/** Einträge, die eine Eintragsseite bearbeitet. */
export function seitenEintraege(s: SeiteDef, p: Projekt, u: Umfeld): SeitenEintrag[] {
  const alsObjekt = (x: unknown) => x as Record<string, unknown>;
  switch (s.typ) {
    case 'liste': {
      const liste = s.liste ?? '';
      const daten = (p as unknown as Record<string, unknown>)[liste];
      if (!Array.isArray(daten)) return [];
      if (s.eintrag) {
        const e = daten.find((x) => alsObjekt(x)['id'] === s.eintrag);
        const objekt = e ? alsObjekt(e) : liste === 'dokumente' ? (neuerDokumentEintrag(s.eintrag) as unknown as Record<string, unknown>) : { ...(musterEintrag(liste) ?? {}), id: s.eintrag };
        return [{ id: s.eintrag, objekt, liste, neu: !e }];
      }
      return daten.filter((x) => filterPasst(x, s.filter)).map((x) => ({ id: String(alsObjekt(x)['id']), objekt: alsObjekt(x), liste, neu: false }));
    }
    case 'auswahl-systeme':
      return p.kiSysteme
        .filter((k) => filterPasst(k, s.filter) && filterEinesPasst(k, s.filterEines))
        .map((k) => ({ id: k.id, objekt: alsObjekt(k), liste: 'kiSysteme', neu: false }));
    case 'folgenabschaetzung': {
      const r: SeitenEintrag[] = [];
      for (const k of p.kiSysteme) {
        if (!aktivSystem(k.status)) continue;
        if (s.filterSystem && !Object.entries(s.filterSystem).every(([pf, w]) => istLeer(lies(k, pf)) || filterPasst(k, { [pf]: w }))) continue;
        const fa = p.folgenabschaetzungen.find((f) => f.kiSystem === k.id);
        const objekt = fa ? alsObjekt(fa) : { ...(musterEintrag('folgenabschaetzungen') ?? {}), id: '', kiSystem: k.id };
        if (!filterPasst(objekt, s.filter)) continue;
        r.push({ id: fa?.id ?? `neu:${k.id}`, objekt, liste: 'folgenabschaetzungen', neu: !fa, kiSystem: k.id });
      }
      return r;
    }
    case 'soa':
      return soaIds(s, p, u)
        .map((id) => {
          const c = p.controls.find((x) => x.id === id);
          return { id, objekt: alsObjekt(c ?? neuerControlEintrag(id)), liste: 'controls', neu: !c };
        })
        .filter((e) => filterPasst(e.objekt, s.filter));
    default:
      return [];
  }
}

export function checklistenSchluessel(f: FeldDef, eintragId: string): string {
  return (f.schluessel ?? '').replace('{id}', eintragId);
}

/** Wert eines Felds: absolut (formular) oder relativ zum Eintrag; Checklisten aus meta.checklisten. */
export function feldWert(f: FeldDef, p: Projekt, e?: SeitenEintrag): unknown {
  if (f.typ === 'checkliste') return p.meta.checklisten[checklistenSchluessel(f, e?.kiSystem ?? e?.id ?? '')];
  if (!f.pfad) return undefined;
  return e ? lies(e.objekt, f.pfad) : lies(p, f.pfad);
}

export function feldGefuellt(f: FeldDef, wert: unknown, heute?: string): boolean {
  if (f.ungueltig?.includes(String(wert))) return false;
  if (f.typ === 'checkliste') return (wert as { erledigt?: boolean } | undefined)?.erledigt === true;
  if (f.typ === 'janein') return typeof wert === 'boolean';
  if (f.typ === 'freigabe') {
    const fr = wert as { von?: string; am?: string } | undefined;
    // Termin in der Zukunft: noch nicht erledigt (AF-081)
    return !!fr && !istLeer(fr.von) && !istLeer(fr.am) && !(heute && String(fr.am).slice(0, 10) > heute);
  }
  return !istLeer(wert);
}

/** Freigabe mit Person und Datum, das nach dem Stichtag liegt: ausgefüllt, aber noch nicht erledigt */
function zukunftMarke(f: FeldDef, wert: unknown, heute?: string): { zukunft?: true } {
  return f.typ === 'freigabe' && !!heute && feldGefuellt(f, wert) ? { zukunft: true } : {};
}

export interface Luecke {
  feld: string;
  /** Freigabe ist ausgefüllt, ihr Datum liegt aber nach dem Stichtag (AF-081): eigener Hinweis statt «ausfüllen» */
  zukunft?: true;
  eintrag?: string;
  /** Pflicht aus einer Bedingung (M3): Schlüssel des Grundes für die Fehlerzusammenfassung, z. B. «vermindern_ohne_control» */
  grund?: string;
}

/**
 * Pflicht unter einer Bedingung je Seite (M3, Guide E8): «Vermindern» braucht mindestens ein verknüpftes Control (wie Prüfregel
 * F21), damit «Weiter» die Lücke zeigt, statt sie erst in der Prüfung zu melden.
 */
const BEDINGTE_PFLICHT: Record<string, { feld: string; grund: string; wenn: (o: Record<string, unknown>) => boolean }[]> = {
  'E8-behandlung': [{ feld: 'controls', grund: 'vermindern_ohne_control', wenn: (o) => o['behandlung'] === 'vermindern' && !(Array.isArray(o['controls']) && o['controls'].length) }],
};

/** Fehlende Pflichtangaben einer Seite. Listen mit Anlegen und ohne Einträge gelten als unvollständig. */
export function pflichtLuecken(s: SeiteDef, p: Projekt, u: Umfeld): Luecke[] {
  const l: Luecke[] = [];
  const heute = u.heute?.(p);
  if (s.typ === 'formular') {
    for (const f of aktiveFelder(s, p)) if (f.pflicht && !feldGefuellt(f, feldWert(f, p), heute)) l.push({ feld: f.pfad ?? f.schluessel ?? '', ...zukunftMarke(f, feldWert(f, p), heute) });
    return l;
  }
  if (['liste', 'auswahl-systeme', 'folgenabschaetzung', 'soa'].includes(s.typ)) {
    const eintraege = seitenEintraege(s, p, u);
    const hatPflicht = (s.felder ?? []).some((f) => f.pflicht);
    const nichtNoetig = (p.meta.gefuehrt.nichtNoetig ?? []).includes(s.id) && nichtNoetigMoeglich(s);
    if (s.typ === 'liste' && eintraege.length === 0 && hatPflicht && s.anlegen !== false && !nichtNoetig) l.push({ feld: '*' });
    for (const e of eintraege) {
      for (const f of aktiveFelder(s, p, e.objekt)) {
        if (f.pflicht && !feldGefuellt(f, feldWert(f, p, e), heute)) l.push({ feld: f.pfad ?? f.schluessel ?? '', eintrag: e.id, ...zukunftMarke(f, feldWert(f, p, e), heute) });
      }
      for (const b of BEDINGTE_PFLICHT[s.id] ?? []) if (b.wenn(e.objekt)) l.push({ feld: b.feld, eintrag: e.id, grund: b.grund });
    }
  }
  return l;
}

/** Listenseiten, die man ohne Eintrag als «kein Eintrag nötig» abschliessen kann (nicht das KI-Inventar, nicht Pflichtinhalte der Norm). */
export function nichtNoetigMoeglich(s: SeiteDef): boolean {
  return s.typ === 'liste' && s.anlegen !== false && !s.eintrag && s.liste !== 'kiSysteme' && !s.mindestensEiner;
}

export type SeitenStatus = 'offen' | 'erledigt' | 'spaeter' | 'unvollstaendig';

export function besuchteSeiten(p: Projekt, etappe: string): string[] {
  return p.meta.gefuehrt.etappen[etappe]?.besucht ?? [];
}

export function seitenStatus(s: SeiteDef, etappe: string, p: Projekt, u: Umfeld): SeitenStatus {
  const st = p.meta.gefuehrt.etappen[etappe];
  if (st?.spaeter.includes(s.id)) return 'spaeter';
  const besucht = st?.besucht?.includes(s.id) ?? false;
  // Reine Leseseite blockiert nichts: Ist die Etappe begonnen, gilt sie als gelesen (C2-22)
  if (s.typ === 'info' && !besucht && (st?.besucht?.length ?? 0) > 0) return 'erledigt';
  const luecken = pflichtLuecken(s, p, u).length;
  if (besucht) return luecken || befundeDerSeite(s, p, u).length ? 'unvollstaendig' : 'erledigt';
  return 'offen';
}

/** Befunde der Prüfregeln, die auf dieser Seite zu beheben sind (AF-139); leer ohne Prüfkontext. */
export function befundeDerSeite(s: SeiteDef, p: Projekt, u: Umfeld): readonly Befund[] {
  return u.befundeJeSeite?.(p).get(s.id) ?? [];
}

export interface EtappenFortschritt {
  id: string;
  erledigt: number;
  gesamt: number;
  spaeter: number;
  status: 'offen' | 'in-arbeit' | 'erledigt';
}

/** Optionale Seiten ohne Projektinhalt für die Norm (Dokumentgestaltung): zählen nicht zum Fortschritt */
export const OHNE_FORTSCHRITT = new Set<string>(['gestaltung']);

export function etappenFortschritt(e: EtappeDef, p: Projekt, u: Umfeld, index = seitenIndex(u.gefuehrt)): EtappenFortschritt {
  const seiten = aktiveSeiten(u.gefuehrt, e, p, index).filter((s): s is SeiteDef => s.typ !== 'fehlt' && !OHNE_FORTSCHRITT.has(s.typ));
  let erledigt = 0;
  let spaeter = 0;
  let begonnen = false;
  for (const s of seiten) {
    const st = seitenStatus(s, e.id, p, u);
    if (st === 'erledigt') erledigt++;
    if (st === 'spaeter') spaeter++;
    if (st !== 'offen') begonnen = true;
  }
  const gesamt = seiten.length;
  const status = gesamt > 0 && erledigt === gesamt ? 'erledigt' : begonnen ? 'in-arbeit' : 'offen';
  return { id: e.id, erledigt, gesamt, spaeter, status };
}

export function gesamtFortschritt(p: Projekt, u: Umfeld): { erledigt: number; gesamt: number; etappen: EtappenFortschritt[] } {
  const index = seitenIndex(u.gefuehrt);
  const etappen = aktiveEtappen(u.gefuehrt, p).map((e) => etappenFortschritt(e, p, u, index));
  return { erledigt: etappen.reduce((a, e) => a + e.erledigt, 0), gesamt: etappen.reduce((a, e) => a + e.gesamt, 0), etappen };
}

/**
 * Seite zum Weitermachen: die zuletzt gemerkte Stelle (aktuelleEtappe, aktuelleSeite), wenn sie noch aktiv ist;
 * sonst ab der aktuellen Etappe die erste nicht erledigte Seite.
 */
export function weitermachenZiel(p: Projekt, u: Umfeld): { etappe: string; seite: string } | null {
  const etappen = aktiveEtappen(u.gefuehrt, p);
  if (etappen.length === 0) return null;
  const index = seitenIndex(u.gefuehrt);
  const { aktuelleEtappe, aktuelleSeite } = p.meta.gefuehrt;
  const gemerkt = etappen.find((e) => e.id === aktuelleEtappe);
  if (gemerkt && aktuelleSeite) {
    if (aktuelleSeite === 'abschluss' || aktiveSeiten(u.gefuehrt, gemerkt, p, index).some((s) => s.id === aktuelleSeite)) return { etappe: gemerkt.id, seite: aktuelleSeite };
  }
  const start = Math.max(0, etappen.findIndex((e) => e.id === aktuelleEtappe));
  for (let i = start; i < etappen.length; i++) {
    const e = etappen[i]!;
    for (const s of aktiveSeiten(u.gefuehrt, e, p, index)) {
      if (s.typ === 'fehlt' || OHNE_FORTSCHRITT.has(s.typ)) continue;
      if (seitenStatus(s, e.id, p, u) !== 'erledigt') return { etappe: e.id, seite: s.id };
    }
  }
  const e = etappen[start]!;
  return { etappe: e.id, seite: e.seiten[0] ?? '' };
}

/** Aktive Checklisteneinträge einer Etappe als IDs. */
export function checklisteIds(e: EtappeDef, p: Projekt): string[] {
  return (e.checkliste ?? []).filter((c) => typeof c === 'string' || erfuellt(c.wenn, p)).map((c) => (typeof c === 'string' ? c : c.id));
}

/** Pfad zum Schreiben in einen Eintrag: liefert Segmente ab Projektwurzel oder null, wenn er neu angelegt werden muss. */
export function eintragsPfad(p: Projekt, liste: string, id: string): Segment[] | null {
  const daten = (p as unknown as Record<string, unknown>)[liste];
  if (!Array.isArray(daten)) return null;
  const i = daten.findIndex((x) => (x as { id?: string }).id === id);
  return i < 0 ? null : [liste, i];
}
