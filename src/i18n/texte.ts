// Zugriff auf Sprachtexte. Texte liegen in src/i18n/<sprache>/**/*.yaml und werden
// zu einem verschachtelten Objekt je Sprache zusammengeführt (Dateiname = oberster Schlüssel,
// Unterordner = Pfad, z. B. vorlagen/D-03.yaml -> "vorlagen.D-03").
export type Texte = { [schluessel: string]: string | number | boolean | Texte | Texte[] | string[] };

export class FehlenderText extends Error {}

export interface Uebersetzer {
  sprache: 'de' | 'en';
  /** Text zum Schlüssel; wirft FehlenderText, wenn er fehlt. Platzhalter {name} werden ersetzt. */
  t(schluessel: string, werte?: Record<string, string | number>): string;
  /** Wie t, liefert aber undefined statt Fehler */
  tOpt(schluessel: string, werte?: Record<string, string | number>): string | undefined;
  /** Liste von Texten (YAML-Liste) */
  liste(schluessel: string): string[];
  /** Roh-Objekt unter einem Schlüssel */
  roh(schluessel: string): unknown;
}

export function holePfad(objekt: unknown, schluessel: string): unknown {
  // Schlüssel können Punkte in IDs enthalten (A.5.2). Deshalb gierig von links die längste passende Komponente suchen.
  let aktuell: unknown = objekt;
  let rest = schluessel;
  while (rest.length > 0) {
    if (aktuell === null || typeof aktuell !== 'object') return undefined;
    const teile = rest.split('.');
    let gefunden = false;
    for (let n = teile.length; n >= 1; n--) {
      const kandidat = teile.slice(0, n).join('.');
      if (Object.prototype.hasOwnProperty.call(aktuell, kandidat)) {
        aktuell = (aktuell as Record<string, unknown>)[kandidat];
        rest = teile.slice(n).join('.');
        gefunden = true;
        break;
      }
    }
    if (!gefunden) return undefined;
  }
  return aktuell;
}

export function ersetze(text: string, werte?: Record<string, string | number>): string {
  if (!werte) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in werte ? String(werte[name]) : m));
}

export function erstelleUebersetzer(sprache: 'de' | 'en', texte: Texte): Uebersetzer {
  const tOpt = (schluessel: string, werte?: Record<string, string | number>) => {
    // Einzahl (A-07): bei anzahl = 1 gilt <schluessel>_eins, falls vorhanden («1 Monat» statt «1 Monate»)
    const eins = werte?.['anzahl'] === 1 ? holePfad(texte, `${schluessel}_eins`) : undefined;
    const wert = typeof eins === 'string' ? eins : holePfad(texte, schluessel);
    if (typeof wert === 'string') return ersetze(wert.trimEnd(), werte);
    if (typeof wert === 'number') return String(wert);
    return undefined;
  };
  return {
    sprache,
    tOpt,
    t(schluessel, werte) {
      const wert = tOpt(schluessel, werte);
      if (wert === undefined) throw new FehlenderText(`Text fehlt (${sprache}): ${schluessel}`);
      return wert;
    },
    liste(schluessel) {
      const wert = holePfad(texte, schluessel);
      if (!Array.isArray(wert)) throw new FehlenderText(`Liste fehlt (${sprache}): ${schluessel}`);
      return wert.map(String);
    },
    roh(schluessel) {
      return holePfad(texte, schluessel);
    },
  };
}
