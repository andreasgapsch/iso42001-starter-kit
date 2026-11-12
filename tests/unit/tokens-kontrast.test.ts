// Designpaket «AIMS Nachtblau» (R1): Kontrast der Tokens nach WCAG 2.2 AA (Text 4,5:1, Bedienelemente und Fokus 3:1) in
// dunkel und hell, und die App (src/app/stil.css) verwendet genau die Werte aus docs/design-system/nachtblau/tokens.json.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = join(import.meta.dirname, '..', '..');
const tokens = JSON.parse(readFileSync(join(REPO, 'docs/design-system/nachtblau/tokens.json'), 'utf8')) as {
  farben: Record<'dunkel' | 'hell', Record<string, string> & { status: Record<string, string> }>;
};
const css = readFileSync(join(REPO, 'src/app/stil.css'), 'utf8');

type Rgb = [number, number, number];

function hex(h: string): Rgb {
  const x = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255) as Rgb;
}

/** Farbe als RGB; rgba() wird über dem Hintergrund verrechnet */
function farbe(wert: string, grund?: string): Rgb {
  const m = /rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/.exec(wert);
  if (!m) return hex(wert);
  if (!grund) throw new Error(`Transparente Farbe ${wert} ohne Hintergrund`);
  const [r, g, b, a] = m.slice(1).map(Number) as [number, number, number, number];
  const unten = farbe(grund);
  return [r / 255, g / 255, b / 255].map((x, i) => x * a + unten[i]! * (1 - a)) as Rgb;
}

function leuchtdichte([r, g, b]: Rgb): number {
  const f = (x: number) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function kontrast(a: Rgb, b: Rgb): number {
  const [x, y] = [leuchtdichte(a), leuchtdichte(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Variablen eines Regelblocks in stil.css (erster Block, dessen Selektor mit `kopf` beginnt) */
function block(kopf: string): Record<string, string> {
  const i = css.indexOf(kopf);
  if (i < 0) throw new Error(`Block ${kopf} fehlt in stil.css`);
  const inhalt = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
  return Object.fromEntries([...inhalt.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

const normiert = (w: string) => w.replace(/\s+/g, '').replace(/,\./g, ',0.').toLowerCase();

const FLAECHEN = ['grund', 'leiste', 'untermenue', 'flaeche', 'flaeche_tief', 'flaeche_hoch', 'aktiv', 'hover', 'eingabe'];
const TEXTE = ['text', 'text_2', 'text_3', 'akzent_text'];
const STATUS = ['gut', 'warnung', 'kritisch', 'info', 'neutral'];

for (const thema of ['dunkel', 'hell'] as const) {
  const f = tokens.farben[thema];
  const s = f.status;
  describe(`Tokens ${thema}`, () => {
    it('Text auf allen Flächen mindestens 4,5:1', () => {
      const zuWenig: string[] = [];
      for (const t of TEXTE) for (const g of FLAECHEN) {
        const k = kontrast(farbe(f[t]!), farbe(f[g]!));
        if (k < 4.5) zuWenig.push(`${t} auf ${g}: ${k.toFixed(2)}`);
      }
      expect(zuWenig).toEqual([]);
    });

    it('Statusfarben als Text auf Flächen und auf ihrem eigenen Grund mindestens 4,5:1', () => {
      const zuWenig: string[] = [];
      for (const st of STATUS) {
        for (const g of ['grund', 'flaeche', 'untermenue', 'aktiv', 'hover', 'flaeche_hoch']) {
          const k = kontrast(farbe(s[st]!), farbe(f[g]!));
          if (k < 4.5) zuWenig.push(`${st} auf ${g}: ${k.toFixed(2)}`);
        }
        const k = kontrast(farbe(s[st]!), farbe(s[`${st}_grund`]!, f['flaeche']));
        if (k < 4.5) zuWenig.push(`${st} auf ${st}_grund: ${k.toFixed(2)}`);
      }
      expect(zuWenig).toEqual([]);
    });

    it('Hauptaktion: Schrift auf Primärfarbe (auch Hover) mindestens 4,5:1, Knopf auf Grund mindestens 3:1', () => {
      expect(kontrast(farbe(f['primaer_text']!), farbe(f['primaer']!))).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(farbe(f['primaer_text']!), farbe(f['primaer_hover']!))).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(farbe(f['primaer']!), farbe(f['grund']!))).toBeGreaterThanOrEqual(3);
    });

    it('Bedienelemente: Feldrand mindestens 3:1 auf Grund, Fläche und Eingabe; Fokus auf allen Flächen der Navigation', () => {
      // Eingabefelder stehen auf Grund (Kopf, Seiten) und Karten; im Untermenü und in der Symbolleiste gibt es keine
      for (const g of ['grund', 'flaeche', 'eingabe']) expect(kontrast(farbe(f['eingabe_rand']!), farbe(f[g]!)), `eingabe_rand auf ${g}`).toBeGreaterThanOrEqual(3);
      for (const g of ['grund', 'flaeche', 'eingabe', 'untermenue', 'leiste', 'aktiv']) expect(kontrast(farbe(f['fokus']!), farbe(f[g]!)), `fokus auf ${g}`).toBeGreaterThanOrEqual(3);
    });

    it('Text auf Statusflächen der App (Plakette, Risikomatrix, Diagramme) mindestens 4,5:1', () => {
      const app = block(thema === 'dunkel' ? ":root, :root[data-theme='dunkel']" : ":root[data-theme='hell']");
      for (const st of STATUS) expect(kontrast(farbe(app['auf-status']!), farbe(s[st]!)), st).toBeGreaterThanOrEqual(4.5);
      for (let i = 1; i <= 5; i++) expect(kontrast(farbe(app[`auf-seq-${i}`]!), farbe(app[`seq-${i}`]!)), `seq-${i}`).toBeGreaterThanOrEqual(4.5);
      for (let i = 1; i <= 6; i++) expect(kontrast(farbe(app[`kat-${i}`]!), farbe(f['flaeche']!)), `kat-${i}`).toBeGreaterThanOrEqual(3);
    });

    it('die App übernimmt die Werte aus tokens.json (auch «wie System» bei heller Systemeinstellung)', () => {
      const bloecke = thema === 'dunkel' ? [block(":root, :root[data-theme='dunkel']")] : [block(":root[data-theme='hell']"), block(':root:not([data-theme])')];
      for (const app of bloecke) {
        for (const [k, w] of Object.entries(f)) if (typeof w === 'string') expect(normiert(app[k.replace(/_/g, '-')] ?? ''), k).toBe(normiert(w));
        for (const [k, w] of Object.entries(s)) expect(normiert(app[`status-${k.replace(/_/g, '-')}`] ?? ''), `status.${k}`).toBe(normiert(w));
      }
    });
  });
}

describe('Regeln des Designpakets', () => {
  it('Ampel, Risiko und Reife nutzen nur Statusfarben, nie Primär- oder Akzentfarbe', () => {
    const abbildung = block(':root {\n  --masse-leiste');
    for (const k of ['risiko-tief', 'risiko-mittel', 'risiko-hoch', 'risiko-sehr-hoch', 'status-gut-flaeche', 'status-warnung-flaeche', 'status-kritisch-flaeche', 'status-neutral-flaeche', 'status-info-flaeche']) {
      expect(abbildung[k], k).toMatch(/^var\(--status-/);
    }
    // Reife der Prozesse (Prozesslandkarte) über Statusflächen
    expect(css).toMatch(/\[data-reife='3'\]\.prozess-kachel[^{]*\{[^}]*var\(--status-gut/);
  });

  it('Druck bleibt hell', () => {
    const druck = css.slice(css.indexOf('@media print {'));
    expect(druck).toMatch(/--grund: #ffffff;/);
    expect(druck).toMatch(/--text: #121821;/);
  });
});

/** Variablen eines Themas, wie die App sie setzt (dunkel als Standard, hell und «wie System» bei heller Einstellung) */
const APP_BLOECKE = {
  dunkel: [":root, :root[data-theme='dunkel']"],
  hell: [":root[data-theme='hell']", ':root:not([data-theme])'],
} as const;

describe('V-03 Zustand Gedrückt der Hauptaktion', () => {
  for (const thema of ['dunkel', 'hell'] as const) {
    for (const kopf of APP_BLOECKE[thema]) {
      it(`--primaer-gedrueckt existiert (${kopf}) und trägt die Schrift mit mindestens 4,5:1`, () => {
        const app = block(kopf);
        expect(app['primaer-gedrueckt'], 'primaer-gedrueckt').toMatch(/^#[0-9a-f]{6}$/i);
        expect(normiert(app['primaer-gedrueckt']!)).toBe(normiert(tokens.farben[thema]['primaer_gedrueckt'] ?? ''));
        expect(kontrast(farbe(app['primaer-text']!), farbe(app['primaer-gedrueckt']!))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('button.primaer:active nutzt --primaer-gedrueckt', () => {
    expect(css).toMatch(/button\.primaer:active[^{]*\{[^}]*background:\s*var\(--primaer-gedrueckt\)/);
  });
});

describe('V-15 deckender Grund der StatusPille', () => {
  for (const thema of ['dunkel', 'hell'] as const) {
    for (const kopf of APP_BLOECKE[thema]) {
      it(`--status-<art>-pille ist deckend und trägt das Statuswort mit mindestens 5:1 (${kopf})`, () => {
        const app = block(kopf);
        const zuWenig: string[] = [];
        for (const st of STATUS) {
          const pille = app[`status-${st}-pille`];
          expect(pille, `status-${st}-pille`).toMatch(/^#[0-9a-f]{6}$/i);
          const k = kontrast(farbe(app[`status-${st}`]!), farbe(pille!));
          if (k < 5) zuWenig.push(`${st}: ${k.toFixed(2)}`);
        }
        expect(zuWenig).toEqual([]);
      });
    }
  }
});

// V-14 (Designsystem AIMS Nachtblau): dritter Farbmodus Papier für Druck und Dokumente. tokens.json führt die Werte unter
// farben.papier; der Block @media print in stil.css setzt genau diese Werte (Gleichstand wie werkzeug/pruefe_papier.py).
describe('V-14 Modus Papier', () => {
  const papier = (tokens.farben as Record<string, (Record<string, string> & { status: Record<string, string> }) | undefined>)['papier'];
  const i = css.indexOf('@media print {');
  const druck = Object.fromEntries([...css.slice(css.indexOf('{', i + 14) + 1, css.indexOf('}', i)).matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));

  it('tokens.json hat den Modus papier mit denselben Schlüsseln wie hell', () => {
    expect(papier).toBeDefined();
    expect(Object.keys(papier!).sort()).toEqual(Object.keys(tokens.farben.hell).sort());
    expect(Object.keys(papier!.status).sort()).toEqual(Object.keys(tokens.farben.hell.status).sort());
  });

  it('@media print setzt jeden Wert des Modus Papier', () => {
    const abweichend: string[] = [];
    for (const [k, w] of Object.entries(papier ?? {})) if (typeof w === 'string' && normiert(druck[k.replace(/_/g, '-')] ?? '') !== normiert(w)) abweichend.push(`${k}: Druck ${druck[k.replace(/_/g, '-')] ?? 'fehlt'}, Papier ${w}`);
    for (const [k, w] of Object.entries(papier?.status ?? {})) if (normiert(druck[`status-${k.replace(/_/g, '-')}`] ?? '') !== normiert(w)) abweichend.push(`status.${k}: Druck ${druck[`status-${k.replace(/_/g, '-')}`] ?? 'fehlt'}, Papier ${w}`);
    expect(abweichend).toEqual([]);
  });

  it('Text und Statusfarben auf Papier mindestens 4,5:1', () => {
    const f = papier!;
    for (const t of TEXTE) for (const g of ['grund', 'flaeche_hoch']) expect(kontrast(farbe(f[t]!), farbe(f[g]!)), `${t} auf ${g}`).toBeGreaterThanOrEqual(4.5);
    for (const st of STATUS) expect(kontrast(farbe(f.status[st]!), farbe(f.status[`${st}_grund`]!)), st).toBeGreaterThanOrEqual(4.5);
  });
});
