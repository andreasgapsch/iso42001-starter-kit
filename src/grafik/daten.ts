// Reine Aggregationen für App und Dokumente: Risikostufe, Risikomatrix vor und nach Behandlung, SoA-Umsetzung je Gruppe,
// Massnahmen nach Fälligkeit, Verteilungen im Inventar, Kennzahlverlauf. Keine Abhängigkeit von App, Generator oder i18n:
// Die Funktionen liefern einfache Objekte; Beschriftungen und Farben setzen die Aufrufer (App: Tokens, Dokumente: Druckpalette).
// Deterministisch: kein Date.now(), der Stichtag kommt als Parameter.
import type { ControlEintrag, ControlStatus, KiSystem, Massnahme, Projekt, Risiko, Risikostufe, Ziel } from '../model/typen.ts';

export type { Risikostufe } from '../model/typen.ts';

/** Grenzen der Risikokriterien (organisation.risikokriterien): tief bis akzeptanzBis, hoch ab unannehmbarAb, mittel dazwischen */
export interface Risikogrenzen {
  akzeptanzBis: number;
  unannehmbarAb: number;
}

/** Stufen in aufsteigender Reihenfolge */
export const STUFEN: readonly Risikostufe[] = ['tief', 'mittel', 'hoch'];

/** Risikostufe eines Risikowerts W×A: eine Regel für App, D-04, D-06, D-07 und Prüfregeln */
export function stufeAusWert(wert: number, k: Risikogrenzen): Risikostufe {
  return wert >= k.unannehmbarAb ? 'hoch' : wert > k.akzeptanzBis ? 'mittel' : 'tief';
}

/** Risikostufe aus Wahrscheinlichkeit und Auswirkung; null, solange eine der beiden fehlt */
export function risikoStufe(w: number | null | undefined, a: number | null | undefined, k: Risikogrenzen): Risikostufe | null {
  if (typeof w !== 'number' || typeof a !== 'number' || !Number.isFinite(w) || !Number.isFinite(a)) return null;
  return stufeAusWert(w * a, k);
}

/** Erreichbare Risikowerte je Stufe für die Skalen (z. B. 3×3: mittel nur «4»), aufsteigend */
export function werteJeStufe(stufenW: readonly number[], stufenA: readonly number[], k: Risikogrenzen): Record<Risikostufe, number[]> {
  const werte = [...new Set(stufenW.flatMap((w) => stufenA.map((a) => w * a)))].sort((x, y) => x - y);
  return {
    tief: werte.filter((v) => stufeAusWert(v, k) === 'tief'),
    mittel: werte.filter((v) => stufeAusWert(v, k) === 'mittel'),
    hoch: werte.filter((v) => stufeAusWert(v, k) === 'hoch'),
  };
}

/** Stufen der Skalen aus den Risikokriterien, aufsteigend; ohne eigene Skala der Ersatz (Vorschlag 4×4) */
export function skalenStufen(projekt: Projekt, ersatz: readonly number[] = [1, 2, 3, 4]): { w: number[]; a: number[] } {
  const kr = projekt.organisation.risikokriterien;
  const stufen = (s: { stufe: number }[]) => (s.length ? [...new Set(s.map((x) => x.stufe))].sort((x, y) => x - y) : [...ersatz]);
  return { w: stufen(kr.wahrscheinlichkeit), a: stufen(kr.auswirkung) };
}

// Risikomatrix

export type MatrixStand = 'vor' | 'nach';

export interface MatrixZelle {
  w: number;
  a: number;
  /** Risikowert W×A */
  wert: number;
  stufe: Risikostufe;
  anzahl: number;
  /** IDs der Risiken in der Zelle, in Reihenfolge des Registers */
  ids: string[];
}

export interface RisikoMatrix {
  stand: MatrixStand;
  /** Stufen der Wahrscheinlichkeit, aufsteigend */
  w: number[];
  /** Stufen der Auswirkung, aufsteigend */
  a: number[];
  /** zellen[i][j]: Wahrscheinlichkeit w[i], Auswirkung a[j] (beide aufsteigend; für die Darstellung W absteigend lesen) */
  zellen: MatrixZelle[][];
  /** Anzahl Risiken in der Matrix */
  bewertet: number;
  /** Risiken ohne W oder A für diesen Stand */
  unbewertet: string[];
  /** Risiken mit Werten ausserhalb der Skalen */
  ausserhalb: string[];
  jeStufe: Record<Risikostufe, number>;
}

export interface MatrixOptionen {
  stand: MatrixStand;
  /** Chancen mitzählen (Standard: nein) */
  mitChancen?: boolean;
  /** Geschlossene Risiken mitzählen (Standard: nein) */
  mitGeschlossenen?: boolean;
  /** Nur Risiken dieses KI-Systems */
  kiSystem?: string;
}

/** Risiken, die eine Matrix zählt (Chancen, geschlossene und System nach Optionen) */
export function matrixRisiken(risiken: readonly Risiko[], o: Omit<MatrixOptionen, 'stand'> = {}): Risiko[] {
  return risiken.filter(
    (r) => (o.mitChancen || r.art !== 'chance') && (o.mitGeschlossenen || r.status !== 'geschlossen') && (!o.kiSystem || r.kiSystem === o.kiSystem),
  );
}

/** Zählt Risiken in eine Matrix der gegebenen Skalen (auch leer: nur Zonen, z. B. für D-06) */
export function matrixZaehlen(
  risiken: readonly Pick<Risiko, 'id' | 'w' | 'a' | 'wNach' | 'aNach'>[],
  stufenW: readonly number[],
  stufenA: readonly number[],
  k: Risikogrenzen,
  stand: MatrixStand = 'vor',
): RisikoMatrix {
  const w = [...new Set(stufenW)].sort((x, y) => x - y);
  const a = [...new Set(stufenA)].sort((x, y) => x - y);
  const zellen = w.map((wi) => a.map((aj): MatrixZelle => ({ w: wi, a: aj, wert: wi * aj, stufe: stufeAusWert(wi * aj, k), anzahl: 0, ids: [] })));
  const unbewertet: string[] = [];
  const ausserhalb: string[] = [];
  for (const r of risiken) {
    const rw = stand === 'vor' ? r.w : r.wNach;
    const ra = stand === 'vor' ? r.a : r.aNach;
    if (typeof rw !== 'number' || typeof ra !== 'number') {
      unbewertet.push(r.id);
      continue;
    }
    const i = w.indexOf(rw);
    const j = a.indexOf(ra);
    if (i < 0 || j < 0) {
      ausserhalb.push(r.id);
      continue;
    }
    const z = zellen[i]![j]!;
    z.anzahl++;
    z.ids.push(r.id);
  }
  const jeStufe: Record<Risikostufe, number> = { tief: 0, mittel: 0, hoch: 0 };
  for (const z of zellen.flat()) jeStufe[z.stufe] += z.anzahl;
  return { stand, w, a, zellen, bewertet: jeStufe.tief + jeStufe.mittel + jeStufe.hoch, unbewertet, ausserhalb, jeStufe };
}

/** Risikomatrix des Projekts vor oder nach Behandlung mit den eigenen Skalen und Grenzen */
export function risikoMatrix(projekt: Projekt, o: MatrixOptionen): RisikoMatrix {
  const s = skalenStufen(projekt);
  return matrixZaehlen(matrixRisiken(projekt.risiken, o), s.w, s.a, projekt.organisation.risikokriterien, o.stand);
}

/**
 * Risiken über der Akzeptanzgrenze nach heutigem Stand: mit Bewertung nach Behandlung dieser Wert, sonst der Wert vor
 * Behandlung (ein noch nicht behandeltes Risiko bleibt über der Grenze). ohneBehandlung: davon ohne Bewertung nach Behandlung.
 */
export function ueberAkzeptanz(projekt: Projekt): { anzahl: number; ohneBehandlung: number; vor: number } {
  const k = projekt.organisation.risikokriterien;
  let anzahl = 0;
  let ohneBehandlung = 0;
  let vor = 0;
  for (const r of matrixRisiken(projekt.risiken)) {
    const v = risikoStufe(r.w, r.a, k);
    const n = risikoStufe(r.wNach, r.aNach, k);
    if (v && v !== 'tief') vor++;
    const jetzt = n ?? v;
    if (!jetzt || jetzt === 'tief') continue;
    anzahl++;
    if (!n) ohneBehandlung++;
  }
  return { anzahl, ohneBehandlung, vor };
}

/**
 * Lage eines Risikos zur Akzeptanzgrenze (Nutzertest rc.10, U-05), gleiche Regel wie ueberAkzeptanz: Wert nach der
 * Behandlung, sonst davor. «ueber»: über der Grenze, noch ohne Wert nach Behandlung; «annahme-offen»: auch nach der
 * Behandlung über der Grenze und ohne Annahme des Restrisikos; «angenommen»: Restrisiko angenommen. Chancen und
 * geschlossene Risiken: null.
 */
export type RestLage = 'unter' | 'ueber' | 'annahme-offen' | 'angenommen';
export function restLage(r: Risiko, k: Risikogrenzen): RestLage | null {
  if (r.art === 'chance' || r.status === 'geschlossen') return null;
  const v = risikoStufe(r.w, r.a, k);
  const n = risikoStufe(r.wNach, r.aNach, k);
  const jetzt = n ?? v;
  if (!jetzt) return null;
  if (jetzt === 'tief') return 'unter';
  if (r.restrisikoAkzeptiert) return 'angenommen';
  return n ? 'annahme-offen' : 'ueber';
}

// Erklärung zur Anwendbarkeit

/** Umsetzung eines Controls für die Auswertung; ausgeschlossen und unentschieden getrennt */
export type SoaKategorie = 'wirksam' | 'umgesetzt' | 'teilweise' | 'geplant' | 'offen' | 'ausgeschlossen' | 'unentschieden';
export const SOA_KATEGORIEN: readonly SoaKategorie[] = ['wirksam', 'umgesetzt', 'teilweise', 'geplant', 'offen', 'ausgeschlossen', 'unentschieden'];

/**
 * Umsetzungsstand eines Controls (eine Regel mit D-11, D-20, D-25): «umgesetzt» oder «wirksam» gilt nur als «teilweise»,
 * solange die Umsetzung auf eine offene Massnahme verweist (M-ID in umsetzung, Massnahme nicht erledigt oder verworfen).
 */
export function controlUmsetzung(c: Pick<ControlEintrag, 'status' | 'umsetzung'>, massnahmen: readonly Pick<Massnahme, 'id' | 'status'>[]): ControlStatus {
  if (c.status !== 'umgesetzt' && c.status !== 'wirksam') return c.status;
  const offen = (c.umsetzung.match(/\bM-\d{3}\b/g) ?? []).some((id) => {
    const m = massnahmen.find((x) => x.id === id);
    return !!m && m.status !== 'erledigt' && m.status !== 'verworfen';
  });
  return offen ? 'teilweise' : c.status;
}

export function soaKategorie(c: ControlEintrag | undefined, massnahmen: readonly Pick<Massnahme, 'id' | 'status'>[] = []): SoaKategorie {
  if (!c || c.anwendbar === 'offen') return 'unentschieden';
  if (c.anwendbar === 'nein') return 'ausgeschlossen';
  return controlUmsetzung(c, massnahmen);
}

export interface SoaGruppe {
  id: string;
  anzahl: Record<SoaKategorie, number>;
  /** Controls der Gruppe im Katalog */
  gesamt: number;
  /** Anwendbare Controls (ohne ausgeschlossen und unentschieden) */
  anwendbar: number;
  /** Anteil umgesetzt oder wirksam an den anwendbaren, 0 bis 1 (0 ohne anwendbare) */
  anteilUmgesetzt: number;
}

/** SoA-Umsetzung je Gruppe des Katalogs (z. B. A.2 bis A.10); Controls ohne Eintrag gelten als unentschieden */
export function soaJeGruppe(projekt: Pick<Projekt, 'controls' | 'massnahmen'>, gruppen: readonly { id: string; controls: readonly { id: string }[] }[]): SoaGruppe[] {
  const karte = new Map(projekt.controls.map((c) => [c.id, c]));
  return gruppen.map((g) => {
    const anzahl = Object.fromEntries(SOA_KATEGORIEN.map((k) => [k, 0])) as Record<SoaKategorie, number>;
    for (const c of g.controls) anzahl[soaKategorie(karte.get(c.id), projekt.massnahmen)]++;
    const anwendbar = g.controls.length - anzahl.ausgeschlossen - anzahl.unentschieden;
    return { id: g.id, anzahl, gesamt: g.controls.length, anwendbar, anteilUmgesetzt: anwendbar ? (anzahl.umgesetzt + anzahl.wirksam) / anwendbar : 0 };
  });
}

// Massnahmen nach Fälligkeit

export type Faelligkeit = 'ueberfaellig' | 'bald' | 'spaeter' | 'ohneTermin' | 'erledigt' | 'verworfen';
export const FAELLIGKEITEN: readonly Faelligkeit[] = ['ueberfaellig', 'bald', 'spaeter', 'ohneTermin', 'erledigt', 'verworfen'];

/** ISO-Datum plus Tage (UTC, ohne Uhrzeit) */
export function plusTage(iso: string, tage: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/**
 * Fälligkeit einer Massnahme am Stichtag: überfällig vor dem Stichtag, bald bis Stichtag + tage. Erledigt erst ab dem
 * Abschlussdatum (erledigtAm nach dem Stichtag: am Stichtag noch offen).
 */
export function faelligkeit(m: Pick<Massnahme, 'status' | 'termin' | 'erledigtAm'>, stichtag: string, tage = 30): Faelligkeit {
  const tag = stichtag.slice(0, 10);
  if (m.status === 'erledigt' && (!m.erledigtAm || m.erledigtAm.slice(0, 10) <= tag)) return 'erledigt';
  if (m.status === 'verworfen') return 'verworfen';
  const t = m.termin?.slice(0, 10);
  if (!t) return 'ohneTermin';
  if (t < tag) return 'ueberfaellig';
  return t <= plusTage(stichtag, tage) ? 'bald' : 'spaeter';
}

export interface FaelligkeitsGruppe {
  art: Faelligkeit;
  ids: string[];
}

/** Massnahmen nach Fälligkeit, Reihenfolge FAELLIGKEITEN; IDs je Gruppe nach Termin, dann ID. Später erfasste zählen nicht. */
export function massnahmenNachFaelligkeit(massnahmen: readonly Massnahme[], stichtag: string, tage = 30): FaelligkeitsGruppe[] {
  const sortiert = massnahmen.filter((m) => !m.erfasstAm || m.erfasstAm.slice(0, 10) <= stichtag.slice(0, 10)).sort((x, y) => (x.termin ?? '9999').localeCompare(y.termin ?? '9999') || x.id.localeCompare(y.id));
  return FAELLIGKEITEN.map((art) => ({ art, ids: sortiert.filter((m) => faelligkeit(m, stichtag, tage) === art).map((m) => m.id) }));
}

// Verteilungen

export interface Anteil<T extends string = string> {
  wert: T;
  anzahl: number;
}

/** Zählt Werte in vorgegebener Reihenfolge; unbekannte Werte am Ende in Reihenfolge des Auftretens, leere als «» */
export function verteilung<T, W extends string>(liste: readonly T[], wert: (x: T) => W | undefined, reihenfolge: readonly W[] = []): Anteil<W>[] {
  const zaehler = new Map<W, number>(reihenfolge.map((w) => [w, 0]));
  for (const x of liste) {
    const w = (wert(x) ?? '') as W;
    zaehler.set(w, (zaehler.get(w) ?? 0) + 1);
  }
  return [...zaehler].map(([w, anzahl]) => ({ wert: w, anzahl }));
}

/** Kreuztabelle zweier Merkmale: zeilen × spalten mit Anzahl */
export function kreuztabelle<T, Z extends string, S extends string>(
  liste: readonly T[],
  zeile: (x: T) => Z,
  spalte: (x: T) => S,
  zeilen: readonly Z[],
  spalten: readonly S[],
): number[][] {
  const tab = zeilen.map(() => spalten.map(() => 0));
  for (const x of liste) {
    const i = zeilen.indexOf(zeile(x));
    const j = spalten.indexOf(spalte(x));
    if (i >= 0 && j >= 0) tab[i]![j]!++;
  }
  return tab;
}

export interface InventarVerteilung {
  gesamt: number;
  typ: Anteil<KiSystem['typ']>[];
  status: Anteil<KiSystem['status']>[];
  lebenszyklus: Anteil<KiSystem['lebenszyklus']>[];
  risikoklasse: Anteil<KiSystem['aiAct']['risikoklasse']>[];
  /** Ohne Angabe: Wert «» */
  handlungsbefugnis: Anteil<string>[];
}

/** Verteilungen im KI-Inventar in der Reihenfolge der Auswahllisten */
export function inventarVerteilung(systeme: readonly KiSystem[]): InventarVerteilung {
  return {
    gesamt: systeme.length,
    typ: verteilung(systeme, (s) => s.typ, ['eingekauft', 'saas', 'eigenbau', 'schatten']),
    status: verteilung(systeme, (s) => s.status, ['erfasst', 'in-pruefung', 'freigegeben', 'eingeschraenkt', 'ausgesetzt', 'abgeloest', 'untersagt']),
    lebenszyklus: verteilung(systeme, (s) => s.lebenszyklus, ['idee', 'entwicklung', 'test', 'betrieb', 'ausserbetrieb']),
    risikoklasse: verteilung(systeme, (s) => s.aiAct?.risikoklasse, ['verboten', 'hochrisiko-anhang-iii', 'hochrisiko-anhang-i', 'transparenz', 'minimal', 'offen']),
    handlungsbefugnis: verteilung(systeme, (s) => s.handlungsbefugnis, ['informiert', 'empfiehlt', 'bereitet-vor', 'fuehrt-begrenzt-aus', 'handelt-mehrstufig']),
  };
}

// Kennzahlverlauf

/** Zahl am Anfang eines Freitexts («97,8 %», «95 % (19 von 20)», «38 ppm»); sonst null */
export function zahlAusText(text: string | undefined): { zahl: number; einheit: string } | null {
  const m = /^\s*(?:ca\.\s*)?([-+]?\d+(?:[.,'’]\d{3})*(?:[.,]\d+)?)\s*(%|[A-Za-zµ]+)?/.exec(text ?? '');
  if (!m) return null;
  let roh = m[1]!.replace(/['’]/g, '');
  // Tausendertrenner «1.240» bzw. Dezimalkomma «97,8»
  roh = /^\d{1,3}(\.\d{3})+$/.test(roh) ? roh.replace(/\./g, '') : roh.replace(',', '.');
  const zahl = Number(roh);
  if (!Number.isFinite(zahl)) return null;
  // Einheit nur, wenn sie direkt folgt und kein Wort wie «von» ist
  const einheit = m[2] && !/^(von|of|bis|to|und|and)$/i.test(m[2]) ? m[2] : '';
  return { zahl, einheit };
}

export type Sollrichtung = 'mindestens' | 'hoechstens' | 'genau';

/** Sollwert aus Freitext («mindestens 95 %», «höchstens 50 ppm», «at least 95 %», «100 %») */
export function sollAusText(text: string | undefined): { zahl: number; einheit: string; richtung: Sollrichtung } | null {
  const t = (text ?? '').trim();
  const m = /^(mindestens|min\.|at least|minimum|höchstens|hoechstens|max\.|at most|maximum|unter|below|über|above)?\s*(.*)$/i.exec(t);
  const wort = (m?.[1] ?? '').toLowerCase();
  const z = zahlAusText(m?.[2] ?? '');
  if (!z) return null;
  const richtung: Sollrichtung = /mind|min\.|least|minimum|über|above/.test(wort) ? 'mindestens' : /höch|hoech|max|most|unter|below/.test(wort) ? 'hoechstens' : 'genau';
  return { ...z, richtung };
}

export interface Messpunkt {
  datum: string;
  /** Zahl aus dem Messwert; null, wenn der Wert keine Zahl ist */
  zahl: number | null;
  text: string;
  sollErreicht?: 'ja' | 'teilweise' | 'nein';
}

export interface Kennzahlverlauf {
  id: string;
  kennzahl: string;
  einheit: string;
  punkte: Messpunkt[];
  soll: { zahl: number; richtung: Sollrichtung } | null;
  /** Mindestens zwei Zahlen mit gleicher Einheit: als Linie darstellbar */
  alsLinie: boolean;
}

/** Verlauf einer Zielkennzahl (Ziel.messungen) nach Datum, bis zum Stichtag (einschliesslich) */
export function kennzahlVerlauf(ziel: Pick<Ziel, 'id' | 'kennzahl' | 'ziel' | 'sollwert' | 'messungen'>, bis?: string): Kennzahlverlauf {
  const punkte = [...ziel.messungen]
    .filter((m) => !bis || m.datum.slice(0, 10) <= bis.slice(0, 10))
    .sort((x, y) => x.datum.localeCompare(y.datum))
    .map((m): Messpunkt => ({ datum: m.datum.slice(0, 10), zahl: zahlAusText(m.wert)?.zahl ?? null, text: m.wert, ...(m.sollErreicht ? { sollErreicht: m.sollErreicht } : {}) }));
  const einheiten = [...new Set(ziel.messungen.map((m) => zahlAusText(m.wert)).filter((z) => z !== null).map((z) => z.einheit))];
  const soll = sollAusText(ziel.sollwert);
  const einheit = einheiten.length === 1 ? einheiten[0]! : '';
  const zahlen = punkte.filter((p) => p.zahl !== null).length;
  return {
    id: ziel.id,
    kennzahl: ziel.kennzahl || ziel.ziel,
    einheit,
    punkte,
    soll: soll && (!soll.einheit || !einheit || soll.einheit === einheit) ? { zahl: soll.zahl, richtung: soll.richtung } : null,
    alsLinie: zahlen >= 2 && einheiten.length === 1,
  };
}

/** Verläufe aller Ziele, die sich als Linie darstellen lassen (nicht verworfen) */
export function kennzahlVerlaeufe(projekt: Pick<Projekt, 'ziele'>, bis?: string): Kennzahlverlauf[] {
  return projekt.ziele
    .filter((z) => z.status !== 'verworfen')
    .map((z) => kennzahlVerlauf(z, bis))
    .filter((v) => v.alsLinie);
}
