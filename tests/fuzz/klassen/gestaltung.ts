// Klassen des Gestaltungspakets mit SVG-Logo: Befunde E-04, E-05, E-06, E2-06, E2-07, E2-11 (Logo über Paket oder Hochladen)
import { MAX_SVG_EBENEN, MAX_SVG_ELEMENTE, svgBereinigen } from '../../../src/generator/svg.ts';
import { pngDataUrl, pngKodieren } from '../../../src/generator/png.ts';
import { logoBereinigen, paketErstellen, paketLesen } from '../../../src/model/gestaltung.ts';
import type { Gestaltung } from '../../../src/model/typen.ts';
import { OrakelFehler, type Urteil } from '../typen.ts';
import type { Zufall } from '../zufall.ts';
import { gestaltungspaket } from '../ziele/svg.ts';
import { svgGift } from '../ziele/hilfen.ts';
import { text, type Klasse, type KlassenFall } from './typen.ts';

const KOPF = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 40" width="100" height="40">';
/** Gültiges PNG 16x16 (Mindestkante), mit dem eigenen Kodierer erzeugt */
const PNG_16 = pngDataUrl(pngKodieren({ breite: 16, hoehe: 16, daten: new Uint8Array(16 * 16 * 4).fill(128) }));

const paket = (svg: string): string => JSON.stringify(paketErstellen({ logo: { png: PNG_16, breite: 16, hoehe: 16, svg } } as Gestaltung));
const svgVon = (f: KlassenFall): string => ((JSON.parse(f.daten as string) as { gestaltung: Gestaltung }).gestaltung.logo?.svg ?? '');
const fall = (name: string, svgInnen: string, roh = false): KlassenFall => ({ name, endung: 'json', daten: paket(roh ? svgInnen : `${KOPF}${svgInnen}</svg>`) });
/** Regressionsdateien sind SVG-Dateien (Originale der Runde 2) oder Pakete */
const ausDatei = (b: Uint8Array): KlassenFall => {
  const t = text(b);
  return { name: 'original', endung: 'json', daten: t.trimStart().startsWith('{') ? t : paket(t) };
};

/**
 * Urteil wie die App (Paket lesen, Logo bereinigen, ins Projekt, Schema, Rundreise) und dazu unmittelbar die Bereinigung des SVG
 * wie beim Hochladen. `zusatz` prüft das bereinigte SVG auf das, was die Klasse ausschliesst.
 */
function urteileMit(zusatz?: (sauber: string) => string | undefined) {
  return (f: KlassenFall): Urteil => {
    const u = gestaltungspaket.urteile(f) as Urteil;
    const r = paketLesen(f.daten as string);
    if (r.ok) {
      try {
        logoBereinigen(r.gestaltung);
      } catch (e) {
        throw new OrakelFehler(`logoBereinigen wirft (${String(e)})`);
      }
      const sauber = r.gestaltung.logo?.svg;
      if (typeof sauber === 'string') {
        const gift = svgGift(sauber) ?? zusatz?.(sauber);
        if (gift) throw new OrakelFehler(`Gift im bereinigten SVG des Pakets (${gift})`);
      }
    }
    // Dasselbe SVG beim Hochladen: Lehnt die Bereinigung ab, gilt das als Urteil der Klasse, und das Paket darf das SVG nicht behalten
    let hoch: string;
    try {
      hoch = svgBereinigen(svgVon(f)).svg;
    } catch (e) {
      if (!(e instanceof Error) || e instanceof TypeError || e instanceof RangeError) throw new OrakelFehler(`svgBereinigen: Rohfehler (${String(e)})`);
      if (r.ok && typeof r.gestaltung.logo?.svg === 'string') throw new OrakelFehler('Skript oder Aufwand: abgelehntes SVG bleibt im übernommenen Paket');
      return { urteil: 'abgelehnt', meldung: `SVG: ${e.message}`.slice(0, 200) };
    }
    const gift = svgGift(hoch) ?? zusatz?.(hoch);
    if (gift) throw new OrakelFehler(`Gift im bereinigten SVG beim Hochladen (${gift})`);
    return u;
  };
}

/** CSS-Escapes und Zeichenreferenzen auflösen, wie Browser sie lesen (unabhängig vom Bereiniger) */
function wieBrowser(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/\\([0-9a-f]{1,6})\s?/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\(.)/g, '$1')
    .replace(/\/\*.*?\*\//g, '');
}

const aktivNachBrowser = (svg: string): boolean => /url\s*\(\s*['"]?\s*(?!#)|javascript\s*:|<\s*script|\son\w+\s*=|<\s*foreignobject|href\s*=\s*["']\s*(?!#)/i.test(wieBrowser(svg));

// ---------------------------------------------------------------------------------------------------------------------
// E-04: Skript, Ereignisattribute, foreignObject, externe Bilder im Paket landeten unverändert in den Dokumenten

const SKRIPT = [
  '<script>alert(1)</script>', '<ScRiPt>alert(1)</ScRiPt>', '<svg:script xmlns:svg="http://www.w3.org/2000/svg">x()</svg:script>', '<script href="data:,alert(1)"/>',
  '<rect width="5" height="5" onload="x()"/>', '<rect width="5" height="5" ONCLICK="x()"/>', '<g onmouseover = "x()"><rect width="1" height="1"/></g>', '<rect width="5" height="5" onbegin="x()"/>',
  '<foreignObject width="9" height="9"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>', '<foreignobject><body/></foreignobject>',
  '<a href="javascript:alert(1)"><rect width="5" height="5"/></a>', '<a xlink:href="java&#x09;script:x()"><rect width="5" height="5"/></a>', '<a xlink:href=" JavaScript:x()"><rect width="5" height="5"/></a>',
  '<image href="https://example.org/a.png" width="5" height="5"/>', '<image xlink:href="//example.org/a.png" width="5" height="5"/>', '<image href="data:image/svg+xml,&lt;svg onload=x()&gt;" width="5" height="5"/>',
  '<set attributeName="href" to="javascript:x()"/>', '<animate attributeName="onload" values="x()"/>', '<iframe src="https://example.org"/>', '<use href="data:image/svg+xml;base64,PHN2Zy8+#a"/>',
];

export const skript: Klasse = {
  id: 'gestaltung-skript',
  art: 'gestaltungspaket',
  befunde: ['E-04'],
  titel: 'Skript, Ereignisattribut, foreignObject oder externer Verweis im SVG des Pakets: nie im Ergebnis',
  regression: 'tests/fixtures/fuzz/regression/gestaltung-skript.json',
  variante: (z) => {
    const teile = ['<rect width="10" height="10" fill="#0a5"/>'];
    for (let i = 0, n = z.zwischen(1, 3); i < n; i++) teile.splice(z.ganz(teile.length + 1), 0, z.wahl(SKRIPT));
    let innen = teile.join('');
    if (z.mit(0.3)) {
      const n = z.zwischen(1, 5);
      innen = `${'<g>'.repeat(n)}${innen}${'</g>'.repeat(n)}`;
    }
    return fall('skript', innen);
  },
  urteile: urteileMit(),
  ohneSchutz: (f) => svgGift(svgVon(f)) !== undefined || aktivNachBrowser(svgVon(f)),
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E-05: CSS-Escapes umgingen die Positivliste (fill:u\72l(...))

const ESCAPES = ['u\\72l(', '\\75rl(', 'ur\\6c(', '\\000075rl(', 'u\\rl(', 'U\\52L(', 'u\\72 l(', 'u&#x72;l(', 'u&#114;l(', 'u\\72\nl(' ];

export const cssEscape: Klasse = {
  id: 'gestaltung-css-escape',
  art: 'gestaltungspaket',
  befunde: ['E-05'],
  titel: 'CSS-Escapes und Zeichenreferenzen in Farben und Stilen: kein externer Verweis im Ergebnis',
  regression: 'tests/fixtures/fuzz/regression/gestaltung-css-escape.svg',
  variante: (z) => {
    const url = `${z.wahl(ESCAPES)}${z.wahl(['https://example.org/esc)', '//example.org/a)', 'javascript:x())', '"https://example.org")', 'data:,x)'])}`;
    const wie = z.ganz(3);
    const innen =
      wie === 0 ? `<rect width="5" height="5" style="fill:${url}"/>` : wie === 1 ? `<rect width="5" height="5" fill="${url.replace(/"/g, '&quot;')}"/>` : `<g style="stroke:${url};fill:#000"><rect width="5" height="5"/></g>`;
    return fall('css-escape', innen);
  },
  urteile: urteileMit((s) => (/\\/.test(s) ? 'Backslash im Ergebnis' : undefined)),
  ohneSchutz: (f) => aktivNachBrowser(svgVon(f)),
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E2-11: `url(` ohne schliessende Klammer, mit Leerraum, Anführungszeichen, gross geschrieben, in jedem Attribut

export const urlOffen: Klasse = {
  id: 'gestaltung-url-offen',
  art: 'gestaltungspaket',
  befunde: ['E2-11'],
  titel: 'url( ohne # in jeder Schreibweise (offen, Leerraum, Anführung, gross): kein externer Verweis im Ergebnis',
  regression: 'tests/fixtures/fuzz/regression/gestaltung-url-offen.svg',
  variante: (z) => {
    const attr = z.wahl(['fill', 'stroke', 'filter', 'mask', 'clip-path', 'marker-start', 'marker-end', 'cursor']);
    const url = `${z.wahl(['url(', 'URL(', 'url (', 'url(\n', 'url( ', 'Url('])}${z.wahl(['', '"', "'", '&quot;'])}${z.wahl(['https://example.org/a', '//example.org/a', 'a.svg#x', 'file:///etc/x', ' #a'.trim() === '#a' ? 'x#a' : ''])}${z.wahl(['', ')', '"', '"'])}`;
    const innen = z.mit(0.5) ? `<rect width="5" height="5" ${attr}="${url.replace(/"/g, '&quot;')}"/>` : `<rect width="5" height="5" style="${attr}:${url.replace(/"/g, "'")}"/>`;
    return fall(`url-offen ${attr}`, innen);
  },
  urteile: urteileMit(),
  ohneSchutz: (f) => /url\s*\(\s*(['"]|&quot;)?\s*(?!#)/i.test(svgVon(f)),
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E2-06: <use> mit href und xlink:href, die sich widersprechen (Prüfung nahm das erste, der Browser das zweite)

export const doppelverweis: Klasse = {
  id: 'gestaltung-doppelverweis',
  art: 'gestaltungspaket',
  befunde: ['E2-06'],
  titel: 'Widersprüchliche Verweisattribute an <use>: abgelehnt oder ohne Widerspruch im Ergebnis',
  regression: 'tests/fixtures/fuzz/regression/gestaltung-doppelverweis.svg',
  variante: (z) => {
    const defs = '<defs><g id="a"><rect width="1" height="1"/></g><g id="b"><use href="#a"/><use href="#a"/></g></defs>';
    const ziele = ['#a', '#b', 'https://example.org/x#a', '#%61', '#a ', '#c'];
    const erst = z.wahl(['href', 'xlink:href']);
    const zweit = erst === 'href' ? 'xlink:href' : 'href';
    const x = z.wahl(ziele);
    let y = z.wahl(ziele);
    if (y === x) y = x === '#a' ? '#b' : '#a';
    return fall('doppelverweis', `${defs}<use ${erst}="${x}" ${zweit}="${y}"/>`);
  },
  urteile: urteileMit((s) => {
    for (const m of s.matchAll(/<use\b[^>]*>/g)) {
      const h = /\shref="([^"]*)"/.exec(m[0])?.[1];
      const x = /\sxlink:href="([^"]*)"/.exec(m[0])?.[1];
      if (h !== undefined && x !== undefined && h !== x) return 'widersprüchliche Verweise an use';
    }
    return undefined;
  }),
  ohneSchutz: (f) => {
    const m = /<use ([\w:]+)="([^"]*)" ([\w:]+)="([^"]*)"\/>/.exec(svgVon(f));
    return !!m && m[2] !== m[4];
  },
  ausDatei,
};

// ---------------------------------------------------------------------------------------------------------------------
// E-06, E2-07: Aufwand beim Zeichnen: verschachtelte <use>, Ketten von Clip-Pfaden und Masken, viele Ebenen

export const aufwand: Klasse = {
  id: 'gestaltung-aufwand',
  art: 'gestaltungspaket',
  befunde: ['E-06', 'E2-07'],
  titel: 'Teure SVG (use-Bombe, Clip- und Maskenkette, Ebenen mit Deckkraft): Ablehnung mit Meldung in höchstens 5 s',
  regression: 'tests/fixtures/fuzz/regression/gestaltung-aufwand.svg',
  variante: (z) => {
    const art = z.ganz(3);
    if (art === 0) {
      // use-Bombe: jede Ebene verweist mehrfach auf die vorige
      const tiefe = z.zwischen(4, 9);
      const breite = z.zwischen(4, 10);
      const g = ['<g id="u0"><rect width="1" height="1"/></g>'];
      for (let i = 1; i <= tiefe; i++) g.push(`<g id="u${i}">${Array.from({ length: breite }, () => `<use ${z.wahl(['href', 'xlink:href'])}="#u${i - 1}"/>`).join('')}</g>`);
      return { ...fall(`use-bombe ${breite}^${tiefe}`, `<defs>${g.join('')}</defs><use href="#u${tiefe}"/>`), mussAbgelehnt: breite ** tiefe > MAX_SVG_ELEMENTE * 4 };
    }
    if (art === 1) {
      const n = z.zwischen(MAX_SVG_EBENEN + 1, 600);
      const wer = z.wahl(['clipPath', 'mask']);
      const verweis = wer === 'clipPath' ? 'clip-path' : 'mask';
      const teile: string[] = ['<defs>'];
      for (let i = 0; i < n; i++) teile.push(`<${wer} id="c${i}"${i ? ` ${verweis}="url(#c${i - 1})"` : ''}><rect width="5" height="5"/></${wer}>`);
      teile.push('</defs>', `<rect width="5" height="5" ${verweis}="url(#c${n - 1})"/>`);
      // Masken entfernt die Positivliste ganz; Clip-Pfade bleiben und müssen an der Ebenengrenze scheitern
      return { ...fall(`${wer}-kette ${n}`, teile.join('')), mussAbgelehnt: wer === 'clipPath' };
    }
    const n = z.zwischen(MAX_SVG_EBENEN + 1, 300);
    const ebene = z.wahl(['<g opacity="0.5">', '<g style="opacity:.5">', '<g filter="url(#f)">', '<g style="mix-blend-mode:multiply">']);
    return { ...fall(`ebenen ${n}`, `<defs><filter id="f"><feGaussianBlur stdDeviation="1"/></filter></defs>${ebene.repeat(n)}<rect width="1" height="1"/>${'</g>'.repeat(n)}`), mussAbgelehnt: !ebene.includes('mix-blend') && !ebene.includes('filter') };
  },
  urteile: urteileMit((s) => ((s.match(/<(clipPath|mask)\b/g)?.length ?? 0) > MAX_SVG_EBENEN ? 'Kette über der Ebenengrenze im Ergebnis' : undefined)),
  // Ohne Aufwandsprüfung: die Zahl der gezeichneten Elemente oder die Ebenentiefe liegt über dem, was der Browser verkraftet
  ohneSchutz: (f) => {
    const s = svgVon(f);
    // Gezeichnete Elemente nach Auflösen aller Verweise (use, clip-path, mask): je Block mit Kennung die Summe der Verweisziele
    const bloecke = new Map<string, string>();
    for (const m of s.matchAll(/<(\w+) id="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)) bloecke.set(m[2]!, m[3]!);
    const kosten = new Map<string, number>();
    const k = (id: string, tiefe = 0): number => {
      const bekannt = kosten.get(id);
      if (bekannt !== undefined) return bekannt;
      let n = 1;
      const innen = bloecke.get(id);
      if (innen !== undefined && tiefe < 1000) for (const r of innen.matchAll(/(?:href="#|url\(#)([^")]+)/g)) n += k(r[1]!, tiefe + 1);
      kosten.set(id, Math.min(n, 1e12));
      return Math.min(n, 1e12);
    };
    if ([...bloecke.keys()].some((id) => k(id) > MAX_SVG_ELEMENTE)) return true;
    if ((s.match(/<(clipPath|mask) /g)?.length ?? 0) > MAX_SVG_EBENEN) return true;
    return (s.match(/<g (opacity|style|filter)=/g)?.length ?? 0) > MAX_SVG_EBENEN;
  },
  ausDatei,
};

export const GESTALTUNG_KLASSEN: Klasse[] = [skript, cssEscape, urlOffen, doppelverweis, aufwand];
