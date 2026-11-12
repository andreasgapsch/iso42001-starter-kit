// N7 («allein» heisst «ohne Eigner/in»): Ohne Geschäftsleitung entscheidet die
// AIMS-Verantwortung bei tiefem Risiko allein, bei mittlerem mit Eigner/in, nie bei hohem. D-03 (Vorlage, Vorschlag, beide
// Beispiele DE und EN über den Generator) nennt in der Zeile «… entscheidet ohne Geschäftsleitung» kein hohes Risiko; die
// Textbausteine des Guides ebenso. Querbezug aller Stellen: entscheide-test8.test.ts «N7».
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { auftraege } from '../../scripts/beispiele.mts';
import type { DocxDokument } from '../../src/generator/ir.ts';
import { kontext, projekt, texte } from './kittexte-hilfen.ts';

const REPO = join(import.meta.dirname, '..', '..');
const ZEILE = { de: 'AIMS-Verantwortliche/r entscheidet ohne Geschäftsleitung', en: 'Decided by the AIMS lead without top management' } as const;
// N7 präzisiert: «allein» heisst «ohne Eigner/in»; ohne Geschäftsleitung entscheidet die
// AIMS-Verantwortung bei tiefem Risiko allein und bei mittlerem mit Eigner/in, nie bei hohem
const MEHR = { de: /hohe[mns]? Risik/i, en: /high risk/i } as const;
const MITTEL = { de: /mittlere[mn]? Risiko[^.;]*Eigner/i, en: /medium risk[^.;]*owner/i } as const;
const TIEF = { de: /tiefem Risiko/, en: /low risk/ } as const;

/** Text der Zeile «… ohne Geschäftsleitung» in D-03: vom Zeilentitel bis zur nächsten Zeile der Tabelle */
function zeileAllein(t: string[], s: 'de' | 'en'): string {
  const i = t.findIndex((x) => x.includes(ZEILE[s]));
  expect(i, 'Zeile in D-03').toBeGreaterThanOrEqual(0);
  return t[i + 1] ?? '';
}

describe('N7: AIMS-Verantwortung allein nur bei tiefem Risiko', () => {
  for (const s of ['de', 'en'] as const) {
    it(`${s}: Vorschlag in der Vorlage D-03 und Textbausteine des Guides`, () => {
      const d03 = parse(readFileSync(join(REPO, `src/i18n/${s}/vorlagen/D-03.yaml`), 'utf8')) as { risikobereitschaft_vorschlag: { aimsAllein: string[] } };
      const vorschlag = d03.risikobereitschaft_vorschlag.aimsAllein.join(' ');
      expect(vorschlag).toMatch(TIEF[s]);
      expect(vorschlag).toMatch(MITTEL[s]);
      expect(vorschlag).not.toMatch(MEHR[s]);
      const g = parse(readFileSync(join(REPO, `src/i18n/${s}/gefuehrt.yaml`), 'utf8')) as { optionen: { rbAimsAllein: Record<string, string> } };
      expect(Object.values(g.optionen.rbAimsAllein).join(' ')).not.toMatch(MEHR[s]);
    });
    it(`${s}: leere Vorlage und beide Beispiele über den Generator`, () => {
      const p0 = projekt('praezisionsteile', s);
      const a0 = auftraege(p0, s).find((x) => x.name.startsWith('D-03_'))!;
      const leer = zeileAllein(texte(a0.vorlage(kontext(p0, 'leer', a0)) as DocxDokument), s);
      expect(leer).toMatch(TIEF[s]);
      expect(leer).toMatch(MITTEL[s]);
      expect(leer).not.toMatch(MEHR[s]);
      for (const b of ['muster-maschinenbau', 'praezisionsteile'] as const) {
        const p = projekt(b, s);
        const a = auftraege(p, s).find((x) => x.name.startsWith('D-03_'))!;
        const allein = zeileAllein(texte(a.vorlage(kontext(p, 'firma', a)) as DocxDokument), s);
        expect(allein, b).toMatch(TIEF[s]);
        expect(allein, b).not.toMatch(MEHR[s]);
      }
    });
    it(`${s}: Muster D-04 lässt die AIMS-Verantwortliche bei mittlerem Risiko nicht allein einführen`, () => {
      const p = projekt('muster-maschinenbau', s);
      const mittel = p.organisation.entscheidungsrechte?.find((e) => e.entscheid === 'einfuehren')?.wer.mittel ?? '';
      expect(mittel).not.toBe(p.organisation.aimsVerantwortlich);
      expect(mittel).toMatch(s === 'de' ? /Eigner\/in des Systems/ : /system owner/);
    });
  }
});

// A-07: Stage-1-Bericht ohne «1 Hinweise»; Zähltexte mit Einzahl
describe('A-07: Zähltexte des Stage-1-Berichts mit Einzahl', () => {
  for (const s of ['de', 'en'] as const) {
    it(s, () => {
      const app = parse(readFileSync(join(REPO, `src/i18n/${s}/app.yaml`), 'utf8')) as { stage1: Record<string, string> };
      expect(app.stage1['regeln_hinweise_eins']).toBe(s === 'de' ? '1 Hinweis' : '1 note');
      expect(app.stage1['regeln_fehler_eins']).toBe(s === 'de' ? '1 Fehler' : '1 error');
      expect(app.stage1['regeln_text']).not.toMatch(/\{hinweise\} (Hinweise|notes)/);
    });
  }
});
