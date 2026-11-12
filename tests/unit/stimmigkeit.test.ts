// Stimmigkeit der Beispielprojekte (Runde 2, A2-01 bis A2-06): Datumsketten, Nachweise, Kennzahlen, Reife, Prüfumfang.
// Die Gegenproben zeigen, dass die Prüfung die Fehler aus Bericht A wirklich findet.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { stimmigkeit } from '../../src/regeln/stimmigkeit.ts';
import { d27 } from '../../src/vorlagen/D-27.ts';

const kataloge = ladeKataloge();
const FIRMEN = ['muster-maschinenbau', 'praezisionsteile'] as const;
const laden = (f: string, s: 'de' | 'en') => JSON.parse(readFileSync(`src/beispiele/${f}.${s}.aims.json`, 'utf8')) as Projekt;
const iso = (d: string) => d.replace(/^(\d{2})[./](\d{2})[./](\d{4})$/, '$3-$2-$1');
const blockText = (b: unknown): string => JSON.stringify(b);
const finden = (p: Projekt, opt = { bezugPruefen: false }) => stimmigkeit(p, { kataloge, ...opt }).map((a) => `${a.art} ${a.wo}: ${a.was}`);

describe('Stimmigkeit der Beispiele', () => {
  for (const f of FIRMEN) {
    it(`${f} DE: keine Abweichung, auch beim sachlichen Bezug`, () => expect(finden(laden(f, 'de'), { bezugPruefen: true })).toEqual([]));
    it(`${f} EN: keine Abweichung`, () => expect(finden(laden(f, 'en'))).toEqual([]));

    it(`${f}: DE und EN sind strukturgleich (Kennungen, Daten, Status, Zahlen)`, () => {
      const de = laden(f, 'de');
      const en = laden(f, 'en');
      const sicht = (p: Projekt) => ({
        m: p.massnahmen.map((x) => [x.id, x.status, x.termin, x.erledigtAm, x.erfasstAm, x.nachweise]),
        n: p.nachweise.map((x) => [x.id, x.datum, x.art]),
        d: p.dokumente.map((x) => [x.id, x.version, x.status, x.freigabe?.am, x.geprueft?.am, x.bestaetigt?.am, x.aenderungen?.map((a) => [a.version, a.datum])]),
        k: (p.kennzahlMessungen ?? []).map((x) => [x.kennzahl, x.datum, x.zaehler, x.nenner, x.sollErreicht, x.keineMessung]),
        pr: (p.prozesse ?? []).map((x) => [x.id, x.reife, x.reifeAm, x.letzteDurchfuehrung, x.kennzahl]),
        a: p.audits.map((x) => [x.id, x.geplant, x.durchgefuehrt, x.umfangProzesse, x.umfangControls]),
        f: p.feststellungen.map((x) => [x.id, x.status, x.datum, x.erfasstAm, x.wirksamkeitGeplant, x.massnahmen]),
      });
      expect(sicht(en)).toEqual(sicht(de));
    });

    it(`${f}: D-27 zeigt keinen Messwert nach dem eigenen Datum und keine eingeführten Prozesse ohne Durchführung`, () => {
      for (const s of ['de', 'en'] as const) {
        const p = laden(f, s);
        const u = erstelleUebersetzer(s, ladeTexte(s));
        const ir = d27({ u, modus: 'firma', form: 'dokument', projekt: p, kataloge, kitVersion: 'pruefung' });
        const datum = p.dokumente.find((d) => d.id === 'D-27')!.freigabe!.am;
        const text = ir.bloecke.map(blockText).join('\n');
        for (const m of text.matchAll(/(?:Gemessen als|Measured as)[^"]*?(\d{2}[./]\d{2}[./]\d{4})/g)) expect(iso(m[1]!) <= datum, m[0]).toBe(true);
        // Prozesskapitel: «eingeführt» neben «noch keine» darf nicht vorkommen
        const stufe = s === 'de' ? 'eingeführt' : 'implemented';
        const keine = s === 'de' ? 'noch keine' : 'none yet';
        for (const k of ir.bloecke.filter((b) => b.typ === 'felder')) {
          const t = blockText(k);
          expect(t.includes(`"${stufe}"`) && t.includes(`"${keine}"`), t.slice(0, 200)).toBe(false);
        }
      }
    });
  }

  it('Messwerte sind je Firma verschieden und nicht aus einer Vorlage kopiert', () => {
    const [m, p] = FIRMEN.map((f) => laden(f, 'de').kennzahlMessungen ?? []);
    const gleich = m!.filter((x) => /^P[RS]-/.test(x.kennzahl) && !x.keineMessung).filter((x) => p!.some((y) => y.kennzahl === x.kennzahl && y.wert === x.wert)).map((x) => x.kennzahl);
    expect(gleich).toEqual([]);
  });
});

describe('Stimmigkeit: Gegenproben aus Bericht A', () => {
  const p = () => structuredClone(laden('praezisionsteile', 'de'));
  const messung = (x: Projekt, k: string) => x.kennzahlMessungen!.find((m) => m.kennzahl === k)!;

  it('A2-01: rechnerisch unmögliche Quote', () => {
    const x = p();
    Object.assign(messung(x, 'PR-18'), { wert: '93 %', zaehler: undefined, nenner: undefined });
    expect(finden(x).join()).toContain('ohne Zähler und Nenner');
  });
  it('A2-01: Nenner passt nicht zu den Aufzeichnungen', () => {
    const x = p();
    Object.assign(messung(x, 'PR-22'), { wert: '3 von 3 (100 %)', zaehler: 3, nenner: 3 });
    const y = p();
    Object.assign(messung(y, 'PR-06'), { wert: '3 von 5 (60 %)', zaehler: 3, nenner: 5, sollErreicht: 'nein' });
    expect(finden(y).join()).toContain('Nenner 5, die Aufzeichnungen ergeben 4');
  });
  it('A2-01: Sollvergleich fehlt oder rechnet falsch', () => {
    const x = p();
    delete messung(x, 'PR-10').sollErreicht;
    expect(finden(x).join()).toContain('ohne Sollvergleich');
    const y = p();
    messung(y, 'PR-13').sollErreicht = 'ja';
    expect(finden(y).join()).toContain('Sollvergleich');
  });
  it('A2-01: «11 Monate» widerspricht der Überprüfung und dem Projektalter', () => {
    const x = p();
    messung(x, 'PR-01').wert = '11 Monate';
    expect(finden(x).join()).toContain('11 Monate, die letzte Überprüfung');
  });
  it('A2-01: Stunden gegen das Register', () => {
    const x = p();
    messung(x, 'PR-19').wert = '23 Stunden';
    expect(finden(x).join()).toContain('23 Stunden, das Register ergibt 120');
  });
  it('A2-01: PR-13 voll erfüllt trotz Feststellung', () => {
    const x = p();
    Object.assign(messung(x, 'PR-13'), { wert: '1 von 1 (100 %)', zaehler: 1, sollErreicht: 'ja' });
    expect(finden(x).join()).toContain('Feststellung zu PR-13');
  });
  it('A2-02: Messwert und Registereintrag vom Folgetag', () => {
    const x = p();
    messung(x, 'PR-04').datum = '2027-01-30';
    expect(finden(x).join()).toContain('nach D-05');
    const y = p();
    y.dokumente.find((d) => d.id === 'D-26')!.freigabe!.am = '2027-01-28';
    y.dokumente.find((d) => d.id === 'D-26')!.aenderungen!.pop();
    expect(finden(y).join()).toContain('Register vom 2027-01-28 führt D-05');
  });
  it('A2-03: Reife ohne Durchführung und Einstufung nach der Bewertung', () => {
    const x = p();
    const e = x.prozesse!.find((y) => y.id === 'PS-08')!;
    delete e.letzteDurchfuehrung;
    expect(finden(x).join()).toContain('reife PS-08');
    const y = p();
    y.prozesse!.find((z) => z.id === 'PR-01')!.reifeAm = '2027-01-27';
    expect(finden(y).join()).toContain('nach der Bewertung');
  });
  it('A2-04: Nachweis älter als die Massnahme oder ohne Bezug', () => {
    const x = p();
    x.massnahmen.find((m) => m.id === 'M-011')!.nachweise = ['N-004'];
    expect(finden(x).join()).toContain('N-004 (2026-10-16) liegt ausserhalb');
    const y = p();
    y.massnahmen.find((m) => m.id === 'M-011')!.nachweise = ['N-016'];
    y.nachweise.find((n) => n.id === 'N-016')!.datum = '2026-11-13';
    expect(finden(y, { bezugPruefen: true }).join()).toContain('ohne erkennbaren Bezug');
  });
  it('Umfang: Prozess in keinem Audit, Lehre fehlt im nächsten Audit', () => {
    const x = p();
    x.audits.find((a) => a.id === 'AU-008')!.umfangProzesse = ['PR-01'];
    x.audits.find((a) => a.id === 'AU-001')!.umfang = 'Stichprobe';
    expect(finden(x).join()).toContain('Prozess in keinem internen Audit');
    const y = p();
    y.audits.find((a) => a.id === 'AU-008')!.umfangControls = ['A.2.4'];
    expect(finden(y).join()).toContain('Nachprüfung fehlt');
  });
});
