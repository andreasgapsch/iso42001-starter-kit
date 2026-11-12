// Prüfhilfen für Downloads: Name, MIME-Typ, Inhalt, ZIP, OOXML, offene
// Platzhalter, Kit-Bezug (G8), Sprache und Pfad; Umwandlung nach PDF mit LibreOffice, wenn vorhanden (nur lokal).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';

export const MIME: Record<string, string> = {
  zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  json: 'application/json',
  drawio: 'application/xml',
  txt: 'text/plain',
};

/** Zeichnet Typ und Grösse jedes Blobs auf, aus dem die Seite eine Download-Adresse macht */
export async function blobsAufzeichnen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { blobs: { typ: string; groesse: number }[] };
    w.blobs = [];
    const alt = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (o: Blob | MediaSource) => {
      // Der Generator-Worker startet aus einem Blob (text/javascript); er ist kein Download
      if (o instanceof Blob && o.type !== 'text/javascript') w.blobs.push({ typ: o.type, groesse: o.size });
      return alt(o);
    };
  });
}

export interface Geladen { name: string; pfad: string; typ: string; daten: Buffer }

/**
 * Löst einen Download aus (Doppelklick, wenn `doppelt`), wartet auf genau eine Datei und liefert Name, Pfad, MIME-Typ und
 * Inhalt. Nach dem ersten Download wartet die Hilfe kurz: ein zweiter Download wäre eine doppelte Datei.
 */
export async function lade(page: Page, ausloesen: () => Promise<unknown>, ziel: string, zeit = 120_000): Promise<Geladen> {
  const vorher = await page.evaluate(() => (window as unknown as { blobs: unknown[] }).blobs.length);
  const namen: string[] = [];
  const zaehler = (d: { suggestedFilename(): string }) => namen.push(d.suggestedFilename());
  page.on('download', zaehler);
  const erster = page.waitForEvent('download', { timeout: zeit });
  await ausloesen();
  const dl = await erster;
  const pfad = join(ziel, `${Date.now()}-${dl.suggestedFilename()}`);
  mkdirSync(ziel, { recursive: true });
  await dl.saveAs(pfad);
  expect(await dl.failure(), `Download ${dl.suggestedFilename()} abgebrochen`).toBeNull();
  await page.waitForTimeout(1500);
  page.off('download', zaehler);
  expect(namen, 'genau ein Download, keine doppelte Datei').toHaveLength(1);
  const blobs = await page.evaluate((v) => (window as unknown as { blobs: { typ: string; groesse: number }[] }).blobs.slice(v), vorher);
  expect(blobs, 'genau ein Blob für den Download').toHaveLength(1);
  const daten = readFileSync(pfad);
  expect(daten.length, 'vollständige Datei (Grösse wie der Blob)').toBe(blobs[0]!.groesse);
  return { name: dl.suggestedFilename(), pfad, typ: blobs[0]!.typ, daten };
}

/** Dateiname: Endung, keine Zeichen, die Windows oder macOS ablehnen, kein Kit-Bezug */
export function pruefeName(g: Geladen, endung: string): void {
  expect(g.name, 'Endung').toMatch(new RegExp(`\\.${endung.replace('.', '\\.')}$`));
  expect(g.name, 'unerlaubte Zeichen').not.toMatch(/[\\/:*?"<>|\u0000-\u001f]/);
  expect(g.name, 'Anfang oder Ende mit Leerzeichen oder Punkt').not.toMatch(/^[\s.]|[\s.]$/);
  expect(g.name, 'Kit-Bezug (G8)').not.toMatch(/kmu-cio/i);
  expect(g.name.length).toBeLessThanOrEqual(150);
}

const G8 = /kmu-cio|Starter[- ]?Kit/i;
/** Unersetzte Platzhalter aus den YAML-Texten ({r} ist die Zeile in Formeln) */
const PLATZHALTER = /\{(?!r\})[a-z_]+\}|\{\{|\}\}/;

export interface OoxmlBefund { art: 'docx' | 'xlsx'; titel: string; teile: number }

/** Gültiges OOXML: ZIP-Signatur, [Content_Types].xml mit Hauptteil, keine Platzhalter, kein Kit-Bezug, auch in docProps */
/**
 * Gültiges OOXML. `kitVorlage`: leere Vorlage des Kits aus der Bibliothek; sie trägt die Namensnennung (G8: vorhanden in
 * Vorlagen, abwesend in Firmendokumenten), deshalb wird dort die Namensnennung verlangt statt verboten.
 */
export function pruefeOoxml(daten: Uint8Array, name: string, kitVorlage = false): OoxmlBefund {
  expect(Buffer.from(daten.subarray(0, 4)).toString('latin1'), `${name}: ZIP-Signatur`).toBe('PK\u0003\u0004');
  const teile = unzipSync(daten);
  const typen = strFromU8(teile['[Content_Types].xml'] ?? new Uint8Array());
  const art = name.endsWith('.docx') ? 'docx' : 'xlsx';
  expect(typen, `${name}: Hauptteil`).toContain(art === 'docx' ? 'wordprocessingml.document.main+xml' : 'spreadsheetml.sheet.main+xml');
  expect(teile[art === 'docx' ? 'word/document.xml' : 'xl/workbook.xml'], `${name}: Hauptteil vorhanden`).toBeDefined();
  for (const [p, inhalt] of Object.entries(teile)) {
    if (!/\.(xml|rels)$/.test(p)) continue;
    const text = strFromU8(inhalt);
    if (!kitVorlage || p.startsWith('docProps/')) expect(text, `${name} ${p}: Kit-Bezug (G8)`).not.toMatch(G8);
    expect(text.match(PLATZHALTER)?.[0] ?? '', `${name} ${p}: offener Platzhalter`).toBe('');
  }
  if (kitVorlage) expect(strFromU8(teile['word/document.xml'] ?? new Uint8Array()), `${name}: Namensnennung der Vorlage`).toMatch(/kmu-cio\.ch/);
  const kern = strFromU8(teile['docProps/core.xml'] ?? new Uint8Array());
  return { art, titel: /<dc:title>([^<]*)<\/dc:title>/.exec(kern)?.[1] ?? '', teile: Object.keys(teile).length };
}

export interface ZipInhalt { namen: string[]; dateien: Record<string, Uint8Array> }

/** ZIP: unzip -t, keine leeren Dateien, keine doppelten Namen (auch nicht nach Gross- und Kleinschreibung) */
export function pruefeZip(g: Geladen): ZipInhalt {
  expect(g.daten.subarray(0, 4).toString('latin1'), 'ZIP-Signatur').toBe('PK\u0003\u0004');
  const t = spawnSync('unzip', ['-t', g.pfad], { encoding: 'utf8' });
  expect(t.status, `unzip -t ${t.stdout.slice(-300)}`).toBe(0);
  const dateien = unzipSync(g.daten);
  const namen = Object.keys(dateien).filter((n) => !n.endsWith('/'));
  expect(namen.filter((n) => dateien[n]!.length === 0), 'leere Dateien').toEqual([]);
  const klein = namen.map((n) => n.toLowerCase());
  expect(klein.filter((n, i) => klein.indexOf(n) !== i), 'doppelte Namen').toEqual([]);
  expect(namen.filter((n) => /[\\:*?"<>|]/.test(n) || n.startsWith('/') || n.includes('..')), 'unerlaubte Namen im ZIP').toEqual([]);
  return { namen, dateien };
}

export const LIBREOFFICE = !process.env['CI'] && existsSync('/usr/bin/soffice');

/** Wandelt DOCX und XLSX mit LibreOffice headless nach PDF; jede Datei muss eine PDF ergeben */
export function libreOffice(dateien: Record<string, Uint8Array>, ordner: string): string[] {
  rmSync(ordner, { recursive: true, force: true });
  mkdirSync(join(ordner, 'pdf'), { recursive: true });
  const office = Object.keys(dateien).filter((n) => /\.(docx|xlsx)$/.test(n));
  for (const n of office) writeFileSync(join(ordner, n.replace(/\//g, '_')), dateien[n]!);
  const profil = join(ordner, '..', 'lo-profil');
  execFileSync('soffice', [`-env:UserInstallation=file://${profil}`, '--headless', '--convert-to', 'pdf', '--outdir', join(ordner, 'pdf'), ...office.map((n) => join(ordner, n.replace(/\//g, '_')))], { timeout: 600_000, stdio: 'pipe' });
  const pdf = new Set(readdirSync(join(ordner, 'pdf')));
  return office.filter((n) => !pdf.has(n.replace(/\//g, '_').replace(/\.(docx|xlsx)$/, '.pdf')));
}
