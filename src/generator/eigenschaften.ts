// Dateieigenschaften (docProps) selbst schreiben, damit keine Bibliotheks- oder Kit-Angaben
// («Un-named», «Microsoft Excel», Firmenfelder) in core.xml/app.xml landen.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { xmlBereinigen } from './xml-zeichen.ts';

export interface DateiEigenschaften {
  titel: string;
  autor: string;
  betreff?: string;
  /** Erstellt am (ISO-Datum, z. B. Freigabe der ersten Version); sonst Zeitpunkt des Builds */
  erstellt?: string;
  /** Geändert am (ISO-Datum, z. B. Freigabe der aktuellen Version); sonst Zeitpunkt des Builds */
  geaendert?: string;
  /** Revision (Anzahl Versionen); sonst 1 */
  revision?: number;
}

export interface RenderOptionen {
  /** Fester Zeitpunkt für Erstellungsdatum und ZIP-Einträge (reproduzierbare Builds). */
  zeitpunkt?: Date;
}

export function xmlText(s: string): string {
  return xmlBereinigen(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function w3cdtf(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function element(tag: string, wert: string | undefined): string {
  return wert ? `<${tag}>${xmlText(wert)}</${tag}>` : '';
}

/** ISO-Datum (JJJJ-MM-TT) oder Zeitstempel als Date; ungültig oder leer: Ersatzwert */
function zeit(iso: string | undefined, ersatz: Date): Date {
  if (!iso) return ersatz;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T08:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? ersatz : d;
}

export function coreXml(e: DateiEigenschaften, zeitpunkt: Date): string {
  const erstellt = w3cdtf(zeit(e.erstellt, zeitpunkt));
  const geaendert = w3cdtf(zeit(e.geaendert, zeit(e.erstellt, zeitpunkt)));
  const autor = e.autor.trim();
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    element('dc:title', e.titel) +
    element('dc:subject', e.betreff) +
    // Leerer Autor: Element weglassen, sonst setzt Word keinen Namen ein
    element('dc:creator', autor) +
    element('cp:lastModifiedBy', autor) +
    `<cp:revision>${Math.max(1, Math.trunc(e.revision ?? 1))}</cp:revision>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${erstellt}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${geaendert}</dcterms:modified>` +
    '</cp:coreProperties>'
  );
}

export function appXml(e: DateiEigenschaften): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<DocSecurity>0</DocSecurity>' +
    element('Company', e.autor.trim()) +
    '</Properties>'
  );
}

const enc = new TextEncoder();

// Reproduzierbarkeit: docx vergibt Beziehungs-IDs zufällig (nanoid),
// zählt Zeichnungs-IDs (wp:docPr, cNvPr, Konnektor-Bezüge) prozessweit weiter und packt die Arbeitsmappen der Diagramme
// mit der aktuellen Uhrzeit; exceljs vergibt Zufalls-GUIDs (x14:id der Datenbalken); docx/watermarks benennt die Form des
// Wasserzeichens mit Zufallsteil (PowerPlusWaterMarkObject…). Ohne Nacharbeit ändern sich die
// Bytes von Lauf zu Lauf und mit der Anzahl der vorher im selben Prozess oder Worker erzeugten Dokumente.

/** Zufällige Beziehungs-ID von docx, z. B. rId-ul927suu9fdfpp50bqk_ (rId + 21 Zeichen) */
const ZUFALLS_RID = /^rId[0-9A-Za-z_-]{21}$/;
/** Tags mit Zeichnungs-ID; pic:cNvPr (immer id="0") bleibt unberührt */
const ZEICHNUNG_TAG = /<(?:wp:docPr|wps:cNvPr|wpg:cNvPr|wpc:cNvPr|a:stCxn|a:endCxn)\b[^>]*>/g;
// Nicht die festen Kennungen der Erweiterungen (ext uri, z. B. {B025F937-…} der x14-Regel): Excel erkennt die Erweiterung
// sonst nicht mehr (Befund test.7, Datenbalken)
const GUID = /(?<!uri=")\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}/g;
/** Wasserzeichen aus docx/watermarks: Formname mit Zufallsteil (nanoid, klein); Word erkennt es am Präfix */
const WASSERZEICHEN_ID = /PowerPlusWaterMark(Object|Picture)[0-9a-z_-]{21}/g;

/**
 * Paket deterministisch machen: Zufalls-Beziehungs-IDs in Sortierreihenfolge der .rels durch rIdP1, rIdP2 … ersetzen;
 * Zeichnungs-IDs dicht neu nummerieren (1 … n in Reihenfolge ihres Werts, Name «… 49» mit); eingebettete Arbeitsmappen mit
 * festem Zeitstempel neu packen; GUIDs in Arbeitsblättern in Reihenfolge des Auftretens fest vergeben. Gibt die Teile
 * zurück (fflate-Zippable), gepackt wird in paketBereinigen.
 */
export function teileNormalisieren(teile: Record<string, Uint8Array>, zeitpunkt: Date): Record<string, Uint8Array> {
  const pfade = Object.keys(teile).sort();
  const rids = new Map<string, string>();
  for (const p of pfade.filter((x) => x.endsWith('.rels'))) {
    for (const m of strFromU8(teile[p]!).matchAll(/ Id="([^"]+)"/g)) {
      const id = m[1]!;
      if (ZUFALLS_RID.test(id) && !rids.has(id)) rids.set(id, `rIdP${rids.size + 1}`);
    }
  }
  // Zeichnungs-IDs: alle Werte > 0 in word/, aufsteigend auf 1 … n (Reihenfolge der Vergabe bleibt erhalten)
  const werte = new Set<number>();
  for (const p of pfade.filter((x) => x.startsWith('word/') && x.endsWith('.xml'))) {
    for (const tag of strFromU8(teile[p]!).match(ZEICHNUNG_TAG) ?? []) {
      const id = /\bid="(\d+)"/.exec(tag)?.[1];
      if (id && Number(id) > 0) werte.add(Number(id));
    }
  }
  const zeichnung = new Map([...werte].sort((a, b) => a - b).map((w, i) => [w, i + 1]));
  const umnummerieren = (tag: string): string => {
    const alt = /\bid="(\d+)"/.exec(tag)?.[1];
    const neu = alt ? zeichnung.get(Number(alt)) : undefined;
    if (!alt || neu === undefined || String(neu) === alt) return tag;
    return tag.replace(/\bid="\d+"/, `id="${neu}"`).replace(new RegExp(`(\\bname="[^"]* )${alt}"`), `$1${neu}"`);
  };
  const guids = new Map<string, string>();
  const festeGuid = (g: string): string => {
    if (!guids.has(g)) guids.set(g, `{00000000-0000-4000-8000-${String(guids.size + 1).padStart(12, '0')}}`);
    return guids.get(g)!;
  };
  const zeichen = new Map<string, string>();
  const festesZeichen = (z: string, art: string): string => {
    if (!zeichen.has(z)) zeichen.set(z, `PowerPlusWaterMark${art}${zeichen.size + 1}`);
    return zeichen.get(z)!;
  };
  const neu: Record<string, Uint8Array> = {};
  for (const p of pfade) {
    const inhalt = teile[p]!;
    if (/\.(xml|rels)$/.test(p)) {
      let s = strFromU8(inhalt);
      const vorher = s;
      if (rids.size) s = s.replace(/"(rId[0-9A-Za-z_-]{21})"/g, (g, id: string) => (rids.has(id) ? `"${rids.get(id)}"` : g));
      if (zeichnung.size && p.startsWith('word/')) s = s.replace(ZEICHNUNG_TAG, umnummerieren);
      if (p.startsWith('word/')) s = s.replace(WASSERZEICHEN_ID, festesZeichen);
      if (p.startsWith('xl/worksheets/')) s = s.replace(GUID, festeGuid);
      neu[p] = s === vorher ? inhalt : strToU8(s);
    } else if (/\.xlsx$/.test(p)) {
      // Arbeitsmappe eines Diagramms: Inhalt bleibt, Zeitstempel fest
      neu[p] = zipSync(teileNormalisieren(unzipSync(inhalt), zeitpunkt), { level: 6, mtime: zeitpunkt });
    } else neu[p] = inhalt;
  }
  return neu;
}

/**
 * Paket neu schreiben: docProps/core.xml und app.xml ersetzen, IDs und eingebettete Pakete normalisieren
 * (teileNormalisieren), feste Zeitstempel setzen. Läuft synchron (Worker), Pakete sind klein.
 */
export function paketBereinigen(
  paket: Uint8Array,
  e: DateiEigenschaften,
  optionen: RenderOptionen = {},
): Uint8Array {
  const zeitpunkt = optionen.zeitpunkt ?? new Date();
  const teile = teileNormalisieren(unzipSync(paket), zeitpunkt);
  const neu: Zippable = {};
  for (const [pfad, inhalt] of Object.entries(teile)) {
    if (pfad === 'docProps/core.xml') neu[pfad] = enc.encode(coreXml(e, zeitpunkt));
    else if (pfad === 'docProps/app.xml') neu[pfad] = enc.encode(appXml(e));
    else neu[pfad] = inhalt;
  }
  if (!('docProps/core.xml' in neu)) throw new Error('docProps/core.xml fehlt im Paket');
  if (!('docProps/app.xml' in neu)) throw new Error('docProps/app.xml fehlt im Paket');
  // ZIP-Zeitstempel: DOS-Format kennt kein Jahr vor 1980
  return zipSync(neu, { level: 6, mtime: zeitpunkt });
}
