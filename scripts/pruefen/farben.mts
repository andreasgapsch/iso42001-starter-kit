// Farben nur über CSS-Variablen: In src/app/**/*.css und src/start/START.html.tpl stehen Farbwerte ausschliesslich
// in Definitionen von CSS-Variablen (--name: #hex). Alle anderen Deklarationen verwenden var(--name), currentColor,
// transparent oder inherit. So greifen Hell- und Dunkelmodus überall, und der Kontrast lässt sich an einer Stelle prüfen.
// Aufruf: npx tsx scripts/pruefen/farben.mts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Befund, REPO, dateienUnter, formatiere, relativ } from './gemeinsam.mts';

const NAMEN = [
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood',
  'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray',
  'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen',
  'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue',
  'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey',
  'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral',
  'lightcyan', 'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue',
  'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine',
  'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred',
  'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid',
  'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple',
  'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver', 'skyblue',
  'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet', 'wheat',
  'white', 'whitesmoke', 'yellow', 'yellowgreen',
];
const LITERAL = new RegExp(String.raw`#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(?:${NAMEN.join('|')})\b`, 'i');

export interface FarbBefund {
  datei: string;
  zeile: number;
  text: string;
}

/** Sucht Farbwerte ausserhalb von Variablendefinitionen in CSS-Text. `versatz` = Zeilennummer des CSS-Anfangs (1-basiert). */
export function farbenInCss(datei: string, css: string, versatz = 1): FarbBefund[] {
  const befunde: FarbBefund[] = [];
  // Kommentare durch Leerzeichen ersetzen (Zeilenumbrüche bleiben für die Zeilennummern)
  const ohne = css.replace(/\/\*[\s\S]*?\*\//g, (k) => k.replace(/[^\n]/g, ' '));
  const deklaration = /([-\w]+)\s*:\s*([^;{}]+)(?=;|})/g;
  for (const m of ohne.matchAll(deklaration)) {
    const [, eigenschaft, wert] = m as unknown as [string, string, string];
    if (eigenschaft.startsWith('--')) continue;
    // Selektoren wie «a:visited {» oder «:root:not(...)» sind keine Deklarationen
    if (/^\s*[\w-]+\s*\(/.test(wert) && /^(not|is|where|has|nth-child|nth-of-type)$/.test(eigenschaft)) continue;
    const ohneVar = wert.replace(/var\(--[\w-]+(?:\s*,[^)]*)?\)/g, '');
    if (!LITERAL.test(ohneVar)) continue;
    // Eigenschaften ohne Farbbezug (z. B. font-family: Segoe UI) nicht melden, ausser bei Hex- und Funktionswerten
    const farbig = /color|background|border|outline|shadow|fill|stroke|caret|accent|decoration|column-rule|scrollbar/i.test(eigenschaft);
    if (!farbig && !/#[0-9a-f]{3,8}\b|\(/i.test(ohneVar)) continue;
    const zeile = versatz + ohne.slice(0, m.index).split('\n').length - 1;
    befunde.push({ datei, zeile, text: `${eigenschaft}: ${wert.trim()}` });
  }
  return befunde;
}

/** CSS aus einer HTML-Vorlage: <style>-Blöcke, style-Attribute und Farbattribute (fill, stroke, color, bgcolor). */
export function farbenInHtml(datei: string, html: string): FarbBefund[] {
  const befunde: FarbBefund[] = [];
  const zeileVon = (i: number) => html.slice(0, i).split('\n').length;
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    const start = m.index + m[0].indexOf(m[1]!);
    befunde.push(...farbenInCss(datei, m[1]!, zeileVon(start)));
  }
  for (const m of html.matchAll(/\sstyle="([^"]*)"/gi)) befunde.push(...farbenInCss(datei, `${m[1]};`, zeileVon(m.index)));
  for (const m of html.matchAll(/\s(fill|stroke|color|bgcolor|stop-color)="([^"]*)"/gi)) {
    const wert = m[2]!;
    if (/^(none|currentColor|transparent|inherit)$/i.test(wert) || /^var\(--/.test(wert)) continue;
    befunde.push({ datei, zeile: zeileVon(m.index), text: `${m[1]}="${wert}"` });
  }
  return befunde;
}

export function pruefeFarben(repo = REPO): FarbBefund[] {
  const css = dateienUnter(join(repo, 'src/app'), (p) => p.endsWith('.css'));
  const befunde = css.flatMap((p) => farbenInCss(relativ(p, repo), readFileSync(p, 'utf8')));
  const start = join(repo, 'src/start/START.html.tpl');
  befunde.push(...farbenInHtml(relativ(start, repo), readFileSync(start, 'utf8')));
  return befunde;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  const b = pruefeFarben();
  for (const x of b) console.log(formatiere({ tor: 'Farben', datei: x.datei, zeile: x.zeile, meldung: `Farbwert ausserhalb einer CSS-Variablen: ${x.text}`, schwere: 'fehler' } satisfies Befund));
  console.log(b.length ? `${b.length} hart codierte Farben` : 'Farben nur über CSS-Variablen');
  process.exitCode = b.length ? 1 : 0;
}
