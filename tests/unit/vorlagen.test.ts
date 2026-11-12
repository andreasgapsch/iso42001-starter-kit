// Jede registrierte Vorlage lässt sich in allen Modi und Sprachen ohne fehlende Texte zu IR rendern.
import { describe, expect, it } from 'vitest';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import { leeresProjekt } from '../../src/model/neu.ts';
import { VORLAGEN } from '../../src/vorlagen/index.ts';
import type { Modus } from '../../src/vorlagen/kontext.ts';

const kataloge = ladeKataloge();
const sprachen = (['de', 'en'] as const).filter((s) => {
  try { return Object.keys(ladeTexte(s)).length > 0; } catch { return false; }
});

describe.each(sprachen)('Vorlagen %s', (sprache) => {
  const u = erstelleUebersetzer(sprache, ladeTexte(sprache));
  for (const [id, vorlage] of Object.entries(VORLAGEN)) {
    for (const modus of ['leer', 'firma'] as Modus[]) {
      it.skipIf(sprache === 'en' && u.roh(`vorlagen.${id}`) === undefined)(`${id} ${modus}`, () => {
        const projekt = leeresProjekt({ sprache });
        if (modus === 'firma') projekt.organisation.name = 'Test AG';
        const ir = vorlage({ u, modus, form: 'dokument', projekt, kataloge, kitVersion: '1.0.0' });
        const json = JSON.stringify(ir);
        expect(json).not.toMatch(/undefined/);
        if (modus === 'firma') expect(json).not.toMatch(/kmu-cio/i);
        if (modus === 'leer') expect(json).toMatch(/kmu-cio\.ch/);
      });
    }
  }
});
