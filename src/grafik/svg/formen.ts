// Kleine Bausteine für Szenen: Schraffur ohne <pattern> (keine IDs, keine fill-URLs), Statusformen, Knoten.
import { el, rund, type Knoten } from './szene.ts';

/**
 * Schraffur als Linien x + y = c, auf das Rechteck geschnitten (gleiche Richtung wie das Muster in stil.css).
 * Ohne <pattern>: keine IDs nötig, und fill-Attribute bleiben frei von url().
 */
export function schraffur(x: number, y: number, b: number, h: number, abstand = 8, klasse = 'g-muster-strich'): Knoten[] {
  const linien: Knoten[] = [];
  for (let c = abstand; c < b + h; c += abstand) {
    const x1 = Math.max(0, c - h);
    const y1 = Math.min(c, h);
    const x2 = Math.min(c, b);
    const y2 = Math.max(0, c - b);
    linien.push(el('line', { class: klasse, x1: rund(x + x1), y1: rund(y + y1), x2: rund(x + x2), y2: rund(y + y2) }));
  }
  return linien;
}

export type Statusform = 'gut' | 'warnung' | 'kritisch' | 'neutral' | 'info';

/** Statusform 12×12 (Kreis, Dreieck, Raute, hohler Kreis) mit Mittelpunkt cx, cy. */
export function statusForm(form: Statusform, cx: number, cy: number, klasse: string, r = 6): Knoten {
  switch (form) {
    case 'warnung':
      return el('path', { class: klasse, d: `M${rund(cx)} ${rund(cy - r)}L${rund(cx + r)} ${rund(cy + r * 0.85)}H${rund(cx - r)}Z` });
    case 'kritisch':
      return el('path', { class: klasse, d: `M${rund(cx)} ${rund(cy - r)}L${rund(cx + r)} ${rund(cy)}L${rund(cx)} ${rund(cy + r)}L${rund(cx - r)} ${rund(cy)}Z` });
    case 'neutral':
      return el('circle', { class: `${klasse} g-hohl`, cx: rund(cx), cy: rund(cy), r: rund(r * 0.8) });
    default:
      return el('circle', { class: klasse, cx: rund(cx), cy: rund(cy), r: rund(r) });
  }
}

/** Raute (Meilenstein) oder Quadrat auf der Spitze. */
export function raute(cx: number, cy: number, r: number, klasse: string): Knoten {
  return el('path', { class: klasse, d: `M${rund(cx)} ${rund(cy - r)}L${rund(cx + r)} ${rund(cy)}L${rund(cx)} ${rund(cy + r)}L${rund(cx - r)} ${rund(cy)}Z` });
}

export type FortschrittsZustand = 'erledigt' | 'teilweise' | 'offen' | 'unvollstaendig' | 'spaeter';

/**
 * Knoten mit Fortschritt (Etappenleiste, Seitenpunkte, Überblick), Mittelpunkt cx, cy, Radius r. Die Form trägt den
 * Zustand, nicht nur die Farbe: erledigt Kreis mit Haken (status-gut), teilweise Teilkreis (Sektor nach Anteil, 15 bis
 * 85 % sichtbar) in blau, unvollständig Dreieck (status-warnung), später gestrichelter Kreis, offen hohler Kreis.
 */
export function fortschrittsKnoten(zustand: FortschrittsZustand, cx: number, cy: number, r: number, anteil = 0.5): Knoten[] {
  const x = rund(cx);
  const y = rund(cy);
  switch (zustand) {
    case 'erledigt':
      return [
        el('circle', { class: 'g-knoten-gut', cx: x, cy: y, r: rund(r) }),
        el('path', { class: 'g-haken', d: `M${rund(cx - r * 0.48)} ${rund(cy + r * 0.02)}L${rund(cx - r * 0.12)} ${rund(cy + r * 0.38)}L${rund(cx + r * 0.5)} ${rund(cy - r * 0.36)}` }),
      ];
    case 'teilweise': {
      const a = Math.min(0.85, Math.max(0.15, anteil));
      const ri = r - 1;
      const winkel = a * 2 * Math.PI;
      const ex = cx + ri * Math.sin(winkel);
      const ey = cy - ri * Math.cos(winkel);
      return [
        el('circle', { class: 'g-knoten-teil', cx: x, cy: y, r: rund(r - 0.75) }),
        el('path', { class: 'g-knoten-sektor', d: `M${x} ${y}V${rund(cy - ri)}A${rund(ri)} ${rund(ri)} 0 ${a > 0.5 ? 1 : 0} 1 ${rund(ex)} ${rund(ey)}Z` }),
      ];
    }
    case 'unvollstaendig':
      return [el('path', { class: 'g-knoten-warnung', d: `M${x} ${rund(cy - r)}L${rund(cx + r)} ${rund(cy + r * 0.8)}H${rund(cx - r)}Z` })];
    case 'spaeter':
      return [el('circle', { class: 'g-knoten-spaeter', cx: x, cy: y, r: rund(r - 0.75) })];
    default:
      return [el('circle', { class: 'g-knoten-offen', cx: x, cy: y, r: rund(r - 0.75) })];
  }
}
