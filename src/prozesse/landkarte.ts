// Prozesslandkarte aus dem Katalog (Plan Prozesse 8.3): Gruppen als Zeilen mit Kopf links, Prozesse als Formen zu je
// vier in einer Zeile. Ersetzt die festen Positionen der früheren Landkarte in D-02; die Zahl der Prozesse ist frei.
// Gleiches Raster für D-02 (DOCX-Formen) und die erste Seite des draw.io-Exports.
import type { AblaufBlock, AblaufKnoten, Farbrolle } from '../generator/ir.ts';
import type { ProzessGruppe } from './typen.ts';

export interface LandkartenEintrag {
  id: string;
  gruppe: ProzessGruppe;
  /** Text der Form, z. B. «PR-08 KI-Risiken beurteilen» und eine zweite Zeile */
  text: string;
  rolle?: Farbrolle;
}

/**
 * Feste Farbrollen je Reifestufe 0 bis 4 (Design System, nie CI-Farben): nicht begonnen leer, definiert Info,
 * eingeführt Warnung, wirksam gut, überprüft gut kräftig. Die Stufe steht immer auch als Wort in der Form.
 */
export const REIFE_ROLLE: readonly Farbrolle[] = ['leer', 'status-info', 'status-warnung', 'status-gut', 'status-gut-stark'];

/**
 * Reihenfolge der Gruppen in der Landkarte (D-02, D-21, draw.io): der Regelkreis Führung, Kernprozesse, Bewertung und
 * Verbesserung untereinander, darunter die Unterstützung, die alle trägt
 */
export const GRUPPEN: readonly ProzessGruppe[] = ['fuehrung', 'kern', 'bewertung', 'unterstuetzung'];
export const JE_ZEILE = 4;

/**
 * Wechselwirkungen der Gruppen als Pfeile zwischen den Gruppenköpfen: Führung steuert die Kernprozesse, deren Ergebnisse
 * gehen in Bewertung und Verbesserung, die Verbesserungen zurück an die Führung; die Unterstützung trägt den Regelkreis.
 */
export const WECHSELWIRKUNGEN: readonly { von: ProzessGruppe; nach: ProzessGruppe; vonSeite: 'top' | 'bottom' | 'left'; nachSeite: 'top' | 'bottom' | 'left' }[] = [
  { von: 'fuehrung', nach: 'kern', vonSeite: 'bottom', nachSeite: 'top' },
  { von: 'kern', nach: 'bewertung', vonSeite: 'bottom', nachSeite: 'top' },
  { von: 'bewertung', nach: 'fuehrung', vonSeite: 'left', nachSeite: 'left' },
  { von: 'unterstuetzung', nach: 'bewertung', vonSeite: 'top', nachSeite: 'bottom' },
];

/**
 * Raster der Landkarte: Spalte 0 Gruppenkopf (über alle Zeilen der Gruppe), Spalten 1 bis 4 Prozesse. Mit
 * wechselwirkungen: schmale Spalte links für den Rückweg und Pfeile zwischen den Gruppen (WECHSELWIRKUNGEN).
 */
export function landkarteBlock(
  eintraege: readonly LandkartenEintrag[],
  gruppenText: (g: ProzessGruppe) => string,
  alt: { titel: string; beschreibung: string },
  o: { wechselwirkungen?: boolean } = {},
): AblaufBlock {
  const knoten: AblaufKnoten[] = [];
  const rand = o.wechselwirkungen ? 1 : 0;
  let zeile = 0;
  for (const g of GRUPPEN) {
    const liste = eintraege.filter((e) => e.gruppe === g);
    if (!liste.length) continue;
    const zeilen = Math.ceil(liste.length / JE_ZEILE);
    knoten.push({ id: `gruppe-${g}`, form: 'schritt', text: gruppenText(g), spalte: rand, zeile, ...(zeilen > 1 ? { hoehe: zeilen } : {}), rolle: 'kopf' });
    liste.forEach((e, i) => {
      knoten.push({ id: e.id, form: 'schritt', text: e.text, spalte: rand + 1 + (i % JE_ZEILE), zeile: zeile + Math.floor(i / JE_ZEILE), rolle: e.rolle ?? 'status-info' });
    });
    zeile += zeilen;
  }
  const da = new Set(knoten.map((k) => k.id));
  const kanten = o.wechselwirkungen
    ? WECHSELWIRKUNGEN.filter((w) => da.has(`gruppe-${w.von}`) && da.has(`gruppe-${w.nach}`)).map((w) => ({
        von: `gruppe-${w.von}`,
        vonSeite: w.vonSeite,
        nach: `gruppe-${w.nach}`,
        nachSeite: w.nachSeite,
        ...(w.vonSeite === w.nachSeite ? { weg: 'winkel' as const } : {}),
      }))
    : [];
  return {
    typ: 'ablauf',
    spalten: rand + 1 + JE_ZEILE,
    zeilen: Math.max(1, zeile),
    zeilenHoehe: 64,
    spaltenGewichte: rand ? [0.22, 0.8, 1, 1, 1, 1] : [0.8, 1, 1, 1, 1],
    schriftgroesse: 6.5,
    knoten,
    kanten,
    alt,
  };
}
