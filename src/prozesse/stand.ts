// Status der Prozesse (Plan Prozesse, Abschnitt 5): Reife, Eigner, letzte Durchführung (aus den Projektdaten abgeleitet
// oder von Hand), Fälligkeit, Kennzahl, offene Massnahmen und Nachweise je Prozess. Gleiche Quelle für Dashboard, Lagebild,
// D-02, D-21, D-27 und die Prüfregeln F31, F32, H55 bis H62. Reine Funktionen.
import type { Kataloge } from '../kataloge/typen.ts';
import type { JaNeinOffen, PersonId, Projekt, ProzessEintrag, ProzessReife } from '../model/typen.ts';
import { abgeleitetesDatum, anwendbar, eignerVon, eintragVon, pfadWerte, prozesseImProjekt, sichtImPfad, type ProzessSicht } from './katalog.ts';
import type { KatalogProzess, ProzessGruppe } from './typen.ts';

/** Monate je Rhythmus (Optionsgruppe rhythmus); 14 Tage als halber Monat */
export const RHYTHMUS_MONATE: Record<string, number> = { vierzehntaeglich: 0.5, monatlich: 1, quartalsweise: 3, halbjaehrlich: 6, jaehrlich: 12 };

export function plusMonate(iso: string, monate: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (monate < 1) d.setUTCDate(d.getUTCDate() + Math.round(monate * 28));
  else {
    const tag = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + monate);
    const letzter = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(tag, letzter));
  }
  return d.toISOString().slice(0, 10);
}

const vor12Monaten = (stichtag: string) => plusMonate(stichtag, -12);
const refs = (ref: string | undefined) => (ref ?? '').split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean);

/**
 * Wirksamkeit der Controls aus der Erklärung zur Anwendbarkeit (D-11) für KZ-01: Controls aus Anhang A, davon anwendbar,
 * wirksam, umgesetzt und teilweise umgesetzt. Ein Messwert KZ-01 ohne Wert übernimmt diesen Stand (D-05, D-27).
 */
export interface Kz01Stand {
  controls: number;
  anwendbar: number;
  wirksam: number;
  umgesetzt: number;
  teilweise: number;
}

export function kz01Stand(p: Pick<Projekt, 'controls'>): Kz01Stand {
  const a = p.controls.filter((c) => c.rahmenwerk === 'ISO42001');
  const anw = a.filter((c) => c.anwendbar === 'ja');
  return {
    controls: a.length,
    anwendbar: anw.length,
    wirksam: anw.filter((c) => c.status === 'wirksam').length,
    umgesetzt: anw.filter((c) => c.status === 'umgesetzt').length,
    teilweise: anw.filter((c) => c.status === 'teilweise').length,
  };
}

/** Text des Messwerts KZ-01 (Schlüssel allgemein.kz01_wert): «35 von 38 anwendbaren Controls umgesetzt, davon 31 wirksam; 3 teilweise» */
export function kz01Text(t: (s: string, w?: Record<string, string>) => string, k: Kz01Stand): string {
  return t('allgemein.kz01_wert', { umgesetzt: String(k.wirksam + k.umgesetzt), anwendbar: String(k.anwendbar), wirksam: String(k.wirksam), teilweise: String(k.teilweise) });
}

export interface KennzahlStand {
  id: string;
  /** Bezeichnung (Ziel oder weitere Kennzahl); leer bei den Zeilen der Vorlage D-05 ohne eigene Angabe */
  titel: string;
  wert?: string;
  datum?: string;
  /** Messwert in den letzten zwölf Monaten vor dem Stichtag */
  aktuell: boolean;
  sollErreicht?: 'ja' | 'teilweise' | 'nein';
  /** Keine Messung möglich (kein Anlass, erste Messung offen): zählt nicht als aktueller Messwert */
  keineMessung?: 'kein-anlass' | 'erste-offen';
  /** Bemerkung zum Messwert */
  bemerkung?: string;
  /** KZ-01 ohne erfassten Wert: Stand aus D-11 (kz01Stand), Text mit kz01Text */
  kz01?: Kz01Stand;
}

export interface ProzessStand {
  id: string;
  gruppe: ProzessGruppe;
  katalog: KatalogProzess;
  eintrag?: ProzessEintrag;
  sicht: ProzessSicht;
  anwendbar: JaNeinOffen;
  eigner?: PersonId;
  eignerQuelle?: 'eintrag' | 'rolle';
  reife: ProzessReife;
  /** Stufe aus Nachweisen, Messwerten und Audits */
  reifeVorschlag: ProzessReife;
  rhythmus?: string;
  /** aus den Projektdaten (Katalog: ableitung) */
  abgeleitet?: string;
  letzteDurchfuehrung?: string;
  letzteQuelle?: 'abgeleitet' | 'hand';
  naechsteFaelligkeit?: string;
  ueberfaellig: boolean;
  kennzahl?: KennzahlStand;
  massnahmenOffen: string[];
  massnahmenUeberfaellig: string[];
  /** Offene Feststellungen (D-22) des Prozesses (prozesseDerFeststellung) */
  feststellungenOffen: string[];
  nachweise: string[];
  /** Kit-Dokumente des Prozesses mit Status im Register */
  dokumente: { id: string; status?: string }[];
}

function kennzahlStand(p: Projekt, id: string | undefined, stichtag: string): KennzahlStand | undefined {
  if (!id) return undefined;
  const grenze = vor12Monaten(stichtag);
  const ziel = p.ziele.find((z) => z.id === id);
  if (ziel) {
    const m = [...ziel.messungen].filter((x) => x.datum <= stichtag).sort((a, b) => a.datum.localeCompare(b.datum)).at(-1);
    return { id, titel: ziel.kennzahl || ziel.ziel, wert: m?.wert, datum: m?.datum, aktuell: !!m && m.datum >= grenze, sollErreicht: m?.sollErreicht };
  }
  const kz = (p.kennzahlen ?? []).find((k) => k.id === id);
  const m = (p.kennzahlMessungen ?? []).filter((x) => x.kennzahl === id && x.datum <= stichtag).sort((a, b) => a.datum.localeCompare(b.datum)).at(-1);
  if (!kz && !m) return { id, titel: '', aktuell: false };
  const berechnet = id === 'KZ-01' && m && !m.wert.trim() ? kz01Stand(p) : undefined;
  return { id, titel: kz?.kennzahl ?? '', wert: m?.wert.trim() ? m.wert : undefined, datum: m?.datum, aktuell: !!m && !m.keineMessung && m.datum >= grenze, ...(m?.sollErreicht ? { sollErreicht: m.sollErreicht } : {}), ...(m?.keineMessung ? { keineMessung: m.keineMessung } : {}), ...(m?.bemerkung ? { bemerkung: m.bemerkung } : {}), ...(berechnet ? { kz01: berechnet } : {}) };
}

/**
 * Prozesse einer Feststellung: ausdrückliche Angabe (prozesse), sonst der Bereich, wenn er eine Prozess-ID ist, sonst die
 * Prozesse, deren Normbezug ein Control (A.x.y) der Feststellung enthält. Abschnitte (z. B. 8.1) ordnen nicht zu, weil sie
 * viele Prozesse betreffen.
 */
export function prozesseDerFeststellung(f: Projekt['feststellungen'][number], katalog: readonly KatalogProzess[]): string[] {
  if (f.prozesse?.length) return [...f.prozesse];
  if (f.bereich && /^P[RSE]-\d{2,3}$/.test(f.bereich.trim())) return [f.bereich.trim()];
  const controls = f.normbezug.split(/[,;]\s*/).map((n) => n.trim()).filter((n) => /^A\.\d+\.\d+/.test(n));
  return katalog.filter((kp) => kp.normbezug_42001.some((n) => controls.includes(n))).map((kp) => kp.id);
}

/**
 * Massnahmen eines Prozesses: Herkunft mit Bezug auf die ID (z. B. «prozess» mit ref PR-12, auch «aenderung» mit ref
 * D-27, PR-12) oder aus Feststellungen des Prozesses (prozesseDerFeststellung)
 */
export function prozessMassnahmen(p: Projekt, id: string, katalog: readonly KatalogProzess[] = []): Projekt['massnahmen'] {
  const ausFeststellungen = new Set(p.feststellungen.filter((f) => prozesseDerFeststellung(f, katalog).includes(id)).flatMap((f) => f.massnahmen));
  return p.massnahmen.filter((m) => refs(m.herkunft.ref).includes(id) || ausFeststellungen.has(m.id));
}

/** Interne Audits und Managementbewertungen der letzten zwölf Monate, die den Prozess erfassen */
export function pruefungenDesProzesses(p: Projekt, id: string, stichtag: string): { audit?: string; mb?: string } {
  const grenze = vor12Monaten(stichtag);
  const audit = p.audits
    .filter((a) => a.art === 'intern' && a.durchgefuehrt && a.durchgefuehrt >= grenze && a.durchgefuehrt <= stichtag && (!a.umfangProzesse?.length || a.umfangProzesse.includes(id)))
    .map((a) => a.durchgefuehrt!)
    .sort()
    .at(-1);
  const mb = p.managementbewertungen
    .filter((m) => m.datum && m.datum >= grenze && m.datum <= stichtag && (!m.prozesse?.length || m.prozesse.some((x) => x.id === id)))
    .map((m) => m.datum!)
    .sort()
    .at(-1);
  return { audit, mb };
}

/**
 * Prozesse im Umfang der internen Audits des Auditzyklus (drei Jahre, D-20): Audits der letzten 36 Monate vor dem
 * Stichtag und alle später geplanten. undefined, wenn kein solches Audit den Umfang einschränkt: kein Audit im Zyklus
 * oder ein Audit ohne Auswahl (umfasst alle Prozesse, wie bei pruefungenDesProzesses).
 */
export function prozesseImAuditzyklus(p: Projekt, stichtag: string): Set<string> | undefined {
  const grenze = plusMonate(stichtag, -36);
  const audits = p.audits.filter((a) => {
    const d = (a.durchgefuehrt ?? a.geplant ?? '').slice(0, 10);
    return a.art === 'intern' && !!d && d >= grenze;
  });
  if (!audits.length || audits.some((a) => !a.umfangProzesse?.length)) return undefined;
  return new Set(audits.flatMap((a) => a.umfangProzesse ?? []));
}

/** Offene Nichtkonformität mit Bezug auf den Prozess (Bereich oder Normabschnitt des Prozesses) */
function offeneNk(p: Projekt, kp: KatalogProzess): boolean {
  const nummern = new Set(kp.normbezug_42001);
  return p.feststellungen.some(
    (f) => f.status !== 'geschlossen' && f.einstufung.startsWith('nk') && (f.bereich === kp.id || f.normbezug.split(/[,;]\s*/).some((n) => nummern.has(n.trim().replace(/^K-/, '')))),
  );
}

function standEinesProzesses(p: Projekt, kp: KatalogProzess, stichtag: string, katalog: readonly KatalogProzess[]): ProzessStand {
  const e = eintragVon(p, kp.id);
  const sicht = sichtImPfad(kp, p.meta.mitIsms);
  const ew = eignerVon(p, kp);
  const abgeleitet = abgeleitetesDatum(p, kp.ableitung, stichtag);
  const hand = e?.letzteDurchfuehrung;
  const letzte = [abgeleitet, hand].filter((x): x is string => !!x).sort().at(-1);
  const rhythmus = e?.rhythmus || kp.rhythmus || undefined;
  const monate = rhythmus ? RHYTHMUS_MONATE[rhythmus] : undefined;
  // Nächster Termin: von Hand, sonst ein Termin aus den Projektdaten nach der letzten Durchführung (z. B. nächste
  // Überprüfung der Leitlinie), sonst letzte Durchführung plus Rhythmus
  const termin = (kp.faellig_aus ?? [])
    .flatMap((x) => pfadWerte(p, x))
    .filter((w): w is string => typeof w === 'string' && /^\d{4}-\d\d-\d\d/.test(w))
    .map((w) => w.slice(0, 10))
    .filter((d) => !letzte || d > letzte)
    .sort()[0];
  const naechste = e?.naechsteFaelligkeit || termin || (letzte && monate ? plusMonate(letzte, monate) : undefined);
  const m = prozessMassnahmen(p, kp.id, katalog);
  // Offen zum Stichtag: Spätere Massnahmen gehören nicht in eine ältere Fassung
  const offen = m.filter((x) => (x.status === 'offen' || x.status === 'in-arbeit') && (!x.erfasstAm || x.erfasstAm <= stichtag));
  const dokumente = kp.kit_dokumente.map((id) => {
    const d = p.dokumente.find((x) => x.id === id || x.id === `${id}-EB`);
    return { id, status: d?.status };
  });
  const kennzahl = kennzahlStand(p, e?.kennzahl, stichtag);
  const nachweise = e?.nachweise ?? [];

  // Reifevorschlag nach den Kriterien der Reifeskala
  let vorschlag: ProzessReife = 0;
  const definiert = !!ew.person && (dokumente.some((d) => d.status) || !!e?.schritte?.length);
  if (definiert) {
    vorschlag = 1;
    const freigegeben = dokumente.some((d) => d.status === 'freigegeben');
    if (letzte && (freigegeben || nachweise.length)) {
      vorschlag = 2;
      if (kennzahl?.aktuell && kennzahl.sollErreicht !== 'nein') {
        vorschlag = 3;
        const pr = pruefungenDesProzesses(p, kp.id, stichtag);
        if (pr.audit && pr.mb && !offeneNk(p, kp)) vorschlag = 4;
      }
    }
  }
  return {
    id: kp.id,
    gruppe: kp.gruppe,
    katalog: kp,
    eintrag: e,
    sicht,
    anwendbar: anwendbar(p, kp),
    eigner: ew.person,
    eignerQuelle: ew.quelle,
    reife: e?.reife ?? 0,
    reifeVorschlag: vorschlag,
    rhythmus,
    abgeleitet,
    letzteDurchfuehrung: letzte,
    letzteQuelle: letzte ? (letzte === abgeleitet ? 'abgeleitet' : 'hand') : undefined,
    naechsteFaelligkeit: naechste,
    ueberfaellig: !!naechste && naechste < stichtag,
    kennzahl,
    massnahmenOffen: offen.map((x) => x.id),
    feststellungenOffen: p.feststellungen.filter((f) => f.status !== 'geschlossen' && prozesseDerFeststellung(f, katalog).includes(kp.id)).map((f) => f.id),
    massnahmenUeberfaellig: offen.filter((x) => x.termin && x.termin < stichtag).map((x) => x.id),
    nachweise,
    dokumente,
  };
}

/** Stand aller Prozesse des Katalogs in Katalogreihenfolge, danach die eigenen Prozesse der Firma */
export function prozessStaende(p: Projekt, k: Kataloge | undefined, stichtag: string): ProzessStand[] {
  const alle = prozesseImProjekt(p, k);
  return alle.map((kp) => standEinesProzesses(p, kp, stichtag, alle));
}

/**
 * Prozesse, die im Dashboard zählen (gleich wie imProzesssystem): anwendbare AIMS-Prozesse, ohne ISMS der Mindestumfang
 * und ausdrücklich als anwendbar entschiedene empfohlene Basisprozesse
 */
export function imDashboard(s: ProzessStand): boolean {
  return s.anwendbar === 'ja' && s.sicht !== 'verweis';
}

export interface ProzessUebersicht {
  /** Anzahl je Reifestufe 0 bis 4 */
  reife: [number, number, number, number, number];
  gesamt: number;
  ohneEigner: string[];
  ueberfaellig: string[];
  massnahmenOffen: number;
  massnahmenUeberfaellig: number;
  kennzahlenAktuell: number;
}

/** Zusammenfassung für Lagebild, Dashboard und D-21 */
export function prozessUebersicht(staende: readonly ProzessStand[]): ProzessUebersicht {
  const liste = staende.filter(imDashboard);
  const reife: ProzessUebersicht['reife'] = [0, 0, 0, 0, 0];
  for (const s of liste) reife[s.reife]++;
  return {
    reife,
    gesamt: liste.length,
    ohneEigner: liste.filter((s) => !s.eigner).map((s) => s.id),
    ueberfaellig: liste.filter((s) => s.ueberfaellig).map((s) => s.id),
    // Eine Massnahme kann mehrere Prozesse betreffen: jede zählt einmal
    massnahmenOffen: new Set(liste.flatMap((s) => s.massnahmenOffen)).size,
    massnahmenUeberfaellig: new Set(liste.flatMap((s) => s.massnahmenUeberfaellig)).size,
    kennzahlenAktuell: liste.filter((s) => s.kennzahl?.aktuell).length,
  };
}
