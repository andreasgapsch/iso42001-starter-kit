// Modul NIST AI RMF im Werkzeug: Moduldokumente, Ist-Vorschlag und Zusammenfassung des Profils je Funktion, Stand der
// Fassung. Die Fachlogik (Ist-Stufe, Vorschläge RMF-xx) steht in src/nist-rmf/logik.ts und gilt auch für N-01 und die
// Prüfregeln. Reine Funktionen ohne UI.
import type { Dokument, Kataloge, NistStand, NistSubkategorie } from '../../kataloge/typen.ts';
import type { NistProfilEintrag, Projekt } from '../../model/typen.ts';
import { istStufe, monateZwischen, type IstHerleitung } from '../../nist-rmf/logik.ts';

/**
 * Ist ein Dokument des Katalogs im Projekt aktiv? Moduldokumente nur mit eingeschaltetem Modul (AI Act bzw. NIST AI RMF),
 * die Prozessbeschreibung (D-27) nur, wenn das Projekt Prozesse führt.
 */
export function dokumentImModul(d: Pick<Dokument, 'art' | 'ordner'> & { je_prozess?: boolean }, p: Projekt): boolean {
  if (d.je_prozess && p.prozesse === undefined) return false;
  if (d.ordner === 'modul_nist' || (d.art as string) === 'modul_nist') return p.meta.modulNistRmf === true;
  if (d.art === 'modul') return p.meta.modulAiAct;
  return true;
}

/** Abgeleitete Ist-Stufe (ohne den Eintrag «ist» im Profil), Grundlage für «Vorschlag übernehmen». */
export function istVorschlag(p: Projekt, k: Kataloge, s: NistSubkategorie): IstHerleitung {
  const e = p.nistProfil?.[s.id];
  if (e?.ist === undefined) return istStufe(p, k, s);
  const { ist: _ist, ...rest } = e;
  return istStufe({ ...p, nistProfil: { ...p.nistProfil, [s.id]: rest } }, k, s);
}

/** Grundlagen des Vorschlags als kurzer Text, z. B. «D-10: 2, A.4.2: 2, Angaben fehlen». */
export function vorschlagGruende(h: IstHerleitung, text: { angabenFehlen: string; luecke: string }): string {
  return [
    ...h.dokumente.map((d) => `${d.id}: ${d.stufe}`),
    ...h.controls.map((c) => `${c.id}: ${c.stufe}`),
    ...(h.angabenFehlen ? [text.angabenFehlen] : []),
    ...(h.luecke ? [text.luecke] : []),
  ].join(', ');
}

export interface FunktionStand {
  funktion: string;
  gesamt: number;
  /** Subkategorien mit Ist und Ziel */
  bewertet: number;
  /** Ziel höher als Ist */
  luecken: number;
  /** Lücke ohne Massnahme */
  ohneMassnahme: number;
}

export function luecke(e: NistProfilEintrag | undefined): boolean {
  return e?.ist !== undefined && e.ziel !== undefined && e.ziel > e.ist;
}

export function funktionStand(p: Projekt, subkategorien: readonly NistSubkategorie[], funktion: string): FunktionStand {
  const liste = subkategorien.filter((s) => s.funktion === funktion);
  const profil = p.nistProfil ?? {};
  let bewertet = 0;
  let luecken = 0;
  let ohneMassnahme = 0;
  for (const s of liste) {
    const e = profil[s.id];
    if (e?.ist !== undefined && e.ziel !== undefined) bewertet++;
    if (luecke(e)) {
      luecken++;
      if (!(e!.massnahmen ?? []).length) ohneMassnahme++;
    }
  }
  return { funktion, gesamt: liste.length, bewertet, luecken, ohneMassnahme };
}

/** Stand des NIST AI RMF älter als die Frist in stand.yaml (hinweis_nach_monaten)? */
export function standVeraltet(stand: Pick<NistStand, 'geprueft_am' | 'hinweis_nach_monaten'> | undefined, heute: string): boolean {
  if (!stand?.geprueft_am) return false;
  return monateZwischen(stand.geprueft_am, heute) >= (stand.hinweis_nach_monaten || 6);
}

/** Mittelwerte von Ist und Ziel (Stufen 0 bis 3) je Funktion für die Hantel; null, solange keine Subkategorie einen Wert hat. */
export function funktionMittel(p: Projekt, subkategorien: readonly NistSubkategorie[], funktion: string): { ist: number | null; ziel: number | null } {
  const profil = p.nistProfil ?? {};
  const liste = subkategorien.filter((s) => s.funktion === funktion).map((s) => profil[s.id]);
  const mittel = (werte: (number | undefined)[]) => {
    const z = werte.filter((x): x is number => typeof x === 'number');
    return z.length ? Math.round((z.reduce((a, b) => a + b, 0) / z.length) * 10) / 10 : null;
  };
  return { ist: mittel(liste.map((e) => e?.ist)), ziel: mittel(liste.map((e) => e?.ziel)) };
}
