// Risikomatrix als SVG-Szene (Leitfaden, START, PNG): Spalten Wahrscheinlichkeit aufsteigend, Zeilen Auswirkung absteigend,
// jede Zelle mit Wert W×A und Anzahl Risiken, Stufe als Fläche (risiko-*), die höchste Stufe zusätzlich schraffiert,
// Legende mit Wort. Die App zeigt die Matrix als HTML-Tabelle (src/grafik/preact/Risikomatrix.tsx) mit denselben Daten.
import type { MatrixZelle, RisikoMatrix, Risikostufe } from '../daten.ts';
import { schraffur } from './formen.ts';
import { el, kuerze, rund, svgWurzel, type Knoten } from './szene.ts';

export interface MatrixTexte {
  titel: string;
  /** Achsentitel, z. B. «Wahrscheinlichkeit (pro Jahr)» */
  achseW: string;
  achseA: string;
  /** Kürzel vor der Stufe, z. B. «W» und «A» */
  kurzW: string;
  kurzA: string;
  /** Bezeichnungen der Stufen, z. B. { 1: 'selten' } */
  namenW?: Record<number, string>;
  namenA?: Record<number, string>;
  /** Legende je Stufe, z. B. «tief, bis 4 (akzeptiert)» */
  legende: Record<Risikostufe, string>;
  /** Stufenwort für die Beschreibung */
  stufe: Record<Risikostufe, string>;
  /** Beschreibung (desc) der ganzen Matrix */
  beschreibung: string;
}

export interface MatrixSzeneOptionen {
  /** ID-Präfix (title, desc) */
  id: string;
  /** Kantenlänge einer Zelle in px */
  zelle?: number;
  /** Anzahl zeigen (false: nur Zonen, z. B. Methode in D-06) */
  mitAnzahl?: boolean;
  /** Titel in der Zeichnung (false: die Seite zeigt ihn als Bildtitel; er bleibt in <title>) */
  titelSichtbar?: boolean;
  /** Beispiel: ein Risiko vor (voller Knoten) und nach Behandlung (Ring), verbunden mit Pfeil; Beschriftung unter den Knoten */
  pfeil?: { von: { w: number; a: number; text: string }; nach: { w: number; a: number; text: string } };
}

/** Zeilen für die Darstellung: Auswirkung absteigend, darin Wahrscheinlichkeit aufsteigend. */
export function matrixZeilen(m: RisikoMatrix): MatrixZelle[][] {
  return [...m.a].reverse().map((a) => m.w.map((w) => m.zellen[m.w.indexOf(w)]![m.a.indexOf(a)]!));
}

export function risikomatrixSzene(m: RisikoMatrix, t: MatrixTexte, o: MatrixSzeneOptionen): Knoten {
  const s = o.zelle ?? 56;
  const luecke = 3;
  const links = 96;
  const oben = (o.titelSichtbar === false ? 0 : 26) + 30;
  const nW = m.w.length;
  const nA = m.a.length;
  const breite = links + nW * (s + luecke) + 8;
  const rasterHoehe = nA * (s + luecke);
  const legendeY = oben + rasterHoehe + 40;
  const hoehe = legendeY + 3 * 20 + 6;
  const kinder: Knoten[] = [];
  if (o.titelSichtbar !== false) kinder.push(el('text', { class: 'g-text-tinte', x: 0, y: 16, 'font-size': 14 }, t.titel));
  // Spaltenköpfe
  m.w.forEach((w, i) => {
    const x = links + i * (s + luecke) + s / 2;
    kinder.push(el('text', { class: 'g-text-gedaempft', x: rund(x), y: oben - 16, 'text-anchor': 'middle', 'font-weight': 600 }, `${t.kurzW} ${w}`));
    const name = t.namenW?.[w];
    if (name) kinder.push(el('text', { class: 'g-text-gedaempft', x: rund(x), y: oben - 4, 'text-anchor': 'middle', 'font-size': 10 }, kuerze(name, s, 10)));
  });
  matrixZeilen(m).forEach((zeile, r) => {
    const y = oben + r * (s + luecke);
    const a = zeile[0]!.a;
    kinder.push(el('text', { class: 'g-text-gedaempft', x: links - 8, y: rund(y + s / 2 - 2), 'text-anchor': 'end', 'font-weight': 600 }, `${t.kurzA} ${a}`));
    const name = t.namenA?.[a];
    if (name) kinder.push(el('text', { class: 'g-text-gedaempft', x: links - 8, y: rund(y + s / 2 + 11), 'text-anchor': 'end', 'font-size': 10 }, kuerze(name, links - 12, 10)));
    zeile.forEach((z, i) => {
      const x = links + i * (s + luecke);
      const teile: Knoten[] = [el('rect', { class: `g-stufe-${z.stufe}`, x, y, width: s, height: s, rx: 6 })];
      if (z.stufe === 'hoch') teile.push(el('g', { 'aria-hidden': 'true' }, ...schraffur(x + 1, y + 1, s - 2, s - 2, 9)));
      teile.push(el('text', { class: z.stufe === 'hoch' ? 'g-text-auf-hoch' : 'g-text-tinte', x: x + 6, y: y + 15, 'font-size': 11 }, String(z.wert)));
      if (o.mitAnzahl !== false && z.anzahl > 0) {
        teile.push(el('text', { class: z.stufe === 'hoch' ? 'g-text-auf-hoch' : 'g-text-tinte', x: x + s - 7, y: y + s - 9, 'text-anchor': 'end', 'font-size': 20, 'font-weight': 820 }, String(z.anzahl)));
      }
      kinder.push(el('g', { 'data-w': z.w, 'data-a': z.a }, ...teile));
    });
  });
  if (o.pfeil) kinder.push(...matrixPfeil(m, o.pfeil, (w, a) => ({ x: links + m.w.indexOf(w) * (s + luecke) + s / 2, y: oben + (nA - 1 - m.a.indexOf(a)) * (s + luecke) + s / 2 })));
  // Achsentitel
  kinder.push(el('text', { class: 'g-text-gedaempft', x: rund(links + (nW * (s + luecke)) / 2), y: oben + rasterHoehe + 16, 'text-anchor': 'middle', 'font-weight': 600 }, `${t.achseW} →`));
  kinder.push(el('text', { class: 'g-text-gedaempft', x: 12, y: rund(oben + rasterHoehe / 2), 'text-anchor': 'middle', 'font-weight': 600, transform: `rotate(-90 12 ${rund(oben + rasterHoehe / 2)})` }, `${t.achseA} →`));
  // Legende mit Wort und Fläche, die höchste Stufe schraffiert
  (['tief', 'mittel', 'hoch'] as const).forEach((st, i) => {
    const y = legendeY + i * 20;
    kinder.push(el('rect', { class: `g-stufe-${st}`, x: 0, y: y - 10, width: 18, height: 13, rx: 3 }));
    if (st === 'hoch') kinder.push(el('g', { 'aria-hidden': 'true' }, ...schraffur(0.5, y - 9.5, 17, 12, 6)));
    kinder.push(el('text', { x: 26, y }, t.legende[st]));
  });
  return svgWurzel(o.id, breite, hoehe, t.titel, t.beschreibung, 'g-svg--matrix', kinder);
}

/** Beispielrisiko vor und nach Behandlung: Leitung mit Spitze zwischen den Zellmitten, Knoten mit Beschriftung. */
function matrixPfeil(m: RisikoMatrix, p: NonNullable<MatrixSzeneOptionen['pfeil']>, mitte: (w: number, a: number) => { x: number; y: number }): Knoten[] {
  if (!m.w.includes(p.von.w) || !m.a.includes(p.von.a) || !m.w.includes(p.nach.w) || !m.a.includes(p.nach.a)) throw new Error('Risikomatrix: Pfeil ausserhalb der Skalen');
  const v = mitte(p.von.w, p.von.a);
  const n = mitte(p.nach.w, p.nach.a);
  const laenge = Math.hypot(n.x - v.x, n.y - v.y) || 1;
  const ux = (n.x - v.x) / laenge;
  const uy = (n.y - v.y) / laenge;
  // Leitung endet vor dem Ring (Radius 8), Spitze 7 lang
  const ex = n.x - ux * 10;
  const ey = n.y - uy * 10;
  const spitze = `M${rund(ex)} ${rund(ey)}L${rund(ex - ux * 7 - uy * 4)} ${rund(ey - uy * 7 + ux * 4)}L${rund(ex - ux * 7 + uy * 4)} ${rund(ey - uy * 7 - ux * 4)}Z`;
  return [
    el(
      'g',
      { class: 'g-matrix-pfeil' },
      el('line', { class: 'g-leitung-aktiv', x1: rund(v.x + ux * 8), y1: rund(v.y + uy * 8), x2: rund(ex - ux * 6), y2: rund(ey - uy * 6) }),
      el('path', { class: 'g-pfeil-aktiv', d: spitze }),
      el('circle', { class: 'g-knoten-voll', cx: rund(v.x), cy: rund(v.y), r: 7 }),
      el('circle', { class: 'g-knoten-ziel', cx: rund(n.x), cy: rund(n.y), r: 8 }),
      el('text', { class: 'g-text-tinte', x: rund(v.x), y: rund(v.y + 21), 'text-anchor': 'middle', 'font-size': 10 }, p.von.text),
      el('text', { class: 'g-text-tinte', x: rund(n.x), y: rund(n.y + 22), 'text-anchor': 'middle', 'font-size': 10 }, p.nach.text),
    ),
  ];
}

/** Beschreibung (desc) aus den Daten: Summe, je Stufe, belegte Zellen. */
export function matrixBeschreibung(m: RisikoMatrix, t: Pick<MatrixTexte, 'kurzW' | 'kurzA' | 'stufe'>, worte: { bewertet: (n: number) => string; zelle: (w: number, a: number, wert: number, stufe: string, n: number) => string; keine: string }): string {
  const teile = [worte.bewertet(m.bewertet), (['tief', 'mittel', 'hoch'] as const).map((s) => `${t.stufe[s]} ${m.jeStufe[s]}`).join(', ')];
  const belegt = m.zellen.flat().filter((z) => z.anzahl > 0).sort((x, y) => y.wert - x.wert || x.w - y.w);
  teile.push(belegt.length ? belegt.map((z) => worte.zelle(z.w, z.a, z.wert, t.stufe[z.stufe], z.anzahl)).join('; ') : worte.keine);
  return `${teile.join('. ')}.`;
}
