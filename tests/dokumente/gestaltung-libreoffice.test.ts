// Dokumententest Gestaltung: Musterdokument mit Logo (SVG und PNG-Ersatz), Titelseite, Wasserzeichen und CI-Farben sowie
// die Excel-Mappe mit Logo im Blatt und in der Druckkopfzeile mit LibreOffice headless nach PDF wandeln und prüfen.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { musterDocx, musterXlsx, type MusterTexte } from '../../src/app/logik/gestaltung-muster.ts';
import { renderDocx, renderXlsx } from '../../src/generator/index.ts';
import { ersetze, holePfad } from '../../src/i18n/texte.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';

const ueberspringen = process.env.OHNE_LIBREOFFICE === '1';
const ZEIT = new Date('2026-10-20T08:00:00Z');
let arbeit = '';
const pdf: Record<string, string> = {};

function texte(): MusterTexte {
  const tx = ladeTexte('de');
  const roh = holePfad(tx, 'app.gestaltung.muster') as Omit<MusterTexte, 'fusszeile' | 'status'>;
  const t = (k: string, w?: Record<string, string>) => ersetze(holePfad(tx, k) as string, w);
  return { ...roh, fusszeile: t('allgemein.fusszeile', { klassifikation: roh.klassifikation }), status: t('allgemein.lenkung.nicht_freigegeben', { status: t('gefuehrt.optionen.dokumentStatus.entwurf') }) };
}

const text = (datei: string, seite?: number) =>
  spawnSync('pdftotext', ['-layout', ...(seite ? ['-f', String(seite), '-l', String(seite)] : []), datei, '-'], { encoding: 'utf8' }).stdout.normalize('NFKC');
const seiten = (datei: string) => Number(/Pages:\s+(\d+)/.exec(spawnSync('pdfinfo', [datei], { encoding: 'utf8' }).stdout)?.[1] ?? 0);
const bilder = (datei: string, seite: number) => spawnSync('pdfimages', ['-list', '-f', String(seite), '-l', String(seite), datei], { encoding: 'utf8' }).stdout.trim().split('\n').length - 2;

describe.skipIf(ueberspringen)('LibreOffice: gestaltete Dokumente', () => {
  beforeAll(async () => {
    arbeit = mkdtempSync(join(tmpdir(), 'iso42001-gestaltung-'));
    const p = JSON.parse(readFileSync('src/beispiele/muster-maschinenbau.de.aims.json', 'utf8')) as Projekt;
    // Kurzname ausdrücklich neben dem Logo (Standard bei einem Logo mit Wortmarke: ausgeblendet, siehe firmennameZeigen)
    p.organisation.gestaltung = { ...p.organisation.gestaltung!, titelseite: 'alle', kennungPraefix: 'AIMS-', kopfzeile: { firmennameZeigen: true } };
    const dateien: [string, Uint8Array][] = [
      ['Gestaltet.docx', await renderDocx(musterDocx(p, 'de', texte()), { zeitpunkt: ZEIT })],
      ['Gestaltet.xlsx', await renderXlsx(musterXlsx(p, 'de', texte()), { zeitpunkt: ZEIT })],
    ];
    // Ohne SVG: LibreOffice zeichnet das PNG (mit SVG nutzt es die Vektorgrafik, pdfimages findet dann kein Bild)
    const ohneSvg = structuredClone(p);
    delete ohneSvg.organisation.gestaltung!.logo!.svg;
    dateien.push(['Gestaltet-png.docx', await renderDocx(musterDocx(ohneSvg, 'de', texte()), { zeitpunkt: ZEIT })]);
    const profil = pathToFileURL(join(arbeit, 'profil')).href;
    for (const [name, bytes] of dateien) {
      writeFileSync(join(arbeit, name), bytes);
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

  it('DOCX: Titelseite mit Logo und Band, Kopfzeile mit Kurzname und Logo, Fusszeile mit Zusatz, Präfix', () => {
    const d = pdf['Gestaltet.docx']!;
    expect(existsSync(d)).toBe(true);
    expect(seiten(d)).toBeGreaterThanOrEqual(2);
    const s1 = text(d, 1);
    expect(s1).toContain('AIMS-D-03');
    expect(s1).toContain('Leitlinie für den Einsatz von KI');
    expect(s1).toContain('Industriestrasse 12');
    const s2 = text(d, 2);
    expect(s2).toContain('MMB');
    expect(s2).toContain('Klassifikation: Intern');
    const png = pdf['Gestaltet-png.docx']!;
    expect(bilder(png, 1)).toBeGreaterThanOrEqual(1);
    expect(bilder(png, 2)).toBeGreaterThanOrEqual(1);
  });

  it('XLSX: Logo im Blatt «Dokument», Vermerk «ENTWURF», Daten vollständig', () => {
    const x = pdf['Gestaltet.xlsx']!;
    expect(existsSync(x)).toBe(true);
    const t = text(x);
    expect(t).toContain('ENTWURF');
    expect(t).toContain('AIMS-D-03');
    expect(t).toContain('R-003');
    expect(bilder(x, 1)).toBeGreaterThanOrEqual(1);
  });
});
