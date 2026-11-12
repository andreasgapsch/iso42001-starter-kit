// Grafiken in den Vorlagen: Risikomatrix in D-06 und D-07 (Blatt mit COUNTIFS), Lagebild in D-21, Fahrplan in D-25,
// Abläufe in D-02, D-08 und D-24, bedingte Formate in D-00, D-11, N-01 und D-20. Grafiken stehen als Anlage am Ende
// (Seitenvorgabe 4 Seiten Haupttext), Zählungen in Dokumenten gleich den Aggregationen in src/grafik/daten.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AblaufBlock, Block, DiagrammBlock, DocxDokument, MatrixBlock, XlsxMappe } from '../../src/generator/ir.ts';
import { risikoMatrix, stufeAusWert } from '../../src/grafik/daten.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt, Sprache } from '../../src/model/typen.ts';
import { d00 } from '../../src/vorlagen/D-00.ts';
import { d02 } from '../../src/vorlagen/D-02.ts';
import { d06 } from '../../src/vorlagen/D-06.ts';
import { d07 } from '../../src/vorlagen/D-07.ts';
import { d08 } from '../../src/vorlagen/D-08.ts';
import { d11 } from '../../src/vorlagen/D-11.ts';
import { d20 } from '../../src/vorlagen/D-20.ts';
import { d21 } from '../../src/vorlagen/D-21.ts';
import { d24 } from '../../src/vorlagen/D-24.ts';
import { d25 } from '../../src/vorlagen/D-25.ts';
import { n01 } from '../../src/vorlagen/N-01.ts';
import type { Form, Modus, VorlagenKontext } from '../../src/vorlagen/kontext.ts';

const kataloge = ladeKataloge();
const uebersetzer = { de: erstelleUebersetzer('de', ladeTexte('de')), en: erstelleUebersetzer('en', ladeTexte('en')) };
const beispiel = (firma: string, sprache: Sprache = 'de'): Projekt => JSON.parse(readFileSync(`src/beispiele/${firma}.${sprache}.aims.json`, 'utf8')) as Projekt;
const ctx = (projekt: Projekt, modus: Modus = 'firma', form: Form = 'dokument', sprache: Sprache = 'de'): VorlagenKontext => ({
  u: uebersetzer[sprache], modus, form, projekt, kataloge, kitVersion: 'test',
});
const FIRMEN = ['muster-maschinenbau', 'praezisionsteile'] as const;
const art = <T extends Block['typ']>(d: DocxDokument, typ: T) => d.bloecke.filter((b): b is Extract<Block, { typ: T }> => b.typ === typ);
/** Index der ersten Anlage (Überschrift «Anlage X:» bzw. «Appendix X:») */
const anlage = (d: DocxDokument) => d.bloecke.findIndex((b) => b.typ === 'ueberschrift' && /^(?:Anlage|Appendix) [A-Z]:/.test(b.text));

describe('D-06: Risikomatrix mit den eigenen Skalen und Grenzen', () => {
  it.each(FIRMEN)('%s: Zellen tragen Stufe und Wert W×A, Zonen nach den Risikokriterien', (firma) => {
    const p = beispiel(firma);
    const form: Form = p.meta.mitIsms ? 'ergaenzungsblatt' : 'dokument';
    const [m] = art(d06(ctx(p, 'firma', form)), 'matrix');
    expect(m).toBeDefined();
    const kr = p.organisation.risikokriterien;
    const w = kr.wahrscheinlichkeit.map((s) => s.stufe).sort((a, b) => a - b);
    const a = kr.auswirkung.map((s) => s.stufe).sort((x, y) => y - x);
    expect(m!.spalten).toHaveLength(w.length);
    expect(m!.zeilen).toHaveLength(a.length);
    m!.zeilen.forEach((z, i) =>
      z.zellen.forEach((c, j) => {
        const wert = w[j]! * a[i]!;
        expect(c.rolle).toBe(`risiko-${stufeAusWert(wert, kr)}`);
        expect(c.zeilen[0]).toMatch(new RegExp(` ${wert}$`));
      }),
    );
    expect(m!.legende!.map((l) => l.rolle)).toContain('risiko-hoch');
  });

  it('leere Vorlage: Vorschlag 4×4 ohne Anzahl, auch englisch', () => {
    for (const sprache of ['de', 'en'] as const) {
      const [m] = art(d06(ctx(beispiel('praezisionsteile', sprache), 'leer', 'dokument', sprache)), 'matrix');
      expect(m!.zeilen).toHaveLength(4);
      expect(m!.zeilen.every((z) => z.zellen.every((c) => c.zeilen.length === 1))).toBe(true);
    }
  });
});

describe('D-07: Blatt «Risikomatrix» und Ampel auf beiden Risikowerten', () => {
  it.each(FIRMEN)('%s: Zählung je Zelle gleich der Aggregation, Bezüge auf W/A vor und nach', (firma) => {
    const p = beispiel(firma);
    const mappe = d07(ctx(p));
    const register = mappe.blaetter[0]!;
    const blatt = mappe.blaetter.find((b) => b.matrizen?.length)!;
    expect(blatt.name).toBe(uebersetzer.de.t('vorlagen.grafik.matrix.xlsx_titel'));
    const [vor, nach] = blatt.matrizen!;
    for (const [m, stand] of [[vor!, 'vor'], [nach!, 'nach']] as const) {
      const js = risikoMatrix(p, { stand });
      // Zeilen A absteigend, Spalten W aufsteigend
      m.zeilen.forEach((z, i) => m.spalten.forEach((s, j) => expect(m.ergebnisse[i]![j], `${stand} W${s.wert} A${z.wert}`).toBe(js.zellen[js.w.indexOf(s.wert)]![js.a.indexOf(z.wert)]!.anzahl)));
      expect(m.quelle.blatt).toBe(register.name);
      expect(m.zonen).toMatchObject({ tiefBis: p.organisation.risikokriterien.akzeptanzBis, hochAb: p.organisation.risikokriterien.unannehmbarAb });
    }
    // W/A vor Behandlung: Spalten K/L, nach Behandlung R/S; Art und Status als Bedingung
    const kopf = (i: number) => register.spalten[i]!.kopf;
    expect([vor!.quelle.spaltenSpalte, vor!.quelle.zeilenSpalte, nach!.quelle.spaltenSpalte, nach!.quelle.zeilenSpalte]).toEqual([10, 11, 17, 18]);
    expect(kopf(10)).toMatch(/^W/);
    expect(kopf(18)).toMatch(/^A/);
    expect(vor!.quelle.bedingungen!.map((b) => kopf(b.spalte))).toEqual([kopf(1), kopf(22)]);
    expect(register.ampel).toEqual([
      expect.objectContaining({ spalte: 12, palette: 'risiko' }),
      expect.objectContaining({ spalte: 19, palette: 'risiko' }),
    ]);
  });

  it('leere Vorlage: Matrix mit Formeln ohne Risiken', () => {
    const blatt = d07(ctx(beispiel('praezisionsteile'), 'leer')).blaetter.find((b) => b.matrizen?.length)!;
    expect(blatt.matrizen!.flatMap((m) => m.ergebnisse.flat()).every((n) => n === 0)).toBe(true);
  });
});

describe('Lagebild D-21 und Fahrplan D-25 als Anlage', () => {
  it.each(FIRMEN)('%s D-21: Matrix vor und nach, SoA-Balken, Massnahmen und Kennzahlen in der Anlage', (firma) => {
    const p = beispiel(firma);
    const d = d21(ctx(p, 'firma', p.meta.mitIsms ? 'ergaenzungsblatt' : 'dokument'));
    const i = anlage(d);
    expect(i).toBeGreaterThan(0);
    expect(d.bloecke[i - 1]!.typ).toBe('seitenumbruch');
    const anhang = d.bloecke.slice(i);
    expect(d.bloecke.slice(0, i).some((b) => b.typ === 'matrix' || b.typ === 'diagramm')).toBe(false);
    const matrizen = anhang.filter((b): b is MatrixBlock => b.typ === 'matrix');
    expect(matrizen).toHaveLength(2);
    const diagramme = anhang.filter((b): b is DiagrammBlock => b.typ === 'diagramm');
    expect(diagramme.map((x) => x.art)).toEqual(expect.arrayContaining(['stapel', 'balken']));
    if (firma === 'muster-maschinenbau') expect(diagramme.filter((x) => x.art === 'linie').length).toBeGreaterThan(0);
    for (const x of diagramme) {
      for (const r of x.reihen) expect(r.werte).toHaveLength(x.kategorien.length);
      expect(x.alt.beschreibung.length).toBeGreaterThan(20);
    }
    // Summe der Anzahl in der Matrix vor Behandlung = Aggregation
    const js = risikoMatrix(p, { stand: 'vor' });
    const zahlen = matrizen[0]!.zeilen.flatMap((z) => z.zellen.map((c) => String(c.zeilen[1] ?? '')));
    expect(zahlen.reduce((s, t) => s + (Number(/^(\d+)/.exec(t)?.[1]) || 0), 0)).toBe(js.bewertet);
  });

  it('D-21 leere Vorlage: Matrix mit den Stufen in der Anlage', () => {
    const d = d21(ctx(beispiel('praezisionsteile'), 'leer'));
    expect(art(d, 'matrix')).toHaveLength(1);
    expect(anlage(d)).toBeGreaterThan(0);
  });

  it.each(FIRMEN)('%s D-25: Zeitraster mit Terminen und Stand, Fortschritt der Controls', (firma) => {
    const d = d25(ctx(beispiel(firma)));
    const [m] = art(d, 'matrix');
    expect(m!.zeilen).toHaveLength(6);
    expect(m!.spalten.every((s) => /^\d{4}$/.test(String(s)))).toBe(true);
    // Jeder Meilenstein steht in genau einer Spalte
    for (const z of m!.zeilen) expect(z.zellen.filter((c) => c.rolle !== 'leer')).toHaveLength(1);
    expect(art(d, 'diagramm')).toHaveLength(1);
    expect(d.bloecke.indexOf(m!)).toBeGreaterThan(anlage(d));
    const leer = art(d25(ctx(beispiel(firma), 'leer')), 'matrix')[0]!;
    expect(leer.spalten.map(String)).toEqual(['Jahr 1', 'Jahr 2', 'Jahr 3', 'Jahr 4']);
  });
});

describe('Abläufe D-02, D-08, D-24 aus Formen in der Anlage', () => {
  const pruefen = (b: AblaufBlock) => {
    const ids = new Set(b.knoten.map((k) => k.id));
    expect(ids.size).toBe(b.knoten.length);
    for (const k of b.kanten) {
      expect(ids.has(k.von), k.von).toBe(true);
      expect(ids.has(k.nach), k.nach).toBe(true);
      expect(['top', 'right', 'bottom', 'left']).toContain(k.vonSeite);
      expect(['top', 'right', 'bottom', 'left']).toContain(k.nachSeite);
    }
    // Knoten im Raster und ohne Überlappung
    const belegt = new Set<string>();
    for (const k of b.knoten) {
      expect(k.spalte + (k.breite ?? 1)).toBeLessThanOrEqual(b.spalten);
      expect(k.zeile + (k.hoehe ?? 1)).toBeLessThanOrEqual(b.zeilen);
      for (let s = k.spalte; s < k.spalte + (k.breite ?? 1); s++)
        for (let z = k.zeile; z < k.zeile + (k.hoehe ?? 1); z++) {
          expect(belegt.has(`${s}/${z}`), `${k.id} ${s}/${z}`).toBe(false);
          belegt.add(`${s}/${z}`);
        }
    }
    expect(b.alt.beschreibung.length).toBeGreaterThan(40);
  };

  it.each([
    ['D-02', d02],
    ['D-08', d08],
    ['D-24', d24],
  ] as const)('%s: Ablauf in der Anlage, Verweis im Text, gültiges Raster (DE, EN, leer)', (_id, v) => {
    for (const sprache of ['de', 'en'] as const) {
      for (const modus of ['firma', 'leer'] as const) {
        const d = v(ctx(beispiel('praezisionsteile', sprache), modus, 'dokument', sprache)) as DocxDokument;
        const [b] = art(d, 'ablauf');
        expect(b, `${sprache} ${modus}`).toBeDefined();
        pruefen(b!);
        expect(d.bloecke.indexOf(b!)).toBeGreaterThan(anlage(d));
        expect(JSON.stringify(d.bloecke.slice(0, anlage(d)))).toContain(b!.alt.titel);
      }
    }
  });

  it('D-02 mit ISMS: Landkarte aus dem Prozesskatalog, gemeinsam geführte Prozesse markiert, Tabelle mit IDs im Pfad der Firma', () => {
    const p = beispiel('muster-maschinenbau');
    const d = d02(ctx(p));
    const [b] = art(d, 'ablauf');
    const risiko = b!.knoten.find((k) => k.text.startsWith('PR-08 '))!;
    expect(risiko.text).toContain('mit ISMS');
    expect(risiko.rolle).toBe('kat-3');
    // Nur-AIMS-Prozesse ohne Markierung, Gruppenköpfe links
    expect(b!.knoten.find((k) => k.text.startsWith('PR-09 '))!.rolle).toBe('status-info');
    // Gruppenköpfe in Spalte 1 (Spalte 0 trägt den Rückweg), Reihenfolge des Regelkreises, Pfeile der Wechselwirkungen
    expect(b!.knoten.filter((k) => k.id.startsWith('gruppe-')).map((k) => k.spalte)).toEqual([1, 1, 1, 1]);
    expect(b!.knoten.filter((k) => k.id.startsWith('gruppe-')).map((k) => k.id)).toEqual(['gruppe-fuehrung', 'gruppe-kern', 'gruppe-bewertung', 'gruppe-unterstuetzung']);
    expect(b!.kanten.map((k) => `${k.von}>${k.nach}`)).toEqual(['gruppe-fuehrung>gruppe-kern', 'gruppe-kern>gruppe-bewertung', 'gruppe-bewertung>gruppe-fuehrung', 'gruppe-unterstuetzung>gruppe-bewertung']);
    expect(b!.alt.beschreibung).toContain('Bewertung und Verbesserung');
    expect(b!.alt.beschreibung).not.toContain('Prüfen und verbessern');
    expect(b!.knoten.filter((k) => k.rolle === 'kat-3').length).toBeGreaterThan(3);
    // Keine feste Zahl von Prozessen mehr: alle anwendbaren AIMS-Prozesse des Katalogs
    expect(b!.knoten.filter((k) => /^P[RS]-\d\d$/.test(k.id)).length).toBeGreaterThanOrEqual(26);
    const [tabelle] = art(d, 'tabelle').filter((x) => x.kopf[0] === 'Prozess');
    expect(JSON.stringify(tabelle!.zeilen)).toContain('D-06-EB');
  });
});

describe('Bedingte Formate in D-00, D-11, N-01, D-20', () => {
  const formate = (m: XlsxMappe) => m.blaetter.flatMap((b) => (b.formate ?? []).map((f) => `${b.name}:${f.art}:${f.spalte}`));
  it('Reifegrad, Auswertung, Profil Ist/Ziel und Ergebnisse', () => {
    const p = beispiel('muster-maschinenbau');
    expect(formate(d00(ctx(p)))).toEqual(expect.arrayContaining([expect.stringMatching(/:datenbalken:4$/), expect.stringMatching(/:datenbalken:5$/), expect.stringMatching(/:text:6$/), expect.stringMatching(/:farbskala:0$/)]));
    expect(formate(d11(ctx(p)))).toEqual(expect.arrayContaining([expect.stringMatching(/:text:5$/), expect.stringMatching(/:datenbalken:5$/)]));
    expect(formate(n01(ctx(p)))).toEqual(expect.arrayContaining([expect.stringMatching(/:stufen:11$/), expect.stringMatching(/:datenbalken:3$/), expect.stringMatching(/:datenbalken:4$/)]));
    const d20f = formate(d20(ctx(p, 'firma', 'ergaenzungsblatt')));
    expect(d20f.filter((f) => f.includes(':text:'))).toHaveLength(3);
  });

  it('Textregeln nennen genau die Werte der Auswahllisten', () => {
    const m = d20(ctx(beispiel('praezisionsteile')));
    for (const b of m.blaetter) {
      for (const f of b.formate ?? []) {
        if (f.art !== 'text') continue;
        const liste = b.spalten[f.spalte]!.liste!;
        expect(f.regeln.map((r) => r.text)).toEqual(liste);
      }
    }
  });
});
