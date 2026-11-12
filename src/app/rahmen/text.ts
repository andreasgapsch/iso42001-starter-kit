// Texte des Rahmens (src/i18n/<sprache>/rahmen.yaml, Schlüssel rahmen.*). Rückfall wie t(): Deutsch, dann der Schlüssel.
import { inhalt } from '../i18n.ts';

/** Uhrzeit (HH:MM, Ortszeit) eines ISO-Zeitpunkts; leer, wenn er sich nicht lesen lässt */
export function uhrzeitText(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const z = (n: number) => String(n).padStart(2, '0');
  return `${z(d.getHours())}:${z(d.getMinutes())}`;
}

export function tr(schluessel: string, werte?: Record<string, string | number>): string {
  const eins = werte?.['anzahl'] === 1 ? inhalt(`rahmen.${schluessel}_eins`, werte) : undefined;
  return eins ?? inhalt(`rahmen.${schluessel}`, werte) ?? schluessel;
}
