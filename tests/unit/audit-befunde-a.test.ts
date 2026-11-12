// Kit-Ursachen aus dem simulierten Stage-1-Audit, Teil A:
// N-01 (D-07), N-04 (D-09 Ausmass), N-05 (D-11 EUAIA), N-07/B-15 (D-20-EB, D-22-EB), N-08 (D-21-EB), N-10 (Kit-Texte),
// N-11 (D-10 Freigabeliste), N-16 (Ergänzungsblatt «Übernommen in»), N-17 (D-09 eigene Dokument-ID und Freigabe).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Block, DocxDokument, Text, XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { d07 } from '../../src/vorlagen/D-07.ts';
import { d09 } from '../../src/vorlagen/D-09.ts';
import { d10 } from '../../src/vorlagen/D-10.ts';
import { d11 } from '../../src/vorlagen/D-11.ts';
import { d20 } from '../../src/vorlagen/D-20.ts';
import { d21 } from '../../src/vorlagen/D-21.ts';
import { d22 } from '../../src/vorlagen/D-22.ts';
import { ergaenzungsblatt } from '../../src/vorlagen/ergaenzungsblatt.ts';
import type { Form, Modus, Vorlage, VorlagenKontext } from '../../src/vorlagen/kontext.ts';

const kataloge = ladeKataloge();
const sprachen = ['de', 'en'] as const;
const uebersetzer = { de: erstelleUebersetzer('de', ladeTexte('de')), en: erstelleUebersetzer('en', ladeTexte('en')) };
const beispiel = (sprache: 'de' | 'en'): Projekt => JSON.parse(readFileSync(`src/beispiele/muster-maschinenbau.${sprache}.aims.json`, 'utf8')) as Projekt;

function ctx(sprache: 'de' | 'en', projekt: Projekt, form: Form = 'dokument', modus: Modus = 'firma', kiSystemId?: string): VorlagenKontext {
  return { u: uebersetzer[sprache], modus, form, projekt, kataloge, kitVersion: '1.0.0', kiSystemId };
}
const xlsx = (v: Vorlage, c: VorlagenKontext) => v(c) as XlsxMappe;
const docx = (v: Vorlage, c: VorlagenKontext) => v(c) as DocxDokument;
const text = (t: Text | undefined): string => (t === undefined ? '' : typeof t === 'string' ? t : t.map((l) => l.text).join(''));
const blatt = (m: XlsxMappe, name: string) => m.blaetter.find((b) => b.name === name)!;

describe.each(sprachen)('Audit-Befunde A (%s)', (sprache) => {
  const u = uebersetzer[sprache];

  it('N-01: Behandlungsplan D-07 enthält alle Massnahmen mit Herkunft und Risiken', () => {
    const p = beispiel(sprache);
    const plan = blatt(xlsx(d07, ctx(sprache, p)), u.t('vorlagen.D-07.blaetter.plan'));
    const ids = plan.zeilen.map((z) => z[0]).filter((x) => typeof x === 'string' && /^M-\d+$/.test(x));
    expect(ids).toEqual(p.massnahmen.map((m) => m.id));
    const kopf = plan.spalten.map((s) => s.kopf);
    expect(kopf).toContain(u.liste('vorlagen.D-07.spalten_plan')[2]);
    // M-016 (Herkunft AI Act) behandelt R-014 und R-015 laut Register
    const m009 = plan.zeilen.find((z) => z[0] === 'M-016')!;
    expect(String(m009[2])).toContain(u.liste('vorlagen.D-07.listen.herkunft')[5]!);
    expect(String(m009[3])).toContain('R-014');
    expect(String(m009[3])).toContain('R-015');
  });

  it('N-04: D-09 gibt das Ausmass je Ziel aus', () => {
    const p = beispiel(sprache);
    const ia = p.folgenabschaetzungen.find((f) => f.kiSystem === 'KI-008')!;
    ia.nutzenSchaden.fairness = { ...(ia.nutzenSchaden.fairness ?? { nutzen: '', schaden: '' }), ausmass: 3 };
    const ir = docx(d09, ctx(sprache, p, 'dokument', 'firma', 'KI-008'));
    const tabelle = ir.bloecke.find((b): b is Extract<Block, { typ: 'tabelle' }> => b.typ === 'tabelle' && String(b.kopf[3]).startsWith(u.liste('vorlagen.D-09.nutzen_kopf')[3]!.split(' (')[0]!))!;
    const zeile = tabelle.zeilen.find((z) => text(z[0]) === u.t('vorlagen.D-09.ziele.fairness.name'))!;
    expect(text(zeile[3])).toMatch(/^3\b/);
  });

  it('N-17: jede Folgenabschätzung hat eine eigene Dokument-ID und die Freigabe aus der Abschätzung', () => {
    const p = beispiel(sprache);
    for (const ia of p.folgenabschaetzungen) {
      const ir = docx(d09, ctx(sprache, p, 'dokument', 'firma', ia.kiSystem));
      expect(ir.lenkung.dokumentId).toBe(`D-09-${ia.kiSystem}`);
      const von = p.personen.find((x) => x.id === ia.freigabe?.von)!;
      expect(text(ir.lenkung.freigabeDurch)).toContain(von.name);
    }
  });

  it('N-05: SoA führt nur erfasste EUAIA-Controls; «nicht anwendbar» ohne Status', () => {
    const p = beispiel(sprache);
    const soa = blatt(xlsx(d11, ctx(sprache, p)), u.t('vorlagen.D-11.blaetter.soa'));
    const euaia = soa.zeilen.filter((z) => typeof z[0] === 'string' && z[0].startsWith('EUAIA-')).map((z) => z[0]);
    expect(euaia).toEqual(p.controls.filter((c) => c.rahmenwerk === 'EUAIA').map((c) => c.id));
    for (const z of soa.zeilen.filter((x) => x[2] === u.t('allgemein.nein'))) expect(z[5], String(z[0])).toBe('');
    // EUAIA-06 ist im Beispiel entschieden (N-14); EUAIA-07 bleibt in der Zeile «nicht aufgenommen»
    expect(soa.zeilen.some((z) => z[0] === 'EUAIA-06')).toBe(true);
    expect(soa.zeilen.some((z) => String(z[1] ?? '').includes('EUAIA-07'))).toBe(true);
    // Leere Vorlage: ganzer Katalog
    const leer = blatt(xlsx(d11, ctx(sprache, p, 'dokument', 'leer')), u.t('vorlagen.D-11.blaetter.soa'));
    expect(leer.zeilen.filter((z) => typeof z[0] === 'string' && z[0].startsWith('EUAIA-')).length).toBeGreaterThan(euaia.length);
  });

  it('N-07: D-20-EB enthält Auditplan, Auditergebnis und Feststellungen', () => {
    const p = beispiel(sprache);
    const m = xlsx(d20, ctx(sprache, p, 'ergaenzungsblatt'));
    expect(m.blaetter.map((b) => b.name)).toEqual(['programm', 'plan', 'checkliste', 'stichproben', 'feststellungen'].map((b) => u.t(`vorlagen.D-20.blaetter.${b}`)));
    const au = blatt(m, u.t('vorlagen.D-20.blaetter.programm')).zeilen.find((z) => String(z[1]).startsWith('AU-001'))!;
    expect(au.at(-1)).toContain(p.audits[0]!.ergebnis);
    expect(au.at(-1)).toContain(p.audits[0]!.bericht!);
    const fest = blatt(m, u.t('vorlagen.D-20.blaetter.feststellungen')).zeilen.map((z) => z[0]);
    expect(fest).toEqual(expect.arrayContaining(['F-001', 'F-002', 'F-003']));
    const check = blatt(m, u.t('vorlagen.D-20.blaetter.checkliste'));
    expect(check.zeilen.find((z) => z[0] === 'A.6.2.5')![8]).toBe('F-001');
    // Leere Vorlage: Ergänzungsblatt nur Programm, Checkliste und Stichproben
    expect(xlsx(d20, ctx(sprache, p, 'ergaenzungsblatt', 'leer')).blaetter).toHaveLength(3);
  });

  it('B-15: D-22-EB enthält den Auszug der Nichtkonformitäten mit Verweis auf das führende Register', () => {
    const p = beispiel(sprache);
    const m = xlsx(d22, ctx(sprache, p, 'ergaenzungsblatt'));
    const nk = blatt(m, u.t('vorlagen.D-22.blaetter.nk'));
    expect(nk.zeilen.map((z) => z[0])).toEqual(expect.arrayContaining(['F-001', 'F-002', 'F-003']));
    const register = p.dokumente.find((d) => d.id === 'D-22-EB')!.aufgenommenIn!;
    expect(nk.hinweise?.join(' ')).toContain(register);
  });

  it('N-08: D-21-EB mit Rahmen, Pflichteingaben und Spalte «Verantwortlich, Termin, Massnahme»', () => {
    const p = beispiel(sprache);
    const mb = p.managementbewertungen.at(-1)!;
    const ir = docx(d21, ctx(sprache, p, 'ergaenzungsblatt'));
    const json = JSON.stringify(ir);
    expect(json).toContain(mb.teilnehmende);
    expect(json).toContain(mb.eingaben.statusMassnahmen);
    expect(json).toContain(mb.eingaben.leistung);
    expect(json).toContain(mb.eingaben.weitere);
    const tabellen = ir.bloecke.filter((b): b is Extract<Block, { typ: 'tabelle' }> => b.typ === 'tabelle');
    const entscheide = tabellen.find((t) => t.kopf[1] === u.liste('vorlagen.D-21.entscheide_kopf')[1])!;
    expect(entscheide.kopf[3]).toBe(u.liste('vorlagen.D-21.entscheide_kopf')[3]);
    // keine Zeile ohne Traktandum
    for (const t of tabellen.filter((x) => x.kopf[0] === u.liste('vorlagen.D-21.agenda_kopf')[0])) for (const z of t.zeilen) expect(text(z[1])).not.toBe('');
  });

  it('N-11: Freigabeliste D-10 gibt Freigabe und Begründung aus; D-10-EB ergänzt das Asset-Inventar', () => {
    const p = beispiel(sprache);
    const s = p.kiSysteme.find((x) => x.id === 'KI-005')!;
    s.datenklasse = 'intern';
    s.auflagen = 'nur bis Klasse intern';
    const m = xlsx(d10, ctx(sprache, p, 'ergaenzungsblatt'));
    const z = blatt(m, u.t('vorlagen.D-10.blaetter.freigabe')).zeilen.find((x) => x[1] === 'KI-005')!;
    expect(z[4]).toBe('nur bis Klasse intern');
    expect(z[5]).toBe(u.liste('vorlagen.D-10.listen.datenklasse')[1]);
    expect(z[7]).toBe(p.personen.find((x) => x.id === s.freigabe!.von)!.name);
    expect(z[8]).toBe(s.freigabe!.am);
    expect(m.lenkung.ismsBezug).not.toBe(u.t('allgemein.isms.neu'));
    // ISMS-Dokument mit Version aus dem Register (aufgenommenIn), sonst die allgemeine Bezeichnung (Stage 1 Runde 3, M28)
    expect(m.lenkung.ismsBezug).toContain(p.dokumente.find((d) => d.id === 'D-10-EB')?.aufgenommenIn ?? u.t('ergaenzungsblaetter.ismsDokumente.isms-asset-inventar'));
  });

  it('N-16: Ergänzungsblatt nennt bei der Übernahme das ISMS-Dokument mit Version', () => {
    const p = beispiel(sprache);
    const ir = ergaenzungsblatt(ctx(sprache, p, 'ergaenzungsblatt'), 'D-07-EB');
    const felder = ir.bloecke.filter((b): b is Extract<Block, { typ: 'felder' }> => b.typ === 'felder').at(-1)!;
    const uebernommen = felder.felder.find((f) => f.label === u.t('vorlagen.ergaenzungsblatt.uebernahme_felder.version'))!;
    expect(text(uebernommen.wert)).toBe(p.dokumente.find((d) => d.id === 'D-07-EB')!.aufgenommenIn);
    // ohne Angabe im Firmendokument: Feld weglassen
    p.dokumente.find((d) => d.id === 'D-07-EB')!.aufgenommenIn = undefined;
    const ohne = ergaenzungsblatt(ctx(sprache, p, 'ergaenzungsblatt'), 'D-07-EB');
    const felderOhne = ohne.bloecke.filter((b): b is Extract<Block, { typ: 'felder' }> => b.typ === 'felder').at(-1)!;
    expect(felderOhne.felder.some((f) => f.label === u.t('vorlagen.ergaenzungsblatt.uebernahme_felder.version'))).toBe(false);
  });

  it('N-10: keine Kit-Texte und keine Ausbaustufen in Firmendokumenten', () => {
    const p = beispiel(sprache);
    const kit = sprache === 'de' ? /\bKit\b|Wo im Kit|Im Projekt ist/ : /\bkit\b|in the project/i;
    const irs = [
      d07(ctx(sprache, p)),
      d09(ctx(sprache, p, 'dokument', 'firma', 'KI-002')),
      d09(ctx(sprache, p, 'dokument', 'firma', 'KI-006')),
      d10(ctx(sprache, p, 'ergaenzungsblatt')),
      d11(ctx(sprache, p)),
      d20(ctx(sprache, p, 'ergaenzungsblatt')),
      d21(ctx(sprache, p, 'ergaenzungsblatt')),
      d22(ctx(sprache, p, 'ergaenzungsblatt')),
      ergaenzungsblatt(ctx(sprache, p, 'ergaenzungsblatt'), 'D-07-EB'),
    ];
    for (const ir of irs) {
      const json = JSON.stringify(ir);
      expect(json, ir.lenkung.dokumentId).not.toMatch(kit);
      expect(json, ir.lenkung.dokumentId).not.toContain('"art":"ausbau"');
      expect(json, ir.lenkung.dokumentId).not.toContain('"art":"ausfuellhinweis"');
    }
  });
});
