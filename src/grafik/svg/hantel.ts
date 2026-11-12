// Hantel Ist/Ziel als SVG-Szene (NIST AI RMF Profil je Funktion): Ist als voller Knoten, Ziel als Ring, die Lücke als
// Leitung dazwischen. Kein Radar (bei vier Achsen verzerrt die Fläche). Werte stehen zusätzlich als Text rechts.
import { el, kuerze, rund, svgWurzel, textBreite, type Knoten } from './szene.ts';

export interface HantelZeile {
  titel: string;
  ist: number | null;
  ziel: number | null;
}

export interface HantelTexte {
  titel: string;
  beschreibung: string;
  /** Beschriftung der Skalenstufen, Index = Stufe (z. B. 0 bis 3) */
  stufen: readonly string[];
  /** Text rechts je Zeile, z. B. «Ist 1,5 · Ziel 2,3» */
  wert: (z: HantelZeile) => string;
}

export function hantelSzene(zeilen: readonly HantelZeile[], t: HantelTexte, o: { id: string; breite?: number; min?: number; max?: number; titelSichtbar?: boolean }): Knoten {
  const breite = o.breite ?? 640;
  const min = o.min ?? 0;
  const max = o.max ?? Math.max(1, t.stufen.length - 1);
  const links = Math.min(190, Math.max(70, ...zeilen.map((z) => textBreite(z.titel, 12) + 14)));
  const rechts = Math.max(110, ...zeilen.map((z) => textBreite(t.wert(z), 11) + 12));
  const plot = breite - links - rechts - 12;
  const x = (w: number) => links + 6 + ((w - min) / (max - min || 1)) * plot;
  const kopf = o.titelSichtbar === false ? 0 : 30;
  const oben = kopf + 20;
  const zh = 30;
  const unten = oben + zeilen.length * zh;
  const kinder: Knoten[] = kopf ? [el('text', { class: 'g-text-tinte', x: 0, y: 16, 'font-size': 14 }, t.titel)] : [];
  for (let s = min; s <= max; s++) {
    const xs = rund(x(s));
    kinder.push(el('line', { class: 'g-raster', x1: xs, x2: xs, y1: oben - 6, y2: unten }));
    const name = t.stufen[s] ?? String(s);
    kinder.push(el('text', { class: 'g-text-gedaempft', x: xs, y: oben - 12, 'text-anchor': 'middle', 'font-size': 11 }, kuerze(`${s} ${name}`, plot / (max - min + 1), 11)));
  }
  zeilen.forEach((z, i) => {
    const y = oben + i * zh + zh / 2;
    kinder.push(el('text', { class: 'g-text-tinte', x: 0, y: y + 4 }, kuerze(z.titel, links - 10)));
    if (z.ist !== null && z.ziel !== null && z.ist !== z.ziel) {
      kinder.push(el('line', { class: z.ziel > z.ist ? 'g-hantel' : 'g-hantel g-hantel--ueber', x1: rund(x(z.ist)), x2: rund(x(z.ziel)), y1: y, y2: y }));
    }
    if (z.ziel !== null) kinder.push(el('circle', { class: 'g-knoten-ziel', cx: rund(x(z.ziel)), cy: y, r: 7, 'data-wert': 'ziel' }));
    if (z.ist !== null) kinder.push(el('circle', { class: 'g-knoten-voll', cx: rund(x(z.ist)), cy: y, r: 6, 'data-wert': 'ist' }));
    kinder.push(el('text', { class: 'g-text-gedaempft', x: breite, y: y + 4, 'text-anchor': 'end', 'font-size': 11 }, t.wert(z)));
  });
  return svgWurzel(o.id, breite, unten + 6, t.titel, t.beschreibung, 'g-svg--hantel', kinder);
}
