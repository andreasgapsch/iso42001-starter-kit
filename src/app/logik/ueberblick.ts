// Überblick des Guides (Seite vor E0): Stand je Etappe (vollständig, teilweise, offen), Gesamtfortschritt,
// Stelle zum Weitermachen, nächste offene und zurückgestellte Seiten, Zeitbezug zum Fahrplan (Kalenderwoche heute gegen
// den Plan, im Verzug ja oder nein), Prüfampel und Module. Reine Funktionen über Projekt und Struktur; keine UI.
import type { Projekt } from '../../model/typen.ts';
import { berechneFahrplan, kalenderwoche, type FahrplanErgebnis, type FahrplanSchritt } from './fahrplan.ts';
import { ampel, type Ampel } from './fortschritt.ts';
import type { EtappeDef, SeiteDef } from './gefuehrt-typen.ts';
import { aktiveEtappen, aktiveSeiten, etappenFortschritt, OHNE_FORTSCHRITT, pflichtLuecken, seitenIndex, seitenStatus, weitermachenZiel, type SeitenStatus, type Umfeld } from './gefuehrt.ts';

/** Zustand einer Etappe: vollständig (alle aktiven Seiten erledigt, keine offenen Pflichtangaben), begonnen, nicht begonnen. */
export type EtappenZustand = 'erledigt' | 'teilweise' | 'offen';

export interface SeitenStand {
  id: string;
  status: SeitenStatus;
}

export interface EtappenStand {
  id: string;
  zustand: EtappenZustand;
  /** Zustand in der Schreibweise der Etappenleiste (Design System): teilweise heisst dort «in-arbeit» */
  leiste: 'erledigt' | 'in-arbeit' | 'offen';
  erledigt: number;
  gesamt: number;
  spaeter: number;
  unvollstaendig: number;
  /** fehlende Pflichtangaben über alle aktiven Seiten der Etappe */
  luecken: number;
  /** erledigte Seiten in Prozent, ganzzahlig */
  prozent: number;
  seiten: SeitenStand[];
}

const LEISTE: Record<EtappenZustand, EtappenStand['leiste']> = { erledigt: 'erledigt', teilweise: 'in-arbeit', offen: 'offen' };

/**
 * Aktive Seiten einer Etappe ohne Platzhalter für fehlende Struktur und ohne Seiten, die nicht zum Fortschritt zählen
 * (AF-081: dieselbe Menge wie in etappenFortschritt, damit Stand, Bereitschaft und Bericht dieselbe Zahl zeigen).
 */
function seitenVon(e: EtappeDef, p: Projekt, u: Umfeld, index: Map<string, SeiteDef>): SeiteDef[] {
  return aktiveSeiten(u.gefuehrt, e, p, index).filter((s): s is SeiteDef => s.typ !== 'fehlt' && !OHNE_FORTSCHRITT.has(s.typ));
}

/**
 * Stand einer Etappe. Vollständig heisst: mindestens eine aktive Seite, alle aktiven Seiten erledigt (mit «Weiter»
 * verlassen, ohne Pflichtlücke) und keine offene Pflichtangabe. Begonnen (teilweise): mindestens eine Seite nicht offen.
 */
export function etappenStand(e: EtappeDef, p: Projekt, u: Umfeld, index = seitenIndex(u.gefuehrt)): EtappenStand {
  // Jede Änderung liefert ein neues Projektobjekt: Merken je Objekt ist sicher und spart bei grossen Projekten Sekunden (D-34)
  let je = standCache.get(p);
  if (!je) standCache.set(p, (je = new Map()));
  const gemerkt = je.get(e);
  if (gemerkt) return gemerkt;
  const neu = standRechnen(e, p, u, index);
  je.set(e, neu);
  return neu;
}

const standCache = new WeakMap<Projekt, Map<EtappeDef, EtappenStand>>();

function standRechnen(e: EtappeDef, p: Projekt, u: Umfeld, index: Map<string, SeiteDef>): EtappenStand {
  const f = etappenFortschritt(e, p, u, index);
  const seiten = seitenVon(e, p, u, index).map((s) => ({ id: s.id, status: seitenStatus(s, e.id, p, u), luecken: pflichtLuecken(s, p, u).length }));
  const luecken = seiten.reduce((a, s) => a + s.luecken, 0);
  const vollstaendig = f.gesamt > 0 && f.erledigt === f.gesamt && luecken === 0;
  const zustand: EtappenZustand = vollstaendig ? 'erledigt' : seiten.some((s) => s.status !== 'offen') ? 'teilweise' : 'offen';
  return {
    id: e.id,
    zustand,
    leiste: LEISTE[zustand],
    erledigt: f.erledigt,
    gesamt: f.gesamt,
    spaeter: f.spaeter,
    unvollstaendig: seiten.filter((s) => s.status === 'unvollstaendig').length,
    luecken,
    prozent: f.gesamt ? Math.round((100 * f.erledigt) / f.gesamt) : 0,
    seiten: seiten.map(({ id, status }) => ({ id, status })),
  };
}

export interface SeitenVerweis {
  etappe: string;
  seite: string;
  status: SeitenStatus;
}

export interface ZeitBezug {
  heute: string;
  kw: { jahr: number; woche: number };
  /** Zieltermin Stage 1 gesetzt: Plan in Kalenderwochen */
  mitTermin: boolean;
  wochen: number;
  /** Woche im Plan heute (1 bis wochen; kleiner 1 vor dem Planstart, grösser wochen nach dem Zieltermin) */
  planWoche?: number;
  /** Schritt des Fahrplans, in dessen Zeitraum heute liegt */
  sollSchritt?: FahrplanSchritt;
  /** Etappen, die nach Plan bis heute abgeschlossen sein sollten, aber nicht vollständig sind */
  faelligOffen: string[];
  /** im Verzug: mindestens eine Etappe nach Plan fällig und nicht vollständig; ohne Zieltermin undefined */
  verzug?: boolean;
  fahrplan?: FahrplanErgebnis;
}

export interface UeberblickDaten {
  etappen: EtappenStand[];
  gesamt: { erledigt: number; gesamt: number; prozent: number; vollstaendig: number; teilweise: number; offen: number };
  /** Stelle zum Weitermachen mit Position der Seite in ihrer Etappe */
  aktuell?: { etappe: string; seite: string; nummer: number; anzahl: number };
  naechste: SeitenVerweis[];
  spaeter: SeitenVerweis[];
  zeit: ZeitBezug;
  pruefung: { ampel: Ampel; fehler: number; hinweise: number };
  module: { aiAct: boolean; nistRmf: boolean };
}

const TAG = 86_400_000;
const ms = (d: string) => Date.parse(`${d.slice(0, 10)}T00:00:00Z`);

/** Zeitbezug zum Fahrplan (Seite E0-fahrplan, gleiche Rechnung wie berechneFahrplan). */
export function zeitBezug(p: Projekt, u: Umfeld, staende: readonly EtappenStand[], heute: string): ZeitBezug {
  const def = u.gefuehrt.etappen.fahrplan;
  const kw = kalenderwoche(heute);
  if (!def) return { heute, kw, mitTermin: false, wochen: 0, faelligOffen: [] };
  const etappen = aktiveEtappen(u.gefuehrt, p).filter((e) => e.id !== 'J');
  const f = berechneFahrplan(p, def, etappen, heute);
  if (!f.start || !f.ziel) return { heute, kw, mitTermin: false, wochen: f.wochen, faelligOffen: [], fahrplan: f };
  const planWoche = Math.floor((ms(heute) - ms(f.start)) / (7 * TAG)) + 1;
  const vollstaendig = new Set(staende.filter((s) => s.zustand === 'erledigt').map((s) => s.id));
  const faelligOffen = f.schritte.filter((s) => s.bis.woche < planWoche).flatMap((s) => s.etappen).filter((e) => !vollstaendig.has(e));
  const sollSchritt = f.schritte.find((s) => planWoche >= s.von.woche && planWoche <= s.bis.woche);
  return { heute, kw, mitTermin: true, wochen: f.wochen, planWoche, ...(sollSchritt ? { sollSchritt } : {}), faelligOffen, verzug: faelligOffen.length > 0, fahrplan: f };
}

/** Alle Daten der Seite «Überblick». befunde: Ergebnis der Prüfregeln (store.befunde). */
export function ueberblickDaten(p: Projekt, u: Umfeld, o: { heute: string; befunde: readonly { schwere: 'fehler' | 'hinweis' }[]; naechsteAnzahl?: number }): UeberblickDaten {
  const index = seitenIndex(u.gefuehrt);
  const etappen = aktiveEtappen(u.gefuehrt, p);
  const staende = etappen.map((e) => etappenStand(e, p, u, index));
  const erledigt = staende.reduce((a, s) => a + s.erledigt, 0);
  const gesamt = staende.reduce((a, s) => a + s.gesamt, 0);
  const zahl = (z: EtappenZustand) => staende.filter((s) => s.zustand === z).length;
  const ziel = weitermachenZiel(p, u);
  let aktuell: UeberblickDaten['aktuell'];
  if (ziel) {
    const st = staende.find((s) => s.id === ziel.etappe);
    const i = st ? st.seiten.findIndex((s) => s.id === ziel.seite) : -1;
    aktuell = { etappe: ziel.etappe, seite: ziel.seite, nummer: i >= 0 ? i + 1 : st?.gesamt ?? 0, anzahl: st?.gesamt ?? 0 };
  }
  // Nächste offene Seiten: ab der Stelle zum Weitermachen, danach die früheren Etappen; ohne zurückgestellte
  const start = Math.max(0, staende.findIndex((s) => s.id === ziel?.etappe));
  const reihenfolge = [...staende.slice(start), ...staende.slice(0, start)];
  const naechste: SeitenVerweis[] = [];
  const max = o.naechsteAnzahl ?? 5;
  for (const st of reihenfolge) {
    let seiten = st.seiten;
    if (st.id === ziel?.etappe) {
      const ab = seiten.findIndex((s) => s.id === ziel.seite);
      if (ab > 0) seiten = [...seiten.slice(ab), ...seiten.slice(0, ab)];
    }
    for (const s of seiten) {
      if (naechste.length >= max) break;
      if (s.status === 'offen' || s.status === 'unvollstaendig') naechste.push({ etappe: st.id, seite: s.id, status: s.status });
    }
  }
  const spaeter = staende.flatMap((st) => st.seiten.filter((s) => s.status === 'spaeter').map((s) => ({ etappe: st.id, seite: s.id, status: s.status })));
  const fehler = o.befunde.filter((b) => b.schwere === 'fehler').length;
  return {
    etappen: staende,
    gesamt: { erledigt, gesamt, prozent: gesamt ? Math.round((100 * erledigt) / gesamt) : 0, vollstaendig: zahl('erledigt'), teilweise: zahl('teilweise'), offen: zahl('offen') },
    ...(aktuell ? { aktuell } : {}),
    naechste,
    spaeter,
    zeit: zeitBezug(p, u, staende, o.heute),
    pruefung: { ampel: ampel(o.befunde), fehler, hinweise: o.befunde.length - fehler },
    module: { aiAct: p.meta.modulAiAct, nistRmf: !!p.meta.modulNistRmf },
  };
}
