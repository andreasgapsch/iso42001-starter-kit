// P19 (Runde 4, AF-079, AF-138): Rollen der Prozessbahnen besetzbar (C4-02) und neue RACI-Zeile mit Feldern (C4-01).
// C4-02: Jede Bahnrolle des Prozesskatalogs ist über ein vorhandenes Feld besetzbar, entweder als Bereich einer Zeile der
// Zuständigkeiten (Rolle.bereich, Optionsgruppe rollenBereich) oder über «Rolle im Projekt» einer Person (Person.aimsRollen,
// Optionsgruppe aimsRolle). Bisher besetzten dsb, ism und auditor die Bahnen datenschutz, informationssicherheit und
// internes-audit nicht, und F37 nannte das nicht existierende Feld «Funktion im AIMS».
// C4-01: Eine neue Zeile im Register «Rollen und Personen» und auf der Guide-Seite E3-raci erhält einen Bereich, den die
// Seiten zeigen, und damit ihre Felder (Bereich, R, A, Stellvertretung).
// C4-07: Nachweise ohne «kein Eintrag nötig». C4-08: F15 vor dem Termin eines geplanten internen Audits offen, nicht Fehler jetzt.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { neuerEintrag, passendZumFilter } from '../../src/app/logik/eintraege.ts';
import { formularFelder, registerFilter, sichtbareFelder } from '../../src/app/logik/formularfelder.ts';
import { filterPasst } from '../../src/app/logik/bedingungen.ts';
import type { GefuehrtDaten, SeiteDef } from '../../src/app/logik/gefuehrt-typen.ts';
import { gefuehrtSprung } from '../../src/app/logik/pruefsprung.ts';
import type { Kataloge } from '../../src/kataloge/typen.ts';
import type { Projekt, Rolle } from '../../src/model/typen.ts';
import { BAHN_DER_AIMSROLLE, personHatRolle, personZurRolle } from '../../src/prozesse/katalog.ts';
import { auditDurchgefuehrt, pruefeProjekt, type Regel } from '../../src/regeln/pruefungen.ts';
import { fehlerDosiert } from '../../src/app/logik/fehler-dosiert.ts';
import { nichtNoetigMoeglich, type Umfeld } from '../../src/app/logik/gefuehrt.ts';
import { prozessrollenOhneBesetzung } from '../../src/regeln/stimmigkeit.ts';
import { CONTROLS_42001, vollstaendigesProjekt } from '../fixtures/projekt.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { VORLAGEN } from '../../src/vorlagen/index.ts';
import type { DocxDokument } from '../../src/generator/ir.ts';

const REPO = join(import.meta.dirname, '..', '..');
const json = <T>(rel: string): T => JSON.parse(readFileSync(join(REPO, rel), 'utf8')) as T;
const gefuehrt = json<GefuehrtDaten>('src/generiert/gefuehrt.json');
const kataloge = json<Kataloge>('src/generiert/kataloge.json');
const regeln = (parse(readFileSync(join(REPO, 'src/regeln/pruefregeln.yaml'), 'utf8')) as { regeln: Regel[] }).regeln;
const optionen = (gefuehrt as unknown as { optionen: Record<string, string[]> }).optionen;
const AIMS_ROLLE = optionen['aimsRolle']!;
const ROLLEN_BEREICH = optionen['rollenBereich']!;
const katalog = kataloge.prozesse_katalog as { prozesse: { id: string; schritte?: { bahn: string }[] }[] };

/** Rollen, die in jedem Fall eine Stelle haben (wie ROLLEN_OHNE_BESETZUNG in src/regeln/stimmigkeit.ts) */
const IMMER_BESETZT = new Set(['gl', 'aims', 'ki-eigner', 'mitarbeitende']);
const BAHNROLLEN = [...new Set(katalog.prozesse.flatMap((x) => (x.schritte ?? []).map((s) => s.bahn)))].filter((r) => !IMMER_BESETZT.has(r)).sort();

/** Projekt mit allen Katalogprozessen anwendbar, ohne Zeilen der Zuständigkeiten und mit den gegebenen Personen */
function mitAllenProzessen(mitIsms: boolean, personen: Projekt['personen']): Projekt {
  const p = vollstaendigesProjekt();
  p.meta.mitIsms = mitIsms;
  p.prozesse = katalog.prozesse.map((x) => ({ id: x.id, anwendbar: 'ja' as const }));
  p.rollen = [];
  p.personen = [{ id: 'P-001', name: 'Anna Muster', funktion: 'CIO', aimsRollen: ['aims'] }, ...personen];
  return p;
}
const unbesetzt = (p: Projekt) => prozessrollenOhneBesetzung(p, kataloge as never).flatMap((b) => b.details);

describe('C4-02: Bahnrollen über vorhandene Felder besetzbar', () => {
  it('der Katalog nutzt die drei Rollen mit abweichendem Schlüssel als Bahn', () => {
    for (const bahn of ['datenschutz', 'informationssicherheit', 'internes-audit']) expect(BAHNROLLEN).toContain(bahn);
  });

  it('Eigenschaft: jede Bahnrolle ist ein Rollenbereich oder über eine Option von «Rolle im Projekt» besetzbar', () => {
    for (const rolle of BAHNROLLEN) {
      const alsBereich = ROLLEN_BEREICH.includes(rolle);
      const alsFunktion = AIMS_ROLLE.some((f) => personHatRolle({ aimsRollen: [f] }, rolle));
      expect(alsBereich || alsFunktion, rolle).toBe(true);
    }
    // Bahnen, zu denen «Rolle im Projekt» eine gleichnamige Funktion anbietet, besetzt diese Funktion (Messung Q6: Datenschutz,
    // Informationssicherheit, interne Auditorin; Recht heisst gleich)
    const gleichnamig: Record<string, string> = { datenschutz: 'dsb', informationssicherheit: 'ism', 'internes-audit': 'auditor', recht: 'recht' };
    for (const [bahn, f] of Object.entries(gleichnamig)) expect(personHatRolle({ aimsRollen: [f] }, bahn), `${f} → ${bahn}`).toBe(true);
    // die Zuordnung nennt nur vorhandene Optionen auf beiden Seiten
    for (const [f, bahn] of Object.entries(BAHN_DER_AIMSROLLE)) {
      expect(AIMS_ROLLE).toContain(f);
      expect(ROLLEN_BEREICH).toContain(bahn);
    }
  });

  for (const mitIsms of [false, true]) {
    it(`${mitIsms ? 'mit' : 'ohne'} ISMS: je Bahnrolle mit Funktion besetzt fehlt sie in F37`, () => {
      for (const rolle of BAHNROLLEN) {
        const f = AIMS_ROLLE.find((x) => personHatRolle({ aimsRollen: [x] }, rolle));
        if (!f) continue;
        const p = mitAllenProzessen(mitIsms, [{ id: 'P-002', name: 'Bea Bahn', funktion: 'Leiterin', aimsRollen: [f] }]);
        expect(unbesetzt(p), `${rolle} über ${f}`).not.toContain(rolle);
      }
    });

    it(`${mitIsms ? 'mit' : 'ohne'} ISMS: alle Funktionen und alle Bereiche der Zuständigkeiten besetzt ergibt kein F37`, () => {
      const p = mitAllenProzessen(mitIsms, [{ id: 'P-002', name: 'Bea Bahn', funktion: 'Leiterin', aimsRollen: [...AIMS_ROLLE] }]);
      // Nur mit Funktionen: offen bleiben genau die Bahnrollen, die keine Funktion besetzt (Bereiche wie risikomanagement)
      const nurFunktion = BAHNROLLEN.filter((r) => !AIMS_ROLLE.some((f) => personHatRolle({ aimsRollen: [f] }, r)));
      for (const r of unbesetzt(p)) expect(nurFunktion).toContain(r);
      for (const r of ['datenschutz', 'informationssicherheit', 'internes-audit', 'recht', 'hr', 'kommunikation', 'fachbereich', 'it', 'einkauf']) expect(unbesetzt(p)).not.toContain(r);
      p.rollen = ROLLEN_BEREICH.map((b, i): Rolle => ({ id: `RO-${String(i + 1).padStart(3, '0')}`, bereich: b, verantwortlich: 'P-002', konsultiert: [], informiert: [] }));
      expect(unbesetzt(p)).toEqual([]);
    });
  }

  it('Fall der Messung: Anna Fischer mit «Datenschutz», ISM und Auditorin besetzen ihre Bahnen (F37 und Prozessansicht)', () => {
    const p = mitAllenProzessen(true, [
      { id: 'P-002', name: 'Anna Fischer', funktion: 'Datenschutzberaterin', aimsRollen: ['dsb'] },
      { id: 'P-003', name: 'Marc Keller', funktion: 'ISO', aimsRollen: ['ism'] },
      { id: 'P-004', name: 'Lea Graf', funktion: 'Qualität', aimsRollen: ['auditor'] },
    ]);
    const offen = unbesetzt(p);
    for (const r of ['datenschutz', 'informationssicherheit', 'internes-audit']) expect(offen).not.toContain(r);
    expect(personZurRolle(p, 'datenschutz')).toBe('P-002');
    expect(personZurRolle(p, 'informationssicherheit')).toBe('P-003');
    expect(personZurRolle(p, 'internes-audit')).toBe('P-004');
  });

  it('F37 bleibt bei wirklich unbesetzter Rolle und springt ins Register «Rollen und Personen» und auf E3-raci', () => {
    const p = mitAllenProzessen(false, [{ id: 'P-002', name: 'Bea Bahn', funktion: 'Leiterin', aimsRollen: ['dsb'] }]);
    const f37 = pruefeProjekt(regeln, { projekt: p, heute: '2027-02-15', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge }).filter((b) => b.regel === 'F37');
    expect(f37).toHaveLength(1);
    expect(f37[0]!.rollen).not.toContain('datenschutz');
    expect(f37[0]!.rollen).toContain('risikomanagement');
    expect(regeln.find((r) => r.id === 'F37')?.ziel).toBe('organisation/rollen');
    expect(gefuehrtSprung({ regel: 'F37', id: 'D-04' }, p, gefuehrt)).toMatchObject({ art: 'gefuehrt', seite: 'E3-raci' });
  });

  it('Meldetext DE und EN nennt das vorhandene Feld «Rolle im Projekt» und die Zeile der Zuständigkeiten', () => {
    const de = parse(readFileSync(join(REPO, 'src/i18n/de/regeln.yaml'), 'utf8')) as Record<string, { erklaerung: string }>;
    const en = parse(readFileSync(join(REPO, 'src/i18n/en/regeln.yaml'), 'utf8')) as Record<string, { erklaerung: string }>;
    const labelDe = (parse(readFileSync(join(REPO, 'src/i18n/de/gefuehrt/E1.yaml'), 'utf8')) as Record<string, { felder: Record<string, { label: string }> }>)['E1-team']!.felder['aimsRollen']!.label;
    const labelEn = (parse(readFileSync(join(REPO, 'src/i18n/en/gefuehrt/E1.yaml'), 'utf8')) as Record<string, { felder: Record<string, { label: string }> }>)['E1-team']!.felder['aimsRollen']!.label;
    expect(de['F37']!.erklaerung).toContain(`«${labelDe}»`);
    expect(en['F37']!.erklaerung).toContain(`‘${labelEn}’`);
    expect(de['F37']!.erklaerung).not.toContain('Funktion im AIMS');
    expect(en['F37']!.erklaerung).not.toMatch(/function in the AIMS/i);
    expect(de['F37']!.erklaerung).toContain('«Rolle erfassen»');
    expect(en['F37']!.erklaerung).toContain('‘Add role’');
  });
});

describe('P19-Prüfung N1: Zeile der Zuständigkeiten besetzt die Bahn nur mit verantwortlicher Person', () => {
  it('Zeile Datenschutz ohne Person: F37 nennt datenschutz; mit Person nicht mehr (wie F14)', () => {
    const p = mitAllenProzessen(false, [{ id: 'P-002', name: 'Bea Bahn', funktion: 'Leiterin', aimsRollen: ['it'] }]);
    p.rollen = [{ id: 'RO-001', bereich: 'datenschutz', konsultiert: [], informiert: [] }];
    expect(unbesetzt(p)).toContain('datenschutz');
    p.rollen[0]!.verantwortlich = '';
    expect(unbesetzt(p)).toContain('datenschutz');
    p.rollen[0]!.verantwortlich = 'P-002';
    expect(unbesetzt(p)).not.toContain('datenschutz');
  });
});

describe('P19-Prüfung N2: D-04 nennt die Person mit «Datenschutz» bei der Bahn Datenschutz', () => {
  const texte = (w: unknown, aus: string[] = []): string[] => {
    if (typeof w === 'string') aus.push(w);
    else if (Array.isArray(w)) for (const x of w) texte(x, aus);
    else if (w && typeof w === 'object') for (const x of Object.values(w)) texte(x, aus);
    return aus;
  };
  it('Bahn Datenschutz: Bea Bahn statt «noch nicht zugewiesen»', () => {
    const p = mitAllenProzessen(false, [{ id: 'P-002', name: 'Bea Bahn', funktion: 'Datenschutzberaterin', aimsRollen: ['dsb'] }]);
    p.meta.dokumentSprache = 'de';
    const u = erstelleUebersetzer('de', ladeTexte('de'));
    const d = VORLAGEN['D-04']!({ u, modus: 'firma', form: 'dokument', projekt: p, kataloge, kitVersion: '1.0.0' } as never) as DocxDokument;
    const alle = texte(d.bloecke);
    const zeile = alle.find((t) => t.startsWith('Datenschutz: '));
    expect(zeile, alle.filter((t) => t.includes(':')).slice(0, 40).join(' | ')).toBeDefined();
    expect(zeile).toContain('Bea Bahn');
    expect(zeile).not.toContain(u.t('vorlagen.D-04.prozessrollen_offen'));
  });
});

describe('C4-01: neue RACI-Zeile mit Feldern', () => {
  const seite = (id: string) => gefuehrt.seiten.find((s) => s.id === id) as SeiteDef;
  const felderRollen = formularFelder(gefuehrt, 'rollen');

  it('Register: der Filter der Rollenseiten umfasst alle Bereiche der Pflichtrollen und der RACI', () => {
    const f = registerFilter(felderRollen);
    expect(f?.['bereich']).toEqual(expect.arrayContaining([...seite('E3-pflichtrollen').filter!['bereich']!, ...seite('E3-raci').filter!['bereich']!]));
    // Listen mit einer ungefilterten Seite (z. B. Inventar) bekommen keinen Filter
    expect(registerFilter(formularFelder(gefuehrt, 'kiSysteme'))).toBeUndefined();
    expect(registerFilter(formularFelder(gefuehrt, 'personen'))).toBeUndefined();
  });

  it('Register: neue Rolle erhält einen freien Bereich und zeigt Bereich, R, A, Stellvertretung', () => {
    const p = vollstaendigesProjekt();
    const vorher = new Set(p.rollen.map((r) => r.bereich));
    const e = neuerEintrag(p, 'rollen', {}, registerFilter(felderRollen));
    expect(e['bereich']).not.toBe('');
    expect(vorher.has(String(e['bereich']))).toBe(false);
    const pfade = sichtbareFelder(felderRollen, p, e).map((f) => f.feld.pfad);
    expect(pfade).toEqual(expect.arrayContaining(['bereich', 'verantwortlich', 'rechenschaft', 'stellvertretung']));
    // ohne Filter (bisheriges Verhalten): leerer Bereich, keine Felder
    const ohne = neuerEintrag(p, 'rollen', {});
    expect(sichtbareFelder(felderRollen, p, ohne)).toEqual([]);
  });

  it('Guide E3-raci: «Eintrag erfassen» legt eine Zeile an, die auf der Seite erscheint (auch nach den sechs Startwerten)', () => {
    const p = vollstaendigesProjekt();
    p.rollen = [];
    const raci = seite('E3-raci');
    for (const w of raci.startwerte ?? []) p.rollen.push(neuerEintrag(p, 'rollen', w, raci.filter) as unknown as Rolle);
    const e = neuerEintrag(p, 'rollen', {}, raci.filter);
    expect(filterPasst(e, raci.filter)).toBe(true);
    expect(p.rollen.map((r) => r.bereich)).not.toContain(e['bereich']);
    // Pflichtrollen bekommen ihren Bereich ebenso
    const pf = neuerEintrag(p, 'rollen', {}, seite('E3-pflichtrollen').filter);
    expect(['konformitaet', 'berichterstattung']).toContain(pf['bereich']);
  });

  it('passendZumFilter lässt passende Werte, Vorgaben, Listenfelder und «*» unberührt', () => {
    expect(passendZumFilter({ art: 'risiko' }, { art: ['risiko'] }, [])).toEqual({ art: 'risiko' });
    expect(passendZumFilter({ behandlung: '' }, { behandlung: ['*'] }, [])).toEqual({ behandlung: '' });
    expect(passendZumFilter({ rollen: [] }, { rollen: ['betreiber'] }, [])).toEqual({ rollen: [] });
    // alle Werte belegt: der erste
    expect(passendZumFilter({ bereich: '' }, { bereich: ['a', 'b'] }, [{ bereich: 'a' }, { bereich: 'b' }])).toEqual({ bereich: 'a' });
  });
});

describe('C4-07: Nachweise ohne «kein Eintrag nötig»', () => {
  it('E8-nachweise bietet den Haken nicht an, solange E8-umsetzung je Control einen Nachweis verlangt', () => {
    const nachweise = gefuehrt.seiten.find((s) => s.id === 'E8-nachweise') as SeiteDef;
    const umsetzung = gefuehrt.seiten.find((s) => s.id === 'E8-umsetzung') as SeiteDef;
    expect(umsetzung.felder?.find((f) => f.pfad === 'nachweise')?.pflicht).toBe(true);
    expect(nichtNoetigMoeglich(nachweise)).toBe(false);
  });
});

describe('C4-08: F15 vor dem Audittermin und «durchgeführt» nur mit Ergebnis oder Checkliste', () => {
  const pruefe = (p: Projekt, heute = '2026-11-08') => pruefeProjekt(regeln, { projekt: p, heute, controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge }).filter((b) => b.regel === 'F15');
  const audit = (teil: Partial<Projekt['audits'][number]>): Projekt['audits'][number] => ({ id: 'AU-001', art: 'intern', kombiniertMitIsms: false, umfang: 'alles', kriterien: '42001', auditor: 'Lea Graf', unabhaengigkeit: 'Qualität', ergebnis: '', ...teil });

  it('Datum allein belegt kein Audit; mit Ergebnis oder Checkliste gilt es als durchgeführt', () => {
    const p = vollstaendigesProjekt();
    p.audits = [audit({ durchgefuehrt: '2026-11-08' })];
    expect(auditDurchgefuehrt(p.audits[0]!)).toBe(false);
    expect(pruefe(p)).toHaveLength(1);
    p.audits = [audit({ durchgefuehrt: '2026-11-08', ergebnis: 'zwei Beobachtungen' })];
    expect(pruefe(p)).toEqual([]);
    p.audits = [audit({ durchgefuehrt: '2026-11-08', checkliste: { '6.1.2': { ergebnis: 'konform', nachweis: 'D-07 v1.0' } } })];
    expect(pruefe(p)).toEqual([]);
  });

  it('geplantes Audit vor dem Termin: F15 bleibt Fehler (Bereitschaft), zählt aber als offen aus kommenden Etappen', () => {
    const p = vollstaendigesProjekt();
    p.audits = [audit({ geplant: '2027-05-17' })];
    const f15 = pruefe(p);
    expect(f15).toEqual([expect.objectContaining({ regel: 'F15', schwere: 'fehler', faellig: '2027-05-17' })]);
    const u: Umfeld = { gefuehrt, controlIds42001: CONTROLS_42001, euaia: [] };
    const d = fehlerDosiert(p, u, f15);
    expect(d.jetzt).toEqual([]);
    expect(d.spaeter.map((b) => b.regel)).toEqual(['F15']);
    // Termin verstrichen: zählt jetzt
    const spaet = pruefe(p, '2027-05-18');
    expect(spaet[0]!.faellig).toBeUndefined();
    expect(fehlerDosiert(p, u, spaet).jetzt.map((b) => b.regel)).toEqual(['F15']);
    // ohne Plan: kein Termin
    p.audits = [];
    expect(pruefe(p)[0]!.faellig).toBeUndefined();
  });
});
