// Erwartete Einträge je Norm aus den Katalogen des Kits (nur Nummern, kein Text): Grundlage für Parser und Vollständigkeit.
import type { Kataloge } from '../kataloge/typen.ts';
import type { NormId, NormNr } from './typen.ts';

export interface Erwartet {
  norm: NormNr;
  /** Abschnitte Kapitel 4 bis 10 (Pflicht für die Vollständigkeit bei 42001), z. B. K-4.1 */
  abschnitte: NormId[];
  /** Controls aus Anhang A (Pflicht für die Vollständigkeit), z. B. A.2.2 oder 27001-5.1 */
  controls: NormId[];
  /** Kapitel (K-4) und Gruppen (A.2, A.6.1, 27001-5): nur Titel, für die Vollständigkeit nicht nötig */
  zusatz: NormId[];
}

interface Katalog27001 { controls: { id: string; nummer: string; thema: string }[] }
interface KapitelGemeinsam { abschnitte: { id: string; gegenstueck27001: string | null }[] }

export function erwartet42001(k: Kataloge): Erwartet {
  const abschnitte = k.anforderungen42001.kapitel.flatMap((kap) => kap.abschnitte.map((a) => a.id));
  const controls = k.controls42001.gruppen.flatMap((g) => g.controls.map((c) => c.id));
  const zusatz = [
    ...k.anforderungen42001.kapitel.map((kap) => kap.id),
    ...k.controls42001.gruppen.flatMap((g) => [g.id, ...(g.untergruppen ?? [])]),
  ];
  return { norm: '42001', abschnitte, controls, zusatz };
}

export function erwartet27001(k: Kataloge): Erwartet {
  const kat = k['controls27001'] as Katalog27001 | undefined;
  const controls = (kat?.controls ?? []).map((c) => c.id);
  // Kapitel 4 bis 10 nach der gemeinsamen Struktur (Gegenstücke in kapitel-gemeinsam.yaml); für den Klimawandel (Amd 1:2024)
  const gemeinsam = (k['kapitelGemeinsam'] as KapitelGemeinsam | undefined)?.abschnitte ?? [];
  const abschnitte = [...new Set(gemeinsam.map((a) => a.gegenstueck27001).filter((x): x is string => !!x))].map((n) => `27001-K-${n}`);
  const zusatz = [...new Set((kat?.controls ?? []).map((c) => c.nummer.split('.')[0]!))].map((n) => `27001-${n}`);
  return { norm: '27001', abschnitte, controls, zusatz };
}

export function erwartetFuer(norm: NormNr, k: Kataloge): Erwartet {
  return norm === '42001' ? erwartet42001(k) : erwartet27001(k);
}

/** Pflichteinträge für die Vollständigkeit: 42001 Abschnitte und 38 Controls, 27001 die 93 Controls. */
export function pflichtIds(e: Erwartet): NormId[] {
  return e.norm === '42001' ? [...e.abschnitte, ...e.controls] : e.controls;
}

/** Nummer in der Norm zur ID (K-4.1 -> 4.1, A.2.2 -> A.2.2, 27001-5.1 -> 5.1, 27001-K-4.1 -> 4.1) */
export function nummerVon(id: NormId): string {
  return id.replace(/^27001-/, '').replace(/^K-/, '');
}
