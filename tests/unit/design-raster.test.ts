// V-01 (Designsystem AIMS Nachtblau): Abstände im 4-px-Raster. Jeder Wert von margin, padding und gap in src/app/stil.css ist 0,
// auto, eine var(--abstand-n) oder ein Wert aus 4, 8, 12, 16, 20, 24, 32, 40, 48 px; in calc(), clamp(), min() und max() gilt das
// für jede Länge; Bildschirmanteile vw, vh und % sind seit A-10 (test.8) auch dort nicht mehr erlaubt. Die Seitenränder des Drucks (@page) zählen nicht, die Masse
// der Bausteine (var(--masse-*) aus tokens.json, etwa die Höhe der unteren Leiste) sind keine Abstände.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// stil.css und die Stile der Bibliothek (A-10: Zellen mit 10 und 18 px)
const css = ['stil.css', 'ansichten/bibliothek/bibliothek.css'].map((d) => readFileSync(join(import.meta.dirname, '..', '..', 'src', 'app', d), 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const RASTER = new Set([0, 4, 8, 12, 16, 20, 24, 32, 40, 48]);
const EIGENSCHAFT = /(?:^|[;{\s])((?:margin|padding)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap)\s*:\s*([^;}]+)/g;

/** Werte der Custom Properties in stil.css (alle Definitionen je Name) */
const definitionen = new Map<string, string[]>();
for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) definitionen.set(m[1]!, [...(definitionen.get(m[1]!) ?? []), m[2]!.trim()]);

/** Verstösse eines Werts; tief: innerhalb einer Funktion (A-10: auch dort keine vw, vh, dvh und %) */
function verstoesse(wert: string, tief = false, gesehen = new Set<string>()): string[] {
  const v = wert.replace(/!important/, '').trim();
  const aus: string[] = [];
  // Funktionen: Inhalt prüfen; var(--x) über seine Definitionen
  const rest = v.replace(/var\((--[\w-]+)(?:,[^()]*)?\)/g, (_, name: string) => {
    if (/^--abstand-(1|2|3|4|5|6|8|10|12)$/.test(name) || /^--masse-/.test(name)) return ' ';
    if (gesehen.has(name)) return ' ';
    const d = definitionen.get(name);
    if (!d) aus.push(`${name} ohne Definition`);
    else for (const w of d) aus.push(...verstoesse(w, true, new Set([...gesehen, name])).map((x) => `${name}: ${x}`));
    return ' ';
  }).replace(/env\([^()]*\)/g, ' ');
  for (const m of rest.matchAll(/(-?\d*\.?\d+)([a-z%]*)/g)) {
    const [, zahl, einheit] = m;
    const n = Math.abs(Number(zahl));
    if (n === 0 && !einheit) continue;
    if (einheit === 'px' && RASTER.has(n)) continue;
    if (/(calc|clamp|min|max)\(/.test(rest) || tief) {
      // A-10: keine Anteile der Fensterbreite oder Prozente mehr (`.inhalt` mit 2 % ergab 28,8 px)
      if (!einheit && /[*/]\s*$|^\s*[*/]/.test(rest.slice(Math.max(0, (m.index ?? 0) - 3), (m.index ?? 0)))) continue;
    }
    aus.push(`${zahl}${einheit}`);
  }
  if (!tief && /[a-z]/.test(rest.replace(/\b(auto|calc|clamp|min|max)\b/g, '').replace(/-?\d*\.?\d+[a-z%]*/g, ''))) aus.push(`unbekannt: ${v}`);
  return aus;
}

describe('V-01 Abstände im 4-px-Raster', () => {
  it('die Abstandsvariablen --abstand-n liegen im Raster', () => {
    const falsch = [...definitionen].filter(([k]) => /^--abstand-\d+$/.test(k)).flatMap(([k, w]) => w.filter((x) => !/^\d+px$/.test(x) || !RASTER.has(Number.parseInt(x, 10))).map((x) => `${k}: ${x}`));
    expect(falsch).toEqual([]);
  });

  it('jeder Wert von margin, padding und gap ist 0, auto, var(--abstand-n) oder 4 bis 48 px im Raster', () => {
    const ohneSeite = css.replace(/@page\s*\{[^}]*\}/g, '');
    const falsch: string[] = [];
    for (const m of ohneSeite.matchAll(EIGENSCHAFT)) {
      const v = verstoesse(m[2]!);
      if (v.length) falsch.push(`${m[1]}: ${m[2]!.trim()} (${v.join(', ')})`);
    }
    expect(falsch).toEqual([]);
  });

  // A-10: auch Inline-Stile in den Ansichten (style={{ marginTop: '14px' }} im Lagebild)
  it('Inline-Stile in src/app/**/*.tsx: margin, padding und gap im Raster', () => {
    const wurzel = join(import.meta.dirname, '..', '..', 'src', 'app');
    const dateien = (readdirSync(wurzel, { recursive: true }) as string[]).filter((d) => d.endsWith('.tsx'));
    const falsch: string[] = [];
    for (const d of dateien) {
      const text = readFileSync(join(wurzel, d), 'utf8');
      for (const m of text.matchAll(/\b(margin|padding|gap|rowGap|columnGap)(Top|Right|Bottom|Left|Inline|Block)?\s*:\s*'([^']+)'/g)) {
        const v = verstoesse(m[3]!);
        if (v.length) falsch.push(`${d}: ${m[1]}${m[2] ?? ''}: ${m[3]} (${v.join(', ')})`);
      }
    }
    expect(falsch).toEqual([]);
  });
});
