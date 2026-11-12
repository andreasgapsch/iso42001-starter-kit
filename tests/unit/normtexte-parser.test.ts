// Parser für die eigene Norm-PDF (src/normtexte) mit SYNTHETISCHEN Normen (tests/fixtures/normpdf.ts): erfundener Text,
// Aufbau wie eine ISO-Norm. Kein echter Normtext in Tests, Fixtures oder Snapshots.
import { describe, expect, it } from 'vitest';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { idsAusNormbezug, istGruppe42001, normText, UNTERGRUPPEN_42001 } from '../../src/normtexte/aufloesung.ts';
import { istSeitenzahl, istVermerk, istVerzeichniszeile, seitenBereinigen, zeichenBereinigen } from '../../src/normtexte/bereinigen.ts';
import { erwartet27001, erwartet42001, pflichtIds } from '../../src/normtexte/erwartet.ts';
import { erkenne, verbinde, zerlege } from '../../src/normtexte/parser.ts';
import { seitenAusPdf } from '../../src/normtexte/pdf-text.ts';
import type { NormTeil } from '../../src/normtexte/typen.ts';
import { alsPdf, alsSeiten, synthetischeNorm } from '../fixtures/normpdf.ts';

const k = ladeKataloge();
const E = { '42001': erwartet42001(k), '27001': erwartet27001(k) };

describe('Erwartete Einträge aus den Katalogen', () => {
  it('42001: 27 Abschnitte, 7 Kapitel, 38 Controls; 27001: 93 Controls', () => {
    expect(E['42001'].abschnitte).toHaveLength(27);
    expect(E['42001'].controls).toHaveLength(38);
    expect(E['42001'].zusatz.filter((x) => x.startsWith('K-'))).toHaveLength(7);
    expect(pflichtIds(E['42001'])).toHaveLength(65);
    expect(E['27001'].controls).toHaveLength(93);
    expect(pflichtIds(E['27001'])).toHaveLength(93);
  });
  it('Untergruppen A.6.1 und A.6.2 stimmen mit dem Katalog überein', () => {
    const katalog = k.controls42001.gruppen.flatMap((g) => g.untergruppen ?? []);
    expect([...UNTERGRUPPEN_42001].sort()).toEqual([...katalog].sort());
    expect(istGruppe42001('A.6.1')).toBe(true);
    expect(istGruppe42001('A.2.2')).toBe(false);
  });
});

describe('Bereinigung', () => {
  it('Ligaturen, weiche Trennung, geschützte Leerzeichen', () => {
    expect(zeichenBereinigen(`Prü\ufb01ung Au\u00adgabe\u00a0x  y`)).toBe('Prüfiung Augabe x y');
    expect(zeichenBereinigen('\ufb00\ufb02\ufb03\ufb04')).toBe('ffflffiffl');
  });
  it('Vermerke, Seitenzahlen, Verzeichniszeilen', () => {
    expect(istVermerk('Normen-Download Testverlag KdNr.0000')).toBe(true);
    expect(istVermerk('Licensed to Example Ltd, single user')).toBe(true);
    expect(istVermerk('Lizenziert für Testfirma, Einzelplatz')).toBe(true);
    expect(istVermerk('Die Organisation muss das Prüfobjekt bestimmen.')).toBe(false);
    expect(istSeitenzahl('17')).toBe(true);
    expect(istSeitenzahl('xii')).toBe(true);
    expect(istSeitenzahl('Seite 3 von 40')).toBe(true);
    expect(istSeitenzahl('4.1 Testtitel')).toBe(false);
    expect(istVerzeichniszeile('4.1 Testtitel ........... 5')).toBe(true);
    expect(istVerzeichniszeile('4.1 Testtitel')).toBe(false);
  });
  it('entfernt Kopf- und Fusszeilen, Wasserzeichen (gedreht) und Vermerke', () => {
    const n = synthetischeNorm(E['42001'], { norm: '42001', sprache: 'de', national: 'SN EN' });
    const alle = seitenBereinigen(alsSeiten(n)).flatMap((s) => s.zeilen.map((z) => z.text));
    expect(alle.some((t) => /Testverlag|KdNr|Einzelplatz|^Seite \d+$/.test(t))).toBe(false);
    expect(alle.some((t) => /^SN EN ISO\/IEC 42001:2026 de$/.test(t))).toBe(false);
  });
  it('Silbentrennung: Trennstrich entfällt bei Kleinbuchstaben, bleibt bei Gross und bei bekannten Bindestrich-Wörtern', () => {
    const z = (text: string, y: number) => ({ text, y, h: 11, seite: 1 });
    const woerter = new Set(['risk-based', 'prüfverfahren']);
    expect(verbinde([z('das Prüfver-', 100), z('fahren gilt.', 113)], woerter)).toBe('das Prüfverfahren gilt.');
    expect(verbinde([z('ein KI-', 100), z('System hier.', 113)], woerter)).toBe('ein KI-System hier.');
    expect(verbinde([z('a risk-', 100), z('based way.', 113)], woerter)).toBe('a risk-based way.');
    expect(verbinde([z('Erster Satz.', 100), z('Zweiter Satz.', 125)], woerter)).toBe('Erster Satz.\nZweiter Satz.');
    expect(verbinde([z('Liste:', 100), z('a) eins;', 113), z('b) zwei.', 126)], woerter)).toBe('Liste:\na) eins;\nb) zwei.');
  });
});

describe('Erkennung von Norm, Sprache und Ausgabe', () => {
  it.each([
    ['42001', 'de', 'SN EN', 'SN EN ISO/IEC 42001:2026', '2023'],
    ['42001', 'en', undefined, 'ISO/IEC 42001:2023', '2023'],
    ['27001', 'de', 'DIN EN', 'DIN EN ISO/IEC 27001:2026', '2022'],
    ['27001', 'en', undefined, 'ISO/IEC 27001:2022', '2022'],
  ] as const)('%s %s %s', (norm, sprache, national, bezeichnung, ausgabe) => {
    const n = synthetischeNorm(E[norm], { norm, sprache, national });
    const r = erkenne(alsSeiten(n));
    expect(r).toMatchObject({ norm, sprache, bezeichnung, ausgabe });
    expect(r.amd).toBeUndefined();
  });
  it('27001 mit Amd 1:2024', () => {
    const r = erkenne(alsSeiten(synthetischeNorm(E['27001'], { norm: '27001', sprache: 'en', amd: true })));
    expect(r.amd).toBe('Amd 1:2024');
  });
  it('keine Norm erkannt', () => {
    const r = zerlege([{ nr: 1, breite: 595, hoehe: 842, zeilen: [{ y: 100, x: 70, h: 11, font: 'F1', text: 'Irgendein Dokument', laeufe: [{ x: 70, ende: 200, text: 'Irgendein Dokument', font: 'F1' }] }] }], E);
    expect(r.norm).toBeNull();
    expect(Object.keys(r.eintraege)).toHaveLength(0);
  });
  it('andere Norm, die 27001 zitiert (27002): nicht unterstützt statt 27001', () => {
    const zeile = (y: number, text: string) => ({ y, x: 70, h: 11, font: 'F1', text, laeufe: [{ x: 70, ende: 400, text, font: 'F1' }] });
    const seiten = [1, 2, 3, 4].map((nr) => ({ nr, breite: 595, hoehe: 842, zeilen: [zeile(40, 'ISO/IEC 27002:2022(E)'), zeile(100, nr === 2 ? 'Erfundener Satz mit Verweis auf ISO/IEC 27001 und ISO/IEC 27000.' : 'Erfundener Satz.')] }));
    const r = zerlege(seiten, E);
    expect(r.norm).toBeNull();
    expect(r.nichtUnterstuetzt).toBe('ISO/IEC 27002');
    expect(Object.keys(r.eintraege)).toHaveLength(0);
  });
});

function pruefeVollstaendig(norm: '42001' | '27001', sprache: 'de' | 'en', national?: string) {
  const n = synthetischeNorm(E[norm], { norm, sprache, national });
  const r = zerlege(alsSeiten(n), E);
  expect(r.fehlend).toEqual([]);
  expect(r.gefunden).toHaveLength(norm === '42001' ? 65 : 93);
  for (const [id, e] of Object.entries(n.erwartet)) {
    expect(r.eintraege[id]?.titel, `Titel ${id}`).toBe(e.titel);
    expect(r.eintraege[id]?.text ?? '', `Text ${id}`).toBe(e.text);
  }
  return r;
}

describe('Zerlegen synthetischer Normen (alle IDs, exakter Text)', () => {
  it('42001 deutsch (SN EN): 27 Abschnitte, 7 Kapitel, 38 Controls, Gruppen', () => {
    const r = pruefeVollstaendig('42001', 'de', 'SN EN');
    // Unterabschnitte ohne eigenen Katalogeintrag gehören zum Abschnitt (7.5.1 in 7.5)
    expect(r.eintraege['K-7.5']!.text).toContain('7.5.1 Testtitel 7.5.1 Bravo');
    // Anhang B (B.2.2) und Querverweise darin verändern Anhang A nicht
    expect(r.eintraege['A.2.2']!.text).not.toMatch(/Querverweis|Cross reference/);
    expect(r.eintraege['A.6.1']!.titel).toBe('Testgruppe A.6.1');
  });
  it('42001 englisch (ISO)', () => pruefeVollstaendig('42001', 'en'));
  it('27001 deutsch (DIN EN): 93 Controls ohne Beschriftung «Massnahme»', () => {
    const r = pruefeVollstaendig('27001', 'de', 'DIN EN');
    expect(r.eintraege['27001-5.1']!.text.startsWith('Massnahme')).toBe(false);
    expect(r.eintraege['27001-8.34']).toBeDefined();
    expect(r.eintraege['27001-K-4.1']).toBeDefined();
  });
  it('27001 englisch (ISO)', () => pruefeVollstaendig('27001', 'en'));
  it('27001 mit Amd 1:2024 im selben PDF: Ergänzungen bei 4.1 und 4.2', () => {
    const n = synthetischeNorm(E['27001'], { norm: '27001', sprache: 'de', amd: true });
    const r = zerlege(alsSeiten(n), E);
    expect(r.amd).toBe('Amd 1:2024');
    expect(r.nurAenderung).toBe(false);
    expect(r.eintraege['27001-K-4.1']!.text).toBe(n.erwartet['27001-K-4.1']!.text);
    expect(r.eintraege['27001-K-4.2']!.text).toContain('[Amd 1:2024]');
    expect(r.fehlend).toEqual([]);
  });
  it('27001 nur Änderung: nurAenderung, nur 4.1 und 4.2', () => {
    const n = synthetischeNorm(E['27001'], { norm: '27001', sprache: 'en', amd: true, nurAmd: true });
    const r = zerlege(alsSeiten(n), E);
    expect(r.nurAenderung).toBe(true);
    expect(Object.keys(r.eintraege).sort()).toEqual(['27001-K-4.1', '27001-K-4.2']);
  });
  it('fehlende Einträge erscheinen als «nicht gefunden»', () => {
    const n = synthetischeNorm(E['42001'], { norm: '42001', sprache: 'de', ohne: ['A.7.4', 'K-9.1'] });
    const r = zerlege(alsSeiten(n), E);
    expect(r.fehlend.sort()).toEqual(['A.7.4', 'K-9.1']);
    expect(r.gefunden).toHaveLength(63);
  });
});

describe('pdf.js (Legacy-Build) mit synthetischer PDF in Node', () => {
  it('liest die zur Testzeit erzeugte PDF und findet alle Einträge', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const n = synthetischeNorm(E['42001'], { norm: '42001', sprache: 'de', national: 'SN EN' });
    const seiten = await seitenAusPdf(pdfjs as never, alsPdf(n));
    const r = zerlege(seiten, E);
    expect(r).toMatchObject({ norm: '42001', sprache: 'de', bezeichnung: 'SN EN ISO/IEC 42001:2026', ausgabe: '2023' });
    expect(r.fehlend).toEqual([]);
    for (const [id, e] of Object.entries(n.erwartet)) {
      expect(r.eintraege[id]?.titel, `Titel ${id}`).toBe(e.titel);
      expect(r.eintraege[id]?.text ?? '', `Text ${id}`).toBe(e.text);
    }
  });
});

describe('Zentrale Textauflösung normText', () => {
  const teil = (sprache: 'de' | 'en', titel: string): NormTeil => ({ norm: '42001', sprache, bezeichnung: 'ISO/IEC 42001:2023', ausgabe: '2023', quelle: 'x.pdf', importiert: '2026-10-22', eintraege: { 'A.2.2': { titel, text: `Text ${titel}` }, 'K-4.1': { titel: `K ${titel}`, text: '' } } });
  const eigen = (s: string) => `eigen:${s}`;
  it('ohne Normpaket: eigener Kurztitel und eigene Erläuterung', () => {
    expect(normText({ eigen }, 'A.2.2', 'titel', 'de')).toBe('eigen:controls42001.controls.A.2.2.titel');
    expect(normText({ eigen }, 'A.2.2', 'text', 'de')).toBe('eigen:controls42001.controls.A.2.2.zweck');
    expect(normText({ eigen }, 'K-4.1', 'text', 'de')).toBe('eigen:anforderungen42001.abschnitte.K-4.1.was');
    expect(normText({ eigen }, 'A.6.1', 'titel', 'de')).toBe('eigen:controls42001.gruppen.A.6.1');
    expect(normText({ eigen }, '27001-5.1', 'titel', 'de')).toBe('eigen:iso27001.controls.27001-5.1.titel');
    expect(normText({ eigen }, '27001-5.1', 'text', 'de')).toBeUndefined();
  });
  it('mit Normpaket: gleiche Sprache zuerst, sonst die andere; leerer Text fällt auf die eigene Erläuterung zurück', () => {
    const teile = [teil('en', 'EN'), teil('de', 'DE')];
    expect(normText({ teile, eigen }, 'A.2.2', 'titel', 'de')).toBe('DE');
    expect(normText({ teile, eigen }, 'A.2.2', 'titel', 'en')).toBe('EN');
    expect(normText({ teile: [teil('en', 'EN')], eigen }, 'A.2.2', 'text', 'de')).toBe('Text EN');
    expect(normText({ teile, eigen }, 'K-4.1', 'text', 'de')).toBe('eigen:anforderungen42001.abschnitte.K-4.1.was');
    expect(normText({ teile, eigen }, 'A.3.2', 'titel', 'de')).toBe('eigen:controls42001.controls.A.3.2.titel');
  });
  it('IDs aus Normbezügen', () => {
    const bekannt = [...E['42001'].abschnitte, ...E['42001'].controls];
    expect(idsAusNormbezug('6.1.1 bis 6.1.3, A.5.2', bekannt)).toEqual(['K-6.1.1', 'K-6.1.2', 'K-6.1.3', 'A.5.2']);
    expect(idsAusNormbezug('4 bis 10, Anhang A', bekannt)).toEqual([]);
    expect(idsAusNormbezug('A.6.2.2 to A.6.2.4; 7.5', bekannt)).toEqual(['A.6.2.2', 'A.6.2.3', 'A.6.2.4', 'K-7.5']);
  });
});
