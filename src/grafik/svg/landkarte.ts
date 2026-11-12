// Landkarte als SVG-Szene (Regelwerke im Leitfaden Kapitel 7): Felder aus zwei Merkmalen (Spalten, Zeilen) statt einer
// Rangfolge, in jedem Feld Kacheln. Ein voller Knoten heisst «markiert» (z. B. im Kit abgebildet), ein hohler «nicht»;
// die Legende nennt beides als Wort. Keine Pyramide und keine Pfeile zwischen den Kacheln: Die Felder stehen nebeneinander.
import { ablaufZeilen } from './ablauf.ts';
import { el, rund, svgWurzel, type Knoten } from './szene.ts';

export interface LandkarteEintrag {
  titel: string;
  /** Feld: Spalte und Zeile, 0-basiert */
  spalte: number;
  zeile: number;
  markiert: boolean;
}

export interface LandkarteTexte {
  titel: string;
  beschreibung: string;
  spalten: readonly string[];
  zeilen: readonly string[];
  /** Achsentitel über den Spalten, z. B. «verbindlich → freiwillig» */
  achse: string;
  markiert: string;
  offen: string;
}

export function landkarteSzene(eintraege: readonly LandkarteEintrag[], t: LandkarteTexte, o: { id: string; breite?: number; kopf?: number; spaltenGewichte?: readonly number[]; kachel?: number }): Knoten {
  const breite = o.breite ?? 760;
  const kopf = o.kopf ?? 120;
  const nS = t.spalten.length;
  const nZ = t.zeilen.length;
  const gewichte = Array.from({ length: nS }, (_, i) => o.spaltenGewichte?.[i] ?? 1);
  const einheit = (breite - kopf) / gewichte.reduce((x, y) => x + y, 0);
  const sx = (i: number) => kopf + gewichte.slice(0, i).reduce((x, y) => x + y, 0) * einheit;
  const sb = (i: number) => gewichte[i]! * einheit;
  const innen = 8;
  const kb = o.kachel ?? 168;
  const kh = 34;
  const proZeile = (i: number) => Math.max(1, Math.floor((sb(i) - 2 * innen + 6) / (kb + 6)));
  for (const e of eintraege) if (e.spalte < 0 || e.spalte >= nS || e.zeile < 0 || e.zeile >= nZ) throw new Error(`Landkarte: ${e.titel} ausserhalb der Felder`);
  // Höhe je Zeile aus der vollsten Zelle
  const zeilenHoehe = t.zeilen.map((_, z) => {
    const linien = Math.max(1, ...t.spalten.map((_, s) => Math.ceil(eintraege.filter((e) => e.spalte === s && e.zeile === z).length / proZeile(s))));
    return linien * (kh + 6) - 6 + 2 * innen;
  });
  const oben = 46;
  const zy = (z: number) => oben + zeilenHoehe.slice(0, z).reduce((x, y) => x + y + 4, 0);
  const kinder: Knoten[] = [];
  // Achse und Spaltenköpfe
  kinder.push(el('text', { class: 'g-text-gedaempft', x: kopf + 4, y: 12, 'font-size': 11, 'font-weight': 650 }, t.achse));
  kinder.push(el('line', { class: 'g-leitung', x1: kopf + 4, x2: breite - 4, y1: 18, y2: 18 }));
  t.spalten.forEach((s, i) => {
    kinder.push(el('circle', { class: 'g-knoten-hohl', cx: rund(sx(i) + 8), cy: 18, r: 3.5 }));
    kinder.push(el('text', { class: 'g-text-tinte', x: rund(sx(i) + 4), y: 36, 'font-size': 11.5 }, s));
  });
  t.zeilen.forEach((z, zi) => {
    const y = zy(zi);
    const h = zeilenHoehe[zi]!;
    const zeilen = ablaufZeilen(z, kopf - 14, 11.5);
    kinder.push(
      el(
        'text',
        { class: 'g-text-tinte', x: 0, y: rund(y + h / 2 - ((zeilen.length - 1) * 14) / 2 + 4), 'font-size': 11.5 },
        ...zeilen.map((x, i) => el('tspan', { x: 0, dy: i ? 14 : undefined }, x)),
      ),
    );
    t.spalten.forEach((_, si) => {
      kinder.push(el('rect', { class: 'g-feld', x: rund(sx(si) + 2), y: rund(y), width: rund(sb(si) - 4), height: rund(h), rx: 8 }));
      eintraege
        .filter((e) => e.spalte === si && e.zeile === zi)
        .forEach((e, n) => {
          const kx = sx(si) + innen + (n % proZeile(si)) * (kb + 6);
          const ky = y + innen + Math.floor(n / proZeile(si)) * (kh + 6);
          const b = Math.min(kb, sb(si) - 2 * innen);
          const textZeilen = ablaufZeilen(e.titel, b - 26, 10.5).slice(0, 2);
          kinder.push(
            el(
              'g',
              { 'data-eintrag': e.titel, 'data-markiert': e.markiert ? 'ja' : 'nein' },
              el('rect', { class: 'g-ablauf-knoten', x: rund(kx), y: rund(ky), width: rund(b), height: kh, rx: 6 }),
              el('circle', { class: e.markiert ? 'g-knoten-voll' : 'g-knoten-hohl', cx: rund(kx + 11), cy: rund(ky + kh / 2), r: e.markiert ? 5 : 4 }),
              el(
                'text',
                { class: 'g-text-tinte', x: rund(kx + 22), y: rund(ky + kh / 2 - ((textZeilen.length - 1) * 12.5) / 2 + 3.7), 'font-size': 10.5 },
                ...textZeilen.map((x, i) => el('tspan', { x: rund(kx + 22), dy: i ? 12.5 : undefined }, x)),
              ),
            ),
          );
        });
    });
  });
  const unten = zy(nZ) + 14;
  kinder.push(el('circle', { class: 'g-knoten-voll', cx: 6, cy: unten, r: 5 }));
  kinder.push(el('text', { class: 'g-text-gedaempft', x: 16, y: unten + 4, 'font-size': 11 }, t.markiert));
  const x2 = 16 + Math.max(120, t.markiert.length * 6.2) + 24;
  kinder.push(el('circle', { class: 'g-knoten-hohl', cx: rund(x2), cy: unten, r: 4 }));
  kinder.push(el('text', { class: 'g-text-gedaempft', x: rund(x2 + 10), y: unten + 4, 'font-size': 11 }, t.offen));
  return svgWurzel(o.id, breite, unten + 10, t.titel, t.beschreibung, 'g-svg--landkarte', kinder);
}
