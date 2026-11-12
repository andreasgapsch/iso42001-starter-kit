// Dokumententest: Musterdateien mit LibreOffice headless nach PDF wandeln und Inhalt prüfen.
// Voraussetzung: soffice und pdftotext (poppler-utils). Ohne LibreOffice nur mit
// OHNE_LIBREOFFICE=1 überspringbar, damit ein fehlendes Werkzeug nicht still durchgeht.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderDocx, renderXlsx } from '../../src/generator/index.ts';
import type { XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { d07 } from '../../src/vorlagen/D-07.ts';
import { FIRMA, LANGE_TABELLE_ZEILEN, musterDocx, musterDocxGrafik, musterDocxLeer, musterXlsx, musterXlsxGrafik } from '../unit/generator.muster.ts';

const werkzeugDa = (befehl: string) => spawnSync('sh', ['-c', `command -v ${befehl}`]).status === 0;
const ueberspringen = process.env.OHNE_LIBREOFFICE === '1';
if (!ueberspringen && (!werkzeugDa('soffice') || !werkzeugDa('pdftotext'))) {
  throw new Error('soffice oder pdftotext fehlt (apt: libreoffice-writer-nogui libreoffice-calc-nogui poppler-utils). Überspringen mit OHNE_LIBREOFFICE=1.');
}

interface Ergebnis {
  datei: string;
  bytes: Uint8Array;
  pdf: string;
  exitCode: number | null;
  ausgabe: string;
}

let arbeit = '';
const ergebnisse: Record<string, Ergebnis> = {};

/**
 * Profil mit Neuberechnung beim Laden (OOXMLRecalcMode = 0, «immer»): LibreOffice zeigt sonst die zwischengespeicherten
 * Ergebnisse. Damit lässt sich prüfen, dass die Formeln dasselbe zählen wie die Aggregation in JS.
 */
function neuberechnungsProfil(ordner: string): string {
  mkdirSync(join(ordner, 'user'), { recursive: true });
  writeFileSync(
    join(ordner, 'user', 'registrymodifications.xcu'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n' +
      '<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item>\n</oor:items>\n',
  );
  return ordner;
}

/** D-07 der Präzisionsteile mit falschem Zwischenergebnis (99) in den Matrizen: nach Neuberechnung muss die Zählung stimmen */
function d07FalscherCache(): { mappe: XlsxMappe; erwartet: number[][][] } {
  const projekt = JSON.parse(readFileSync('src/beispiele/praezisionsteile.de.aims.json', 'utf8')) as Projekt;
  const u = erstelleUebersetzer('de', ladeTexte('de'));
  const mappe = d07({ u, modus: 'firma', form: 'dokument', projekt, kataloge: ladeKataloge(), kitVersion: 'test' });
  const erwartet = mappe.blaetter.flatMap((b) => (b.matrizen ?? []).map((m) => m.ergebnisse));
  return {
    mappe: { ...mappe, blaetter: mappe.blaetter.map((b) => (b.matrizen ? { ...b, matrizen: b.matrizen.map((m) => ({ ...m, ergebnisse: m.ergebnisse.map((z) => z.map(() => 99)) })) } : b)) },
    erwartet,
  };
}
const d07Fall = d07FalscherCache();

/** Eine Datei wandeln; jede Datei in eigenen Ausgabeordner (gleicher Basisname bei docx/xlsx). */
function wandeln(name: string, bytes: Uint8Array, profil: string): Ergebnis {
  const datei = join(arbeit, name);
  writeFileSync(datei, bytes);
  const aus = join(arbeit, 'pdf', name);
  mkdirSync(aus, { recursive: true });
  const r = spawnSync(
    'soffice',
    [`-env:UserInstallation=${pathToFileURL(profil).href}`, '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', aus, datei],
    { encoding: 'utf8', timeout: 120_000 },
  );
  const pdf = join(aus, name.replace(/\.[a-z]+$/, '.pdf'));
  return { datei, bytes, pdf, exitCode: r.status, ausgabe: `${r.stdout}\n${r.stderr}` };
}

function pdfText(pdf: string, seite?: number): string {
  const args = ['-layout', '-enc', 'UTF-8'];
  if (seite) args.push('-f', String(seite), '-l', String(seite));
  const r = spawnSync('pdftotext', [...args, pdf, '-'], { encoding: 'utf8' });
  expect(r.status, r.stderr).toBe(0);
  // Ligaturen (fi, fl) der Ersatzschrift auflösen
  return r.stdout.normalize('NFKC');
}

function seitenzahl(pdf: string): number {
  const r = spawnSync('pdfinfo', [pdf], { encoding: 'utf8' });
  const m = /Pages:\s+(\d+)/.exec(r.stdout);
  return m ? Number(m[1]) : 0;
}

/** Alle XML-Teile eines OOXML-Pakets. */
function xmlTeile(bytes: Uint8Array): Record<string, string> {
  const aus: Record<string, string> = {};
  for (const [pfad, inhalt] of Object.entries(unzipSync(bytes))) {
    if (/\.(xml|rels)$/.test(pfad)) aus[pfad] = strFromU8(inhalt);
  }
  return aus;
}

describe.skipIf(ueberspringen)('LibreOffice wandelt die Musterdateien', () => {
  beforeAll(async () => {
    arbeit = mkdtempSync(join(tmpdir(), 'iso42001-dokumente-'));
    // Eigenes LibreOffice-Profil pro Lauf: kein Konflikt mit laufenden Instanzen
    const profil = join(arbeit, 'lo-profil');
    const dateien: [string, Uint8Array][] = [
      ['Muster.docx', await renderDocx(musterDocx())],
      ['Muster-leer.docx', await renderDocx(musterDocxLeer())],
      ['Muster.xlsx', await renderXlsx(musterXlsx())],
      ['Muster-Grafik.docx', await renderDocx(musterDocxGrafik())],
      ['Muster-Grafik.xlsx', await renderXlsx(musterXlsxGrafik())],
    ];
    // Nacheinander: ein Profil verträgt keine parallelen Instanzen
    for (const [name, bytes] of dateien) ergebnisse[name] = wandeln(name, bytes, profil);
    // Neuberechnung beim Laden: falsches Zwischenergebnis 99 in allen Matrixzellen
    const neu = neuberechnungsProfil(join(arbeit, 'lo-neuberechnung'));
    ergebnisse['Neuberechnung.xlsx'] = wandeln('Neuberechnung.xlsx', await renderXlsx(musterXlsxGrafik(() => 99)), neu);
    ergebnisse['D-07-Neuberechnung.xlsx'] = wandeln('D-07-Neuberechnung.xlsx', await renderXlsx(d07Fall.mappe), neu);
    // Für die Sichtprüfung kann der Ordner erhalten bleiben
    if (process.env.DOKUMENTE_AUSGABE) {
      mkdirSync(process.env.DOKUMENTE_AUSGABE, { recursive: true });
      for (const e of Object.values(ergebnisse)) {
        const basis = e.datei.split('/').pop()!;
        writeFileSync(join(process.env.DOKUMENTE_AUSGABE, basis), e.bytes);
        if (existsSync(e.pdf)) writeFileSync(join(process.env.DOKUMENTE_AUSGABE, `${basis}.pdf`), readFileSync(e.pdf));
      }
    }
  });

  afterAll(() => {
    if (arbeit) rmSync(arbeit, { recursive: true, force: true });
  });

  it.each(['Muster.docx', 'Muster-leer.docx', 'Muster.xlsx', 'Muster-Grafik.docx', 'Muster-Grafik.xlsx', 'Neuberechnung.xlsx', 'D-07-Neuberechnung.xlsx'])('%s: Exit-Code 0 und PDF vorhanden', (name) => {
    const e = ergebnisse[name]!;
    expect(e.exitCode, e.ausgabe).toBe(0);
    expect(existsSync(e.pdf), e.ausgabe).toBe(true);
    expect(seitenzahl(e.pdf)).toBeGreaterThan(0);
  });

  it('DOCX: Inhalte, Kopf-/Fusszeile, Umlaute, Hinweise', () => {
    const e = ergebnisse['Muster.docx']!;
    const text = pdfText(e.pdf);
    const seiten = seitenzahl(e.pdf);
    for (const erwartet of [
      FIRMA,
      'Risikobeurteilung KI-Systeme',
      'Dokument-ID',
      'Freigabe durch',
      'ISMS-Bezug',
      'Hinweis zur Vorlage',
      'Ausfüllhinweis',
      'Normverweis',
      'Ausbaustufe (optional): Quantitative Bewertung',
      'Beispiel: Chatbot im Kundendienst',
      'äöü ÄÖÜ é à ç « » ‹ › € §',
      '[Standorte / Bereiche]',
      'Klassifikation: Intern',
      `Seite 1 von ${seiten}`,
      `Seite ${seiten} von ${seiten}`,
      'Freigegeben',
    ]) {
      expect(text, erwartet).toContain(erwartet);
    }
    expect(text).not.toContain('{{');
  });

  it('DOCX: lange Tabelle läuft über mehrere Seiten, Kopfzeile wiederholt', () => {
    const e = ergebnisse['Muster.docx']!;
    const seiten = seitenzahl(e.pdf);
    const letzteId = `R-${String(LANGE_TABELLE_ZEILEN).padStart(3, '0')}`;
    const seiteMit = (s: string) => {
      for (let p = 1; p <= seiten; p++) if (pdfText(e.pdf, p).includes(s)) return p;
      return 0;
    };
    const erste = seiteMit('R-001');
    const letzte = seiteMit(letzteId);
    expect(erste).toBeGreaterThan(0);
    expect(letzte).toBeGreaterThan(erste);
    // Tabellenkopf auch auf der Seite mit der letzten Zeile
    expect(pdfText(e.pdf, letzte)).toMatch(/ID\s+KI-System\s+Risiko/);
  });

  it('DOCX leer: Firmenplatzhalter in der Kopfzeile', () => {
    expect(pdfText(ergebnisse['Muster-leer.docx']!.pdf)).toContain('[Firmenname]');
  });

  it('XLSX: alle Blätter, berechnete Formel, Seitenzahlen', () => {
    const e = ergebnisse['Muster.xlsx']!;
    const text = pdfText(e.pdf);
    for (const erwartet of [
      'Dokumentlenkung',
      'KI-Register und Risiken',
      'Hinweis zur Vorlage',
      'Inventar der KI-Systeme',
      'Chatbot Kundendienst', // Zelle umbricht, Rest in eigener Zeile
      'Österreich)',
      'Risikoregister',
      'Massnahmenplan',
      'Vier-Augen-Prüfung für Lieferzusagen',
      '15.03.2026',
      'Seite 1 von',
    ]) {
      expect(text, erwartet).toContain(erwartet);
    }
    // 13 × 17 = 221: LibreOffice berechnet die Formel beim Laden
    expect(text).toMatch(/\b221\b/);
    expect(text).not.toContain('{{');
    // Ausgeblendetes Listenblatt wird nicht gedruckt
    expect(text).not.toContain('erledigt, nicht wirksam');
  });

  it('DOCX Grafik: Matrix, Diagramme und Formen als Vektor mit Text (nicht als Bild)', () => {
    const text = pdfText(ergebnisse['Muster-Grafik.docx']!.pdf);
    for (const erwartet of [
      'Risikomatrix vor Behandlung',
      'H 16',
      'T tief: bis 4',
      'Umsetzung Anhang A je Gruppe',
      'Anzahl Controls',
      'Schulungsquote',
      'Messwert',
      'KI-System erfasst',
      'Eigener Name?',
      'Anbieter',
      'Betreiber',
      'Nein',
    ]) {
      expect(text, erwartet).toContain(erwartet);
    }
  });

  it('XLSX Grafik: Matrix-Blatt zeigt Anzahl mit Stufe und Wert', () => {
    const text = pdfText(ergebnisse['Muster-Grafik.xlsx']!.pdf);
    expect(text).toContain('Risikomatrix nach Behandlung');
    expect(text).toMatch(/1 \(H 16\)/);
    expect(text).toMatch(/2 \(H 12\)/);
  });

  it('XLSX mit Neuberechnung: COUNTIFS zählen wie die Aggregation in JS (Muster und D-07)', () => {
    const muster = pdfText(ergebnisse['Neuberechnung.xlsx']!.pdf);
    expect(muster).not.toMatch(/\b99 \(/);
    const erwartet = musterXlsxGrafik().blaetter[1]!.matrizen![0]!.ergebnisse;
    // Zeile A 4: W 1 bis 4
    expect(muster).toMatch(new RegExp(erwartet[0]!.map((n, j) => `${n} \\([TMH] ${(j + 1) * 4}\\)`).join('\\s+')));
    const d07 = pdfText(ergebnisse['D-07-Neuberechnung.xlsx']!.pdf);
    expect(d07).not.toMatch(/\b99 \(/);
    // Summe je Matrix gleich der Summe aus JS
    const summen = [...d07.matchAll(/\b(\d+) \([TMH] \d+\)/g)].map((m) => Number(m[1]));
    const js = d07Fall.erwartet.map((m) => m.flat());
    expect(summen).toHaveLength(js.flat().length);
    expect(summen.slice(0, js[0]!.length).reduce((a, b) => a + b, 0)).toBe(js[0]!.reduce((a, b) => a + b, 0));
    expect(summen.slice(js[0]!.length).reduce((a, b) => a + b, 0)).toBe(js[1]!.reduce((a, b) => a + b, 0));
    expect(summen).toEqual(js.flat());
  });

  it.each(['Muster.docx', 'Muster-leer.docx', 'Muster.xlsx', 'Muster-Grafik.docx', 'Muster-Grafik.xlsx'])('%s: keine Kit-Kennung in Paket, docProps und PDF', (name) => {
    const e = ergebnisse[name]!;
    const teile = xmlTeile(e.bytes);
    expect(Object.keys(teile)).toContain('docProps/core.xml');
    expect(Object.keys(teile)).toContain('docProps/app.xml');
    for (const [pfad, xml] of Object.entries(teile)) {
      expect(xml, pfad).not.toMatch(/kmu-cio/i);
      expect(xml, pfad).not.toContain('{{');
      expect(xml, pfad).not.toContain('Un-named');
    }
    expect(pdfText(e.pdf)).not.toMatch(/kmu-cio/i);
  });
});
