// Reine Aggregationen für App und Dokumente (src/grafik/daten.ts): Risikostufe, Matrix vor und nach Behandlung,
// SoA je Gruppe, Massnahmen nach Fälligkeit, Verteilungen, Kennzahlverlauf.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  faelligkeit,
  inventarVerteilung,
  kennzahlVerlauf,
  kennzahlVerlaeufe,
  massnahmenNachFaelligkeit,
  matrixZaehlen,
  risikoMatrix,
  risikoStufe,
  soaJeGruppe,
  sollAusText,
  stufeAusWert,
  werteJeStufe,
  zahlAusText,
} from '../../src/grafik/daten.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Massnahme, Projekt, Risiko } from '../../src/model/typen.ts';
import { risikostufe } from '../../src/regeln/pruefungen.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const kataloge = ladeKataloge();
const beispiel = (firma: string): Projekt => JSON.parse(readFileSync(`src/beispiele/${firma}.de.aims.json`, 'utf8')) as Projekt;
const risiko = (id: string, w: number | null, a: number | null, wNach: number | null = null, aNach: number | null = null, teil: Partial<Risiko> = {}): Risiko => ({
  id, art: 'risiko', titel: id, beschreibung: '', quelle: 'daten', ebenen: [], ursache: '', folge: '', bestehendeMassnahmen: '',
  w, a, wNach, aNach, controls: [], massnahmen: [], status: 'offen', ...teil,
});

describe('Risikostufe: eine Regel für App, Prüfregeln, D-06 und D-07', () => {
  const grenzen = [
    { akzeptanzBis: 4, unannehmbarAb: 12 },
    { akzeptanzBis: 3, unannehmbarAb: 6 },
    { akzeptanzBis: 6, unannehmbarAb: 15 },
  ];
  it.each(grenzen)('Grenzen %o: gleich wie Prüfregel und Ampel in D-07 für alle Werte 1 bis 25', (k) => {
    const p = vollstaendigesProjekt();
    p.organisation.risikokriterien = { ...p.organisation.risikokriterien, ...k };
    for (let wert = 1; wert <= 25; wert++) {
      expect(stufeAusWert(wert, k), String(wert)).toBe(risikostufe(p, wert));
      // Ampel D-07: gruenBis = akzeptanzBis, gelbBis = unannehmbarAb - 1 (ganze Zahlen)
      const ampel = wert <= k.akzeptanzBis ? 'tief' : wert <= k.unannehmbarAb - 1 ? 'mittel' : 'hoch';
      expect(stufeAusWert(wert, k), String(wert)).toBe(ampel);
    }
  });

  it('Grenzfälle und fehlende Werte', () => {
    const k = { akzeptanzBis: 4, unannehmbarAb: 12 };
    expect(risikoStufe(2, 2, k)).toBe('tief');
    expect(risikoStufe(1, 5, k)).toBe('mittel');
    expect(risikoStufe(3, 4, k)).toBe('hoch');
    expect(risikoStufe(null, 4, k)).toBeNull();
    expect(risikoStufe(3, undefined, k)).toBeNull();
  });

  it('erreichbare Werte je Stufe (D-06: mittlere Stufe nur mit erreichbaren Werten)', () => {
    expect(werteJeStufe([1, 2, 3], [1, 2, 3], { akzeptanzBis: 3, unannehmbarAb: 6 })).toEqual({ tief: [1, 2, 3], mittel: [4], hoch: [6, 9] });
    expect(werteJeStufe([1, 2, 3, 4], [1, 2, 3, 4], { akzeptanzBis: 4, unannehmbarAb: 12 }).mittel).toEqual([6, 8, 9]);
  });
});

describe('Risikomatrix', () => {
  const k = { akzeptanzBis: 4, unannehmbarAb: 12 };
  it.each([3, 4, 5])('%ix%i: Summe der Zellen gleich Anzahl bewerteter Risiken, Zonen aus W×A', (n) => {
    const stufen = Array.from({ length: n }, (_, i) => i + 1);
    const risiken = [risiko('R-1', 1, 1, 1, 1), risiko('R-2', n, n, 1, 2), risiko('R-3', 2, n), risiko('R-4', null, 2), risiko('R-5', 9, 9)];
    const m = matrixZaehlen(risiken, stufen, stufen, k, 'vor');
    expect(m.zellen).toHaveLength(n);
    expect(m.zellen.flat().reduce((s, z) => s + z.anzahl, 0)).toBe(m.bewertet);
    expect(m.bewertet).toBe(3);
    expect(m.unbewertet).toEqual(['R-4']);
    expect(m.ausserhalb).toEqual(['R-5']);
    for (const z of m.zellen.flat()) expect(z.stufe).toBe(stufeAusWert(z.w * z.a, k));
    const nach = matrixZaehlen(risiken, stufen, stufen, k, 'nach');
    expect(nach.bewertet).toBe(2);
    expect(nach.unbewertet).toEqual(['R-3', 'R-4', 'R-5']);
    expect(nach.zellen[0]![1]!.ids).toEqual(['R-2']);
  });

  it('ohne Chancen und geschlossene Risiken, auf Wunsch mit', () => {
    const p = vollstaendigesProjekt();
    p.risiken = [risiko('R-1', 1, 1), risiko('R-2', 1, 1, null, null, { art: 'chance' }), risiko('R-3', 1, 1, null, null, { status: 'geschlossen' })];
    expect(risikoMatrix(p, { stand: 'vor' }).bewertet).toBe(1);
    expect(risikoMatrix(p, { stand: 'vor', mitChancen: true, mitGeschlossenen: true }).bewertet).toBe(3);
  });

  it.each(['muster-maschinenbau', 'praezisionsteile'])('%s: vor und nach Behandlung zählen alle offenen Risiken mit Werten', (firma) => {
    const p = beispiel(firma);
    const zaehlbar = p.risiken.filter((r) => r.art !== 'chance' && r.status !== 'geschlossen');
    for (const stand of ['vor', 'nach'] as const) {
      const m = risikoMatrix(p, { stand });
      const mitWert = zaehlbar.filter((r) => (stand === 'vor' ? r.w !== null && r.a !== null : r.wNach !== null && r.aNach !== null));
      expect(m.bewertet + m.ausserhalb.length, stand).toBe(mitWert.length);
      expect(m.jeStufe.tief + m.jeStufe.mittel + m.jeStufe.hoch).toBe(m.bewertet);
    }
  });
});

describe('SoA je Gruppe', () => {
  it('zählt jede Kategorie, offene Massnahme macht «umgesetzt» zu «teilweise»', () => {
    const p = vollstaendigesProjekt();
    const gruppen = kataloge.controls42001.gruppen;
    const ids = gruppen[0]!.controls.map((c) => c.id);
    p.controls = p.controls.filter((c) => !ids.includes(c.id));
    p.controls.push(
      { ...p.controls[0]!, id: ids[0]!, anwendbar: 'ja', status: 'umgesetzt', umsetzung: 'siehe M-100' },
      ...(ids[1] ? [{ ...p.controls[0]!, id: ids[1], anwendbar: 'nein' as const, status: 'offen' as const, umsetzung: '' }] : []),
    );
    p.massnahmen = [{ id: 'M-100', titel: 'x', beschreibung: '', status: 'in-arbeit', prioritaet: 'hoch', herkunft: { art: 'sonstige' } }];
    const g = soaJeGruppe(p, gruppen)[0]!;
    expect(g.gesamt).toBe(ids.length);
    expect(g.anzahl.teilweise).toBe(1);
    expect(g.anzahl.ausgeschlossen).toBe(ids[1] ? 1 : 0);
    expect(Object.values(g.anzahl).reduce((a, b) => a + b, 0)).toBe(g.gesamt);
    expect(g.anteilUmgesetzt).toBe(0);
  });
});

describe('Massnahmen nach Fälligkeit', () => {
  const m = (id: string, status: Massnahme['status'], termin?: string, extra: Partial<Massnahme> = {}): Massnahme => ({
    id, titel: id, beschreibung: '', status, prioritaet: 'mittel', herkunft: { art: 'sonstige' }, ...(termin ? { termin } : {}), ...extra,
  });
  it('überfällig, bald (30 Tage), später, ohne Termin, erledigt erst ab dem Abschlussdatum', () => {
    expect(faelligkeit(m('a', 'offen', '2026-10-01'), '2026-10-21')).toBe('ueberfaellig');
    expect(faelligkeit(m('b', 'in-arbeit', '2026-11-20'), '2026-10-21')).toBe('bald');
    expect(faelligkeit(m('c', 'offen', '2026-11-21'), '2026-10-21')).toBe('spaeter');
    expect(faelligkeit(m('d', 'offen'), '2026-10-21')).toBe('ohneTermin');
    expect(faelligkeit(m('e', 'erledigt', '2026-09-01', { erledigtAm: '2026-12-01' }), '2026-10-21')).toBe('ueberfaellig');
    expect(faelligkeit(m('f', 'erledigt', '2026-09-01', { erledigtAm: '2026-09-01' }), '2026-10-21')).toBe('erledigt');
    const gruppen = massnahmenNachFaelligkeit([m('b', 'offen', '2026-10-01'), m('a', 'offen', '2026-09-01'), m('z', 'offen', '2026-09-01', { erfasstAm: '2026-12-01' })], '2026-10-21');
    expect(gruppen.find((x) => x.art === 'ueberfaellig')!.ids).toEqual(['a', 'b']);
  });
});

describe('Verteilungen und Kennzahlen', () => {
  it('Inventar nach Typ, Status, Lebenszyklus in Reihenfolge der Listen', () => {
    const v = inventarVerteilung(beispiel('muster-maschinenbau').kiSysteme);
    expect(v.typ.map((x) => x.wert).slice(0, 4)).toEqual(['eingekauft', 'saas', 'eigenbau', 'schatten']);
    expect(v.typ.reduce((a, x) => a + x.anzahl, 0)).toBe(v.gesamt);
  });

  it('Zahlen und Sollwerte aus Freitext', () => {
    expect(zahlAusText('97,8 %')).toEqual({ zahl: 97.8, einheit: '%' });
    expect(zahlAusText('95 % (19 von 20)')).toEqual({ zahl: 95, einheit: '%' });
    expect(zahlAusText('38 ppm')).toEqual({ zahl: 38, einheit: 'ppm' });
    expect(zahlAusText("1'240")).toEqual({ zahl: 1240, einheit: '' });
    expect(zahlAusText('keine neuen Fälle')).toBeNull();
    expect(sollAusText('mindestens 95 %')).toEqual({ zahl: 95, einheit: '%', richtung: 'mindestens' });
    expect(sollAusText('höchstens 50 ppm')).toEqual({ zahl: 50, einheit: 'ppm', richtung: 'hoechstens' });
    expect(sollAusText('at least 97 %')?.richtung).toBe('mindestens');
    expect(sollAusText('100 %')?.richtung).toBe('genau');
  });

  it('Kennzahlverlauf nach Datum bis zum Stichtag, als Linie nur mit mindestens zwei Zahlen gleicher Einheit', () => {
    const v = kennzahlVerlauf({ id: 'Z-1', kennzahl: 'Quote', ziel: '', sollwert: 'mindestens 90 %', messungen: [
      { datum: '2026-12-31', wert: '80 %' }, { datum: '2026-11-30', wert: '70 %' }, { datum: '2027-01-31', wert: '95 %' },
    ] }, '2026-12-31');
    expect(v.punkte.map((p) => p.zahl)).toEqual([70, 80]);
    expect(v.soll).toEqual({ zahl: 90, richtung: 'mindestens' });
    expect(v.alsLinie).toBe(true);
    expect(kennzahlVerlauf({ id: 'Z-2', kennzahl: 'x', ziel: '', sollwert: '', messungen: [{ datum: '2026-01-01', wert: 'ja' }] }).alsLinie).toBe(false);
    expect(kennzahlVerlaeufe(beispiel('muster-maschinenbau')).length).toBeGreaterThan(0);
  });
});
