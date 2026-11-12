// Konsolidierung: Firmendokumente D-00 bis D-13 und generische Ergänzungsblätter nutzen die Felder des Datenmodells.
// In den Beispielprojekten erscheinen dort keine Platzhalter, wo das Beispiel Angaben hat.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { XlsxMappe } from '../../src/generator/ir.ts';
import { ladeTexte } from '../../src/i18n/laden-node.ts';
import { erstelleUebersetzer } from '../../src/i18n/texte.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Massnahme, Projekt } from '../../src/model/typen.ts';
import { d00 } from '../../src/vorlagen/D-00.ts';
import { d12 } from '../../src/vorlagen/D-12.ts';
import type { Modus, VorlagenKontext } from '../../src/vorlagen/kontext.ts';
import { auftraege } from '../../scripts/beispiele.mts';
import { vollstaendigesProjekt } from '../fixtures/projekt.ts';

const kataloge = ladeKataloge();
const u = erstelleUebersetzer('de', ladeTexte('de'));
const beispiel = (f: string): Projekt => JSON.parse(readFileSync(`src/beispiele/${f}.de.aims.json`, 'utf8')) as Projekt;
const ctx = (projekt: Projekt, modus: Modus = 'firma', extra: Partial<VorlagenKontext> = {}): VorlagenKontext => ({ u, modus, form: 'dokument', projekt, kataloge, kitVersion: 'test', ...extra });

/** Platzhalter im IR: markierte Läufe und [[...]] in Texten */
function platzhalter(ir: unknown): string[] {
  const t: string[] = [];
  const geh = (o: unknown): void => {
    if (typeof o === 'string') for (const m of o.matchAll(/\[\[(.+?)\]\]/g)) t.push(m[1]!);
    else if (Array.isArray(o)) o.forEach(geh);
    else if (o && typeof o === 'object') {
      const r = o as Record<string, unknown>;
      if (r['platzhalter'] === true && typeof r['text'] === 'string') t.push(r['text']);
      else Object.values(r).forEach(geh);
    }
  };
  geh(ir);
  return t;
}

const OHNE_PLATZHALTER = /^(D-0\d|D-1[0-3])/;

describe.each(['muster-maschinenbau', 'praezisionsteile'])('Beispiel %s', (firma) => {
  const p = beispiel(firma);
  const dateien = auftraege(p, 'de').filter((a) => OHNE_PLATZHALTER.test(a.name));
  it.each(dateien.map((a) => [a.name, a] as const))('%s ohne Platzhalter', (name, a) => {
    const ir = a.vorlage(ctx(p, 'firma', { form: a.form, ...(a.kiSystemId ? { kiSystemId: a.kiSystemId } : {}) }));
    const gefunden = platzhalter(ir);
    // Internes Audit ohne Eintrag in der Matrix: Auditorin des Auditprogramms (Stage-1-Audit 2, P1)
    expect(gefunden, name).toEqual([]);
  });
});

describe('Einzelregeln', () => {
  it('D-00 belegt die Soll-Reife nicht mehr mit 3 vor und nimmt die Gap-Analyse auf', () => {
    // Eigenes Testprojekt statt Beispieldaten: Ist-Reife zu K-4.1 erfasst, Soll-Reife bewusst offen
    const p = vollstaendigesProjekt();
    p.personen.push({ id: 'P-002', name: 'Berta Beispiel', funktion: 'Geschäftsführerin', aimsRollen: [] });
    p.organisation.projektauftrag = { sponsor: 'P-002' };
    p.gapAnalyse = { datum: '2026-08-01', abschnitte: { 'K-4.1': { ist: 1 } } };
    const m = d00(ctx(p)) as XlsxMappe;
    const abschnitte = m.blaetter[1]!;
    const k41 = abschnitte.zeilen.find((z) => z[0] === 'K-4.1')!;
    expect(k41[4]).toBe(1);
    expect(k41[5]).toBeNull();
    // Firmendokument ohne Hinweise an Ausfüllende (Stage-1-Audit 2, M26)
    expect(abschnitte.hinweise).toBeUndefined();
    const auftrag = m.blaetter[0]!.zeilen;
    expect(auftrag.find((z) => z[0] === 'Sponsor (Geschäftsleitung)')![1]).toContain('Berta Beispiel');
  });

  it('D-00 ordnet Massnahmen auch über Bereiche und Listen von Referenzen zu', () => {
    const p = vollstaendigesProjekt();
    const massnahme = (id: string, ref: string, status: Massnahme['status'] = 'offen'): Massnahme => ({
      id, titel: `Titel ${id}`, beschreibung: '', status, prioritaet: 'mittel', herkunft: { art: 'pruefung', ref },
    });
    p.massnahmen = [
      massnahme('M-001', 'K-6.1'),
      massnahme('M-002', 'R-001; A.6, 9.2'),
      massnahme('M-003', 'K-6.1.2'),
      massnahme('M-004', 'K-6.1', 'verworfen'),
      massnahme('M-005', 'Frage 6 im Schnellcheck'),
    ];
    const m = d00(ctx(p)) as XlsxMappe;
    const zeile = (blatt: number, id: string) => String(m.blaetter[blatt]!.zeilen.find((z) => z[0] === id)![7]);
    expect(zeile(1, 'K-6.1.1')).toBe('M-001 Titel M-001');
    expect(zeile(1, 'K-6.1.2')).toBe('M-001 Titel M-001; M-003 Titel M-003');
    expect(zeile(1, 'K-6.2')).toBe('');
    expect(zeile(1, 'K-9.2')).toBe('M-002 Titel M-002');
    expect(zeile(2, 'A.6.1.2')).toBe('M-002 Titel M-002');
    expect(zeile(2, 'A.6.2.8')).toBe('M-002 Titel M-002');
    expect(zeile(2, 'A.7.2')).toBe('');
  });

  it('Verfahrensvorgaben ohne Feld bleiben markiert, solange das Dokument nicht freigegeben ist', () => {
    const p = beispiel('praezisionsteile');
    expect(platzhalter(d12(ctx(p)))).toEqual([]);
    p.dokumente.find((d) => d.id === 'D-12')!.status = 'entwurf';
    expect(platzhalter(d12(ctx(p)))).toContain('80 %');
    // Projektdaten werden trotzdem eingesetzt
    expect(platzhalter(d12(ctx(p)))).not.toContain(u.t('allgemein.platzhalter.meldestelle'));
  });

  it('leere Vorlage D-12 behält alle Platzhalter', () => {
    expect(platzhalter(d12(ctx(beispiel('praezisionsteile'), 'leer')))).toContain('80 %');
  });
});
