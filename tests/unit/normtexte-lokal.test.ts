// Lokaler Zusatztest gegen die echte, lizenzierte Normausgabe (nur auf dem Rechner des Autors, in CI übersprungen).
// Gibt nur Zählungen aus, nie Text; das Ergebnis wird nicht gespeichert.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { erwartet27001, erwartet42001 } from '../../src/normtexte/erwartet.ts';
import { zerlege } from '../../src/normtexte/parser.ts';
import { seitenAusPdf } from '../../src/normtexte/pdf-text.ts';

const ORDNER = join(homedir(), 'work/iso42001-quellen/norm');
const PDF_42001 = join(ORDNER, 'SN_EN_ISO-IEC_42001-2026.pdf');
const PDF_27001 = join(ORDNER, 'ISO-IEC_27001-2022_en.pdf');
const PDF_27002 = join(ORDNER, 'ISO-IEC_27002-2022_en.pdf');
const lokal = (pfad: string) => existsSync(pfad) && !process.env['CI'];

async function zerlegeDatei(pfad: string) {
  const k = ladeKataloge();
  const erwartet = { '42001': erwartet42001(k), '27001': erwartet27001(k) };
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return { erwartet, r: zerlege(await seitenAusPdf(pdfjs as never, new Uint8Array(readFileSync(pfad))), erwartet) };
}

describe.skipIf(!lokal(PDF_42001))('Lokal: echte Normausgabe ISO/IEC 42001 (nur Zählungen)', () => {
  it('findet alle 38 Controls und alle Abschnitte laut Katalog', async () => {
    const { erwartet, r } = await zerlegeDatei(PDF_42001);
    const e = erwartet['42001'];
    const mitText = (ids: string[]) => ids.filter((id) => r.eintraege[id]?.titel && r.eintraege[id]?.text).length;
    const zaehlung = {
      norm: r.norm,
      sprache: r.sprache,
      ausgabe: r.ausgabe,
      seiten: r.seiten,
      controls: `${mitText(e.controls)}/${e.controls.length}`,
      abschnitte: `${mitText(e.abschnitte)}/${e.abschnitte.length}`,
      kapitel_gruppen: `${e.zusatz.filter((id) => r.eintraege[id]?.titel).length}/${e.zusatz.length}`,
      fehlend: r.fehlend.length,
    };
    console.log(JSON.stringify(zaehlung));
    expect(r.norm).toBe('42001');
    expect(mitText(e.controls)).toBe(38);
    expect(mitText(e.abschnitte)).toBe(e.abschnitte.length);
    expect(r.fehlend).toEqual([]);
  }, 120_000);
});

describe.skipIf(!lokal(PDF_27001))('Lokal: echte Normausgabe ISO/IEC 27001 (nur Zählungen)', () => {
  it('findet alle 93 Controls und alle Abschnitte Kapitel 4 bis 10 laut Katalog', async () => {
    const { erwartet, r } = await zerlegeDatei(PDF_27001);
    const e = erwartet['27001'];
    const mitText = (ids: string[]) => ids.filter((id) => r.eintraege[id]?.titel && r.eintraege[id]?.text).length;
    const zaehlung = {
      norm: r.norm,
      sprache: r.sprache,
      ausgabe: r.ausgabe,
      amd: r.amd ? 'ja' : 'nein',
      seiten: r.seiten,
      controls: `${mitText(e.controls)}/${e.controls.length}`,
      abschnitte: `${mitText(e.abschnitte)}/${e.abschnitte.length}`,
      gruppen: `${e.zusatz.filter((id) => r.eintraege[id]?.titel).length}/${e.zusatz.length}`,
      fehlend: r.fehlend.length,
    };
    console.log(JSON.stringify(zaehlung));
    expect(r.norm).toBe('27001');
    expect(e.controls.length).toBe(93);
    expect(mitText(e.controls)).toBe(93);
    expect(mitText(e.abschnitte)).toBe(e.abschnitte.length);
    expect(r.nurAenderung).toBe(false);
    expect(r.fehlend).toEqual([]);
  }, 120_000);
});

describe.skipIf(!lokal(PDF_27002))('Lokal: ISO/IEC 27002 wird als nicht unterstützt erkannt (nur Zählungen)', () => {
  it('erkennt keine Norm und liefert keine Einträge', async () => {
    const { r } = await zerlegeDatei(PDF_27002);
    console.log(JSON.stringify({ norm: r.norm, nichtUnterstuetzt: r.nichtUnterstuetzt ?? null, eintraege: Object.keys(r.eintraege).length, seiten: r.seiten }));
    expect(r.norm).toBeNull();
    expect(r.nichtUnterstuetzt).toBe('ISO/IEC 27002');
    expect(Object.keys(r.eintraege)).toEqual([]);
  }, 120_000);
});
