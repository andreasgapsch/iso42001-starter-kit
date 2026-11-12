// Neue Szenen für Leitfaden und START: Ablauf (Entscheidungsbaum), Landkarte, Gantt mit zwei Balken je Zeile,
// Risikomatrix mit Beispielpfeil, Titel ausblendbar. Bestehende Ausgaben ohne die neuen Optionen bleiben gleich
// (Schnappschüsse in grafik-darstellung.test.ts).
import { describe, expect, it } from 'vitest';
import { matrixZaehlen } from '../../src/grafik/daten.ts';
import {
  ablaufSzene, ablaufWeg, ablaufZeilen, balkenSzene, ganttSzene, landkarteSzene, paletteCss, risikomatrixSzene, zeitachseSzene, zuSvg,
  type AblaufDaten, type Knoten,
} from '../../src/grafik/svg/index.ts';

const alle = (k: Knoten): Knoten[] => [k, ...(k.k ?? []).flatMap((x) => (typeof x === 'string' ? [] : alle(x)))];
const texte = (k: Knoten): string[] => alle(k).flatMap((x) => (x.k ?? []).filter((y): y is string => typeof y === 'string'));

const BAUM: AblaufDaten = {
  spalten: 3,
  zeilen: 3,
  knoten: [
    { id: 'start', form: 'start', text: 'Start', spalte: 1, zeile: 0 },
    { id: 'frage', form: 'frage', text: 'Eine lange Frage, die umbrechen muss?', spalte: 1, zeile: 1 },
    { id: 'nein', form: 'ergebnis', text: 'Nein-Ergebnis', spalte: 0, zeile: 1, rolle: 'status-neutral' },
    { id: 'ja', form: 'ergebnis', text: 'Ja-Ergebnis', spalte: 2, zeile: 2, rolle: 'kat-2' },
    { id: 'ende', form: 'ende', text: 'Ende', spalte: 0, zeile: 2 },
  ],
  kanten: [
    { von: 'start', vonSeite: 'bottom', nach: 'frage', nachSeite: 'top' },
    { von: 'frage', vonSeite: 'left', nach: 'nein', nachSeite: 'right', text: 'Nein' },
    { von: 'frage', vonSeite: 'bottom', nach: 'ja', nachSeite: 'top', text: 'Ja', weg: 'winkel' },
    { von: 'nein', vonSeite: 'bottom', nach: 'ende', nachSeite: 'top' },
  ],
};

describe('Ablauf', () => {
  const szene = ablaufSzene(BAUM, { titel: 'Baum', beschreibung: 'Ein kleiner Baum' }, { id: 'b', breite: 600 });
  it('role=img mit Titel und Beschreibung, jeder Knoten und jede Kante einmal', () => {
    expect(szene.a?.['role']).toBe('img');
    expect(szene.a?.['aria-labelledby']).toBe('b-titel b-desc');
    expect(alle(szene).filter((k) => k.a?.['data-knoten']).map((k) => k.a!['data-knoten'])).toEqual(BAUM.knoten.map((k) => k.id));
    expect(alle(szene).filter((k) => k.a?.['data-kante'])).toHaveLength(BAUM.kanten.length);
    expect(texte(szene)).toEqual(expect.arrayContaining(['Nein', 'Ja', 'Start', 'Ende']));
  });
  it('Formen nach Art; Rolle kat-n mit farbigem Knoten, Farben nur über Klassen', () => {
    const rects = alle(szene).filter((k) => k.el === 'rect').map((k) => k.a!['class']);
    expect(rects).toEqual(['g-ablauf-rand', 'g-ablauf-frage', 'g-ablauf-ergebnis', 'g-ablauf-ergebnis', 'g-ablauf-rand']);
    expect(alle(szene).filter((k) => k.el === 'circle').map((k) => k.a!['class'])).toEqual(['g-ton-kat-2']);
    expect(zuSvg(szene)).not.toMatch(/#[0-9a-f]{3,6}/i);
    for (const k of ['g-ablauf-frage', 'g-ablauf-kante', 'g-ablauf-pfeil', 'g-feld']) expect(paletteCss('hell')).toContain(`.${k}{`);
  });
  it('lange Texte brechen an Wortgrenzen um', () => {
    const zeilen = ablaufZeilen('Eine lange Frage, die umbrechen muss?', 80, 11);
    expect(zeilen.length).toBeGreaterThan(1);
    expect(zeilen.join(' ')).toBe('Eine lange Frage, die umbrechen muss?');
    expect(ablaufZeilen('a\nb', 500, 11)).toEqual(['a', 'b']);
  });
  it('Wege sind rechtwinklig und weichen Knoten aus', () => {
    const gerade = ablaufWeg({ x: 10, y: 10 }, 'bottom', { x: 10, y: 50 }, 'top');
    expect(gerade).toHaveLength(2);
    const hindernis = { x: 0, y: 40, b: 100, h: 30 };
    const weg = ablaufWeg({ x: 50, y: 20 }, 'bottom', { x: 0, y: 55 }, 'left', [hindernis]);
    for (let i = 1; i < weg.length; i++) expect(weg[i]!.x === weg[i - 1]!.x || weg[i]!.y === weg[i - 1]!.y).toBe(true);
    // Der Knick führt nicht durch das Hindernis (erst nach links, dann hinunter)
    expect(weg.some((p) => p.x < 0)).toBe(true);
  });
  it('deterministisch und Fehler bei Kante ohne Knoten', () => {
    expect(zuSvg(ablaufSzene(BAUM, { titel: 'Baum', beschreibung: 'x' }, { id: 'b' }))).toBe(zuSvg(ablaufSzene(BAUM, { titel: 'Baum', beschreibung: 'x' }, { id: 'b' })));
    expect(() => ablaufSzene({ ...BAUM, kanten: [{ von: 'x', vonSeite: 'top', nach: 'ende', nachSeite: 'top' }] }, { titel: '', beschreibung: '' }, { id: 'f' })).toThrow();
  });
});

describe('Landkarte', () => {
  const t = { titel: 'Karte', beschreibung: 'Felder', spalten: ['A', 'B'], zeilen: ['Oben', 'Unten'], achse: 'verbindlich → freiwillig', markiert: 'im Kit', offen: 'nicht' };
  it('Kacheln in ihren Feldern, voll oder hohl, Legende mit Wort', () => {
    const szene = landkarteSzene(
      [
        { titel: 'Eins', spalte: 0, zeile: 0, markiert: true },
        { titel: 'Zwei', spalte: 1, zeile: 1, markiert: false },
        { titel: 'Drei', spalte: 1, zeile: 1, markiert: true },
      ],
      t,
      { id: 'k', breite: 500 },
    );
    const kacheln = alle(szene).filter((k) => k.a?.['data-eintrag']);
    expect(kacheln.map((k) => k.a!['data-markiert'])).toEqual(['ja', 'nein', 'ja']);
    expect(alle(szene).filter((k) => k.el === 'rect' && k.a?.['class'] === 'g-feld')).toHaveLength(4);
    expect(texte(szene)).toEqual(expect.arrayContaining(['im Kit', 'nicht', 'Oben', 'Unten', 'A', 'B']));
  });
  it('Eintrag ausserhalb der Felder ist ein Fehler', () => {
    expect(() => landkarteSzene([{ titel: 'X', spalte: 2, zeile: 0, markiert: true }], t, { id: 'k' })).toThrow();
  });
});

describe('Erweiterungen bestehender Szenen', () => {
  it('Gantt: zweiter Balken je Zeile und Legende mit Wort', () => {
    const szene = ganttSzene(
      [{ titel: 'Schritt 1', von: 1, bis: 2, zustand: 'erledigt', zweit: { von: 1, bis: 4, zustand: 'offen' } }],
      { titel: 'G', beschreibung: 'x', heute: '', meilensteine: 'M', freigaben: 'F', legende: { erledigt: 'mit', offen: 'ohne' } },
      { id: 'g', wochen: 4, breite: 500 },
    );
    const balken = alle(szene).filter((k) => k.a?.['data-zustand']);
    expect(balken.map((k) => k.a!['data-zustand'])).toEqual(['erledigt', 'offen']);
    expect(Number(balken[1]!.a!['width'])).toBeGreaterThan(Number(balken[0]!.a!['width']));
    expect(texte(szene)).toEqual(expect.arrayContaining(['mit', 'ohne']));
  });
  it('Risikomatrix: Beispielpfeil von Zelle zu Zelle, Titel ausblendbar', () => {
    const m = matrixZaehlen([], [1, 2, 3, 4], [1, 2, 3, 4], { akzeptanzBis: 4, unannehmbarAb: 12 });
    const t = { titel: 'M', achseW: 'W', achseA: 'A', kurzW: 'W', kurzA: 'A', legende: { tief: 't', mittel: 'm', hoch: 'h' }, stufe: { tief: 't', mittel: 'm', hoch: 'h' }, beschreibung: 'x' };
    const szene = risikomatrixSzene(m, t, { id: 'm', mitAnzahl: false, titelSichtbar: false, pfeil: { von: { w: 3, a: 4, text: 'vor' }, nach: { w: 2, a: 2, text: 'nach' } } });
    expect(texte(szene).filter((x) => x === 'M')).toHaveLength(1);
    expect(texte(szene)).toEqual(expect.arrayContaining(['vor', 'nach']));
    expect(alle(szene).find((k) => k.a?.['class'] === 'g-matrix-pfeil')).toBeDefined();
    expect(() => risikomatrixSzene(m, t, { id: 'm', pfeil: { von: { w: 5, a: 1, text: '' }, nach: { w: 1, a: 1, text: '' } } })).toThrow();
    // ohne die neuen Optionen: Titel sichtbar wie bisher
    expect(texte(risikomatrixSzene(m, t, { id: 'm' })).filter((x) => x === 'M')).toHaveLength(2);
  });
  it('Balken und Zeitachse ohne sichtbaren Titel; Titel bleibt in <title>', () => {
    const b = balkenSzene([{ titel: 'Z', werte: { a: 1 } }], [{ schluessel: 'a', text: 'A', ton: 'gut' }], { titel: 'Titel B', beschreibung: 'x' }, { id: 'b', titelSichtbar: false });
    expect(texte(b).filter((x) => x === 'Titel B')).toHaveLength(1);
    const z = zeitachseSzene([{ datum: '2026-08-02', titel: 'F', zustand: 'offen' }], { titel: 'Titel Z', beschreibung: 'x', heute: 'h', datum: (d) => d }, { id: 'z', titelSichtbar: false, textBreite: 100 });
    expect(texte(z).filter((x) => x === 'Titel Z')).toHaveLength(1);
  });
  it('Palette: Schriftgrösse an der Wurzel, damit font-size-Attribute gelten', () => {
    expect(paletteCss('hell')).toContain('.g-svg{font-family:');
    expect(paletteCss('hell')).toMatch(/\.g-svg\{[^}]*font-size:12px/);
    expect(paletteCss('hell')).not.toMatch(/\.g-svg text\{[^}]*font-size/);
  });
});
