// Restpunkte aus der P20-Prüfung und der Q6-Messung (Release 1.0.0-test.6): H2 (D-03 «ohne Geschäftsleitung», Sätze mit
// grossem Anfang), H4 (PR-07: Restrisiko zuerst nach PR-08), H6 (D-09: Anlagen mit Zahl statt Buchstabe neben Teil A bis C),
// H7 (Rechtsverweise DE einheitlich «Bst.»), C4-03 (unbesetzte Rollen je Prozess für den Hinweis auf der Prozessseite).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { auftraege } from '../../scripts/beispiele.mts';
import type { Block, DocxDokument } from '../../src/generator/ir.ts';
import type { Kataloge } from '../../src/kataloge/typen.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { prozessrollenOhneBesetzung, unbesetzteProzessrollen } from '../../src/regeln/stimmigkeit.ts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';
import { kontext, projekt, texte } from './kittexte-hilfen.ts';

const REPO = join(import.meta.dirname, '..', '..');
const kataloge = JSON.parse(readFileSync(join(REPO, 'src/generiert/kataloge.json'), 'utf8')) as Kataloge;
const ir = (p: Projekt, a: ReturnType<typeof auftraege>[number]) => a.vorlage(kontext(p, 'firma', a)) as DocxDokument;
const dokument = (p: Projekt, name: string) => ir(p, auftraege(p, p.meta.dokumentSprache).find((x) => x.name.startsWith(name))!);
const ueberschriften = (d: DocxDokument) => (d.bloecke as Block[]).filter((b) => b.typ === 'ueberschrift').map((b) => JSON.stringify((b as { text: unknown }).text));

describe('H2: D-03 Risikobereitschaft', () => {
  const LABEL = { de: ['AIMS-Verantwortliche/r entscheidet ohne Geschäftsleitung', 'AIMS-Verantwortliche/r entscheidet allein'], en: ['Decided by the AIMS lead without top management', 'Decided by the AIMS lead alone'] } as const;
  for (const s of ['de', 'en'] as const) {
    it(`${s}: Zeile «ohne Geschäftsleitung» statt «allein»; in der leeren Vorlage beginnt jeder Punkt gross`, () => {
      for (const b of ['muster-maschinenbau', 'praezisionsteile'] as const) {
        const t = texte(dokument(projekt(b, s), 'D-03_')).join(' ');
        expect(t, b).toContain(LABEL[s][0]);
        expect(t, b).not.toContain(LABEL[s][1]);
      }
      const p = projekt('praezisionsteile', s);
      const a = auftraege(p, s).find((x) => x.name.startsWith('D-03_'))!;
      const leer = texte(a.vorlage(kontext(p, 'leer', a)) as DocxDokument).join(' ');
      expect(leer).toContain(LABEL[s][0]);
      expect(leer).toMatch(s === 'de' ? /\(D-04, D-12\)\. Befristete Ausnahmen/ : /\(D-04, D-12\)\. [A-Z]/);
    });
  }
});

describe('H4: PR-07 Hilfe nennt die Reihenfolge Restrisiko vor Freigabe', () => {
  for (const s of ['de', 'en'] as const) {
    it(s, () => {
      const pr = (parse(readFileSync(join(REPO, `src/i18n/${s}/prozesse.yaml`), 'utf8')) as { prozesse: Record<string, { hilfe: string }> }).prozesse;
      expect(pr['PR-07']!.hilfe).toMatch(s === 'de' ? /Restrisiko über der Akzeptanzgrenze.*PR-08.*PR-07\.05 oder PR-07\.10/ : /residual risk.*acceptance threshold.*PR-08.*PR-07\.05 or PR-07\.10/);
    });
  }
});

describe('H6: D-09 Anlagen mit Zahl, Teile mit Buchstabe', () => {
  for (const s of ['de', 'en'] as const) {
    it(`${s}: keine «Anlage A» neben «Teil A»`, () => {
      const p = projekt('muster-maschinenbau', s);
      const liste = auftraege(p, s).filter((x) => x.name.startsWith('D-09'));
      expect(liste.length).toBeGreaterThan(0);
      let anlagen = 0;
      for (const a of liste) {
        const n = a.name;
        const k = ueberschriften(ir(p, a)).join(' ');
        expect(k, n).not.toMatch(s === 'de' ? /Anlage A\b/ : /Appendix A\b/);
        if (/Anlage 1|Appendix 1/.test(k)) anlagen++;
        const t = texte(ir(p, a)).join(' ');
        expect(t, n).not.toMatch(s === 'de' ? /siehe Anlage A\b/ : /see Appendix A\b/);
      }
      expect(anlagen, 'mindestens ein D-09 mit Anlage').toBeGreaterThan(0);
      // leere Vorlage: Anlage «Neubeurteilungen» mit Zahl (Nacharbeit N9)
      const a = liste[0]!;
      const leer = ueberschriften(a.vorlage(kontext(p, 'leer', a)) as DocxDokument).join(' ');
      expect(leer).toMatch(s === 'de' ? /Anlage 1\b/ : /Appendix 1\b/);
      expect(leer).not.toMatch(s === 'de' ? /Anlage A\b/ : /Appendix A\b/);
    });
  }
});

describe('H7: Rechtsverweise DE einheitlich mit «Bst.»', () => {
  it('kein «lit.» in den deutschen Texten, Leitfaden und Guide', () => {
    const dateien = (o: string): string[] => readdirSync(o, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dateien(join(o, e.name)) : /\.(ya?ml|md)$/.test(e.name) ? [join(o, e.name)] : []));
    const treffer = [...dateien(join(REPO, 'src/i18n/de')), ...dateien(join(REPO, 'src/leitfaden/de'))].filter((d) => /\blit\. [a-z]\b/.test(readFileSync(d, 'utf8')));
    expect(treffer.map((d) => d.slice(REPO.length + 1))).toEqual([]);
  });
});

describe('C4-03: unbesetzte Rollen je Prozess', () => {
  it('die Rollen eines Prozesses sind eine Teilmenge der Rollen von F37, und zusammen ergeben sie F37', () => {
    const p = vollstaendigesProjekt();
    const katalog = (kataloge as unknown as { prozesse_katalog: { prozesse: { id: string }[] } }).prozesse_katalog.prozesse;
    p.prozesse = katalog.map((x) => ({ id: x.id, anwendbar: 'ja' as const }));
    p.rollen = [];
    const alle = prozessrollenOhneBesetzung(p, kataloge).flatMap((b) => b.details);
    expect(alle.length).toBeGreaterThan(0);
    const je = katalog.map((x) => unbesetzteProzessrollen(p, kataloge, x.id));
    for (const r of je) for (const x of r) expect(alle).toContain(x);
    expect([...new Set(je.flat())].sort()).toEqual(alle);
    expect(unbesetzteProzessrollen(p, kataloge, 'PR-XX')).toEqual([]);
  });
});
