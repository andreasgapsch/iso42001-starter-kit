// Ziele «SVG-Logo» und «Gestaltungspaket»: Bereinigung mit Positivliste, Giftprüfung, Idempotenz, Rundreise
import { zlibSync } from 'fflate';
import { logoBereinigen, paketErstellen, paketLesen } from '../../../src/model/gestaltung.ts';
import { MAX_SVG_ELEMENTE, svgBereinigen } from '../../../src/generator/svg.ts';
import type { Gestaltung } from '../../../src/model/typen.ts';
import { mutiereJson, mutiereText } from '../mutation.ts';
import { OrakelFehler, type Fall, type Urteil, type Ziel } from '../typen.ts';
import type { Zufall } from '../zufall.ts';
import { ablehnung, festesTestprojekt, projektLesbar, rundreise, svgGift } from './hilfen.ts';

const KOPF = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 40" width="100" height="40">';

/** Bausteine, die die Positivliste behalten soll */
const GUT = [
  '<rect x="1" y="1" width="30" height="30" fill="#0a5"/>',
  '<circle cx="50" cy="20" r="10" fill="rgb(10,20,30)" stroke="#000" stroke-width="2"/>',
  '<path d="M0 0 L10 10 Z" fill="none" stroke="#123456"/>',
  '<g transform="translate(5 5)"><text x="0" y="10" font-size="9">Firma</text></g>',
  '<defs><linearGradient id="g1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient></defs><rect width="20" height="20" fill="url(#g1)"/>',
  '<polygon points="0,0 10,0 5,8" style="fill:#333;stroke:none"/>',
  '<ellipse cx="10" cy="10" rx="8" ry="4"/>',
];

/** Bausteine, die eine Umgehung der Prüfung versuchen (Klassen der Runden 1 und 2: E-05, E-06, E2-06, E2-07, E2-11 und weitere) */
const BOESE = [
  '<script>alert(1)</script>',
  '<rect width="5" height="5" onload="alert(1)" onclick="x()"/>',
  '<a xlink:href="javascript:alert(1)"><rect width="5" height="5"/></a>',
  '<a href="https://example.org/x"><rect width="5" height="5"/></a>',
  '<image href="https://example.org/a.png" width="5" height="5"/>',
  '<image href="data:image/svg+xml;base64,PHN2Zy8+" width="5" height="5"/>',
  '<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>',
  '<rect width="5" height="5" fill="url(https://example.org/a"/>',
  '<rect width="5" height="5" fill="url( https://example.org/a)"/>',
  '<rect width="5" height="5" style="fill:u\\72l(https://example.org/a)"/>',
  '<rect width="5" height="5" style="fill:url(&quot;https://example.org/a&quot;)"/>',
  '<style>@import url(https://example.org/a.css);</style>',
  '<rect width="5" height="5" style="background:url(//example.org/a)"/>',
  '<defs><g id="a"/></defs><use xlink:href="#a" href="https://example.org/b"/>',
  '<defs><g id="a"/></defs><use href="#a" xlink:href="https://example.org/b"/>',
  '<use href="#%61"/>',
  '<set attributeName="href" to="javascript:alert(1)"/>',
  '<animate attributeName="href" values="javascript:alert(1)"/>',
  '<ScRiPt>alert(1)</ScRiPt>',
  '<svg:script xmlns:svg="http://www.w3.org/2000/svg">alert(1)</svg:script>',
  '<rect width="5" height="5" clip-path="url(#c1)"/>',
  '<rect width="5" height="5" fill="&#x75;rl(https://example.org)"/>',
  '<![CDATA[<script>alert(1)</script>]]>',
  '<!-- <script>alert(1)</script> -->',
  '<?xml-stylesheet href="https://example.org/s.css"?>',
  '<rect width="5" height="5" xml:base="https://example.org/"/>',
  '<filter id="f"><feImage href="https://example.org/a.png"/></filter>',
];

/** Kette von Clip-Pfaden und Verweisen (Aufwand statt Gift: E2-07, E2-06) */
function aufwand(z: Zufall): string {
  const n = z.zwischen(20, 400);
  const teile: string[] = ['<defs>'];
  for (let i = 0; i < n; i++) teile.push(`<clipPath id="c${i}"${i ? ` clip-path="url(#c${i - 1})"` : ''}><rect width="5" height="5"/></clipPath>`);
  teile.push('</defs>', `<rect width="5" height="5" clip-path="url(#c${n - 1})"/>`);
  return teile.join('');
}

function viele(z: Zufall): string {
  const n = z.wahl([MAX_SVG_ELEMENTE - 5, MAX_SVG_ELEMENTE + 1, 2000, 60_000]);
  return '<rect width="1" height="1"/>'.repeat(n);
}

function tief(z: Zufall): string {
  const n = z.wahl([20, 24, 25, 30, 199, 201, 5000]);
  return '<g>'.repeat(n) + '<rect width="1" height="1"/>' + '</g>'.repeat(n);
}

function dtd(z: Zufall): string {
  return z.wahl([
    '<!DOCTYPE svg [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">]>',
    '<!DOCTYPE svg SYSTEM "https://example.org/x.dtd">',
    '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">',
  ]);
}

export function erzeugeSvgText(z: Zufall): string {
  const teile: string[] = [];
  for (let i = 0, n = z.zwischen(1, 5); i < n; i++) teile.push(z.wahl(GUT));
  const art = z.ganz(100);
  if (art < 55) for (let i = 0, n = z.zwischen(1, 3); i < n; i++) teile.splice(z.ganz(teile.length + 1), 0, z.wahl(BOESE));
  else if (art < 62) teile.push(aufwand(z));
  else if (art < 68) teile.push(viele(z));
  else if (art < 74) teile.push(tief(z));
  let svg = (art >= 74 && art < 80 ? `${dtd(z)}\n` : '') + KOPF + teile.join('') + '</svg>';
  if (art >= 80 && art < 92) svg = mutiereText(z, svg);
  else if (art >= 92) svg = z.wahl(['', '<svg/>', '<svg>', '<svg></svg>', '<html/>', '﻿' + svg, svg + svg, '<svg width="1e999" height="-1"/>', '<svg viewBox="0 0 0 0"/>', '<svg viewBox="a b c d" width="NaN"/>']);
  return svg;
}

/** Urteil über ein SVG; wird von den Zielen «svg-logo» und «gestaltungspaket» genutzt */
export function urteileSvg(text: string, wo: string): Urteil {
  let r;
  try {
    r = svgBereinigen(text);
  } catch (e) {
    return ablehnung(e, wo);
  }
  const gift = svgGift(r.svg);
  if (gift) throw new OrakelFehler(`${wo}: Gift im bereinigten SVG (${gift})`);
  // Die Bereinigung muss idempotent sein: Was sie ausgibt, muss sie unverändert wieder annehmen (Projektdatei, Zwischenstand)
  const nochmal = svgBereinigen(r.svg).svg;
  if (nochmal !== r.svg) throw new OrakelFehler(`${wo}: Bereinigung nicht idempotent`);
  return { urteil: 'angenommen' };
}

export const svgLogo: Ziel = {
  art: 'svg-logo',
  erzeuge: (z, nummer) => {
    const art = z.ganz(100);
    if (nummer % 29 === 13 || art < 3) return { name: 'ueber-grenze', endung: 'svg', daten: `${KOPF}<!--${'x'.repeat(10 * 1024 * 1024)}--></svg>`, erwartet: 'zu gross' };
    if (nummer % 13 === 7) return { name: 'viele-elemente', endung: 'svg', daten: `${KOPF}${'<rect width="1" height="1"/>'.repeat(MAX_SVG_ELEMENTE + 1)}</svg>`, erwartet: 'zu viele Elemente' };
    if (nummer % 17 === 5) {
      const n = z.wahl([25, 30]);
      return { name: 'zu-viele-ebenen', endung: 'svg', daten: `${KOPF}${'<g opacity="0.5">'.repeat(n)}<rect width="1" height="1"/>${'</g>'.repeat(n)}</svg>`, erwartet: 'Ebenen' };
    }
    if (nummer % 19 === 3) {
      const n = z.wahl([250, 1000]);
      return { name: 'zu-tief', endung: 'svg', daten: `${KOPF}${'<g>'.repeat(n)}<rect width="1" height="1"/>${'</g>'.repeat(n)}</svg>`, erwartet: 'zu tief' };
    }
    return { name: 'svg', endung: 'svg', daten: erzeugeSvgText(z) };
  },
  urteile: (f) => urteileSvg(f.daten as string, 'SVG'),
};

// ---------------------------------------------------------------------------------------------------------------------
// Gestaltungspaket

function crc32(b: Uint8Array): number {
  let c = ~0;
  for (const x of b) {
    c ^= x;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** Kleines gültiges PNG (Graustufen) für Logos */
function png(breite: number, hoehe: number): Uint8Array {
  const kasten = (typ: string, daten: Uint8Array): Uint8Array => {
    const aus = new Uint8Array(12 + daten.length);
    const dv = new DataView(aus.buffer);
    dv.setUint32(0, daten.length);
    aus.set(new TextEncoder().encode(typ), 4);
    aus.set(daten, 8);
    dv.setUint32(8 + daten.length, crc32(aus.subarray(4, 8 + daten.length)));
    return aus;
  };
  const kopf = new Uint8Array(13);
  const dv = new DataView(kopf.buffer);
  dv.setUint32(0, breite);
  dv.setUint32(4, hoehe);
  kopf.set([8, 0, 0, 0, 0], 8);
  const zeilen = new Uint8Array((breite + 1) * hoehe);
  const idat = zlibSync(zeilen);
  const teile = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), kasten('IHDR', kopf), kasten('IDAT', idat), kasten('IEND', new Uint8Array())];
  const alles = new Uint8Array(teile.reduce((s, t) => s + t.length, 0));
  let o = 0;
  for (const t of teile) {
    alles.set(t, o);
    o += t.length;
  }
  return alles;
}

const base64 = (b: Uint8Array): string => Buffer.from(b).toString('base64');

function gestaltung(z: Zufall): Gestaltung {
  const g: Gestaltung = {};
  if (z.mit(0.8)) g.farben = { primaer: z.wahl(['0A5A8C', 'FF0000', '123ABC']), sekundaer: '222222', akzent: 'E2A200', ueberschriften: true };
  if (z.mit(0.5)) g.schrift = { paar: z.wahl(['arial', 'calibri', 'georgia', 'eigen'] as const), ...(z.mit(0.3) ? { titel: 'Arial', text: 'Arial' } : {}) };
  if (z.mit(0.5)) g.kopfzeile = { logoPosition: z.wahl(['links', 'rechts'] as const), firmennameZeigen: z.mit(0.5), logoHoeheMm: z.zwischen(6, 15) };
  // Das Schema verlangt ein PNG; das SVG kommt als Zusatz hinzu (Kopfzeile und Titelseite)
  const logo = z.ganz(3);
  if (logo < 2) {
    const breite = z.zwischen(16, 200);
    const hoehe = z.zwischen(16, 200);
    g.logo = { png: `data:image/png;base64,${base64(png(breite, hoehe))}`, breite, hoehe, ...(logo === 0 ? { svg: erzeugeSvgText(z) } : {}) } as Gestaltung['logo'];
  }
  return g;
}

export const gestaltungspaket: Ziel = {
  art: 'gestaltungspaket',
  erzeuge: (z, nummer) => {
    const art = z.ganz(100);
    const paket = paketErstellen(gestaltung(z));
    if (nummer % 10 === 0) return { name: 'gueltig', endung: 'json', daten: JSON.stringify(paket) };
    if (art < 60) return { name: 'json-mutation', endung: 'json', daten: JSON.stringify(mutiereJson(z, paket)) };
    if (art < 85) return { name: 'text-mutation', endung: 'json', daten: mutiereText(z, JSON.stringify(paket)) };
    return { name: 'aufbau', endung: 'json', daten: z.wahl(['', '{}', '{"art":"aims-gestaltung"}', '{"art":"aims-gestaltung","version":2,"gestaltung":{}}', '{"art":"aims-gestaltung","version":1,"gestaltung":[]}', '{"art":"aims-gestaltung","version":1,"gestaltung":{"logo":{"png":"data:image/png;base64,AAAA"}}}', '{"art":"aims-gestaltung","version":1,"gestaltung":{"logo":{"svg":null}}}']) };
  },
  urteile: (f) => {
    let r;
    try {
      r = paketLesen(f.daten as string);
    } catch (e) {
      throw new OrakelFehler(`paketLesen wirft (${e instanceof Error ? `${e.name}: ${e.message}` : String(e)})`.slice(0, 300));
    }
    if (!r.ok) return { urteil: 'abgelehnt', meldung: `paket: ${r.grund}` };
    // Ablauf wie in Gestaltung.tsx: bereinigen, ins Projekt setzen, mit dem Schema prüfen, übernehmen
    try {
      logoBereinigen(r.gestaltung);
    } catch (e) {
      throw new OrakelFehler(`logoBereinigen wirft (${e instanceof Error ? `${e.name}: ${e.message}` : String(e)})`.slice(0, 300));
    }
    const probe = festesTestprojekt();
    probe.organisation.gestaltung = r.gestaltung;
    const gepruefte = JSON.parse(JSON.stringify(probe)) as unknown;
    try {
      projektLesbar(gepruefte, 'Gestaltung im Projekt');
    } catch {
      return { urteil: 'abgelehnt', meldung: 'paket: schema' };
    }
    const svg = r.gestaltung.logo?.svg;
    if (typeof svg === 'string') {
      const gift = svgGift(svg);
      if (gift) throw new OrakelFehler(`Gift im SVG des übernommenen Pakets (${gift})`);
    }
    rundreise(probe, 'Projekt mit Gestaltungspaket');
    return { urteil: 'angenommen' };
  },
};
