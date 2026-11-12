// Modul EU AI Act in der Formularansicht: Pflichten je KI-System (src/ai-act/pflichten.yaml), offene Pflichten,
// Fristen (src/ai-act/stand.yaml). Reine Funktionen; die Regel «gilt für System» kommt aus den Modulvorlagen (E-0x).
import type { Kataloge } from '../../kataloge/typen.ts';
import type { KiSystem, Massnahme, Projekt } from '../../model/typen.ts';
import { pflichtGiltFuer, type Frist, type Pflicht, type Stand } from '../../vorlagen/E-0x.ts';

export type { Frist, Pflicht, Stand };

export function pflichtenKatalog(k: Kataloge): Pflicht[] {
  return ((k['aiact_pflichten'] as { pflichten?: Pflicht[] } | undefined)?.pflichten ?? []);
}

export function standKatalog(k: Kataloge): Stand | null {
  return (k['aiact_stand'] as Stand | undefined) ?? null;
}

const aktiv = (s: KiSystem) => s.status !== 'abgeloest' && s.status !== 'untersagt';

export type PflichtStand = 'abgedeckt' | 'umgesetzt' | 'offen' | 'abgelehnt';

export interface PflichtZeile {
  pflicht: Pflicht;
  system: KiSystem;
  stand: PflichtStand;
  /** Massnahme mit herkunft aiact und ref «Pflicht:System» */
  massnahme?: Massnahme;
}

export const massnahmenRef = (pflichtId: string, systemId: string) => `${pflichtId}:${systemId}`;

/**
 * Stand einer Pflicht für ein System:
 * abgedeckt  ganz durch das AIMS abgedeckt (kein Zusatz-Control nötig)
 * umgesetzt  Zusatz-Control anwendbar und mindestens umgesetzt
 * abgelehnt  Zusatz-Control begründet als nicht anwendbar entschieden
 * offen      sonst
 */
export function pflichtStand(p: Projekt, pf: Pflicht): PflichtStand {
  if (pf.abdeckung_42001.grad === 'ganz' || !pf.zusatz_control) return 'abgedeckt';
  const c = p.controls.find((x) => x.id === pf.zusatz_control);
  if (c?.anwendbar === 'nein' && c.begruendung.trim()) return 'abgelehnt';
  if (c?.anwendbar === 'ja' && (c.status === 'umgesetzt' || c.status === 'wirksam')) return 'umgesetzt';
  return 'offen';
}

/** Alle Pflichten je aktivem KI-System (nur mit Modul). */
export function pflichtenJeSystem(p: Projekt, pflichten: readonly Pflicht[]): { system: KiSystem; zeilen: PflichtZeile[] }[] {
  if (!p.meta.modulAiAct) return [];
  return p.kiSysteme.filter(aktiv).map((s) => ({
    system: s,
    zeilen: pflichten
      .filter((pf) => pflichtGiltFuer(pf, s, p))
      .map((pf) => ({
        pflicht: pf,
        system: s,
        stand: pflichtStand(p, pf),
        massnahme: p.massnahmen.find((m) => m.herkunft.art === 'aiact' && m.herkunft.ref === massnahmenRef(pf.id, s.id)),
      })),
  }));
}

export function offenePflichten(p: Projekt, pflichten: readonly Pflicht[]): PflichtZeile[] {
  return pflichtenJeSystem(p, pflichten).flatMap((x) => x.zeilen.filter((z) => z.stand === 'offen'));
}

/** Fristen nach Datum; `naechste` ist die erste Frist ab heute. */
export function fristenUebersicht(stand: Stand | null, heute: string): { fristen: (Frist & { vorbei: boolean })[]; naechste?: string } {
  const fristen = [...(stand?.fristen ?? [])].sort((a, b) => a.datum.localeCompare(b.datum)).map((f) => ({ ...f, vorbei: f.datum < heute }));
  return { fristen, naechste: fristen.find((f) => !f.vorbei)?.id };
}

/** Geltungsbeginn einer Pflicht für eine Risikoklasse (abweichende Daten je Klasse nach Art. 113(3)(c)). */
export function giltAb(pf: Pflicht, klasse: string): string {
  return pf.gilt_ab_je_klasse?.[klasse] ?? pf.gilt_ab;
}
