// Neutrale Szene für Grafiken: ein kleiner Baum aus Element, Attributen und Kindern. zuSvg() macht daraus eine
// SVG-Zeichenkette (Leitfaden, START, PNG), src/grafik/preact/Szene.tsx dieselbe Szene als Preact-Knoten (App, ohne
// innerHTML wegen Trusted Types). Deterministisch: feste Attributreihenfolge (wie angegeben), Zahlen auf 0,1 gerundet,
// IDs nur aus dem Präfix des Aufrufers. Farben nur über Klassen g-* (App: Tokens in stil.css; eigenständig: palette.ts).
import { paletteCss } from './palette.ts';

export type Wert = string | number | undefined | null | false;
export type Attribute = Record<string, Wert>;

export interface Knoten {
  el: string;
  a?: Attribute;
  k?: Kind[];
}
export type Kind = Knoten | string;

/** Element mit Attributen und Kindern; leere Kinder (null, false, undefined) entfallen. */
export function el(name: string, a?: Attribute, ...kinder: (Kind | Kind[] | null | undefined | false)[]): Knoten {
  const k: Kind[] = [];
  for (const x of kinder.flat()) if (x !== null && x !== undefined && x !== false) k.push(x);
  return k.length ? { el: name, a, k } : { el: name, a };
}

/** Auf 0,1 gerundet (stabile Zeichenketten, -0 wird 0). */
export function rund(x: number): number {
  const r = Math.round(x * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function maskiere(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]!);
}

function attributText(a: Attribute | undefined): string {
  if (!a) return '';
  let s = '';
  for (const [k, v] of Object.entries(a)) {
    if (v === undefined || v === null || v === false) continue;
    s += ` ${k}="${maskiere(typeof v === 'number' ? String(rund(v)) : v)}"`;
  }
  return s;
}

function knotenText(k: Kind): string {
  if (typeof k === 'string') return maskiere(k);
  const inhalt = (k.k ?? []).map(knotenText).join('');
  return inhalt ? `<${k.el}${attributText(k.a)}>${inhalt}</${k.el}>` : `<${k.el}${attributText(k.a)}/>`;
}

export interface SvgOptionen {
  /** Eigenständige Datei: Palette als <style> und xmlns (Leitfaden, START, PNG). Ohne: nur Klassen, Farben setzt die Seite. */
  stil?: boolean;
  /** Palette für stil: hell (Druck, Standard) oder dunkel */
  palette?: 'hell' | 'dunkel';
}

/** Szene als SVG-Zeichenkette. Die Wurzel muss ein svg-Element sein. */
export function zuSvg(wurzel: Knoten, o: SvgOptionen = {}): string {
  if (wurzel.el !== 'svg') throw new Error('zuSvg: Wurzel muss <svg> sein');
  if (!o.stil) return knotenText(wurzel);
  const a: Attribute = { xmlns: 'http://www.w3.org/2000/svg', ...wurzel.a };
  const kinder: Kind[] = [...(wurzel.k ?? [])];
  // <title> und <desc> bleiben die ersten Kinder (Bildschirmleser), danach der Stil
  const pos = kinder.findIndex((x) => typeof x === 'string' || (x.el !== 'title' && x.el !== 'desc'));
  kinder.splice(pos < 0 ? kinder.length : pos, 0, { el: 'style', k: [paletteCss(o.palette ?? 'hell')] });
  return knotenText({ el: 'svg', a, k: kinder });
}

/** Grobe Textbreite in px (Archivo, Durchschnitt 0,56 em; Ziffern tabellarisch). Für Umbruch und Platz, nicht für Satz. */
export function textBreite(text: string, groesse = 12): number {
  let b = 0;
  for (const z of text) b += /[il.,:;'’|!]/.test(z) ? 0.3 : /[mwMW]/.test(z) ? 0.85 : /[A-ZÄÖÜ]/.test(z) ? 0.66 : 0.54;
  return rund(b * groesse);
}

/** Kürzt Text auf eine Breite mit «…». */
export function kuerze(text: string, breite: number, groesse = 12): string {
  if (textBreite(text, groesse) <= breite) return text;
  let t = text;
  while (t.length > 1 && textBreite(`${t}…`, groesse) > breite) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Bricht Text an Leerzeichen in Zeilen bis zur Breite um (ohne Kürzen); ein einzelnes zu langes Wort bleibt ganz. */
export function umbreche(text: string, breite: number, groesse = 12): string[] {
  const zeilen: string[] = [];
  let zeile = '';
  for (const wort of text.split(/\s+/).filter(Boolean)) {
    const kandidat = zeile ? `${zeile} ${wort}` : wort;
    if (zeile && textBreite(kandidat, groesse) > breite) {
      zeilen.push(zeile);
      zeile = wort;
    } else zeile = kandidat;
  }
  if (zeile || !zeilen.length) zeilen.push(zeile);
  return zeilen;
}

/** Kopf einer Szene: role=img mit Titel und Beschreibung (aria-labelledby). */
export function svgWurzel(id: string, breite: number, hoehe: number, titel: string, beschreibung: string, klasse: string, kinder: Kind[]): Knoten {
  return el(
    'svg',
    { class: `g-svg ${klasse}`, viewBox: `0 0 ${rund(breite)} ${rund(hoehe)}`, width: rund(breite), height: rund(hoehe), role: 'img', 'aria-labelledby': `${id}-titel ${id}-desc`, focusable: 'false' },
    el('title', { id: `${id}-titel` }, titel),
    el('desc', { id: `${id}-desc` }, beschreibung),
    ...kinder,
  );
}
