// Alter des Rechtsstands (src/ai-act/stand.yaml): Sichtungsdaten, Warnung im Werkzeug (AF-117) und Release-Tor (AF-116).
// Reine Funktionen ohne Uhr: «heute» kommt immer von aussen (Tests mit fester Uhr, Tor mit Stichtag).
// Fristen: Release-Tor 30 Tage, Warnung im Werkzeug nach 6 Monaten.

export const TOR_TAGE = 30;
export const WARNUNG_MONATE = 6;

export type RechtsStatus = 'rechtstext' | 'auslegung' | 'zu_pruefen';

export interface RechtsstandQuelle {
  geprueft_am?: string;
  hinweise?: readonly { id: string; status: RechtsStatus | string; geprueft_am?: string }[];
}

export interface Sichtung {
  /** «gesamt» für das Prüfdatum der Datei, sonst die ID des Hinweises */
  id: string;
  datum: string | null;
  zuPruefen: boolean;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function istIsoDatum(s: unknown): s is string {
  if (typeof s !== 'string' || !ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Ganze Tage von a bis b (positiv, wenn b später ist) */
export function tageZwischen(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Datum «heute minus n Monate» (Kalendermonate; der 31. springt auf den Monatsletzten) */
export function minusMonate(heute: string, n: number): string {
  const [j, m, t] = heute.split('-').map(Number) as [number, number, number];
  const ziel = new Date(Date.UTC(j, m - 1 - n, 1));
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0)).getUTCDate();
  ziel.setUTCDate(Math.min(t, letzter));
  return ziel.toISOString().slice(0, 10);
}

/** Alle Sichtungen: das Prüfdatum der Datei und jedes Hinweises mit eigenem Datum oder mit status zu_pruefen */
export function sichtungen(stand: RechtsstandQuelle): Sichtung[] {
  const liste: Sichtung[] = [{ id: 'gesamt', datum: stand.geprueft_am ?? null, zuPruefen: false }];
  for (const h of stand.hinweise ?? []) {
    const zuPruefen = h.status === 'zu_pruefen';
    if (zuPruefen || h.geprueft_am !== undefined) liste.push({ id: h.id, datum: h.geprueft_am ?? null, zuPruefen });
  }
  return liste;
}

export interface RechtsstandWarnung {
  /** Prüfdatum der Datei älter als WARNUNG_MONATE (oder fehlt) */
  alt: boolean;
  geprueft: string | null;
  /** Hinweise mit status zu_pruefen ohne Sichtung oder mit Sichtung älter als WARNUNG_MONATE */
  zuPruefen: string[];
}

/** Warnung im Werkzeug (AF-117): null, wenn der Stand frisch ist und jede offene Angabe frisch gesichtet wurde. */
export function rechtsstandWarnung(stand: RechtsstandQuelle | null | undefined, heute: string, monate: number = WARNUNG_MONATE): RechtsstandWarnung | null {
  if (!stand) return null;
  const grenze = minusMonate(heute, monate);
  const veraltet = (d: string | null) => !istIsoDatum(d) || d < grenze;
  const s = sichtungen(stand);
  const gesamt = s[0]!;
  const alt = veraltet(gesamt.datum);
  const zuPruefen = s.filter((x) => x.zuPruefen && veraltet(x.datum)).map((x) => x.id);
  return alt || zuPruefen.length ? { alt, geprueft: istIsoDatum(gesamt.datum) ? gesamt.datum : null, zuPruefen } : null;
}

export interface TorBefund {
  id: string;
  art: 'fehlt' | 'ungueltig' | 'zukunft' | 'alt';
  meldung: string;
}

/**
 * Release-Tor (AF-116): jedes Prüfdatum höchstens `tage` vor dem Stichtag, kein Datum in der Zukunft, und jeder Hinweis
 * mit status zu_pruefen hat ein eigenes Sichtungsdatum.
 */
export function rechtsstandTor(stand: RechtsstandQuelle, stichtag: string, tage: number = TOR_TAGE): TorBefund[] {
  const befunde: TorBefund[] = [];
  for (const s of sichtungen(stand)) {
    const wer = s.id === 'gesamt' ? 'geprueft_am der Datei' : `Hinweis ${s.id}${s.zuPruefen ? ' (zu_pruefen)' : ''}`;
    if (s.datum === null) {
      befunde.push({ id: s.id, art: 'fehlt', meldung: `${wer}: kein Sichtungsdatum geprueft_am` });
      continue;
    }
    if (!istIsoDatum(s.datum)) {
      befunde.push({ id: s.id, art: 'ungueltig', meldung: `${wer}: geprueft_am «${s.datum}» ist kein Datum JJJJ-MM-TT` });
      continue;
    }
    const alter = tageZwischen(s.datum, stichtag);
    if (alter < 0) befunde.push({ id: s.id, art: 'zukunft', meldung: `${wer}: geprueft_am ${s.datum} liegt nach dem Stichtag ${stichtag}` });
    else if (alter > tage) befunde.push({ id: s.id, art: 'alt', meldung: `${wer}: zuletzt gesichtet am ${s.datum}, ${alter} Tage vor dem Stichtag ${stichtag} (höchstens ${tage})` });
  }
  return befunde;
}
