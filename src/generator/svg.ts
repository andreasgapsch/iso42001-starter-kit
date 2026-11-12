// SVG-Logo bereinigen (Whitelist), rein und ohne DOMParser: läuft im Hauptthread, im Worker und in Node-Tests gleich.
// Gerastert wird ein SVG im Browser über <img> (keine Skripte, keine externen Ressourcen, CSP connect-src 'none'); diese
// Bereinigung ist für das zusätzlich gespeicherte SVG (DOCX ab Word 2019) und als zweite Schranke vor dem Rastern.
// Erlaubt sind nur Formen, Text, Verläufe, Beschneidung und Verweise innerhalb der Datei (href="#…", url(#…)).

/** Elemente eines Logos */
const ELEMENTE = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs',
  'lineargradient', 'radialgradient', 'stop', 'clippath', 'use', 'title', 'desc',
]);

/** Attribute (Kleinschreibung); Ereignisse (on*), style mit url(…) nach aussen, href nach aussen fallen weg */
const ATTRIBUTE = new Set([
  'id', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'fr', 'dx', 'dy', 'd', 'points', 'width',
  'height', 'viewbox', 'preserveaspectratio', 'transform', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width',
  'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity',
  'opacity', 'clip-path', 'clip-rule', 'clippathunits', 'gradientunits', 'gradienttransform', 'spreadmethod', 'offset',
  'stop-color', 'stop-opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor',
  'dominant-baseline', 'letter-spacing', 'word-spacing', 'visibility', 'display', 'paint-order', 'vector-effect',
  'color', 'style', 'href', 'xlink:href', 'xmlns', 'xmlns:xlink', 'version', 'xml:space', 'textlength', 'lengthadjust',
]);

/** CSS-Eigenschaften im style-Attribut */
const STIL = new Set([
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'opacity', 'clip-path', 'clip-rule', 'stop-color',
  'stop-opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline',
  'letter-spacing', 'word-spacing', 'visibility', 'display', 'paint-order', 'color', 'mix-blend-mode', 'isolation',
]);

/** Art des Fehlers für die Oberfläche (Schlüssel gestaltung.logo.svg_code.*): die Meldung selbst bleibt Technikzeile */
export type SvgFehlerCode = 'aufbau' | 'entitaeten' | 'aufwand' | 'verweis';

export class SvgFehler extends Error {
  constructor(meldung: string, readonly code: SvgFehlerCode = 'aufbau') {
    super(meldung);
  }
}

/** Höchstens so viele gezeichnete Elemente nach Auflösen aller <use> (Schutz vor «use-Bomben») */
export const MAX_SVG_ELEMENTE = 20_000;
/** Höchstens so viele Elemente in der Datei */
export const MAX_SVG_KNOTEN = 50_000;
/** Verschachtelung einschliesslich der Verweise */
const MAX_SVG_TIEFE = 400;
/**
 * Geschachtelte Ebenen (Deckkraft, Beschneidung, Mischmodus): Jede braucht beim Zeichnen ein eigenes Zwischenbild in voller Grösse.
 * 120 Ebenen bei 2400 px gemessen 32 s, ohne dass die kleineren Stufen des Rasterns das ankündigen. Ein Logo hat wenige.
 */
export const MAX_SVG_EBENEN = 24;

interface Knoten {
  name: string;
  attr: [string, string][];
  kinder: (Knoten | string)[];
}

const ENTITAETEN: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function entitaeten(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e.startsWith('#x')) return String.fromCodePoint(Math.min(0x10ffff, parseInt(e.slice(2), 16)));
    if (e.startsWith('#')) return String.fromCodePoint(Math.min(0x10ffff, parseInt(e.slice(1), 10)));
    return ENTITAETEN[e] ?? '';
  });
}

const maske = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Minimaler XML-Leser für SVG: Elemente, Attribute, Text; Kommentare, PI, CDATA und DOCTYPE ohne interne Teilmenge */
function lesen(text: string): Knoten {
  let i = 0;
  const wurzel: Knoten = { name: '#wurzel', attr: [], kinder: [] };
  const stapel: Knoten[] = [wurzel];
  const n = text.length;
  while (i < n) {
    const lt = text.indexOf('<', i);
    if (lt < 0) {
      stapel.at(-1)!.kinder.push(entitaeten(text.slice(i)));
      break;
    }
    if (lt > i) stapel.at(-1)!.kinder.push(entitaeten(text.slice(i, lt)));
    if (text.startsWith('<!--', lt)) {
      const e = text.indexOf('-->', lt + 4);
      if (e < 0) throw new SvgFehler('Kommentar nicht geschlossen');
      i = e + 3;
    } else if (text.startsWith('<?', lt)) {
      const e = text.indexOf('?>', lt + 2);
      if (e < 0) throw new SvgFehler('Verarbeitungsanweisung nicht geschlossen');
      i = e + 2;
    } else if (text.startsWith('<![CDATA[', lt)) {
      const e = text.indexOf(']]>', lt + 9);
      if (e < 0) throw new SvgFehler('CDATA nicht geschlossen');
      stapel.at(-1)!.kinder.push(text.slice(lt + 9, e));
      i = e + 3;
    } else if (text.startsWith('<!', lt)) {
      const e = text.indexOf('>', lt + 2);
      if (e < 0) throw new SvgFehler('Deklaration nicht geschlossen');
      // Interne DTD-Teilmenge (Entitäten, «Billion Laughs», externe Entitäten) nie zulassen
      if (text.slice(lt, e).includes('[')) throw new SvgFehler('DOCTYPE mit Entitäten', 'entitaeten');
      i = e + 1;
    } else if (text.startsWith('</', lt)) {
      const e = text.indexOf('>', lt + 2);
      if (e < 0) throw new SvgFehler('Endtag nicht geschlossen');
      const name = text.slice(lt + 2, e).trim();
      const offen = stapel.pop();
      if (!offen || offen.name !== name) throw new SvgFehler(`Endtag </${name}> passt nicht`);
      i = e + 1;
    } else {
      const m = /^<([A-Za-z_][\w.:-]*)/.exec(text.slice(lt, lt + 200));
      if (!m) throw new SvgFehler('Ungültiger Tag');
      const k: Knoten = { name: m[1]!, attr: [], kinder: [] };
      let j = lt + m[0].length;
      for (;;) {
        while (j < n && /\s/.test(text[j]!)) j++;
        if (text.startsWith('/>', j)) {
          j += 2;
          stapel.at(-1)!.kinder.push(k);
          break;
        }
        if (text[j] === '>') {
          j++;
          stapel.at(-1)!.kinder.push(k);
          stapel.push(k);
          break;
        }
        const a = /^([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/.exec(text.slice(j, j + 200000));
        if (!a) throw new SvgFehler(`Ungültiges Attribut in <${k.name}>`);
        k.attr.push([a[1]!, entitaeten(a[3] ?? a[4] ?? '')]);
        j += a[0].length;
      }
      i = j;
    }
    if (stapel.length > 200) throw new SvgFehler('zu tief verschachtelt', 'aufwand');
  }
  if (stapel.length !== 1) throw new SvgFehler('Element nicht geschlossen');
  return wurzel;
}

/** url(…) nur auf Elemente derselben Datei */
// Auch ohne schliessende Klammer: CSS schliesst sie am Ende selbst. Jedes url( muss daher mit # beginnen
const nurInterneUrl = (v: string) => [...v.matchAll(/url\s*\(\s*['"]?\s*(.?)/gi)].every((m) => m[1] === '#');
// Backslash: CSS-Escapes wie u\72l( umgingen sonst die Prüfung der url(…); Kommentare und fremde Bildquellen ebenso nie
const verboten = (v: string) => /javascript:|expression\s*\(|@import|behavior\s*:|-moz-binding|<|data:|\\|\/\*|image-set|\bimage\s*\(|cross-fade|\bsrc\s*\(|\belement\s*\(/i.test(v);

function stilBereinigen(s: string): string {
  return s
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const p = d.indexOf(':');
      return p < 0 ? undefined : ([d.slice(0, p).trim().toLowerCase(), d.slice(p + 1).trim()] as const);
    })
    .filter((x): x is readonly [string, string] => !!x && STIL.has(x[0]) && !verboten(x[1]) && nurInterneUrl(x[1]))
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

function attributOk(name: string, wert: string): string | undefined {
  const k = name.toLowerCase();
  if (!ATTRIBUTE.has(k) || k.startsWith('on')) return undefined;
  // % nicht: Der Browser dekodiert den Teil hinter # vor der Suche, die Aufwandsprüfung sähe ein anderes Ziel
  if (k === 'href' || k === 'xlink:href') return /^#[^%]*$/.test(wert.trim()) ? wert.trim() : undefined;
  if (k === 'xmlns') return 'http://www.w3.org/2000/svg';
  if (k === 'xmlns:xlink') return 'http://www.w3.org/1999/xlink';
  if (k === 'style') {
    const s = stilBereinigen(wert);
    return s || undefined;
  }
  if (verboten(wert) || !nurInterneUrl(wert)) return undefined;
  return wert;
}

function schreiben(k: Knoten, entfernt: Set<string>): string {
  const lokal = k.name.includes(':') ? k.name : k.name;
  if (!ELEMENTE.has(lokal.toLowerCase())) {
    entfernt.add(k.name);
    return '';
  }
  const attr = k.attr
    .map(([a, w]) => {
      const ok = attributOk(a, w);
      if (ok === undefined) entfernt.add(`@${a}`);
      return ok === undefined ? '' : ` ${a}="${maske(ok)}"`;
    })
    .join('');
  const innen = k.kinder.map((c) => (typeof c === 'string' ? maske(c) : schreiben(c, entfernt))).join('');
  return innen ? `<${k.name}${attr}>${innen}</${k.name}>` : `<${k.name}${attr}/>`;
}

export interface SvgErgebnis {
  svg: string;
  /** Entfernte Elemente und Attribute (mit @), z. B. «script», «@onload» */
  entfernt: string[];
  /** Seitenverhältnis aus viewBox oder width/height (px), falls bestimmbar */
  breite?: number;
  hoehe?: number;
}

const EINHEIT: Record<string, number> = { '': 1, px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };

function laenge(v: string | undefined): number | undefined {
  const m = /^\s*([\d.]+)\s*(px|pt|pc|mm|cm|in)?\s*$/i.exec(v ?? '');
  if (!m) return undefined;
  const z = Number(m[1]) * (EINHEIT[(m[2] ?? '').toLowerCase()] ?? 1);
  return Number.isFinite(z) && z > 0 ? z : undefined;
}

/** Alle Ziele innerhalb der Datei, auf die dieses Element verweist. Prüfung und Browser müssen dasselbe Ziel lesen. */
function verweisZiele(k: Knoten): string[] {
  const ziele: string[] = [];
  const hrefs = k.attr.filter(([a]) => a.toLowerCase() === 'href' || a.toLowerCase() === 'xlink:href').map(([, w]) => w.trim());
  // href und xlink:href zugleich: Der Browser nimmt href, die Datei anderer Leser das andere. Eindeutig oder gar nicht
  if (hrefs.length > 1 && new Set(hrefs).size > 1) throw new SvgFehler('mehrdeutiger Verweis', 'verweis');
  for (const h of hrefs) if (h.startsWith('#')) ziele.push(h.slice(1));
  for (const [a, w] of k.attr) {
    if (a.toLowerCase() === 'href' || a.toLowerCase() === 'xlink:href') continue;
    for (const m of w.matchAll(/url\s*\(\s*['"]?\s*#([^'")\s]*)/gi)) ziele.push(m[1]!);
  }
  return ziele;
}

/**
 * Aufwand beim Zeichnen schätzen: Elemente je Teilbaum, jedes <use> zählt den Teilbaum seines Ziels. Verschachtelte <use>
 * vervielfachen sich sonst aus 1 KB auf Milliarden Elemente; Zyklen sind unzulässig.
 */
function aufwandPruefen(svg: Knoten): void {
  const nachId = new Map<string, Knoten>();
  let knoten = 0;
  const sammeln = (k: Knoten): void => {
    if (++knoten > MAX_SVG_KNOTEN) throw new SvgFehler('zu viele Elemente', 'aufwand');
    for (const [a, w] of k.attr) if (a.toLowerCase() === 'id' && !nachId.has(w)) nachId.set(w, k);
    for (const c of k.kinder) if (typeof c !== 'string') sammeln(c);
  };
  sammeln(svg);
  const fertig = new Map<Knoten, number>();
  const offen = new Set<Knoten>();
  const zaehlen = (k: Knoten, tiefe: number): number => {
    const bekannt = fertig.get(k);
    if (bekannt !== undefined) return bekannt;
    if (offen.has(k)) throw new SvgFehler('Verweis auf sich selbst', 'verweis');
    if (tiefe > MAX_SVG_TIEFE) throw new SvgFehler('zu tief verschachtelt', 'aufwand');
    offen.add(k);
    let n = 1;
    for (const c of k.kinder) if (typeof c !== 'string') n += zaehlen(c, tiefe + 1);
    // Jeder Verweis kostet beim Zeichnen den Teilbaum seines Ziels: <use>, aber auch clip-path und Füllungen über url(#…)
    for (const z of verweisZiele(k)) {
      const ziel = nachId.get(z);
      if (ziel) n += zaehlen(ziel, tiefe + 1);
    }
    if (n > MAX_SVG_ELEMENTE) throw new SvgFehler('zu viele Elemente beim Zeichnen', 'aufwand');
    offen.delete(k);
    fertig.set(k, n);
    return n;
  };
  zaehlen(svg, 0);
  const ebenen = new Map<Knoten, number>();
  const istEbene = (k: Knoten): boolean => k.attr.some(([a, w]) => {
    const n = a.toLowerCase();
    return n === 'opacity' || n === 'clip-path' || (n === 'style' && /opacity|clip-path|mix-blend-mode|isolation/i.test(w));
  });
  // Zyklen hat zaehlen bereits ausgeschlossen
  const tiefe = (k: Knoten): number => {
    const bekannt = ebenen.get(k);
    if (bekannt !== undefined) return bekannt;
    let n = 0;
    for (const c of k.kinder) if (typeof c !== 'string') n = Math.max(n, tiefe(c));
    for (const z of verweisZiele(k)) {
      const ziel = nachId.get(z);
      if (ziel) n = Math.max(n, tiefe(ziel));
    }
    const w = n + (istEbene(k) ? 1 : 0);
    ebenen.set(k, w);
    return w;
  };
  if (tiefe(svg) > MAX_SVG_EBENEN) throw new SvgFehler('zu viele Ebenen übereinander', 'aufwand');
}

/** SVG bereinigen; Wurzel muss <svg> sein. Wirft SvgFehler bei ungültigem oder gefährlichem Aufbau. */
export function svgBereinigen(text: string): SvgErgebnis {
  if (text.length > 10 * 1024 * 1024) throw new SvgFehler('SVG zu gross', 'aufwand');
  const baum = lesen(text.replace(/^\uFEFF/, ''));
  const elemente = baum.kinder.filter((c): c is Knoten => typeof c !== 'string');
  if (elemente.length !== 1 || elemente[0]!.name.toLowerCase() !== 'svg') throw new SvgFehler('Wurzel ist kein <svg>');
  const svg = elemente[0]!;
  aufwandPruefen(svg);
  if (!svg.attr.some(([a]) => a === 'xmlns')) svg.attr.unshift(['xmlns', 'http://www.w3.org/2000/svg']);
  const brauchtXlink = JSON.stringify(svg).includes('"xlink:href"');
  if (brauchtXlink && !svg.attr.some(([a]) => a === 'xmlns:xlink')) svg.attr.push(['xmlns:xlink', 'http://www.w3.org/1999/xlink']);
  const entfernt = new Set<string>();
  const aus = schreiben(svg, entfernt);
  const attr = Object.fromEntries(svg.attr.map(([a, w]) => [a.toLowerCase(), w]));
  const vb = (attr['viewbox'] ?? '').trim().split(/[\s,]+/).map(Number);
  let breite = laenge(attr['width']);
  let hoehe = laenge(attr['height']);
  if ((!breite || !hoehe) && vb.length === 4 && vb[2]! > 0 && vb[3]! > 0) {
    if (breite && !hoehe) hoehe = (breite * vb[3]!) / vb[2]!;
    else if (hoehe && !breite) breite = (hoehe * vb[2]!) / vb[3]!;
    else {
      breite = vb[2];
      hoehe = vb[3];
    }
  }
  return { svg: aus, entfernt: [...entfernt].sort(), ...(breite && hoehe ? { breite, hoehe } : {}) };
}

/**
 * Feste Grösse in Pixeln für das Rastern setzen (width/height an der Wurzel, viewBox ergänzt): Firefox und WebKit
 * zeichnen ein SVG ohne Grösse sonst mit 0 oder 300 x 150 px.
 */
export function svgMitGroesse(svg: string, breite: number, hoehe: number, viewBox?: string): string {
  return svg.replace(/^<svg\b([^>]*?)(\/?)>/, (_, attr: string, zu: string) => {
    let a = attr.replace(/\s(width|height)="[^"]*"/g, '');
    if (!/\sviewBox="/.test(a) && viewBox) a += ` viewBox="${viewBox}"`;
    return `<svg${a} width="${Math.round(breite)}" height="${Math.round(hoehe)}"${zu}>`;
  });
}

export interface SvgVorbereitet {
  svg: string;
  breite: number;
  hoehe: number;
  viewBox: [number, number, number, number];
  entfernt: string[];
}

/** Bereinigtes SVG mit Grösse (ohne Angaben: 300 x 150 wie im Browser) und viewBox (sonst aus der Grösse) */
export function svgMitMassen(r: SvgErgebnis): SvgVorbereitet {
  const vbText = /^<svg\b[^>]*\sviewBox="([^"]*)"/.exec(r.svg)?.[1];
  const vb = vbText?.trim().split(/[\s,]+/).map(Number);
  const breite = r.breite ?? 300;
  const hoehe = r.hoehe ?? 150;
  const viewBox: [number, number, number, number] = vb?.length === 4 && vb.every(Number.isFinite) && vb[2]! > 0 && vb[3]! > 0 ? (vb as [number, number, number, number]) : [0, 0, breite, hoehe];
  return { svg: r.svg, breite, hoehe, viewBox, entfernt: r.entfernt };
}

/** Bereinigen und Masse bestimmen (wirft SvgFehler) */
export function svgVorbereiten(text: string): SvgVorbereitet {
  return svgMitMassen(svgBereinigen(text));
}

/** viewBox auf den Inhalt (Rahmen in Pixeln der Rasterung) zuschneiden, damit SVG und PNG gleich aussehen */
export function svgZuschneiden(s: SvgVorbereitet, rahmen: { x: number; y: number; breite: number; hoehe: number }, gerastert: { breite: number; hoehe: number }): string {
  const [x, y, w, h] = s.viewBox;
  const fx = w / gerastert.breite;
  const fy = h / gerastert.hoehe;
  const r = (z: number) => Math.round(z * 1000) / 1000;
  const vb = `${r(x + rahmen.x * fx)} ${r(y + rahmen.y * fy)} ${r(rahmen.breite * fx)} ${r(rahmen.hoehe * fy)}`;
  return s.svg.replace(/^<svg\b([^>]*?)(\/?)>/, (_, a: string, zu: string) => `<svg${a.replace(/\s(width|height|viewBox|preserveAspectRatio)="[^"]*"/g, '')} viewBox="${vb}"${zu}>`);
}
