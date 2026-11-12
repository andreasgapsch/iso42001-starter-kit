// D-05: Über alle Katalogprozesse gemessen, in SVG, DOCX und draw.io: keine Linie durch eine Form (auch nicht durch Start oder
// Ziel), Kanten mit verschiedenem Ziel liegen nicht aufeinander (Nein-Zweig unterscheidbar), Beschriftung bei ihrer Linie.
import { describe, expect, it } from 'vitest';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ablaufDocxGeometrie, ablaufDocxWege } from '../../src/generator/docx.ts';
import { ablaufBeschriftung, ablaufGeometrie, ablaufWege, seitenPunkt, ablaufSzene, type AblaufSeite, type Knoten, type Rechteck } from '../../src/grafik/svg/index.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { drawioSeite } from '../../src/prozesse/drawio.ts';
import { ablaufAlt, ablaufBlock, prozessRaster, SPALTE_PX } from '../../src/prozesse/layout.ts';
import { bahnText, katalogAblauf, prozessKatalog } from '../../src/prozesse/katalog.ts';

const u = erstelleUebersetzer('de', ladeTexte('de'));
const prozesse = prozessKatalog(ladeKataloge()).prozesse;
interface P { x: number; y: number }

function durchForm(p: P, q: P, r: Rechteck): boolean {
  return Math.max(p.x, q.x) > r.x + 1 && Math.min(p.x, q.x) < r.x + r.b - 1 && Math.max(p.y, q.y) > r.y + 1 && Math.min(p.y, q.y) < r.y + r.h - 1;
}
function liegtAuf(a: P, b: P, c: P, d: P): number {
  if (a.x === b.x && c.x === d.x && Math.abs(a.x - c.x) < 1) return Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y));
  if (a.y === b.y && c.y === d.y && Math.abs(a.y - c.y) < 1) return Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x));
  return 0;
}
interface Mess { formen: string[]; decken: string[]; schraeg: string[] }
function messen(pid: string, rechtecke: ReadonlyMap<string, Rechteck>, kanten: readonly { von: string; nach: string }[], wege: readonly (readonly P[])[]): Mess {
  const m: Mess = { formen: [], decken: [], schraeg: [] };
  kanten.forEach((k, i) => {
    const w = wege[i]!;
    for (let j = 1; j < w.length; j++) {
      const [p, q] = [w[j - 1]!, w[j]!];
      if (p.x !== q.x && p.y !== q.y) m.schraeg.push(`${pid} ${k.von}>${k.nach}`);
      for (const [id, r] of rechtecke) if (durchForm(p, q, r)) m.formen.push(`${pid} ${k.von}>${k.nach} durch ${id}`);
    }
    kanten.forEach((l, h) => {
      if (h <= i || l.nach === k.nach) return;
      const v = wege[h]!;
      for (let a = 1; a < w.length; a++) for (let b = 1; b < v.length; b++) if (liegtAuf(w[a - 1]!, w[a]!, v[b - 1]!, v[b]!) > 2) m.decken.push(`${pid} ${k.von}>${k.nach} auf ${l.von}>${l.nach}`);
    });
  });
  return m;
}
const alle = (k: Knoten): Knoten[] => [k, ...(k.k ?? []).flatMap((x) => (typeof x === 'string' ? [] : alle(x)))];

describe('D-05: Linien über alle Prozesse', () => {
  it('Katalog ist vollständig gemessen', () => expect(prozesse.length).toBeGreaterThanOrEqual(38));

  it('SVG (gelesen aus der fertigen Szene)', () => {
    const ges: Mess = { formen: [], decken: [], schraeg: [] };
    for (const kp of prozesse) {
      const a = katalogAblauf(u, kp);
      const r = prozessRaster(a, { roh: (k: string) => u.tOpt(k) } as never);
      const o = { id: 'x', breite: SPALTE_PX * r.spalten + 24, zeilenHoehe: r.zeilenHoehe };
      const szene = ablaufSzene(r, { titel: 't', beschreibung: 'b' }, o);
      const geo = ablaufGeometrie(r, o);
      const wege = alle(szene).filter((n) => n.el === 'g' && n.a?.['data-kante']).map((g) => {
        const line = alle(g).find((n) => n.el === 'polyline')!;
        return String(line.a!['points']).split(' ').map((s) => ({ x: Number(s.split(',')[0]), y: Number(s.split(',')[1]) }));
      });
      expect(wege.length, kp.id).toBe(r.kanten.length);
      const m = messen(kp.id, geo.knoten, r.kanten, wege);
      ges.formen.push(...m.formen); ges.decken.push(...m.decken); ges.schraeg.push(...m.schraeg);
    }
    expect(ges).toEqual({ formen: [], decken: [], schraeg: [] });
  }, 120_000);

  it('DOCX (Geometrie der Zeichnung)', () => {
    const ges: Mess = { formen: [], decken: [], schraeg: [] };
    for (const kp of prozesse) {
      const a = katalogAblauf(u, kp);
      const r = prozessRaster(a, { roh: (k: string) => u.tOpt(k) } as never);
      const b = ablaufBlock(r, ablaufAlt(a, { roh: (k: string) => u.tOpt(k) } as never, 't', () => 'b'));
      const g = ablaufDocxGeometrie(b);
      const m = messen(kp.id, g.rechtecke, b.kanten, ablaufDocxWege(b));
      ges.formen.push(...m.formen); ges.decken.push(...m.decken); ges.schraeg.push(...m.schraeg);
    }
    expect(ges).toEqual({ formen: [], decken: [], schraeg: [] });
  }, 120_000);

  it('draw.io (gelesen aus der exportierten Datei)', () => {
    const ges: Mess = { formen: [], decken: [], schraeg: [] };
    const STELLE: Record<string, AblaufSeite> = { '0.5,0': 'top', '0.5,1': 'bottom', '0,0.5': 'left', '1,0.5': 'right' };
    for (const kp of prozesse) {
      const a = katalogAblauf(u, kp);
      const bahnTexte = Object.fromEntries(a.bahnen.map((b) => [b.id, bahnText(u, b)]));
      const r = prozessRaster(a, { roh: (k: string) => u.tOpt(k) } as never);
      const xml = drawioSeite({ id: kp.id, titel: kp.id, ablauf: a, bahnTexte } as never);
      const geo = ablaufGeometrie(r, { breite: SPALTE_PX * r.spalten + 24, zeilenHoehe: r.zeilenHoehe });
      const wege = r.kanten.map((k) => {
        const m = new RegExp(`<object id="kante:${k.von}:${k.nach}"[\\s\\S]*?</object>`).exec(xml);
        expect(m, `${kp.id} ${k.von} ${k.nach}`).not.toBeNull();
        const s = m![0];
        const stelle = (n: string) => STELLE[`${new RegExp(`${n}X=([0-9.]+)`).exec(s)![1]},${new RegExp(`${n}Y=([0-9.]+)`).exec(s)![1]}`]!;
        const punkte = [...s.matchAll(/<mxPoint x="([^"]+)" y="([^"]+)"/g)].map((q) => ({ x: Number(q[1]), y: Number(q[2]) }));
        return [seitenPunkt(geo.knoten.get(k.von)!, stelle('exit')), ...punkte, seitenPunkt(geo.knoten.get(k.nach)!, stelle('entry'))];
      });
      const m = messen(kp.id, geo.knoten, r.kanten, wege);
      ges.formen.push(...m.formen); ges.decken.push(...m.decken); ges.schraeg.push(...m.schraeg);
    }
    expect(ges).toEqual({ formen: [], decken: [], schraeg: [] });
  }, 120_000);

  it('Beschriftung steht bei ihrer Linie und nicht auf einer Form', () => {
    const fehler: string[] = [];
    for (const kp of prozesse) {
      const a = katalogAblauf(u, kp);
      const r = prozessRaster(a, { roh: (k: string) => u.tOpt(k) } as never);
      const breite = SPALTE_PX * r.spalten + 24;
      const geo = ablaufGeometrie(r, { breite, zeilenHoehe: r.zeilenHoehe });
      const wege = ablaufWege(geo.knoten, r.kanten, { grenze: { x0: 1, y0: geo.kopf + 1, x1: geo.breite - 1, y1: geo.hoehe - 1 } });
      r.kanten.forEach((k, i) => {
        if (!k.text) return;
        const r1 = geo.knoten.get(k.von)!;
        const weg = wege[i]!;
        const b = ablaufBeschriftung(k.text, k.vonSeite, seitenPunkt(r1, k.vonSeite), r1, breite, weg);
        const x0 = b.anker === 'end' ? b.x - b.breite : b.x;
        const box = { x: x0, y: b.y - 9, b: b.breite, h: 11 };
        // Abstand Kasten zu Linie: kleinster Abstand zu einer Strecke des Wegs
        let abstand = Infinity;
        for (let j = 1; j < weg.length; j++) {
          const [p, q] = [weg[j - 1]!, weg[j]!];
          const dx = Math.max(box.x - Math.max(p.x, q.x), 0, Math.min(p.x, q.x) - box.x - box.b);
          const dy = Math.max(box.y - Math.max(p.y, q.y), 0, Math.min(p.y, q.y) - box.y - box.h);
          abstand = Math.min(abstand, Math.hypot(dx, dy));
        }
        if (abstand > 12) fehler.push(`${kp.id} ${k.von} ${k.text}: ${Math.round(abstand)} px von der Linie`);
        if (x0 < 0 || x0 + b.breite > breite) fehler.push(`${kp.id} ${k.von} ${k.text}: ausserhalb`);
      });
    }
    expect(fehler).toEqual([]);
  });
});
