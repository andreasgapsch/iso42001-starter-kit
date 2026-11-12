// Farben nur über CSS-Variablen (Hell- und Dunkelmodus): src/app/**/*.css und src/start/START.html.tpl.
import { describe, expect, it } from 'vitest';
import { farbenInCss, farbenInHtml, pruefeFarben } from '../../scripts/pruefen/farben.mts';

describe('farbenInCss', () => {
  it('lässt Variablendefinitionen und var() stehen', () => {
    const css = ':root { --text: #1c2430; --schatten: 0 1px 2px rgb(0 0 0 / 40%); }\n.a { color: var(--text); background: transparent; border: 1px solid currentColor; }';
    expect(farbenInCss('a.css', css)).toEqual([]);
  });

  it('meldet Hex, Farbfunktionen und Farbnamen ausserhalb von Variablen mit Zeilennummer', () => {
    const css = '.a {\n  color: #fff;\n  background: rgb(0 0 0 / 45%);\n  border-color: red;\n  box-shadow: 0 0 2px black;\n}';
    expect(farbenInCss('a.css', css).map((b) => b.zeile)).toEqual([2, 3, 4, 5]);
  });

  it('ignoriert Kommentare, Selektoren und Schriftnamen', () => {
    const css = '/* color: #000 */\n:root:not([data-theme="hell"]) a:visited { font-family: "Segoe UI", Tan; }';
    expect(farbenInCss('a.css', css)).toEqual([]);
  });

  it('meldet Farbwert als Rückfall in var()', () => {
    expect(farbenInCss('a.css', '.a { color: var(--x, #000); }')).toEqual([]);
    expect(farbenInCss('a.css', '.a { color: var(--x), #000; }')).toHaveLength(1);
  });
});

describe('farbenInHtml', () => {
  it('prüft style-Blöcke, style-Attribute und Farbattribute', () => {
    const html = '<style>\n:root { --a: #fff; }\nbody { color: #000; }\n</style>\n<p style="color: blue">x</p>\n<svg><path fill="#123456"/><path fill="currentColor"/></svg>';
    expect(farbenInHtml('s.html', html).map((b) => b.zeile)).toEqual([3, 5, 6]);
  });
});

describe('Repo', () => {
  it('src/app/**/*.css und START.html.tpl nutzen Farben nur über CSS-Variablen', () => {
    expect(pruefeFarben().map((b) => `${b.datei}:${b.zeile} ${b.text}`)).toEqual([]);
  });
});
