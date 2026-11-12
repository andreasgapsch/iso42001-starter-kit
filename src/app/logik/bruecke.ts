// ISO 27001-Brücke: Zuordnung der 42001-Controls zu 27001 (src/kataloge/mapping-42001-27001.yaml),
// Wiederverwendungsgrad und ISMS-Dokumente, die ein Ergänzungsblatt brauchen (src/kataloge/ergaenzungsblaetter.yaml).
import type { Kataloge } from '../../kataloge/typen.ts';
import type { Projekt } from '../../model/typen.ts';

export type Staerke = 'hoch' | 'mittel' | 'tief';

export interface Zuordnung {
  id: string;
  verwandt: { control: string; staerke: Staerke; begruendung: string }[];
}

export interface Ergaenzungsblatt {
  id: string;
  vorlage: string;
  ismsDokument: string;
  normbezug: string[];
  iso27001: string[];
  /** Abschnitte der Kapitel 4 bis 10 der ISO/IEC 27001 (z. B. 9.2), damit auch ISMS-Prozesse ohne Anhang-A-Control einen Bezug haben */
  iso27001Kapitel?: string[];
}

export function zuordnungen(k: Kataloge): Zuordnung[] {
  return ((k['mapping4200127001'] as { zuordnungen?: Zuordnung[] } | undefined)?.zuordnungen ?? []);
}

export function ergaenzungsblaetterKatalog(k: Kataloge): Ergaenzungsblatt[] {
  return ((k['ergaenzungsblaetter'] as { blaetter?: Ergaenzungsblatt[] } | undefined)?.blaetter ?? []);
}

export interface Wiederverwendung {
  /** Anzahl 42001-Controls im Katalog */
  gesamt: number;
  /** mit mindestens einer starken Entsprechung (ISMS-Nachweis deckt weitgehend ab) */
  hoch: number;
  /** mit mindestens einer starken oder mittleren Entsprechung */
  mindestensMittel: number;
  /** Anteil 0 bis 1: hoch zählt ganz, mittel halb, tief nicht (je Control die stärkste Entsprechung) */
  grad: number;
  /** Im Projekt: anwendbare 42001-Controls und davon mit verknüpften 27001-Controls */
  anwendbar: number;
  verknuepft: number;
}

const GEWICHT: Record<Staerke, number> = { hoch: 1, mittel: 0.5, tief: 0 };

export function staerksteEntsprechung(z: Zuordnung | undefined): Staerke | undefined {
  if (!z || z.verwandt.length === 0) return undefined;
  return z.verwandt.reduce<Staerke>((m, v) => (GEWICHT[v.staerke] > GEWICHT[m] ? v.staerke : m), 'tief');
}

export function wiederverwendung(k: Kataloge, controlIds: readonly string[], p?: Projekt): Wiederverwendung {
  const karte = new Map(zuordnungen(k).map((z) => [z.id, z]));
  let hoch = 0;
  let mittel = 0;
  let summe = 0;
  for (const id of controlIds) {
    const s = staerksteEntsprechung(karte.get(id));
    if (s === 'hoch') hoch++;
    if (s === 'hoch' || s === 'mittel') mittel++;
    summe += s ? GEWICHT[s] : 0;
  }
  const anwendbare = (p?.controls ?? []).filter((c) => c.rahmenwerk === 'ISO42001' && c.anwendbar === 'ja');
  return {
    gesamt: controlIds.length,
    hoch,
    mindestensMittel: mittel,
    grad: controlIds.length ? summe / controlIds.length : 0,
    anwendbar: anwendbare.length,
    verknuepft: anwendbare.filter((c) => c.iso27001.length > 0).length,
  };
}

/** Vorschlag für die 27001-Verknüpfung eines Controls: starke und mittlere Entsprechungen. */
export function vorgeschlagene27001(k: Kataloge, controlId: string): string[] {
  const z = zuordnungen(k).find((x) => x.id === controlId);
  return (z?.verwandt ?? []).filter((v) => v.staerke !== 'tief').map((v) => v.control);
}
