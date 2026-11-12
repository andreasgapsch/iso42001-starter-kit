// P15a: Beispiel Präzisionsteile nach Bericht A Runde 3 (A3-01 bis A3-04) und den Folgeänderungen aus P11, P13, P14.
// Die Regeln F34 bis F47 prüft tests/unit/beispiele.test.ts (keine erwarteten Treffer mehr); hier stehen die inhaltlichen
// Abnahmekriterien, die keine Regel abdeckt, DE und EN gleich.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Projekt } from '../../src/model/typen.ts';
import { hohesAusmassAb } from '../../src/regeln/stimmigkeit.ts';

const laden = (s: 'de' | 'en') => JSON.parse(readFileSync(`src/beispiele/praezisionsteile.${s}.aims.json`, 'utf8')) as Projekt;
const finde = <T extends { id: string }>(l: T[], id: string) => l.find((x) => x.id === id)!;

describe.each(['de', 'en'] as const)('Beispiel Präzisionsteile %s (P15a)', (s) => {
  const p = laden(s);

  it('AF-082 (A3-01): Personal und Kommunikation besetzt, D-04 Version 1.3 mit Registerzeile, M-023 nennt D-04', () => {
    expect(p.personen.filter((x) => (x.aimsRollen as string[]).includes('hr')).map((x) => x.id)).toEqual(['P-001']);
    expect(p.personen.filter((x) => (x.aimsRollen as string[]).includes('kommunikation')).map((x) => x.id)).toEqual(['P-002']);
    const d04 = finde(p.dokumente, 'D-04');
    expect(d04.version).toBe('1.3');
    expect(d04.aenderungen?.at(-1)).toMatchObject({ version: '1.3', datum: d04.freigabe?.am });
    const m23 = finde(p.massnahmen, 'M-023');
    expect(m23.nachweise).toContain('D-04');
    expect(m23.beschreibung).toContain('D-04');
    expect(d04.freigabe!.am <= m23.erledigtAm!).toBe(true);
  });

  it('AF-083 (A3-02): IA-001 mit Ausmass wie A vor der Behandlung, eingeschränkte und sensible Nutzung, D-10 nachgeführt', () => {
    const ia = finde(p.folgenabschaetzungen, 'IA-001');
    const ns = ia.nutzenSchaden!;
    // (a) keine wortgleichen Zellen
    const zellen = Object.values(ns).flatMap((x) => [x?.nutzen, x?.schaden]).filter(Boolean);
    expect(new Set(zellen).size).toBe(zellen.length);
    // (a) Zuverlässigkeit nennt R-004; (b) Sicherheit R-012 mit A wie im Register
    for (const [ziel, r] of [['zuverlaessigkeit', 'R-004'], ['sicherheit', 'R-012'], ['datenschutz', 'R-003']] as const) {
      expect(ns[ziel]?.schaden).toContain(r);
      expect(ns[ziel]?.ausmass).toBe(finde(p.risiken, r).a);
    }
    // (c) Ausmass ab der hohen Stufe: eingeschränkte Nutzung, System «eingeschränkt» mit Auflagen
    expect(Math.max(...Object.values(ns).map((x) => x?.ausmass ?? 0))).toBeGreaterThanOrEqual(hohesAusmassAb(p));
    expect(ia.eingeschraenkteNutzung).toBe(true);
    const ki = finde(p.kiSysteme, 'KI-001');
    expect(ki.status).toBe('eingeschraenkt');
    expect(ki.auflagen?.trim()).toBeTruthy();
    // (d) D-10 sensible Nutzung wie die Abschätzung
    expect([ia.sensibleNutzung, ki.sensibleNutzung]).toEqual([true, true]);
    // (e) B.7 nennt die Nutzung durch Kunden statt «nur intern»
    expect(ia.gesellschaft).toMatch(s === 'de' ? /an Kunden/ : /to customers/);
    expect(ia.gesellschaft).not.toMatch(/nur intern|only internally/);
    // (f) DSFA-Entscheid mit Begründung
    expect(ia.verknuepfteDsfa).toMatch(s === 'de' ? /Art\. 22 DSG/ : /Art\. 22 FADP/);
    expect(ia.verknuepfteDsfa!.length).toBeGreaterThan(120);
  });

  it('AF-084 (A3-03): PR-12 2 von 3 mit Sollvergleich; F-004, R-004 und Messplan nennen 10 Offerten', () => {
    const pr12 = p.kennzahlMessungen!.find((x) => x.kennzahl === 'PR-12')!;
    expect([pr12.zaehler, pr12.nenner, pr12.sollErreicht]).toEqual([2, 3, 'nein']);
    const offerten = Number(/(\d+) (?:Offerten|quotations)/.exec(finde(p.ziele, 'Z-002').messmethode)?.[1]);
    expect(offerten).toBe(10);
    expect(finde(p.feststellungen, 'F-004').beschreibung).toContain(s === 'de' ? `eine von ${offerten} Offerten` : `one of ${offerten} quotations`);
    expect(finde(p.risiken, 'R-004').bestehendeMassnahmen).toContain(s === 'de' ? `1 von ${offerten} Offerten` : `1 of ${offerten} quotations`);
  });

  it('AF-085 (A3-04): A.5.2 «umgesetzt» mit F-006; PR-10 und KZ-01 aus D-11 ausgezählt', () => {
    const a52 = finde(p.controls, 'A.5.2');
    expect(a52.status).toBe('umgesetzt');
    expect(a52.umsetzung).toContain('F-006');
    const anw = p.controls.filter((c) => c.anwendbar === 'ja');
    const wirksam = anw.filter((c) => c.status === 'wirksam').length;
    const pr10 = p.kennzahlMessungen!.find((x) => x.kennzahl === 'PR-10')!;
    expect([pr10.zaehler, pr10.nenner]).toEqual([wirksam, anw.length]);
    expect(pr10.sollErreicht).toBe(wirksam / anw.length >= 0.8 ? 'ja' : 'nein');
    expect(p.kennzahlMessungen!.find((x) => x.kennzahl === 'KZ-01')!.wert).toMatch(new RegExp(`^${wirksam} (von|of) ${anw.length} `));
  });

  it('F43 PR-19 und PR-07: Vorfall mit Uhrzeit, Antrag nur bei KI-001 (KZ-07)', () => {
    const f5 = finde(p.feststellungen, 'F-005');
    expect(f5.entdecktAm).toMatch(/^2026-09-17T\d{2}:\d{2}$/);
    expect(f5.eingedaemmtAm).toMatch(/^2026-09-22T\d{2}:\d{2}$/);
    const stunden = (Date.parse(f5.eingedaemmtAm!) - Date.parse(f5.entdecktAm!)) / 3_600_000;
    expect(p.kennzahlMessungen!.find((x) => x.kennzahl === 'PR-19')!.wert).toMatch(new RegExp(`^${stunden} `));
    expect(p.kiSysteme.filter((x) => x.antragAm).map((x) => [x.id, x.antragAm, x.entscheidAm])).toEqual([['KI-001', '2026-11-03', '2026-11-17']]);
    expect(p.kennzahlMessungen!.find((x) => x.kennzahl === 'KZ-07')!.wert).toMatch(/^14 /);
  });

  // Nacharbeit nach der Prüfung (N1 bis N6, A3-21 Rest)
  it('N1: D-15 Version 1.1 vom 28.01.2027 trägt Gelb und die Auflagen von KI-001; A.9.3 nennt sie als geltend', () => {
    const d15 = finde(p.dokumente, 'D-15');
    const ki = finde(p.kiSysteme, 'KI-001');
    expect([d15.version, d15.freigabe?.am]).toEqual(['1.1', ki.freigabe?.am]);
    expect(d15.aenderungen?.map((x) => x.version)).toEqual(['1.0', '1.1']);
    expect(d15.aenderungen?.at(-1)?.was).toMatch(/M-022.*M-024/);
    expect(d15.bestaetigt).toBeUndefined();
    const bib = p.bibliothek?.eintraege.find((x) => x.id === 'D-15');
    expect(bib?.versionen?.map((x) => x.version)).toEqual(['1.0', '1.1']);
    expect(finde(p.controls, 'A.9.3').umsetzung).toContain(s === 'de' ? 'seit der Freigabe von D-15 Version 1.1 am 28.01.2027' : 'since the approval of D-15 version 1.1 on 28/01/2027');
  });

  it('N2, N3, N5, N6: Stichprobe IA-001 in AU-001, R-014 mit Ausnahme des Geschäftsführers, Auszählung 29.01.2027, KI-001 geändert', () => {
    expect(p.audits.find((a) => a.id === 'AU-001')?.checkliste?.['A.5.2']?.stichprobe).toContain('IA-001');
    const r14 = finde(p.risiken, 'R-014');
    expect(r14.restrisikoAkzeptiert?.von).toBe('P-001');
    expect(r14.restrisikoBegruendung).toMatch(/31\.03\.2027|31\/03\/2027/);
    for (const kz of ['KZ-01', 'KZ-07']) expect(p.kennzahlMessungen!.find((x) => x.kennzahl === kz)!.datum).toBe('2027-01-29');
    expect(finde(p.kiSysteme, 'KI-001').geaendertAm).toBe('2027-01-28');
    for (const r of ['R-003', 'R-004', 'R-012', 'R-013', 'R-014']) expect(finde(p.risiken, r).beurteiltAm, r).toBe('2027-01-28');
  });

  it('PR-13 (P15b): Änderungen gibt die AIMS-Verantwortung mit der Eignerschaft frei, bei voller Abschätzung die Geschäftsleitung', () => {
    const regel = (id: string) => finde(p.kiSysteme, id).aenderungsregel ?? '';
    for (const id of ['KI-001', 'KI-003']) expect(regel(id), id).toMatch(s === 'de' ? /gibt der Geschäftsführer .*Änderung frei.*\(PR-13\)/ : /managing director approves .*change.*\(PR-13\)/);
    expect(regel('KI-002')).toMatch(s === 'de' ? /AIMS-Verantwortliche zusammen mit der Eignerin \(PR-13\)/ : /AIMS lead together with the system owner \(PR-13\)/);
    expect(regel('KI-003')).not.toMatch(/und Freigabe durch den Leiter Arbeitsvorbereitung|and approval by the Head of Production Engineering/);
  });

  it('A3-21: Stellvertretung der Prozesse wie in D-04, wo die Eignerin oder der Eigner den Bereich verantwortet', () => {
    for (const id of ['PR-04', 'PR-09', 'PR-12', 'PR-16', 'PR-21', 'PR-23', 'PR-27']) {
      const e = finde(p.prozesse!, id);
      const r = p.rollen.find((x) => x.verantwortlich === e.eigner && x.stellvertretung === e.stellvertretung);
      expect(r, id).toBeTruthy();
    }
  });
});
