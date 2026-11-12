// XLSX-Renderer: IR -> Excel-Mappe mit exceljs. Isomorph (Node und Web Worker).
// Im Browser löst der Bundler exceljs über das Feld «browser» auf dist/exceljs.min.js auf
// (enthält eigene Ersatzmodule, keine Node-Polyfills im Bundle-Setup nötig).
import ExcelJS from 'exceljs';
import { paketBereinigen, type RenderOptionen } from './eigenschaften.ts';
import { kennungAnzeige, type DruckGestaltung } from './gestaltung.ts';
import type { Block, Farbrolle, HinweisArt, Text, XlsxAmpel, XlsxBlatt, XlsxFormat, XlsxMappe, XlsxMatrix, XlsxSpalte, Zellwert } from './ir.ts';
import { palette, ROLLE, SCHRIFT, TOKEN, type DokFarben, type RollenFarbe } from './palette.ts';
import { base64 } from './png.ts';
import { kopflogoEinsetzen } from './xlsx-kopflogo.ts';
import { zeichenBereinigen } from './xml-zeichen.ts';
import { LENKUNG_FELDER, hatPlatzhalter, hinweisLabel, istLeer, klartext, texte, type GeneratorTexte } from './texte.ts';

type Worksheet = ExcelJS.Worksheet;
type Cell = ExcelJS.Cell;
/** Bereichsweise Datenüberprüfung: vorhanden in exceljs 4.4, fehlt aber in index.d.ts */
interface DatenUeberpruefung {
  dataValidations: { add(bereich: string, regel: ExcelJS.DataValidation): void };
}

const argb = (hex: string) => ({ argb: 'FF' + hex });
const fuellung = (hex: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: argb(hex) });
/**
 * Schrift immer vollständig setzen, sonst fällt LibreOffice auf eine Serifenschrift zurück. Arial statt Archivo (Design
 * System): auf jedem System mit Excel vorhanden, LibreOffice ersetzt metrisch gleich (palette.ts).
 */
const schrift = (f: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: S.schrift, size: 10, color: argb(TOKEN.text), ...f });
const DUENN: Partial<ExcelJS.Border> = { style: 'thin', color: argb(TOKEN.linieStark) };
const RAHMEN: Partial<ExcelJS.Borders> = { top: DUENN, bottom: DUENN, left: DUENN, right: DUENN };

// Farben aus den hellen Tokens des Design Systems (palette.ts); Platzhalter bleiben gelb (wie die Hervorhebung in Word).
// Mit Gestaltung der Firma (mappe.gestaltung): Titel, Tabellenkopf, Feldbeschriftung, Kopf der Matrizen und neutrale
// Datenbalken aus palette(gestaltung); Ampeln und bedingte Formate der Status- und Risikorollen bleiben fest.
const FARBE = {
  platzhalter: 'FFFF00',
};

interface Stil {
  farbe: DokFarben;
  rolle: Record<Farbrolle, RollenFarbe>;
  schrift: string;
}
const stilAus = (g?: DruckGestaltung): Stil => {
  const p = g?.palette ?? palette();
  return { farbe: p.dok, rolle: p.rolle, schrift: g?.schrift.tabelle ?? SCHRIFT.tabelle };
};
/** Stil der Mappe, die gerade gebaut wird (xlsxMappeBauen setzt ihn synchron zu Beginn und am Ende zurück) */
let S: Stil = stilAus();

/** Hinweise wie in DOCX: Ausfüllen und Vorlage warnung, Norm info, Ausbau gut, Beispiel neutral (Grund: Hauch) */
const HINWEIS_FILL: Record<HinweisArt, string> = {
  ausfuellhinweis: ROLLE['status-warnung'].fill,
  namensnennung: ROLLE['status-warnung'].fill,
  normverweis: ROLLE['status-info'].fill,
  ausbau: ROLLE['status-gut'].fill,
  beispiel: ROLLE['status-neutral'].fill,
};

/** Ampel je Palette: drei Stufen von gut bzw. tief bis kritisch bzw. hoch */
const AMPEL: Record<'risiko' | 'status', [Farbrolle, Farbrolle, Farbrolle]> = {
  risiko: ['risiko-tief', 'risiko-mittel', 'risiko-hoch'],
  status: ['status-gut', 'status-warnung', 'status-kritisch'],
};

/** Format einer bedingten Formatierung (dxf): In dxf-Formaten zählt bgColor */
function dxf(rolle: Farbrolle, fett = false): Partial<ExcelJS.Style> {
  const f = S.rolle[rolle];
  return {
    fill: { type: 'pattern', pattern: 'solid', bgColor: argb(f.fill), fgColor: argb(f.fill) },
    font: { color: argb(f.schrift), ...(fett ? { bold: true } : {}) },
  };
}

/** Spaltenbuchstabe aus 1-basiertem Index. */
export function spaltenName(n: number): string {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Blattnamen bereinigen: verbotene Zeichen, Länge 31, eindeutig (ohne Gross/Klein). */
function blattName(wunsch: string, vergeben: Set<string>): string {
  let basis = wunsch.replace(/[[\]:*?/\\]/g, ' ').replace(/^'+|'+$/g, '').trim() || 'Blatt';
  basis = basis.slice(0, 31);
  let name = basis;
  for (let i = 2; vergeben.has(name.toLowerCase()); i++) {
    const zusatz = ` (${i})`;
    name = basis.slice(0, 31 - zusatz.length) + zusatz;
  }
  vergeben.add(name.toLowerCase());
  return name;
}

/** Text für Kopf-/Fusszeilen: «&» maskieren. */
const kopfText = (s: string) => s.replace(/&/g, '&&');

/** Zeilenhöhe für umbrochenen Text in verbundenen Zellen schätzen (Excel passt diese nicht an). */
function hoeheSchaetzen(text: string, breiteZeichen: number): number {
  // Zusammengeführte Zeilen haben keine automatische Höhe: eher eine Zeile zu viel als abgeschnitten
  const proZeile = Math.max(10, Math.floor(breiteZeichen * 0.9));
  const zeilen = text.split('\n').reduce((n, z) => n + Math.max(1, Math.ceil(z.length / proZeile)), 0);
  return Math.min(409, zeilen * 15 + 6);
}

function textZelle(cell: Cell, t: Text): void {
  cell.value = klartext(t);
  if (hatPlatzhalter(t)) cell.fill = fuellung(FARBE.platzhalter);
}

/** Verbundene Hinweiszeile über die Breite von `spalten` Spalten. */
function hinweisZeile(
  ws: Worksheet,
  zeile: number,
  spalten: number,
  breiteZeichen: number,
  label: string | undefined,
  text: string,
  fill: string,
): void {
  if (spalten > 1) ws.mergeCells(zeile, 1, zeile, spalten);
  const cell = ws.getCell(zeile, 1);
  const f = schrift({ size: 10 });
  cell.value = label
    ? { richText: [{ text: label, font: { ...f, bold: true } }, ...(text ? [{ text: `\n${text}`, font: f }] : [])] }
    : text;
  cell.fill = fuellung(fill);
  cell.alignment = { wrapText: true, vertical: 'top' };
  cell.font = f;
  ws.getRow(zeile).height = hoeheSchaetzen(label ? `${label}\n${text}` : text, breiteZeichen);
}

/** Zeichen je A4-Seite bei 100 %: quer rund 144, hoch rund 96. Unter 72 % würde die Schrift (10 pt) kleiner als 7 pt. */
export const DRUCK_ZEICHEN = { quer: 144, hoch: 96, skalaMin: 0.72 };

/**
 * Druckaufteilung eines Blatts: Querformat ab etwas mehr Breite als eine Hochformatseite, und so viele Seiten nebeneinander,
 * dass die Schrift lesbar bleibt (statt alles auf eine Seite zu skalieren). Ab zwei Seiten wiederholen sich die ersten
 * Spalten mit Kennung und Bezeichnung, damit jede Seite für sich lesbar ist.
 */
export function druckAufteilung(breiten: number[]): { quer: boolean; seiten: number; titelSpalten: number } {
  const summe = breiten.reduce((a, b) => a + b, 0);
  const quer = summe > DRUCK_ZEICHEN.hoch;
  const proSeite = (quer ? DRUCK_ZEICHEN.quer : DRUCK_ZEICHEN.hoch) / DRUCK_ZEICHEN.skalaMin;
  if (summe <= proSeite) return { quer, seiten: 1, titelSpalten: 0 };
  const titelSpalten = (breiten[0] ?? 99) <= 14 && (breiten[0] ?? 0) + (breiten[1] ?? 99) <= 44 ? 2 : (breiten[0] ?? 99) <= 24 ? 1 : 0;
  const titel = breiten.slice(0, titelSpalten).reduce((a, b) => a + b, 0);
  return { quer, seiten: Math.ceil((summe - titel) / (proSeite - titel)), titelSpalten };
}

function seiteEinrichten(ws: Worksheet, firma: string, tx: GeneratorTexte, aufteilung: { quer: boolean; seiten?: number; titelSpalten?: number }, klassifikation: string, titelZeile?: number, g?: DruckGestaltung) {
  const titelSpalte = aufteilung.titelSpalten ? spaltenName(aufteilung.titelSpalten) : undefined;
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: aufteilung.quer ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: aufteilung.seiten ?? 1,
    fitToHeight: 0,
    margins: { left: 0.6, right: 0.6, top: 0.8, bottom: 0.8, header: 0.3, footer: 0.3 },
    ...(titelZeile ? { printTitlesRow: `${titelZeile}:${titelZeile}` } : {}),
    ...(titelSpalte ? { printTitlesColumn: `A:${titelSpalte}` } : {}),
  };
  const [vor, mitte] = tx.seite;
  // Klassifikation auch auf einzeln gedruckten Blättern (Fusszeile Mitte), wie in den Word-Dokumenten
  const klasse = klassifikation ? `&C${kopfText(klassifikation)}` : '';
  if (!g) {
    ws.headerFooter = {
      oddHeader: `&L&B${kopfText(firma)}`,
      oddFooter: `&L${kopfText(firma)}${klasse}&R${kopfText(vor)}&P${kopfText(mitte)}&N`,
    };
    return;
  }
  // Gestaltung: Logo als Bild in der Kopfzeile (&G, VML über xlsx-kopflogo.ts), Kurzname, Vermerk «Entwurf», Zusatzzeile
  const name = g.firmennameZeigen ? `&B${kopfText(g.kopfname ?? firma)}` : '';
  const bild = g.logo ? '&G' : '';
  const links = g.logoPosition === 'links' ? bild : name;
  const rechts = g.logoPosition === 'links' ? name : bild;
  const mittig = g.wasserzeichen ? `&"${g.schrift.tabelle.replace(/"/g, '')},Bold"${kopfText(g.wasserzeichen)}` : '';
  ws.headerFooter = {
    oddHeader: `${links ? `&L${links}` : ''}${mittig ? `&C${mittig}` : ''}${rechts ? `&R${rechts}` : ''}`,
    // Zusatzzeile unter dem Firmennamen (links), klein; mittig würde sie sich mit dem Namen überschneiden
    oddFooter: `&L${kopfText(firma)}${g.fusszeileZusatz ? `\n&7${kopfText(g.fusszeileZusatz)}` : ''}${klasse}&R${kopfText(vor)}&P${kopfText(mitte)}&N`,
  };
}

// Blatt «Dokument»: Lenkungsangaben und Hinweisblock

function lenkungsblatt(wb: ExcelJS.Workbook, mappe: XlsxMappe, tx: GeneratorTexte, name: string, firma: string) {
  const ws = wb.addWorksheet(name);
  ws.columns = [{ width: 28 }, { width: 72 }];
  const breite = 100;
  let r = 1;

  const g = mappe.gestaltung;
  const firmaZelle = ws.getCell(r, 1);
  textZelle(firmaZelle, istLeer(mappe.firmenname) ? [{ text: tx.firmaPlatzhalter, platzhalter: true }] : mappe.firmenname);
  firmaZelle.font = schrift({ bold: true, color: argb(S.farbe.titel) });
  if (g?.logo) logoAufBlatt(wb, ws, g, breiteSpalten(ws));
  r++;
  ws.getCell(r, 1).value = mappe.lenkung.titel;
  ws.getCell(r, 1).font = schrift({ bold: true, size: 16, color: argb(S.farbe.titel) });
  ws.getRow(r).height = 24;
  r++;
  // Excel kennt kein Wasserzeichen: Vermerk «Entwurf» unter dem Titel (und mittig in der Kopfzeile)
  if (g?.wasserzeichen) {
    ws.getCell(r, 1).value = g.wasserzeichen;
    ws.getCell(r, 1).font = schrift({ bold: true, size: 12, color: argb(ROLLE['status-warnung'].linie) });
  }
  r++;

  ws.getCell(r, 1).value = tx.lenkungTitel;
  ws.getCell(r, 1).font = schrift({ bold: true, size: 12, color: argb(S.farbe.titel) });
  r++;
  // Leere Angaben (z. B. «Pfad» in Firmendokumenten) erscheinen nicht
  for (const k of LENKUNG_FELDER.filter((f) => !istLeer(mappe.lenkung[f] ?? ''))) {
    const label = ws.getCell(r, 1);
    label.value = tx.lenkung[k];
    label.font = schrift({ bold: true });
    label.fill = fuellung(S.farbe.label);
    label.border = RAHMEN;
    label.alignment = { vertical: 'top' };
    const wert = ws.getCell(r, 2);
    textZelle(wert, k === 'dokumentId' ? kennungAnzeige(mappe.lenkung.dokumentId, g) : mappe.lenkung[k]!);
    wert.border = RAHMEN;
    wert.alignment = { wrapText: true, vertical: 'top' };
    r++;
  }
  r++;

  for (const b of mappe.hinweisBlock ?? []) {
    r = blockAufBlatt(ws, r, b, tx, breite);
  }
  // Grosse Mappen füllen im Druck viele Seiten, und die Zeilenhöhe folgt der längsten Spalte auf einer anderen Seite (F2-04)
  if (mappe.blaetter.some((b) => b.spalten.length >= 7 || b.zeilen.length > 30)) r = blockAufBlatt(ws, r, { typ: 'absatz', text: tx.druckHinweis }, tx, breite);
  seiteEinrichten(ws, firma, tx, { quer: false }, klartext(mappe.lenkung.klassifikation ?? ''), undefined, g);
  return ws;
}

/** Breite der Spalten A und B in Pixeln (Excel: Zeichenbreite mal 7 plus 5 px Rand, Calibri/Arial 11) */
function breiteSpalten(ws: Worksheet): number[] {
  return [1, 2].map((c) => Math.round((ws.getColumn(c).width ?? 9) * 7 + 5));
}

/** Logo oben rechts im Blatt «Dokument» (in Zeile 1, Grösse wie in der Word-Kopfzeile); Firmenname bleibt in A1 */
function logoAufBlatt(wb: ExcelJS.Workbook, ws: Worksheet, g: DruckGestaltung, spalten: number[]): void {
  const logo = g.logo!;
  const id = wb.addImage({ base64: `data:image/png;base64,${base64(logo.png)}`, extension: 'png' });
  const b = spalten[1]!;
  const w = Math.min(logo.kopf.breite, b - 8);
  const h = Math.round((logo.kopf.hoehe * w) / logo.kopf.breite);
  ws.getRow(1).height = Math.max(15, Math.ceil(((h + 6) * 72) / 96));
  // Anker in EMU (9525 je Pixel): rechtsbündig in Spalte B mit 4 px Abstand, bei «links» am Anfang von Spalte B
  const emu = (px: number) => Math.round(px * 9525);
  const versatz = g.logoPosition === 'links' ? 4 : Math.max(0, b - w - 4);
  const tl = { nativeCol: 1, nativeColOff: emu(versatz), nativeRow: 0, nativeRowOff: emu(3) };
  ws.addImage(id, { tl, ext: { width: w, height: h }, editAs: 'oneCell' } as unknown as ExcelJS.ImageRange);
}

/** Einfache Blöcke auf dem Lenkungsblatt; gibt die nächste freie Zeile zurück. */
function blockAufBlatt(ws: Worksheet, r: number, b: Block, tx: GeneratorTexte, breite: number): number {
  switch (b.typ) {
    case 'hinweis':
      hinweisZeile(ws, r, 2, breite, hinweisLabel(b.art, b.titel, tx), klartext(b.text), HINWEIS_FILL[b.art]);
      return r + 2;
    case 'ueberschrift':
      ws.getCell(r, 1).value = b.text;
      ws.getCell(r, 1).font = schrift({ bold: true, size: b.ebene === 1 ? 13 : 11, color: argb(S.farbe.titel) });
      return r + 1;
    case 'absatz': {
      const t = klartext(b.text);
      ws.mergeCells(r, 1, r, 2);
      textZelle(ws.getCell(r, 1), b.text);
      ws.getCell(r, 1).alignment = { wrapText: true, vertical: 'top' };
      ws.getRow(r).height = hoeheSchaetzen(t, breite);
      return r + 2;
    }
    case 'liste':
      b.punkte.forEach((p, i) => {
        ws.mergeCells(r, 1, r, 2);
        ws.getCell(r, 1).value = `${b.nummeriert ? `${i + 1}.` : '•'} ${klartext(p)}`;
        ws.getCell(r, 1).alignment = { wrapText: true, vertical: 'top', indent: 1 };
        ws.getRow(r).height = hoeheSchaetzen(`  ${klartext(p)}`, breite);
        r++;
      });
      return r + 1;
    case 'felder':
      for (const f of b.felder) {
        ws.getCell(r, 1).value = f.label;
        ws.getCell(r, 1).font = schrift({ bold: true });
        textZelle(ws.getCell(r, 2), f.wert);
        r++;
      }
      return r + 1;
    case 'tabelle':
    case 'unterschriften':
    case 'seitenumbruch':
    case 'matrix':
    case 'diagramm':
    case 'ablauf':
      // Auf dem Lenkungsblatt nicht vorgesehen; Tabellen gehören in eigene Blätter
      return r;
    default: {
      const unbekannt: never = b;
      throw new Error(`Unbekannter Blocktyp: ${JSON.stringify(unbekannt)}`);
    }
  }
}

// Datenblätter

interface ListenQuelle {
  /** Formel für die Datenüberprüfung */
  holen(werte: string[]): string;
  /** Ausgeblendetes Listenblatt am Ende anlegen, falls benötigt */
  schreiben(wb: ExcelJS.Workbook): void;
}

/** Auswahlwerte inline («"a,b"») oder bei Kommas/Länge über ein ausgeblendetes Listenblatt. */
function listenQuelle(name: string): ListenQuelle {
  const spalten: string[][] = [];
  return {
    holen(werte) {
      const inline = werte.join(',');
      if (!werte.some((w) => w.includes(',') || w.includes('"')) && inline.length <= 250) {
        return `"${inline}"`;
      }
      spalten.push(werte);
      const sp = spaltenName(spalten.length);
      return `'${name.replace(/'/g, "''")}'!$${sp}$1:$${sp}$${werte.length}`;
    },
    schreiben(wb) {
      if (spalten.length === 0) return;
      const ws = wb.addWorksheet(name, { state: 'hidden' });
      spalten.forEach((werte, s) => werte.forEach((w, z) => (ws.getCell(z + 1, s + 1).value = w)));
    },
  };
}

function zellwert(wert: Zellwert, spalte: XlsxSpalte): ExcelJS.CellValue {
  if (wert === null || wert === '') return null;
  if (spalte.typ === 'datum' && typeof wert === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(wert)) {
    const [j, m, t] = wert.split('-').map(Number) as [number, number, number];
    return new Date(Date.UTC(j, m - 1, t));
  }
  return wert;
}

/** Ampeln und weitere bedingte Formate eines Datenblatts (Zeilen erste bis letzte) */
function bedingteFormate(ws: Worksheet, blatt: XlsxBlatt, name: string, erste: number, letzte: number): void {
  let prio = 1;
  const bereich = (spalte: number, art: string) => {
    if (spalte < 0 || spalte >= blatt.spalten.length) throw new Error(`${art}spalte ${spalte} fehlt in «${name}»`);
    const sp = spaltenName(spalte + 1);
    return { sp, ref: `${sp}${erste}:${sp}${letzte}`, zelle: `${sp}${erste}` };
  };
  const ausdruck = (formel: string, rolle: Farbrolle): ExcelJS.ConditionalFormattingRule => ({ type: 'expression', priority: prio++, formulae: [formel], style: dxf(rolle) });
  const ampeln: XlsxAmpel[] = blatt.ampel ? (Array.isArray(blatt.ampel) ? blatt.ampel : [blatt.ampel]) : [];
  for (const a of ampeln) {
    const { ref, zelle } = bereich(a.spalte, 'Ampel');
    const [r1, r2, r3] = AMPEL[a.palette ?? 'status'];
    ws.addConditionalFormatting({
      ref,
      rules: [
        ausdruck(`AND(ISNUMBER(${zelle}),${zelle}<=${a.gruenBis})`, r1),
        ausdruck(`AND(ISNUMBER(${zelle}),${zelle}>${a.gruenBis},${zelle}<=${a.gelbBis})`, r2),
        ausdruck(`AND(ISNUMBER(${zelle}),${zelle}>${a.gelbBis})`, r3),
      ],
    });
  }
  for (const f of blatt.formate ?? []) formatAnwenden(ws, f, bereich(f.spalte, 'Format'), () => prio++);
}

function formatAnwenden(ws: Worksheet, f: XlsxFormat, b: { ref: string; zelle: string }, prio: () => number): void {
  const textWert = (t: string) => `"${t.replace(/"/g, '""')}"`;
  switch (f.art) {
    case 'datenbalken':
      ws.addConditionalFormatting({
        ref: b.ref,
        rules: [
          {
            type: 'dataBar',
            priority: prio(),
            gradient: false,
            cfvo: [
              { type: 'num', value: f.min },
              { type: 'num', value: f.max },
            ],
            // Helle Balkenfarbe, damit die Zahl in der Zelle lesbar bleibt (Spike)
            color: argb(S.rolle[f.rolle ?? 'seq-2'].fill),
          } as ExcelJS.DataBarRuleType,
        ],
      });
      return;
    case 'farbskala':
      ws.addConditionalFormatting({
        ref: b.ref,
        rules: [
          {
            type: 'colorScale',
            priority: prio(),
            cfvo: [
              { type: 'num', value: f.min },
              { type: 'num', value: (f.min + f.max) / 2 },
              { type: 'num', value: f.max },
            ],
            color: [argb(TOKEN.karte), argb(S.rolle['seq-1'].fill), argb(S.rolle['seq-2'].fill)],
          } as ExcelJS.ColorScaleRuleType,
        ],
      });
      return;
    case 'text':
      ws.addConditionalFormatting({
        ref: b.ref,
        rules: f.regeln.map((r) => ({ type: 'expression', priority: prio(), formulae: [`${b.zelle}=${textWert(r.text)}`], style: dxf(r.rolle) })),
      });
      return;
    case 'stufen': {
      // Bereiche schliessen sich aus (exceljs schreibt kein stopIfTrue): über der vorherigen Grenze bis zur eigenen
      const grenzen = [...f.regeln].sort((x, y) => x.bis - y.bis);
      const regeln: ExcelJS.ConditionalFormattingRule[] = grenzen.map((r, i) => ({
        type: 'expression',
        priority: prio(),
        formulae: [`AND(ISNUMBER(${b.zelle}),${i > 0 ? `${b.zelle}>${grenzen[i - 1]!.bis},` : ''}${b.zelle}<=${r.bis})`],
        style: dxf(r.rolle),
      }));
      const oben = grenzen.at(-1)?.bis;
      if (f.sonst && oben !== undefined) regeln.push({ type: 'expression', priority: prio(), formulae: [`AND(ISNUMBER(${b.zelle}),${b.zelle}>${oben})`], style: dxf(f.sonst) });
      ws.addConditionalFormatting({ ref: b.ref, rules: regeln });
      return;
    }
    default: {
      const unbekannt: never = f;
      throw new Error(`Unbekanntes Format: ${JSON.stringify(unbekannt)}`);
    }
  }
}

/** Lage der Daten eines Datenblatts: Kopfzeile, erste und letzte Datenzeile (wie in datenblatt) */
export function blattLage(blatt: XlsxBlatt): { kopfZeile: number; erste: number; letzte: number } {
  let r = 1;
  if (blatt.titel) r++;
  r += (blatt.hinweise ?? []).length;
  if (r > 1) r++;
  const kopfZeile = r;
  const anzahl = blatt.zeilen.length + (blatt.leereZeilen ?? 0);
  return { kopfZeile, erste: kopfZeile + 1, letzte: Math.max(kopfZeile + 1, kopfZeile + anzahl) };
}

/** Bezüge der Matrizen auf andere Blätter: Name im Paket und Lage der Daten */
type Lagen = Map<string, { name: string; blatt: XlsxBlatt; erste: number; letzte: number }>;

/** Zusätzliche Zeilen im COUNTIFS-Bereich, damit neue Einträge im Register mitzählen */
const MATRIX_RESERVE = 500;

/** Matrix ab Zeile r: Titel, Kopfzeile, Zeilen; gibt die nächste freie Zeile zurück */
function matrixSchreiben(ws: Worksheet, r: number, m: XlsxMatrix, lagen: Lagen, prio: () => number): number {
  const q = lagen.get(m.quelle.blatt);
  if (!q) throw new Error(`Matrix «${m.titel}»: Blatt «${m.quelle.blatt}» fehlt`);
  const blattRef = `'${q.name.replace(/'/g, "''")}'`;
  const bis = q.letzte + MATRIX_RESERVE;
  const spalte = (i: number) => {
    if (i < 0 || i >= q.blatt.spalten.length) throw new Error(`Matrix «${m.titel}»: Spalte ${i} fehlt in «${q.name}»`);
    const sp = spaltenName(i + 1);
    return `${blattRef}!$${sp}$${q.erste}:$${sp}$${bis}`;
  };
  const zahlFormat = (text: string) => `"${text.replace(/"/g, "'")}"`;
  ws.getCell(r, 1).value = m.titel;
  ws.getCell(r, 1).font = schrift({ bold: true, size: 12, color: argb(S.farbe.titel) });
  r++;
  const kopf = r;
  const kopfSchrift = S.farbe.kopfText ? { color: argb(S.farbe.kopfText) } : {};
  const ecke = ws.getCell(kopf, 1);
  ecke.value = m.ecke;
  ecke.font = schrift({ bold: true, ...kopfSchrift });
  ecke.fill = fuellung(S.rolle.kopf.fill);
  ecke.alignment = { vertical: 'middle', wrapText: true };
  m.spalten.forEach((s, j) => {
    const c = ws.getCell(kopf, j + 2);
    // Zahl mit Textformat: COUNTIFS greift auf die Zahl, sichtbar ist die Beschriftung
    c.value = s.wert;
    c.numFmt = zahlFormat(s.text);
    c.font = schrift({ bold: true, ...kopfSchrift });
    c.fill = fuellung(S.rolle.kopf.fill);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  ws.getRow(kopf).height = 32;
  const zusatz = (m.quelle.bedingungen ?? []).map((b) => `,${spalte(b.spalte)},"${b.kriterium.replace(/"/g, '""')}"`).join('');
  const [kt, km, kh] = m.zonen.kuerzel;
  const erste = kopf + 1;
  m.zeilen.forEach((z, i) => {
    const zr = erste + i;
    const k = ws.getCell(zr, 1);
    k.value = z.wert;
    k.numFmt = zahlFormat(z.text);
    k.font = schrift({ bold: true, ...kopfSchrift });
    k.fill = fuellung(S.rolle.kopf.fill);
    k.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    m.spalten.forEach((s, j) => {
      const c = ws.getCell(zr, j + 2);
      const col = spaltenName(j + 2);
      const formula = `COUNTIFS(${spalte(m.quelle.zeilenSpalte)},$A${zr},${spalte(m.quelle.spaltenSpalte)},${col}$${kopf}${zusatz})`;
      c.value = { formula, result: m.ergebnisse[i]?.[j] ?? 0 } as ExcelJS.CellFormulaValue;
      // Anzahl mit Stufe und Wert: Bedeutung nicht nur über die Farbe
      const wert = z.wert * s.wert;
      const stufe = wert <= m.zonen.tiefBis ? kt : wert >= m.zonen.hochAb ? kh : km;
      c.numFmt = `0" (${stufe} ${wert})"`;
      c.font = schrift();
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = { top: WEISS, bottom: WEISS, left: WEISS, right: WEISS };
    });
    ws.getRow(zr).height = 26;
  });
  const letzte = erste + m.zeilen.length - 1;
  const ende = spaltenName(m.spalten.length + 1);
  // Zone aus Zeilen- mal Spaltenwert (Kopfspalte A, Kopfzeile), Reihenfolge: hoch, tief, sonst mittel
  const produkt = `$A${erste}*B$${kopf}`;
  ws.addConditionalFormatting({
    ref: `B${erste}:${ende}${letzte}`,
    rules: [
      { type: 'expression', priority: prio(), formulae: [`${produkt}>=${m.zonen.hochAb}`], style: dxf('risiko-hoch', true) },
      { type: 'expression', priority: prio(), formulae: [`AND(${produkt}>${m.zonen.tiefBis},${produkt}<${m.zonen.hochAb})`], style: dxf('risiko-mittel') },
      { type: 'expression', priority: prio(), formulae: [`${produkt}<=${m.zonen.tiefBis}`], style: dxf('risiko-tief') },
    ],
  });
  return letzte + 2;
}

const WEISS: Partial<ExcelJS.Border> = { style: 'thin', color: argb(TOKEN.karte) };

/** Blatt mit Matrizen (Titel, Hinweise, je Matrix Titel und Kreuztabelle) */
function matrixblatt(wb: ExcelJS.Workbook, blatt: XlsxBlatt, name: string, firma: string, tx: GeneratorTexte, lagen: Lagen, klassifikation: string, g?: DruckGestaltung): void {
  const ws = wb.addWorksheet(name);
  const spalten = Math.max(...(blatt.matrizen ?? []).map((m) => m.spalten.length), 1);
  ws.columns = [{ width: 24 }, ...Array.from({ length: spalten }, () => ({ width: 16 }))];
  const breiteZeichen = 24 + spalten * 16;
  let r = 1;
  if (blatt.titel) {
    ws.getCell(r, 1).value = blatt.titel;
    ws.getCell(r, 1).font = schrift({ bold: true, size: 14, color: argb(S.farbe.titel) });
    ws.getRow(r).height = 22;
    r++;
  }
  for (const h of blatt.hinweise ?? []) {
    hinweisZeile(ws, r, spalten + 1, breiteZeichen, undefined, h, HINWEIS_FILL.ausfuellhinweis);
    r++;
  }
  if (r > 1) r++;
  let prio = 1;
  for (const m of blatt.matrizen ?? []) r = matrixSchreiben(ws, r, m, lagen, () => prio++);
  seiteEinrichten(ws, firma, tx, { quer: false }, klassifikation, undefined, g);
}

/** Längstes Wort einer Zelle; umbrochen wird an Leerzeichen und nach Bindestrichen */
const wortLaenge = (t: unknown): number => (typeof t === 'string' ? Math.max(0, ...t.split(/\s+|(?<=-)/u).map((w) => w.length)) : 0);
const zeilenWerte = (blatt: XlsxBlatt, i: number): unknown[] => blatt.zeilen.map((z) => z[i]).filter((w) => w !== null && w !== undefined && w !== '');

/**
 * Spaltenbreiten: mindestens das längste Wort der Spalte, damit Excel nicht mitten im Wort umbricht. Der Filterpfeil im Kopf
 * braucht zwei Zeichen mehr. Obergrenze 34, damit einzelne lange Angaben (Adressen) die Spalte nicht sprengen.
 */
export function spaltenBreiten(blatt: XlsxBlatt): number[] {
  return blatt.spalten.map((s, i) => {
    const kopf = Math.ceil(wortLaenge(s.kopf) * 1.1) + 3;
    const daten = Math.max(0, ...zeilenWerte(blatt, i).map(wortLaenge), ...(s.liste ?? []).map(wortLaenge)) + 2;
    return Math.max(s.breite ?? 15, Math.min(34, Math.max(kopf, daten)));
  });
}

/** Umbruch: wie in der Spalte festgelegt; längerer Text als die Spalte bricht immer um, sonst wäre er abgeschnitten */
function mitUmbruch(blatt: XlsxBlatt, i: number, breite: number): boolean {
  const s = blatt.spalten[i]!;
  if (s.umbruch ?? s.typ !== 'zahl') return true;
  return zeilenWerte(blatt, i).some((w) => typeof w === 'string' && w.length > breite * 0.95);
}

/** Spalten für Hinweise: die der ersten Druckseite; mindestens zwei, damit der Hinweis nicht in eine schmale Spalte fällt */
function hinweisSpaltenZahl(breiten: number[], seiten: number): number {
  if (seiten <= 1) return breiten.length;
  const ziel = breiten.reduce((a, b) => a + b, 0) / seiten;
  let summe = 0;
  let n = 0;
  for (const b of breiten) {
    if (summe + b > ziel) break;
    summe += b;
    n++;
  }
  return Math.max(2, n);
}

/** Auswahlliste einer Spalte, ergänzt um die Werte, die in den Zeilen stehen */
function listeMitWerten(liste: string[], blatt: XlsxBlatt, i: number): string[] {
  const zusatz = zeilenWerte(blatt, i).filter((w): w is string => typeof w === 'string' && !liste.includes(w));
  return [...liste, ...new Set(zusatz)];
}

function datenblatt(
  wb: ExcelJS.Workbook,
  blatt: XlsxBlatt,
  name: string,
  firma: string,
  tx: GeneratorTexte,
  sprache: 'de' | 'en',
  listen: ListenQuelle,
  klassifikation: string,
  g?: DruckGestaltung,
): void {
  const ws = wb.addWorksheet(name);
  const n = Math.max(1, blatt.spalten.length);
  const breiten = spaltenBreiten(blatt);
  ws.columns = breiten.map((width, i) => ({ width, ...(blatt.spalten[i]?.versteckt ? { hidden: true } : {}) }));
  const aufteilung = druckAufteilung(breiten.filter((_, i) => !blatt.spalten[i]?.versteckt));
  // Hinweise nur über die Spalten der ersten Druckseite, sonst zerreisst der Text an der Seitengrenze
  const hinweisSpalten = hinweisSpaltenZahl(breiten, aufteilung.seiten);
  const breiteZeichen = breiten.slice(0, hinweisSpalten).reduce((a, b) => a + b, 0);
  let r = 1;

  if (blatt.titel) {
    ws.getCell(r, 1).value = blatt.titel;
    ws.getCell(r, 1).font = schrift({ bold: true, size: 14, color: argb(S.farbe.titel) });
    ws.getRow(r).height = 22;
    r++;
  }
  for (const h of blatt.hinweise ?? []) {
    hinweisZeile(ws, r, hinweisSpalten, breiteZeichen, undefined, h, HINWEIS_FILL.ausfuellhinweis);
    r++;
  }
  if (r > 1) r++;

  const kopfZeile = r;
  blatt.spalten.forEach((s, i) => {
    const c = ws.getCell(kopfZeile, i + 1);
    c.value = s.kopf;
    c.font = schrift({ bold: true, ...(S.farbe.kopfText ? { color: argb(S.farbe.kopfText) } : {}) });
    c.fill = fuellung(S.farbe.kopf);
    c.border = RAHMEN;
    c.alignment = { wrapText: true, vertical: 'top' };
  });

  const erste = kopfZeile + 1;
  const anzahl = blatt.zeilen.length + (blatt.leereZeilen ?? 0);
  const letzte = Math.max(erste, kopfZeile + anzahl);
  const datumFormat = sprache === 'en' ? 'dd/mm/yyyy' : 'dd.mm.yyyy';

  for (let z = 0; z < anzahl; z++) {
    const zeile = erste + z;
    const daten = blatt.zeilen[z];
    blatt.spalten.forEach((s, i) => {
      const c = ws.getCell(zeile, i + 1);
      if (s.typ === 'formel' && s.formel) {
        // Wert der Zeile in einer Formelspalte: zwischengespeichertes Ergebnis (sichtbar ohne Neuberechnung)
        const formula = s.formel.replace(/^=/, '').replace(/\{r\}/g, String(zeile));
        // Zählformeln ohne Vorgabe speichern 0, damit Vorschauen ohne Neuberechnung (iPhone) nicht leer bleiben
        const vorgabe = daten?.[i];
        const ergebnis = vorgabe === null || vorgabe === undefined || vorgabe === '' ? (daten && /^COUNT/.test(formula) ? 0 : '') : vorgabe;
        // Jede Formel trägt einen gespeicherten Wert, auch den leeren Text von IF und IFERROR (Vorschauen rechnen nicht neu)
        c.value = { formula, result: ergebnis } as ExcelJS.CellFormulaValue;
      } else if (daten) {
        c.value = zellwert(daten[i] ?? null, s);
      }
      if (s.typ === 'datum') c.numFmt = datumFormat;
      c.font = schrift();
      c.border = RAHMEN;
      c.alignment = { wrapText: mitUmbruch(blatt, i, breiten[i]!), vertical: 'top' };
    });
  }

  // Datenüberprüfung je Listenspalte über alle Daten- und Leerzeilen
  blatt.spalten.forEach((s, i) => {
    if (s.typ !== 'liste' || !s.liste?.length) return;
    const sp = spaltenName(i + 1);
    (ws as Worksheet & DatenUeberpruefung).dataValidations.add(`${sp}${erste}:${sp}${letzte}`, {
      type: 'list',
      allowBlank: true,
      // Werte der Zeile, die nicht in der Liste stehen (eigene Angaben), ergänzen die Auswahl: Sonst warnt Excel beim Ändern
      formulae: [listen.holen(listeMitWerten(s.liste, blatt, i))],
      showErrorMessage: true,
      errorStyle: 'warning',
      error: sprache === 'en' ? 'Please choose a value from the list.' : 'Bitte einen Wert aus der Liste wählen.',
    });
  });

  bedingteFormate(ws, blatt, name, erste, letzte);

  if (blatt.fixiert) {
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: kopfZeile, topLeftCell: `A${erste}`, activeCell: `A${erste}` }];
  }
  ws.autoFilter = { from: { row: kopfZeile, column: 1 }, to: { row: letzte, column: n } };
  seiteEinrichten(ws, firma, tx, aufteilung, klassifikation, kopfZeile, g);
  // Leere Eingabezeilen eines ausgefüllten Blatts nicht drucken (F2-04); Vorlagen drucken alle Zeilen
  if (blatt.zeilen.length && blatt.leereZeilen) ws.pageSetup.printArea = `A1:${spaltenName(blatt.spalten.length)}${kopfZeile + blatt.zeilen.length}`;
}

export async function xlsxMappeBauen(mappe: XlsxMappe, zeitpunkt: Date): Promise<ExcelJS.Workbook> {
  // Synchron bis zum Ende (kein await): Stil gilt genau für diese Mappe
  const vorher = S;
  S = stilAus(mappe.gestaltung);
  try {
    return mappeBauen(mappe, zeitpunkt);
  } finally {
    S = vorher;
  }
}

function mappeBauen(mappe: XlsxMappe, zeitpunkt: Date): ExcelJS.Workbook {
  const tx = texte(mappe.sprache);
  const wb = new ExcelJS.Workbook();
  const autor = mappe.eigenschaften.autor.trim();
  wb.creator = autor;
  wb.lastModifiedBy = autor;
  wb.company = autor;
  wb.title = mappe.eigenschaften.titel;
  wb.subject = mappe.eigenschaften.betreff ?? '';
  wb.created = zeitpunkt;
  wb.modified = zeitpunkt;
  // Jede Formel trägt ihr Ergebnis (formelZelle, Matrix): ohne «fullCalcOnLoad» gelten die gespeicherten Werte als aktuell,
  // Vorschauen ohne Rechenwerk (iPhone Quick Look, Outlook, Web-Viewer) zeigen sie; Excel rechnet bei jeder Änderung neu
  // (Befund gridcraft check test.7: staleCache bei 26 Mappen, Werte selbst stimmten)
  wb.calcProperties = { fullCalcOnLoad: false };

  const firma = istLeer(mappe.firmenname) ? tx.firmaPlatzhalter : klartext(mappe.firmenname);
  const g = mappe.gestaltung;
  const vergeben = new Set<string>();
  const dokName = blattName(tx.blattDokument, vergeben);
  const namen = mappe.blaetter.map((b) => blattName(b.name, vergeben));
  const listen = listenQuelle(blattName(tx.blattListen, vergeben));

  const lagen: Lagen = new Map(mappe.blaetter.map((b, i) => [b.name, { name: namen[i]!, blatt: b, ...blattLage(b) }]));

  lenkungsblatt(wb, mappe, tx, dokName, firma);
  mappe.blaetter.forEach((b, i) =>
    b.matrizen?.length ? matrixblatt(wb, b, namen[i]!, firma, tx, lagen, klartext(mappe.lenkung.klassifikation ?? ''), g) : datenblatt(wb, b, namen[i]!, firma, tx, mappe.sprache, listen, klartext(mappe.lenkung.klassifikation ?? ''), g),
  );
  listen.schreiben(wb);
  return wb;
}

function alsUint8(daten: unknown): Uint8Array {
  if (daten instanceof Uint8Array) return new Uint8Array(daten.buffer, daten.byteOffset, daten.byteLength);
  if (daten instanceof ArrayBuffer) return new Uint8Array(daten);
  throw new Error('exceljs lieferte kein Binärformat');
}

export async function renderXlsx(roheingabe: XlsxMappe, optionen: RenderOptionen = {}): Promise<Uint8Array> {
  const mappe = zeichenBereinigen(roheingabe);
  const zeitpunkt = optionen.zeitpunkt ?? new Date();
  const wb = await xlsxMappeBauen(mappe, zeitpunkt);
  let roh = alsUint8(await wb.xlsx.writeBuffer());
  // Logo in der gedruckten Kopfzeile: exceljs kann keine Bilder in Kopf- und Fusszeilen, darum Nachbearbeitung im Paket
  const logo = mappe.gestaltung?.logo;
  if (logo) roh = kopflogoEinsetzen(roh, logo.png, logo.kopf, mappe.gestaltung!.logoPosition, logo.alt);
  return paketBereinigen(roh, mappe.eigenschaften, { ...optionen, zeitpunkt });
}
