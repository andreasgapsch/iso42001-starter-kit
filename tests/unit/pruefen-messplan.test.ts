// Tor G44 Messplan (AF-098, QK-54; A3-15, A3-17, A3-03): Kennzahlen ohne Quelle 0, Spalten und Felder aufgelöst,
// Stichprobenumfang gegen Zähler und Nenner. Repo grün, eingepflanzte Fehler rot.
import { describe, expect, it } from 'vitest';
import { eingabeAusRepo, OFFEN, OFFEN_STICHPROBE, pruefeMessplan, stichprobenAbweichungen, teilstichproben, wertUnter, type MessEingabe, type MessProjekt } from '../../scripts/pruefen/messplan.mts';

type Baum = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const fehler = (e: MessEingabe) => pruefeMessplan(e).filter((b) => b.schwere === 'fehler').map((b) => b.meldung);
const kopie = (e: MessEingabe): MessEingabe => ({ ...e, katalog: JSON.parse(JSON.stringify(e.katalog)) as MessEingabe['katalog'], texte: JSON.parse(JSON.stringify(e.texte)) as MessEingabe['texte'] });

describe('Tor G44 Messplan', () => {
  // Erwartung geändert (P14, AF-104): PR-07 und PR-19 haben eine Datenquelle (D-10 «Antrag am», «Entscheid am»; D-22
  // «Entdeckt», «Eingedämmt»), OFFEN ist leer. Erwartung geändert (P15a, AF-084): PR-12 im Beispiel Präzisionsteile ist
  // korrigiert (2 von 3), keine Warnung zu den Beispielen mehr, OFFEN_STICHPROBE ist leer
  it('ist auf dem Repo ohne Fehler und ohne Warnung zu Katalog und Beispielen; OFFEN und OFFEN_STICHPROBE leer', () => {
    const b = pruefeMessplan(eingabeAusRepo());
    expect(b.filter((x) => x.schwere === 'fehler').map((x) => x.meldung)).toEqual([]);
    const w = b.filter((x) => x.schwere === 'warnung');
    expect(w.filter((x) => x.datei === 'src/prozesse/katalog.yaml').map((x) => x.meldung.slice(0, 5))).toEqual([]);
    expect(w.filter((x) => x.datei.startsWith('src/beispiele/')).map((x) => x.datei)).toEqual([]);
    expect(Object.keys(OFFEN)).toEqual([]);
    expect(OFFEN_STICHPROBE).toEqual([]);
  });

  it('Kennzahlen ohne Quelle: 0; jede Quelle mit Vorlage und Spalte oder Aufzeichnung', () => {
    const e = eingabeAusRepo();
    const mitKennzahl = e.katalog.prozesse.filter((p) => p.kennzahl_vorschlag);
    expect(mitKennzahl.length).toBe(38);
    expect(mitKennzahl.filter((p) => !p.datenquelle?.length).map((p) => p.id)).toEqual([]);
    // PR-Prozesse ausser PR-15 (Berichte je Version) lesen aus einer Vorlage des Kits
    const nurAufzeichnung = mitKennzahl.filter((p) => p.datenquelle?.length && p.datenquelle.every((q) => q.aufzeichnung)).map((p) => p.id);
    expect(nurAufzeichnung.filter((id) => id.startsWith('PR-'))).toEqual(['PR-15']);
  });

  it('erkennt fehlende Quelle, unbekannte Spalte, Methode ohne Vorlage oder Spaltenkopf und unbekanntes Feld', () => {
    const e = kopie(eingabeAusRepo());
    const p = (id: string) => e.katalog.prozesse.find((x) => x.id === id)!;
    delete p('PR-06').datenquelle;
    p('PR-08').datenquelle = [{ vorlage: 'D-07', spalte: 'spalten_register.99' }];
    p('PR-10').datenquelle = [{ vorlage: 'D-11', spalte: 'spalten_soa.2', feld: 'controls.gibtEsNicht' }];
    p('PR-20').datenquelle = [{ vorlage: 'D-99', spalte: 'x.0' }];
    (e.texte.de as Baum).prozesse.prozesse['PR-25'].kennzahl_methode = 'Auditprogramm; Zähler: durchgeführte Audits, Nenner: geplante Audits.';
    (e.texte.en as Baum).prozesse.prozesse['PR-27'].kennzahl_methode = 'Register D-22; numerator: findings closed on time.';
    const m = fehler(e);
    expect(m).toContain('PR-06: Kennzahl ohne Datenquelle');
    expect(m).toContain('PR-08: Spalte D-07 spalten_register.99 gibt es nicht (de)');
    expect(m).toContain('PR-10: Feld controls.gibtEsNicht gibt es im Datenmodell nicht');
    expect(m).toContain('PR-20: Vorlage D-99 steht nicht im Dokumentenregister');
    expect(m).toContain('PR-25: Methode nennt die Vorlage D-20 nicht (de)');
    expect(m).toContain('PR-25: Methode nennt die Spalte «Zeitraum» aus D-20 nicht (de)');
    expect(m).toContain('PR-27: Methode nennt die Spalte ‘Due date’ aus D-22 nicht (en)');
  });

  it('Gegenprobe A3-17: die alte Methode PR-24 («Pflichten mit Status und Frist» in D-01) hat keine Spalte in D-01', () => {
    const e = kopie(eingabeAusRepo());
    (e.texte.de as Baum).prozesse.prozesse['PR-24'].kennzahl_methode = 'Pflichten und Anforderungen in D-01; Zähler: mit Status und Frist, Nenner: alle Einträge.';
    expect(fehler(e)).toContain('PR-24: Methode nennt die Spalte «Durch AIMS behandelt» aus D-01 nicht (de)');
  });

  it('meldet eine offene Kennzahl, die inzwischen eine Quelle hat, als überholt', () => {
    // OFFEN ist seit P14 leer: ein Eintrag für PR-07 (mit Quelle) wird für die Gegenprobe eingesetzt und wieder entfernt
    OFFEN['PR-07'] = 'Gegenprobe';
    try {
      expect(fehler(kopie(eingabeAusRepo()))).toContain('PR-07: hat jetzt eine Datenquelle, Eintrag in OFFEN streichen');
    } finally {
      delete OFFEN['PR-07'];
    }
  });

  it('Gegenprobe A3-15: PR-07 und PR-19 ohne Datenquelle und mit der alten Methode sind Fehler', () => {
    const e = kopie(eingabeAusRepo());
    for (const id of ['PR-07', 'PR-19']) delete e.katalog.prozesse.find((x) => x.id === id)!.datenquelle;
    const m = fehler(e);
    expect(m).toContain('PR-07: Kennzahl ohne Datenquelle');
    expect(m).toContain('PR-19: Kennzahl ohne Datenquelle');
    const f = kopie(eingabeAusRepo());
    (f.texte.de as Baum).prozesse.prozesse['PR-19'].kennzahl_methode = 'Feststellungen mit Quelle Vorfall in D-22: Stunden von der Entdeckung bis zur Eindämmung.';
    (f.texte.en as Baum).prozesse.prozesse['PR-07'].kennzahl_methode = 'Requests in inventory D-10: days from request to decision.';
    expect(fehler(f)).toEqual(expect.arrayContaining(['PR-19: Methode nennt die Spalte «Entdeckt» aus D-22 nicht (de)', 'PR-07: Methode nennt die Spalte ‘Requested on’ aus D-10 nicht (en)']));
  });

  it('PR-03 liest die Spalte «Stellvertretung» aus D-04 (AF-102, P14 S3)', () => {
    const e = eingabeAusRepo();
    const q = e.katalog.prozesse.find((x) => x.id === 'PR-03')!.datenquelle!;
    expect(q).toContainEqual({ vorlage: 'D-04', spalte: 'raci_kopf.4', feld: 'rollen.stellvertretung' });
    expect(wertUnter(e.texte.de, 'vorlagen.D-04.raci_kopf.4')).toBe('Stellvertretung');
    expect(wertUnter(e.texte.en, 'vorlagen.D-04.raci_kopf.4')).toBe('Deputy');
    // Gegenprobe: Methode ohne die Spalte ist ein Fehler, solange die Quelle besteht
    const f = kopie(e);
    (f.texte.de as Baum).prozesse.prozesse['PR-03'].kennzahl_methode = 'Rollen D-04, Spalten «Bereich» und «A»; Zähler: Bereiche mit Person.';
    expect(fehler(f)).toContain('PR-03: Methode nennt die Spalte «Stellvertretung» aus D-04 nicht (de)');
  });

  it('PR-07 und PR-19 lesen aus Feldern der Schemaversion 3', () => {
    const e = eingabeAusRepo();
    const felder = (id: string) => e.katalog.prozesse.find((x) => x.id === id)!.datenquelle!.map((q) => q.feld);
    expect(felder('PR-07')).toEqual(['kiSysteme.antragAm', 'kiSysteme.entscheidAm']);
    expect(felder('PR-19')).toEqual(['feststellungen.entdecktAm', 'feststellungen.eingedaemmtAm']);
  });
});

describe('Stichproben gegen Zähler und Nenner', () => {
  it('liest den Umfang je Messdatum: «ab 2027» schaltet die dritte Teilstichprobe zu, Kennungen und Jahre zählen nicht', () => {
    const t = teilstichproben('Stichprobe von 10 CAM-Programmen und 10 Offerten pro Quartal, ab 2027 zusätzlich 10 Bestellvorschläge der ERP-KI');
    expect(t.map((x) => [x.n, x.ab])).toEqual([[10, 0], [10, 0], [10, 2027]]);
    expect(teilstichproben('Sample of 10 CAM programs and 10 quotations per quarter, from 2027 also 10 order proposals').map((x) => x.ab)).toEqual([0, 0, 2027]);
    expect(teilstichproben('Je Quartal 20 Ergebnisse (Stichprobe von Z-003); bei KI-001 die Teile; bei KI-006 50 Gesprächen').map((x) => x.n)).toEqual([20, 50]);
    expect(teilstichproben('Stichprobe von 10 Ergebnissen je System und Quartal')).toEqual([]);
    expect(teilstichproben('Abgleich der Personalliste mit 3 Listen')).toEqual([]);
  });

  const projekt = (wert: string, datum = '2026-12-31', pr12?: number): MessProjekt => ({
    ziele: [{ id: 'Z-002', messmethode: 'Stichprobe von 10 CAM-Programmen und 10 Offerten pro Quartal, ab 2027 zusätzlich 10 Bestellvorschläge', kiSysteme: ['KI-001', 'KI-002', 'KI-003'], messungen: [{ datum, wert }] }],
    kennzahlMessungen: pr12 === undefined ? [] : [{ kennzahl: 'PR-12', datum: '2027-01-29', wert: `${pr12} von 3`, zaehler: pr12, nenner: 3 }],
  });

  it('Nenner gleich Umfang am Messdatum, Zähler höchstens Nenner', () => {
    expect(stichprobenAbweichungen(projekt('95 % (19 von 20)'))).toEqual([]);
    expect(stichprobenAbweichungen(projekt('97 % (29 von 30)', '2027-03-31'))).toEqual([]);
    expect(stichprobenAbweichungen(projekt('95 % (19 von 30)')).map((x) => x.meldung)).toEqual(['Z-002 am 2026-12-31: Nenner 30, Stichprobe laut Methode 20']);
    expect(stichprobenAbweichungen(projekt('(21 von 20)')).map((x) => x.meldung)).toEqual(['Z-002 am 2026-12-31: Zähler 21 über Nenner 20']);
  });

  it('PR-12 zählt höchstens die Systeme, die die Stichproben am Messdatum umfassen (A3-03)', () => {
    expect(stichprobenAbweichungen(projekt('95 % (19 von 20)', '2026-12-31', 2))).toEqual([]);
    expect(stichprobenAbweichungen(projekt('95 % (19 von 20)', '2026-12-31', 3)).map((x) => x.meldung)).toEqual(['PR-12 am 2027-01-29: Zähler 3, die Stichproben der Ziele umfassen 2 Systeme']);
  });
});
