// Grafik für App, Leitfaden und START: Szenen (src/grafik/svg) als SVG-Schnappschüsse, Zählungen der Risikomatrix aus
// src/grafik/daten.ts gegen die Beispiele, eine Zonenregel für App, D-04, D-06 und D-07, Preact-Abbild der Szene.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { matrixZaehlen, risikoMatrix, skalenStufen, stufeAusWert, werteJeStufe, type RisikoMatrix } from '../../src/grafik/daten.ts';
import { zuPreact } from '../../src/grafik/preact/Szene.tsx';
import { mengenStufe } from '../../src/grafik/preact/Diagramme.tsx';
import {
  balkenSzene, etappenSzene, ganttSzene, hantelSzene, kuerze, matrixBeschreibung, matrixZeilen, paletteCss, risikomatrixSzene, rund, schraffur, sparklinePunkte, umbreche,
  sparklineSzene, textBreite, zeitachseSzene, zuSvg, type Knoten, type MatrixTexte,
} from '../../src/grafik/svg/index.ts';
import { funktionMittel } from '../../src/app/logik/nistrmf.ts';
import { risikostufe } from '../../src/regeln/pruefungen.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const REPO = join(import.meta.dirname, '..', '..');
const beispiel = (datei: string) => JSON.parse(readFileSync(join(REPO, 'src/beispiele', datei), 'utf8')) as Projekt;
const SCHNAPPSCHUSS = (name: string) => join(import.meta.dirname, '__snapshots__', 'grafik', name);

const TEXTE: MatrixTexte = {
  titel: 'Risikomatrix vor Behandlung', achseW: 'Wahrscheinlichkeit (pro Jahr)', achseA: 'Auswirkung', kurzW: 'W', kurzA: 'A',
  namenW: { 1: 'selten', 2: 'möglich', 3: 'wahrscheinlich', 4: 'häufig' }, namenA: { 1: 'gering', 2: 'spürbar', 3: 'erheblich', 4: 'schwer' },
  legende: { tief: 'tief: bis 4, angenommen', mittel: 'mittel: 6 bis 9, behandeln', hoch: 'hoch: ab 12, unannehmbar (schraffiert)' },
  stufe: { tief: 'tief', mittel: 'mittel', hoch: 'hoch' }, beschreibung: '',
};

function beschreibe(m: RisikoMatrix): string {
  return matrixBeschreibung(m, TEXTE, { bewertet: (n) => `${n} bewertete Risiken`, zelle: (w, a, wert, s, n) => `W ${w} A ${a} = ${wert} (${s}): ${n}`, keine: 'keine Risiken' });
}

/** Alle Elemente einer Szene (Tiefensuche). */
function elemente(k: Knoten): Knoten[] {
  return [k, ...(k.k ?? []).flatMap((x) => (typeof x === 'string' ? [] : elemente(x)))];
}

describe('Zonenregel: eine Quelle für App, D-04, D-06, D-07', () => {
  const grenzen = [{ akzeptanzBis: 4, unannehmbarAb: 12 }, { akzeptanzBis: 3, unannehmbarAb: 6 }, { akzeptanzBis: 5, unannehmbarAb: 15 }];
  it('stufeAusWert stimmt mit Prüfregeln (D-04), Ampel D-07 und mittlerer Stufe D-06 überein', () => {
    for (const k of grenzen) {
      const p = vollstaendigesProjekt();
      p.organisation.risikokriterien = { ...p.organisation.risikokriterien, ...k };
      for (let wert = 1; wert <= 25; wert++) {
        const s = stufeAusWert(wert, k);
        expect(s, `Prüfregel bei ${wert}`).toBe(risikostufe(p, wert));
        // D-07: ampel { gruenBis: akzeptanzBis, gelbBis: unannehmbarAb - 1 }
        const ampel = wert <= k.akzeptanzBis ? 'tief' : wert <= k.unannehmbarAb - 1 ? 'mittel' : 'hoch';
        expect(s, `D-07 bei ${wert}`).toBe(ampel);
        // D-06: mittlere = v > akzeptanzBis && v < unannehmbarAb
        expect(s === 'mittel', `D-06 bei ${wert}`).toBe(wert > k.akzeptanzBis && wert < k.unannehmbarAb);
      }
    }
  });
  it('die App färbt die Risikoliste nicht mehr selbst (keine zweite Regel in Formular.tsx)', () => {
    const quelle = readFileSync(join(REPO, 'src/app/ansichten/formular/Formular.tsx'), 'utf8');
    expect(quelle).not.toMatch(/unannehmbarAb|akzeptanzBis|var\(--(rot|gelb|gruen)\)/);
  });
});

describe('Risikomatrix: Zählungen', () => {
  for (const datei of ['muster-maschinenbau.de.aims.json', 'praezisionsteile.de.aims.json']) {
    it(`${datei}: Summe der Zellen gleich bewertete Risiken, vor und nach getrennt`, () => {
      const p = beispiel(datei);
      for (const stand of ['vor', 'nach'] as const) {
        const m = risikoMatrix(p, { stand });
        const summe = m.zellen.flat().reduce((a, z) => a + z.anzahl, 0);
        expect(summe).toBe(m.bewertet);
        const gezaehlt = p.risiken.filter((r) => r.art !== 'chance' && r.status !== 'geschlossen');
        expect(m.bewertet + m.unbewertet.length + m.ausserhalb.length).toBe(gezaehlt.length);
        // Darstellung: Zeilen Auswirkung absteigend, Spalten Wahrscheinlichkeit aufsteigend
        const zeilen = matrixZeilen(m);
        expect(zeilen.map((z) => z[0]!.a)).toEqual([...m.a].reverse());
        expect(zeilen[0]!.map((z) => z.w)).toEqual(m.w);
        for (const z of m.zellen.flat()) expect(z.ids).toHaveLength(z.anzahl);
      }
    });
  }
  it('3×3, 4×4 und 5×5 aus den eigenen Skalen', () => {
    for (const n of [3, 4, 5]) {
      const p = vollstaendigesProjekt();
      const skala = Array.from({ length: n }, (_, i) => ({ stufe: i + 1, bezeichnung: `S${i + 1}`, beschreibung: '' }));
      p.organisation.risikokriterien = { ...p.organisation.risikokriterien, wahrscheinlichkeit: skala, auswirkung: skala };
      const m = risikoMatrix(p, { stand: 'vor' });
      expect(m.w).toHaveLength(n);
      expect(m.zellen.flat()).toHaveLength(n * n);
      expect(skalenStufen(p).a).toEqual(skala.map((s) => s.stufe));
    }
  });
  it('Muster: die Beschreibung (desc) nennt jede belegte Zelle', () => {
    const m = risikoMatrix(beispiel('muster-maschinenbau.de.aims.json'), { stand: 'vor' });
    const d = beschreibe(m);
    for (const z of m.zellen.flat().filter((x) => x.anzahl > 0)) expect(d).toContain(`W ${z.w} A ${z.a} = ${z.wert}`);
    expect(d).toContain(`${m.bewertet} bewertete Risiken`);
  });
  it('Legende: mittlere Stufe nur mit erreichbaren Werten (3×3, Grenzen 3 und 6: nur 4)', () => {
    expect(werteJeStufe([1, 2, 3], [1, 2, 3], { akzeptanzBis: 3, unannehmbarAb: 6 }).mittel).toEqual([4]);
  });
});

describe('Szenen als SVG (deterministisch, zugänglich, Farben nur über Klassen)', () => {
  const muster = beispiel('muster-maschinenbau.de.aims.json');
  const vor = risikoMatrix(muster, { stand: 'vor' });
  const leer = matrixZaehlen([], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5], { akzeptanzBis: 4, unannehmbarAb: 12 });
  const szenen: Record<string, () => Knoten> = {
    'risikomatrix-4x4.svg': () => risikomatrixSzene(vor, { ...TEXTE, beschreibung: beschreibe(vor) }, { id: 'rm' }),
    'risikomatrix-5x5-zonen.svg': () => risikomatrixSzene(leer, { ...TEXTE, namenW: undefined, namenA: undefined, beschreibung: 'Zonen der Methode' }, { id: 'rz', mitAnzahl: false }),
    'balken-soa.svg': () =>
      balkenSzene(
        [
          { titel: 'A.2 KI-Leitlinien', werte: { umgesetzt: 2, teilweise: 1, offen: 0, ausgeschlossen: 0 } },
          { titel: 'A.6 Lebenszyklus', werte: { umgesetzt: 5, teilweise: 2, offen: 1, ausgeschlossen: 1 } },
          { titel: 'A.10 Dritte', werte: { umgesetzt: 0, teilweise: 0, offen: 3, ausgeschlossen: 0 }, summe: '0 von 3' },
        ],
        [
          { schluessel: 'umgesetzt', text: 'umgesetzt', ton: 'gut' },
          { schluessel: 'teilweise', text: 'teilweise', ton: 'warnung', muster: true },
          { schluessel: 'offen', text: 'offen', ton: 'info' },
          { schluessel: 'ausgeschlossen', text: 'nicht anwendbar', ton: 'neutral' },
        ],
        { titel: 'Umsetzung je Gruppe', beschreibung: 'A.2: umgesetzt 2, teilweise 1' },
        { id: 'sb', breite: 560 },
      ),
    'sparkline.svg': () => sparklineSzene([88, 91, 90.5, 97.8], 'Verlauf: 88, 91, 90,5, 97,8 %', { soll: 95 })!,
    'gantt.svg': () =>
      ganttSzene(
        [
          { titel: 'Schritt 1', text: 'E0, E1', von: 1, bis: 2, zustand: 'erledigt' },
          { titel: 'Schritt 2', text: 'E2', von: 3, bis: 6, zustand: 'aktiv' },
          { titel: 'Schritt 3', text: 'E3', von: 5, bis: 8, zustand: 'offen' },
        ],
        { titel: 'Fahrplan', beschreibung: 'Drei Schritte', heute: 'heute', meilensteine: 'Meilensteine', freigaben: 'Freigaben' },
        { id: 'gt', wochen: 13, breite: 720, heute: 4.5, marken: [{ woche: 2, text: 'Projektauftrag', art: 'freigabe' }, { woche: 8, text: 'KI-Inventar', art: 'meilenstein' }, { woche: 8, text: 'Leitlinie', art: 'meilenstein' }] },
      ),
    'zeitachse-fristen.svg': () =>
      zeitachseSzene(
        [
          { datum: '2025-02-02', titel: 'Verbote', zustand: 'erledigt' },
          { datum: '2026-08-02', titel: 'Allgemeiner Geltungsbeginn', zustand: 'erledigt' },
          { datum: '2026-12-02', titel: 'Neue Verbote', zustand: 'aktiv' },
          { datum: '2027-12-02', titel: 'Hochrisiko Anhang III', zustand: 'offen' },
        ],
        { titel: 'Fristen', beschreibung: 'Vier Fristen', heute: 'heute', datum: (d) => d.split('-').reverse().join('.') },
        { id: 'za', breite: 720, heute: '2026-10-21' },
      ),
    'hantel-nist.svg': () =>
      hantelSzene(
        [{ titel: 'GOVERN', ist: 1.5, ziel: 2.3 }, { titel: 'MAP', ist: 2, ziel: 2 }, { titel: 'MEASURE', ist: null, ziel: 2 }, { titel: 'MANAGE', ist: null, ziel: null }],
        { titel: 'Ist und Ziel', beschreibung: 'GOVERN Ist 1,5 Ziel 2,3', stufen: ['nicht erreicht', 'teilweise', 'erreicht', 'wirksam'], wert: (z) => `Ist ${z.ist ?? '-'} · Ziel ${z.ziel ?? '-'}` },
        { id: 'ht', breite: 600 },
      ),
    'etappen.svg': () =>
      etappenSzene(
        [{ kuerzel: 'E0', titel: 'Startinterview', zustand: 'erledigt' }, { kuerzel: 'E1', titel: 'Auftrag', zustand: 'erledigt' }, { kuerzel: 'E2', titel: 'Kontext', zustand: 'aktiv' }, { kuerzel: 'E3', titel: 'Leitlinie', zustand: 'offen' }],
        { titel: 'Etappen', beschreibung: 'E0 erledigt, E1 erledigt, E2 in Arbeit, E3 offen' },
        { id: 'et', breite: 600 },
      ),
  };

  for (const [name, bau] of Object.entries(szenen)) {
    it(`${name}: Schnappschuss, zweimal gleich, role=img mit Titel und Beschreibung, keine Farbwerte`, async () => {
      const svg = zuSvg(bau());
      expect(zuSvg(bau())).toBe(svg);
      await expect(`${svg}\n`).toMatchFileSnapshot(SCHNAPPSCHUSS(name));
      const k = bau();
      expect(k.el).toBe('svg');
      expect(k.a?.['role']).toBe('img');
      if (name !== 'sparkline.svg') {
        expect(elemente(k).some((x) => x.el === 'title')).toBe(true);
        expect(elemente(k).some((x) => x.el === 'desc')).toBe(true);
        expect(String(k.a?.['aria-labelledby'])).toMatch(/-titel .*-desc$/);
      } else {
        expect(String(k.a?.['aria-label'])).toContain('97,8');
      }
      // Ohne Stil keine Farbe im Markup: Farben nur über Klassen g-*
      expect(svg).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|\bfill="(?!none)|\bstroke="/i);
      // Keine IDs ausser title/desc mit Präfix (deterministisch, keine Kollision zweier Grafiken)
      for (const m of svg.matchAll(/\sid="([^"]+)"/g)) expect(m[1]).toMatch(/^[a-z]+-(titel|desc)$/);
      // Zahlen auf 0,1 gerundet
      for (const m of svg.matchAll(/="(-?\d+\.\d+)"/g)) expect(m[1]!.split('.')[1]!.length).toBeLessThanOrEqual(1);
    });
  }

  it('Risikomatrix: Zellen mit Wert, Anzahl und Stufe; die höchste Stufe schraffiert', () => {
    const k = risikomatrixSzene(vor, { ...TEXTE, beschreibung: beschreibe(vor) }, { id: 'rm' });
    const zellen = elemente(k).filter((x) => x.el === 'g' && x.a?.['data-w'] !== undefined);
    expect(zellen).toHaveLength(16);
    for (const z of zellen) {
      const w = Number(z.a!['data-w']);
      const a = Number(z.a!['data-a']);
      const zelle = vor.zellen[vor.w.indexOf(w)]![vor.a.indexOf(a)]!;
      const texte = elemente(z).flatMap((x) => (x.el === 'text' ? (x.k as string[]) : []));
      expect(texte[0]).toBe(String(w * a));
      if (zelle.anzahl) expect(texte).toContain(String(zelle.anzahl));
      const schraffiert = elemente(z).some((x) => x.a?.['class'] === 'g-muster-strich');
      expect(schraffiert, `W ${w} A ${a}`).toBe(zelle.stufe === 'hoch');
    }
  });

  it('eigenständige Datei: xmlns und Palette als <style> nach title/desc; dunkle Palette verschieden', () => {
    const svg = zuSvg(szenen['etappen.svg']!(), { stil: true });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg.indexOf('<style>')).toBeGreaterThan(svg.indexOf('</desc>'));
    expect(svg).toContain('.g-knoten-voll{fill:#1c5d94');
    expect(paletteCss('dunkel')).not.toBe(paletteCss('hell'));
    expect(() => zuSvg({ el: 'g' })).toThrow();
  });

  it('Text wird maskiert', () => {
    const svg = zuSvg(etappenSzene([{ kuerzel: 'E<1>', titel: 'A & B "C"', zustand: 'offen' }], { titel: 'x', beschreibung: 'y' }, { id: 'm' }));
    expect(svg).toContain('E&lt;1&gt;');
    expect(svg).toContain('A &amp; B &quot;C&quot;');
  });
});

describe('Bausteine', () => {
  it('Schraffur bleibt im Rechteck', () => {
    for (const l of schraffur(10, 20, 30, 12, 5)) {
      for (const [x, y] of [[l.a!['x1'], l.a!['y1']], [l.a!['x2'], l.a!['y2']]] as [number, number][]) {
        expect(x).toBeGreaterThanOrEqual(10);
        expect(x).toBeLessThanOrEqual(40);
        expect(y).toBeGreaterThanOrEqual(20);
        expect(y).toBeLessThanOrEqual(32);
      }
    }
  });
  it('Sparkline: erster Punkt links, letzter rechts, höchster Wert oben', () => {
    const p = sparklinePunkte([1, 3, 2]);
    expect(p[0]!.x).toBe(4);
    expect(p[2]!.x).toBe(116);
    expect(Math.min(...p.map((q) => q.y))).toBe(p[1]!.y);
    expect(sparklineSzene([1], 'x')).toBeNull();
  });
  it('rund, kuerze, textBreite', () => {
    expect(rund(1.26)).toBe(1.3);
    expect(Object.is(rund(-0.01), 0)).toBe(true);
    expect(kuerze('Folgenabschätzungen und Wirkung', 60)).toMatch(/…$/);
    expect(textBreite('MMM')).toBeGreaterThan(textBreite('iii'));
  });
  it('Gantt: lange Titel brechen um statt gekürzt zu werden (Leitfaden Kapitel 4, START)', () => {
    const lang = '7 Controls, Erklärung zur Anwendbarkeit, Freigabe';
    expect(umbreche(lang, 220).join(' ')).toBe(lang);
    expect(umbreche(lang, 220).length).toBe(2);
    const svg = zuSvg(ganttSzene([{ titel: lang, von: 1, bis: 2, zustand: 'erledigt' }, { titel: '8 Umsetzen', von: 3, bis: 4, zustand: 'offen' }],
      { titel: 'F', beschreibung: 'F', heute: '', meilensteine: 'M', freigaben: 'F' }, { id: 'gu', wochen: 4, breite: 600 }));
    expect(svg).not.toContain('…');
    expect(svg).toContain('>7 Controls, Erklärung zur<');
    expect(svg).toContain('>Anwendbarkeit, Freigabe<');
  });
  it('Mengenfarbe: 0 ohne Wert, 5 beim Höchstwert', () => {
    expect(mengenStufe(0, 6)).toBe(0);
    expect(mengenStufe(6, 6)).toBe(5);
    expect(mengenStufe(1, 6)).toBe(1);
    expect(mengenStufe(3, 6)).toBe(3);
  });
  it('Preact-Abbild: gleiche Elemente und Attribute wie die SVG-Zeichenkette', () => {
    const k = etappenSzene([{ kuerzel: 'E0', titel: 'Start', zustand: 'aktiv' }], { titel: 'T', beschreibung: 'D' }, { id: 'p' });
    const v = zuPreact(k) as unknown as { type: string; props: Record<string, unknown> & { children: unknown[] } };
    expect(v.type).toBe('svg');
    expect(v.props['role']).toBe('img');
    expect(v.props['viewBox']).toBe(k.a!['viewBox']);
    expect((v.props.children as { type: string }[]).map((c) => c.type)).toEqual(k.k!.map((c) => (typeof c === 'string' ? undefined : c.el)));
  });
  it('NIST: Mittel je Funktion aus dem Profil, null ohne Angaben', () => {
    const p = vollstaendigesProjekt();
    const sub = [{ id: 'GV-1.1', funktion: 'govern' }, { id: 'GV-1.2', funktion: 'govern' }, { id: 'MP-1.1', funktion: 'map' }] as never[];
    p.nistProfil = { 'GV-1.1': { ist: 1, ziel: 3 }, 'GV-1.2': { ist: 2 } };
    expect(funktionMittel(p, sub, 'govern')).toEqual({ ist: 1.5, ziel: 3 });
    expect(funktionMittel(p, sub, 'map')).toEqual({ ist: null, ziel: null });
  });
});
