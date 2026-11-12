// V-06 und V-07 (Designsystem AIMS Nachtblau): Deaktiviert mit eigenen Farben statt Deckkraft; je eine Komponente für Status
// (ui/StatusPille.tsx), Hinweis (ui/Hinweis.tsx) und Tabellen (höchstens zwei Tabellenklassen: tabelle, kartenliste).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = join(import.meta.dirname, '..', '..');
const css = readFileSync(join(REPO, 'src', 'app', 'stil.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const regeln = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selektor: m[1]!.trim(), inhalt: m[2]! }));
const dateien = (o: string): string[] => readdirSync(o, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dateien(join(o, e.name)) : /\.(tsx?|css)$/.test(e.name) ? [join(o, e.name)] : []));
const APP = dateien(join(REPO, 'src', 'app'));
const quelle = (d: string) => readFileSync(d, 'utf8');

describe('V-06 Deaktiviert mit eigenen Farben', () => {
  it('keine opacity an :disabled oder aria-disabled in stil.css', () => {
    expect(regeln.filter((r) => /:disabled|aria-disabled/.test(r.selektor) && /\bopacity\s*:/.test(r.inhalt)).map((r) => r.selektor)).toEqual([]);
  });
  it('deaktivierter Knopf nutzt --flaeche-tief, --text-aus und --linie', () => {
    const r = regeln.find((x) => x.selektor.split(',').map((s) => s.trim()).includes('button:disabled'));
    expect(r, 'Regel für button:disabled').toBeDefined();
    for (const v of ['--flaeche-tief', '--text-aus', '--linie)']) expect(r!.inhalt).toContain(v);
  });
});

describe('V-07 eine Komponente je Status, Hinweis und Tabelle', () => {
  const ALT = ['status', 'chip', 'ampel', 'schwere', 'etikett', 'g-pille'];
  it('die Klassen .status, .chip, .ampel, .schwere, .etikett und .g-pille kommen in src/app nicht mehr vor', () => {
    const treffer: string[] = [];
    for (const d of APP) {
      const s = quelle(d);
      for (const k of ALT) {
        const muster = d.endsWith('.css') ? new RegExp(`\\.${k}(?![\\w-])`) : new RegExp(`class(Name)?=\\{?[\`'"][^\`'"]*(?<![\\w-])${k}(?![\\w-])`);
        if (muster.test(s)) treffer.push(`${d.slice(REPO.length + 1)}: ${k}`);
      }
    }
    expect(treffer).toEqual([]);
  });
  it('Status nur über StatusPille: Pillenklassen stehen nur in ui/StatusPille.tsx', () => {
    expect(APP.filter((d) => !d.endsWith('StatusPille.tsx') && !d.endsWith('.css') && /pille--/.test(quelle(d))).map((d) => d.slice(REPO.length + 1))).toEqual([]);
    expect(APP.filter((d) => /<StatusPille\b/.test(quelle(d))).length).toBeGreaterThan(5);
  });
  it('Hinweise über die Komponente Hinweis mit vier Arten', () => {
    const h = quelle(join(REPO, 'src', 'app', 'ui', 'Hinweis.tsx'));
    for (const a of ['info', 'warnung', 'fehler', 'ok']) expect(h).toContain(`'${a}'`);
  });
  it('höchstens zwei Tabellenklassen an <table> (tabelle, kartenliste)', () => {
    const klassen = new Set<string>();
    for (const d of APP.filter((x) => x.endsWith('.tsx'))) for (const m of quelle(d).matchAll(/<table\b[^>]*\bclass(?:Name)?=\{?["'`]([^"'`]*)/g)) for (const k of m[1]!.split(/\s+/).filter(Boolean)) klassen.add(k);
    expect([...klassen].filter((k) => !['tabelle', 'kartenliste'].includes(k))).toEqual([]);
  });
  // B8 (Prüfung Designsystem): auch mehrzeilige Hinweise über die Komponente; Statusfarben nur für Status
  it('B8: kein Hinweis als Klasse ausserhalb von ui/Hinweis.tsx (auch mehrzeilige)', () => {
    const treffer = APP.filter((d) => d.endsWith('.tsx') && !d.endsWith('Hinweis.tsx')).flatMap((d) =>
      [...quelle(d).matchAll(/class(?:Name)?=\{?["'`]([^"'`]*)/g)].filter((m) => m[1]!.split(/\s+/).includes('hinweis')).map(() => d.slice(REPO.length + 1)));
    expect(treffer).toEqual([]);
  });
  it('B8: Symbole für Format und Fälligkeit (.symbol, .bib-symbol) ohne Statusfarben; keine eigenen Statusklassen .ok-text, .speicher-warnung mit Farbe', () => {
    const alle = [...regeln, ...dateien(join(REPO, 'src', 'app')).filter((d) => d.endsWith('.css') && !d.endsWith('stil.css')).flatMap((d) =>
      [...readFileSync(d, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selektor: m[1]!.trim(), inhalt: m[2]! })))];
    const falsch = alle.filter((r) => /\.(symbol|bib-symbol|ok-text|speicher-warnung)\b/.test(r.selektor) && /--status-/.test(r.inhalt)).map((r) => r.selektor);
    expect(falsch).toEqual([]);
    for (const d of APP.filter((x) => x.endsWith('.tsx'))) expect(quelle(d), d).not.toMatch(/ok-text|bib-symbol \$\{|symbol \$\{/);
  });
});
