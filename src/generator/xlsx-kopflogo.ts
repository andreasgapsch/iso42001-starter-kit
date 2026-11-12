// Logo in der gedruckten Kopfzeile von Excel-Blättern. exceljs 4.4 schreibt keine Bilder in Kopf- und Fusszeilen; Excel
// erwartet dafür je Blatt eine VML-Zeichnung (legacyDrawingHF) mit einer Form «LH», «CH» oder «RH» (links, Mitte, rechts
// in der Kopfzeile) und den Code &G im Kopftext (ECMA-376 Teil 1, 18.3.1.50 und 18.3.1.39). Die Nachbearbeitung setzt das
// in das fertige Paket ein, mit festen Namen und IDs (reproduzierbar, teileNormalisieren bleibt unberührt).
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { xmlText } from './eigenschaften.ts';
import type { Masse } from './gestaltung.ts';

const REL_VML = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing';
const REL_BILD = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
/** Elemente, die in CT_Worksheet nach legacyDrawingHF stehen */
const DANACH = ['<picture', '<oleObjects', '<controls', '<webPublishItems', '<tableParts', '<extLst', '</worksheet>'];

function vml(form: 'LH' | 'RH', masse: Masse, titel: string): string {
  // Masse in Punkt (96 px = 72 pt)
  const pt = (px: number) => Math.round(px * 0.75 * 100) / 100;
  return (
    '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    '<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout>' +
    '<v:shapetype id="_x0000_t75" coordsize="21600,21600" o:spt="75" o:preferrelative="t" path="m@4@5l@4@11@9@11@9@5xe" filled="f" stroked="f">' +
    '<v:stroke joinstyle="miter"/><v:formulas>' +
    '<v:f eqn="if lineDrawn pixelLineWidth 0"/><v:f eqn="sum @0 1 0"/><v:f eqn="sum 0 0 @1"/><v:f eqn="prod @2 1 2"/>' +
    '<v:f eqn="prod @3 21600 pixelWidth"/><v:f eqn="prod @3 21600 pixelHeight"/><v:f eqn="sum @0 0 1"/><v:f eqn="prod @6 1 2"/>' +
    '<v:f eqn="prod @7 21600 pixelWidth"/><v:f eqn="sum @8 21600 0"/><v:f eqn="prod @7 21600 pixelHeight"/><v:f eqn="sum @10 21600 0"/>' +
    '</v:formulas><v:path o:extrusionok="f" gradientshapeok="t" o:connecttype="rect"/><o:lock v:ext="edit" aspectratio="t"/></v:shapetype>' +
    `<v:shape id="${form}" o:spid="_x0000_s1025" type="#_x0000_t75" style="position:absolute;margin-left:0;margin-top:0;width:${pt(masse.breite)}pt;height:${pt(masse.hoehe)}pt;z-index:1">` +
    `<v:imagedata o:relid="rId1" o:title="${xmlText(titel)}"/><o:lock v:ext="edit" rotation="t"/></v:shape>` +
    '</xml>'
  );
}

const rels = (eintraege: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${eintraege}</Relationships>`;

/** Kopflogo in alle Blätter mit &G im Kopftext einsetzen; ohne solche Blätter bleibt das Paket unverändert */
export function kopflogoEinsetzen(paket: Uint8Array, png: Uint8Array, masse: Masse, position: 'links' | 'rechts', titel: string): Uint8Array {
  const teile = unzipSync(paket);
  const blaetter = Object.keys(teile)
    .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))
    .filter((p) => /<oddHeader>[^<]*&amp;G/.test(strFromU8(teile[p]!)))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
  if (blaetter.length === 0) return paket;
  const neu: Zippable = { ...teile };
  neu['xl/media/kopflogo.png'] = png;
  for (const blatt of blaetter) {
    const n = /(\d+)\.xml$/.exec(blatt)![1]!;
    neu[`xl/drawings/vmlDrawingHF${n}.vml`] = strToU8(vml(position === 'links' ? 'LH' : 'RH', masse, titel));
    neu[`xl/drawings/_rels/vmlDrawingHF${n}.vml.rels`] = strToU8(rels(`<Relationship Id="rId1" Type="${REL_BILD}" Target="../media/kopflogo.png"/>`));
    const relPfad = `xl/worksheets/_rels/sheet${n}.xml.rels`;
    const eintrag = `<Relationship Id="rIdKopflogo" Type="${REL_VML}" Target="../drawings/vmlDrawingHF${n}.vml"/>`;
    const alt = teile[relPfad] ? strFromU8(teile[relPfad]!) : undefined;
    neu[relPfad] = strToU8(alt ? alt.replace('</Relationships>', `${eintrag}</Relationships>`) : rels(eintrag));
    let xml = strFromU8(teile[blatt]!);
    if (!/xmlns:r="/.test(xml.slice(0, xml.indexOf('>', xml.indexOf('<worksheet'))))) xml = xml.replace('<worksheet ', `<worksheet xmlns:r="${R_NS}" `);
    const stelle = Math.min(...DANACH.map((t) => xml.indexOf(t)).filter((i) => i >= 0));
    xml = `${xml.slice(0, stelle)}<legacyDrawingHF r:id="rIdKopflogo"/>${xml.slice(stelle)}`;
    neu[blatt] = strToU8(xml);
  }
  let typen = strFromU8(teile['[Content_Types].xml']!);
  if (!/Extension="vml"/i.test(typen)) typen = typen.replace('<Default ', '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/><Default ');
  if (!/Extension="png"/i.test(typen)) typen = typen.replace('<Default ', '<Default Extension="png" ContentType="image/png"/><Default ');
  neu['[Content_Types].xml'] = strToU8(typen);
  return zipSync(neu, { level: 6, mtime: new Date('1980-01-01T00:00:00Z') });
}
