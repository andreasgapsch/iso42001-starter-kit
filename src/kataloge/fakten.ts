// Faktenquelle (src/kataloge/fakten.yaml, AF-072): Typen, Wert eines Fakts je Sprache und Einsetzen der Platzhalter
// {{fakt:<id>}} und {{fakt:<id>|gross}} in Sprachtexte. Ohne Node-Abhängigkeit; geladen wird in fakten-node.ts.
import type { Texte } from '../i18n/texte.ts';

export type FaktSprache = 'de' | 'en';
export type FaktArt = 'frist' | 'schwelle' | 'register' | 'freigabe';

export interface Fakt {
  art: FaktArt;
  wert?: number;
  einheit?: string;
  text?: Record<FaktSprache, string>;
  rolle?: string;
  entscheid?: string;
  /** Freigabeschritte im Prozesskatalog, wenn nicht alle Schritte eines «entscheid» gemeint sind (Tor G40) */
  schritte?: string[];
  stellen: string[];
  bereich: string[];
  ausnahmen: Record<string, string>;
  querbezug: string;
}

export interface FaktenDatei {
  einheiten: Record<string, Record<FaktSprache, [string, string]>>;
  fakten: Record<string, Fakt>;
}

/** Platzhalter eines Fakts; Gruppe 1 ist die ID, Gruppe 2 der Zusatz «gross» */
export const FAKT_PLATZHALTER = /\{\{fakt:([a-z0-9.-]+)(?:\|(gross))?\}\}/g;

export class UnbekannterFakt extends Error {}

/** Wert eines Fakts in einer Sprache: «1 Arbeitstag», «24 Stunden», «am Tag der Meldung» */
export function faktWert(datei: FaktenDatei, id: string, sprache: FaktSprache): string {
  const f = datei.fakten[id];
  if (!f) throw new UnbekannterFakt(`Unbekannter Fakt: ${id}`);
  if (f.text) return f.text[sprache];
  if (f.wert === undefined || !f.einheit) throw new UnbekannterFakt(`Fakt ohne Wert: ${id}`);
  const formen = datei.einheiten[f.einheit]?.[sprache];
  if (!formen) throw new UnbekannterFakt(`Unbekannte Einheit ${f.einheit} im Fakt ${id}`);
  return `${f.wert} ${f.wert === 1 ? formen[0] : formen[1]}`;
}

/** Setzt alle Faktplatzhalter in einem Text ein; unbekannte IDs werfen, damit kein Platzhalter ins Dokument gelangt */
export function setzeFaktenInText(text: string, sprache: FaktSprache, datei: FaktenDatei): string {
  return text.replace(FAKT_PLATZHALTER, (_m, id: string, gross?: string) => {
    const w = faktWert(datei, id, sprache);
    return gross ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  });
}

/** Setzt die Faktplatzhalter in allen Zeichenketten eines Textbaums ein (neues Objekt, Eingabe bleibt unverändert) */
export function setzeFakten<T extends Texte | Texte[keyof Texte]>(texte: T, sprache: FaktSprache, datei: FaktenDatei): T {
  const gehe = (w: unknown): unknown => {
    if (typeof w === 'string') return w.includes('{{fakt:') ? setzeFaktenInText(w, sprache, datei) : w;
    if (Array.isArray(w)) return w.map(gehe);
    if (w && typeof w === 'object') return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, gehe(v)]));
    return w;
  };
  return gehe(texte) as T;
}

/** IDs aller Faktplatzhalter in einem Wert (Text, Liste, Objekt) */
export function faktIds(w: unknown): string[] {
  if (typeof w === 'string') return [...w.matchAll(FAKT_PLATZHALTER)].map((m) => m[1]!);
  if (Array.isArray(w)) return w.flatMap(faktIds);
  if (w && typeof w === 'object') return Object.values(w).flatMap(faktIds);
  return [];
}
