// Grafik-Blöcke im Generator (matrix, diagramm, ablauf), bedingte Formate und Matrix-Blätter in XLSX, Druckpalette und
// Reproduzierbarkeit (paketBereinigen mit Normalisierung der IDs, eingebetteten Arbeitsmappen und GUIDs).
import { strFromU8, unzipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as docx from 'docx';
import { ChartRun } from 'docx/charts';
import { ShapeCanvasRun } from 'docx/shapes';
import { renderDocx, renderXlsx } from '../../src/generator/index.ts';
import { ROLLE, kontrast } from '../../src/generator/palette.ts';
import { blattLage } from '../../src/generator/xlsx.ts';
import { FIRMA, musterDocx, musterDocxGrafik, musterXlsx, musterXlsxGrafik } from './generator.muster.ts';

type Teile = Record<string, string>;
const entpacken = (paket: Uint8Array): Teile =>
  Object.fromEntries(Object.entries(unzipSync(paket)).filter(([p]) => /\.(xml|rels)$/.test(p)).map(([p, b]) => [p, strFromU8(b)]));
const anzahl = (s: string, muster: RegExp) => (s.match(new RegExp(muster, 'g')) ?? []).length;
const ZEIT = new Date('2026-10-20T08:00:00Z');

afterEach(() => {
  vi.useRealTimers();
});

describe('Druckpalette (Design System, helle Tokens)', () => {
  it('Text auf jeder Farbrolle hält WCAG AA (4,5:1), auch dunkle Schrift auf «risiko-hoch»', () => {
    for (const [rolle, f] of Object.entries(ROLLE)) expect(kontrast(f.fill, f.schrift), rolle).toBeGreaterThanOrEqual(4.5);
    expect(ROLLE['risiko-hoch'].schrift).toBe('121821');
    expect(kontrast('BF6C2E', 'FFFFFF')).toBeLessThan(4.5);
  });
});

describe('DOCX: Matrix, Diagramm, Ablauf', () => {
  it('Matrix als Tabelle mit Kopfzeile, Zellfarben der Risikostufen, Text in jeder Zelle und Legende', async () => {
    const doc = entpacken(await renderDocx(musterDocxGrafik(), { zeitpunkt: ZEIT }))['word/document.xml']!;
    for (const fill of ['F2E8D6', 'E8B173', 'BF6C2E', 'E9E6DF']) expect(doc, fill).toContain(`w:fill="${fill}"`);
    for (const t of ['A \\ W', 'H 16', 'M 6', 'T 1', '1 Risiko', 'T tief: bis 4', 'H hoch: ab 12', 'Risikomatrix vor Behandlung: 4 Risiken eingeordnet.']) expect(doc, t).toContain(t);
    expect(anzahl(doc, /<w:tblHeader\/>/)).toBeGreaterThanOrEqual(1);
  });

  it('Diagramme nativ mit Arbeitsmappe, Farben der Palette und Alternativtext', async () => {
    const roh = unzipSync(await renderDocx(musterDocxGrafik(), { zeitpunkt: ZEIT }));
    const t = entpacken(await renderDocx(musterDocxGrafik(), { zeitpunkt: ZEIT }));
    const charts = Object.keys(t).filter((p) => /^word\/charts\/chart\d+\.xml$/.test(p)).sort();
    expect(charts).toHaveLength(2);
    const [balken, linie] = charts.map((p) => t[p]!);
    expect(balken).toMatch(/^<\?xml[^>]*>\s*<c:chartSpace/);
    expect(balken).toContain('<c:grouping val="stacked"/>');
    expect(balken).toContain('2E95A5'); // status-gut-flaeche
    expect(balken).toContain('Umsetzung Anhang A je Gruppe');
    expect(linie).toContain('<c:lineChart>');
    expect(linie).toMatch(/<a:prstDash val="dash"\/>/);
    expect(linie).toContain('Arial');
    expect(Object.keys(roh).filter((p) => /^word\/embeddings\/.+\.xlsx$/.test(p))).toHaveLength(2);
    expect(t['[Content_Types].xml']).toContain('application/vnd.openxmlformats-officedocument.drawingml.chart+xml');
    expect(t['word/document.xml']).toMatch(/<wp:docPr [^>]*descr="A\.2: 2 umgesetzt, 1 teilweise; A\.3: 1 umgesetzt; A\.4: 3 umgesetzt, 1 teilweise\."/);
    // Werte stehen zusätzlich als Text unter dem Diagramm (Druck, Bildschirmleser ohne Diagrammunterstützung)
    expect(t['word/document.xml']).toContain('Messwerte: 64 %, 82 %, 96 %. Sollwert mindestens 95 %.');
  });

  it('Ablauf als Zeichenbereich mit Formen, Konnektoren an expliziten Seiten und Rückfallgruppe', async () => {
    const doc = entpacken(await renderDocx(musterDocxGrafik(), { zeitpunkt: ZEIT }))['word/document.xml']!;
    expect(doc).toContain('<mc:AlternateContent>');
    expect(doc).toMatch(/<mc:Choice Requires="wpc">/);
    expect(doc).toContain('<wpc:wpc>');
    expect(doc).toContain('<mc:Fallback>');
    expect(doc).toContain('<wpg:wgp>');
    expect(doc).toContain('prst="flowChartDecision"');
    expect(doc).toContain('prst="flowChartTerminator"');
    expect(anzahl(doc, /<a:stCxn /)).toBeGreaterThanOrEqual(3);
    expect(anzahl(doc, /<a:endCxn /)).toBeGreaterThanOrEqual(3);
    for (const t of ['Eigener Name?', 'Anbieter', 'Betreiber', '>Ja<', '>Nein<']) expect(doc, t).toContain(t);
    expect(doc).toMatch(/<wp:docPr [^>]*descr="Eigener Name\? Ja: Anbieter\. Nein: Betreiber\."/);
  });

  it('Beziehungen vollständig: jede r:id im Dokument hat eine Beziehung, kein «rootKey» (doppelte docx-Instanz)', async () => {
    const t = entpacken(await renderDocx(musterDocxGrafik(), { zeitpunkt: ZEIT }));
    for (const [teil, rels] of [
      ['word/document.xml', 'word/_rels/document.xml.rels'],
      ['word/header1.xml', 'word/_rels/header1.xml.rels'],
    ] as const) {
      expect(t[rels], rels).not.toContain('rootKey');
      const ids = new Set([...t[rels]!.matchAll(/ Id="([^"]+)"/g)].map((m) => m[1]));
      const bezuege = [...t[teil]!.matchAll(/ r:(?:id|embed)="([^"]+)"/g)].map((m) => m[1]!);
      expect(bezuege.length, teil).toBeGreaterThan(0);
      for (const id of bezuege) expect(ids.has(id), `${teil}: ${id}`).toBe(true);
    }
    for (const [p, xml] of Object.entries(t).filter(([p]) => /^word\/charts\/_rels\//.test(p))) expect(xml, p).toMatch(/Target="\.\.\/embeddings\/[^"]+\.xlsx"/);
  });

  it('docx/charts und docx/shapes nutzen dieselbe docx-Instanz wie der Generator', () => {
    const chart = new ChartRun({ type: 'bar', categories: ['a'], series: [{ name: 'x', values: [1] }] });
    const canvas = new ShapeCanvasRun({ children: [{ type: 'flowChartProcess', transformation: { width: 10, height: 10 } }] });
    expect(chart).toBeInstanceOf(docx.Run);
    expect(canvas).toBeInstanceOf(docx.Run);
  });
});

describe('Reproduzierbarkeit', () => {
  it('zwei Dokumente im selben Prozess bytegleich, auch nach anderen Dokumenten und zu anderer Uhrzeit', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-21T09:00:00Z'));
    const a = await renderDocx(musterDocxGrafik(), { zeitpunkt: ZEIT });
    // Dazwischen Dokumente mit Logo, Diagrammen und Formen: der Zähler der Zeichnungs-IDs läuft weiter
    await renderDocx(musterDocx(), { zeitpunkt: ZEIT });
    await renderDocx(musterDocxGrafik(), { zeitpunkt: ZEIT });
    vi.setSystemTime(new Date('2026-10-22T17:33:21Z'));
    const b = await renderDocx(musterDocxGrafik(), { zeitpunkt: ZEIT });
    expect(b).toEqual(a);
  });

  it('Firmenlogo: Zeichnungs-ID hängt nicht von vorher erzeugten Dokumenten ab', async () => {
    const erstes = await renderDocx(musterDocx(), { zeitpunkt: ZEIT });
    for (let i = 0; i < 3; i++) await renderDocx(musterDocxGrafik(), { zeitpunkt: ZEIT });
    const spaeter = await renderDocx(musterDocx(), { zeitpunkt: ZEIT });
    expect(spaeter).toEqual(erstes);
    expect(entpacken(spaeter)['word/header1.xml']).toMatch(/<wp:docPr id="1" /);
  });

  it('Zeichnungs-IDs dicht ab 1 und eindeutig, Beziehungs-IDs ohne Zufall', async () => {
    const t = entpacken(await renderDocx(musterDocxGrafik(), { zeitpunkt: ZEIT }));
    const docPr = [...`${t['word/header1.xml']}${t['word/document.xml']}`.matchAll(/<wp:docPr id="(\d+)"/g)].map((m) => Number(m[1]));
    expect(new Set(docPr).size).toBe(docPr.length);
    expect(Math.min(...docPr)).toBe(1);
    for (const [p, xml] of Object.entries(t)) expect(xml, p).not.toMatch(/"rId[0-9A-Za-z_-]{21}"/);
  });

  it('eingebettete Arbeitsmappen der Diagramme: Inhalt gleich den Diagrammwerten, Zeitstempel fest', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-21T09:00:00Z'));
    const a = unzipSync(await renderDocx(musterDocxGrafik(), { zeitpunkt: ZEIT }));
    vi.setSystemTime(new Date('2027-03-01T23:59:00Z'));
    const b = unzipSync(await renderDocx(musterDocxGrafik(), { zeitpunkt: ZEIT }));
    const mappen = Object.keys(a).filter((p) => p.endsWith('.xlsx')).sort();
    for (const p of mappen) {
      expect(b[p], p).toEqual(a[p]);
      const blatt = strFromU8(unzipSync(a[p]!)['xl/worksheets/sheet1.xml']!);
      expect(blatt).toMatch(/<v>64<\/v>|<v>2<\/v>/);
    }
  });

  it('XLSX mit Datenbalken (GUID) bytegleich zu anderer Uhrzeit', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-21T09:00:00Z'));
    const a = await renderXlsx(musterXlsxGrafik(), { zeitpunkt: ZEIT });
    vi.setSystemTime(new Date('2026-12-24T18:00:00Z'));
    const b = await renderXlsx(musterXlsxGrafik(), { zeitpunkt: ZEIT });
    expect(b).toEqual(a);
    expect(entpacken(a)['xl/worksheets/sheet2.xml']).toContain('{00000000-0000-4000-8000-000000000001}');
  });

  it('Datenbalken: feste Kennungen der x14-Erweiterung bleiben, nur die Regel-IDs werden fest nummeriert (test.7)', async () => {
    const reg = entpacken(await renderXlsx(musterXlsxGrafik(), { zeitpunkt: ZEIT }))['xl/worksheets/sheet2.xml']!;
    // Erweiterung der Regel (x14:id) und der Blattliste (x14:conditionalFormattings) nach [MS-XLSX]
    expect(reg).toContain('<ext uri="{B025F937-C7B1-47D3-B67F-A62EFF666E3E}"');
    expect(reg).toContain('<ext uri="{78C0D931-6437-407d-A8EE-F0AAD7539E65}"');
    const ids = [...reg.matchAll(/<x14:id>(\{[^}]+\})<\/x14:id>/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(reg).toContain(`<x14:cfRule type="dataBar" id="${id}">`);
  });
});

describe('XLSX: Ampeln, bedingte Formate, Matrix-Blatt', () => {
  const blatt = (t: Teile, nr: number) => t[`xl/worksheets/sheet${nr}.xml`]!;

  it('Ampel auf zwei Spalten in den Farben der Risikostufen', async () => {
    const t = entpacken(await renderXlsx(musterXlsxGrafik(), { zeitpunkt: ZEIT }));
    const reg = blatt(t, 2);
    const { erste, letzte } = blattLage(musterXlsxGrafik().blaetter[0]!);
    expect(reg).toContain(`<conditionalFormatting sqref="E${erste}:E${letzte}">`);
    expect(reg).toContain(`<conditionalFormatting sqref="H${erste}:H${letzte}">`);
    expect(reg).toContain(`AND(ISNUMBER(H${erste}),H${erste}&gt;11)`);
    for (const fill of ['FFF2E8D6', 'FFE8B173', 'FFBF6C2E']) expect(t['xl/styles.xml'], fill).toContain(fill);
    // Dunkle Schrift auf allen Stufen (auch «hoch»)
    expect(t['xl/styles.xml']).not.toMatch(/<dxf><font><color rgb="FFFFFFFF"\/>/);
  });

  it('Datenbalken, Farbskala, Farbe nach Text und nach Zahlenbereich', async () => {
    const reg = blatt(entpacken(await renderXlsx(musterXlsxGrafik(), { zeitpunkt: ZEIT })), 2);
    expect(reg).toMatch(/<cfRule type="dataBar"/);
    expect(reg).toMatch(/<cfRule type="colorScale"/);
    expect(reg).toContain('J4=&quot;offen&quot;');
    expect(reg).toContain('AND(ISNUMBER(C4),C4&gt;1,C4&lt;=2)');
    expect(reg).toContain('AND(ISNUMBER(C4),C4&gt;2)');
  });

  it('Matrix-Blatt: COUNTIFS über das Register mit Ergebnis aus JS, Zonen per Ausdruck, Stufe und Wert im Zahlenformat', async () => {
    const mappe = musterXlsxGrafik();
    const t = entpacken(await renderXlsx(mappe, { zeitpunkt: ZEIT }));
    const m = blatt(t, 3);
    const { erste, letzte } = blattLage(mappe.blaetter[0]!);
    const bis = letzte + 500;
    expect(m).toContain(`COUNTIFS(&apos;Register&apos;!$D$${erste}:$D$${bis},$A`);
    expect(m).toContain(`&apos;Register&apos;!$B$${erste}:$B$${bis},&quot;&lt;&gt;Chance&quot;`);
    expect(m).toContain(`&apos;Register&apos;!$J$${erste}:$J$${bis},&quot;&lt;&gt;geschlossen&quot;`);
    // W 4 / A 4: R-002 zählt, R-004 (Chance) und R-005 (geschlossen) nicht
    const ergebnisse = mappe.blaetter[1]!.matrizen![0]!.ergebnisse;
    expect(ergebnisse[0]![3]).toBe(1);
    expect(ergebnisse[0]![2]).toBe(2); // W 3 / A 4: R-001 und R-006
    const werte = [...m.matchAll(/<c r="[B-E]\d+"[^>]*><f>COUNTIFS[^<]*<\/f><v>(\d+)<\/v>/g)].map((x) => Number(x[1]));
    expect(werte.slice(0, 16)).toEqual(ergebnisse.flat());
    expect(m).toMatch(/\$A\d+\*B\$\d+&gt;=12/);
    expect(t['xl/styles.xml']).toContain('formatCode="0&quot; (H 16)&quot;"');
    expect(t['xl/styles.xml']).toContain('formatCode="&quot;W 1&quot;"');
  });

  it('Matrix mit unbekanntem Quellblatt oder fehlender Spalte wirft', async () => {
    const mappe = musterXlsxGrafik();
    const matrix = mappe.blaetter[1]!.matrizen![0]!;
    await expect(renderXlsx({ ...mappe, blaetter: [mappe.blaetter[0]!, { ...mappe.blaetter[1]!, matrizen: [{ ...matrix, quelle: { ...matrix.quelle, blatt: 'Fehlt' } }] }] })).rejects.toThrow(/Fehlt/);
    await expect(renderXlsx({ ...mappe, blaetter: [mappe.blaetter[0]!, { ...mappe.blaetter[1]!, matrizen: [{ ...matrix, quelle: { ...matrix.quelle, zeilenSpalte: 40 } }] }] })).rejects.toThrow(/Spalte 40/);
  });

  it('Schrift Arial in allen Zellen, Kopf und Hinweise in den Farben des Design Systems', async () => {
    const t = entpacken(await renderXlsx(musterXlsx(), { zeitpunkt: ZEIT }));
    expect(t['xl/styles.xml']).toContain('<name val="Arial"/>');
    expect(t['xl/styles.xml']).toContain('FFE9E6DF'); // Tabellenkopf flaeche-tief
    expect(t['xl/sharedStrings.xml']).toContain(FIRMA);
  });
});
