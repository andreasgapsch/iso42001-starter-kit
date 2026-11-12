// Fortlaufende IDs mit Präfix aus ID_PRAEFIX und Zähler je Liste in meta.idZaehler (AF-010, Schemaversion 2).
// Neue Nummer = grösster Wert aus Zähler und höchster vorhandener Nummer, plus 1. Der Zähler sinkt nie: Eine gelöschte ID
// wird nicht wieder vergeben, alte Verweise können nicht still auf einen neuen Eintrag zeigen.
import { ID_PRAEFIX, type IdZaehler, type Projekt } from '../../model/typen.ts';

export type ListenName = keyof typeof ID_PRAEFIX;

/** Listen mit Zähler in meta.idZaehler: die 16 Listen aus ID_PRAEFIX und die eigenen Prozesse (PE-01) */
export type ZaehlerListe = ListenName | 'eigeneProzesse';
export const ZAEHLER_PRAEFIX: Readonly<Record<ZaehlerListe, string>> = { ...ID_PRAEFIX, eigeneProzesse: 'PE' };

/** Stellen je Präfix: eigene Controls und eigene Prozesse zweistellig (EC-01, PE-01), alle anderen dreistellig. */
const STELLEN: Partial<Record<string, number>> = { EC: 2, PE: 2 };

/** Nummer einer Kennung `<präfix>-<nummer>`, sonst null */
export function nummerVon(praefix: string, id: unknown): number | null {
  if (typeof id !== 'string') return null;
  const m = new RegExp(`^${praefix}-(\\d+)$`).exec(id);
  return m ? Number(m[1]) : null;
}

function hoechste(praefix: string, bestehend: readonly { id?: unknown }[]): number {
  let max = 0;
  for (const e of bestehend) max = Math.max(max, nummerVon(praefix, e.id) ?? 0);
  return max;
}

export function formatiereId(praefix: string, nummer: number): string {
  return `${praefix}-${String(nummer).padStart(STELLEN[praefix] ?? 3, '0')}`;
}

/** Nächste ID über `zaehler` (höchste je vergebene Nummer) und der höchsten vorhandenen Nummer. */
export function naechsteId(praefix: string, bestehend: readonly { id?: unknown }[], zaehler = 0): string {
  return formatiereId(praefix, Math.max(hoechste(praefix, bestehend), zaehler) + 1);
}

/** Zählerstand einer Liste (0, wenn der Zähler fehlt oder ungültig ist) */
export function zaehlerVon(p: Pick<Projekt, 'meta'>, liste: ZaehlerListe): number {
  const n = p.meta.idZaehler?.[liste];
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0;
}

/** Nächste ID der Liste, ohne sie zu vergeben (Anzeige, Vorschau) */
export function naechsteListenId(liste: ListenName, bestehend: readonly { id?: unknown }[], zaehler = 0): string {
  return naechsteId(ID_PRAEFIX[liste], bestehend, zaehler);
}

/** Hebt den Zähler der Liste auf mindestens `nummer`; senkt ihn nie. Arbeitet auf dem übergebenen Entwurf. */
export function zaehlerAnheben(p: Pick<Projekt, 'meta'>, liste: ZaehlerListe, nummer: number): void {
  if (!Number.isInteger(nummer) || nummer <= zaehlerVon(p, liste)) return;
  const z: IdZaehler = { ...(p.meta.idZaehler ?? {}) };
  z[liste] = nummer;
  p.meta.idZaehler = z;
}

/** Hält fest, dass die Kennung `id` in der Liste vergeben ist (z. B. vor dem Löschen oder bei fest vorgegebener ID). */
export function idMerken(p: Pick<Projekt, 'meta'>, liste: ZaehlerListe, id: unknown): void {
  const n = nummerVon(ZAEHLER_PRAEFIX[liste], id);
  if (n !== null) zaehlerAnheben(p, liste, n);
}

/** Vergibt die nächste ID der Liste und zählt den Zähler im Entwurf hoch. */
export function vergibId(p: Projekt, liste: ListenName): string {
  const bestehend = (p[liste] ?? []) as readonly { id?: unknown }[];
  const n = Math.max(hoechste(ID_PRAEFIX[liste], bestehend), zaehlerVon(p, liste)) + 1;
  zaehlerAnheben(p, liste, n);
  return formatiereId(ID_PRAEFIX[liste], n);
}

export function istZaehlerListe(n: string): n is ZaehlerListe {
  return Object.prototype.hasOwnProperty.call(ZAEHLER_PRAEFIX, n);
}

export function istListenName(n: string): n is ListenName {
  return Object.prototype.hasOwnProperty.call(ID_PRAEFIX, n);
}
