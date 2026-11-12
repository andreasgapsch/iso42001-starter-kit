// Zweiter Prüfer: gridcraft-cli und wordcraft-cli prüfen die erzeugten Office-Dateien unabhängig von
// LibreOffice. Lokal mit den Werkzeugen (/usr/bin), in CI ohne sie übersprungen (Warnung G30 wie beim Leitfaden).
//   XLSX: gridcraft-cli check über alle Mappen beider Beispiele DE meldet staleCache=false und mismatched=0.
//   DOCX: keine leere Seite (D-13 Muster, D-09 KI-004 Präzisionsteile hatten eine, wenn eine Tabelle die Seite füllte).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { auftraege } from '../../scripts/beispiele.mts';
import { renderDocx, renderXlsx } from '../../src/generator/index.ts';
import type { DocxDokument, XlsxMappe } from '../../src/generator/ir.ts';
import { gestaltungEinsetzen } from '../../src/vorlagen/gestaltung.ts';
import { kontext, projekt } from './kittexte-hilfen.ts';

const GRID = existsSync('/usr/bin/gridcraft-cli');
const WORD = existsSync('/usr/bin/wordcraft-cli') && existsSync('/usr/bin/pdftotext');
const ORDNER = mkdtempSync(join(process.env['TMPDIR'] ?? tmpdir(), 'zweitpruefer-'));
afterAll(() => rmSync(ORDNER, { recursive: true, force: true }));

async function datei(firma: 'muster-maschinenbau' | 'praezisionsteile', name: string): Promise<string> {
  const p = projekt(firma, 'de');
  const a = auftraege(p, 'de').find((x) => x.name === name)!;
  expect(a, name).toBeDefined();
  const ir = gestaltungEinsetzen(a.vorlage(kontext(p, 'firma', a)), p, 'firma');
  const zeit = { zeitpunkt: new Date(p.meta.geaendert) };
  const daten = 'bloecke' in ir ? await renderDocx(ir as DocxDokument, zeit) : await renderXlsx(ir as XlsxMappe, zeit);
  const pfad = join(ORDNER, firma, `${name}.${'bloecke' in ir ? 'docx' : 'xlsx'}`);
  mkdirSync(join(ORDNER, firma), { recursive: true });
  writeFileSync(pfad, daten);
  return pfad;
}

describe('gridcraft-cli: gespeicherte Ergebnisse aller XLSX', () => {
  it.skipIf(!GRID)('beide Beispiele DE: staleCache=false und mismatched=0, Round-Trip gleich', { timeout: 120_000 }, async () => {
    const dateien: string[] = [];
    for (const firma of ['muster-maschinenbau', 'praezisionsteile'] as const) {
      const p = projekt(firma, 'de');
      for (const a of auftraege(p, 'de')) {
        const ir = a.vorlage(kontext(p, 'firma', a));
        if (!('blaetter' in ir)) continue;
        dateien.push(await datei(firma, a.name));
      }
    }
    expect(dateien.length).toBeGreaterThan(8);
    const r = spawnSync('gridcraft-cli', ['check', ...dateien, '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    const j = JSON.parse(r.stdout) as { totals: { files: number; opened: number; mismatched: number; noOracle: number; roundTripDiffering: number }; files: { path: string; calc: { staleCache: boolean } }[] };
    expect(j.totals.opened).toBe(dateien.length);
    expect(j.files.filter((f) => f.calc.staleCache).map((f) => f.path)).toEqual([]);
    expect(j.totals.mismatched).toBe(0);
    expect(j.totals.noOracle).toBe(0);
    expect(j.totals.roundTripDiffering).toBe(0);
  });
});

describe('wordcraft-cli: keine leere Seite', () => {
  for (const [firma, name] of [['muster-maschinenbau', 'D-13_Daten'], ['praezisionsteile', 'D-09_Folgenabschaetzung_KI-004']] as const) {
    it.skipIf(!WORD)(`${firma} ${name}`, { timeout: 60_000 }, async () => {
      const docx = await datei(firma, name);
      const pdf = docx.replace(/\.docx$/, '.pdf');
      execFileSync('wordcraft-cli', ['convert', docx, pdf]);
      const n = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdf], { encoding: 'utf8' }))?.[1] ?? 0);
      const seiten = Array.from({ length: n }, (_, i) => execFileSync('pdftotext', ['-f', String(i + 1), '-l', String(i + 1), '-layout', pdf, '-'], { encoding: 'utf8' }));
      // Inhalt ohne Kopf (erste Zeile), Fuss (Seite x von y) und Adresszeile
      const leer = seiten.map((t, i) => ({ i: i + 1, zeilen: t.split('\n').map((z) => z.trim()).filter(Boolean).slice(1).filter((z) => !/Seite \d+ von \d+/.test(z) && !/Industriestrasse|www\./.test(z)) }))
        .filter((s) => s.zeilen.length === 0).map((s) => `Seite ${s.i} von ${n}`);
      expect(leer).toEqual([]);
    });
  }
});
