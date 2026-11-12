// DOCX-Renderer: IR -> Word-Datei. Isomorph (Node und Web Worker), keine Node-APIs.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Tab,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type IBorderOptions,
  type IParagraphStyleOptions,
} from 'docx';
import { ChartRun } from 'docx/charts';
import { ShapeCanvasRun, type IShapeCanvasChildOptions } from 'docx/shapes';
import { ablaufBeschriftung, ablaufPlatz, ablaufWege, seitenPunkt, type Rechteck } from '../grafik/svg/ablauf.ts';
import { TextWatermark } from 'docx/watermarks';
import { paketBereinigen, type RenderOptionen } from './eigenschaften.ts';
import { kennungAnzeige, type DruckGestaltung } from './gestaltung.ts';
import type { AblaufBlock, AblaufForm, Block, DiagrammBlock, DocxDokument, Farbrolle, HinweisArt, MatrixBlock, Text, Unterschrift } from './ir.ts';
import { ROLLE, SCHRIFT, TOKEN, diagrammFarbeIn, palette, type DokFarben, type RollenFarbe } from './palette.ts';
import { svgBereinigen } from './svg.ts';
import { LENKUNG_FELDER, hinweisLabel, istLeer, klartext, laeufe, texte, type GeneratorTexte } from './texte.ts';
import { zeichenBereinigen } from './xml-zeichen.ts';

// Masse in Twip (1/20 pt). A4 hoch, Ränder links 2,5 cm, sonst 2 cm.
const A4 = { breite: 11906, hoehe: 16838 };
const RAND = { oben: 1418, unten: 1134, links: 1418, rechts: 1134, kopf: 709, fuss: 567 };
const SATZBREITE = A4.breite - RAND.links - RAND.rechts;

// Farben aus den hellen Tokens des Design Systems (palette.ts): Überschriften und betonter Text in tinte, Fliesstext in
// text, Metadaten in gedaempft; Tabellenkopf auf flaeche-tief, Feldbeschriftung auf seite; Linien linie-stark. Mit
// Gestaltung der Firma (dok.gestaltung) gelten Palette und Schriften aus palette(gestaltung) für Marke und Struktur;
// semantische Rollen (Risiko, Status, Hinweise, Platzhalter) bleiben fest.
interface Stil {
  farbe: DokFarben;
  rolle: Record<Farbrolle, RollenFarbe>;
  schrift: { titel: string; text: string; tabelle: string };
  diagramm: (rolle: Farbrolle) => string;
}

function stilAus(g?: DruckGestaltung): Stil {
  const p = g?.palette ?? palette();
  return { farbe: p.dok, rolle: p.rolle, schrift: g?.schrift ?? { ...SCHRIFT }, diagramm: (r) => diagrammFarbeIn(p, r) };
}

/**
 * Stil des Dokuments, das gerade gebaut wird. docxDokumentBauen setzt ihn zu Beginn und läuft synchron bis zum fertigen
 * Objektbaum (Farben und Schriften stehen danach in den Objekten); Packer.pack liest ihn nicht mehr.
 */
let S: Stil = stilAus();

/**
 * Hinweise als Banner des Design Systems (Komponente Hinweis): Grund status-<s>-hauch, Rahmen rundum in
 * status-<s>-flaeche, Text in tinte. Ausfüllen und Vorlage: warnung (vor Freigabe löschen), Norm: info, Ausbau: gut,
 * Beispiel: neutral.
 */
const HINWEIS: Record<HinweisArt, { stil: string; name: string; rolle: 'status-warnung' | 'status-info' | 'status-gut' | 'status-neutral' }> = {
  ausfuellhinweis: { stil: 'HinweisAusfuellen', name: 'Hinweis Ausfüllen', rolle: 'status-warnung' },
  namensnennung: { stil: 'HinweisVorlage', name: 'Hinweis Vorlage', rolle: 'status-warnung' },
  normverweis: { stil: 'HinweisNorm', name: 'Hinweis Norm', rolle: 'status-info' },
  ausbau: { stil: 'HinweisAusbau', name: 'Hinweis Ausbau', rolle: 'status-gut' },
  beispiel: { stil: 'HinweisBeispiel', name: 'Hinweis Beispiel', rolle: 'status-neutral' },
};

/** Schriftgrössen in halben Punkten */
const GROESSE = { text: 20, tabelle: 17, hinweis: 17, kopf: 17, fuss: 15, klein: 15 };

const LINIE: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: TOKEN.linieStark };
const ZELLRAND = { top: LINIE, bottom: LINIE, left: LINIE, right: LINIE };

// Textläufe

interface LaufStil {
  fett?: boolean;
  groesse?: number; // halbe Punkte
  farbe?: string;
  /** Schrift, z. B. die Titelschrift für Firmenname in Kopfzeile und Titelseite */
  schrift?: string;
}

function textLaeufe(t: Text, stil: LaufStil = {}): TextRun[] {
  const runs: TextRun[] = [];
  for (const l of laeufe(t)) {
    // Zeilenumbrüche im Text als weiche Umbrüche
    const zeilen = l.text.split('\n');
    zeilen.forEach((zeile, i) => {
      runs.push(
        new TextRun({
          text: zeile,
          break: i > 0 ? 1 : undefined,
          bold: l.fett ?? stil.fett,
          italics: l.kursiv,
          size: stil.groesse,
          color: stil.farbe,
          font: stil.schrift,
          // Platzhalter: Word-Hervorhebung, leicht auffindbar und entfernbar
          highlight: l.platzhalter ? 'yellow' : undefined,
        }),
      );
    });
  }
  return runs;
}

function absatz(t: Text, optionen: { stil?: LaufStil; ausrichtung?: 'left' | 'right' | 'center' } = {}) {
  return new Paragraph({
    children: textLaeufe(t, optionen.stil),
    alignment: optionen.ausrichtung === 'right' ? AlignmentType.RIGHT : undefined,
  });
}

// Tabellen

function zelle(inhalt: Text, breite: number, optionen: { fill?: string; fett?: boolean; farbe?: string; zusammen?: boolean } = {}): TableCell {
  return new TableCell({
    children: [
      new Paragraph({ style: 'Tabellentext', keepNext: optionen.zusammen, children: textLaeufe(inhalt, { fett: optionen.fett, farbe: optionen.farbe }) }),
    ],
    width: { size: breite, type: WidthType.DXA },
    shading: optionen.fill ? { fill: optionen.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    borders: ZELLRAND,
    verticalAlign: VerticalAlignTable.TOP,
  });
}

/** Relative Breiten auf die Satzbreite verteilen. */
function spaltenbreiten(anzahl: number, breiten?: number[]): number[] {
  const gewichte = Array.from({ length: anzahl }, (_, i) => {
    const b = breiten?.[i];
    return b !== undefined && b > 0 ? b : 1;
  });
  const summe = gewichte.reduce((a, b) => a + b, 0);
  const roh = gewichte.map((g) => Math.floor((g / summe) * SATZBREITE));
  const rest = SATZBREITE - roh.reduce((a, b) => a + b, 0);
  roh[roh.length - 1] = (roh[roh.length - 1] ?? 0) + rest;
  return roh;
}

/** Geschätzte Zeichenbreite der Tabellenschrift (8,5 pt) in DXA, Innenrand einer Zelle in DXA */
const ZEICHEN_DXA = 95;
const ZELLRAND_DXA = 230;

/** Längstes Wort einer Zelle; umbrochen wird an Leerzeichen und nach Bindestrichen */
function laengstesWort(t: Text): number {
  // Reine Buchstabenwörter ab 16 Zeichen dürfen weich getrennt werden (weichTrennen) und verdrängen keine ID-Spalte
  // Kennungen wie KI-001 bleiben ganz (kein Umbruch nach dem Bindestrich), sonst bricht die ID-Spalte in drei Zeilen
  return Math.max(0, ...laeufe(t).flatMap((l) => l.text.split(/\s+/u).flatMap((w) => (/^[A-Z]{1,4}-\d/.test(w) ? [w] : w.split(/(?<=-)/u)))).map((w) => (/^[\p{L}]+[.,;:)]?$/u.test(w) ? Math.min(w.length, 16) : w.length)));
}

const WEICH = '\u00AD';
/** Mögliche Trennstellen eines Worts: vor einem Konsonanten, dem ein Vokal folgt, oder zwischen zwei Konsonanten vor einem Vokal */
function trennstellen(wort: string): number[] {
  const vokal = /[aeiouyäöüAEIOUYÄÖÜ]/;
  const stellen: number[] = [];
  for (let i = 2; i < wort.length - 2; i++) {
    if (vokal.test(wort[i - 1]!) && !vokal.test(wort[i]!) && vokal.test(wort[i + 1]!)) stellen.push(i);
    else if (!vokal.test(wort[i - 1]!) && !vokal.test(wort[i]!) && vokal.test(wort[i + 1]!) && vokal.test(wort[i - 2]!) && !/(ch|ck|sch|ph|th)$/.test(wort.slice(0, i + 1))) stellen.push(i);
  }
  return stellen;
}
/** Wörter, die nicht in die Spalte passen, erhalten weiche Trennstellen; sonst bricht Word mitten im Wort ohne Trennstrich */
export function weichTrennen(text: string, proZeile: number): string {
  return text.replace(/[\p{L}]{9,}/gu, (w) => {
    if (w.length <= proZeile) return w;
    const stellen = trennstellen(w);
    return stellen.length ? [...w].map((c, i) => (stellen.includes(i) ? WEICH + c : c)).join('') : w;
  });
}
function zellTextTrennen(t: Text, proZeile: number): Text {
  return typeof t === 'string' ? weichTrennen(t, proZeile) : t.map((l) => ({ ...l, text: weichTrennen(l.text, proZeile) }));
}

/**
 * Spaltenbreiten so verteilen, dass das längste Wort jeder Spalte in die Zelle passt (Word und LibreOffice brechen in
 * festen Tabellen sonst mitten im Wort). Was eine Spalte dazu braucht, geben die Spalten mit Reserve anteilig ab. Passt es
 * insgesamt nicht, bleibt das Verhältnis der Mindestbreiten.
 */
export function spaltenOhneWortbruch(soll: number[], kopf: Text[], zeilen: Text[][]): number[] {
  const min = soll.map((_, i) => {
    const wort = Math.max(Math.ceil(laengstesWort(kopf[i] ?? '') * 1.08), ...zeilen.map((z) => laengstesWort(z[i] ?? '')));
    return Math.min(wort * ZEICHEN_DXA + ZELLRAND_DXA, Math.floor(SATZBREITE * 0.45));
  });
  const summeMin = min.reduce((a, b) => a + b, 0);
  if (summeMin >= SATZBREITE) {
    const roh = min.map((m) => Math.floor((m / summeMin) * SATZBREITE));
    roh[roh.length - 1]! += SATZBREITE - roh.reduce((a, b) => a + b, 0);
    return roh;
  }
  const breit = soll.map((b, i) => Math.max(b, min[i]!));
  const zuviel = breit.reduce((a, b) => a + b, 0) - SATZBREITE;
  if (zuviel <= 0) return soll;
  const reserve = breit.map((b, i) => b - min[i]!);
  const summeReserve = reserve.reduce((a, b) => a + b, 0);
  const neu = breit.map((b, i) => Math.floor(b - (reserve[i]! / summeReserve) * zuviel));
  const rest = SATZBREITE - neu.reduce((a, b) => a + b, 0);
  const groesste = neu.indexOf(Math.max(...neu));
  neu[groesste]! += rest;
  return neu;
}

function tabelle(kopf: string[], zeilen: Text[][], breiten?: number[], leereZeilen = 0): Table {
  const spalten = Math.max(kopf.length, ...zeilen.map((z) => z.length), 1);
  const b = spaltenOhneWortbruch(spaltenbreiten(spalten, breiten), kopf, zeilen);
  const proZeile = (w: number) => Math.max(4, Math.floor((w - ZELLRAND_DXA) / ZEICHEN_DXA));
  const rows: TableRow[] = [];
  if (kopf.length > 0) {
    rows.push(
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: b.map((w, i) => zelle(kopf[i] ?? '', w, { fill: S.farbe.kopf, fett: true, farbe: S.farbe.kopfText })),
      }),
    );
  }
  for (const z of zeilen) {
    rows.push(new TableRow({ cantSplit: true, children: b.map((w, i) => zelle(zellTextTrennen(z[i] ?? '', proZeile(w)), w)) }));
  }
  for (let n = 0; n < leereZeilen; n++) {
    rows.push(
      new TableRow({ cantSplit: true, height: { value: 397, rule: 'atLeast' }, children: b.map((w) => zelle('', w)) }),
    );
  }
  return new Table({
    rows,
    width: { size: SATZBREITE, type: WidthType.DXA },
    columnWidths: b,
    layout: TableLayoutType.FIXED,
  });
}

function feldtabelle(felder: { label: string; wert: Text }[]): Table {
  const b = spaltenbreiten(2, [32, 68]);
  return new Table({
    rows: felder.map(
      (f, i) =>
        new TableRow({
          cantSplit: true,
          // Kurze Kopftabellen bleiben auf einer Seite: Jede Zeile bleibt mit der nächsten zusammen
          children: [zelle(f.label, b[0]!, { fill: S.farbe.label, fett: true, zusammen: felder.length <= 14 && i < felder.length - 1 }), zelle(f.wert, b[1]!, { zusammen: felder.length <= 14 && i < felder.length - 1 })],
        }),
    ),
    width: { size: SATZBREITE, type: WidthType.DXA },
    columnWidths: b,
    layout: TableLayoutType.FIXED,
  });
}

function unterschriften(felder: (string | Unterschrift)[], tx: GeneratorTexte): Table {
  const b = spaltenbreiten(4, [26, 26, 16, 32]);
  const u = tx.unterschrift;
  const kopf = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [u.funktion, u.name, u.datum, u.unterschrift].map((k, i) =>
      zelle(k, b[i]!, { fill: S.farbe.kopf, fett: true, farbe: S.farbe.kopfText }),
    ),
  });
  const zeilen = felder.map(
    (f) =>
      new TableRow({
        cantSplit: true,
        // Platz für die Unterschrift
        height: { value: 850, rule: 'atLeast' },
        children: b.map((w, i) => zelle(typeof f === 'string' ? (i === 0 ? f : '') : ([f.funktion, f.name, f.datum, ''][i] ?? ''), w)),
      }),
  );
  return new Table({
    rows: [kopf, ...zeilen],
    width: { size: SATZBREITE, type: WidthType.DXA },
    columnWidths: b,
    layout: TableLayoutType.FIXED,
  });
}

// Hinweise: genau ein Absatz je Hinweis, Gestaltung über eigene Absatzformate.
// So lässt sich ein Hinweis als Ganzes löschen, und Word kann alle Hinweise
// eines Formats markieren («Alle Instanzen auswählen»).

function hinweis(art: HinweisArt, titel: string | undefined, text: Text, tx: GeneratorTexte): Paragraph {
  const runs: TextRun[] = [new TextRun({ text: hinweisLabel(art, titel, tx), bold: true })];
  if (!istLeer(text)) {
    const inhalt = textLaeufe(text);
    runs.push(new TextRun({ text: '', break: 1 }), ...inhalt);
  }
  return new Paragraph({ style: HINWEIS[art].stil, children: runs });
}

/**
 * Absatzformate der Hinweise, nur für die im Dokument verwendeten Arten: Firmendokumente enthalten so keine
 * Formatvorlagen für Ausfüllhinweise oder Vorlagenhinweise (in Word sichtbar), leere Vorlagen die, die sie nutzen.
 */
function hinweisStile(verwendet: Set<HinweisArt>): IParagraphStyleOptions[] {
  return (Object.keys(HINWEIS) as HinweisArt[]).filter((art) => verwendet.has(art)).map((art) => {
    const h = HINWEIS[art];
    const farbe = ROLLE[h.rolle];
    const rand: IBorderOptions = { style: BorderStyle.SINGLE, size: 6, color: farbe.linie, space: 4 };
    return {
      id: h.stil,
      name: h.name,
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: { font: S.schrift.tabelle, size: GROESSE.hinweis, color: farbe.schrift },
      paragraph: {
        shading: { fill: farbe.fill, type: ShadingType.CLEAR, color: 'auto' },
        // Rahmen rundum (kein farbiger Linksbalken, Design System «Hinweis»)
        border: { top: rand, bottom: rand, right: rand, left: rand },
        indent: { left: 113, right: 113 },
        spacing: { before: 120, after: 180, line: 264 },
        keepLines: true,
      },
    };
  });
}

// Grafik-Blöcke: Matrix als Tabelle, Diagramme nativ (docx/charts), Abläufe aus Formen (docx/shapes)

const WEISS: IBorderOptions = { style: BorderStyle.SINGLE, size: 12, color: TOKEN.karte };
const WEISSE_RAENDER = { top: WEISS, bottom: WEISS, left: WEISS, right: WEISS };

/** Kleiner Text unter Grafiken (Textalternative, Legende) */
function notiz(text: Text, keepNext = false): Paragraph {
  return new Paragraph({
    style: 'Tabellentext',
    keepNext,
    spacing: { before: 60, after: 120 },
    children: textLaeufe(text, { groesse: GROESSE.klein, farbe: S.farbe.leise }),
  });
}

function grafikTitel(titel: string): Paragraph {
  return new Paragraph({
    style: 'Tabellentext',
    keepNext: true,
    keepLines: true,
    spacing: { before: 120, after: 80 },
    children: [new TextRun({ text: titel, bold: true, size: GROESSE.tabelle + 2, color: S.farbe.titel })],
  });
}

function matrixZelle(zeilen: Text[], breite: number, rolle: Farbrolle, fett: boolean, letzteZeile: boolean): TableCell {
  const f = S.rolle[rolle];
  return new TableCell({
    width: { size: breite, type: WidthType.DXA },
    verticalAlign: VerticalAlignTable.CENTER,
    shading: { fill: f.fill, type: ShadingType.CLEAR, color: 'auto' },
    borders: WEISSE_RAENDER,
    children: (zeilen.length ? zeilen : ['']).map(
      (t, i) =>
        new Paragraph({
          style: 'Tabellentext',
          alignment: AlignmentType.CENTER,
          // Matrix nicht über einen Seitenumbruch trennen
          keepNext: !letzteZeile,
          keepLines: true,
          spacing: { before: i === 0 ? 50 : 0, after: i === zeilen.length - 1 ? 50 : 0, line: 240 },
          children: textLaeufe(t, { fett: fett || i === 0, groesse: i === 0 ? GROESSE.tabelle + 1 : GROESSE.klein, farbe: f.schrift }),
        }),
    ),
  });
}

function matrix(b: MatrixBlock): Element[] {
  const n = Math.max(1, b.spalten.length);
  const breiten = spaltenbreiten(n + 1, [b.kopfbreite ?? 1.4, ...Array.from({ length: n }, () => 1)]);
  const letzte = b.zeilen.length - 1;
  const kopf = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [b.ecke, ...b.spalten].map((t, i) => matrixZelle([t], breiten[i]!, 'kopf', true, letzte < 0)),
  });
  const zeilen = b.zeilen.map(
    (z, zi) =>
      new TableRow({
        cantSplit: true,
        children: [
          matrixZelle([z.kopf], breiten[0]!, 'kopf', true, zi === letzte),
          ...breiten.slice(1).map((w, i) => {
            const c = z.zellen[i];
            return matrixZelle(c?.zeilen ?? [''], w, c?.rolle ?? 'leer', false, zi === letzte);
          }),
        ],
      }),
  );
  const aus: Element[] = [];
  if (b.titel) aus.push(grafikTitel(b.titel));
  aus.push(new Table({ rows: [kopf, ...zeilen], width: { size: SATZBREITE, type: WidthType.DXA }, columnWidths: breiten, layout: TableLayoutType.FIXED }));
  if (b.legende?.length) {
    // Legende als Tabelle in einer Zeile: je Eintrag Farbfeld und Erklärung
    const lb = spaltenbreiten(b.legende.length * 2, b.legende.flatMap(() => [5, 95 / b.legende!.length - 5]));
    aus.push(
      abstand(60),
      new Table({
        rows: [
          new TableRow({
            cantSplit: true,
            children: b.legende.flatMap((l, i) => [
              new TableCell({
                width: { size: lb[2 * i]!, type: WidthType.DXA },
                shading: { fill: S.rolle[l.rolle].fill, type: ShadingType.CLEAR, color: 'auto' },
                borders: { ...WEISSE_RAENDER, top: LINIE, bottom: LINIE, left: LINIE, right: LINIE },
                children: [new Paragraph({ style: 'Tabellentext', children: [] })],
              }),
              new TableCell({
                width: { size: lb[2 * i + 1]!, type: WidthType.DXA },
                borders: WEISSE_RAENDER,
                verticalAlign: VerticalAlignTable.CENTER,
                children: [new Paragraph({ style: 'Tabellentext', spacing: { before: 20, after: 20 }, children: textLaeufe(l.text, { groesse: GROESSE.klein }) })],
              }),
            ]),
          }),
        ],
        width: { size: SATZBREITE, type: WidthType.DXA },
        columnWidths: lb,
        layout: TableLayoutType.FIXED,
      }),
    );
  }
  aus.push(b.alt ? notiz(b.alt) : abstand());
  return aus;
}

/** Satzbreite in Pixeln (96 dpi): 1 px = 15 Twip */
const SATZ_PX = Math.floor(SATZBREITE / 15);

function diagramm(b: DiagrammBlock): Element[] {
  const hoehe = b.hoehe ?? (b.art === 'linie' ? 250 : Math.min(420, 90 + b.kategorien.length * (b.art === 'balken' ? 16 * b.reihen.length + 10 : 24)));
  const schrift = { name: S.schrift.tabelle, color: TOKEN.text };
  const achse = {
    ...(b.achse?.titel ? { title: { text: b.achse.titel, font: { ...schrift, size: 8, bold: false } } } : {}),
    ...(b.achse?.min !== undefined ? { minimum: b.achse.min } : {}),
    ...(b.achse?.max !== undefined ? { maximum: b.achse.max } : {}),
    ...(b.achse?.schritt !== undefined ? { interval: b.achse.schritt } : {}),
    ...(b.achse?.format ? { numberFormat: b.achse.format } : {}),
    font: { ...schrift, size: 8 },
  };
  const gemeinsam = {
    title: { text: b.titel, font: { ...schrift, size: 10, bold: true, color: S.farbe.titel } },
    categories: b.kategorien,
    // Eine Reihe braucht keine Legende (Titel und Achse sagen genug)
    legend: b.reihen.length > 1 ? { position: 'bottom' as const, font: { ...schrift, size: 8 } } : (false as const),
    font: { name: S.schrift.tabelle, color: TOKEN.text },
    chartArea: { fill: TOKEN.karte, border: 'none' as const },
    transformation: { width: SATZ_PX - 4, height: hoehe },
    altText: { name: b.alt.titel, title: b.alt.titel, description: b.alt.beschreibung },
  };
  let run: ChartRun;
  if (b.art === 'linie') {
    run = new ChartRun({
      type: 'line',
      ...gemeinsam,
      series: b.reihen.map((r) => ({
        name: r.name,
        values: r.werte,
        color: S.diagramm(r.rolle),
        markers: r.marker ? { shape: 'circle', size: 6 } : false,
        line: { color: S.diagramm(r.rolle), width: r.gestrichelt ? 1.5 : 2.25, dash: r.gestrichelt ? 'dash' : 'solid' },
      })),
      valueAxis: achse,
      categoryAxis: { font: { ...schrift, size: 8 } },
    });
  } else {
    run = new ChartRun({
      type: 'bar',
      ...gemeinsam,
      stacking: b.art === 'stapel' ? 'stacked' : 'none',
      gapWidth: 60,
      series: b.reihen.map((r) => ({ name: r.name, values: r.werte, color: S.diagramm(r.rolle), ...(r.rollen ? { colors: r.rollen.map((x) => S.diagramm(x)) } : {}) })),
      // Erste Kategorie oben wie in einer Tabelle; Wertachse trotzdem unten
      categoryAxis: { reverseOrder: true, font: { ...schrift, size: 8 } },
      valueAxis: { ...achse, crossesAt: 'maximum' },
    });
  }
  // Titel steht im Diagramm (bleibt beim Kopieren erhalten); darunter die Werte als Text
  return [new Paragraph({ keepLines: true, keepNext: true, spacing: { before: 120, after: 60 }, children: [run] }), notiz(b.alt.beschreibung)];
}

const FORM: Record<AblaufForm, 'flowChartTerminator' | 'flowChartProcess' | 'flowChartDecision' | 'flowChartAlternateProcess'> = {
  start: 'flowChartTerminator',
  ende: 'flowChartTerminator',
  schritt: 'flowChartProcess',
  frage: 'flowChartDecision',
  ergebnis: 'flowChartAlternateProcess',
};
const STANDARD_ROLLE: Record<AblaufForm, Farbrolle> = {
  start: 'kopf',
  ende: 'kopf',
  schritt: 'status-info',
  frage: 'status-warnung',
  ergebnis: 'status-gut',
};

function formText(text: string, farbe: string, groesse = 15): Paragraph[] {
  return text.split('\n').map(
    (zeile) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0, line: 230 },
        children: [new TextRun({ text: zeile, font: S.schrift.tabelle, size: groesse, color: farbe })],
      }),
  );
}

/** Rand rechts und unten für Winkelkonnektoren, die neben den Formen laufen */
const ABLAUF_RAND = 28;
/** Höchste Höhe eines Ablaufs in px: passt mit Überschrift auf eine A4-Seite (die Zeichenfläche bricht nicht um) */
const ABLAUF_MAX_HOEHE = 860;

/** Zeichen und Zeilen in Pixeln je Schriftgrösse in Punkten (Arial, Schätzung) */
const zeichenPx = (pt: number) => (pt * 0.53 * 96) / 72;
const zeilePx = (pt: number) => (pt * 1.15 * 0.96 * 96) / 72;
/** Breite eines Worts in Pixeln mit den Zeichenbreiten von Arial (em) statt einer mittleren Zeichenbreite */
const EM_SCHMAL = /[iljI.,;:'!|ftr()\- ]/;
const EM_BREIT = /[mwMW]/;
const EM_GROSS = /[A-ZÄÖÜ]/;
export function wortPx(wort: string, pt: number): number {
  let em = 0;
  for (const c of wort) em += EM_SCHMAL.test(c) ? 0.31 : EM_BREIT.test(c) ? 0.86 : EM_GROSS.test(c) ? 0.69 : 0.56;
  return (em * pt * 96) / 72;
}

/** Zeilenzahl eines Texts bei gegebener Breite in Pixeln, umbrochen an Wörtern */
function zeilenBei(text: string, breitePx: number, pt: number): number {
  const proZeile = breitePx;
  return text.split('\n').reduce((summe, absatz) => {
    let zeilen = 1;
    let frei = proZeile;
    for (const wort of absatz.split(/\s+/)) {
      const w = wortPx(`${wort} `, pt);
      if (w > frei && frei !== proZeile) {
        zeilen++;
        frei = proZeile;
      }
      frei -= w;
    }
    return summe + zeilen;
  }, 0);
}

const laengstesFormwort = (text: string, pt: number) => Math.max(...text.split(/[\s]+|(?<=-)/u).map((w) => wortPx(w, pt)));

/**
 * Masse eines Ablaufs: je Zeile die Höhe, die der Text der Formen braucht. Formen mit langem Text wachsen, damit nichts
 * abgeschnitten wird. Eine Raute bietet nur die halbe Breite und Höhe für Text; passt eine Frage nicht in eine Raute von
 * vertretbarer Grösse, trägt der ganze Ablauf seine Entscheidungen als farbige Kästen mit voller Textbreite.
 */
export function ablaufMasse(b: AblaufBlock, weite: (spalte: number, n: number) => number, luecke: number, vLuecke: number): { zeilen: number[]; schrift: number; rauten: boolean } {
  const start = b.schriftgroesse ?? 7.5;
  const untergrenze = b.zeilenHoehe && !b.bahnen?.length ? b.zeilenHoehe : 44;
  let letzte = { zeilen: [] as number[], schrift: start, rauten: true };
  for (const pt of [start, start - 0.5, start - 1]) {
    const innen = (k: AblaufBlock['knoten'][number]) => weite(k.spalte, k.breite ?? 1) - luecke - 6;
    const rauten = b.knoten.filter((k) => k.form === 'frage').every((k) => {
      const w = innen(k) / 2;
      // Reserve 12 %: In der Raute ist die Zeile oben und unten kürzer als die Mitte
      return laengstesFormwort(k.text, pt) <= w * 0.88 && zeilenBei(k.text, w * 0.88, pt) * zeilePx(pt) * 2 + 8 + vLuecke <= 150;
    });
    const zeilen = Array.from({ length: b.zeilen }, () => untergrenze);
    for (const k of b.knoten) {
      const raute = k.form === 'frage' && rauten;
      const textHoehe = zeilenBei(k.text, raute ? (innen(k) / 2) * 0.88 : innen(k), pt) * zeilePx(pt);
      // Terminator-Formen runden die Ecken ab, Rauten geben die äussere Hälfte der Höhe nicht frei
      const noetig = (raute ? textHoehe * 2 : textHoehe + (k.form === 'start' || k.form === 'ende' ? 12 : 6)) + 4 + vLuecke;
      const n = k.hoehe ?? 1;
      for (let z = k.zeile; z < k.zeile + n && z < zeilen.length; z++) zeilen[z] = Math.max(zeilen[z]!, Math.ceil(noetig / n));
    }
    const passt = b.knoten.every((k) => laengstesFormwort(k.text, pt) <= innen(k)) && zeilen.reduce((x, y) => x + y, 0) <= ABLAUF_MAX_HOEHE;
    letzte = { zeilen, schrift: pt, rauten };
    if (passt) return letzte;
  }
  return letzte;
}

/** Kante als gerade Strecken mit Spitze am Ende, Beschriftung als Textfeld am Start */
function kantenFormen(b: AblaufBlock, rechtecke: ReadonlyMap<string, Rechteck>, breite: number): IShapeCanvasChildOptions[] {
  const wege = ablaufDocxWege(b);
  const belegt: Rechteck[] = [];
  return b.kanten.flatMap((k, i): IShapeCanvasChildOptions[] => {
    const weg = wege[i]!;
    // Gerade und ein Knick: Verbinder bleiben an den Formen hängen und folgen genau diesem Weg. Nur Umwege werden Strecken
    const verbinder = weg.length <= 3 ? [{
      type: 'connector' as const,
      from: { id: k.von, side: k.vonSeite },
      to: { id: k.nach, side: k.nachSeite },
      route: weg.length === 2 ? 'straight' as const : 'elbow' as const,
      line: { color: TOKEN.kontur, width: 1, endArrow: 'triangle' as const },
    }] : null;
    const strecken: IShapeCanvasChildOptions[] = verbinder ?? weg.slice(1).map((p, j): IShapeCanvasChildOptions => {
      const q = weg[j]!;
      return {
        type: 'line',
        transformation: {
          offset: { left: Math.round(Math.min(q.x, p.x)), top: Math.round(Math.min(q.y, p.y)) },
          width: Math.round(Math.abs(p.x - q.x)),
          height: Math.round(Math.abs(p.y - q.y)),
          flip: { horizontal: p.x < q.x, vertical: p.y < q.y },
        },
        line: { color: TOKEN.kontur, width: 1, ...(j === weg.length - 2 ? { endArrow: 'triangle' as const } : {}) },
      };
    });
    if (!k.text) return strecken;
    const r1 = rechtecke.get(k.von)!;
    const lage = ablaufPlatz(ablaufBeschriftung(k.text, k.vonSeite, seitenPunkt(r1, k.vonSeite), r1, breite, weg), belegt, [...rechtecke.values()], breite);
    const w = Math.ceil(lage.breite + 8);
    return [
      ...strecken,
      {
        type: 'rectangle',
        transformation: { offset: { left: Math.max(0, Math.round(lage.anker === 'end' ? lage.x - w : lage.x)), top: Math.round(lage.y - 10) }, width: w, height: 13 },
        fill: TOKEN.karte,
        line: { color: TOKEN.karte, width: 0.25 },
        children: formText(lage.text ?? k.text, TOKEN.tinte, 14),
        textOptions: { verticalAlignment: 'center', margins: { left: 0, right: 0, top: 0, bottom: 0 } },
      },
    ];
  });
}

/** Masse eines Ablaufs in der Zeichnung: Rechteck je Form, Bildgrösse; Grundlage von Formen und Kanten */
export function ablaufDocxGeometrie(b: AblaufBlock): { breite: number; hoehe: number; kopf: number; luecke: number; vLuecke: number; pt: number; rauten: boolean; links: (s: number) => number; weite: (s: number, n: number) => number; rechtecke: Map<string, Rechteck> } {
  const breite = SATZ_PX - 4;
  // Rasterspalten: Startpunkt und Breite je Spalte aus den relativen Gewichten
  const gewichte = Array.from({ length: Math.max(1, b.spalten) }, (_, i) => b.spaltenGewichte?.[i] ?? 1);
  const einheit = (breite - ABLAUF_RAND) / gewichte.reduce((x, y) => x + y, 0);
  const links = (spalte: number) => gewichte.slice(0, spalte).reduce((x, y) => x + y, 0) * einheit;
  const weite = (spalte: number, n: number) => gewichte.slice(spalte, spalte + n).reduce((x, y) => x + y, 0) * einheit;
  // Viele Bahnen: schmalere Lücke, damit die Formen breit genug für lange Wörter bleiben
  const luecke = gewichte.length >= 5 ? 10 : 18;
  const vLuecke = 22;
  const masse = ablaufMasse(b, weite, luecke, vLuecke);
  const oben = (zeile: number) => masse.zeilen.slice(0, zeile).reduce((x, y) => x + y, 0);
  const kopf = b.bahnen?.length ? (b.kopfHoehe ?? 34) : 0;
  const rechtecke = new Map(b.knoten.map((k) => [k.id, {
    x: Math.round(links(k.spalte) + luecke / 2),
    y: Math.round(kopf + oben(k.zeile) + vLuecke / 2),
    b: Math.round(weite(k.spalte, k.breite ?? 1) - luecke),
    h: oben(k.zeile + (k.hoehe ?? 1)) - oben(k.zeile) - vLuecke,
  }]));
  return { breite, hoehe: oben(b.zeilen) + 4 + kopf, kopf, luecke, vLuecke, pt: masse.schrift, rauten: masse.rauten, links, weite, rechtecke };
}

/** Wege der Kanten in der Zeichnung (dieselbe Wegsuche wie SVG und draw.io, mit den Massen des Dokuments) */
export function ablaufDocxWege(b: AblaufBlock): ReturnType<typeof ablaufWege> {
  const g = ablaufDocxGeometrie(b);
  return ablaufWege(g.rechtecke, b.kanten, { grenze: { x0: 1, y0: g.kopf + 1, x1: g.breite - 1, y1: g.hoehe - 1 }, stummel: Math.max(3, Math.min(g.luecke, g.vLuecke) / 2 - 0.5) });
}

function ablauf(b: AblaufBlock): Element[] {
  const { breite, hoehe, kopf, pt, links, weite, rechtecke, rauten } = ablaufDocxGeometrie(b);
  const knoten = new Set(b.knoten.map((k) => k.id));
  for (const k of b.kanten) {
    if (!knoten.has(k.von) || !knoten.has(k.nach)) throw new Error(`Ablauf: Kante ${k.von} -> ${k.nach} ohne Knoten`);
  }
  // Bahnen (Prozessbeschreibung): Kopf mit der Rolle als Rechteck, Grenzen der Bahnen als senkrechte Linien hinter den
  // Formen. Keine Flächen über die ganze Höhe: Beschriftungen der Konnektoren weichen Formen aus und fänden sonst keinen Platz.
  const bahnen = (b.bahnen ?? []).flatMap((x, i): IShapeCanvasChildOptions[] => {
    const l = Math.round(links(x.spalte));
    const w = Math.round(weite(x.spalte, x.breite ?? 1));
    const linie = (left: number, id: string): IShapeCanvasChildOptions => ({
      id,
      type: 'line',
      transformation: { offset: { left, top: 0 }, width: 0, height: hoehe },
      line: { color: TOKEN.linieStark, width: 0.75 },
    });
    return [
      {
        id: `bahn-${x.id}`,
        type: 'rectangle',
        transformation: { offset: { left: l, top: 0 }, width: w, height: kopf },
        fill: TOKEN.seite,
        line: { color: TOKEN.linieStark, width: 0.75 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0, line: 230 },
            children: [new TextRun({ text: x.text, font: S.schrift.tabelle, size: Math.round(pt * 2), bold: true, color: TOKEN.tinte })],
          }),
        ],
        textOptions: { verticalAlignment: 'center', margins: { left: 2, right: 2, top: 1, bottom: 1 } },
      },
      ...(i === 0 ? [linie(l, `bahn-${x.id}-links`)] : []),
      linie(l + w, `bahn-${x.id}-rechts`),
    ];
  });
  const kinder: IShapeCanvasChildOptions[] = [
    ...bahnen,
    ...b.knoten.map((k): IShapeCanvasChildOptions => {
      const f = S.rolle[k.rolle ?? STANDARD_ROLLE[k.form]];
      return {
        id: k.id,
        type: k.form === 'frage' && !rauten ? 'flowChartAlternateProcess' : FORM[k.form],
        transformation: { offset: { left: rechtecke.get(k.id)!.x, top: rechtecke.get(k.id)!.y }, width: rechtecke.get(k.id)!.b, height: rechtecke.get(k.id)!.h },
        fill: f.fill,
        line: { color: f.linie, width: 1 },
        children: formText(k.text, f.schrift, Math.round(pt * 2)),
        textOptions: { verticalAlignment: 'center', margins: { left: 2, right: 2, top: 1, bottom: 1 } },
      };
    }),
    // Kanten als Strecken aus derselben Wegsuche wie SVG und draw.io: Verbinder legt Word selbst und auch durch Formen (D-05)
    ...kantenFormen(b, rechtecke, breite),
  ];
  const canvas = new ShapeCanvasRun({
    transformation: { width: breite, height: hoehe },
    altText: { name: b.alt.titel, title: b.alt.titel, description: b.alt.beschreibung },
    children: kinder,
  });
  // Titel nur über den Alternativtext; im Dokument steht er in der Überschrift der Anlage
  return [new Paragraph({ keepLines: true, keepNext: true, spacing: { before: 120, after: 60 }, children: [canvas] }), notiz(b.alt.beschreibung)];
}

// Blöcke

type Element = Paragraph | Table;

function bloeckeRendern(bloecke: Block[], tx: GeneratorTexte): Element[] {
  const aus: Element[] = [];
  let listenNr = 0;
  let umbruchVor = false;
  for (const [i, b] of bloecke.entries()) {
    switch (b.typ) {
      case 'ueberschrift': {
        const ebene = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 }[b.ebene];
        aus.push(new Paragraph({ heading: ebene, ...(umbruchVor ? { pageBreakBefore: true } : {}), children: [new TextRun(b.text)] }));
        umbruchVor = false;
        break;
      }
      case 'absatz':
        aus.push(absatz(b.text));
        break;
      case 'liste': {
        // Jede nummerierte Liste beginnt wieder bei 1 (eigene Instanz)
        listenNr++;
        b.punkte.forEach((p, i) => {
          aus.push(
            new Paragraph({
              children: textLaeufe(p),
              numbering: {
                reference: b.nummeriert ? 'nummeriert' : 'aufzaehlung',
                level: 0,
                instance: b.nummeriert ? listenNr : undefined,
              },
              // Abstand nur nach dem letzten Punkt, keine leeren Absätze
              spacing: { after: i === b.punkte.length - 1 ? 160 : 40 },
            }),
          );
        });
        break;
      }
      case 'tabelle':
        aus.push(tabelle(b.kopf, b.zeilen, b.breiten, b.leereZeilen ?? 0), ...nachTabelle(bloecke, i));
        break;
      case 'hinweis':
        aus.push(hinweis(b.art, b.titel, b.text, tx));
        break;
      case 'felder':
        aus.push(feldtabelle(b.felder), ...nachTabelle(bloecke, i));
        break;
      case 'unterschriften':
        aus.push(unterschriften(b.felder, tx), ...nachTabelle(bloecke, i));
        break;
      case 'seitenumbruch':
        // Vor einer Überschrift als Eigenschaft der Überschrift: Ein eigener Absatz ergäbe nach einer vollen Seite eine leere Seite
        if (bloecke[i + 1]?.typ === 'ueberschrift') umbruchVor = true;
        // Nach einer Tabelle ein leerer Absatz mit Umbruch davor (Prüfung test.7 N11): ein Umbruch im Absatz nach einer Tabelle, die
        // die Seite füllt, ergäbe eine leere Seite; sonst Umbruch im eigenen Absatz (F-09); als letzter Block entfällt er
        else if (bloecke[i + 1] && TABELLEN.has(bloecke[i - 1]?.typ ?? '')) aus.push(new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0 }, children: [] }));
        else if (bloecke[i + 1]) aus.push(new Paragraph({ children: [new PageBreak()] }));
        break;
      case 'matrix':
        aus.push(...matrix(b));
        break;
      case 'diagramm':
        aus.push(...diagramm(b));
        break;
      case 'ablauf':
        aus.push(...ablauf(b));
        break;
      default: {
        const unbekannt: never = b;
        throw new Error(`Unbekannter Blocktyp: ${JSON.stringify(unbekannt)}`);
      }
    }
  }
  return aus;
}

/**
 * Absatz nach einer Tabelle (zweiter Prüfer test.7: leere Seiten in D-13 und D-09, wenn eine Tabelle die Seite füllt). Vor einem
 * Seitenumbruch braucht es keinen: die Überschrift mit Umbruch davor folgt direkt. Am Ende des Dokuments verlangt Word einen
 * Absatz nach der Tabelle; er ist dort 1 pt hoch und ohne Abstand, damit er keine eigene Seite öffnet. Sonst Abstand 6 pt.
 */
function nachTabelle(bloecke: Block[], i: number): Paragraph[] {
  // Ein Seitenumbruch als letzter Block zählt wie das Dokumentende
  const naechster = bloecke[i + 1]?.typ === 'seitenumbruch' && !bloecke[i + 2] ? undefined : bloecke[i + 1];
  if (naechster?.typ === 'seitenumbruch') return [];
  if (!naechster) return [new Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT }, run: { size: 2 }, children: [] })];
  return [abstand()];
}

/** Blöcke, die als Tabelle gesetzt werden (Absatz danach: nachTabelle) */
const TABELLEN = new Set(['tabelle', 'felder', 'unterschriften']);

/** Abstand nach Tabellen (Word klebt sonst den Folgeabsatz an). */
function abstand(nach = 120): Paragraph {
  return new Paragraph({ spacing: { before: 0, after: nach }, children: [] });
}

// Kopf- und Fusszeile

/** Breite und Höhe aus dem PNG-Kopf (IHDR) lesen. */
export function pngGroesse(png: Uint8Array): { breite: number; hoehe: number } {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.length < 24 || sig.some((b, i) => png[i] !== b)) throw new Error('Logo ist keine PNG-Datei');
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { breite: dv.getUint32(16), hoehe: dv.getUint32(20) };
}

function svgFuerWord(svg: Uint8Array | undefined): Uint8Array | undefined {
  if (!svg) return undefined;
  try {
    return new TextEncoder().encode(svgBereinigen(new TextDecoder().decode(svg)).svg);
  } catch {
    return undefined;
  }
}

/** Logo als Bild: mit bereinigtem SVG zusätzlich (Word ab 2019 zeigt es scharf), PNG immer als Ersatzbild */
function logoBild(png: Uint8Array, svg: Uint8Array | undefined, w: number, h: number, alt: string): ImageRun {
  const gemeinsam = { transformation: { width: w, height: h }, altText: { name: 'Logo', description: alt, title: 'Logo' } };
  pngGroesse(png);
  // Letzte Schranke, gleich woher das Logo stammt: nur bereinigtes SVG einbetten, sonst das PNG allein
  const svgSicher = svgFuerWord(svg);
  return svgSicher
    ? new ImageRun({ type: 'svg', data: svgSicher, fallback: { type: 'png', data: png }, ...gemeinsam })
    : new ImageRun({ type: 'png', data: png, ...gemeinsam });
}

/** Wasserzeichen «Entwurf» (VML wie Word «Entwurf», in Word über «Wasserzeichen entfernen» löschbar) */
function wasserzeichen(text: string): TextWatermark {
  return new TextWatermark({ text, font: S.schrift.titel, color: 'D9D9D9', opacity: 0.5 });
}

function kopfzeile(dok: DocxDokument, tx: GeneratorTexte, ohneLogo = false): Header {
  const g = dok.gestaltung;
  const firma = istLeer(dok.kopf.firmenname)
    ? [{ text: tx.firmaPlatzhalter, platzhalter: true }]
    : g?.kopfname
      ? g.kopfname
      : dok.kopf.firmenname;
  const name = textLaeufe(firma, { fett: true, farbe: S.farbe.titel, schrift: S.schrift.titel });
  const kinder: (TextRun | ImageRun | TextWatermark)[] = [];
  const logo = ohneLogo ? undefined : g?.logo;
  if (logo) {
    const bild = logoBild(logo.png, logo.svg, logo.kopf.breite, logo.kopf.hoehe, logo.alt);
    const tab = new TextRun({ children: [new Tab()] });
    if (g!.logoPosition === 'links') kinder.push(bild, ...(g!.firmennameZeigen ? [tab, ...name] : []));
    else kinder.push(...(g!.firmennameZeigen ? name : []), tab, bild);
  } else if (!g && dok.kopf.logoPng) {
    // Logo ohne Gestaltung (IR älterer Aufrufer): rechtsbündig, Höhe 34 px (ca. 9 mm), höchstens 200 px breit
    const { breite, hoehe } = pngGroesse(dok.kopf.logoPng);
    let h = 34;
    let w = Math.round((breite / hoehe) * h);
    if (w > 200) {
      w = 200;
      h = Math.round((hoehe / breite) * w);
    }
    kinder.push(...name, new TextRun({ children: [new Tab()] }));
    kinder.push(
      new ImageRun({
        type: 'png',
        data: dok.kopf.logoPng,
        transformation: { width: w, height: h },
        altText: { name: 'Logo', description: `Logo ${klartext(firma)}`, title: 'Logo' },
      }),
    );
  } else kinder.push(...name);
  if (g?.wasserzeichen) kinder.push(wasserzeichen(g.wasserzeichen));
  return new Header({
    children: [
      new Paragraph({
        style: 'KopfzeileFirma',
        children: kinder,
        tabStops: [{ type: TabStopType.RIGHT, position: SATZBREITE }],
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: S.farbe.trennlinie, space: 4 } },
      }),
    ],
  });
}

/** Kopfzeile der Titelseite: kein Logo (es steht gross auf der Seite), kein Name, nur das Wasserzeichen */
function kopfzeileTitel(dok: DocxDokument): Header {
  const zeichen = dok.gestaltung?.wasserzeichen;
  return new Header({ children: [new Paragraph({ style: 'KopfzeileFirma', children: zeichen ? [wasserzeichen(zeichen)] : [] })] });
}

function fusszeile(dok: DocxDokument, tx: GeneratorTexte): Footer {
  const [vor, mitte] = tx.seite;
  const zusatz = dok.gestaltung?.fusszeileZusatz;
  return new Footer({
    children: [
      new Paragraph({
        style: 'FusszeileFirma',
        tabStops: [{ type: TabStopType.RIGHT, position: SATZBREITE }],
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: S.farbe.trennlinie, space: 4 } },
        children: [
          ...textLaeufe(dok.kopf.fusszeile),
          new TextRun({ children: [new Tab(), vor, PageNumber.CURRENT, mitte, PageNumber.TOTAL_PAGES] }),
        ],
      }),
      // Zweite Zeile der Firma (Adresse, Handelsregister, Website), Klassifikation bleibt in der ersten Zeile
      ...(zusatz ? [new Paragraph({ style: 'FusszeileFirma', spacing: { before: 20 }, children: [new TextRun({ text: zusatz, size: GROESSE.fuss - 1 })] })] : []),
    ],
  });
}

// Dokument

function lenkungstabelle(dok: DocxDokument, tx: GeneratorTexte): Table {
  // Leere Angaben (z. B. «Pfad» in Firmendokumenten) erscheinen nicht; Kennung mit Anzeigepräfix der Firma
  return feldtabelle(
    LENKUNG_FELDER.filter((k) => !istLeer(dok.lenkung[k] ?? '')).map((k) => ({
      label: tx.lenkung[k],
      wert: k === 'dokumentId' ? kennungAnzeige(dok.lenkung.dokumentId, dok.gestaltung) : dok.lenkung[k]!,
    })),
  );
}

/**
 * Titelseite (Gestaltung «titelseite»): Logo gross, Firmenname, Band mit Titel in der Primärfarbe, Kennung, Version,
 * Status und Klassifikation. Seite 2 beginnt wie sonst Seite 1 (Kennung, Titel, Lenkungstabelle).
 */
function titelseite(dok: DocxDokument, tx: GeneratorTexte): Element[] {
  const g = dok.gestaltung!;
  const firma = istLeer(dok.kopf.firmenname) ? [{ text: tx.firmaPlatzhalter, platzhalter: true }] : dok.kopf.firmenname;
  const aus: Element[] = [];
  if (g.logo) aus.push(new Paragraph({ spacing: { before: 0, after: 480 }, children: [logoBild(g.logo.png, g.logo.svg, g.logo.titel.breite, g.logo.titel.hoehe, g.logo.alt)] }));
  else aus.push(new Paragraph({ spacing: { before: 0, after: 480 }, children: textLaeufe(firma, { fett: true, groesse: 28, farbe: S.farbe.titel, schrift: S.schrift.titel }) }));
  aus.push(
    new Paragraph({ spacing: { before: 1800, after: 120 }, children: [new TextRun({ text: kennungAnzeige(dok.lenkung.dokumentId, g), font: S.schrift.titel, size: 22, color: S.farbe.leise })] }),
    new Paragraph({
      keepNext: true,
      spacing: { before: 0, after: 240, line: 360 },
      shading: { fill: S.farbe.band, type: ShadingType.CLEAR, color: 'auto' },
      border: { left: { style: BorderStyle.SINGLE, size: 48, color: S.farbe.akzent, space: 8 } },
      indent: { left: 170, right: 113 },
      children: [new TextRun({ text: dok.lenkung.titel, font: S.schrift.titel, size: 44, bold: true, color: S.farbe.aufBand })],
    }),
  );
  const felder: { label: string; wert: Text }[] = [
    { label: tx.lenkung.version, wert: dok.lenkung.version },
    { label: tx.lenkung.freigabeDurch, wert: istLeer(dok.lenkung.datum) ? dok.lenkung.freigabeDurch : [{ text: `${klartext(dok.lenkung.freigabeDurch)}, ${klartext(dok.lenkung.datum)}` }] },
    { label: tx.lenkung.klassifikation, wert: dok.lenkung.klassifikation },
  ].filter((f) => !istLeer(f.wert));
  if (felder.length) aus.push(abstand(240), feldtabelle(felder));
  aus.push(
    // Firmenname in der Titelschrift wie Kennung und Titel (eine Schrift auf der Titelseite)
    new Paragraph({ spacing: { before: 480 }, children: textLaeufe(firma, { fett: true, farbe: S.farbe.titel, schrift: S.schrift.titel }) }),
    new Paragraph({ children: [new PageBreak()] }),
  );
  return aus;
}

export function docxDokumentBauen(dok: DocxDokument): Document {
  const vorher = S;
  S = stilAus(dok.gestaltung);
  try {
    return dokumentBauen(dok);
  } finally {
    S = vorher;
  }
}

function dokumentBauen(dok: DocxDokument): Document {
  const tx = texte(dok.sprache);
  const sprache = dok.sprache === 'en' ? 'en-GB' : 'de-CH';
  const mitTitelseite = !!dok.gestaltung?.titelseite;
  const ueberschrift = (groesse: number, vor: number, nach: number) => ({
    run: { font: S.schrift.titel, size: groesse, bold: true, color: S.farbe.titel },
    paragraph: { spacing: { before: vor, after: nach }, keepNext: true, keepLines: true },
  });
  return new Document({
    title: dok.eigenschaften.titel,
    subject: dok.eigenschaften.betreff,
    creator: dok.eigenschaften.autor,
    lastModifiedBy: dok.eigenschaften.autor,
    styles: {
      default: {
        document: {
          run: { font: S.schrift.text, size: GROESSE.text, color: S.farbe.text, language: { value: sprache } },
          paragraph: { spacing: { after: 120, line: 276 } },
        },
        title: ueberschrift(36, 0, 120),
        heading1: ueberschrift(27, 360, 120),
        heading2: ueberschrift(23, 240, 100),
        heading3: ueberschrift(21, 200, 80),
      },
      // Eigene Namen, die nicht mit lokalisierten Word-Standardformaten («Kopfzeile») kollidieren
      paragraphStyles: [
        {
          id: 'Tabellentext',
          name: 'Tabellentext',
          basedOn: 'Normal',
          quickFormat: true,
          run: { font: S.schrift.tabelle, size: GROESSE.tabelle },
          paragraph: { spacing: { before: 40, after: 40, line: 252 } },
        },
        {
          id: 'KopfzeileFirma',
          name: 'Kopfzeile Firma',
          basedOn: 'Normal',
          run: { font: S.schrift.titel, size: GROESSE.kopf, color: S.farbe.titel },
          paragraph: { spacing: { after: 0 } },
        },
        {
          id: 'FusszeileFirma',
          name: 'Fusszeile Firma',
          basedOn: 'Normal',
          run: { font: S.schrift.titel, size: GROESSE.fuss, color: S.farbe.leise },
          paragraph: { spacing: { after: 0 } },
        },
        ...hinweisStile(new Set(dok.bloecke.flatMap((b) => (b.typ === 'hinweis' ? [b.art] : [])))),
      ],
    },
    numbering: {
      config: [
        {
          reference: 'aufzaehlung',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 260 } } },
            },
          ],
        },
        {
          reference: 'nummeriert',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          ...(mitTitelseite ? { titlePage: true } : {}),
          page: {
            size: { width: A4.breite, height: A4.hoehe },
            margin: {
              top: RAND.oben,
              bottom: RAND.unten,
              left: RAND.links,
              right: RAND.rechts,
              header: RAND.kopf,
              footer: RAND.fuss,
            },
          },
        },
        headers: { default: kopfzeile(dok, tx), ...(mitTitelseite ? { first: kopfzeileTitel(dok) } : {}) },
        footers: { default: fusszeile(dok, tx), ...(mitTitelseite ? { first: fusszeile(dok, tx) } : {}) },
        children: [
          ...(mitTitelseite ? titelseite(dok, tx) : []),
          new Paragraph({
            style: 'Tabellentext',
            children: [new TextRun({ text: kennungAnzeige(dok.lenkung.dokumentId, dok.gestaltung), color: S.farbe.leise, size: 18 })],
          }),
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(dok.lenkung.titel)] }),
          lenkungstabelle(dok, tx),
          abstand(),
          ...bloeckeRendern(dok.bloecke, tx),
        ],
      },
    ],
  });
}

export async function renderDocx(roheingabe: DocxDokument, optionen: RenderOptionen = {}): Promise<Uint8Array> {
  // Zentrale Stelle: nur gültige XML-Zeichen im Paket, gleich aus welchem Feld der Text stammt
  const dok = zeichenBereinigen(roheingabe);
  const roh = await Packer.pack(docxDokumentBauen(dok), 'uint8array');
  return paketBereinigen(roh, dok.eigenschaften, optionen);
}
