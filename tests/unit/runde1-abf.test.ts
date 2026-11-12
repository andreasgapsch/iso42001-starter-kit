// Runde 1, Berichte A, B, F: Regressionstests. Vorlagen stimmig mit den Beispielen, Druck, Sprache, Rechtsangaben.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ablaufMasse, spaltenOhneWortbruch } from '../../src/generator/docx.ts';
import { druckAufteilung, spaltenBreiten } from '../../src/generator/xlsx.ts';
import type { AblaufBlock, DocxDokument, XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { KIT_VERSION, leeresProjekt } from '../../src/model/neu.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { VORLAGEN } from '../../src/vorlagen/index.ts';
import { normStelle, type VorlagenKontext } from '../../src/vorlagen/kontext.ts';

const kataloge = ladeKataloge();
const leer = (sprache: 'de' | 'en'): VorlagenKontext => ({
  u: erstelleUebersetzer(sprache, ladeTexte(sprache)),
  modus: 'leer',
  form: 'dokument',
  projekt: leeresProjekt({ sprache, jetzt: '2026-11-02T00:00:00Z', projektId: 'kit' }),
  kataloge,
  kitVersion: KIT_VERSION,
});
const beispiel = (f: string, s: 'de' | 'en') => JSON.parse(readFileSync(`src/beispiele/${f}.${s}.aims.json`, 'utf8')) as Projekt;
const firma = (p: Projekt): VorlagenKontext => ({ u: erstelleUebersetzer(p.meta.dokumentSprache, ladeTexte(p.meta.dokumentSprache)), modus: 'firma', form: 'dokument', projekt: p, kataloge, kitVersion: KIT_VERSION });

describe('B: Rechtsangaben', () => {
  it('B-01: kein Art. 4 in alter Fassung', () => {
    for (const d of ['src/i18n/de/ergaenzungsblaetter.yaml', 'src/i18n/de/kapitel-gemeinsam.yaml', 'src/i18n/en/ergaenzungsblaetter.yaml', 'src/i18n/en/kapitel-gemeinsam.yaml', 'src/i18n/en/vorlagen/D-17.yaml']) {
      expect(readFileSync(d, 'utf8'), d).not.toMatch(/ausreichende KI-Kompetenz|sufficient (?:level of )?AI literacy/);
    }
  });
  it('B-02, B-03, B-04, B-05: offene Fragen sichtbar, Stand datiert', () => {
    const de = readFileSync('src/i18n/de/stand.yaml', 'utf8');
    expect(de).toContain('Offene Auslegung: Art. 40(1)');
    expect(de).toContain('Entwurf vom 19.05.2026');
    expect(de).toContain('kmu.admin.ch, 23.09.2026');
    // R9 (freigegeben 07.11.2026): Interpellation an parlament.ch belegt und wieder aufgenommen (vorher nicht auffindbar)
    expect(de).toContain('Interpellation 26.3414');
    expect(readFileSync('src/ai-act/stand.yaml', 'utf8')).toMatch(/id: leitlinien-kommission\n\s+status: zu_pruefen/);
    const m = beispiel('muster-maschinenbau', 'de').kiSysteme.find((s) => s.id === 'KI-006')!;
    // P15b (AF-127, R6): Kennzeichnung vor dem 02.08.2026, die offene Auslegung zu Art. 111(4) bleibt sichtbar genannt
    expect(m.aiAct.begruendung).toMatch(/offene Auslegung/i);
    expect(m.aiAct.begruendung).toContain('Art. 111(4)');
    expect(m.aiAct.begruendung).not.toContain('weil der Assistent vor dem 2.8.2026 in Betrieb war');
  });
  it('B-07: MS-2.1 ohne A.8.4', () => {
    expect(readFileSync('src/nist-rmf/subkategorien.yaml', 'utf8')).not.toContain('[A.8.4, A.6.2.4, A.6.2.7, A.4.2]');
  });
});

describe('A: Vorlagen führen allein zur Stage-1-Reife', () => {
  const ctx = leer('de');
  it('A-13: D-27 enthält die drei empfohlenen Basisprozesse', () => {
    const d = VORLAGEN['D-27']!(ctx) as DocxDokument;
    const titel = d.bloecke.filter((b) => b.typ === 'ueberschrift').map((b) => (b as { text: string }).text);
    for (const id of ['PS-02', 'PS-04', 'PS-06']) expect(titel.some((t) => t.includes(id)), id).toBe(true);
    // A-14: Felder Reife, letzte und nächste Durchführung auch leer; A-10: Kriterien
    expect(JSON.stringify(d.bloecke)).toContain('Letzte Durchführung');
    expect(JSON.stringify(d.bloecke)).toContain('Mindestens eine Durchführung mit Aufzeichnung');
  });
  it('A-14: D-21 mit Traktandum Prozesse, D-05 mit Prozesskennzahlen, D-20 mit Umfang', () => {
    expect(JSON.stringify((VORLAGEN['D-21']!(ctx) as DocxDokument).bloecke)).toContain('Stand der Prozesse');
    const d05 = VORLAGEN['D-05']!(ctx) as XlsxMappe;
    expect(d05.blaetter.find((b) => b.zeilen.some((z) => z[0] === 'PR-01'))).toBeTruthy();
    expect(JSON.stringify((VORLAGEN['D-20']!(ctx) as XlsxMappe).blaetter[0]!.zeilen)).toContain('Prozesse im Umfang');
  });
  it('A-15: Kopf mit Prüfvermerk und letzter Änderung auch leer', () => {
    const l = (VORLAGEN['D-03']!(ctx) as DocxDokument).lenkung;
    expect(l.geprueftDurch).toBeTruthy();
    expect(l.aenderung).toBeTruthy();
  });
  it('A-16: Ergänzungsaudit in D-20, D-25 und Leitfaden', () => {
    expect(JSON.stringify(VORLAGEN['D-25']!(ctx))).toContain('Ergänzungsaudit');
    expect(JSON.stringify(VORLAGEN['D-20']!(ctx))).toContain('Ergänzungsaudit');
    expect(readFileSync('src/leitfaden/de/03-zehn-schritte.md', 'utf8')).toContain('Ergänzungsaudit');
  });
  it('F-13: jede leere Vorlage hat Wozu, Was tun, Nachweis', () => {
    for (const s of ['de', 'en'] as const) {
      const c = leer(s);
      for (const [id, v] of Object.entries(VORLAGEN)) {
        const t = JSON.stringify(v(c));
        for (const w of s === 'de' ? ['Wozu:', 'Was tun:', 'Nachweis:'] : ['Why:', 'What to do:', 'Evidence:']) expect(t, `${s} ${id} ${w}`).toContain(w);
      }
    }
  });
});

describe('A: Beispiele in sich stimmig', () => {
  const M = (['de', 'en'] as const).flatMap((s) => ['muster-maschinenbau', 'praezisionsteile'].map((f) => [f, s] as const));
  it.each(M)('A-09, A-12, A-05: %s %s', (f, s) => {
    const p = beispiel(f, s);
    expect(p.massnahmen.filter((m) => m.status === 'erledigt' && !m.nachweise?.length).map((m) => m.id)).toEqual([]);
    for (const x of p.feststellungen) {
      if (!x.wirksamkeit) continue;
      for (const id of x.massnahmen) {
        const m = p.massnahmen.find((y) => y.id === id)!;
        expect(m.status === 'erledigt' && (m.erledigtAm ?? '') <= x.wirksamkeit.am, `${x.id} ${id}`).toBe(true);
      }
    }
  });
  it('A-07: Ergänzungsaudit vor Stage 1 und mit allen Prozessen', () => {
    const p = beispiel('praezisionsteile', 'de');
    const a8 = p.audits.find((a) => a.id === 'AU-008')!;
    expect(a8.geplant! < p.audits.find((a) => a.art === 'extern-stage1')!.geplant!).toBe(true);
    expect(a8.umfangProzesse).toContain('PR-27');
  });
  it('A-01: Protokoll zeigt den Massnahmenstatus am Tag der Bewertung', () => {
    const p = beispiel('praezisionsteile', 'de');
    const t = JSON.stringify((VORLAGEN['D-21']!(firma(p)) as DocxDokument).bloecke);
    expect(t).toMatch(/M-025[^\]]*in Arbeit/);
  });
  it('A-06: Audit vor D-27 nennt keine Prozesse als Vorgabe', () => {
    const p = beispiel('praezisionsteile', 'de');
    const z = (VORLAGEN['D-20']!(firma(p)) as XlsxMappe).blaetter[0]!.zeilen.find((x) => String(x[1]).startsWith('AU-001'))!;
    expect(String(z[2])).not.toContain('alle Prozesse');
  });
});

describe('F: Darstellung', () => {
  it('F-01: Formen wachsen mit dem Text, Rauten nur, wenn der Text passt', () => {
    const b: AblaufBlock = {
      typ: 'ablauf', spalten: 6, zeilen: 2,
      knoten: [
        { id: 'a', form: 'schritt', text: 'Antrag oder Hinweis auf ein neues Werkzeug mit allen Angaben zum Zweck und zu den Daten', spalte: 0, zeile: 0 },
        { id: 'b', form: 'frage', text: 'Gibt die AIMS-Verantwortung das Werkzeug frei, allenfalls mit Auflagen?', spalte: 1, zeile: 1 },
      ],
      kanten: [], alt: { titel: '', beschreibung: '' },
    };
    const m = ablaufMasse(b, () => 90, 10, 22);
    expect(m.rauten).toBe(false);
    expect(m.zeilen[0]!).toBeGreaterThan(56);
  });
  it('F-02: Spalte passt für das längste Wort', () => {
    const b = spaltenOhneWortbruch([500, 8500], ['Nr.'], [['Risikomanagement', 'x']]);
    expect(b[0]!).toBeGreaterThanOrEqual(16 * 95 + 230);
    expect(b.reduce((x, y) => x + y, 0)).toBeGreaterThan(0);
    const c = spaltenBreiten({ name: 'x', spalten: [{ kopf: 'A', breite: 8 }], zeilen: [['Risikomanagement']] });
    expect(c[0]!).toBeGreaterThanOrEqual(16);
  });
  it('F-04: grosse Register verteilen sich auf mehrere Querseiten statt auf 2 pt', () => {
    const a = druckAufteilung(Array.from({ length: 30 }, () => 18));
    expect(a.quer).toBe(true);
    expect(a.seiten).toBeGreaterThan(1);
    expect(a.titelSpalten).toBeGreaterThanOrEqual(0);
    expect(druckAufteilung([10, 20, 30]).seiten).toBe(1);
  });
  it('F-05: EN-Dokumente ohne deutsche Rhythmus-Werte', () => {
    for (const f of ['muster-maschinenbau', 'praezisionsteile']) {
      const p = beispiel(f, 'en');
      for (const id of ['D-04', 'D-12']) expect(JSON.stringify(VORLAGEN[id]!(firma(p))), `${f} ${id}`).not.toMatch(/monatlich|quartalsweise|jaehrlich/);
    }
  });
  it('L-D 13, L-E 1: Normstelle mit Einzahl, Mehrzahl und Control', () => {
    expect(normStelle('5.3', 'de')).toBe('Abschnitt 5.3');
    expect(normStelle('6.1.1 bis 6.1.3, 8.2', 'de')).toBe('Abschnitte 6.1.1 bis 6.1.3, 8.2');
    expect(normStelle('6.1.4, 8.4, A.5.2', 'en')).toBe('clauses 6.1.4, 8.4 and control A.5.2');
  });
});

describe('F-09: Seitenumbruch ohne leere Seite', () => {
  const dok = (bloecke: DocxDokument['bloecke']) => ({ ...(VORLAGEN['D-03']!(leer('de')) as DocxDokument), bloecke });
  it('vor einer Überschrift als Eigenschaft, sonst als Umbruch im eigenen Absatz', async () => {
    const { renderDocx } = await import('../../src/generator/index.ts');
    const { strFromU8, unzipSync } = await import('fflate');
    const xml = async (b: DocxDokument['bloecke']) => strFromU8(unzipSync(await renderDocx(dok(b), { zeitpunkt: new Date('2026-01-01') }))['word/document.xml']!);
    const mit = await xml([{ typ: 'absatz', text: 'a' }, { typ: 'seitenumbruch' }, { typ: 'ueberschrift', ebene: 1, text: 'b' }]);
    expect(mit).toContain('<w:pageBreakBefore/>');
    expect(mit).not.toContain('<w:br w:type="page"/>');
    const ohne = await xml([{ typ: 'seitenumbruch' }, { typ: 'absatz', text: 'b' }]);
    expect(ohne).toContain('<w:br w:type="page"/>');
  });
});
