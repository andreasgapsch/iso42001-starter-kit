// Ziel «Word-Vorlage»: DOCX als ZIP, Design, Kopfzeilenbild; Ergebnis gültig oder Ablehnung mit Meldung
import { strToU8, zipSync, type Zippable } from 'fflate';
import { ausWordVorlage } from '../../../src/generator/vorlage-import.ts';
import { mutiereBytes, mutiereText } from '../mutation.ts';
import { OrakelFehler, type Fall, type Urteil, type Ziel } from '../typen.ts';
import type { Zufall } from '../zufall.ts';
import { ablehnung, ZIP_ZEIT } from './hilfen.ts';

const THEMA = (z: Zufall): string =>
  `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:clrScheme name="x"><a:dk2><a:srgbClr val="1F3864"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>` +
  ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'].map((n) => `<a:${n}><a:srgbClr val="${z.wahl(['0A5A8C', 'C00000', '70AD47', 'FFC000', '7F7F7F', '5B9BD5', 'GGGGGG', ''])}"/></a:${n}>`).join('') +
  `</a:clrScheme><a:fontScheme name="f"><a:majorFont><a:latin typeface="Cambria"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`;

const KOPF = (id: string): string =>
  `<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:p><w:r><w:drawing><a:blip r:embed="${id}"/></w:drawing></w:r></w:p></w:hdr>`;

const RELS = (ziel: string): string =>
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="${ziel}"/></Relationships>`;

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';

function grund(z: Zufall): Record<string, Uint8Array> {
  const t: Record<string, Uint8Array> = {
    'word/document.xml': strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>'),
    'word/theme/theme1.xml': strToU8(THEMA(z)),
    '[Content_Types].xml': strToU8('<Types/>'),
  };
  if (z.mit(0.7)) {
    const bild = z.wahl(['media/logo.svg', 'media/logo.png', 'media/logo.emf', '../media/x.png', 'https://example.org/a.png', '/etc/passwd', 'media/fehlt.png']);
    t['word/header1.xml'] = strToU8(KOPF('rId1'));
    t['word/_rels/header1.xml.rels'] = strToU8(RELS(bild));
    t['word/media/logo.svg'] = strToU8(SVG);
    t['word/media/logo.png'] = z.bytes(z.zwischen(0, 300));
  }
  return t;
}

function zip(t: Record<string, Uint8Array>): Uint8Array {
  const baum: Zippable = {};
  for (const [k, v] of Object.entries(t)) Object.defineProperty(baum, k, { value: v, enumerable: true, configurable: true, writable: true });
  return zipSync(baum, { mtime: ZIP_ZEIT });
}

function erzeuge(z: Zufall, nummer: number): Fall {
  const art = nummer % 10 === 0 ? 0 : z.ganz(100);
  const t = grund(z);
  if (art < 8) return { name: 'gueltig', endung: 'docx', daten: zip(t) };
  if (art < 30) {
    const k = z.wahl(Object.keys(t));
    t[k] = strToU8(mutiereText(z, new TextDecoder().decode(t[k])));
    return { name: 'xml-mutation', endung: 'docx', daten: zip(t) };
  }
  if (art < 40) {
    delete t[z.wahl(Object.keys(t))];
    return { name: 'teil-fehlt', endung: 'docx', daten: zip(t) };
  }
  if (art < 52) return { name: 'zip-bytes', endung: 'docx', daten: mutiereBytes(z, zip(t)) };
  if (art < 62) {
    // Rückwärtsverweise: Muster, die lange Suchen in Regex auslösen können
    t['word/theme/theme1.xml'] = strToU8(`<a:theme>${'<a:latin '.repeat(z.zwischen(1000, 30_000))}`);
    t['word/header1.xml'] = strToU8(`<w:hdr>${'<a:blip '.repeat(z.zwischen(1000, 30_000))}`);
    return { name: 'regex-last', endung: 'docx', daten: zip(t) };
  }
  if (art < 70) {
    t['word/theme/theme1.xml'] = strToU8(THEMA(z) + ' '.repeat(2 * 1024 * 1024 + z.ganz(5)));
    return { name: 'xml-gross', endung: 'docx', daten: zip(t) };
  }
  if (art < 78) {
    // Über 20 MB je Teil: Ablehnungsart «zu gross»
    t['word/media/logo.png'] = new Uint8Array(z.zwischen(21, 30) * 1024 * 1024);
    return { name: 'bild-gross', endung: 'docx', daten: zip(t), erwartet: 'zu gross' };
  }
  if (art < 82) {
    for (let i = 0; i < 5001; i++) t[`word/media/m${i}.bin`] = new Uint8Array(0);
    return { name: 'viele-eintraege', endung: 'docx', daten: zip(t), erwartet: 'zu gross' };
  }
  if (art < 88) {
    t[z.wahl(['__proto__', 'word/__proto__', 'constructor/x', '../x'])] = strToU8('x');
    return { name: 'pfad', endung: 'docx', daten: zip(t) };
  }
  return { name: 'aufbau', endung: 'docx', daten: z.wahl([new Uint8Array(0), strToU8('kein zip'), zip({}), zip({ 'word/document.xml': new Uint8Array(0) })]) };
}

function urteile(f: Fall): Urteil {
  let v;
  try {
    v = ausWordVorlage(f.daten as Uint8Array);
  } catch (e) {
    return ablehnung(e, 'ausWordVorlage');
  }
  for (const c of v.farben) if (!/^[0-9A-Fa-f]{6}$/.test(c.hex)) throw new OrakelFehler(`Ungültige Farbe im Vorschlag: ${c.hex.slice(0, 20)}`);
  for (const h of [v.primaer, v.sekundaer, v.akzent]) if (h !== undefined && !/^[0-9A-Fa-f]{6}$/.test(h)) throw new OrakelFehler(`Ungültige Farbe im Vorschlag: ${String(h).slice(0, 20)}`);
  if (v.logo && !(v.logo.daten instanceof Uint8Array)) throw new OrakelFehler('Logo ohne Bytes');
  return { urteil: 'angenommen' };
}

export const wordVorlage: Ziel = { art: 'word-vorlage', erzeuge, urteile };
