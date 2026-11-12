// A-24: Jedes Zeichen in den Texten (src/i18n) und in festen Texten der Ansichten
// und Grafiken liegt im Zeichenumfang der eingebetteten Inter (unicode-range der @font-face in stil.css). Sonst setzt der
// Druck eine Ersatzschrift ein (der Pfeil «→» kam aus DejaVu Sans). Die SVG-Grafiken der Word-Dokumente (src/grafik/svg) zeigt
// Word mit seinen eigenen Schriften; sie gehören nicht zur App. Bewusst ausgenommen: der Verweis «→ PR-xx» in den Formen der
// Prozessabläufe (src/prozesse/layout.ts), weil er Teil des Austauschformats mit draw.io und D-27 ist (verweisAusText liest ihn
// beim Import zurück); in der App erscheint er in der Ablaufgrafik.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = join(import.meta.dirname, '..', '..');
const css = readFileSync(join(REPO, 'src/app/stil.css'), 'utf8');
const bloecke = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]!).filter((b) => /Inter/i.test(b));
const bereiche = bloecke.flatMap((b) => (/unicode-range:\s*([^;]+);/.exec(b)?.[1] ?? '').split(',').map((x) => x.trim().replace(/^U\+/i, '')))
  .filter(Boolean).map((x) => { const [a, b] = x.split('-'); return [parseInt(a!, 16), parseInt(b ?? a!, 16)] as const; });
const abgedeckt = (c: number) => c < 0x20 || bereiche.some(([a, b]) => c >= a && c <= b);

function dateien(wurzel: string, endung: RegExp): string[] {
  return (readdirSync(join(REPO, wurzel), { recursive: true }) as string[]).filter((d) => endung.test(d)).map((d) => join(wurzel, d));
}

describe('A-24: Zeichen im Umfang der eingebetteten Inter', () => {
  it('die Inter-Blöcke haben einen unicode-range', () => {
    expect(bereiche.length).toBeGreaterThan(5);
  });
  it('Texte DE/EN (src/i18n), feste Texte in src/app (auch .ts), Kurzanleitung und src/grafik/preact', () => {
    const quellen = [...dateien('src/i18n/de', /\.ya?ml$/), ...dateien('src/i18n/en', /\.ya?ml$/), ...dateien('src/app', /\.tsx?$/), ...dateien('src/app/kurzanleitung', /\.html$/), ...dateien('src/grafik/preact', /\.tsx?$/)];
    const falsch = new Map<string, Set<string>>();
    for (const d of quellen) {
      let text = readFileSync(join(REPO, d), 'utf8');
      // Quelltext: nur Zeichenketten und JSX-Text, keine Kommentare
      if (d.endsWith('.html')) text = text.replace(/<!--[\s\S]*?-->/g, '');
      else if (d.endsWith('.tsx') || d.endsWith('.ts')) text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      else text = text.replace(/^\s*#.*$/gm, '');
      for (const ch of text) {
        const c = ch.codePointAt(0)!;
        if (!abgedeckt(c)) falsch.set(ch, (falsch.get(ch) ?? new Set()).add(d));
      }
    }
    expect([...falsch].map(([ch, d]) => `${ch} U+${ch.codePointAt(0)!.toString(16).toUpperCase()}: ${[...d].slice(0, 4).join(', ')}`)).toEqual([]);
  });
});
