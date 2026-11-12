// Etappenleiste als SVG-Szene (Motiv Knoten und Leitung, START und Leitfaden): Leitung in linie-stark, erledigte Strecke
// 2px in blau, erledigt voller Knoten, aktuell grosser Knoten, offen hohler Knoten. Der Zustand steht auch in desc.
import { el, kuerze, rund, svgWurzel, type Knoten } from './szene.ts';
import type { Zustand } from './zeitleiste.ts';

export interface EtappenSchritt {
  kuerzel: string;
  titel: string;
  zustand: Zustand;
}

export function etappenSzene(schritte: readonly EtappenSchritt[], t: { titel: string; beschreibung: string }, o: { id: string; breite?: number }): Knoten {
  const breite = o.breite ?? 860;
  const n = Math.max(1, schritte.length);
  const abstand = (breite - 20) / n;
  const y = 30;
  const x = (i: number) => 10 + i * abstand;
  const kinder: Knoten[] = [el('line', { class: 'g-leitung', x1: 0, x2: breite, y1: y, y2: y })];
  // Erledigte Strecke: vom ersten Knoten bis zum letzten erledigten bzw. bis zum aktuellen
  let bis = -1;
  schritte.forEach((s, i) => {
    if (s.zustand === 'erledigt') bis = i + 1;
    if (s.zustand === 'aktiv') bis = Math.max(bis, i);
  });
  if (bis > 0) kinder.push(el('line', { class: 'g-leitung-aktiv', x1: x(0), x2: rund(x(Math.min(bis, n - 1))), y1: y, y2: y }));
  schritte.forEach((s, i) => {
    const xi = rund(x(i));
    kinder.push(el('circle', { class: s.zustand === 'offen' ? 'g-knoten-hohl' : 'g-knoten-voll', cx: xi, cy: y, r: s.zustand === 'aktiv' ? 7 : 4.5, 'data-zustand': s.zustand }));
    kinder.push(el('text', { class: 'g-text-gedaempft', x: xi, y: y + 22, 'font-size': 11, 'font-weight': 650 }, s.kuerzel));
    kinder.push(el('text', { class: s.zustand === 'offen' ? undefined : 'g-text-tinte', x: xi, y: y + 37, 'font-size': 11 }, kuerze(s.titel, abstand - 8, 11)));
  });
  return svgWurzel(o.id, breite, y + 46, t.titel, t.beschreibung, 'g-svg--etappen', kinder);
}
