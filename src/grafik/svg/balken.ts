// Gestapelte Balken als SVG-Szene: je Zeile Anteile, die zusammen ein Ganzes ergeben (z. B. SoA je Gruppe A.2 bis A.10).
// Segmente in g-ton-* (status-*-flaeche oder kat-*), getrennt durch 2px, Kategorien mit Muster zusätzlich schraffiert;
// Legende mit Wort, rechts der Anteil der ersten Kategorie.
import { schraffur } from './formen.ts';
import { el, kuerze, rund, svgWurzel, textBreite, type Knoten } from './szene.ts';

export interface BalkenKategorie<K extends string = string> {
  schluessel: K;
  text: string;
  /** Farbrolle: gut, warnung, kritisch, neutral, info, leer oder kat-1 bis kat-6 */
  ton: string;
  muster?: boolean;
}

export interface BalkenZeile<K extends string = string> {
  titel: string;
  werte: Partial<Record<K, number>>;
  /** Text rechts; ohne: Anteil der ersten Kategorie in Prozent */
  summe?: string;
}

export interface BalkenTexte {
  titel: string;
  beschreibung: string;
}

/** Summe einer Zeile über die Kategorien. */
export function zeilenSumme<K extends string>(z: BalkenZeile<K>, kategorien: readonly BalkenKategorie<K>[]): number {
  return kategorien.reduce((s, k) => s + (z.werte[k.schluessel] ?? 0), 0);
}

/** Lesbare Werte einer Zeile, z. B. «A.2: umgesetzt 2, teilweise 1, offen 0» (aria-label, desc). */
export function zeilenText<K extends string>(z: BalkenZeile<K>, kategorien: readonly BalkenKategorie<K>[]): string {
  return `${z.titel}: ${kategorien.map((k) => `${k.text} ${z.werte[k.schluessel] ?? 0}`).join(', ')}`;
}

export function balkenSzene<K extends string>(zeilen: readonly BalkenZeile<K>[], kategorien: readonly BalkenKategorie<K>[], t: BalkenTexte, o: { id: string; breite?: number; titelSichtbar?: boolean }): Knoten {
  const breite = o.breite ?? 640;
  // Titel nie kürzen: Spalte wächst bis zu einem Drittel der Breite
  const titelBreite = Math.min(Math.round(breite / 3), Math.max(40, ...zeilen.map((z) => textBreite(z.titel, 12) + 8)));
  const summeBreite = 52;
  const bahn = breite - titelBreite - summeBreite - 16;
  const zh = 26;
  const oben = o.titelSichtbar === false ? 4 : 28;
  // Legende: Einträge nebeneinander, Umbruch bei Bedarf
  const legende: Knoten[] = [];
  let lx = 0;
  let ly = oben + zeilen.length * zh + 18;
  for (const k of kategorien) {
    const b = 26 + textBreite(k.text, 12) + 18;
    if (lx + b > breite && lx > 0) {
      lx = 0;
      ly += 20;
    }
    legende.push(el('rect', { class: `g-ton-${k.ton}`, x: lx, y: ly - 10, width: 18, height: 12, rx: 3 }));
    if (k.muster) legende.push(el('g', { 'aria-hidden': 'true' }, ...schraffur(lx, ly - 10, 18, 12, 5)));
    legende.push(el('text', { x: lx + 24, y: ly }, k.text));
    lx += b;
  }
  const hoehe = ly + 10;
  const kinder: Knoten[] = o.titelSichtbar === false ? [] : [el('text', { class: 'g-text-tinte', x: 0, y: 16, 'font-size': 14 }, t.titel)];
  zeilen.forEach((z, i) => {
    const y = oben + i * zh;
    const summe = zeilenSumme(z, kategorien);
    kinder.push(el('text', { class: 'g-text-tinte', x: 0, y: y + 13 }, kuerze(z.titel, titelBreite - 8)));
    kinder.push(el('rect', { class: 'g-ton-leer', x: titelBreite, y: y + 2, width: rund(bahn), height: 16, rx: 3 }));
    const segmente = kategorien.filter((k) => (z.werte[k.schluessel] ?? 0) > 0);
    const netto = bahn - 2 * Math.max(0, segmente.length - 1);
    let x = titelBreite;
    for (const k of segmente) {
      const w = summe ? (netto * (z.werte[k.schluessel] ?? 0)) / summe : 0;
      kinder.push(el('rect', { class: `g-ton-${k.ton}`, x: rund(x), y: y + 2, width: rund(Math.max(2, w)), height: 16 }));
      if (k.muster) kinder.push(el('g', { 'aria-hidden': 'true' }, ...schraffur(x, y + 2, Math.max(2, w), 16, 6)));
      x += w + 2;
    }
    const erste = z.werte[kategorien[0]?.schluessel as K] ?? 0;
    const rechts = z.summe ?? `${summe ? Math.round((100 * erste) / summe) : 0} %`;
    kinder.push(el('text', { class: 'g-text-gedaempft', x: breite, y: y + 14, 'text-anchor': 'end' }, rechts));
  });
  kinder.push(...legende);
  return svgWurzel(o.id, breite, hoehe, t.titel, t.beschreibung, 'g-svg--balken', kinder);
}
