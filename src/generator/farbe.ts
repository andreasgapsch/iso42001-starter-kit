// Farbrechnung für die Dokumentgestaltung (CI-Farben): Hex, WCAG-Kontrast, OKLab/OKLCH, Kontrastkorrektur,
// Simulation von Farbfehlsichtigkeit. Rein, ohne DOM: läuft in Node, im Worker und im Hauptthread gleich.
//
// OKLab nach Björn Ottosson (2020); Helligkeit L ist dort wahrnehmungsgleich, darum verschiebt die Korrektur nur L und
// lässt Farbton und Buntheit (Chroma) stehen, soweit die Farbe im sRGB-Raum bleibt (sonst wird Chroma verringert).
// Fehlsichtigkeit nach Machado, Oliveira und Fernandes (2009), Schweregrad 1,0, Matrizen für lineares sRGB.

/** Hex ohne «#», sechs Stellen, Grossbuchstaben */
export type Hex = string;

/** «#1c5d94», «1C5D94», «#16a» -> «1C5D94»; ungültig: undefined */
export function hexNormal(eingabe: string | undefined | null): Hex | undefined {
  if (typeof eingabe !== 'string') return undefined;
  const s = eingabe.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
  if (/^[0-9a-fA-F]{3}$/.test(s)) return s.split('').map((c) => c + c).join('').toUpperCase();
  return undefined;
}

export type Rgb = [number, number, number];

/** sRGB 0 bis 255 */
export function hexZuRgb(hex: Hex): Rgb {
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

export function rgbZuHex(rgb: readonly number[]): Hex {
  return rgb
    .slice(0, 3)
    .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** Lineares sRGB 0 bis 1 */
export function hexZuLinear(hex: Hex): Rgb {
  const [r, g, b] = hexZuRgb(hex);
  return [linear(r / 255), linear(g / 255), linear(b / 255)];
}

export function linearZuHex(l: readonly number[]): Hex {
  return rgbZuHex(l.slice(0, 3).map((c) => gamma(Math.max(0, Math.min(1, c))) * 255));
}

/** Relative Leuchtdichte nach WCAG 2.2 */
export function leuchtdichte(hex: Hex): number {
  const [r, g, b] = hexZuLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrastverhältnis zweier Farben (1 bis 21) */
export function kontrast(a: Hex, b: Hex): number {
  const [h, d] = [leuchtdichte(a), leuchtdichte(b)].sort((x, y) => y - x) as [number, number];
  return (h + 0.05) / (d + 0.05);
}

export type Oklab = [number, number, number];
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export function linearZuOklab([r, g, b]: readonly number[]): Oklab {
  const l = Math.cbrt(0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!);
  const m = Math.cbrt(0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!);
  const s = Math.cbrt(0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabZuLinear([L, a, b]: Oklab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export const hexZuOklab = (hex: Hex): Oklab => linearZuOklab(hexZuLinear(hex));

export function hexZuOklch(hex: Hex): Oklch {
  const [l, a, b] = hexZuOklab(hex);
  return { l, c: Math.hypot(a, b), h: Math.atan2(b, a) };
}

const imGamut = (rgb: Rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

/** OKLCH nach Hex; liegt die Farbe ausserhalb von sRGB, wird Chroma (bei gleichem L und Farbton) verringert */
export function oklchZuHex({ l, c, h }: Oklch): Hex {
  const L = Math.max(0, Math.min(1, l));
  const bei = (chroma: number): Rgb => oklabZuLinear([L, chroma * Math.cos(h), chroma * Math.sin(h)]);
  let rgb = bei(c);
  if (!imGamut(rgb)) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 24; i++) {
      const mitte = (lo + hi) / 2;
      if (imGamut(bei(mitte))) lo = mitte;
      else hi = mitte;
    }
    rgb = bei(lo);
  }
  return linearZuHex(rgb);
}

/** Abstand zweier Farben in OKLab (Delta E OK, 0 bis rund 1; 0,02 knapp sichtbar) */
export function abstand(a: Hex, b: Hex): number {
  const [l1, a1, b1] = hexZuOklab(a);
  const [l2, a2, b2] = hexZuOklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export interface Korrektur {
  hex: Hex;
  /** Farbe wurde verändert */
  korrigiert: boolean;
  /** Abstand zum Original (OKLab) */
  deltaE: number;
  /** erreichter Kontrast gegen den Grund */
  kontrast: number;
}

/**
 * Farbe für Text oder Grafik auf einem Grund: L in OKLCH in Schritten von 0,005 senken (heller Grund) bzw. heben
 * (dunkler Grund), bis der Kontrast mindestens `min` beträgt. Text 4,5:1 (WCAG 1.4.3), Linien und Balken 3:1 (1.4.11).
 */
export function fuerText(hex: Hex, grund: Hex = 'FFFFFF', min = 4.5): Korrektur {
  const k0 = kontrast(hex, grund);
  if (k0 >= min) return { hex, korrigiert: false, deltaE: 0, kontrast: k0 };
  const o = hexZuOklch(hex);
  const dunkler = leuchtdichte(grund) > 0.18;
  let l = o.l;
  let ergebnis = hex;
  for (let i = 0; i < 400; i++) {
    l += dunkler ? -0.005 : 0.005;
    ergebnis = oklchZuHex({ ...o, l });
    if (kontrast(ergebnis, grund) >= min || l <= 0 || l >= 1) break;
  }
  if (kontrast(ergebnis, grund) < min) ergebnis = dunkler ? '000000' : 'FFFFFF';
  return { hex: ergebnis, korrigiert: true, deltaE: abstand(hex, ergebnis), kontrast: kontrast(ergebnis, grund) };
}

/**
 * Helle Fläche aus einer Farbe (Hauch für Tabellenköpfe und Beschriftungen): Farbton bleibt, L auf `l`, Chroma höchstens
 * `maxChroma`; Text in `text` muss darauf mindestens `min` Kontrast haben (sonst L weiter heben).
 */
export function hauch(hex: Hex, l: number, text: Hex, min = 7, maxChroma = 0.035): Hex {
  const o = hexZuOklch(hex);
  let L = l;
  let f = oklchZuHex({ l: L, c: Math.min(o.c, maxChroma), h: o.h });
  while (kontrast(f, text) < min && L < 1) {
    L += 0.005;
    f = oklchZuHex({ l: L, c: Math.min(o.c, maxChroma), h: o.h });
  }
  return f;
}

/** Farbton mit gegebener Helligkeit L (OKLCH), Chroma wie im Original (gekappt durch sRGB) */
export function mitHelligkeit(hex: Hex, l: number, maxChroma = Infinity): Hex {
  const o = hexZuOklch(hex);
  return oklchZuHex({ l, c: Math.min(o.c, maxChroma), h: o.h });
}

/** Lesbare Schrift auf einer Fläche: Weiss oder `dunkel`, je nachdem was mehr Kontrast hat */
export function schriftAuf(flaeche: Hex, dunkel: Hex = '121821'): Hex {
  return kontrast(flaeche, 'FFFFFF') >= kontrast(flaeche, dunkel) ? 'FFFFFF' : dunkel;
}

export type Fehlsicht = 'protanopie' | 'deuteranopie' | 'tritanopie';
export const FEHLSICHTEN: readonly Fehlsicht[] = ['protanopie', 'deuteranopie', 'tritanopie'];

/** Machado, Oliveira, Fernandes (2009), Tabelle 1, Schweregrad 1,0 (lineares RGB) */
export const MACHADO: Record<Fehlsicht, readonly number[]> = {
  protanopie: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopie: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopie: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

/** Farbe, wie sie bei der Fehlsichtigkeit erscheint (Simulation) */
export function simuliere(hex: Hex, art: Fehlsicht): Hex {
  const [r, g, b] = hexZuLinear(hex);
  const m = MACHADO[art];
  return linearZuHex([m[0]! * r + m[1]! * g + m[2]! * b, m[3]! * r + m[4]! * g + m[5]! * b, m[6]! * r + m[7]! * g + m[8]! * b]);
}

/** Kleinster OKLab-Abstand zweier Farben über Normalsicht und alle drei Fehlsichtigkeiten */
export function abstandFehlsicht(a: Hex, b: Hex): { min: number; art: Fehlsicht | 'normal' } {
  let min = abstand(a, b);
  let art: Fehlsicht | 'normal' = 'normal';
  for (const f of FEHLSICHTEN) {
    const d = abstand(simuliere(a, f), simuliere(b, f));
    if (d < min) {
      min = d;
      art = f;
    }
  }
  return { min, art };
}
