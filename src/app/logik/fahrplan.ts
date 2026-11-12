// Fahrplan des Guides (Seite E0-fahrplan): rechnet vom Ziel Stage-1-Bereitschaft rückwärts und legt die
// 10 Schritte des Leitfadens mit Kalenderwochen fest (Wochen und Personentage aus etappen.yaml, Abschnitt fahrplan,
// gleich wie src/leitfaden/schritte.yaml). Prüft, ob die Personentage beim angegebenen Pensum bis zum Ziel reichen.
// Reine Funktionen ohne UI.
import type { Projekt } from '../../model/typen.ts';
import type { EtappeDef, FahrplanDef, PfadSchluessel } from './gefuehrt-typen.ts';

const TAG = 86_400_000;

/** ISO-Datum JJJJ-MM-TT in UTC-Millisekunden (Mitternacht). */
function ms(datum: string): number {
  return Date.parse(`${datum.slice(0, 10)}T00:00:00Z`);
}

function iso(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Montag der Woche, in der das Datum liegt. */
export function montag(datum: string): string {
  const t = ms(datum);
  const wt = (new Date(t).getUTCDay() + 6) % 7; // Montag 0 bis Sonntag 6
  return iso(t - wt * TAG);
}

export function plusTage(datum: string, tage: number): string {
  return iso(ms(datum) + tage * TAG);
}

/** Kalenderwoche nach ISO 8601 (Woche mit dem ersten Donnerstag des Jahres ist KW 1). */
export function kalenderwoche(datum: string): { jahr: number; woche: number } {
  const t = ms(montag(datum)) + 3 * TAG; // Donnerstag derselben Woche
  const d = new Date(t);
  const jahr = d.getUTCFullYear();
  const erster = Date.UTC(jahr, 0, 1);
  return { jahr, woche: Math.floor((t - erster) / (7 * TAG)) + 1 };
}

export type PtStand = 'ok' | 'knapp' | 'reicht-nicht' | 'ohne-pensum' | 'ohne-termin';

export interface PlanWoche {
  /** Woche im Plan (1 bis Länge des Plans) */
  woche: number;
  /** Montag der Woche, wenn ein Zieltermin gesetzt ist */
  montag?: string;
  /** Freitag der Woche */
  freitag?: string;
  kw?: { jahr: number; woche: number };
}

export interface FahrplanSchritt {
  nr: number;
  etappen: string[];
  von: PlanWoche;
  bis: PlanWoche;
  pt: [number, number];
}

export interface FahrplanErgebnis {
  pfad: PfadSchluessel;
  /** Erweiterter Umfang (Kapitel 4): Gründe aus der Projektdatei */
  erweitert: ('eigenbau' | 'produkt' | 'hochrisiko')[];
  /** Plan gestreckt (nur mit ISMS: rund 6 Monate) */
  gestreckt: boolean;
  wochen: number;
  ziel?: string;
  /** Montag der ersten Planwoche */
  start?: string;
  /** Wochen zwischen Ende des Plans und Zieltermin, wenn der Plan ab heute (bzw. ab Auftrag) beginnt */
  puffer: number;
  schritte: FahrplanSchritt[];
  meilensteine: { id: string; zeit: PlanWoche }[];
  freigaben: { id: string; zeit: PlanWoche; vorlagen: string[] }[];
  /** Personentage aller Beteiligten [von, bis], mit Zuschlag für eingeschaltete Module */
  pt: [number, number];
  /** Zuschlag Modul NIST AI RMF [von, bis] (in pt enthalten), wenn eingeschaltet */
  ptNist?: [number, number];
  /** Anteil davon bei der AIMS-Verantwortlichen [von, bis] */
  ptAims: [number, number];
  pensum?: number;
  /** Ab wann gerechnet wird: Freigabe des Projektauftrags, sonst heute */
  ab: string;
  abAuftrag: boolean;
  /** Personentage der AIMS-Verantwortlichen zwischen ab und Ziel beim angegebenen Pensum */
  kapazitaet?: number;
  ptStand: PtStand;
  /** Der Plan hätte vor «ab» beginnen müssen */
  startVorbei: boolean;
}

/** Gründe für den erweiterten Umfang nach Leitfaden Kapitel 4 (mehrere Eigenentwicklungen, KI im Produkt, Hochrisiko). */
export function erweiterterUmfang(p: Projekt): ('eigenbau' | 'produkt' | 'hochrisiko')[] {
  const r: ('eigenbau' | 'produkt' | 'hochrisiko')[] = [];
  const aktiv = p.kiSysteme.filter((s) => s.status !== 'abgeloest' && s.status !== 'untersagt');
  if (aktiv.filter((s) => s.typ === 'eigenbau').length > 1) r.push('eigenbau');
  if (p.organisation.verkauftKiProdukte) r.push('produkt');
  if (aktiv.some((s) => s.aiAct.risikoklasse.startsWith('hochrisiko'))) r.push('hochrisiko');
  return r;
}

const runde = (x: number) => Math.round(x * 10) / 10;

export function berechneFahrplan(p: Projekt, def: FahrplanDef, etappen: EtappeDef[], heute: string): FahrplanErgebnis {
  const pfad: PfadSchluessel = p.meta.mitIsms ? 'mit_isms' : 'ohne_isms';
  const erweitert = erweiterterUmfang(p);
  const gestreckt = pfad === 'mit_isms' && erweitert.length > 0;
  const basis = def.wochen[pfad];
  const wochen = gestreckt ? def.erweitert.wochen : basis;
  const faktor = wochen / basis;
  // Woche im Plan des Leitfadens auf den (gestreckten) Plan abbilden: Beginn bzw. Ende des Zeitraums
  const vonWoche = (w: number) => Math.floor((w - 1) * faktor) + 1;
  const bisWoche = (w: number) => Math.round(w * faktor);
  const ziel = p.organisation.zielterminStage1 || undefined;
  const auftrag = p.organisation.projektauftrag?.freigabe?.am;
  const abAuftrag = !!auftrag && /^\d{4}-\d{2}-\d{2}/.test(auftrag);
  const ab = abAuftrag ? auftrag!.slice(0, 10) : heute;
  // Rückwärts vom Zieltermin; lässt der Termin Luft, beginnt der Plan in der Woche von «ab» und endet vor dem Ziel (Puffer)
  const rueckwaerts = ziel ? plusTage(montag(ziel), -7 * (wochen - 1)) : undefined;
  const start = rueckwaerts && rueckwaerts > montag(ab) ? montag(ab) : rueckwaerts;
  const puffer = rueckwaerts && start && rueckwaerts > start ? Math.round((ms(rueckwaerts) - ms(start)) / (7 * TAG)) : 0;
  const zeit = (woche: number): PlanWoche => {
    if (!start) return { woche };
    const mo = plusTage(start, 7 * (woche - 1));
    // Woche des Zieltermins endet am Zieltermin, nicht am Freitag danach
    const fr = plusTage(mo, 4);
    return { woche, montag: mo, freitag: ziel && mo <= ziel && fr > ziel ? ziel : fr, kw: kalenderwoche(mo) };
  };
  const schritte = def.schritte.map((s) => ({
    nr: s.nr,
    etappen: etappen.filter((e) => e.leitfaden === s.nr && e.id !== 'J').map((e) => e.id),
    von: zeit(vonWoche(s.wochen[pfad][0])),
    bis: zeit(bisWoche(s.wochen[pfad][1])),
    pt: s.pt[pfad],
  }));
  const summe = (i: 0 | 1) => runde(def.schritte.reduce((a, s) => a + s.pt[pfad][i], 0));
  const basisPt: [number, number] = gestreckt ? def.erweitert.pt : [summe(0), summe(1)];
  // Modul NIST AI RMF: Richtwert als Zuschlag (Profil, Zusatz-Controls, Mess- und Prüfkonzept, GenAI-Bewertung)
  const ptNist = p.meta.modulNistRmf && def.module?.nistRmf ? def.module.nistRmf.pt : undefined;
  const pt: [number, number] = ptNist ? [runde(basisPt[0] + ptNist[0]), runde(basisPt[1] + ptNist[1])] : basisPt;
  const ptAims: [number, number] = [runde(pt[0] * def.anteilAims), runde(pt[1] * def.anteilAims)];
  const meilensteine = def.meilensteine.filter((m) => m.wochen[pfad] !== undefined).map((m) => ({ id: m.id, zeit: zeit(bisWoche(m.wochen[pfad]!)) }));
  const freigaben = def.freigaben
    .filter((f) => f.wochen[pfad] !== undefined)
    .map((f) => ({ id: f.id, zeit: zeit(bisWoche(f.wochen[pfad]!)), vorlagen: f.vorlagen[pfad] ?? [] }));
  const pensum = typeof p.organisation.projektauftrag?.pensumProzent === 'number' ? p.organisation.projektauftrag.pensumProzent : undefined;
  let kapazitaet: number | undefined;
  let ptStand: PtStand = 'ohne-termin';
  if (ziel) {
    if (pensum === undefined || pensum <= 0) ptStand = 'ohne-pensum';
    else {
      // Arbeitstage zwischen «ab» und Ziel (fünf von sieben Tagen) mal Pensum
      const tage = Math.max(0, (ms(ziel) - ms(ab)) / TAG);
      kapazitaet = runde(((tage * 5) / 7) * (pensum / 100));
      ptStand = kapazitaet < ptAims[0] ? 'reicht-nicht' : kapazitaet < ptAims[1] ? 'knapp' : 'ok';
    }
  }
  return {
    pfad, erweitert, gestreckt, wochen, ziel, start, puffer, schritte, meilensteine, freigaben, pt, ...(ptNist ? { ptNist } : {}), ptAims, pensum, ab, abAuftrag, kapazitaet, ptStand,
    startVorbei: !!start && start < montag(ab),
  };
}

/** Stand einer Freigabe des Freigabekalenders: Dokumente im Pfad (mit ISMS D-xx-EB) mit Status aus dem Register */
export interface FreigabeStand {
  id: string;
  erledigt: boolean;
  dokumente: { id: string; erledigt: boolean }[];
}

export function freigabeStand(p: Projekt, f: { id: string; vorlagen: string[] }, ebIds: ReadonlySet<string>, heute: string): FreigabeStand {
  const imPfad = (id: string) => (p.meta.mitIsms && ebIds.has(id) ? `${id}-EB` : id);
  const dokFrei = (id: string) => {
    const d = p.dokumente.find((x) => x.id === id) ?? p.dokumente.find((x) => x.id === id.replace(/-EB$/, ''));
    return !!d && (d.status === 'freigegeben' || !!d.freigabe?.am);
  };
  const dokumente = f.vorlagen.map((v) => {
    const id = imPfad(v);
    if (v === 'D-00') return { id, erledigt: !!p.organisation.projektauftrag?.freigabe?.am };
    // Folgenabschätzungen: alle vollständigen freigegeben
    if (v === 'D-09') {
      const voll = p.folgenabschaetzungen.filter((x) => x.triage.ergebnis === 'voll');
      return { id, erledigt: voll.length > 0 && voll.every((x) => !!x.freigabe?.am) };
    }
    if (v === 'D-21') return { id, erledigt: dokFrei(id) || p.managementbewertungen.some((m) => !!m.datum && m.datum <= heute) };
    return { id, erledigt: dokFrei(id) };
  });
  return { id: f.id, erledigt: dokumente.every((d) => d.erledigt), dokumente };
}
