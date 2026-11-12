// Ablauf als SVG-Szene (Entscheidungsbaum D-24 im Leitfaden): Knoten im Raster, Kanten rechtwinklig mit Spitze und
// Beschriftung am Start. Dasselbe Raster wie der Ablauf-Block der Dokumente (src/generator/ir.ts AblaufBlock), damit eine
// Quelle (z. B. entscheidungsbaumD24) Word-Formen und SVG liefert. Fragen auf blau-hauch, Ergebnisse auf seite, Start
// und Ende als Pille; Rollen (kat-n) tragen zusätzlich einen Knoten in ihrer Farbe, die Bedeutung steht immer im Text.
import { el, rund, svgWurzel, textBreite, type Knoten } from './szene.ts';

export type AblaufForm = 'start' | 'schritt' | 'frage' | 'ergebnis' | 'ende';
export type AblaufSeite = 'top' | 'right' | 'bottom' | 'left';

export interface AblaufKnotenDaten {
  id: string;
  form: AblaufForm;
  /** Text; «\n» bricht um, zu lange Zeilen werden an Wortgrenzen umbrochen */
  text: string;
  spalte: number;
  zeile: number;
  breite?: number;
  hoehe?: number;
  /** Farbrolle, z. B. kat-1 (Knoten in dieser Farbe) oder status-neutral (ohne Knoten) */
  rolle?: string;
}

export interface AblaufKanteDaten {
  von: string;
  vonSeite: AblaufSeite;
  nach: string;
  nachSeite: AblaufSeite;
  text?: string;
  weg?: 'gerade' | 'winkel';
}

/** Senkrechte Bahn (Swimlane) über eine oder mehrere Rasterspalten, Beschriftung im Kopf (Rolle) */
export interface AblaufBahnDaten {
  id: string;
  text: string;
  spalte: number;
  breite?: number;
}

export interface AblaufDaten {
  spalten: number;
  zeilen: number;
  knoten: readonly AblaufKnotenDaten[];
  kanten: readonly AblaufKanteDaten[];
  spaltenGewichte?: readonly number[];
  /** Bahnen (Prozesse): Band je Spalte hinter den Knoten, Kopf oben; die Knoten beginnen unter dem Kopf */
  bahnen?: readonly AblaufBahnDaten[];
}

export interface AblaufOptionen {
  id: string;
  breite?: number;
  zeilenHoehe?: number;
  /** Schriftgrösse in den Knoten (px) */
  schrift?: number;
  /** Waagrechter Abstand zwischen Knoten (Platz für Beschriftungen wie «Nein») */
  luecke?: number;
  /** Höhe des Bahnkopfs (nur mit bahnen; Standard 34) */
  kopfHoehe?: number;
}

export interface Rechteck {
  x: number;
  y: number;
  b: number;
  h: number;
}
interface Punkt {
  x: number;
  y: number;
}

const RAND_RECHTS = 24;
const LUECKE_H = 18;
const LUECKE_V = 20;
const STUMMEL = 9;
export const BAHN_KOPF = 34;

export interface AblaufGeometrie {
  breite: number;
  hoehe: number;
  zeilenHoehe: number;
  kopf: number;
  knoten: Map<string, Rechteck>;
  bahnen: (Rechteck & { id: string; text: string })[];
}

/**
 * Pixel des Rasters: Rechteck je Knoten und je Bahn. Gemeinsame Geometrie für SVG und den draw.io-Export, damit beide
 * gleich aussehen (der DOCX-Renderer rechnet mit derselben Regel auf die Satzbreite).
 */
export function ablaufGeometrie(a: AblaufDaten, o: Pick<AblaufOptionen, 'breite' | 'zeilenHoehe' | 'luecke' | 'kopfHoehe'> = {}): AblaufGeometrie {
  const breite = o.breite ?? 760;
  const zh = o.zeilenHoehe ?? 56;
  const lh0 = o.luecke ?? LUECKE_H;
  const kopf = a.bahnen?.length ? (o.kopfHoehe ?? BAHN_KOPF) : 0;
  const gewichte = Array.from({ length: Math.max(1, a.spalten) }, (_, i) => a.spaltenGewichte?.[i] ?? 1);
  const einheit = (breite - RAND_RECHTS) / gewichte.reduce((x, y) => x + y, 0);
  const links = (sp: number) => gewichte.slice(0, sp).reduce((x, y) => x + y, 0) * einheit;
  const weite = (sp: number, n: number) => gewichte.slice(sp, sp + n).reduce((x, y) => x + y, 0) * einheit;
  const knoten = new Map<string, Rechteck>();
  for (const k of a.knoten) {
    if (knoten.has(k.id)) throw new Error(`Ablauf: Knoten ${k.id} doppelt`);
    knoten.set(k.id, { x: links(k.spalte) + lh0 / 2, y: kopf + k.zeile * zh + LUECKE_V / 2, b: weite(k.spalte, k.breite ?? 1) - lh0, h: (k.hoehe ?? 1) * zh - LUECKE_V });
  }
  const hoehe = a.zeilen * zh + 4 + kopf;
  const bahnen = (a.bahnen ?? []).map((b) => ({ id: b.id, text: b.text, x: links(b.spalte), y: 0, b: weite(b.spalte, b.breite ?? 1), h: hoehe }));
  return { breite, hoehe, zeilenHoehe: zh, kopf, knoten, bahnen };
}


/** Zeilen eines Knotentexts: «\n» trennt, lange Zeilen an Wortgrenzen auf die Breite umbrechen. */
export function ablaufZeilen(text: string, breite: number, groesse: number): string[] {
  const aus: string[] = [];
  for (const absatz of text.split('\n')) {
    let zeile = '';
    for (const wort of absatz.split(/\s+/).filter(Boolean)) {
      const kandidat = zeile ? `${zeile} ${wort}` : wort;
      if (zeile && textBreite(kandidat, groesse) > breite) {
        aus.push(zeile);
        zeile = wort;
      } else zeile = kandidat;
    }
    aus.push(zeile);
  }
  return aus;
}

const NORMALE: Record<AblaufSeite, Punkt> = { top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 } };

export function seitenPunkt(r: Rechteck, s: AblaufSeite): Punkt {
  switch (s) {
    case 'top':
      return { x: r.x + r.b / 2, y: r.y };
    case 'bottom':
      return { x: r.x + r.b / 2, y: r.y + r.h };
    case 'left':
      return { x: r.x, y: r.y + r.h / 2 };
    default:
      return { x: r.x + r.b, y: r.y + r.h / 2 };
  }
}

/** Schneidet eine waagrechte oder senkrechte Strecke das Innere des Rechtecks? */
function schneidet(a: Punkt, b: Punkt, r: Rechteck): boolean {
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  return x2 > r.x + 1 && x1 < r.x + r.b - 1 && y2 > r.y + 1 && y1 < r.y + r.h - 1;
}

/** Rechtwinkliger Weg: Stummel aus beiden Seiten, dazwischen ein Knick, der keinen anderen Knoten schneidet. */
/**
 * Umweg, wenn kein einfacher Knick frei ist: kürzester Weg über die Gassen zwischen den Formen, Knicke kosten extra.
 * Grund: Eine Linie durch eine Raute macht den Prozess unlesbar (Bericht D, D-05).
 */
function umweg(a: Punkt, e: Punkt, hindernisse: readonly Rechteck[]): Punkt[] | null {
  const xs = [...new Set([a.x, e.x, ...hindernisse.flatMap((r) => [r.x - STUMMEL, r.x + r.b + STUMMEL])].map(rund))].sort((x, y) => x - y);
  const ys = [...new Set([a.y, e.y, ...hindernisse.flatMap((r) => [r.y - STUMMEL, r.y + r.h + STUMMEL])].map(rund))].sort((x, y) => x - y);
  const ix = xs.indexOf(rund(a.x));
  const iy = ys.indexOf(rund(a.y));
  const zx = xs.indexOf(rund(e.x));
  const zy = ys.indexOf(rund(e.y));
  const RICHTUNG: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const schluessel = (x: number, y: number, r: number) => (x * ys.length + y) * 5 + r;
  const kosten = new Map<number, number>([[schluessel(ix, iy, 4), 0]]);
  const vor = new Map<number, number>();
  const offen: { k: number; x: number; y: number; r: number; d: number }[] = [{ k: schluessel(ix, iy, 4), x: ix, y: iy, r: 4, d: 0 }];
  while (offen.length) {
    let m = 0;
    for (let i = 1; i < offen.length; i++) if (offen[i]!.d < offen[m]!.d) m = i;
    const c = offen.splice(m, 1)[0]!;
    if (c.d > (kosten.get(c.k) ?? Infinity)) continue;
    if (c.x === zx && c.y === zy) {
      const aus: Punkt[] = [];
      for (let k: number | undefined = c.k; k !== undefined; k = vor.get(k)) {
        const n = Math.floor(k / 5);
        aus.unshift({ x: xs[Math.floor(n / ys.length)]!, y: ys[n % ys.length]! });
      }
      return aus;
    }
    for (const [r, [dx, dy]] of RICHTUNG.entries()) {
      const x = c.x + dx;
      const y = c.y + dy;
      if (x < 0 || y < 0 || x >= xs.length || y >= ys.length) continue;
      const von = { x: xs[c.x]!, y: ys[c.y]! };
      const nach = { x: xs[x]!, y: ys[y]! };
      if (hindernisse.some((h) => schneidet(von, nach, h))) continue;
      const d = c.d + Math.abs(nach.x - von.x) + Math.abs(nach.y - von.y) + (c.r !== 4 && c.r !== r ? 60 : 0);
      const k = schluessel(x, y, r);
      if (d < (kosten.get(k) ?? Infinity)) {
        kosten.set(k, d);
        vor.set(k, c.k);
        offen.push({ k, x, y, r, d });
      }
    }
  }
  return null;
}

/** Hat die Kante einen Umweg nötig? (draw.io zeichnet sonst selbst; dort werden die Punkte dann mitgegeben) */
export function ablaufUmwegNoetig(p1: Punkt, s1: AblaufSeite, p2: Punkt, s2: AblaufSeite, hindernisse: readonly Rechteck[]): boolean {
  const n1 = NORMALE[s1];
  const n2 = NORMALE[s2];
  if (((p1.x === p2.x && n1.x === 0 && n2.x === 0 && n1.y === -n2.y) || (p1.y === p2.y && n1.y === 0 && n2.y === 0 && n1.x === -n2.x)) && !hindernisse.some((r) => schneidet(p1, p2, r))) return false;
  const a = { x: p1.x + n1.x * STUMMEL, y: p1.y + n1.y * STUMMEL };
  const e = { x: p2.x + n2.x * STUMMEL, y: p2.y + n2.y * STUMMEL };
  return ![{ x: a.x, y: e.y }, { x: e.x, y: a.y }].some((k) => !hindernisse.some((r) => schneidet(a, k, r) || schneidet(k, e, r)));
}

export function ablaufWeg(p1: Punkt, s1: AblaufSeite, p2: Punkt, s2: AblaufSeite, hindernisse: readonly Rechteck[] = []): Punkt[] {
  const n1 = NORMALE[s1];
  const n2 = NORMALE[s2];
  // Gerade, wenn die Punkte fluchten, die Seiten einander zugewandt sind und nichts dazwischen liegt
  if (((p1.x === p2.x && n1.x === 0 && n2.x === 0 && n1.y === -n2.y) || (p1.y === p2.y && n1.y === 0 && n2.y === 0 && n1.x === -n2.x)) && !hindernisse.some((r) => schneidet(p1, p2, r))) return [p1, p2];
  const a = { x: p1.x + n1.x * STUMMEL, y: p1.y + n1.y * STUMMEL };
  const e = { x: p2.x + n2.x * STUMMEL, y: p2.y + n2.y * STUMMEL };
  const knicke: Punkt[] = n1.y !== 0 ? [{ x: a.x, y: e.y }, { x: e.x, y: a.y }] : [{ x: e.x, y: a.y }, { x: a.x, y: e.y }];
  const frei = (k: Punkt) => !hindernisse.some((r) => schneidet(a, k, r) || schneidet(k, e, r));
  const knick = knicke.find(frei);
  const mitte = knick ? [knick] : (umweg(a, e, hindernisse) ?? [knicke[0]!]);
  // Doppelte und kollineare Punkte entfernen
  const roh = [p1, a, ...mitte, e, p2];
  const weg: Punkt[] = [];
  for (const p of roh) {
    const letzter = weg.at(-1);
    if (letzter && rund(letzter.x) === rund(p.x) && rund(letzter.y) === rund(p.y)) continue;
    const vor = weg.at(-2);
    if (vor && letzter && ((rund(vor.x) === rund(letzter.x) && rund(letzter.x) === rund(p.x)) || (rund(vor.y) === rund(letzter.y) && rund(letzter.y) === rund(p.y)))) weg.pop();
    weg.push(p);
  }
  return weg;
}

/** Waagrechte oder senkrechte Strecken: gemeinsames Stück in Pixeln, wenn sie aufeinander liegen */
function ueberdeckung(a: Punkt, b: Punkt, c: Punkt, d: Punkt): number {
  if (a.x === b.x && c.x === d.x && Math.abs(a.x - c.x) < 1) return Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y));
  if (a.y === b.y && c.y === d.y && Math.abs(a.y - c.y) < 1) return Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x));
  return 0;
}

interface WegOptionen {
  /** Bildgrenzen, die der Weg nicht verlassen darf */
  grenze: { x0: number; y0: number; x1: number; y1: number };
  /** Länge des geraden Stücks aus der Form; kleiner als die halbe Lücke zwischen den Formen */
  stummel?: number;
}

/** Billigster Knoten zuerst: Der Heap hält die Suche bei grossen Abläufen klein. */
class Vorrang<T extends { d: number }> {
  private readonly h: T[] = [];
  get leer(): boolean {
    return this.h.length === 0;
  }
  rein(x: T): void {
    const h = this.h;
    h.push(x);
    for (let i = h.length - 1; i > 0;) {
      const e = (i - 1) >> 1;
      if (h[e]!.d <= h[i]!.d) break;
      [h[e], h[i]] = [h[i]!, h[e]!];
      i = e;
    }
  }
  raus(): T {
    const h = this.h;
    const t = h[0]!;
    const l = h.pop()!;
    if (h.length) {
      h[0] = l;
      for (let i = 0; ;) {
        const a = 2 * i + 1;
        const b = a + 1;
        let m = i;
        if (a < h.length && h[a]!.d < h[m]!.d) m = a;
        if (b < h.length && h[b]!.d < h[m]!.d) m = b;
        if (m === i) break;
        [h[m], h[i]] = [h[i]!, h[m]!];
        i = m;
      }
    }
    return t;
  }
}

const KOSTEN_KNICK = 30;
const KOSTEN_UEBERDECKUNG = 2000;
const KOSTEN_KREUZUNG = 12;

/**
 * Kürzester rechtwinkliger Weg über mehrere Spuren in den Gassen. Formen sind gesperrt, auch Start und Ziel: Sonst liefe eine
 * Linie durch den eigenen Kasten (Bericht D, D-05). Strecken anderer Kanten kosten viel: Nein- und Ja-Zweig bleiben getrennt.
 */
function spurWeg(a: Punkt, e: Punkt, startRichtung: number, formen: readonly Rechteck[], belegt: readonly [Punkt, Punkt][], o: Required<WegOptionen>): Punkt[] | null {
  const st = o.stummel;
  const { x0, y0, x1, y1 } = o.grenze;
  const xs = [...new Set([a.x, e.x, ...formen.flatMap((r) => [r.x - st, r.x - st * 0.5, r.x - st * 1.5, r.x + r.b + st, r.x + r.b + st * 0.5, r.x + r.b + st * 1.5])].map(rund))].filter((x) => (x >= x0 && x <= x1) || x === rund(a.x) || x === rund(e.x)).sort((p, q) => p - q);
  const ys = [...new Set([a.y, e.y, ...formen.flatMap((r) => [r.y - st, r.y - st * 0.5, r.y - st * 1.5, r.y + r.h + st, r.y + r.h + st * 0.5, r.y + r.h + st * 1.5])].map(rund))].filter((y) => (y >= y0 && y <= y1) || y === rund(a.y) || y === rund(e.y)).sort((p, q) => p - q);
  const ix = xs.indexOf(rund(a.x));
  const iy = ys.indexOf(rund(a.y));
  const zx = xs.indexOf(rund(e.x));
  const zy = ys.indexOf(rund(e.y));
  if (ix < 0 || iy < 0 || zx < 0 || zy < 0) return null;
  const RICHTUNG: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const schluessel = (x: number, y: number, r: number) => (x * ys.length + y) * 5 + r;
  const start = schluessel(ix, iy, startRichtung);
  const kosten = new Map<number, number>([[start, 0]]);
  const vor = new Map<number, number>();
  const offen = new Vorrang<{ k: number; x: number; y: number; r: number; d: number }>();
  offen.rein({ k: start, x: ix, y: iy, r: startRichtung, d: 0 });
  while (!offen.leer) {
    const c = offen.raus();
    if (c.d > (kosten.get(c.k) ?? Infinity)) continue;
    if (c.x === zx && c.y === zy) {
      const aus: Punkt[] = [];
      for (let k: number | undefined = c.k; k !== undefined; k = vor.get(k)) {
        const n = Math.floor(k / 5);
        aus.unshift({ x: xs[Math.floor(n / ys.length)]!, y: ys[n % ys.length]! });
      }
      return aus;
    }
    for (const [r, [dx, dy]] of RICHTUNG.entries()) {
      // Nicht umkehren: Das ergäbe eine Linie auf sich selbst
      if (c.r !== 4 && RICHTUNG[c.r]![0] === -dx && RICHTUNG[c.r]![1] === -dy) continue;
      const x = c.x + dx;
      const y = c.y + dy;
      if (x < 0 || y < 0 || x >= xs.length || y >= ys.length) continue;
      const von = { x: xs[c.x]!, y: ys[c.y]! };
      const nach = { x: xs[x]!, y: ys[y]! };
      if (formen.some((h) => schneidet(von, nach, h))) continue;
      let d = c.d + Math.abs(nach.x - von.x) + Math.abs(nach.y - von.y) + (c.r !== 4 && c.r !== r ? KOSTEN_KNICK : 0);
      for (const [p, q] of belegt) {
        if (ueberdeckung(von, nach, p, q) > 0) d += KOSTEN_UEBERDECKUNG;
        else if (schneidet(von, nach, { x: Math.min(p.x, q.x) - 1.5, y: Math.min(p.y, q.y) - 1.5, b: Math.abs(p.x - q.x) + 3, h: Math.abs(p.y - q.y) + 3 })) d += KOSTEN_KREUZUNG;
      }
      const k = schluessel(x, y, r);
      if (d < (kosten.get(k) ?? Infinity)) {
        kosten.set(k, d);
        vor.set(k, c.k);
        offen.rein({ k, x, y, r, d });
      }
    }
  }
  return null;
}

const RICHTUNG_INDEX: Record<AblaufSeite, number> = { right: 0, left: 1, bottom: 2, top: 3 };

/**
 * Wege aller Kanten eines Ablaufs: eine Quelle für SVG, DOCX und draw.io. Keine Linie durch eine Form, auch nicht durch Start
 * oder Ziel; Kanten mit verschiedenem Ziel liegen nicht aufeinander. Kanten zum selben Ziel dürfen am Ende zusammenlaufen.
 */
export function ablaufWege(rechtecke: ReadonlyMap<string, Rechteck>, kanten: readonly Pick<AblaufKanteDaten, 'von' | 'vonSeite' | 'nach' | 'nachSeite'>[], o: WegOptionen): Punkt[][] {
  const opt: Required<WegOptionen> = { stummel: STUMMEL, ...o };
  const st = opt.stummel;
  const formen = [...rechtecke.values()];
  const fertig: { von: string; nach: string; strecken: [Punkt, Punkt][] }[] = [];
  const glatt = (roh: Punkt[]): Punkt[] => {
    const weg: Punkt[] = [];
    for (const p of roh) {
      const l = weg.at(-1);
      if (l && rund(l.x) === rund(p.x) && rund(l.y) === rund(p.y)) continue;
      const v = weg.at(-2);
      if (v && l && ((rund(v.x) === rund(l.x) && rund(l.x) === rund(p.x)) || (rund(v.y) === rund(l.y) && rund(l.y) === rund(p.y)))) weg.pop();
      weg.push(p);
    }
    return weg;
  };
  const strecken = (w: readonly Punkt[]): [Punkt, Punkt][] => w.slice(1).map((p, i) => [w[i]!, p]);
  return kanten.map((k) => {
    const r1 = rechtecke.get(k.von);
    const r2 = rechtecke.get(k.nach);
    if (!r1 || !r2) throw new Error(`Ablauf: Kante ${k.von} -> ${k.nach} ohne Knoten`);
    const p1 = seitenPunkt(r1, k.vonSeite);
    const p2 = seitenPunkt(r2, k.nachSeite);
    const n1 = NORMALE[k.vonSeite];
    const n2 = NORMALE[k.nachSeite];
    // Andere Ziele sind Fremdstrecken; zum selben Ziel laufen Kanten zusammen
    const fremd = fertig.filter((f) => f.nach !== k.nach).flatMap((f) => f.strecken);
    const frei = (w: readonly Punkt[]) => strecken(w).every(([p, q], i, alle) =>
      !formen.some((r) => (i === 0 || i === alle.length - 1 ? r !== r1 && r !== r2 && schneidet(p, q, r) : schneidet(p, q, r))) && !fremd.some(([u, v]) => ueberdeckung(p, q, u, v) > 1));
    let weg: Punkt[] | null = null;
    const faehrt = ((p1.x === p2.x && n1.x === 0 && n2.x === 0 && n1.y === -n2.y) || (p1.y === p2.y && n1.y === 0 && n2.y === 0 && n1.x === -n2.x));
    if (faehrt && (n1.x * (p2.x - p1.x) > 0 || n1.y * (p2.y - p1.y) > 0) && frei([p1, p2])) weg = [p1, p2];
    if (!weg) {
      // Am linken Bildrand bleibt die Linie sichtbar im Bild
      const a = { x: p1.x + n1.x * (n1.x < 0 ? Math.min(st, p1.x - 3) : st), y: p1.y + n1.y * st };
      const e = { x: p2.x + n2.x * (n2.x < 0 ? Math.min(st, p2.x - 3) : st), y: p2.y + n2.y * st };
      for (const kn of n1.y !== 0 ? [{ x: a.x, y: e.y }, { x: e.x, y: a.y }] : [{ x: e.x, y: a.y }, { x: a.x, y: e.y }]) {
        // Vor dem Glätten prüfen: Nur die Stummel dürfen die eigene Form berühren
        const v = [p1, a, kn, e, p2];
        if (frei(v)) {
          weg = glatt(v);
          break;
        }
      }
      if (!weg) {
        const mitte = spurWeg({ x: rund(a.x), y: rund(a.y) }, { x: rund(e.x), y: rund(e.y) }, RICHTUNG_INDEX[k.vonSeite], formen, fremd, opt);
        weg = glatt(mitte ? [p1, ...mitte, p2] : [p1, a, { x: e.x, y: a.y }, e, p2]);
      }
    }
    fertig.push({ von: k.von, nach: k.nach, strecken: strecken(weg) });
    return weg;
  });
}

/** Lage der Beschriftung am Start einer Kante; bleibt immer im Bild, sonst fehlte der Text (Bericht D, D-05: nur «n» sichtbar) */
export function ablaufBeschriftung(text: string, seite: AblaufSeite, p1: Punkt, r1: Rechteck, breite: number, weg?: readonly Punkt[]): { x: number; y: number; anker: 'start' | 'end'; breite: number; text?: string } {
  const n = NORMALE[seite];
  // Fett und in fremder Schrift etwas breiter als geschätzt
  const b = textBreite(text, 10) * 1.1;
  const x = n.x !== 0 ? p1.x + n.x * 5 : p1.x + 5;
  const y = n.x !== 0 || n.y < 0 ? p1.y - 4 : p1.y + 12;
  const anker = n.x < 0 ? 'end' : 'start';
  const passt = anker === 'end' ? x - b >= 2 : x + b <= breite - 2;
  if (passt) return { x, y, anker, breite: b };
  // Zu lang für die Seite: in die Gasse, dort wo die Linie weiterläuft (nach oben oder unten) und innerhalb des Bildes
  const nachOben = !!weg && weg.length > 2 && weg[2]!.y < weg[1]!.y;
  const gy = nachOben ? r1.y - 4 : r1.y + r1.h + 11;
  // In der Gasse steht die Linie zur nächsten Form in der Mitte: Was nicht daneben passt, kürzt auf den Zweig («nein»); der volle Text steht im Titel und in der Tabelle
  const platz = Math.abs(r1.x + r1.b / 2 - p1.x) - 8;
  const kurz = text.split(',')[0]!.trim();
  const zuLang = n.x !== 0 && b > platz && kurz !== text;
  const gezeigt = zuLang ? kurz : text;
  const bg = zuLang ? textBreite(kurz, 10) * 1.1 : b;
  const zusatz = zuLang ? { text: kurz } : {};
  if (n.x > 0 && p1.x + 3 - bg >= 2) return { x: p1.x + 3, y: gy, anker: 'end', breite: bg, ...zusatz };
  if (n.x < 0 && p1.x - 3 + bg <= breite - 2) return { x: Math.max(p1.x - 3, 2), y: gy, anker: 'start', breite: bg, ...zusatz };
  return { x: Math.min(Math.max(2, r1.x), Math.max(2, breite - bg - 2)), y: gy, anker: 'start', breite: bg, ...(gezeigt !== text ? zusatz : {}) };
}

/**
 * Beschriftungen, die sich mit einer früheren oder einer Form überlagern, zur Seite oder in die Zeile darüber oder darunter setzen
 * (F-17: «yes» und «no» übereinander an zwei benachbarten Fragen). Ohne freien Platz bleibt die erste Lage.
 */
export function ablaufPlatz<L extends { x: number; y: number; anker: 'start' | 'end'; breite: number }>(lage: L, belegt: Rechteck[], formen: readonly Rechteck[], breite: number): L {
  const kasten = (x: number, y: number): Rechteck => ({ x: lage.anker === 'end' ? x - lage.breite : x, y: y - 10, b: lage.breite, h: 12 });
  const trifft = (a: Rechteck, b: Rechteck) => a.x < b.x + b.b + 2 && b.x < a.x + a.b + 2 && a.y < b.y + b.h && b.y < a.y + a.h;
  const frei = (k: Rechteck) => k.x >= 2 && k.x + k.b <= breite - 2 && !belegt.some((b) => trifft(k, b)) && !formen.some((f) => trifft(k, f));
  const s = lage.breite + 6;
  for (const [dx, dy] of [[0, 0], [0, 12], [0, -12], [s, 0], [-s, 0], [s, 12], [-s, 12], [s, -12], [-s, -12]] as const) {
    const k = kasten(lage.x + dx, lage.y + dy);
    if (!frei(k)) continue;
    belegt.push(k);
    return { ...lage, x: lage.x + dx, y: lage.y + dy };
  }
  belegt.push(kasten(lage.x, lage.y));
  return lage;
}

export function ablaufSzene(a: AblaufDaten, t: { titel: string; beschreibung: string }, o: AblaufOptionen): Knoten {
  const fs = o.schrift ?? 11;
  const geo = ablaufGeometrie(a, o);
  const { breite } = geo;
  const rechteck = geo.knoten;
  const kinder: Knoten[] = [];
  // Bahnen zuerst (Band mit Kopf und Trennlinie), darüber Kanten und Knoten
  for (const [i, b] of geo.bahnen.entries()) {
    const zeilen = ablaufZeilen(b.text, b.b - 12, fs);
    kinder.push(
      el(
        'g',
        { 'data-bahn': b.id },
        i % 2 === 0 ? el('rect', { class: 'g-feld', x: rund(b.x), y: 0, width: rund(b.b), height: rund(b.h) }) : null,
        el('line', { class: 'g-raster', x1: rund(b.x), y1: rund(geo.kopf), x2: rund(b.x + b.b), y2: rund(geo.kopf) }),
        el(
          'text',
          { class: 'g-text-tinte', x: rund(b.x + b.b / 2), y: rund(geo.kopf / 2 - ((Math.min(zeilen.length, 2) - 1) * fs * 1.2) / 2 + fs * 0.35), 'text-anchor': 'middle', 'font-size': fs },
          ...zeilen.slice(0, 2).map((z, j) => el('tspan', { x: rund(b.x + b.b / 2), dy: j === 0 ? undefined : rund(fs * 1.2) }, z)),
        ),
      ),
    );
  }
  // Kanten zuerst, Knoten darüber
  const wege = ablaufWege(rechteck, a.kanten, { grenze: { x0: 1, y0: geo.kopf + 1, x1: breite - 1, y1: geo.hoehe - 1 } });
  const belegt: Rechteck[] = [];
  for (const [i, k] of a.kanten.entries()) {
    const r1 = rechteck.get(k.von);
    const r2 = rechteck.get(k.nach);
    if (!r1 || !r2) throw new Error(`Ablauf: Kante ${k.von} -> ${k.nach} ohne Knoten`);
    const p1 = seitenPunkt(r1, k.vonSeite);
    const p2 = seitenPunkt(r2, k.nachSeite);
    const weg = wege[i]!;
    // Spitze: letzte Strecke zeigt in den Zielknoten
    const vor = weg.at(-2)!;
    const dx = Math.sign(p2.x - vor.x);
    const dy = Math.sign(p2.y - vor.y);
    const ende = { x: p2.x - dx * 6, y: p2.y - dy * 6 };
    const linie = [...weg.slice(0, -1), ende];
    const spitze = `M${rund(p2.x)} ${rund(p2.y)}L${rund(ende.x - dy * 3.5)} ${rund(ende.y - dx * 3.5)}L${rund(ende.x + dy * 3.5)} ${rund(ende.y + dx * 3.5)}Z`;
    const teile: Knoten[] = [
      el('polyline', { class: 'g-ablauf-kante', points: linie.map((p) => `${rund(p.x)},${rund(p.y)}`).join(' ') }),
      el('path', { class: 'g-ablauf-pfeil', d: spitze }),
    ];
    if (k.text) {
      const b = ablaufPlatz(ablaufBeschriftung(k.text, k.vonSeite, p1, r1, breite, weg), belegt, [...rechteck.values()], breite);
      teile.push(el('text', { class: 'g-text-gedaempft', x: rund(b.x), y: rund(b.y), 'text-anchor': b.anker, 'font-size': 10, 'font-weight': 650 }, b.text ?? k.text, ...(b.text ? [el('title', {}, k.text)] : [])));
    }
    kinder.push(el('g', { 'data-kante': `${k.von}-${k.nach}` }, ...teile));
  }
  for (const k of a.knoten) {
    const r = rechteck.get(k.id)!;
    const kat = /^kat-\d$/.test(k.rolle ?? '') ? k.rolle : undefined;
    const klasse = k.form === 'frage' ? 'g-ablauf-frage' : k.form === 'ergebnis' ? 'g-ablauf-ergebnis' : k.form === 'schritt' ? 'g-ablauf-knoten' : 'g-ablauf-rand';
    const rx = k.form === 'start' || k.form === 'ende' ? r.h / 2 : 6;
    const einzug = kat ? 16 : 0;
    const zeilen = ablaufZeilen(k.text, r.b - 14 - einzug, fs);
    const lh = fs * 1.25;
    const cx = r.x + r.b / 2 + einzug / 2;
    const y0 = r.y + r.h / 2 - ((zeilen.length - 1) * lh) / 2 + fs * 0.35;
    const text = el(
      'text',
      { class: k.form === 'frage' ? undefined : 'g-text-tinte', x: rund(cx), y: rund(y0), 'text-anchor': 'middle', 'font-size': fs },
      ...zeilen.map((z, i) => el('tspan', { x: rund(cx), dy: i === 0 ? undefined : rund(lh) }, z)),
    );
    kinder.push(
      el(
        'g',
        { 'data-knoten': k.id, 'data-form': k.form },
        el('rect', { class: klasse, x: rund(r.x), y: rund(r.y), width: rund(r.b), height: rund(r.h), rx: rund(rx) }),
        kat ? el('circle', { class: `g-ton-${kat}`, cx: rund(r.x + 12), cy: rund(r.y + r.h / 2), r: 4.5 }) : null,
        text,
      ),
    );
  }
  return svgWurzel(o.id, breite, geo.hoehe, t.titel, t.beschreibung, 'g-svg--ablauf', kinder);
}
