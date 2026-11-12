// Ziel «draw.io in der App»: Seiten lesen (auch komprimiert), Ablauf importieren. Dieselben Fälle dienen im Browser-Ziel
// «Diagrammansicht» (tests/fuzz/browser/drawio-viewer.ts, Lauf im Browser in P18).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, strToU8 } from 'fflate';
import { DrawioFehler, MAX_DATEI, MAX_ZELLEN, drawioImportieren, drawioSeitenLesen } from '../../../src/prozesse/drawio.ts';
import { mutiereBytes, mutiereText } from '../mutation.ts';
import { OrakelFehler, type Fall, type Urteil, type Ziel } from '../typen.ts';
import type { Zufall } from '../zufall.ts';
import { ablehnung } from './hilfen.ts';

const ROLLEN = [
  { schluessel: 'fachbereich', text: 'Fachbereich' },
  { schluessel: 'aims', text: 'AIMS-Verantwortliche/r' },
];

const ZELLE = (id: string, o: { parent?: string; vertex?: boolean; edge?: boolean; source?: string; target?: string; value?: string; style?: string } = {}): string =>
  `<mxCell id="${id}" value="${o.value ?? ''}" style="${o.style ?? ''}" parent="${o.parent ?? '1'}"${o.vertex ? ' vertex="1"' : ''}${o.edge ? ' edge="1"' : ''}${o.source ? ` source="${o.source}"` : ''}${o.target ? ` target="${o.target}"` : ''}><mxGeometry ${o.edge ? 'relative="1"' : 'x="10" y="10" width="80" height="40"'} as="geometry"/></mxCell>`;

const MODELL = (zellen: string): string => `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${zellen}</root></mxGraphModel>`;

/** Aufbauten der Hänger aus Runde 2 (E2-03): doppelte Kennungen, Elternzyklen, Kanten in den Zyklus, __proto__ als Kennung */
function haenger(z: Zufall): string {
  const id = () => z.wahl(['a', 'b', 'c0', 'c1', '__proto__', 'constructor', '0', '1']);
  const n = z.zwischen(2, 7);
  const zellen: string[] = [];
  for (let i = 0; i < n; i++) {
    const art = z.ganz(4);
    const e = id();
    const p = z.mit(0.5) ? e : id();
    if (art === 0) zellen.push(ZELLE(e, { parent: p, vertex: true, value: 'x' }));
    else if (art === 1) zellen.push(ZELLE(id(), { parent: p, edge: true, source: id(), target: id() }));
    else if (art === 2) zellen.push(`<object id="${e}" label="o"><mxCell parent="${p}" vertex="1"><mxGeometry width="80" height="40" as="geometry"/></mxCell></object>`);
    else zellen.push(ZELLE(e, { parent: z.mit(0.3) ? 'fehlt' : '1', vertex: true }));
  }
  return MODELL(zellen.join(''));
}

/** Gültiger Ablauf mit Bahnen, Schritten und Kanten */
function ablauf(z: Zufall): string {
  const zellen = [ZELLE('lane-a', { vertex: true, value: 'Fachbereich', style: 'swimlane;startSize=30;' }), ZELLE('lane-b', { vertex: true, value: 'AIMS-Verantwortliche/r', style: 'swimlane;startSize=30;' })];
  const n = z.zwischen(2, 8);
  for (let i = 0; i < n; i++) zellen.push(ZELLE(`s${i}`, { vertex: true, parent: i % 2 ? 'lane-b' : 'lane-a', value: `Schritt ${i} &lt;b&gt;fett&lt;/b&gt;`, style: z.wahl(['', 'ellipse;', 'rhombus;', 'rounded=1;arcSize=50;', 'shape=image;image=https://example.org/x.png;']) }));
  for (let i = 1; i < n; i++) zellen.push(ZELLE(`k${i}`, { edge: true, source: `s${i - 1}`, target: `s${z.mit(0.1) ? 'x' : i}` }));
  return MODELL(zellen.join(''));
}

function seiteKomprimiert(modell: string, z: Zufall): string {
  const roh = z.mit(0.5) ? encodeURIComponent(modell) : modell;
  return Buffer.from(deflateSync(strToU8(roh))).toString('base64');
}

function datei(seiten: string[], z: Zufall): string {
  const innen = seiten.map((s, i) => `<diagram id="PR-0${i + 1}" name="S${i}">${s}</diagram>`).join('');
  return z.mit(0.5) ? `<mxfile host="x" pages="${seiten.length}">${innen}</mxfile>` : innen.slice(0, innen.indexOf('</diagram>') + 10);
}

/** Grenzfälle mit erwarteter Ablehnungsart, in jedem Pflichtteil (Nummern teilerfremd, damit alle vorkommen) */
function grenzfall(z: Zufall, nummer: number): Fall | undefined {
  if (nummer % 13 === 6) return { name: 'viele-seiten', endung: 'drawio', daten: `<mxfile>${Array.from({ length: z.wahl([201, 400]) }, (_, i) => `<diagram id="P${i}">${MODELL('')}</diagram>`).join('')}</mxfile>`, erwartet: 'Mehr als 200 Seiten' };
  if (nummer % 17 === 4) {
    // Kurze Zellen, damit die Datei unter 2 MB bleibt und die Zellgrenze (nicht die Dateigrenze) greift
    const zellen = Array.from({ length: MAX_ZELLEN + 5 }, (_, i) => `<mxCell id="z${i}" vertex="1" parent="1"/>`).join('');
    return { name: 'viele-zellen', endung: 'drawio', daten: datei([MODELL(zellen)], z), erwartet: 'Formen' };
  }
  if (nummer % 19 === 7) {
    const gross = `<mxGraphModel><root><mxCell id="0"/>${'<mxCell id="x" value="' + 'a'.repeat(z.zwischen(3, 6) * 1024 * 1024) + '"/>'}</root></mxGraphModel>`;
    return { name: 'bombe', endung: 'drawio', daten: datei([seiteKomprimiert(gross, z)], z), erwartet: 'grösser' };
  }
  if (nummer % 23 === 9) return { name: 'ueber-grenze', endung: 'drawio', daten: ' '.repeat(MAX_DATEI + 1 + z.ganz(100)), erwartet: 'grösser' };
  return undefined;
}

function erzeuge(z: Zufall, nummer: number): Fall {
  const grenze = grenzfall(z, nummer);
  if (grenze) return grenze;
  return erzeugeZufall(z, nummer);
}

function erzeugeZufall(z: Zufall, nummer: number): Fall {
  const art = nummer % 10 === 0 ? 0 : z.ganz(100);
  const modell = () => (z.mit(0.5) ? haenger(z) : ablauf(z));
  if (art < 8) return { name: 'gueltig', endung: 'drawio', daten: datei([ablauf(z)], z) };
  if (art < 20) return { name: 'haenger', endung: 'drawio', daten: haenger(z) };
  if (art < 30) return { name: 'mxfile-unkomprimiert', endung: 'drawio', daten: datei([modell(), modell()], z) };
  if (art < 42) return { name: 'komprimiert', endung: 'drawio', daten: datei([seiteKomprimiert(modell(), z), seiteKomprimiert(ablauf(z), z)], z) };
  if (art < 52) return { name: 'text-mutation', endung: 'drawio', daten: mutiereText(z, datei([ablauf(z)], z)) };
  if (art < 60) return { name: 'komprimiert-mutation', endung: 'drawio', daten: datei([Buffer.from(mutiereBytes(z, deflateSync(strToU8(ablauf(z))))).toString('base64')], z) };
  if (art < 66) {
    // DTD und Entitäten in allen Schreibweisen (E-07, E2-04): unkomprimiert, URL-kodiert, im Strom, neben Kindern
    const dtd = z.wahl(['<!DOCTYPE mxGraphModel [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]>', '<!DOCTYPE x SYSTEM "https://example.org/x.dtd">', '<!ENTITY x "y">']);
    const m = `${dtd}${ablauf(z)}`;
    const wie = z.ganz(4);
    if (wie === 0) return { name: 'dtd-roh', endung: 'drawio', daten: `<mxfile><diagram id="PR-01">${m}</diagram></mxfile>` };
    if (wie === 1) return { name: 'dtd-url', endung: 'drawio', daten: datei([encodeURIComponent(m).replace(/%3C%21/g, '%3C%21')], z) };
    if (wie === 2) return { name: 'dtd-komprimiert', endung: 'drawio', daten: datei([seiteKomprimiert(m, z)], z) };
    return { name: 'dtd-neben-kind', endung: 'drawio', daten: `<mxfile><diagram id="PR-01">${m}<mxGraphModel/></diagram></mxfile>` };
  }
  if (art < 84) {
    // .drawio.svg: Diagramm im Attribut content
    const inhalt = ablauf(z).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return { name: 'svg-content', endung: 'svg', daten: `<svg xmlns="http://www.w3.org/2000/svg" content="${z.mit(0.7) ? inhalt : ''}"><rect/></svg>` };
  }
  if (art < 90) return { name: 'tief', endung: 'drawio', daten: `<mxGraphModel><root>${'<g>'.repeat(z.wahl([100, 300, 5000]))}</root></mxGraphModel>` };
  return { name: 'aufbau', endung: 'drawio', daten: z.wahl(['', '<', 'kein xml', '<mxfile/>', '<diagram/>', '<mxGraphModel/>', '<mxGraphModel><root/></mxGraphModel>', '﻿<mxfile><diagram>%</diagram></mxfile>', '<mxfile><diagram>AAAA</diagram></mxfile>']) };
}

/** Haenger-Dateien aus Runde 2 (Fall-Dateien im Repository) */
export const HAENGER_ORDNER = 'tests/fixtures/runde2/drawio-haenger';
export const haengerDatei = (name: string): string => readFileSync(join(process.cwd(), HAENGER_ORDNER, name), 'utf8');

export function urteileDrawio(daten: string | Uint8Array): Urteil {
  let seiten;
  try {
    seiten = drawioSeitenLesen(daten);
  } catch (e) {
    return ablehnung(e, 'drawioSeitenLesen');
  }
  if (seiten.length === 0) throw new OrakelFehler('Keine Seiten und keine Ablehnung');
  const zaehler: Record<string, number> = { seiten: seiten.length };
  let erste: string | undefined;
  for (const s of seiten) {
    try {
      const imp = drawioImportieren(s, { rollen: ROLLEN });
      const ids = new Set<string>();
      for (const sch of imp.schritte) {
        if (typeof sch.id !== 'string' || sch.id === '') throw new OrakelFehler('Schritt ohne Kennung im Import');
        if (ids.has(sch.id)) throw new OrakelFehler(`Doppelte Schrittkennung im Import (${sch.id.slice(0, 40)})`);
        ids.add(sch.id);
      }
      if (imp.schritte.length > MAX_ZELLEN) throw new OrakelFehler('Mehr Schritte als Zellen erlaubt');
      zaehler['importiert'] = (zaehler['importiert'] ?? 0) + 1;
    } catch (e) {
      if (e instanceof OrakelFehler) throw e;
      if (e instanceof DrawioFehler) {
        zaehler['importAbgelehnt'] = (zaehler['importAbgelehnt'] ?? 0) + 1;
        erste ??= ablehnung(e, 'drawioImportieren').meldung;
        continue;
      }
      ablehnung(e, 'drawioImportieren');
    }
  }
  if ((zaehler['importiert'] ?? 0) === 0) return { urteil: 'abgelehnt', meldung: erste ?? 'Import abgelehnt', zaehler };
  return { urteil: 'angenommen', zaehler };
}

export const drawio: Ziel = { art: 'drawio', erzeuge, urteile: (f) => urteileDrawio(f.daten) };
