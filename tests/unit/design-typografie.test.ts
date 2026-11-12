// V-02 und V-04 (Designsystem AIMS Nachtblau): Typografie mit 8 Grössen (12, 13, 14, 15, 17, 20, 26, 30 px) und 3 Gewichten
// (400, 500, 600). In src/app/stil.css höchstens 10 verschiedene font-size-Werte (auch in der Kurzschreibweise font), kein
// font-weight über 700 (Inter ist mit 400 bis 700 eingebettet), kein font-stretch, keine Schrift unter 12 px.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(import.meta.dirname, '..', '..', 'src', 'app', 'stil.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const deklarationen = (name: string) => [...css.matchAll(new RegExp(`(?:^|[;{\\s])${name}\\s*:\\s*([^;}]+)`, 'g'))].map((m) => m[1]!.trim());
/** font-size aus «font: 500 .75rem/1.4 var(--schrift-ui)» */
const ausKurz = deklarationen('font').filter((f) => f !== 'inherit').map((f) => /(?:^|\s)(\d*\.?\d+(?:px|rem|em|pt|%))(?:\/|\s)/.exec(f)?.[1]).filter((x): x is string => !!x);
const groessen = [...deklarationen('font-size').filter((x) => x !== 'inherit'), ...ausKurz];
const gewichte = [...deklarationen('font-weight'), ...deklarationen('font').map((f) => /^(\d{3})\s/.exec(f)?.[1]).filter((x): x is string => !!x)];
const px = (w: string): number => {
  const m = /^(\d*\.?\d+)(px|rem|em|pt)$/.exec(w);
  if (!m) return Number.NaN;
  return Number(m[1]) * ({ px: 1, rem: 16, em: 14, pt: 4 / 3 } as Record<string, number>)[m[2]!]!;
};

describe('V-02 Typografie', () => {
  it('höchstens 10 verschiedene font-size-Werte', () => {
    expect(new Set(groessen).size, [...new Set(groessen)].join(' ')).toBeLessThanOrEqual(10);
  });
  it('kein font-weight über 700', () => {
    expect(gewichte.filter((g) => /^\d+$/.test(g) && Number(g) > 700)).toEqual([]);
    expect(gewichte.filter((g) => /bolder|black|heavy/.test(g))).toEqual([]);
  });
  it('kein font-stretch', () => {
    expect(deklarationen('font-stretch')).toEqual([]);
  });
});

describe('V-04 kleinste Schrift 12 px', () => {
  it('keine font-size unter 12 px (.75rem)', () => {
    expect(groessen.filter((g) => px(g) < 12)).toEqual([]);
  });
  it('alle Grössen sind Längen der Skala oder Funktionen ohne Wert unter 12 px', () => {
    expect(groessen.filter((g) => Number.isNaN(px(g)) && !/^clamp\(/.test(g))).toEqual([]);
  });
});
