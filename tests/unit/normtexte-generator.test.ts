// Normtexte im Generator und im Werkzeug: Dokumente nur nach Bestätigung, Quellenvermerk, leere Vorlagen nie mit Normtext,
// Normpaket getrennt vom Projekt (eigene Ablage, Export ohne Dokument-Bestätigung, keine Projektdatei als Normpaket).
// Normtexte stammen aus der SYNTHETISCHEN Norm (tests/fixtures/normpdf.ts).
import { describe, expect, it } from 'vitest';
import { mitTeil, normpaket, normpaketExport, normtexteFuerDokumente, pruefeNormpaket, setzeNormAblage, speichereNormpaket } from '../../src/app/normtexte/zustand.ts';
import { SpeicherAdapter } from '../../src/app/speicher/zwischenspeicher.ts';
import { dokumentSet, erzeugeIr } from '../../src/app/worker/set.ts';
import type { DocxDokument, XlsxMappe } from '../../src/generator/ir.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { erwartet27001, erwartet42001 } from '../../src/normtexte/erwartet.ts';
import { zerlege } from '../../src/normtexte/parser.ts';
import { leeresNormpaket, type Normpaket, type NormTeil, type NormtexteLaufzeit } from '../../src/normtexte/typen.ts';
import { VORLAGEN } from '../../src/vorlagen/index.ts';
import { alsSeiten, synthetischeNorm } from '../fixtures/normpdf.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const kataloge = ladeKataloge();
const texte = { de: ladeTexte('de'), en: ladeTexte('en') };
const E = { '42001': erwartet42001(kataloge), '27001': erwartet27001(kataloge) };
const synth = synthetischeNorm(E['42001'], { norm: '42001', sprache: 'de', national: 'SN EN' });
const r = zerlege(alsSeiten(synth), E);
const teil: NormTeil = { norm: '42001', sprache: 'de', bezeichnung: r.bezeichnung, ausgabe: r.ausgabe, quelle: 'synthetisch.pdf', importiert: '2026-10-22T10:00:00Z', eintraege: r.eintraege };
const synth27 = synthetischeNorm(E['27001'], { norm: '27001', sprache: 'de', national: 'DIN EN', amd: true });
const r27 = zerlege(alsSeiten(synth27), E);
const teil27: NormTeil = { norm: '27001', sprache: 'de', bezeichnung: r27.bezeichnung, ausgabe: r27.ausgabe, amd: r27.amd, quelle: 's27.pdf', importiert: '2026-10-22T10:00:00Z', eintraege: r27.eintraege };
const laufzeit: NormtexteLaufzeit = { teile: [teil, teil27], lizenzgeber: 'Testlizenzgeber', lizenznummer: 'L-0815' };
const TITEL = synth.erwartet['A.2.2']!.titel;
const TEXT = synth.erwartet['A.2.2']!.text;

function ir(id: string, normtexte?: NormtexteLaufzeit, mitIsms = true): DocxDokument | XlsxMappe {
  const p = vollstaendigesProjekt();
  p.meta.mitIsms = mitIsms;
  const { dateien } = dokumentSet(p, kataloge, 'de', [id]);
  const e = dateien.find((d) => d.id === id || d.katalogId === id)!;
  return erzeugeIr(e, p, texte.de, kataloge, 'de', '1.0.0', normtexte);
}
const alsText = (x: unknown) => JSON.stringify(x);

describe('Generator mit und ohne Normtexte', () => {
  it('ohne Normtexte: SoA (D-11) mit eigenen Kurztiteln, ohne Spalte Control-Text, ohne Vermerk', () => {
    const t = alsText(ir('D-11'));
    expect(t).not.toContain(TITEL);
    expect(t).not.toContain('Control-Text (Norm)');
    expect(t).not.toContain('Auszug aus');
  });
  it('mit Normtexten (nach Bestätigung): SoA mit Normtitel, Spalte Control-Text und Quellenvermerk', () => {
    const m = ir('D-11', laufzeit) as XlsxMappe;
    const soa = m.blaetter[0]!;
    expect(soa.spalten[2]!.kopf).toBe('Control-Text (Norm)');
    const zeile = soa.zeilen.find((z) => z[0] === 'A.2.2')!;
    expect(zeile[1]).toBe(TITEL);
    expect(zeile[2]).toBe(TEXT);
    // Spalte «Anwendbar» bleibt hinter dem Text an der richtigen Stelle (Formeln der Auswertung)
    expect(soa.spalten[3]!.typ).toBe('liste');
    const vermerk = alsText(m.hinweisBlock);
    expect(vermerk).toContain('Auszug aus SN EN ISO/IEC 42001:2026 (ISO/IEC 42001:2023), wiedergegeben unter Lizenz von Testlizenzgeber, Lizenz-Nr. L-0815.');
    // Formeln der Auswertung zeigen auf die verschobenen Spalten
    const formel = m.blaetter[1]!.spalten.find((s) => s.typ === 'formel' && s.formel?.includes('COUNTIFS'))!.formel!;
    expect(formel).toContain('$D:$D');
  });
  it('Audit-Checkliste (D-20) und Gap-Analyse (D-00) mit Anforderungstext, Integrationsmatrix (D-23) mit 27001-Titeln und -Text', () => {
    const d20 = alsText(ir('D-20', laufzeit));
    expect(d20).toContain(synth.erwartet['K-6.1.2']!.titel);
    expect(d20).toContain('Anforderungstext (Norm)');
    const d00 = alsText(ir('D-00', laufzeit));
    expect(d00).toContain(synth.erwartet['K-4.1']!.text.split('\n')[0]!.slice(0, 40));
    const d23 = alsText(ir('D-23', laufzeit));
    expect(d23).toContain(synth27.erwartet['27001-5.1']!.titel);
    expect(d23).toContain(synth27.erwartet['27001-5.1']!.text);
    expect(d23).toContain('DIN EN ISO/IEC 27001:2026/Amd 1:2024');
  });
  it('DOCX: Auszug der genannten Abschnitte am Ende statt Verweis, mit Vermerk', () => {
    const d = ir('D-03', laufzeit, false) as DocxDokument;
    const t = alsText(d.bloecke);
    expect(t).toContain('Anforderungen der Norm (Auszug)');
    expect(t).toContain(synth.erwartet['A.2.2']!.text);
    expect(t).toContain('wiedergegeben unter Lizenz von Testlizenzgeber');
    const ohne = alsText((ir('D-03', undefined, false) as DocxDokument).bloecke);
    expect(ohne).not.toContain('Anforderungen der Norm (Auszug)');
  });
  it('leere Vorlagen des Kits bleiben ohne Normtext, auch wenn Normtexte mitgegeben würden', () => {
    const ctx = { u: erstelleUebersetzer('de', texte.de), modus: 'leer' as const, form: 'dokument' as const, projekt: vollstaendigesProjekt(), kataloge, kitVersion: '1.0.0', normtexte: laufzeit };
    for (const id of ['D-11', 'D-03', 'D-20', 'D-23', 'D-00']) {
      const t = alsText(VORLAGEN[id]!(ctx));
      expect(t, id).not.toContain(TITEL);
      expect(t, id).not.toContain('Auszug aus');
    }
  });
});

describe('Bestätigung und Normpaket', () => {
  const paket = (dokumente: boolean): Normpaket => ({ ...leeresNormpaket(), teile: [teil], lizenz: { dokumente, lizenzgeber: 'X', lizenznummer: '' } });
  it('Generator erhält Normtexte nur nach der Bestätigung für Dokumente (Standard aus)', () => {
    expect(leeresNormpaket().lizenz.dokumente).toBe(false);
    expect(normtexteFuerDokumente(paket(false))).toBeUndefined();
    expect(normtexteFuerDokumente(paket(true))?.teile).toHaveLength(1);
    expect(normtexteFuerDokumente({ ...paket(true), teile: [] })).toBeUndefined();
  });
  it('Export: Hinweis, ohne Dokument-Bestätigung; Import prüft das Format und lehnt Projektdateien ab', () => {
    const text = normpaketExport(paket(true), 'Nur innerhalb der Organisation');
    const roh = JSON.parse(text) as Normpaket & { hinweis: string };
    expect(roh.hinweis).toBe('Nur innerhalb der Organisation');
    expect(roh.lizenz.dokumente).toBe(false);
    expect(pruefeNormpaket(roh).teile[0]!.eintraege['A.2.2']!.titel).toBe(TITEL);
    expect(() => pruefeNormpaket(vollstaendigesProjekt())).toThrow();
    expect(() => pruefeNormpaket({ format: 'aims-normpaket', version: 2, teile: [] })).toThrow();
  });
  it('Änderung (nur Amd) ergänzt den vorhandenen Teil derselben Sprache', () => {
    const basis = mitTeil(leeresNormpaket(), { ...teil27, amd: undefined, eintraege: { '27001-K-4.1': { titel: 'T', text: 'Alt' } } });
    const neu = mitTeil(basis, { ...teil27, amd: 'Amd 1:2024', eintraege: { '27001-K-4.1': { titel: 'T', text: '[Amd 1:2024] Zusatz' } } }, true);
    expect(neu.teile).toHaveLength(1);
    expect(neu.teile[0]!.eintraege['27001-K-4.1']!.text).toBe('Alt\n[Amd 1:2024] Zusatz');
    expect(neu.teile[0]!.amd).toBe('Amd 1:2024');
  });
  it('Normpaket liegt in eigener Ablage, nicht im Projekt und nicht im Zwischenspeicher des Projekts', async () => {
    const ablage = new SpeicherAdapter();
    setzeNormAblage(ablage);
    const p = vollstaendigesProjekt();
    const vorher = JSON.stringify(p);
    await speichereNormpaket(paket(true));
    expect(await ablage.schluessel('')).toEqual(['normpaket']);
    expect(normpaket.value.teile).toHaveLength(1);
    expect(JSON.stringify(p)).toBe(vorher);
    expect(Object.keys(p)).not.toContain('normpaket');
    setzeNormAblage(null);
  });
});
