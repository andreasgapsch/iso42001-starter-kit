// Simuliertes Stage-1-Audit, fünfte Runde: Bestätigung ohne Änderung und Verweise «in Erarbeitung», eine Quelle
// für den Normbezug, Formatvorlage des Kastens, SoA-Stand zum Audit, Zertifikat in D-25, nächsthöhere Stelle in D-04,
// Gesamtbeurteilung in D-21, nachgetragene Feststellungen in D-22, Prüfstand in D-02, Historie der Ergänzungsblätter in D-26,
// ISMS-Bezug mit Kennung, Prüfregeln der Beispiele (H49) und Datenbefunde der Beispiele.
import { strFromU8, unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { auftraege } from '../../scripts/beispiele.mts';
import { renderDocx } from '../../src/generator/index.ts';
import type { Block, DocxDokument, XlsxMappe } from '../../src/generator/ir.ts';
import { klartext } from '../../src/generator/texte.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { pruefeProjekt, type Regel } from '../../src/regeln/pruefungen.ts';
import { erstelleHelfer } from '../../src/vorlagen/kontext.ts';
import { CONTROLS_42001 } from '../fixtures/projekt.ts';
import { firmenIr, FIRMEN, kontext, projekt, SPRACHEN, texte } from './kittexte-hilfen.ts';

const regeln = (parse(readFileSync('src/regeln/pruefregeln.yaml', 'utf8')) as { regeln: Regel[] }).regeln;

/** Firmendokument eines Beispiels (Name beginnt mit der ID) */
function dokument<T extends DocxDokument | XlsxMappe>(p: Projekt, name: string): T {
  const a = auftraege(p, p.meta.dokumentSprache).find((x) => x.name.startsWith(name))!;
  return a.vorlage(kontext(p, 'firma', a)) as T;
}
const zeilen = (m: XlsxMappe, blatt: string) => m.blaetter.find((b) => b.name === blatt)!.zeilen;

describe('Bestätigung ohne Änderung (Muster B 12, Präzision B 6)', () => {
  const p = projekt('muster-maschinenbau', 'de');
  it('D-03 ist in der Managementbewertung bestätigt: Kopf mit Bestätigung, keine Verweise «in Erarbeitung»', () => {
    const d03 = dokument<DocxDokument>(p, 'D-03_');
    expect(klartext(d03.lenkung.bestaetigt ?? '')).toContain('02.02.2027');
    expect(texte(d03).join(' ')).not.toContain('in Erarbeitung');
  });
  it('ohne Bestätigung bleibt der Zusatz; eine Bestätigung vor der Freigabe zählt nicht', () => {
    const q: Projekt = structuredClone(p);
    const d03 = q.dokumente.find((d) => d.id === 'D-03')!;
    delete d03.bestaetigt;
    expect(texte(dokument<DocxDokument>(q, 'D-03_')).join(' ')).toContain('in Erarbeitung');
    d03.bestaetigt = { von: 'P-001', am: '2026-08-01' };
    const ir = dokument<DocxDokument>(q, 'D-03_');
    expect(texte(ir).join(' ')).toContain('in Erarbeitung');
    expect(ir.lenkung.bestaetigt ?? '').toBe('');
  });
  it('Stand des Dokuments: Freigabe oder spätere Bestätigung', () => {
    const a = auftraege(p, 'de').find((x) => x.name.startsWith('D-03_'))!;
    const h = erstelleHelfer(kontext(p, 'firma', a));
    expect(h.standDatum('D-03')).toBe('2027-02-02');
    expect(h.standDatum('D-24')).toBe(p.dokumente.find((d) => d.id === 'D-24')!.freigabe!.am);
  });
  it('Register D-26-EB vermerkt die Bestätigung', () => {
    const reg = dokument<XlsxMappe>(p, 'D-26-EB_Dokumentenlenkung_Register');
    const d03 = zeilen(reg, 'Dokumente').find((z) => z[0] === 'D-03')!;
    expect(String(d03.at(-1))).toContain('ohne Änderung bestätigt');
  });
});

describe('Eine Quelle für den Normbezug, Formatvorlage nur bei Verwendung (Muster B 20, Präzision B 12)', () => {
  for (const firma of FIRMEN) {
    const p = projekt(firma, 'de');
    it(`${firma}: D-21 trägt den Normbezug der Managementbewertung`, () => {
      const d21 = dokument<DocxDokument>(p, firma === 'praezisionsteile' ? 'D-21_' : 'D-21-EB');
      expect(d21.lenkung.normbezug).toBe('ISO/IEC 42001: 9.3, 5.1, A.2.4');
    });
    // Je Dokument ein Test: Rendern aller Dokumente in einem Test brauchte unter Last mehr als das Zeitbudget (AF-048)
    for (const a of auftraege(p, 'de')) {
      it(`${firma} ${a.name}: ohne Kasten «Normverweis», Formatvorlage nur bei Verwendung`, async () => {
        const treffer: string[] = [];
        const ir = firmenIr(p, a);
        const bloecke: Block[] = 'bloecke' in ir ? ir.bloecke : (ir.hinweisBlock ?? []);
        if (bloecke.some((b) => b.typ === 'hinweis' && b.art === 'normverweis' && b.normbezug)) treffer.push(a.name);
        if ('bloecke' in ir) {
          const stile = strFromU8(unzipSync(await renderDocx(ir))['word/styles.xml']!);
          const verwendet = ir.bloecke.some((b) => b.typ === 'hinweis' && b.art === 'normverweis');
          if (stile.includes('w:styleId="HinweisNorm"') !== verwendet) treffer.push(`${a.name}: Formatvorlage`);
        }
        expect(treffer).toEqual([]);
      });
    }
  }
  it('leere Vorlage: Kasten bleibt, Kopf aus derselben Quelle', () => {
    const p = projekt('praezisionsteile', 'de');
    const a = auftraege(p, 'de').find((x) => x.name.startsWith('D-14_'))!;
    const ir = a.vorlage(kontext(p, 'leer', a)) as DocxDokument;
    const kasten = ir.bloecke.find((b) => b.typ === 'hinweis' && b.art === 'normverweis' && b.normbezug);
    expect(kasten && kasten.typ === 'hinweis' ? kasten.normbezug : '').toBe('A.8.2 bis A.8.5, A.10.4');
    expect(ir.lenkung.normbezug).toBe('ISO/IEC 42001: A.8.2 bis A.8.5, A.10.4');
  });
  it('Modul AI Act: Kopf mit Artikel und Abschnitten der Norm', () => {
    const p = projekt('muster-maschinenbau', 'de');
    expect(dokument<XlsxMappe>(p, 'E-01').lenkung.normbezug).toBe('EU AI Act Art. 3, 25; ISO/IEC 42001: 4.1');
  });
});

describe('Auditcheckliste mit dem SoA-Stand zum Audit (Muster B 10, Präzision B 7)', () => {
  it('Muster: Spalte «SoA» zeigt den Stand vom Audit, nicht den aktuellen', () => {
    const p = projekt('muster-maschinenbau', 'de');
    const z = zeilen(dokument<XlsxMappe>(p, 'D-20-EB'), 'Checkliste 42001');
    const soa = (id: string) => String(z.find((r) => r[0] === id)![4]);
    expect(soa('A.6.2.6')).toBe('anwendbar, umgesetzt');
    expect(soa('A.10.3')).toBe('anwendbar, umgesetzt');
    expect(soa('A.6.2.5')).toBe('anwendbar, wirksam');
    expect(soa('A.2.4')).toBe('anwendbar, teilweise umgesetzt');
    // aktueller Stand in der SoA
    expect(p.controls.find((c) => c.id === 'A.10.3')!.status).toBe('teilweise');
    // Abschnitt 8.2 folgt der Stichprobe Nr. 2 (F-001)
    expect(String(z.find((r) => r[0] === '8.2')![7])).toBe('NK leicht');
  });
  it('Präzision: A.9.3 zum Audit umgesetzt, heute teilweise', () => {
    const p = projekt('praezisionsteile', 'de');
    const z = zeilen(dokument<XlsxMappe>(p, 'D-20_'), 'Checkliste 42001');
    expect(String(z.find((r) => r[0] === 'A.9.3')![4])).toBe('anwendbar, umgesetzt');
    expect(p.controls.find((c) => c.id === 'A.9.3')!.status).toBe('teilweise');
  });
});

describe('Vorlagentexte (Runde 5)', () => {
  it('D-25: «das zertifizierte AIMS» erst nach erteiltem Zertifikat', () => {
    const p = projekt('muster-maschinenbau', 'de');
    const ohne = texte(dokument<DocxDokument>(p, 'D-25')).join(' ');
    expect(ohne).toContain('welche Subkategorien das AIMS abdeckt');
    expect(ohne).not.toContain('zertifizierte AIMS');
    const q: Projekt = structuredClone(p);
    q.audits.find((a) => a.art === 'extern-stage2')!.zertifikatAm = '2027-01-15';
    expect(texte(dokument<DocxDokument>(q, 'D-25')).join(' ')).toContain('welche Subkategorien das zertifizierte AIMS abdeckt');
  });
  it('D-04: nächsthöhere Stelle und Restrisiken ab der Grenze «unannehmbar»', () => {
    const t = texte(dokument<DocxDokument>(projekt('praezisionsteile', 'de'), 'D-04_')).join(' ');
    expect(t).toContain('die nächsthöhere Stelle (Gesellschafterversammlung)');
    expect(t).toContain('Ein Restrisiko ab der Grenze «unannehmbar» lässt sich nicht annehmen');
    expect(t).toContain('Vorbehalte der Risikobereitschaft');
  });
  it('D-03: «AIMS-Verantwortliche/r» statt «AIMS-Verantwortung»', () => {
    const t = texte(dokument<DocxDokument>(projekt('praezisionsteile', 'de'), 'D-03_')).join(' ');
    expect(t).toContain('AIMS-Verantwortliche/r entscheidet ohne Geschäftsleitung');
    expect(t).not.toContain('AIMS-Verantwortung');
  });
  it('D-21: Gesamtbeurteilung «offen» verständlich, ohne zwei Antwortwerte', () => {
    const t = texte(dokument<DocxDokument>(projekt('praezisionsteile', 'de'), 'D-21_')).join(' ');
    expect(t).toContain('noch nicht abschliessend beurteilt: Wirksamkeit bis auf Ziel Z-002 belegt');
    expect(t).not.toMatch(/offen: Teilweise/);
  });
  it('D-22: nachgetragene Feststellung mit Datum der Erfassung und Regel der Kennungen', () => {
    const m = dokument<XlsxMappe>(projekt('praezisionsteile', 'de'), 'D-22_');
    const nk = m.blaetter.find((b) => b.name === 'Nichtkonformitäten')!;
    expect(String(nk.zeilen.find((z) => z[0] === 'F-005')!.find((x) => String(x).includes('Im Register erfasst am')))).toContain('26.01.2027');
    expect((nk.hinweise ?? []).join(' ')).toContain('fortlaufend bei der Erfassung');
  });
  it('D-02: Prüfstand für jeden Lieferanten zum Stand des Dokuments', () => {
    for (const firma of FIRMEN) {
      const p = projekt(firma, 'de');
      const t = texte(dokument<DocxDokument>(p, 'D-02')).join('\n');
      for (const l of p.lieferanten) expect(t, `${firma} ${l.id}`).toMatch(new RegExp(`${l.id} [^\\n]*Lieferantenprüfung: `));
    }
  });
  // Erwartung erweitert: D-07-EB Version 1.2 ist seit Runde 2 (A2-04, M-038) freigegeben
  it('D-26: jede Version eines Ergänzungsblatts mit eigener Zeile (D-07-EB 1.0 bis 1.2)', () => {
    const reg = dokument<XlsxMappe>(projekt('muster-maschinenbau', 'de'), 'D-26-EB_Dokumentenlenkung_Register');
    expect(zeilen(reg, 'Änderungen').filter((z) => z[0] === 'D-07-EB').map((z) => z[2])).toEqual(['1.0', '1.1', '1.2']);
  });
  it('ISMS-Bezug im Kopf und in D-23 mit Kennung des ISMS-Dokuments; Ergänzungsblatt D-10-EB «erweitert»', () => {
    const p = projekt('muster-maschinenbau', 'de');
    expect(dokument<DocxDokument>(p, 'D-01').lenkung.ismsBezug).toBe('erweitert ISMS-Kontextanalyse KA-ISMS-01, Version 3.2');
    expect(dokument<DocxDokument>(p, 'D-21-EB').lenkung.ismsBezug).toBe('erweitert Managementbewertung ISMS MB-ISMS-01, Vorlage Version 2.0');
    const d23 = zeilen(dokument<XlsxMappe>(p, 'D-23'), 'Dokumente');
    expect(d23.find((z) => z[0] === 'D-10-EB')!.slice(2, 4)).toEqual(['erweitert', 'Inventar der Informationswerte INV-ISMS-01, Version 2.3']);
  });
  it('D-00: Erläuterung der Ampel passt zur Formel (Mittelwert über 1 ist rot)', () => {
    const m = dokument<XlsxMappe>(projekt('muster-maschinenbau', 'de'), 'D-00');
    expect((m.blaetter.find((b) => b.name === 'Schnellcheck')!.hinweise ?? []).join(' ')).toContain('rot im Mittel schlechter als teilweise (Wert über 1');
  });
});

describe('Beispieldaten (Runde 5)', () => {
  for (const firma of FIRMEN) {
    for (const sprache of SPRACHEN) {
      const p = projekt(firma, sprache);
      it(`${firma} ${sprache}: keine Hinweise H42 bis H49, Risiken nach Änderungen neu beurteilt`, () => {
        const befunde = pruefeProjekt(regeln, { projekt: p, heute: '2027-02-15', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27' });
        expect(befunde.map((b) => b.regel).filter((r) => /^H4[2-9]$/.test(r))).toEqual([]);
      });
      it(`${firma} ${sprache}: «erledigt» erst mit Freigabe der Ergebnisdokumente, Beurteilung nicht vor der Erfassung`, () => {
        const erst = (id: string) => {
          const d = p.dokumente.find((x) => x.id === id || x.id === `${id}-EB` || `${x.id}-EB` === id);
          return [...(d?.aenderungen ?? []).map((a) => a.datum), d?.freigabe?.am].filter((x): x is string => !!x).sort()[0];
        };
        for (const m of p.massnahmen.filter((x) => x.status === 'erledigt' && x.erledigtAm))
          for (const ref of `${m.titel} ${m.beschreibung}`.match(/(?<![\w-])D-\d{2}(?:-EB)?(?![\w-])/g) ?? []) {
            const e = erst(ref);
            if (e) expect(e <= m.erledigtAm!, `${m.id} ${ref}`).toBe(true);
          }
        for (const r of p.risiken.filter((x) => x.erfasstAm)) expect((r.beurteiltAm ?? r.erfasstAm!) >= r.erfasstAm!, r.id).toBe(true);
      });
    }
  }
  it('Muster: Schatten-KI-Fälle als Vorfälle mit Folgenbehandlung, R-005 nach den Nachtrainings neu beurteilt', () => {
    const p = projekt('muster-maschinenbau', 'de');
    const f007 = p.feststellungen.find((f) => f.id === 'F-007')!;
    expect([f007.quelle, f007.kiSystem, f007.erfasstAm]).toEqual(['vorfall', 'KI-008', '2027-02-02']);
    expect(f007.korrektur).toContain('112');
    expect(p.feststellungen.find((f) => f.id === 'F-006')!.kiSystem).toBe('KI-007');
    expect(p.managementbewertungen[0]!.ergebnisse?.meldungen).toContain('Zwei KI-Vorfälle im Bewertungszeitraum');
    const r005 = p.risiken.find((r) => r.id === 'R-005')!;
    expect(r005.beurteiltAm! >= p.kiSysteme.find((s) => s.id === 'KI-001')!.geaendertAm!).toBe(true);
    expect(p.feststellungen.find((f) => f.id === 'F-001')!.massnahmen).toContain('M-035');
  });
  it('Präzision: F-005 erst ab der Erfassung mit Kennung, Wirksamkeitsvermerke davor ohne Kennung', () => {
    const p = projekt('praezisionsteile', 'de');
    const f005 = p.feststellungen.find((f) => f.id === 'F-005')!;
    expect(f005.erfasstAm).toBe('2027-01-26');
    for (const c of p.controls.filter((x) => x.wirksamkeit?.wann && x.wirksamkeit.wann < f005.erfasstAm!))
      expect(`${c.wirksamkeit!.wie ?? ''} ${c.wirksamkeit!.ergebnis ?? ''}`, c.id).not.toContain('F-005');
  });
});
