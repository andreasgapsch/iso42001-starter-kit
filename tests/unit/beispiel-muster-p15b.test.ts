// P15b Beispiel Muster Maschinenbau AG (Runde 3b): Befunde A3-05 bis A3-10, A3-22 und A3-23 im Beispiel behoben, DE und EN.
// AF-086 (R-033, KI-006), AF-087 (E-09 neue Fassung), AF-088 (PR-13 Freigabe nach D-12), AF-089 (AU-001 Deutschland,
// Unabhängigkeit, Stellvertretung PR-25), AF-090 (RMF-02), AF-127 (R6: Kennzeichnung vor dem 02.08.2026), F43 PR-19.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { pruefeProjekt, type Regel } from '../../src/regeln/pruefungen.ts';
import { CONTROLS_42001 } from '../fixtures/projekt.ts';

const kataloge = ladeKataloge();
const regeln = (parse(readFileSync('src/regeln/pruefregeln.yaml', 'utf8')) as { regeln: Regel[] }).regeln;
const muster = (s: 'de' | 'en') => JSON.parse(readFileSync(`src/beispiele/muster-maschinenbau.${s}.aims.json`, 'utf8')) as Projekt;
const befunde = (p: Projekt) => pruefeProjekt(regeln, { projekt: p, heute: '2027-02-15', controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge });
const stand = parse(readFileSync('src/ai-act/stand.yaml', 'utf8')) as { geprueft_am: string };
const katalog = parse(readFileSync('src/prozesse/katalog.yaml', 'utf8')) as { prozesse: { id: string; schritte: { id: string; bahn: string; naechste?: string[]; entscheid?: string; raci?: Record<string, string> }[] }[] };

describe.each(['de', 'en'] as const)('P15b Muster %s', (s) => {
  const p = muster(s);
  const b = befunde(p);
  const treffer = (regel: string) => b.filter((x) => x.regel === regel).map((x) => x.id);

  it('0 Fehler der Prüfregeln (C-01 «Bereit»), F34, F38, F40, F41, F43 ohne Treffer', () => {
    expect(b.filter((x) => x.schwere === 'fehler').map((x) => `${x.regel} ${x.id ?? ''}`)).toEqual([]);
    for (const r of ['F34', 'F38', 'F40', 'F41', 'F43']) expect(treffer(r), r).toEqual([]);
  });

  it('AF-086: R-033 mit Ausmass 4 (Sicherheit nach eigener Skala), Annahme durch die Geschäftsleitung, IA-006 neu beurteilt', () => {
    const r = p.risiken.find((x) => x.id === 'R-033')!;
    const stufe4 = p.organisation.risikokriterien!.auswirkung.find((x) => x.stufe === 4)!;
    expect(stufe4.beschreibung).toMatch(/Sicherheit|safety/i);
    expect(r.a).toBe(4);
    expect(r.aNach).toBe(4);
    const gl = p.personen.find((x) => x.id === r.restrisikoAkzeptiert?.von)!;
    expect(gl.aimsRollen).toContain('gl');
    const ia = p.folgenabschaetzungen.find((x) => x.id === 'IA-006')!;
    expect(ia.nutzenSchaden?.sicherheit?.ausmass).toBe(4);
    expect(ia.eingeschraenkteNutzung).toBe(true);
    expect(ia.neubeurteilungen?.some((n) => n.am >= r.beurteiltAm! && n.freigabe?.von === 'P-001')).toBe(true);
    // Freigabeliste stimmig zu R-029 und R-031 (A nach Behandlung 3)
    expect(p.kiSysteme.find((x) => x.id === 'KI-006')!.freigabeBegruendung).not.toMatch(/über Ausmass 2|above severity 2/);
  });

  it('AF-087: E-09 (und E-01, E-02, E-06, E-07) in neuer Fassung mit Historie, nicht älter als der Rechtsstand', () => {
    for (const id of ['E-01', 'E-02', 'E-06', 'E-07', 'E-09']) {
      const d = p.dokumente.find((x) => x.id === id)!;
      expect(d.freigabe!.am >= stand.geprueft_am, id).toBe(true);
      expect(d.aenderungen?.at(-1)?.version, id).toBe(d.version);
      expect(d.aenderungen!.length, id).toBeGreaterThanOrEqual(2);
    }
  });

  it('AF-089: AU-001 mit Stichprobe Deutschland, 5.3 und 7.2 bei der Fachauditorin, Stellvertretung PR-25 nicht die Hauptgeprüfte', () => {
    const au = p.audits.find((x) => x.id === 'AU-001')!;
    const schmid = p.personen.find((x) => x.id === 'P-010')!.name;
    expect(au.auditierte).toContain(schmid);
    expect(JSON.stringify(au.checkliste)).toContain(schmid);
    expect(au.unabhaengigkeit).toMatch(/5\.3, 7\.2, 7\.5/);
    const pr25 = p.prozesse!.find((x) => x.id === 'PR-25')!;
    const vertretung = p.personen.find((x) => x.id === pr25.stellvertretung)!;
    expect(vertretung.id).not.toBe(p.organisation.aimsVerantwortlich ?? 'P-002');
    expect(vertretung.aimsRollen).toContain('auditor');
    expect(vertretung.id).not.toBe(pr25.eigner);
  });

  it('AF-090: RMF-02 nicht «wirksam», Beleg ohne Schritte aus D-12 vor dessen Freigabe', () => {
    const c = p.controls.find((x) => x.id === 'RMF-02')!;
    expect(c.status).toBe('umgesetzt');
    expect(c.wirksamkeit?.ergebnis).not.toMatch(/nach den Schritten in D-12|according to the steps in D-12/);
  });

  it('AF-127 (R6): KI-006 ohne «juristisch geprüft», Kennzeichnung vor dem 02.08.2026', () => {
    const k = p.kiSysteme.find((x) => x.id === 'KI-006')!;
    expect(k.aiAct.juristischGeprueft).toBe(false);
    expect(k.aiAct.begruendung).toMatch(/28[./]07[./]2026/);
    expect(k.aiAct.begruendung).not.toMatch(/juristisch zu prüfen|legally reviewed/);
    expect(p.managementbewertungen[0]!.ergebnisse?.aiact).not.toMatch(/juristisch zu prüfen|needs legal review/);
  });

  it('F43 PR-19: Vorfälle mit Entdeckung und Eindämmung mit Uhrzeit, Messwert ist der längste Fall', () => {
    const faelle = p.feststellungen.filter((f) => f.quelle === 'vorfall' || f.quelle === 'beinahe-vorfall');
    const stunden = faelle.map((f) => (Date.parse(f.eingedaemmtAm!) - Date.parse(f.entdecktAm!)) / 3_600_000);
    expect(stunden.every((x) => Number.isFinite(x) && x >= 0)).toBe(true);
    const m = p.kennzahlMessungen!.find((x) => x.kennzahl === 'PR-19')!;
    expect(Number(/^(\d+)/.exec(m.wert)![1])).toBe(Math.max(...stunden));
  });

  it('PR-07: eigener Ablauf wie Katalog (ohne vertiefte Prüfung zur AIMS-Verantwortung), Antrag nur, wo es einen gab', () => {
    const e = p.prozesse!.find((x) => x.id === 'PR-07')!;
    expect(e.schritte!.find((x) => x.id === 'PR-07.03')!.naechste).toEqual(['PR-07.04', 'PR-07.05']);
    expect(e.drawio!.roh).not.toContain('kante:PR-07.03:PR-07.09');
    const mitAntrag = p.kiSysteme.filter((x) => x.antragAm);
    // Nacharbeit P15b (N4): KI-006 kam über Erstinventur und PR-11, kein Antrag nach PR-07
    expect(mitAntrag.map((x) => x.id)).toEqual(['KI-004', 'KI-005']);
    const tage = mitAntrag.map((x) => (Date.parse(x.entscheidAm!) - Date.parse(x.antragAm!)) / 86_400_000);
    const kz08 = p.kennzahlMessungen!.find((x) => x.kennzahl === 'KZ-08')!;
    expect(Number(/^(\d+(?:[.,]\d+)?)/.exec(kz08.wert)![1]!.replace(',', '.'))).toBe(tage.reduce((a, x) => a + x, 0) / tage.length);
    expect(kz08.bemerkung).not.toMatch(/Antrag am|Requested on/); // Spalten erst ab D-10-EB 1.4, Messung vom 31.01.2027
    for (const x of mitAntrag) expect(x.antragAm! <= p.folgenabschaetzungen.find((f) => f.kiSystem === x.id)!.triage.am!, x.id).toBe(true);
  });

  it('N1: Rückprüfung KI-004 nach D-08: Risiken mit Auswirkung 3 für Personen führen zur vollständigen Abschätzung', () => {
    const schwelle = 3;
    for (const s of p.kiSysteme) {
      const hoch = p.risiken.filter((r) => r.kiSystem === s.id && r.art === 'risiko' && r.ebenen?.includes('individuen') && (r.a ?? 0) >= schwelle);
      const ia = p.folgenabschaetzungen.find((f) => f.kiSystem === s.id);
      if (hoch.length && ia) expect(ia.triage.ergebnis, `${s.id}: ${hoch.map((r) => r.id).join(', ')}`).toBe('voll');
    }
    const ia4 = p.folgenabschaetzungen.find((f) => f.id === 'IA-004')!;
    expect(ia4.neubeurteilungen!.at(-1)!.freigabe?.von).toBe('P-001');
    expect(Object.keys(ia4.nutzenSchaden ?? {}).length).toBe(8);
  });

  it('N2: geplante interne Audits mit derselben Unabhängigkeitsregel wie AU-001', () => {
    for (const au of p.audits.filter((a) => a.art === 'intern')) expect(au.unabhaengigkeit, au.id).toMatch(/5\.3, 7\.2, 7\.5 (und|and) 9\.2/);
  });

  it('N5, A3-31: eingeschränkte Nutzung in der Abschätzung heisst Status «eingeschränkt» mit Auflagen', () => {
    for (const f of p.folgenabschaetzungen.filter((x) => x.eingeschraenkteNutzung)) {
      const s = p.kiSysteme.find((x) => x.id === f.kiSystem)!;
      if (s.status === 'ausgesetzt' || s.status === 'untersagt') continue;
      expect(s.status, s.id).toBe('eingeschraenkt');
      expect(s.auflagen?.trim(), s.id).toBeTruthy();
    }
  });
});

describe('AF-091 (Vorlagen A3-35, A3-36)', () => {
  const y = (pfad: string) => readFileSync(pfad, 'utf8');
  it.each(['de', 'en'])('%s: D-26 nennt die Geschäftsleitung als Freigabe für D-06 und D-08, Stand der Prozesse ohne neue Version', (s) => {
    const d26 = parse(y(`src/i18n/${s}/vorlagen/D-26.yaml`)) as { freigabe_zeilen: string[][]; versionen_text: string };
    expect(d26.freigabe_zeilen.some((z) => z[0]!.includes('D-06, D-08') && /Geschäftsleitung|Top management/.test(z[2]!))).toBe(true);
    expect(d26.versionen_text).toMatch(/D-27/);
  });
  it.each(['de', 'en'])('%s: D-20 sagt, woraus der Auditbericht besteht; Reife «eingeführt» für Anlass-Prozesse', (s) => {
    const d20 = parse(y(`src/i18n/${s}/vorlagen/D-20.yaml`)) as { hinweise_programm: string[] };
    expect(d20.hinweise_programm.some((h) => /Auditbericht|audit report/.test(h))).toBe(true);
    expect(y(`src/i18n/${s}/prozesse.yaml`)).toMatch(/(Übung oder Probelauf|exercise or trial run) mit Aufzeichnung|with a record\./);
  });
});

describe('AF-088: PR-13 Freigabe der Änderung durch die Stelle aus D-12', () => {
  const pr13 = katalog.prozesse.find((x) => x.id === 'PR-13')!;
  it('Freigabeschritte bei AIMS-Verantwortung und Geschäftsleitung, nicht bei der Eignerschaft allein', () => {
    const freigaben = pr13.schritte.filter((x) => x.entscheid);
    expect(freigaben.map((x) => x.bahn).sort()).toEqual(['aims', 'gl']);
    expect(pr13.schritte.some((x) => x.bahn === 'ki-eigner' && x.naechste?.includes('PR-13.06') && !x.entscheid)).toBe(false);
  });
  it('Geschäftsleitung nur über die Frage nach hohem Risiko, nach dem Test der geänderten Fassung', () => {
    const vor = (ziel: string) => pr13.schritte.filter((x) => x.naechste?.includes(ziel)).map((x) => x.id);
    expect(vor('PR-13.08')).toEqual(['PR-13.07']);
    expect(vor('PR-13.07')).toEqual(['PR-13.04']);
  });
});
