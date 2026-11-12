// Sparkline als SVG-Szene (Kennzahl): Verlauf ohne Achsen, Grundlinie gestrichelt, letzter Wert als Knoten, optional
// Sollwert als gestrichelte Linie. Das aria-label nennt alle Werte (Textalternative).
import { el, rund, type Knoten } from './szene.ts';

export interface SparklineOptionen {
  breite?: number;
  hoehe?: number;
  /** Sollwert als Linie (liegt er ausserhalb, wird der Bereich erweitert) */
  soll?: number;
}

export function sparklinePunkte(werte: readonly number[], o: SparklineOptionen = {}): { x: number; y: number }[] {
  const bx = o.breite ?? 120;
  const by = o.hoehe ?? 36;
  const rand = 4;
  const alle = o.soll === undefined ? werte : [...werte, o.soll];
  const min = Math.min(...alle);
  const max = Math.max(...alle);
  const spanne = max - min || 1;
  return werte.map((w, i) => ({
    x: rund(rand + (werte.length > 1 ? (i * (bx - 2 * rand)) / (werte.length - 1) : (bx - 2 * rand) / 2)),
    y: rund(by - rand - ((w - min) * (by - 2 * rand)) / spanne),
  }));
}

/** Szene; null bei weniger als zwei Werten. beschriftung: vollständiger Text mit allen Werten. */
export function sparklineSzene(werte: readonly number[], beschriftung: string, o: SparklineOptionen = {}): Knoten | null {
  if (werte.length < 2) return null;
  const bx = o.breite ?? 120;
  const by = o.hoehe ?? 36;
  const p = sparklinePunkte(werte, o);
  const letzter = p[p.length - 1]!;
  const kinder: Knoten[] = [el('line', { class: 'g-sparkline__grund', x1: 0, x2: bx, y1: by - 0.5, y2: by - 0.5 })];
  if (o.soll !== undefined) {
    const ys = sparklinePunkte([...werte, o.soll], { ...o, soll: undefined }).at(-1)!.y;
    kinder.push(el('line', { class: 'g-sparkline__grund g-sparkline__soll', x1: 0, x2: bx, y1: ys, y2: ys }));
  }
  kinder.push(el('polyline', { class: 'g-sparkline__linie', points: p.map((q) => `${q.x},${q.y}`).join(' ') }));
  kinder.push(el('circle', { class: 'g-sparkline__knoten', cx: letzter.x, cy: letzter.y, r: 3.5 }));
  return el('svg', { class: 'g-sparkline', viewBox: `0 0 ${bx} ${by}`, width: bx, height: by, preserveAspectRatio: 'none', role: 'img', 'aria-label': beschriftung, focusable: 'false' }, ...kinder);
}
