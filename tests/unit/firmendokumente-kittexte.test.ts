// Firmendokumente ohne Kit-Texte (Stage-1-Audit N-10): Alle Vorlagen werden im Modus «firma» mit beiden Beispielprojekten
// (src/beispiele/*.aims.json, DE und EN) in beiden Pfaden (mit und ohne ISMS) erzeugt und auf Kit-Wörter geprüft:
// Bezug auf das Kit, die Vorlage, Releases, Starter-Kit, KMU-CIO, Ausbaustufen, «Wo im Kit» und Anweisungen an die
// Ausfüllenden («Tragen Sie …», «Enter …»). Projektdaten (Texte aus der Projektdatei) zählen nicht als Treffer.
//
// Regel: Firmendokumente (Modus firma, beispiel ausser Kennzeichnung) enthalten keine Anleitungen an den Ausfüllenden und
// keinen Bezug auf das Kit. Leere Vorlagen behalten ihre Hinweise und die Namensnennung.
import { describe, expect, it } from 'vitest';
import { auftraege } from '../../scripts/beispiele.mts';
import type { DocxDokument } from '../../src/generator/ir.ts';
import { d01 } from '../../src/vorlagen/D-01.ts';
import { d02 } from '../../src/vorlagen/D-02.ts';
import { d21 } from '../../src/vorlagen/D-21.ts';
import { EIGENE_EB_FORM } from '../../src/vorlagen/index.ts';
import { NUR_ALS_EB_MIT_ISMS, type Modus, type VorlagenKontext } from '../../src/vorlagen/kontext.ts';
import { AUSNAHMEN, datenTexte, FIRMEN, kontext, pfadMuster, projekt, SPRACHEN, suche } from './kittexte-hilfen.ts';

describe('Firmendokumente ohne Kit-Texte (N-10)', () => {
  for (const firma of FIRMEN) {
    for (const sprache of SPRACHEN) {
      for (const pfadUmgekehrt of [false, true]) {
        const p = projekt(firma, sprache);
        if (pfadUmgekehrt) p.meta.mitIsms = !p.meta.mitIsms;
        const pfad = p.meta.mitIsms ? 'mit ISMS' : 'ohne ISMS';
        const daten = [...new Set(datenTexte(p))];
        describe(`${firma} ${sprache.toUpperCase()} ${pfad}`, () => {
          for (const a of auftraege(p, sprache)) {
            const ir = a.vorlage(kontext(p, 'firma', a));
            const treffer = suche(ir, sprache, daten, pfadMuster(p)).filter((t) => !AUSNAHMEN.some((x) => x.id.test(a.name) && x.text.test(t.text)));
            const liste = treffer.map((t) => `${t.muster}: «${t.text}»`);
            it(a.name, () => {
              expect(liste).toEqual([]);
            });
          }
        });
      }
    }
  }
});

// Modul NIST AI RMF (ab rc.2): Die Beispiele haben das Modul nicht eingeschaltet. Mit eingeschaltetem Modul entstehen N-01
// bis N-04, und D-09, D-11, D-12, D-24, D-25 erhalten die Modulabschnitte; auch diese sind frei von Kit-Texten.
const MIT_NIST = /^(?:N-0[1-4]|D-09|D-11|D-12|D-24|D-25)/;
describe('Firmendokumente ohne Kit-Texte mit Modul NIST AI RMF (N-01 bis N-04)', () => {
  for (const firma of FIRMEN) {
    for (const sprache of SPRACHEN) {
      for (const pfadUmgekehrt of [false, true]) {
        const p = projekt(firma, sprache);
        p.meta.modulNistRmf = true;
        if (pfadUmgekehrt) p.meta.mitIsms = !p.meta.mitIsms;
        const pfad = p.meta.mitIsms ? 'mit ISMS' : 'ohne ISMS';
        const daten = [...new Set(datenTexte(p))];
        const liste = auftraege(p, sprache).filter((a) => MIT_NIST.test(a.name));
        describe(`${firma} ${sprache.toUpperCase()} ${pfad}`, () => {
          it('N-01 bis N-04 werden erzeugt', () => {
            expect(liste.filter((a) => /^N-/.test(a.name)).map((a) => a.name.slice(0, 4))).toEqual(['N-01', 'N-02', 'N-03', 'N-04']);
          });
          for (const a of liste) {
            const ir = a.vorlage(kontext(p, 'firma', a));
            const treffer = suche(ir, sprache, daten, pfadMuster(p)).filter((t) => !AUSNAHMEN.some((x) => x.id.test(a.name) && x.text.test(t.text)));
            it(a.name, () => {
              expect(treffer.map((t) => `${t.muster}: «${t.text}»`)).toEqual([]);
            });
          }
        });
      }
    }
  }
  it('ohne Modul keine N-Dokumente und kein Verweis darauf', () => {
    const p = projekt('praezisionsteile', 'de');
    expect(p.meta.modulNistRmf).not.toBe(true);
    expect(auftraege(p, 'de').some((a) => /^N-/.test(a.name))).toBe(false);
  });
});

describe('Kit-Texte nur in leeren Vorlagen', () => {
  const p = projekt('muster-maschinenbau', 'de');
  const ctx = (modus: Modus): VorlagenKontext => kontext(p, modus, { form: 'dokument' });

  it('Pfad im Lenkungskopf nur in der leeren Vorlage', () => {
    expect(d01(ctx('leer')).lenkung.pfad).not.toBe('');
    expect(d01(ctx('firma')).lenkung.pfad).toBe('');
    expect(d01(ctx('beispiel')).lenkung.pfad).toBe('');
  });

  it('Ausbaustufen: Kasten nur in der leeren Vorlage, Namensnennung bleibt', () => {
    const leer = d01(ctx('leer')) as DocxDokument;
    expect(leer.bloecke.some((b) => b.typ === 'hinweis' && b.art === 'ausbau')).toBe(true);
    expect(leer.bloecke.some((b) => b.typ === 'hinweis' && b.art === 'namensnennung')).toBe(true);
    for (const modus of ['firma', 'beispiel'] as Modus[]) {
      const ir = d01(ctx(modus)) as DocxDokument;
      expect(ir.bloecke.some((b) => b.typ === 'hinweis' && b.art === 'ausbau')).toBe(false);
    }
  });

  it('Unterschriften mit bekannter Freigabe statt «Name, Funktion»', () => {
    const ir = d02(ctx('firma')) as DocxDokument;
    const u = ir.bloecke.find((b) => b.typ === 'unterschriften');
    expect(u && u.typ === 'unterschriften' && u.felder.every((f) => typeof f !== 'string')).toBe(true);
    const leer = d02(ctx('leer')) as DocxDokument;
    const ul = leer.bloecke.find((b) => b.typ === 'unterschriften');
    expect(ul && ul.typ === 'unterschriften' && ul.felder.every((f) => typeof f === 'string')).toBe(true);
  });

  it('Beispiele (Modus beispiel) haben ausser der Kennzeichnung keine Kit-Texte', () => {
    const daten = [...new Set(datenTexte(p))];
    const treffer = auftraege(p, 'de')
      .flatMap((a) =>
        suche(a.vorlage(kontext(p, 'beispiel', a)), 'de', daten)
          .filter((t) => !AUSNAHMEN.some((x) => x.id.test(a.name) && x.text.test(t.text)))
          .map((t) => `${a.name}: ${t.text}`),
      );
    expect(treffer).toEqual([]);
  });

  it('ISMS-Bezug im Lenkungskopf nur im Pfad mit ISMS (Stage-1-Audit 2, P8)', () => {
    const ohne = projekt('praezisionsteile', 'de');
    expect(ohne.meta.mitIsms).toBe(false);
    expect(d01(kontext(ohne, 'firma', { form: 'dokument' })).lenkung.ismsBezug).toBe('');
    expect(d01(ctx('firma')).lenkung.ismsBezug).not.toBe('');
    expect(d01(kontext(ohne, 'leer', { form: 'dokument' })).lenkung.ismsBezug).not.toBe('');
  });

  it('D-21: Kennung, Nr. 5 und 6 aus den Projektdaten, Unterschriften aus Freigaben (Stage-1-Audit 2, M6, P10, H7)', () => {
    for (const firma of FIRMEN) {
      const q = projekt(firma, 'de');
      const ir = d21(kontext(q, 'firma', { form: q.meta.mitIsms ? 'ergaenzungsblatt' : 'dokument' }));
      const json = JSON.stringify(ir);
      const mb = q.managementbewertungen.at(-1)!;
      expect(json).toContain(mb.id);
      const audit = q.audits.find((x) => x.art === 'intern' && x.durchgefuehrt)!;
      expect(json).toContain(audit.id);
      expect(json).toContain(q.ziele[0]!.id);
      const u = ir.bloecke.filter((b) => b.typ === 'unterschriften');
      expect(u.every((b) => b.typ === 'unterschriften' && b.felder.every((f) => typeof f !== 'string'))).toBe(true);
    }
  });

  it('Liste der Vorlagen mit eigener EB-Form stimmt mit index.ts überein', () => {
    expect([...NUR_ALS_EB_MIT_ISMS].sort()).toEqual([...EIGENE_EB_FORM].sort());
  });
});
