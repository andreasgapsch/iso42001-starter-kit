// draw.io als dritter Ausgang und als Eingang der Prozessabläufe (Plan Prozesse 3.1 bis 3.6). Export: unkomprimiertes
// mxfile, je Prozess eine Seite mit Bahnen (swimlane) und Formen aus eingebauten Grundformen, Kennungen der Prozesse als
// Attribute an <object> mit neutralen Namen (element, elementId, process, role, lane, raci, processRefs, documents,
// decisionRight; Tag «process»). Die Datei ist ein Firmendokument: keine Angaben zum Werkzeug. Ältere Dateien mit den
// Attributen kit, kitId, kitProzess … liest der Import weiter und schreibt sie beim nächsten Export neutral. Geometrie aus
// derselben Rasterquelle wie das SVG der App. Import: eigener XML-Leser (src/prozesse/xml.ts), komprimierte Seiten
// (Base64, rohes DEFLATE, URL-Kodierung), .drawio.svg; Teilmenge der Formen deuten, alles Übrige unverändert erhalten.
// Rundreise: Export mischt die aktuellen Angaben in die Rohdaten der importierten Seite.
import { inflateSync, strFromU8 } from 'fflate';
import { ablaufGeometrie, ablaufWege, type AblaufSeite } from '../grafik/svg/ablauf.ts';
import { rund } from '../grafik/svg/szene.ts';
import type { ProzessBahn, ProzessSchritt, ProzessSchrittArt, RaciWert } from '../model/typen.ts';
import type { Ablauf } from './katalog.ts';
import { WECHSELWIRKUNGEN } from './landkarte.ts';
import { GRENZEN } from '../eingang/grenzen.ts';
import { formText, prozessRaster, SPALTE_PX } from './layout.ts';
import {
  attr, dekodiere, elemente, entferneAttr, istElement, kind, kopfText, maskiereAttr, neuesElement, parseXml, serialisiere, setzeAttr, textInhalt, wurzel, XmlFehler,
  type XmlElement, type XmlKnoten,
} from './xml.ts';

export interface DrawioExportProzess {
  id: string;
  titel: string;
  ablauf: Ablauf;
  bahnTexte: Record<string, string>;
  /** Rohdaten der importierten Seite: Einmischen statt neu zeichnen */
  roh?: string;
}

export interface DrawioExportOptionen {
  /** Seite 1 «Prozesslandkarte»: Knoten verlinken mit link="data:page/id,PR-08" auf die Prozessseiten */
  landkarte?: { titel: string; gruppen: { gruppe: string; text: string }[]; prozesse: { id: string; gruppe: string; text: string }[] };
  vars?: Record<string, string>;
  /** ISO-Zeitpunkt für mxfile@modified (deterministisch) */
  geaendert?: string;
  /** Lenkungsangaben auf jeder Seite (Textfeld über den Bahnen), z. B. «D-27 Prozessbeschreibungen, Version 1.0, freigegeben …» */
  kopf?: string;
}

export interface DrawioSeiteRoh {
  id: string;
  name: string;
  /** <diagram …> mit unkomprimiertem Inhalt */
  xml: string;
}

export type DrawioFehlerCode = 'zu-gross' | 'kein-xml' | 'kein-drawio' | 'dtd' | 'entitaet' | 'tiefe' | 'kompression';

export class DrawioFehler extends Error {
  constructor(
    readonly code: DrawioFehlerCode,
    meldung: string,
  ) {
    super(meldung);
  }
}

export interface DrawioImport {
  seite: DrawioSeiteRoh;
  /** aus den Attributen process (ältere Dateien: kitProzess) oder diagram@id im Muster PR-\d\d / PS-\d\d */
  prozessId?: string;
  bahnen: ProzessBahn[];
  schritte: ProzessSchritt[];
  offen: { bahnen: string[]; formen: string[] };
  /** Seite für die Rundreise: erkannte fremde Formen tragen danach Kit-Attribute; leer, wenn grösser als 200 KB */
  roh: string;
  hash: string;
  hinweise: string[];
}

export interface AblaufUnterschied {
  neu: string[];
  geaendert: string[];
  entfernt: string[];
  bahnenOhneRolle: string[];
  formenOhneZuordnung: string[];
}

export const MAX_DATEI = GRENZEN.drawio.maxBytes;
export const MAX_ROH = 200 * 1024;
/** Grenzen der Datei, geprüft vor dem Entpacken und Zeichnen */
export const MAX_SEITEN = 200;
export const MAX_SUMME = GRENZEN.drawio.maxEntpackt;
export const MAX_ZELLEN = 20_000;

// ---------------------------------------------------------------------------------------------
// Stile (nur eingebaute Grundformen, helle Farben aus der Palette des Design Systems)

// Attribute an <object>: neutrale Namen (Export) und die Namen älterer Dateien (Import, beim Export ersetzt)
const A = { element: 'element', id: 'elementId', prozess: 'process', rolle: 'role', art: 'stepType', bahn: 'lane', raci: 'raci', verweis: 'processRefs', dokumente: 'documents', entscheid: 'decisionRight' } as const;
const ALT: Record<string, string> = { kit: A.element, kitId: A.id, kitProzess: A.prozess, kitRolle: A.rolle, kitArt: A.art, kitBahn: A.bahn, kitRaci: A.raci, kitVerweis: A.verweis, kitDokumente: A.dokumente, kitEntscheid: A.entscheid };
/** Werte des Attributs element; ältere Dateien: bahn, schritt, entscheid, ende, kante, gruppe, karte */
const ELEMENT_ALT: Record<string, string> = { bahn: 'lane', schritt: 'task', entscheid: 'decision', ende: 'end', kante: 'edge', gruppe: 'group', karte: 'map' };
const TAG = 'process';
const TAG_ENTFERNT = 'removed';
const TAGS_ALT: Record<string, string> = { kit: TAG, entfernt: TAG_ENTFERNT };
const KIT_ART: Record<ProzessSchrittArt, string> = { start: 'start', aufgabe: 'task', entscheidung: 'decision', ende: 'end' };
const ART_AUS_KIT: Record<string, ProzessSchrittArt> = { start: 'start', task: 'aufgabe', decision: 'entscheidung', end: 'ende' };
/** Werte von stepType älterer Dateien und neuer Dateien */
const ART_WERT: Record<string, ProzessSchrittArt> = { start: 'start', aufgabe: 'aufgabe', entscheidung: 'entscheidung', ende: 'ende', task: 'aufgabe', decision: 'entscheidung', end: 'ende' };
const ENTSCHEIDE = new Set(['einfuehren', 'restrisiko', 'ausnahme', 'ausserbetrieb', 'kurzpruefung', 'abschaetzung']);

/** Attribute eines <object> älterer Dateien auf die neutralen Namen und Werte umstellen (Tags kit, entfernt) */
function neutralisiere(obj: XmlElement): void {
  for (const [alt, neu] of Object.entries(ALT)) {
    const w = attr(obj, alt);
    if (w === undefined) continue;
    entferneAttr(obj, alt);
    // Die Art des Schritts steckt schon im Element (task, decision …): kitArt entfällt
    if (alt === 'kitArt') continue;
    if (attr(obj, neu) === undefined) setzeAttr(obj, neu, neu === A.element ? (ELEMENT_ALT[w] ?? w) : w);
  }
  const t = attr(obj, 'tags');
  if (t !== undefined) setzeAttr(obj, 'tags', [...new Set(t.split(/\s+/).filter(Boolean).map((x) => TAGS_ALT[x] ?? x))].join(' '));
}
const PILLE = 'rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=#E9E6DF;strokeColor=#6B737C;';
const STIL: Record<ProzessSchrittArt, string> = {
  start: PILLE,
  ende: PILLE,
  aufgabe: 'rounded=1;arcSize=10;whiteSpace=wrap;html=1;fillColor=#E8EFF5;strokeColor=#1C5D94;',
  entscheidung: 'rhombus;whiteSpace=wrap;html=1;fillColor=#F6ECD8;strokeColor=#906E00;',
};
const bahnStil = (i: number) => {
  const f = i % 2 === 0 ? '#F2F0EB' : '#FFFFFF';
  return `swimlane;startSize=34;horizontal=1;html=1;whiteSpace=wrap;fontStyle=1;fillColor=${f};swimlaneFillColor=${f};strokeColor=#BDBEC1;`;
};
const KANTE = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;html=1;endArrow=block;endFill=1;labelBackgroundColor=#FFFFFF;';
const PUNKT: Record<AblaufSeite, [number, number]> = { top: [0.5, 0], bottom: [0.5, 1], left: [0, 0.5], right: [1, 0.5] };
const kantenStil = (von: AblaufSeite, nach: AblaufSeite) =>
  `${KANTE}exitX=${PUNKT[von][0]};exitY=${PUNKT[von][1]};exitDx=0;exitDy=0;entryX=${PUNKT[nach][0]};entryY=${PUNKT[nach][1]};entryDx=0;entryDy=0;`;
const ENTFERNT = 'opacity=40;';

/** Text als HTML-Beschriftung (html=1): maskiert, Zeilenumbruch als <br> */
const htmlLabel = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>');

/** Zeichen aus einer Referenz; ungültige Nummern fallen weg, statt die ganze Datei abzulehnen */
const zeichenVon = (n: number) => (Number.isInteger(n) && n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '');

/** HTML-Beschriftung als Text: Tags entfernen (nie deuten), <br> und Blöcke als Zeilenumbruch, Entitäten auflösen */
export function htmlZuText(html: string): string {
  const t = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|p|li)>\s*<(?:div|p|li)[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => zeichenVon(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => zeichenVon(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  return t.replace(/[ \t]+\n/g, '\n').trim();
}

const raciText = (r: Record<string, RaciWert> | undefined) => Object.entries(r ?? {}).map(([k, w]) => `${k}:${w}`).join(' ');

/** Letzte Zeile «→ PR-08, PR-09» der Beschriftung: Verweise auf andere Prozesse (wie in D-27 und in der App) */
const VERWEIS_ZEILE = /\n?\s*(?:→|->)\s*((?:P[RSE]-\d{2,3})(?:\s*,\s*P[RSE]-\d{2,3})*)\s*$/;
export function verweisAusText(text: string): { text: string; verweis: string[] } {
  const m = VERWEIS_ZEILE.exec(text);
  if (!m) return { text, verweis: [] };
  return { text: text.slice(0, m.index).trim(), verweis: m[1]!.split(/\s*,\s*/) };
}
const zahl = (n: number) => String(rund(n));

// ---------------------------------------------------------------------------------------------
// Export

type Attr = [string, string | undefined];
function tag(name: string, attrs: Attr[], kinder: string[] | undefined, ebene: number): string {
  const kopf = `<${name}${attrs.filter((a): a is [string, string] => a[1] !== undefined).map(([n, w]) => ` ${n}="${maskiereAttr(w)}"`).join('')}`;
  if (!kinder?.length) return `${kopf}/>`;
  const ein = `\n${'  '.repeat(ebene + 1)}`;
  return `${kopf}>${kinder.map((k) => ein + k).join('')}\n${'  '.repeat(ebene)}</${name}>`;
}

const geometrie = (x: number, y: number, b: number, h: number, ebene: number) =>
  tag('mxGeometry', [['x', zahl(x)], ['y', zahl(y)], ['width', zahl(b)], ['height', zahl(h)], ['as', 'geometry']], undefined, ebene);

const TQ = { roh: () => undefined };

/** Raster und Pixel wie das SVG der App */
function zeichnung(a: Ablauf) {
  const raster = prozessRaster(a, TQ);
  const geo = ablaufGeometrie(raster, { breite: SPALTE_PX * raster.spalten + 24, zeilenHoehe: raster.zeilenHoehe });
  return { raster, geo };
}

const bahnId = (pid: string, b: string) => `${pid}:bahn:${b}`;
const kantenId = (von: string, nach: string) => `kante:${von}:${nach}`;

function bahnObjekt(pid: string, b: ProzessBahn, text: string, i: number, r: { x: number; y: number; b: number; h: number }, ebene: number): string {
  return tag(
    'object',
    [['id', bahnId(pid, b.id)], ['label', htmlLabel(text)], [A.element, 'lane'], [A.id, b.id], [A.prozess, pid], [A.rolle, b.rolle], ['tags', TAG]],
    [tag('mxCell', [['style', bahnStil(i)], ['vertex', '1'], ['parent', '1']], [geometrie(r.x, r.y, r.b, r.h, ebene + 2)], ebene + 1)],
    ebene,
  );
}

function schrittAttribute(pid: string, s: ProzessSchritt): Attr[] {
  return [
    ['label', htmlLabel(formText(s))], [A.element, KIT_ART[s.art]], [A.id, s.id], [A.prozess, pid], [A.bahn, s.bahn],
    [A.raci, raciText(s.raci) || undefined], [A.verweis, s.verweis?.length ? s.verweis.join(' ') : undefined], [A.dokumente, s.dokumente?.length ? s.dokumente.join(' ') : undefined],
    [A.entscheid, s.entscheid],
  ];
}

function schrittObjekt(pid: string, s: ProzessSchritt, eltern: string, r: { x: number; y: number; b: number; h: number }, ebene: number, id = s.id): string {
  return tag(
    'object',
    [['id', id], ...schrittAttribute(pid, s), ['tags', TAG]],
    [tag('mxCell', [['style', STIL[s.art]], ['vertex', '1'], ['parent', eltern]], [geometrie(r.x, r.y, r.b, r.h, ebene + 2)], ebene + 1)],
    ebene,
  );
}

function kantenObjekt(pid: string, von: string, nach: string, quelle: string, ziel: string, text: string | undefined, s1: AblaufSeite, s2: AblaufSeite, ebene: number, punkte?: { x: number; y: number }[]): string {
  const stuetzen = punkte?.length ? [tag('Array', [['as', 'points']], punkte.map((q) => tag('mxPoint', [['x', zahl(q.x)], ['y', zahl(q.y)]], undefined, ebene + 4)), ebene + 3)] : undefined;
  return tag(
    'object',
    [['id', kantenId(von, nach)], ['label', text ? htmlLabel(text) : ''], [A.element, 'edge'], [A.id, kantenId(von, nach)], [A.prozess, pid], ['tags', TAG]],
    [tag('mxCell', [['style', kantenStil(s1, s2)], ['edge', '1'], ['parent', '1'], ['source', quelle], ['target', ziel]], [tag('mxGeometry', [['relative', '1'], ['as', 'geometry']], stuetzen, ebene + 2)], ebene + 1)],
    ebene,
  );
}

/** Stützpunkte, wenn der einfache Weg durch eine fremde Form liefe: draw.io wiche sonst nicht aus (Bericht D, D-05) */
/** Textfeld mit den Lenkungsangaben über den Bahnen (beim Import ignoriert) */
const KOPF_STIL = 'text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontSize=10;fontColor=#4B5563;strokeColor=none;fillColor=none;';
function kopfObjekt(seiteId: string, text: string, ebene: number): string {
  return tag('object', [['id', `${seiteId}:kopf`], ['label', htmlLabel(text)], [A.element, 'header'], ['tags', TAG]], [tag('mxCell', [['style', KOPF_STIL], ['vertex', '1'], ['parent', '1']], [geometrie(0, -44, 720, 30, ebene + 2)], ebene + 1)], ebene);
}

function seite(id: string, name: string, zellen: string[]): string {
  const modell = tag(
    'mxGraphModel',
    [['dx', '0'], ['dy', '0'], ['grid', '1'], ['gridSize', '10'], ['guides', '1'], ['tooltips', '1'], ['connect', '1'], ['arrows', '1'], ['fold', '1'], ['page', '1'], ['pageScale', '1'], ['pageWidth', '827'], ['pageHeight', '1169'], ['math', '0'], ['shadow', '0']],
    [tag('root', [], [tag('mxCell', [['id', '0']], undefined, 4), tag('mxCell', [['id', '1'], ['parent', '0']], undefined, 4), ...zellen], 3)],
    2,
  );
  return tag('diagram', [['id', id], ['name', name]], [modell], 1);
}

function neueSeite(p: DrawioExportProzess, kopf?: string): string {
  const { raster, geo } = zeichnung(p.ablauf);
  const benutzt = p.ablauf.bahnen.filter((b) => raster.bahnen.some((x) => x.id === b.id));
  const bahnRect = new Map(geo.bahnen.map((b) => [b.id, b]));
  const zellen: string[] = kopf ? [kopfObjekt(p.id, kopf, 4)] : [];
  benutzt.forEach((b, i) => zellen.push(bahnObjekt(p.id, b, p.bahnTexte[b.id] ?? b.text ?? b.rolle ?? b.id, i, bahnRect.get(b.id)!, 4)));
  for (const s of p.ablauf.schritte) {
    const r = geo.knoten.get(s.id)!;
    const l = bahnRect.get(s.bahn)!;
    zellen.push(schrittObjekt(p.id, s, bahnId(p.id, s.bahn), { x: r.x - l.x, y: r.y - l.y, b: r.b, h: r.h }, 4));
  }
  // Stützpunkte aus derselben Wegsuche wie SVG und Word; draw.io legte sonst eigene Wege durch Formen
  const wege = ablaufWege(geo.knoten, raster.kanten, { grenze: { x0: 1, y0: geo.kopf + 1, x1: geo.breite - 1, y1: geo.hoehe - 1 } });
  for (const [i, k] of raster.kanten.entries()) zellen.push(kantenObjekt(p.id, k.von, k.nach, k.von, k.nach, k.text, k.vonSeite, k.nachSeite, 4, wege[i]!.slice(1, -1)));
  return seite(p.id, `${p.id} ${p.titel}`, zellen);
}

/** Seite der Prozesslandkarte: Gruppen als Zeilen, je vier Prozesse, Links auf die Prozessseiten */
function landkartenSeite(l: NonNullable<DrawioExportOptionen['landkarte']>, seiten: Set<string>, kopf?: string): string {
  const zellen: string[] = kopf ? [kopfObjekt('landkarte', kopf, 4)] : [];
  let y = 0;
  for (const g of l.gruppen) {
    const liste = l.prozesse.filter((p) => p.gruppe === g.gruppe);
    if (!liste.length) continue;
    const zeilen = Math.ceil(liste.length / 4);
    zellen.push(
      tag('object', [['id', `karte:gruppe:${g.gruppe}`], ['label', htmlLabel(g.text)], [A.element, 'group'], ['tags', TAG]],
        [tag('mxCell', [['style', 'rounded=0;whiteSpace=wrap;html=1;fontStyle=1;fillColor=#E9E6DF;strokeColor=#6B737C;'], ['vertex', '1'], ['parent', '1']], [geometrie(0, y, 140, zeilen * 90 - 20, 6)], 5)], 4),
    );
    liste.forEach((p, i) =>
      zellen.push(
        tag('object', [['id', `karte:${p.id}`], ['label', htmlLabel(p.text)], ['link', seiten.has(p.id) ? `data:page/id,${p.id}` : undefined], [A.element, 'map'], [A.prozess, p.id], ['tags', TAG]],
          [tag('mxCell', [['style', STIL.aufgabe], ['vertex', '1'], ['parent', '1']], [geometrie(160 + (i % 4) * 190, y + Math.floor(i / 4) * 90, 170, 70, 6)], 5)], 4),
      ),
    );
    y += zeilen * 90;
  }
  // Wechselwirkungen der Gruppen wie in D-02 (Pfeile zwischen den Gruppenköpfen)
  const da = new Set(l.gruppen.filter((g) => l.prozesse.some((p) => p.gruppe === g.gruppe)).map((g) => g.gruppe));
  for (const w of WECHSELWIRKUNGEN.filter((x) => da.has(x.von) && da.has(x.nach))) {
    const von = `karte:gruppe:${w.von}`;
    const nach = `karte:gruppe:${w.nach}`;
    zellen.push(
      tag('object', [['id', `karte:kante:${w.von}:${w.nach}`], ['label', ''], [A.element, 'edge'], ['tags', TAG]],
        [tag('mxCell', [['style', kantenStil(w.vonSeite, w.nachSeite)], ['edge', '1'], ['parent', '1'], ['source', von], ['target', nach]], [tag('mxGeometry', [['relative', '1'], ['as', 'geometry']], undefined, 6)], 5)], 4),
    );
  }
  return seite('landkarte', l.titel, zellen);
}

/** Ein <diagram>-Element; mit roh werden die aktuellen Angaben in die importierte Seite eingemischt */
export function drawioSeite(p: DrawioExportProzess, kopf?: string): string {
  return p.roh ? einmischen(p, kopf) : neueSeite(p, kopf);
}

/** Ganze .drawio-Datei, unkomprimiert; ohne Angaben zum erzeugenden Werkzeug (host, agent) */
export function drawioExport(prozesse: DrawioExportProzess[], o: DrawioExportOptionen = {}): string {
  const seiten = [...(o.landkarte ? [landkartenSeite(o.landkarte, new Set(prozesse.map((p) => p.id)), o.kopf)] : []), ...prozesse.map((p) => drawioSeite(p, o.kopf))];
  const kopf: Attr[] = [['modified', o.geaendert], ['version', '1'], ['pages', String(seiten.length)], ['vars', o.vars ? JSON.stringify(o.vars) : undefined]];
  return `<mxfile${kopf.filter((a): a is [string, string] => a[1] !== undefined).map(([n, w]) => ` ${n}="${maskiereAttr(w)}"`).join('')}>\n${seiten.map((s) => `  ${s}\n`).join('')}</mxfile>\n`;
}

// ---------------------------------------------------------------------------------------------
// Zellen einer Seite lesen

interface Zelle {
  /** Element in root (object, UserObject oder mxCell) */
  el: XmlElement;
  obj?: XmlElement;
  cell: XmlElement;
  id: string;
  parent?: string;
  style: string;
  stil: Map<string, string>;
  vertex: boolean;
  edge: boolean;
  source?: string;
  target?: string;
  label: string;
  /** Element (lane, start, task, decision, end, edge, group, map, header); ältere Dateien: Attribut kit */
  kit?: string;
  kitId?: string;
  geo: { x: number; y: number; b: number; h: number };
}

/** Attribut mit neutralem Namen, sonst mit dem Namen älterer Dateien */
function attrN(obj: XmlElement | undefined, n: keyof typeof A): string | undefined {
  if (!obj) return undefined;
  const neu = attr(obj, A[n]);
  if (neu !== undefined) return neu;
  const alt = Object.entries(ALT).find(([, v]) => v === A[n])![0];
  return attr(obj, alt);
}

function stilWerte(s: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of s.split(';')) {
    if (!t) continue;
    const i = t.indexOf('=');
    if (i < 0) m.set(t, '');
    else m.set(t.slice(0, i), t.slice(i + 1));
  }
  return m;
}

interface Modell {
  root: XmlElement;
  zellen: Zelle[];
}

function modell(xml: string): { dok: ReturnType<typeof parseXml>; dia: XmlElement } & Modell {
  const dok = mitFehler(() => parseXml(xml));
  const dia = wurzel(dok)!;
  const root = kind(kind(dia, 'mxGraphModel'), 'root');
  if (!root) throw new DrawioFehler('kein-drawio', 'Seite ohne mxGraphModel');
  return { dok, dia, root, zellen: zellenVon(root) };
}

function zellenVon(root: XmlElement): Zelle[] {
  const aus: Zelle[] = [];
  const alle = elemente(root);
  if (alle.length > MAX_ZELLEN) throw new DrawioFehler('zu-gross', `Mehr als ${MAX_ZELLEN} Formen auf einer Seite`);
  for (const el of alle) {
    const obj = el.name === 'object' || el.name === 'UserObject' ? el : undefined;
    const cell = obj ? kind(obj, 'mxCell') : el.name === 'mxCell' ? el : undefined;
    if (!cell) continue;
    const g = kind(cell, 'mxGeometry');
    const n = (a: string) => Number(attr(g, a) ?? 0) || 0;
    const style = attr(cell, 'style') ?? '';
    aus.push({
      el, obj, cell,
      id: attr(obj ?? cell, 'id') ?? '',
      parent: attr(cell, 'parent'),
      style,
      stil: stilWerte(style),
      vertex: attr(cell, 'vertex') === '1',
      edge: attr(cell, 'edge') === '1',
      source: attr(cell, 'source'),
      target: attr(cell, 'target'),
      label: (obj ? attr(obj, 'label') : attr(cell, 'value')) ?? '',
      kit: elementVon(obj),
      kitId: obj ? (attrN(obj, 'id') ?? (elementVon(obj) ? attr(obj, 'id') : undefined)) : undefined,
      geo: { x: n('x'), y: n('y'), b: n('width'), h: n('height') },
    });
  }
  return aus;
}

function elementVon(obj: XmlElement | undefined): string | undefined {
  const w = attrN(obj, 'element');
  return w === undefined ? undefined : (ELEMENT_ALT[w] ?? w);
}

const textVon = (z: Zelle) => (z.stil.get('html') === '1' || /<[a-z]/i.test(z.label) ? htmlZuText(z.label) : z.label.trim());

function mitFehler<T>(f: () => T): T {
  try {
    return f();
  } catch (e) {
    if (e instanceof XmlFehler) throw new DrawioFehler(e.code, e.message);
    throw e;
  }
}

// ---------------------------------------------------------------------------------------------
// Einmischen (Rundreise)

function einfuegen(root: XmlElement, xml: string): void {
  const neu = parseXml(xml).kinder.filter(istElement);
  const letzter = root.kinder.at(-1);
  const einzug = letzter?.art === 'text' && /^\s*$/.test(letzter.roh) ? root.kinder.pop()! : undefined;
  for (const e of neu) root.kinder.push({ art: 'text', roh: '\n        ' }, e);
  root.kinder.push(einzug ?? { art: 'text', roh: '\n      ' });
}

function setzeOder(e: XmlElement, name: string, wert: string | undefined): void {
  if (wert === undefined || wert === '') {
    if (attr(e, name) !== undefined && wert === undefined) entferneAttr(e, name);
    else if (wert === '' && attr(e, name) !== undefined) setzeAttr(e, name, '');
    return;
  }
  setzeAttr(e, name, wert);
}

/** Beschriftung nur ändern, wenn sich der Text ändert (eigene Formatierung aus draw.io bleibt sonst erhalten) */
function setzeLabel(z: Zelle, text: string): void {
  if (textVon(z) === text) return;
  if (z.obj) setzeAttr(z.obj, 'label', htmlLabel(text));
  else setzeAttr(z.cell, 'value', htmlLabel(text));
}

function einmischen(p: DrawioExportProzess, kopf?: string): string {
  const { dok, root, zellen } = modell(p.roh!);
  // Ältere Rohdaten: Attribute und Tags auf die neutralen Namen umstellen (z. B. kitRaci -> raci, Tag kit -> process)
  for (const z of zellen) if (z.obj) neutralisiere(z.obj);
  const vonProzess = (z: Zelle) => !!z.kit && (attrN(z.obj, 'prozess') ?? p.id) === p.id;
  const bahnen = new Map(zellen.filter((z) => vonProzess(z) && z.kit === 'lane').map((z) => [z.kitId!, z]));
  const schritte = new Map<string, Zelle>();
  for (const z of zellen) if (vonProzess(z) && ART_AUS_KIT[z.kit!] && !schritte.has(z.kitId!)) schritte.set(z.kitId!, z);
  const kanten = new Map(zellen.filter((z) => vonProzess(z) && z.kit === 'edge').map((z) => [z.kitId!, z]));
  // Lenkungsangaben: vorhandenes Textfeld nachführen, sonst über den Bahnen einfügen
  const kopfZelle = zellen.find((z) => z.kit === 'header');
  if (kopf && kopfZelle?.obj) setzeLabel(kopfZelle, kopf);
  else if (kopf) einfuegen(root, kopfObjekt(p.id, kopf, 4));
  const { raster, geo } = zeichnung(p.ablauf);
  const benutzt = p.ablauf.bahnen.filter((b) => raster.bahnen.some((x) => x.id === b.id));
  const bahnObjId = new Map<string, string>();
  const bahnIds = new Set([...bahnen.values()].map((z) => z.id));

  // Bahnen: Beschriftung und Rolle; neue rechts anhängen; nicht mehr genutzte grau als entfernt kennzeichnen (unten)
  let rechts = Math.max(0, ...[...bahnen.values()].map((z) => z.geo.x + z.geo.b));
  const hoehe = Math.max(geo.hoehe, ...[...bahnen.values()].map((z) => z.geo.h));
  benutzt.forEach((b, i) => {
    const z = bahnen.get(b.id);
    const text = p.bahnTexte[b.id] ?? b.text ?? b.rolle ?? b.id;
    if (z) {
      setzeLabel(z, text);
      if (b.rolle && z.obj) setzeAttr(z.obj, A.rolle, b.rolle);
      if (z.obj && (attr(z.obj, 'tags') ?? '').includes(TAG_ENTFERNT)) setzeAttr(z.obj, 'tags', TAG);
      if (z.style.includes(ENTFERNT)) setzeAttr(z.cell, 'style', z.style.replace(ENTFERNT, ''));
      bahnObjId.set(b.id, z.id);
      return;
    }
    einfuegen(root, bahnObjekt(p.id, b, text, i, { x: rechts, y: 0, b: SPALTE_PX, h: hoehe }, 4));
    bahnObjId.set(b.id, bahnId(p.id, b.id));
    bahnIds.add(bahnId(p.id, b.id));
    bahnen.set(b.id, { id: bahnId(p.id, b.id), geo: { x: rechts, y: 0, b: SPALTE_PX, h: hoehe } } as Zelle);
    rechts += SPALTE_PX;
  });

  // Schritte: Angaben aus dem Projekt, Geometrie und Stil aus der Datei; neue unten in ihrer Bahn
  const schrittObjId = new Map<string, string>();
  const unten = new Map<string, number>();
  for (const z of zellen) if (z.vertex && z.parent) unten.set(z.parent, Math.max(unten.get(z.parent) ?? 0, z.geo.y + z.geo.h));
  for (const s of p.ablauf.schritte) {
    const z = schritte.get(s.id);
    const eltern = bahnObjId.get(s.bahn) ?? '1';
    if (z?.obj) {
      setzeLabel(z, formText(s));
      for (const [n, w] of schrittAttribute(p.id, s).slice(1)) setzeOder(z.obj, n, w);
      if ((attr(z.obj, 'tags') ?? '').includes(TAG_ENTFERNT)) setzeAttr(z.obj, 'tags', TAG);
      if (z.style.includes(ENTFERNT)) setzeAttr(z.cell, 'style', z.style.replace(ENTFERNT, ''));
      if (z.parent !== eltern && bahnIds.has(z.parent ?? '')) setzeAttr(z.cell, 'parent', eltern);
      schrittObjId.set(s.id, z.id);
      continue;
    }
    const l = bahnen.get(s.bahn);
    const y = (unten.get(eltern) ?? 34) + 20;
    unten.set(eltern, y + 44);
    einfuegen(root, schrittObjekt(p.id, s, eltern, { x: 9, y, b: (l?.geo.b ?? SPALTE_PX) - 18, h: 44 }, 4));
    schrittObjId.set(s.id, s.id);
  }
  // Entfernte Schritte und Kanten nicht löschen, sondern grau kennzeichnen
  const markieren = (z: Zelle) => {
    if (!z.obj) return;
    setzeAttr(z.obj, 'tags', `${TAG} ${TAG_ENTFERNT}`);
    if (!z.style.includes(ENTFERNT)) setzeAttr(z.cell, 'style', `${z.style}${z.style && !z.style.endsWith(';') ? ';' : ''}${ENTFERNT}`);
  };
  const ids = new Set(p.ablauf.schritte.map((s) => s.id));
  for (const [id, z] of schritte) if (!ids.has(id)) markieren(z);
  // Bahnen ohne Schritt im Ablauf (Rolle nicht mehr beteiligt): nicht löschen, grau als entfernt kennzeichnen
  const genutzt = new Set(benutzt.map((b) => b.id));
  for (const [id, z] of bahnen) if (!genutzt.has(id) && z.obj) markieren(z);

  // Kanten
  const soll = new Set<string>();
  for (const k of raster.kanten) {
    const id = kantenId(k.von, k.nach);
    soll.add(id);
    const z = kanten.get(id);
    if (z?.obj) {
      setzeLabel(z, k.text ?? '');
      if ((attr(z.obj, 'tags') ?? '').includes(TAG_ENTFERNT)) setzeAttr(z.obj, 'tags', TAG);
      if (z.style.includes(ENTFERNT)) setzeAttr(z.cell, 'style', z.style.replace(ENTFERNT, ''));
      continue;
    }
    einfuegen(root, kantenObjekt(p.id, k.von, k.nach, schrittObjId.get(k.von)!, schrittObjId.get(k.nach)!, k.text, k.vonSeite, k.nachSeite, 4));
  }
  for (const [id, z] of kanten) if (!soll.has(id)) markieren(z);
  return serialisiere(dok);
}

// ---------------------------------------------------------------------------------------------
// Datei lesen

function base64(text: string): Uint8Array {
  const s = atob(text.replace(/\s+/g, ''));
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

/** Komprimierte Seite: Base64, rohes DEFLATE, URL-Kodierung (ältere Dateien ohne URL-Kodierung: Schritt übersprungen) */
export function entpackeSeite(text: string): string {
  let roh: string;
  try {
    // Fester Puffer: fflate schreibt nie darüber hinaus, ein grösseres Ergebnis zeigt sich am vollen Puffer (Schutz vor Bomben)
    const daten = inflateSync(base64(text), { out: new Uint8Array(MAX_DATEI + 1) });
    if (daten.length > MAX_DATEI) throw new DrawioFehler('zu-gross', 'Seite grösser als 2 MB');
    roh = strFromU8(daten);
  } catch (e) {
    if (e instanceof DrawioFehler) throw e;
    throw new DrawioFehler('kompression', 'Komprimierte Seite nicht lesbar');
  }
  if (!roh.trimStart().startsWith('<')) {
    try {
      roh = decodeURIComponent(roh);
    } catch {
      throw new DrawioFehler('kompression', 'Komprimierte Seite nicht lesbar');
    }
  }
  return roh;
}

/** Seiten einer .drawio-, .xml- oder .drawio.svg-Datei, je Seite unkomprimiert */
export function drawioSeitenLesen(datei: string | Uint8Array): DrawioSeiteRoh[] {
  if (typeof datei !== 'string') {
    if (datei.byteLength > MAX_DATEI) throw new DrawioFehler('zu-gross', 'Datei grösser als 2 MB');
    datei = new TextDecoder().decode(datei);
  }
  if (datei.length > MAX_DATEI) throw new DrawioFehler('zu-gross', 'Datei grösser als 2 MB');
  const dok = mitFehler(() => parseXml(datei.replace(/^\uFEFF/, '')));
  const w = wurzel(dok)!;
  if (w.name === 'svg') {
    const inhalt = attr(w, 'content');
    if (!inhalt) throw new DrawioFehler('kein-drawio', 'SVG ohne eingebettetes Diagramm');
    return drawioSeitenLesen(inhalt);
  }
  if (w.name === 'mxGraphModel') return [{ id: 'seite-1', name: '', xml: `<diagram id="seite-1" name="">${serialisiere(w)}</diagram>` }];
  const diagramme = w.name === 'mxfile' ? elemente(w, 'diagram') : w.name === 'diagram' ? [w] : [];
  if (!diagramme.length) throw new DrawioFehler('kein-drawio', 'Keine Seite gefunden');
  if (diagramme.length > MAX_SEITEN) throw new DrawioFehler('zu-gross', `Mehr als ${MAX_SEITEN} Seiten`);
  let summe = 0;
  return diagramme.map((d, i) => {
    let xml: string;
    if (kind(d, 'mxGraphModel')) xml = serialisiere(d);
    else {
      const innen = entpackeSeite(textInhalt(d).trim());
      summe += innen.length;
      if (summe > MAX_SUMME) throw new DrawioFehler('zu-gross', 'Seiten zusammen grösser als 20 MB');
      mitFehler(() => parseXml(innen));
      xml = `${kopfText({ ...d, leer: false })}${innen}</diagram>`;
    }
    return { id: attr(d, 'id') ?? `seite-${i + 1}`, name: attr(d, 'name') ?? '', xml };
  });
}

// ---------------------------------------------------------------------------------------------
// Import einer Seite

type Deutung = 'bahn' | 'endpunkt' | ProzessSchrittArt | 'notiz' | 'gruppe' | 'offen' | 'ignorieren';

function deute(z: Zelle): Deutung {
  if (z.kit) return z.kit === 'lane' ? 'bahn' : (ART_AUS_KIT[z.kit] ?? 'ignorieren');
  const s = z.stil;
  const form = s.get('shape');
  if (s.has('swimlane') || form === 'swimlane') return 'bahn';
  if (s.has('group')) return 'gruppe';
  if (s.has('text') || (s.get('strokeColor') === 'none' && s.get('fillColor') === 'none')) return 'notiz';
  if (form === 'image' || s.has('image')) return 'offen';
  if (s.has('rhombus') || form === 'rhombus') return 'entscheidung';
  if (s.has('ellipse') || form === 'ellipse' || (s.get('rounded') === '1' && Number(s.get('arcSize') ?? 0) >= 40)) return 'endpunkt';
  return textVon(z) ? 'aufgabe' : 'offen';
}

/** Kennung im Muster der Prozess-ID (PR-08.03) */
const nummer = (id: string, pid: string) => (id.startsWith(`${pid}.`) && /^\d{2,}$/.test(id.slice(pid.length + 1)) ? Number(id.slice(pid.length + 1)) : undefined);

export function drawioImportieren(seite: DrawioSeiteRoh, o: { prozessId?: string; rollen: { schluessel: string; text: string }[] }): DrawioImport {
  const { dok, root, zellen } = modell(seite.xml);
  const hinweise: string[] = [];
  const nachId = new Map(zellen.map((z) => [z.id, z]));
  const deutung = new Map(zellen.filter((z) => z.vertex).map((z) => [z.id, deute(z)]));

  // Prozess: Angabe, sonst häufigstes Attribut process, sonst Kennung der Seite
  const zaehler = new Map<string, number>();
  for (const z of zellen) {
    const k = attrN(z.obj, 'prozess');
    if (k && z.kit !== 'map') zaehler.set(k, (zaehler.get(k) ?? 0) + 1);
  }
  const haeufig = [...zaehler].sort((a, b) => b[1] - a[1])[0]?.[0];
  const prozessId = o.prozessId ?? haeufig ?? (/^P[RSE]-\d{2}$/.test(seite.id) ? seite.id : undefined);
  const pid = prozessId ?? seite.id;

  // Absolute Koordinaten über Container und Gruppen (Ebenen tragen nichts bei)
  const abs = (z: Zelle, tiefe = 0): { x: number; y: number } => {
    const e = z.parent ? nachId.get(z.parent) : undefined;
    if (!e || !e.vertex || tiefe > 50) return { x: z.geo.x, y: z.geo.y };
    const a = abs(e, tiefe + 1);
    return { x: a.x + z.geo.x, y: a.y + z.geo.y };
  };

  // Bahnen
  const bahnZellen = zellen.filter((z) => deutung.get(z.id) === 'bahn').sort((a, b) => abs(a).x - abs(b).x);
  const bahnen: ProzessBahn[] = [];
  const bahnVonZelle = new Map<string, string>();
  const offenBahnen: string[] = [];
  const umbenennen: { z: Zelle; attrs: [string, string][] }[] = [];
  for (const z of bahnZellen) {
    const text = textVon(z);
    const norm = text.toLowerCase();
    const rolle = attrN(z.obj, 'rolle') ?? o.rollen.find((r) => r.text.trim().toLowerCase() === norm || r.schluessel === norm)?.schluessel;
    let id = z.kitId ?? rolle ?? `bahn-${bahnen.length + 1}`;
    while (bahnen.some((b) => b.id === id)) id = `${id}-${bahnen.length + 1}`;
    bahnen.push({ id, text, ...(rolle ? { rolle } : {}) });
    bahnVonZelle.set(z.id, id);
    if (!rolle) offenBahnen.push(id);
    if (!z.kit) umbenennen.push({ z, attrs: [[A.element, 'lane'], [A.id, id], [A.prozess, pid], ...(rolle ? [[A.rolle, rolle] as [string, string]] : [])] });
  }

  // Formen der Schritte
  const schrittZellen = zellen.filter((z) => {
    const d = deutung.get(z.id);
    return d === 'start' || d === 'aufgabe' || d === 'entscheidung' || d === 'ende' || d === 'endpunkt';
  });
  const istSchritt = new Set(schrittZellen.map((z) => z.id));
  const kantenZellen = zellen.filter((z) => z.edge && istSchritt.has(z.source ?? '') && istSchritt.has(z.target ?? ''));
  const offenFormen = zellen.filter((z) => z.vertex && deutung.get(z.id) === 'offen').map((z) => z.id);

  // Kennungen: gültige behalten, Kopien und neue Formen erhalten die nächste freie Nummer
  let max = 0;
  for (const z of schrittZellen) max = Math.max(max, nummer(z.kitId ?? z.id, pid) ?? 0);
  const schrittId = new Map<string, string>();
  const vergeben = new Set<string>();
  for (const z of schrittZellen) {
    const kandidat = z.kitId ?? z.id;
    let id = kandidat;
    if (nummer(kandidat, pid) === undefined || vergeben.has(kandidat)) {
      id = `${pid}.${String(++max).padStart(2, '0')}`;
      if (vergeben.has(kandidat)) hinweise.push(`Kennung ${kandidat} doppelt: Kopie als ${id} übernommen`);
    }
    vergeben.add(id);
    schrittId.set(z.id, id);
  }

  // Bahn je Schritt: Container, sonst Lage der Mitte, sonst nächste Bahn
  const bahnRect = bahnZellen.map((z) => ({ z, ...abs(z), b: z.geo.b, h: z.geo.h }));
  const bahnVon = (z: Zelle): string => {
    for (let e = z.parent ? nachId.get(z.parent) : undefined, n = 0; e && n < 50; e = e.parent ? nachId.get(e.parent) : undefined, n++) if (bahnVonZelle.has(e.id)) return bahnVonZelle.get(e.id)!;
    const a = abs(z);
    const cx = a.x + z.geo.b / 2;
    const cy = a.y + z.geo.h / 2;
    const drin = bahnRect.find((r) => cx >= r.x && cx <= r.x + r.b && cy >= r.y && cy <= r.y + r.h);
    if (drin) return bahnVonZelle.get(drin.z.id)!;
    hinweise.push(`Form ${z.id} liegt in keiner Bahn`);
    if (!bahnRect.length) {
      if (!bahnen.some((b) => b.id === 'bahn-1')) (bahnen.push({ id: 'bahn-1' }), offenBahnen.push('bahn-1'));
      return 'bahn-1';
    }
    return bahnVonZelle.get(bahnRect.reduce((m, r) => (Math.abs(r.x + r.b / 2 - cx) < Math.abs(m.x + m.b / 2 - cx) ? r : m)).z.id)!;
  };

  // Nachfolger aus den Kanten (Reihenfolge wie in der Datei), Beschriftungen als Zweige
  const nach = new Map<string, Zelle[]>();
  const ein = new Set<string>();
  for (const k of kantenZellen) {
    nach.set(k.source!, [...(nach.get(k.source!) ?? []), k]);
    ein.add(k.target!);
  }
  const schritte = new Map<string, ProzessSchritt>();
  for (const z of schrittZellen) {
    let art = deutung.get(z.id) as ProzessSchrittArt | 'endpunkt';
    if (z.kit) art = ART_WERT[attrN(z.obj, 'art') ?? ''] ?? (art as ProzessSchrittArt);
    if (art === 'endpunkt') art = !ein.has(z.id) ? 'start' : !nach.has(z.id) ? 'ende' : 'aufgabe';
    const ausgaenge = nach.get(z.id) ?? [];
    const naechste = [...new Set(ausgaenge.map((k) => schrittId.get(k.target!)!))];
    const zweige: Record<string, string> = {};
    if (art === 'entscheidung') for (const k of ausgaenge) if (textVon(k)) zweige[schrittId.get(k.target!)!] = textVon(k);
    const raci: Record<string, RaciWert> = {};
    for (const t of (attrN(z.obj, 'raci') ?? '').split(/\s+/)) {
      const m = /^(.+):([RACI])$/.exec(t);
      if (m) raci[m[1]!] = m[2] as RaciWert;
    }
    const liste = (n: keyof typeof A) => (attrN(z.obj, n) ?? '').split(/\s+/).filter(Boolean);
    const id = schrittId.get(z.id)!;
    // Verweise als letzte Zeile der Beschriftung («→ PR-08, PR-09»): aus dem Text lösen, Attribut geht vor
    const { text, verweis: ausText } = verweisAusText(textVon(z));
    const verweis = liste('verweis').length ? liste('verweis') : ausText;
    const entscheid = attrN(z.obj, 'entscheid');
    schritte.set(z.id, {
      id,
      art: art as ProzessSchrittArt,
      text,
      bahn: bahnVon(z),
      ...(naechste.length ? { naechste } : {}),
      ...(Object.keys(zweige).length ? { zweige } : {}),
      ...(Object.keys(raci).length ? { raci } : {}),
      ...(verweis.length ? { verweis } : {}),
      ...(liste('dokumente').length ? { dokumente: liste('dokumente') } : {}),
      ...(entscheid && ENTSCHEIDE.has(entscheid) ? { entscheid: entscheid as NonNullable<ProzessSchritt['entscheid']> } : {}),
    });
  }

  // Reihenfolge: Tiefensuche ab dem Start (Rücksprünge erlaubt), Gleichstand nach Lage oben, dann links; Enden zuletzt
  const lage = (a: Zelle, b: Zelle) => abs(a).y - abs(b).y || abs(a).x - abs(b).x;
  const sortiert = [...schrittZellen].sort(lage);
  const besucht = new Set<string>();
  const reihe: Zelle[] = [];
  const tiefe = (z: Zelle, post: Zelle[]) => {
    if (besucht.has(z.id)) return;
    besucht.add(z.id);
    const n = (nach.get(z.id) ?? []).map((k) => nachId.get(k.target!)!).sort(lage).reverse();
    for (const x of n) tiefe(x, post);
    post.push(z);
  };
  for (const z of [...sortiert.filter((x) => schritte.get(x.id)!.art === 'start'), ...sortiert]) {
    if (besucht.has(z.id)) continue;
    const post: Zelle[] = [];
    tiefe(z, post);
    reihe.push(...post.reverse());
  }
  const liste = reihe.map((z) => schritte.get(z.id)!);
  const geordnet = [...liste.filter((s) => s.art !== 'ende'), ...liste.filter((s) => s.art === 'ende')];

  // Rohdaten: erkannte fremde Formen und Kanten als Kit-Objekte kennzeichnen, doppelte Kit-Kennungen berichtigen.
  // Kit-Formen eines anderen Prozesses (z. B. Datei aus einem anderen Projekt, als eigener Prozess übernommen) erhalten
  // die Kennung dieses Prozesses, damit der nächste Export sie wiedererkennt.
  // Ältere Dateien: Attribute und Tags neutral benennen (kit -> element, kitRaci -> raci, Tag kit -> process)
  for (const z of zellen) if (z.obj) neutralisiere(z.obj);
  const fremd = (z: Zelle) => !!z.kit && z.kit !== 'map' && !!z.obj && (attrN(z.obj, 'prozess') ?? pid) !== pid;
  for (const z of [...bahnZellen, ...schrittZellen, ...kantenZellen]) if (fremd(z)) setzeAttr(z.obj!, A.prozess, pid);
  for (const k of kantenZellen) {
    if (!k.kit || !k.obj) continue;
    const id = kantenId(schrittId.get(k.source!)!, schrittId.get(k.target!)!);
    if (k.kitId !== id) setzeAttr(k.obj, A.id, id);
  }
  for (const z of schrittZellen) {
    const id = schrittId.get(z.id)!;
    if (z.kit) {
      if (z.kitId !== id) setzeAttr(z.obj!, A.id, id);
      continue;
    }
    const s = schritte.get(z.id)!;
    umbenennen.push({ z, attrs: [[A.element, KIT_ART[s.art]], [A.id, id], [A.prozess, pid], [A.bahn, s.bahn]] });
  }
  for (const k of kantenZellen) if (!k.kit) umbenennen.push({ z: k, attrs: [[A.element, 'edge'], [A.id, kantenId(schrittId.get(k.source!)!, schrittId.get(k.target!)!)], [A.prozess, pid]] });
  for (const { z, attrs } of umbenennen) {
    if (z.obj) {
      for (const [n, w] of attrs) setzeAttr(z.obj, n, w);
      setzeAttr(z.obj, 'tags', [...new Set([...(attr(z.obj, 'tags') ?? '').split(/\s+/).filter(Boolean), TAG])].join(' '));
      continue;
    }
    const obj = neuesElement('object', [['id', z.id], ['label', attr(z.cell, 'value') ?? ''], ...attrs, ['tags', TAG]], [z.cell]);
    entferneAttr(z.cell, 'id');
    entferneAttr(z.cell, 'value');
    root.kinder[root.kinder.indexOf(z.el as XmlKnoten)] = obj;
  }

  const ganz = serialisiere(dok);
  let roh = ganz;
  if (ganz.length > MAX_ROH) {
    hinweise.push('Seite grösser als 200 KB: Rohdaten nicht gespeichert, der Export zeichnet neu');
    roh = '';
  }
  return {
    seite,
    ...(prozessId ? { prozessId } : {}),
    bahnen: bahnen.filter((b) => geordnet.some((s) => s.bahn === b.id) || offenBahnen.includes(b.id)),
    schritte: geordnet,
    offen: { bahnen: offenBahnen, formen: offenFormen },
    roh,
    hash: sha256Hex(roh),
    hinweise,
  };
}

/** Vorschau vor der Übernahme: neue, geänderte und entfernte Schritte, offene Zuordnungen */
export function ablaufUnterschied(alt: { schritte: readonly ProzessSchritt[] }, neu: DrawioImport): AblaufUnterschied {
  const vorher = new Map(alt.schritte.map((s) => [s.id, s]));
  const nachher = new Map(neu.schritte.map((s) => [s.id, s]));
  const kern = (s: ProzessSchritt) => JSON.stringify([s.art, s.text, s.bahn, s.naechste ?? [], s.zweige ?? {}]);
  return {
    neu: neu.schritte.filter((s) => !vorher.has(s.id)).map((s) => s.id),
    geaendert: neu.schritte.filter((s) => vorher.has(s.id) && kern(vorher.get(s.id)!) !== kern(s)).map((s) => s.id),
    entfernt: alt.schritte.filter((s) => !nachher.has(s.id)).map((s) => s.id),
    bahnenOhneRolle: [...neu.offen.bahnen],
    formenOhneZuordnung: [...neu.offen.formen],
  };
}

// ---------------------------------------------------------------------------------------------
// SHA-256 (synchron, UTF-8)

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
  0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256Hex(text: string): string {
  const daten = new TextEncoder().encode(text);
  const laenge = daten.length;
  const bloecke = Math.ceil((laenge + 9) / 64);
  const m = new Uint8Array(bloecke * 64);
  m.set(daten);
  m[laenge] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(m.length - 8, Math.floor(laenge / 0x20000000));
  dv.setUint32(m.length - 4, (laenge * 8) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const r = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let b = 0; b < bloecke; b++) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(b * 64 + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = r(w[i - 15]!, 7) ^ r(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = r(w[i - 2]!, 17) ^ r(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, bb, c, d, e, f, g, hh] = h as unknown as number[];
    for (let i = 0; i < 64; i++) {
      const t1 = (hh! + (r(e!, 6) ^ r(e!, 11) ^ r(e!, 25)) + ((e! & f!) ^ (~e! & g!)) + K[i]! + w[i]!) >>> 0;
      const t2 = ((r(a!, 2) ^ r(a!, 13) ^ r(a!, 22)) + ((a! & bb!) ^ (a! & c!) ^ (bb! & c!))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d! + t1) >>> 0;
      d = c;
      c = bb;
      bb = a;
      a = (t1 + t2) >>> 0;
    }
    h[0]! += a!; h[1]! += bb!; h[2]! += c!; h[3]! += d!; h[4]! += e!; h[5]! += f!; h[6]! += g!; h[7]! += hh!;
  }
  return [...h].map((x) => x.toString(16).padStart(8, '0')).join('');
}

/** Für Tests: dekodierter Wert einer Zeichenkette mit Entitäten */
export const dekodiereText = dekodiere;
