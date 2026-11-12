// Einheitentests des Dokumentengenerators: Paketstruktur, Formatierung, Dateieigenschaften.
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { pngGroesse } from '../../src/generator/docx.ts';
import { renderDocx, renderXlsx, zipErstellen } from '../../src/generator/index.ts';
import type { XlsxMappe } from '../../src/generator/ir.ts';
import { auftragAusfuehren } from '../../src/generator/worker.ts';
import { spaltenName } from '../../src/generator/xlsx.ts';
import {
  FIRMA,
  LANGE_TABELLE_ZEILEN,
  musterDocx,
  musterDocxLeer,
  musterLogo,
  musterXlsx,
} from './generator.muster.ts';

type Teile = Record<string, string>;

function entpacken(paket: Uint8Array): Teile {
  const roh = unzipSync(paket);
  const aus: Teile = {};
  for (const [pfad, inhalt] of Object.entries(roh)) {
    if (/\.(xml|rels)$/.test(pfad)) aus[pfad] = strFromU8(inhalt);
  }
  return aus;
}

const anzahl = (s: string, muster: RegExp) => (s.match(new RegExp(muster, 'g')) ?? []).length;

/** Gemeinsame Prüfung: keine Kit-Kennung, keine Bibliotheks-Vorgaben, keine offenen Platzhalter-Klammern. */
function ohneKitSpuren(teile: Teile): void {
  for (const [pfad, xml] of Object.entries(teile)) {
    expect(xml, pfad).not.toMatch(/kmu-cio/i);
    expect(xml, pfad).not.toMatch(/Un-named/);
    expect(xml, pfad).not.toContain('{{');
  }
  expect(teile['docProps/app.xml']).not.toMatch(/<Application>/);
}

describe('renderDocx', () => {
  it('erzeugt ein vollständiges Paket mit A4, Kopf- und Fusszeile', async () => {
    const t = entpacken(await renderDocx(musterDocx()));
    for (const teil of ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/header1.xml', 'word/footer1.xml', 'word/numbering.xml']) {
      expect(t[teil], teil).toBeDefined();
    }
    const doc = t['word/document.xml']!;
    expect(doc).toMatch(/<w:pgSz w:w="11906" w:h="16838"/);
    expect(t['word/header1.xml']).toContain(FIRMA);
    expect(t['word/header1.xml']).toMatch(/<pic:pic/);
    expect(t['word/footer1.xml']).toMatch(/PAGE/);
    expect(t['word/footer1.xml']).toMatch(/NUMPAGES/);
    expect(t['word/footer1.xml']).toContain('Seite ');
    // Schriften mit sicherem Ersatz (generator/palette.ts): Titel und Tabellen Arial, Lesetext Cambria
    expect(t['word/styles.xml']).toContain('w:ascii="Arial"');
    expect(t['word/styles.xml']).toContain('w:ascii="Cambria"');
    expect(t['word/styles.xml']).not.toContain('Calibri');
  });

  it('setzt Lenkungstabelle und alle Blocktypen um', async () => {
    const doc = entpacken(await renderDocx(musterDocx()))['word/document.xml']!;
    for (const label of ['Dokument-ID', 'Eigner/in', 'Freigabe durch', 'Klassifikation', 'Normbezug', 'ISMS-Bezug', 'Pfad']) {
      expect(doc).toContain(label);
    }
    expect(doc).toMatch(/<w:pStyle w:val="Title"\/>/);
    expect(doc).toMatch(/<w:pStyle w:val="Heading1"\/>/);
    expect(doc).toMatch(/<w:pStyle w:val="Heading3"\/>/);
    // Seitenumbruch vor einer Überschrift: Eigenschaft der Überschrift, kein eigener Absatz (sonst leere Seite nach einer vollen Seite)
    expect(doc).toMatch(/<w:br w:type="page"\/>|<w:pageBreakBefore\/>/);
    // Wiederholte Kopfzeile, lange Tabelle mit Leerzeilen
    expect(doc).toContain('<w:tblHeader/>');
    expect(doc).toContain(`R-${String(LANGE_TABELLE_ZEILEN).padStart(3, '0')}`);
    // Platzhalter gelb hervorgehoben
    expect(anzahl(doc, /<w:highlight w:val="yellow"\/>/)).toBeGreaterThanOrEqual(5);
    // Zwei nummerierte Listen mit eigener Instanz (Neubeginn bei 1)
    const numIds = new Set([...doc.matchAll(/<w:numId w:val="(\d+)"\/>/g)].map((m) => m[1]));
    expect(numIds.size).toBeGreaterThanOrEqual(3);
  });

  it('rendert jeden Hinweis als genau einen Absatz mit eigenem Format', async () => {
    const t = entpacken(await renderDocx(musterDocx()));
    const doc = t['word/document.xml']!;
    const stile = t['word/styles.xml']!;
    // Banner des Design Systems: Grund status-<s>-hauch, Rahmen rundum in status-<s>-flaeche (kein Linksbalken)
    for (const [stil, fill, rand] of [
      ['HinweisAusfuellen', 'F6ECD8', '8A5A00'],
      ['HinweisVorlage', 'F6ECD8', '8A5A00'],
      ['HinweisNorm', 'E8EFF5', '1C5D94'],
      ['HinweisAusbau', 'E6F3F5', '2E95A5'],
      ['HinweisBeispiel', 'EBEAE6', '616A74'],
    ] as const) {
      expect(anzahl(doc, new RegExp(`<w:pStyle w:val="${stil}"/>`)), stil).toBe(1);
      const def = stile.slice(stile.indexOf(`w:styleId="${stil}"`));
      const stilXml = def.slice(0, def.indexOf('</w:style>'));
      expect(stilXml).toContain(`w:fill="${fill}"`);
      for (const seite of ['top', 'left', 'bottom', 'right']) expect(stilXml, `${stil} ${seite}`).toMatch(new RegExp(`<w:${seite} [^>]*w:color="${rand}"`));
    }
    expect(doc).toContain('Ausbaustufe (optional): Quantitative Bewertung');
    expect(doc).toContain('Beispiel: Chatbot im Kundendienst');
  });

  it('schreibt nur die vorgegebenen Dateieigenschaften', async () => {
    const t = entpacken(await renderDocx(musterDocx()));
    const core = t['docProps/core.xml']!;
    expect(core).toContain('<dc:title>D-07 Risikobeurteilung KI-Systeme</dc:title>');
    expect(core).toContain(`<dc:creator>${FIRMA}</dc:creator>`);
    expect(core).toContain(`<cp:lastModifiedBy>${FIRMA}</cp:lastModifiedBy>`);
    expect(t['docProps/app.xml']).toContain(`<Company>${FIRMA}</Company>`);
    ohneKitSpuren(t);
  });

  it('leere Vorlage: Firmenplatzhalter in der Kopfzeile, kein Autor', async () => {
    const t = entpacken(await renderDocx(musterDocxLeer()));
    expect(t['word/header1.xml']).toContain('[Firmenname]');
    expect(t['word/header1.xml']).toContain('<w:highlight w:val="yellow"/>');
    expect(t['docProps/core.xml']).not.toMatch(/dc:creator|lastModifiedBy/);
    expect(t['docProps/app.xml']).not.toMatch(/<Company>/);
    ohneKitSpuren(t);
  });

  it('englische Beschriftungen', async () => {
    const t = entpacken(await renderDocx({ ...musterDocx(), sprache: 'en' }));
    expect(t['word/document.xml']).toContain('Document ID');
    expect(t['word/footer1.xml']).toContain('Page ');
    expect(t['word/styles.xml']).toContain('en-GB');
  });

  it('liest die Logogrösse aus dem PNG-Kopf und lehnt andere Formate ab', () => {
    expect(pngGroesse(musterLogo())).toEqual({ breite: 160, hoehe: 48 });
    expect(() => pngGroesse(new Uint8Array(30))).toThrow(/PNG/);
  });
});

describe('renderXlsx', () => {
  const blatt = (t: Teile, nr: number) => t[`xl/worksheets/sheet${nr}.xml`]!;

  it('legt Blatt «Dokument» zuerst an und blendet das Listenblatt aus', async () => {
    const wb = entpacken(await renderXlsx(musterXlsx()))['xl/workbook.xml']!;
    const namen = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1]);
    expect(namen).toEqual(['Dokument', 'Inventar', 'Risiken', 'Massnahmen', 'Listen']);
    expect(wb).toMatch(/<sheet [^>]*name="Listen"[^>]*state="hidden"/);
    // Gespeicherte Ergebnisse gelten (gridcraft check test.7: mit fullCalcOnLoad galt jeder Cache als veraltet)
    expect(wb).not.toMatch(/fullCalcOnLoad/);
    // Jede Formelzelle trägt ein gespeichertes Ergebnis (<v>), auch leere Texte
    for (const [p, x] of Object.entries(entpacken(await renderXlsx(musterXlsx())))) {
      if (!p.startsWith('xl/worksheets/')) continue;
      for (const z of x.match(/<c [^>]*><f>(?:(?!<\/c>).)*<\/c>/g) ?? []) expect(z, p).toMatch(/<v>/);
    }
  });

  it('Lenkungsblatt mit Angaben, Platzhaltern und Hinweisen', async () => {
    const t = entpacken(await renderXlsx(musterXlsx()));
    const ss = t['xl/sharedStrings.xml']!;
    for (const s of ['Dokumentlenkung', 'Dokument-ID', 'KI-Register und Risiken', '[Name, Funktion]', 'Hinweis zur Vorlage', 'Normverweis']) {
      expect(ss).toContain(s);
    }
    expect(t['xl/styles.xml']).toContain('FFFFFF00'); // Platzhalter gelb
    expect(t['xl/styles.xml']).toContain('FFF6ECD8'); // Hinweis: status-warnung-hauch
    expect(t['xl/styles.xml']).toContain('FFE8EFF5'); // Normverweis: status-info-hauch
    expect(t['xl/styles.xml']).toContain('<name val="Arial"/>');
  });

  it('Dropdowns über Daten- und Leerzeilen, inline und über Listenblatt', async () => {
    const t = entpacken(await renderXlsx(musterXlsx()));
    // Inventar: Titel, 1 Hinweis, Leerzeile, Kopf in Zeile 4, 2 + 20 Zeilen bis 26
    const inventar = blatt(t, 2);
    expect(inventar).toMatch(/<dataValidation type="list"[^>]*sqref="C5:C26"[^>]*>\s*<formula1>&quot;Eigenentwicklung,SaaS,Eingebettet&quot;<\/formula1>/);
    expect(inventar).toMatch(/sqref="D5:D26"/);
    // Massnahmen: Werte mit Kommas -> Verweis auf Listenblatt
    expect(blatt(t, 4)).toMatch(/<dataValidation [^>]*sqref="C4:C14"><formula1>&apos;Listen&apos;!\$A\$1:\$A\$4<\/formula1>/);
    expect(anzahl(blatt(t, 5), /<c r="A\d" [^>]*t="s"/)).toBe(4);
    expect(t['xl/sharedStrings.xml']).toContain('erledigt, nicht wirksam');
  });

  it('Formeln mit Zeilennummer, Ampel, Fixierung, Autofilter, Kopf-/Fusszeile', async () => {
    const t = entpacken(await renderXlsx(musterXlsx()));
    const risiken = blatt(t, 3);
    // Kopf in Zeile 5 (Titel, 2 Hinweise, Leerzeile)
    expect(risiken).toContain('<f>IF(OR(D6=&quot;&quot;,E6=&quot;&quot;),&quot;&quot;,D6*E6)</f>');
    expect(risiken).toContain('<f>IF(OR(D23=&quot;&quot;,E23=&quot;&quot;),&quot;&quot;,D23*E23)</f>');
    expect(anzahl(risiken, /<cfRule /)).toBe(3);
    expect(risiken).toMatch(/<conditionalFormatting sqref="F6:F23">/);
    expect(risiken).toContain('AND(ISNUMBER(F6),F6&lt;=6)');
    expect(risiken).toMatch(/<pane [^>]*ySplit="5"[^>]*state="frozen"/);
    expect(risiken).toMatch(/<autoFilter ref="A5:G23"\/>/);
    expect(risiken).toMatch(/<oddFooter>.*Seite &amp;P von &amp;N<\/oddFooter>/);
    // Massnahmen ohne Fixierung
    expect(blatt(t, 4)).not.toMatch(/state="frozen"/);
  });

  it('schreibt nur die vorgegebenen Dateieigenschaften', async () => {
    const t = entpacken(await renderXlsx(musterXlsx()));
    expect(t['docProps/core.xml']).toContain(`<dc:creator>${FIRMA}</dc:creator>`);
    expect(t['docProps/app.xml']).toContain(`<Company>${FIRMA}</Company>`);
    ohneKitSpuren(t);
    const leer = entpacken(await renderXlsx({ ...musterXlsx(), eigenschaften: { titel: 'x', autor: '' } }));
    expect(leer['docProps/core.xml']).not.toMatch(/dc:creator|lastModifiedBy/);
    expect(leer['docProps/app.xml']).not.toMatch(/<Company>/);
    ohneKitSpuren(leer);
  });

  it('ist bei festem Zeitpunkt reproduzierbar', async () => {
    const zeitpunkt = new Date('2026-10-20T08:00:00Z');
    const a = await renderXlsx(musterXlsx(), { zeitpunkt });
    const b = await renderXlsx(musterXlsx(), { zeitpunkt });
    expect(a).toEqual(b);
  });

  it('bereinigt Blattnamen und prüft die Ampelspalte', async () => {
    const basis = musterXlsx();
    const erstes = basis.blaetter[0]!;
    const mappe: XlsxMappe = {
      ...basis,
      blaetter: [
        { ...erstes, name: 'Risiken/Chancen: eine sehr lange Bezeichnung' },
        { ...erstes, name: 'Dokument' },
      ],
    };
    const wb = entpacken(await renderXlsx(mappe))['xl/workbook.xml']!;
    const namen = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1]!);
    expect(namen[1]).toBe('Risiken Chancen  eine sehr lang');
    expect(namen[2]).toBe('Dokument (2)');
    expect(namen.every((n) => n.length <= 31)).toBe(true);
    await expect(
      renderXlsx({ ...basis, blaetter: [{ ...erstes, ampel: { spalte: 9, gruenBis: 1, gelbBis: 2 } }] }),
    ).rejects.toThrow(/Ampelspalte/);
  });

  it('Spaltenbuchstaben', () => {
    expect([1, 26, 27, 52, 703].map(spaltenName)).toEqual(['A', 'Z', 'AA', 'AZ', 'AAA']);
  });
});

describe('zipErstellen', () => {
  it('bündelt Dateien mit Unterordnern', async () => {
    const docx = await renderDocx(musterDocx());
    const zip = zipErstellen([
      { pfad: 'de/D-07 Risikobeurteilung.docx', inhalt: docx },
      { pfad: 'LIESMICH.txt', inhalt: new TextEncoder().encode('Hallo Zürich') },
    ]);
    const inhalt = unzipSync(zip);
    expect(Object.keys(inhalt).sort()).toEqual(['LIESMICH.txt', 'de/D-07 Risikobeurteilung.docx']);
    expect(inhalt['de/D-07 Risikobeurteilung.docx']).toEqual(docx);
    expect(strFromU8(inhalt['LIESMICH.txt']!)).toBe('Hallo Zürich');
  });

  it('lehnt unsichere und doppelte Pfade ab', () => {
    const x = new Uint8Array([1]);
    expect(() => zipErstellen([{ pfad: '../boese.txt', inhalt: x }])).toThrow(/Ungültiger Pfad/);
    expect(() => zipErstellen([{ pfad: 'a//b.txt', inhalt: x }])).toThrow(/Ungültiger Pfad/);
    expect(() => zipErstellen([{ pfad: 'A.txt', inhalt: x }, { pfad: 'a.txt', inhalt: x }])).toThrow(/Doppelter Pfad/);
  });
});

describe('Worker-Auftrag', () => {
  it('liefert DOCX und XLSX als Uint8Array', async () => {
    const d = await auftragAusfuehren({ art: 'docx', spec: musterDocx() });
    const x = await auftragAusfuehren({ art: 'xlsx', spec: musterXlsx() });
    for (const bytes of [d, x]) {
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]); // «PK»
    }
  });
});
