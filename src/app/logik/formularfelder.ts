// Felder der Formularansicht je Projektliste, abgeleitet aus den Seiten des Guides
// (eine Quelle für Feldtypen, Beschriftungen, Ausfüllhinweise und Normabschnitte).
import type { Projekt } from '../../model/typen.ts';
import { erfuellt, filterEinesPasst, filterPasst } from './bedingungen.ts';
import type { FeldDef, GefuehrtDaten, SeiteDef, Wenn } from './gefuehrt-typen.ts';

export interface FormularFeld {
  feld: FeldDef;
  /** Textbasis für Beschriftung und Hinweis: gefuehrt.<etappe>.<seite>.felder */
  textBasis: string;
  norm?: string;
  seite: string;
  etappe: string;
  seitenWenn?: Wenn;
  etappenWenn?: Wenn;
  filter?: Record<string, unknown[]>;
  filterEines?: Record<string, unknown[]>;
}

function gehoertZu(s: SeiteDef, liste: string): boolean {
  if (s.typ === 'liste') return s.liste === liste && !s.eintrag;
  if (s.typ === 'auswahl-systeme') return liste === 'kiSysteme';
  if (s.typ === 'folgenabschaetzung') return liste === 'folgenabschaetzungen';
  if (s.typ === 'soa') return liste === 'controls';
  return false;
}

export function formularFelder(g: GefuehrtDaten, liste: string, ausschluss: readonly string[] = []): FormularFeld[] {
  const etappeVon = new Map<string, string>();
  const etappenWenn = new Map<string, Wenn | undefined>();
  for (const e of g.etappen.etappen) {
    etappenWenn.set(e.id, e.wenn);
    for (const s of e.seiten) if (!etappeVon.has(s)) etappeVon.set(s, e.id);
  }
  const gesehen = new Set<string>();
  const r: FormularFeld[] = [];
  for (const s of g.seiten) {
    if (!gehoertZu(s, liste)) continue;
    const etappe = etappeVon.get(s.id);
    // Jahreskalender nur mit eigenem Filter (z. B. Überwachungsaudits), sonst doppelt zu den Etappen
    if (!etappe || (etappe === 'J' && !s.filter)) continue;
    // Dasselbe Feld darf mehrfach vorkommen, wenn die Seiten verschiedene Einträge zeigen (Filter, z. B. Auditart);
    // feldAktiv wählt je Eintrag, sichtbareFelder zeigt je Pfad das erste passende
    const sig = `${JSON.stringify(s.filter ?? null)}|${JSON.stringify(s.filterEines ?? null)}`;
    for (const f of s.felder ?? []) {
      const k = f.pfad ?? f.schluessel ?? '';
      if (gesehen.has(`${k}|${sig}`) || ausschluss.includes(k)) continue;
      gesehen.add(`${k}|${sig}`);
      r.push({ feld: f, textBasis: `gefuehrt.${etappe}.${s.id}.felder`, norm: s.norm, seite: s.id, etappe, seitenWenn: s.wenn, etappenWenn: etappenWenn.get(etappe), filter: s.filter, filterEines: s.filterEines });
    }
  }
  return r;
}

/** Gilt das Feld für diesen Eintrag (Etappe, Seite, Seitenfilter, Feldbedingung)? */
export function feldAktiv(f: FormularFeld, p: Projekt, eintrag: unknown): boolean {
  return erfuellt(f.etappenWenn, p) && erfuellt(f.seitenWenn, p) && filterPasst(eintrag, f.filter) && filterEinesPasst(eintrag, f.filterEines) && erfuellt(f.feld.wenn, p, eintrag);
}

/** Aktive Felder eines Eintrags, je Pfad nur das erste passende */
export function sichtbareFelder(felder: FormularFeld[], p: Projekt, eintrag: unknown): FormularFeld[] {
  const gesehen = new Set<string>();
  return felder.filter((f) => {
    const k = f.feld.pfad ?? f.feld.schluessel ?? '';
    if (gesehen.has(k) || !feldAktiv(f, p, eintrag)) return false;
    gesehen.add(k);
    return true;
  });
}

/**
 * Filter für einen neuen Eintrag im Register (C4-01): Zeigen alle Seiten der Liste nur gefilterte Einträge (Rollen: Pflichtrollen
 * und RACI nach Bereich), entstünde ein neuer Eintrag ohne Felder. Dann die Vereinigung der Filterwerte je gemeinsamem Schlüssel
 * in der Reihenfolge der Seiten; sonst kein Filter (mindestens eine Seite zeigt jeden Eintrag).
 */
export function registerFilter(felder: readonly FormularFeld[]): Record<string, unknown[]> | undefined {
  if (!felder.length || felder.some((f) => !f.filter || Object.keys(f.filter).length === 0)) return undefined;
  const schluessel = Object.keys(felder[0]!.filter!).filter((k) => felder.every((f) => f.filter![k] !== undefined));
  if (!schluessel.length) return undefined;
  return Object.fromEntries(schluessel.map((k) => [k, [...new Set(felder.flatMap((f) => f.filter![k]!))]]));
}
