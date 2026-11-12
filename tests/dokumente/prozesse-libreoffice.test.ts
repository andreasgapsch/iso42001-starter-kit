// Dokumententest Prozesse: Prozessbeschreibung D-27 (ein Prozess mit Bahnen und Rauten, Muster Maschinenbau) und D-02
// mit der Prozesslandkarte aus dem Katalog mit LibreOffice headless nach PDF wandeln und prüfen: Bahnen mit Rolle im Kopf,
// Texte der Formen, Ablauf auf einer Seite, Landkarte mit allen anwendbaren Prozessen.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderDocx, type DocxDokument } from '../../src/generator/index.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { VORLAGEN } from '../../src/vorlagen/index.ts';

const ueberspringen = process.env.OHNE_LIBREOFFICE === '1';
const ZEIT = new Date('2027-02-05T16:30:00Z');
let arbeit = '';
const pdf: Record<string, string> = {};

const text = (datei: string, seite?: number) =>
  spawnSync('pdftotext', ['-layout', ...(seite ? ['-f', String(seite), '-l', String(seite)] : []), datei, '-'], { encoding: 'utf8' }).stdout.normalize('NFKC');
const seiten = (datei: string) => Number(/Pages:\s+(\d+)/.exec(spawnSync('pdfinfo', [datei], { encoding: 'utf8' }).stdout)?.[1] ?? 0);
/** Seite, auf der ein Text vorkommt (erste) */
const seiteMit = (datei: string, s: string) => Array.from({ length: seiten(datei) }, (_, i) => i + 1).find((n) => text(datei, n).includes(s));

describe.skipIf(ueberspringen)('LibreOffice: Prozessbeschreibung D-27 und Prozesslandkarte D-02', () => {
  beforeAll(async () => {
    arbeit = mkdtempSync(join(tmpdir(), 'iso42001-prozesse-'));
    const p = JSON.parse(readFileSync('src/beispiele/muster-maschinenbau.de.aims.json', 'utf8')) as Projekt;
    const u = erstelleUebersetzer('de', ladeTexte('de'));
    const kataloge = ladeKataloge();
    const ctx = { u, modus: 'firma' as const, form: 'ergaenzungsblatt' as const, projekt: p, kataloge, kitVersion: 'test' };
    const dateien: [string, DocxDokument][] = [
      ['D-27_PR-07.docx', VORLAGEN['D-27']!({ ...ctx, form: 'dokument', prozessId: 'PR-07' }) as DocxDokument],
      ['D-27_PR-19.docx', VORLAGEN['D-27']!({ ...ctx, form: 'dokument', prozessId: 'PR-19' }) as DocxDokument],
      ['D-02.docx', VORLAGEN['D-02']!({ ...ctx, form: 'dokument' }) as DocxDokument],
    ];
    const profil = pathToFileURL(join(arbeit, 'profil')).href;
    for (const [name, ir] of dateien) {
      writeFileSync(join(arbeit, name), await renderDocx(ir, { zeitpunkt: ZEIT }));
      const aus = join(arbeit, 'pdf', name);
      mkdirSync(aus, { recursive: true });
      const r = spawnSync('soffice', [`-env:UserInstallation=${profil}`, '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', aus, join(arbeit, name)], { encoding: 'utf8', timeout: 120_000 });
      expect(r.status, r.stderr).toBe(0);
      pdf[name] = join(aus, name.replace(/\.[a-z]+$/, '.pdf'));
    }
  }, 300_000);

  afterAll(() => {
    if (arbeit) rmSync(arbeit, { recursive: true, force: true });
  });

  it('D-27 PR-07: Ablauf mit Bahnen je Rolle auf einer Seite, Entscheidung mit Zweigen, Schritt aus draw.io', () => {
    const d = pdf['D-27_PR-07.docx']!;
    expect(existsSync(d)).toBe(true);
    const seite = seiteMit(d, 'Wiedervorlage terminieren')!;
    expect(seite).toBeDefined();
    const s = text(d, seite);
    for (const bahn of ['Fachbereich', 'Risikomanagement', 'KI-Inventar']) expect(s).toContain(bahn);
    expect(s).toContain('Werkzeug freigegeben');
    expect(text(d)).toContain('innert 10 Tagen');
    // Zweige der Entscheidungen im Ablauf beschriftet
    expect(s).toMatch(/\bja\b/);
    expect(s).toMatch(/\bnein\b/);
  });

  it('D-27 PR-19: alle Formen auf der Seite des Ablaufs, Rauten lesbar', () => {
    const d = pdf['D-27_PR-19.docx']!;
    const seite = seiteMit(d, 'Vorfall gemeldet')!;
    const s = text(d, seite).replace(/\s+/g, ' ');
    expect(s).toContain('Vorfall abgeschlossen');
    expect(s).toContain('Informationssicherheit');
    expect(s).toMatch(/Ist die Informations.*betroffen\?/);
  });

  it('D-02: Landkarte aus dem Katalog mit allen anwendbaren AIMS-Prozessen und Markierung «mit ISMS»', () => {
    const d = pdf['D-02.docx']!;
    // Seite der Anlage mit der Landkarte (letzte Seite mit dem Titel; der Text davor verweist nur darauf)
    const seite = Array.from({ length: seiten(d) }, (_, i) => i + 1).filter((n) => text(d, n).includes('Prozesslandkarte des KI-Managementsystems')).at(-1)!;
    const t = text(d).replace(/\s+/g, ' ');
    for (const id of ['PR-01', 'PR-08', 'PR-15', 'PR-27']) expect(t).toContain(id);
    // Mit ISMS gemeinsam geführte Prozesse in der Landkarte markiert, Basisprozesse als Verweis auf das ISMS
    expect(text(d, seite).replace(/\s+/g, ' ')).toMatch(/mit\s+ISMS/);
    expect(t).toContain('Diese Grundprozesse der Informationssicherheit führt das ISMS');
  });
});
