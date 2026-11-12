// Simuliertes Stage-1-Audit, vierte Runde: Platzhalter, Formatvorlagen und Formelwerte in Firmendokumenten,
// Verweise «in Erarbeitung», Prüfregeln der Beispiele, Wirksamkeitstexte, neue Register (Meldungen, Nachweise, Stichproben).
import { strFromU8, unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { auftraege } from '../../scripts/beispiele.mts';
import { renderDocx, renderXlsx } from '../../src/generator/index.ts';
import type { DocxDokument, XlsxMappe } from '../../src/generator/ir.ts';
import { pruefeProjekt, type Regel } from '../../src/regeln/pruefungen.ts';
import { erstelleHelfer } from '../../src/vorlagen/kontext.ts';
import { CONTROLS_42001 } from '../fixtures/projekt.ts';
import { firmenIr, FIRMEN, kontext, projekt, SPRACHEN } from './kittexte-hilfen.ts';

/** Alle Zeichenketten eines IR (Texte, Zellen, Lenkung) */
const zeichenketten = (o: unknown): string[] =>
  typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(zeichenketten) : o && typeof o === 'object' ? Object.values(o).flatMap(zeichenketten) : [];

const regeln = (parse(readFileSync('src/regeln/pruefregeln.yaml', 'utf8')) as { regeln: Regel[] }).regeln;

describe('Firmendokumente der Beispiele (Runde 4)', () => {
  for (const firma of FIRMEN) {
    for (const sprache of SPRACHEN) {
      const p = projekt(firma, sprache);
      const liste = auftraege(p, sprache);
      // Je Dokument ein Test: Die Erzeugung aller Dokumente in einem Test brauchte unter Last mehr als das Zeitbudget (AF-048)
      for (const a of liste) {
        it(`${firma} ${sprache} ${a.name}: keine Platzhalter «[[…]]» oder «[Zahl]» aus den Vorlagentexten`, () => {
          const treffer: string[] = [];
          const ir = firmenIr(p, a);
          // Rohtext des IR: Platzhalter als Lauf (platzhalter: true), als «[[…]]» oder in Zellen als «[20]»
          const roh = JSON.stringify(ir);
          if (roh.includes('"platzhalter":true')) treffer.push(`${a.name}: Platzhalter-Lauf`);
          for (const t of zeichenketten(ir)) for (const m of t.matchAll(/\[\[[^\]]*\]\]|\[\d+\]/g)) treffer.push(`${a.name}: ${m[0]}`);
          expect(treffer).toEqual([]);
        });
        it(`${firma} ${sprache} ${a.name}: Word-Dokument ohne Formatvorlagen für Ausfüll-, Vorlagen-, Beispiel- und Ausbauhinweise`, async () => {
          const treffer: string[] = [];
          const ir = firmenIr(p, a);
          if (!('bloecke' in ir)) return;
          const stile = strFromU8(unzipSync(await renderDocx(ir as DocxDokument))['word/styles.xml']!);
          for (const s of ['HinweisAusfuellen', 'HinweisVorlage', 'HinweisBeispiel', 'HinweisAusbau']) if (stile.includes(`w:styleId="${s}"`)) treffer.push(`${a.name}: ${s}`);
          expect(treffer).toEqual([]);
        });
      }
      it(`${firma} ${sprache}: keine Hinweise H42 bis H48 und keine gleichen Wirksamkeitstexte`, () => {
        const befunde = pruefeProjekt(regeln, { projekt: p, heute: '2027-02-15', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27' });
        expect(befunde.map((b) => b.regel).filter((r) => /^H4[2-8]$/.test(r))).toEqual([]);
        const texteJe = new Map<string, number>();
        for (const c of p.controls.filter((x) => x.wirksamkeit?.wie)) {
          const s = `${c.wirksamkeit!.wie}|${c.wirksamkeit!.ergebnis ?? ''}`;
          texteJe.set(s, (texteJe.get(s) ?? 0) + 1);
        }
        expect(Math.max(0, ...texteJe.values())).toBeLessThan(4);
      });
    }
  }
});

/** Formelzellen einer Arbeitsmappe ohne gespeicherten Wert, je Blatt (Zellen mit <f> und ohne <v>) */
async function formelnOhneWert(ir: XlsxMappe): Promise<{ blatt: string; zellen: string[] }[]> {
  const z = unzipSync(await renderXlsx(ir));
  // Blattnamen in der Reihenfolge von workbook.xml (sheet1.xml = erstes Blatt)
  const namen = [...strFromU8(z['xl/workbook.xml']!).matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1]!);
  return Object.entries(z)
    .filter(([n]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .map(([n, d]) => {
      const xml = strFromU8(d);
      const zellen = [...xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*>(.*?)<\/c>/g)].filter((m) => m[2]!.includes('<f>') && !/<v>[^<]+<\/v>/.test(m[2]!)).map((m) => m[1]!);
      return { blatt: namen[Number(/sheet(\d+)/.exec(n)![1]) - 1]!, zellen };
    });
}

describe('Formeln mit gespeichertem Ergebnis (Muster B 22)', () => {
  const p = projekt('muster-maschinenbau', 'de');
  const liste = auftraege(p, 'de');
  for (const name of ['D-11', 'E-02']) {
    it(`${name}: Formelzellen in Datenzeilen haben einen Wert`, async () => {
      const a = liste.find((x) => x.name.startsWith(name))!;
      const ir = a.vorlage(kontext(p, 'firma', a)) as XlsxMappe;
      const ohne = await formelnOhneWert(ir);
      // D-11: Blatt «Auswertung» vollständig; Spalte «Gruppe» der SoA nur in Leerzeilen und Abschnittszeilen ohne ID leer.
      // E-02: Spalte T in den Zeilen der KI-Systeme (6 bis 13).
      if (name === 'D-11') expect(ohne.find((x) => x.blatt === 'Auswertung')!.zellen).toEqual([]);
      else expect(ohne.find((x) => x.blatt === 'Klassifizierung')!.zellen.filter((c) => /^T([6-9]|1[0-3])$/.test(c))).toEqual([]);
    });
  }
});

describe('Verweise auf später freigegebene Dokumente (Muster B 10, Präzision B 15)', () => {
  const p = projekt('muster-maschinenbau', 'de');
  // D-03-EB: freigegeben am 01.09.2026, ohne spätere Bestätigung (D-04-EB ist seit Runde 5 in Version 1.1 vom 02.02.2027)
  const a = auftraege(p, 'de').find((x) => x.name.startsWith('D-03-EB'))!;
  const h = erstelleHelfer(kontext(p, 'firma', a));
  const doc = (text: string): DocxDokument => ({ ...(a.vorlage(kontext(p, 'firma', a)) as DocxDokument), bloecke: [{ typ: 'absatz', text }] });
  const ergebnis = (text: string) => (h.geplanteVerweise(doc(text)).bloecke[0] as { text: string }).text;
  it('in Klammern mit mehreren Verweisen ohne Komma vor dem Zusatz und mit Semikolon zum nächsten Verweis, allein mit Komma', () => {
    expect(ergebnis('Register (D-06-EB, D-07) und Ziele (D-05).')).toBe('Register (D-06-EB in Erarbeitung; D-07 in Erarbeitung) und Ziele (D-05, in Erarbeitung).');
  });
  it('kein Zusatz, wenn das Bezugsdokument zum Dokumentdatum freigegeben war', () => {
    // D-03-EB ist am 01.09.2026 freigegeben, D-03 am selben Tag
    expect(ergebnis('Leitlinie (D-03).')).toBe('Leitlinie (D-03).');
  });
});

describe('Neue Register in den Firmendokumenten', () => {
  it('Muster: D-22-EB mit Blatt «Meldungen», D-26-EB Register mit Blatt «Nachweise», D-20-EB Stichproben mit Ergebnis', () => {
    const p = projekt('muster-maschinenbau', 'de');
    const liste = auftraege(p, 'de');
    const mappe = (name: string) => {
      const a = liste.find((x) => x.name.startsWith(name))!;
      return a.vorlage(kontext(p, 'firma', a)) as XlsxMappe;
    };
    const d22 = mappe('D-22-EB').blaetter.find((b) => b.name === 'Meldungen')!;
    expect(d22.zeilen.length).toBe(p.meldungen?.length ?? 0);
    const nw = mappe('D-26-EB_Dokumentenlenkung_Register').blaetter.find((b) => b.name === 'Nachweise')!;
    expect(nw.zeilen.map((z) => z[0])).toEqual([...p.nachweise].map((n) => n.id).sort((x, y) => x.localeCompare(y, 'de', { numeric: true })));
    const sp = mappe('D-20-EB').blaetter.find((b) => b.name === 'Stichproben')!;
    const mitStichproben = p.audits.find((x) => x.stichproben?.length);
    if (mitStichproben) expect(sp.zeilen.filter((z) => z[5]).length).toBe(mitStichproben.stichproben!.filter((s) => s.ergebnis).length);
  });
});
