// Bildbearbeitung für das Firmenlogo auf RGBA-Daten, rein (ohne DOM): Ränder abschneiden, verkleinern, Form erkennen,
// Logo für dunklen Grund erkennen, Farben vorschlagen (k-Means in OKLab), auf 256 Farben reduzieren. Der Browser liefert
// nur die Pixel (img und Canvas, src/app/logik/logo.ts); alles Weitere ist hier testbar und überall gleich.
import { linearZuHex, linearZuOklab, oklabZuLinear, type Hex, type Oklab } from './farbe.ts';
import { pngKodieren, type Rgba } from './png.ts';

export type LogoForm = 'quer' | 'breit' | 'quadratisch' | 'hoch';

/** Form aus dem Seitenverhältnis: quer über 2,5:1, breit 1,4 bis 2,5, quadratisch 0,7 bis 1,4, hoch darunter */
export function logoForm(breite: number, hoehe: number): LogoForm {
  const v = breite / Math.max(1, hoehe);
  if (v > 2.5) return 'quer';
  if (v >= 1.4) return 'breit';
  if (v >= 0.7) return 'quadratisch';
  return 'hoch';
}

const lin = (c: number) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const LIN = Array.from({ length: 256 }, (_, i) => lin(i));

/** Hintergrundpixel: (fast) transparent, bei deckend weissem Grund auch (fast) weiss */
function hintergrund(px: Uint8Array | Uint8ClampedArray, i: number, weissIstGrund: boolean, toleranz: number): boolean {
  if (px[i + 3]! < 16) return true;
  return weissIstGrund && px[i + 3]! > 240 && Math.min(px[i]!, px[i + 1]!, px[i + 2]!) >= 255 - toleranz;
}

export interface Rahmen {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}

/**
 * Inhalt ohne Rand: transparente Ränder immer, weisse Ränder, wenn alle vier Ecken (fast) weiss und deckend sind
 * (Logo auf weissem Grund). Ganz leer: undefined.
 */
export function inhaltRahmen(bild: Rgba, toleranz = 12): Rahmen | undefined {
  const { breite: w, hoehe: h, daten: px } = bild;
  const ecke = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return px[i + 3]! > 240 && Math.min(px[i]!, px[i + 1]!, px[i + 2]!) >= 255 - toleranz;
  };
  const weiss = ecke(0, 0) && ecke(w - 1, 0) && ecke(0, h - 1) && ecke(w - 1, h - 1);
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (hintergrund(px, (y * w + x) * 4, weiss, toleranz)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return undefined;
  return { x: x0, y: y0, breite: x1 - x0 + 1, hoehe: y1 - y0 + 1 };
}

export function ausschnitt(bild: Rgba, r: Rahmen): Rgba {
  const aus = new Uint8Array(r.breite * r.hoehe * 4);
  for (let y = 0; y < r.hoehe; y++) {
    const q = ((r.y + y) * bild.breite + r.x) * 4;
    aus.set(bild.daten.subarray(q, q + r.breite * 4), y * r.breite * 4);
  }
  return { breite: r.breite, hoehe: r.hoehe, daten: aus };
}

/** Verkleinern durch Flächenmittel mit vormultipliziertem Alpha (keine dunklen Säume an transparenten Kanten) */
export function verkleinern(bild: Rgba, nb: number, nh: number): Rgba {
  const { breite: w, hoehe: h, daten: px } = bild;
  nb = Math.max(1, Math.round(nb));
  nh = Math.max(1, Math.round(nh));
  if (nb >= w && nh >= h) return bild;
  const aus = new Uint8Array(nb * nh * 4);
  const sx = w / nb;
  const sy = h / nh;
  for (let y = 0; y < nh; y++) {
    const ya = y * sy;
    const yb = ya + sy;
    for (let x = 0; x < nb; x++) {
      const xa = x * sx;
      const xb = xa + sx;
      let r = 0, g = 0, b = 0, a = 0, flaeche = 0;
      for (let yy = Math.floor(ya); yy < Math.min(h, Math.ceil(yb)); yy++) {
        const fy = Math.min(yb, yy + 1) - Math.max(ya, yy);
        for (let xx = Math.floor(xa); xx < Math.min(w, Math.ceil(xb)); xx++) {
          const f = (Math.min(xb, xx + 1) - Math.max(xa, xx)) * fy;
          const i = (yy * w + xx) * 4;
          const al = px[i + 3]! / 255;
          r += px[i]! * al * f;
          g += px[i + 1]! * al * f;
          b += px[i + 2]! * al * f;
          a += al * f;
          flaeche += f;
        }
      }
      const o = (y * nb + x) * 4;
      if (a > 0) {
        aus[o] = Math.round(r / a);
        aus[o + 1] = Math.round(g / a);
        aus[o + 2] = Math.round(b / a);
      }
      aus[o + 3] = Math.round((a / flaeche) * 255);
    }
  }
  return { breite: nb, hoehe: nh, daten: aus };
}

/** Auf mindestens `min` px je Kante mit transparentem Rand auffüllen (zentriert) */
function auffuellen(bild: Rgba, min: number): Rgba {
  if (bild.breite >= min && bild.hoehe >= min) return bild;
  const nb = Math.max(min, bild.breite);
  const nh = Math.max(min, bild.hoehe);
  const aus = new Uint8Array(nb * nh * 4);
  const ox = Math.floor((nb - bild.breite) / 2);
  const oy = Math.floor((nh - bild.hoehe) / 2);
  for (let y = 0; y < bild.hoehe; y++) aus.set(bild.daten.subarray(y * bild.breite * 4, (y + 1) * bild.breite * 4), ((oy + y) * nb + ox) * 4);
  return { breite: nb, hoehe: nh, daten: aus };
}

/**
 * Logo für dunklen Grund: die deckenden Pixel sind im Mittel sehr hell (Leuchtdichte über 0,8) und das Bild hat deutlich
 * Transparenz (mindestens 10 % der Fläche) oder ist fast nur weiss (ein deckend weisses Bild ohne Inhalt schneidet die
 * Normalisierung ganz weg). Dokumente sind immer hell, ein weisses Logo wäre unsichtbar.
 */
export function fuerDunklenGrund(bild: Rgba): boolean {
  const px = bild.daten;
  let transparent = 0;
  let deckend = 0;
  let summe = 0;
  let hell = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3]! < 128) {
      transparent++;
      continue;
    }
    deckend++;
    const l = 0.2126 * LIN[px[i]!]! + 0.7152 * LIN[px[i + 1]!]! + 0.0722 * LIN[px[i + 2]!]!;
    summe += l;
    if (l > 0.9) hell++;
  }
  const n = px.length / 4;
  // Nach dem Abschneiden der Ränder bleibt bei einem weissen Logo oft keine Transparenz: dann fast nur Weiss
  return deckend > 0 && summe / deckend > 0.8 && (transparent / n >= 0.1 || hell / deckend >= 0.9);
}

/** Auf höchstens 256 Farben reduzieren (Median-Schnitt über RGBA, gewichtet nach Häufigkeit) */
export function farbenReduzieren(bild: Rgba, anzahl = 256): Rgba {
  const px = bild.daten;
  const zaehler = new Map<number, number>();
  for (let i = 0; i < px.length; i += 4) {
    const k = ((px[i]! << 24) | (px[i + 1]! << 16) | (px[i + 2]! << 8) | px[i + 3]!) >>> 0;
    zaehler.set(k, (zaehler.get(k) ?? 0) + 1);
  }
  if (zaehler.size <= anzahl) return bild;
  type Farbe = { k: [number, number, number, number]; n: number };
  const alle: Farbe[] = [...zaehler].map(([k, n]) => ({ k: [k >>> 24, (k >>> 16) & 255, (k >>> 8) & 255, k & 255], n }));
  const kisten: Farbe[][] = [alle];
  const spanne = (f: Farbe[]) => {
    let best = 0;
    let kanal = 0;
    for (let c = 0; c < 4; c++) {
      let lo = 255, hi = 0;
      for (const x of f) {
        if (x.k[c]! < lo) lo = x.k[c]!;
        if (x.k[c]! > hi) hi = x.k[c]!;
      }
      if (hi - lo > best) {
        best = hi - lo;
        kanal = c;
      }
    }
    return { best, kanal };
  };
  while (kisten.length < anzahl) {
    let wahl = -1;
    let gewicht = 0;
    kisten.forEach((k, i) => {
      if (k.length < 2) return;
      // Spanne vor Häufigkeit: seltene, aber deutlich andere Farben (Akzent) erhalten eine eigene Kiste
      const g = spanne(k).best ** 2 * Math.sqrt(k.reduce((s, x) => s + x.n, 0));
      if (g > gewicht) {
        gewicht = g;
        wahl = i;
      }
    });
    if (wahl < 0) break;
    const k = kisten[wahl]!;
    const { kanal } = spanne(k);
    k.sort((a, b) => a.k[kanal]! - b.k[kanal]! || a.k[0]! - b.k[0]! || a.k[1]! - b.k[1]! || a.k[2]! - b.k[2]! || a.k[3]! - b.k[3]!);
    // Schnitt in der Mitte der Spanne (nicht beim gewichteten Median): eine sehr häufige Farbe würde sonst immer wieder
    // nur einzelne Kantenpixel abspalten
    const mitte = (k[0]!.k[kanal]! + k[k.length - 1]!.k[kanal]!) / 2;
    let schnitt = k.findIndex((x) => x.k[kanal]! > mitte);
    if (schnitt <= 0) schnitt = Math.max(1, k.length >> 1);
    kisten.splice(wahl, 1, k.slice(0, schnitt), k.slice(schnitt));
  }
  const palette = kisten.map((k) => {
    const n = k.reduce((s, x) => s + x.n, 0);
    return [0, 1, 2, 3].map((c) => Math.round(k.reduce((s, x) => s + x.k[c]! * x.n, 0) / n)) as [number, number, number, number];
  });
  const zuordnung = new Map<number, [number, number, number, number]>();
  kisten.forEach((k, i) => k.forEach((x) => zuordnung.set(((x.k[0] << 24) | (x.k[1] << 16) | (x.k[2] << 8) | x.k[3]) >>> 0, palette[i]!)));
  const aus = new Uint8Array(px.length);
  for (let i = 0; i < px.length; i += 4) {
    const p = zuordnung.get(((px[i]! << 24) | (px[i + 1]! << 16) | (px[i + 2]! << 8) | px[i + 3]!) >>> 0)!;
    aus.set(p, i);
  }
  return { breite: bild.breite, hoehe: bild.hoehe, daten: aus };
}

export type LogoHinweis = 'raender' | 'verkleinert' | 'klein' | 'dunkler-grund' | 'farben-reduziert';

export interface LogoGrenzen {
  /** längste Kante (px) */
  maxKante: number;
  /** Höhe (px); Kopfzeile bis 15 mm, Titelseite bis 30 mm: 400 px reichen für 300 dpi */
  maxHoehe: number;
  /** Bytes des PNG */
  maxBytes: number;
  /** kürzeste Kante (px), sonst mit transparentem Rand aufgefüllt */
  minKante: number;
}

export const LOGO_GRENZEN: LogoGrenzen = { maxKante: 1600, maxHoehe: 400, maxBytes: 200 * 1024, minKante: 16 };

export interface LogoErgebnis {
  png: Uint8Array;
  breite: number;
  hoehe: number;
  form: LogoForm;
  hinweise: LogoHinweis[];
  /** Pixel des Ergebnisses (für den Farbvorschlag) */
  bild: Rgba;
}

export class LogoFehler extends Error {
  constructor(readonly art: 'leer' | 'zu-gross') {
    super(art === 'leer' ? 'Das Bild ist leer oder ganz transparent' : 'Das Logo lässt sich nicht unter die Grössengrenze bringen');
  }
}

/**
 * Logo normalisieren: Ränder ab, auf höchstens 1600 px Kante und 400 px Höhe verkleinern, als PNG ohne Metadaten
 * kodieren; über 200 KB weiter verkleinern (je Schritt 85 %, bis 48 px Höhe), zuletzt auf 256 Farben reduzieren.
 */
export function logoNormalisieren(eingabe: Rgba, grenzen: LogoGrenzen = LOGO_GRENZEN): LogoErgebnis {
  const hinweise: LogoHinweis[] = [];
  const r = inhaltRahmen(eingabe);
  if (!r) throw new LogoFehler('leer');
  let bild = eingabe;
  if (r.breite !== eingabe.breite || r.hoehe !== eingabe.hoehe) {
    bild = ausschnitt(eingabe, r);
    hinweise.push('raender');
  }
  const faktor = Math.min(1, grenzen.maxKante / Math.max(bild.breite, bild.hoehe), grenzen.maxHoehe / bild.hoehe);
  if (faktor < 1) {
    bild = verkleinern(bild, bild.breite * faktor, bild.hoehe * faktor);
    hinweise.push('verkleinert');
  }
  bild = auffuellen(bild, grenzen.minKante);
  let png = pngKodieren(bild);
  while (png.length > grenzen.maxBytes && bild.hoehe * 0.85 >= 48 && bild.breite * 0.85 >= grenzen.minKante) {
    bild = verkleinern(bild, bild.breite * 0.85, bild.hoehe * 0.85);
    if (!hinweise.includes('verkleinert')) hinweise.push('verkleinert');
    png = pngKodieren(bild);
  }
  if (png.length > grenzen.maxBytes) {
    bild = farbenReduzieren(bild);
    hinweise.push('farben-reduziert');
    png = pngKodieren(bild);
  }
  if (png.length > grenzen.maxBytes) throw new LogoFehler('zu-gross');
  if (bild.hoehe < 120) hinweise.push('klein');
  if (fuerDunklenGrund(bild)) hinweise.push('dunkler-grund');
  return { png, breite: bild.breite, hoehe: bild.hoehe, form: logoForm(bild.breite, bild.hoehe), hinweise, bild };
}

/**
 * Bis zu drei Farbvorschläge aus dem Logo: auf höchstens 64 x 64 verkleinern, Pixel unter 50 % Deckkraft und fast
 * unbunte (Chroma in OKLCH unter 0,03: Weiss, Schwarz, Grau) verwerfen, k-Means mit k = 5 in OKLab, nach Anteil sortiert.
 * Deterministisch (Start über die am weitesten entfernten Punkte).
 */
export function farbvorschlaege(bild: Rgba, k = 5, max = 3): Hex[] {
  const klein = verkleinern(bild, Math.min(64, bild.breite), Math.min(64, bild.hoehe));
  const punkte: Oklab[] = [];
  const px = klein.daten;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3]! < 128) continue;
    const lab = linearZuOklab([LIN[px[i]!]!, LIN[px[i + 1]!]!, LIN[px[i + 2]!]!]);
    if (Math.hypot(lab[1], lab[2]) < 0.03) continue;
    punkte.push(lab);
  }
  if (punkte.length === 0) return [];
  const d2 = (a: Oklab, b: Oklab) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  // Start: Mittelwert-nächster Punkt, dann jeweils der am weitesten entfernte
  const mittel: Oklab = [0, 1, 2].map((c) => punkte.reduce((s, p) => s + p[c]!, 0) / punkte.length) as Oklab;
  const zentren: Oklab[] = [punkte.reduce((a, p) => (d2(p, mittel) < d2(a, mittel) ? p : a))];
  while (zentren.length < Math.min(k, punkte.length)) {
    let weit = punkte[0]!;
    let dmax = -1;
    for (const p of punkte) {
      const d = Math.min(...zentren.map((z) => d2(p, z)));
      if (d > dmax) {
        dmax = d;
        weit = p;
      }
    }
    if (dmax <= 1e-6) break;
    zentren.push(weit);
  }
  let zuordnung = new Array<number>(punkte.length).fill(0);
  for (let runde = 0; runde < 20; runde++) {
    zuordnung = punkte.map((p) => zentren.reduce((best, z, i) => (d2(p, z) < d2(p, zentren[best]!) ? i : best), 0));
    zentren.forEach((_, i) => {
      const teil = punkte.filter((_, j) => zuordnung[j] === i);
      if (teil.length) zentren[i] = [0, 1, 2].map((c) => teil.reduce((s, p) => s + p[c]!, 0) / teil.length) as Oklab;
    });
  }
  // Kleine Gruppen (unter 3 %) sind meist Mischpixel an Kanten, keine Markenfarbe
  const anteile = zentren.map((z, i) => ({ z, n: zuordnung.filter((x) => x === i).length })).filter((x) => x.n > 0 && x.n >= punkte.length * 0.03);
  anteile.sort((a, b) => b.n - a.n || a.z[0] - b.z[0]);
  const aus: { hex: Hex; lab: Oklab }[] = [];
  for (const a of anteile) {
    if (aus.some((x) => Math.sqrt(d2(x.lab, a.z)) < 0.05)) continue;
    aus.push({ hex: linearZuHex(oklabZuLinear(a.z)), lab: a.z });
    if (aus.length >= max) break;
  }
  return aus.map((x) => x.hex);
}
