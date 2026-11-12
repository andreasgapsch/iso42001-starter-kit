/**
 * Erkennungstest je Befundklasse (AF-080, QK-48, Entscheid W28): Jede Befundklasse der Auditrunde 3 (A3-01, A3-02b, A3-03,
 * A3-04, A3-07, A3-10, A3-15, A3-22) und die neuen Regeln F34 bis F47 werden mit mindestens zwei abgewandelten Eingaben geprüft,
 * die auf verschiedenen Datenwegen auslösen, dazu mit Grenzfällen, die nicht auslösen dürfen.
 *
 * Geschrieben vor der Behebung von einer getrennten Instanz (W28: Klassentest nicht von derselben Hand wie die Behebung).
 * Grundlage ist allein die vereinbarte Schnittstelle der Regeln, nicht deren Umsetzung. Basis jeder Eingabe ist
 * vollstaendigesProjekt(), das keine Regel auslöst; jede Abwandlung verändert es gezielt.
 *
 * Geprüft werden nur regel, id und schwere eines Befunds, nicht der Name (Format offen).
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { pruefeProjekt, type Regel } from '../../src/regeln/pruefungen.ts';
import { CONTROLS_42001, kiSystem, vollstaendigesProjekt } from '../fixtures/projekt.ts';
import type { DokumentEintrag, Projekt } from '../../src/model/typen.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';

const regeln = (parse(readFileSync('src/regeln/pruefregeln.yaml', 'utf8')) as { regeln: Regel[] }).regeln;
const kataloge = ladeKataloge();
type Kataloge = typeof kataloge;
const pruefe = (p: Projekt, heute = '2027-02-15', k: Kataloge = kataloge) =>
  pruefeProjekt(regeln, { projekt: p, heute, controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge: k });

type Schwere = 'fehler' | 'hinweis';
interface Positiv {
  fall: string;
  aendere: (p: Projekt) => void;
  id: string;
  schwere: Schwere;
  heute?: string;
  kataloge?: Kataloge;
}
interface Negativ {
  fall: string;
  aendere: (p: Projekt) => void;
  heute?: string;
}

/** Befunde einer Regel als { id, schwere } nach der Abwandlung */
function befunde(regel: string, aendere: (p: Projekt) => void, heute?: string, k?: Kataloge) {
  const p = vollstaendigesProjekt();
  aendere(p);
  return pruefe(p, heute, k).filter((b) => b.regel === regel).map((b) => ({ id: b.id, schwere: b.schwere }));
}

/** describe je Klasse: positive Abwandlungen müssen den Befund mit id und schwere liefern, negative keinen Befund der Regel */
function klasse(titel: string, regel: string, positiv: Positiv[], negativ: Negativ[]) {
  describe(titel, () => {
    it('Grundfassung löst nicht aus', () => {
      expect(befunde(regel, () => {})).toEqual([]);
    });
    it.each(positiv.map((f) => [f.fall, f] as const))(`${regel} erkannt: %s`, (_fall, f) => {
      expect(befunde(regel, f.aendere, f.heute, f.kataloge)).toContainEqual({ id: f.id, schwere: f.schwere });
    });
    it.each(negativ.map((f) => [f.fall, f] as const))(`${regel} nicht ausgelöst: %s`, (_fall, f) => {
      expect(befunde(regel, f.aendere, f.heute)).toEqual([]);
    });
  });
}

// ------------------------------------------------------------------------------------------------- Hilfen

/** Freigegebener Registereintrag mit Prüfung und Freigabe am selben Tag */
function dok(id: string, am: string, teil: Partial<DokumentEintrag> = {}): DokumentEintrag {
  return { id, version: '1.0', status: 'freigegeben', freigabe: { von: 'P-001', am }, geprueft: { von: 'P-001', am }, ablageort: 'SharePoint', giltFuerIsms: false, naechsteUeberpruefung: '2027-10-01', ...teil };
}
const control = (p: Projekt, id = 'A.5.2') => p.controls.find((c) => c.id === id)!;
/** Control auf Status setzen und die Wirksamkeit mit Text und Datum belegen */
function wirksamkeit(p: Projekt, wie: string, wann: string, status: 'wirksam' | 'umgesetzt' = 'wirksam', id = 'A.5.2') {
  const c = control(p, id);
  c.status = status;
  c.wirksamkeit = { wie, wann, wer: 'P-001', ergebnis: 'wirksam' };
}
function nachweis(p: Projekt, id: string, datum: string, titel = 'Aufzeichnung') {
  p.nachweise.push({ id, titel, art: 'aufzeichnung', ablageort: 'SharePoint', datum });
}
function tagDavor(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------------------------------------------- F34 (A3-04)

const f34Positiv: Positiv[] = [
  {
    fall: 'wirksam mit offener NK schwer, Normbezug genau das Control',
    aendere: (p) => {
      control(p).status = 'wirksam';
      p.feststellungen.push({ id: 'F-006', quelle: 'audit', einstufung: 'nk-schwer', beschreibung: 'Schwellen falsch angewendet', normbezug: 'A.5.2', korrektur: '', ursache: '', massnahmen: [], status: 'offen', datum: '2026-10-16' });
    },
    id: 'A.5.2', schwere: 'fehler',
  },
  {
    fall: 'wirksam mit NK leicht in Arbeit, Control in einer Liste mit Semikolon und Komma',
    aendere: (p) => {
      control(p, 'A.6.2.4').status = 'wirksam';
      p.feststellungen.push({ id: 'F-007', quelle: 'pruefung', einstufung: 'nk-leicht', beschreibung: 'Test unvollständig', normbezug: '8.1; A.6.2.4, A.6.2.5', korrektur: '', ursache: '', massnahmen: [], status: 'in-arbeit', datum: '2026-10-16' });
    },
    id: 'A.6.2.4', schwere: 'fehler',
  },
  {
    fall: 'NK aus einer Managementbewertung, Normbezug mit Leerzeichen um die Trennzeichen',
    aendere: (p) => {
      control(p, 'A.9.2').status = 'wirksam';
      p.feststellungen.push({ id: 'F-008', quelle: 'managementbewertung', einstufung: 'nk-leicht', beschreibung: 'Nutzung ausserhalb der Freigabe', normbezug: 'A.9.3 ; A.9.2', korrektur: '', ursache: '', massnahmen: [], status: 'offen' });
    },
    id: 'A.9.2', schwere: 'fehler',
  },
];
const f34Negativ: Negativ[] = [
  { fall: 'Control nur umgesetzt', aendere: (p) => { control(p).status = 'umgesetzt'; p.feststellungen.push({ id: 'F-006', quelle: 'audit', einstufung: 'nk-schwer', beschreibung: 'x', normbezug: 'A.5.2', korrektur: '', ursache: '', massnahmen: [], status: 'offen' }); } },
  { fall: 'Feststellung geschlossen', aendere: (p) => { control(p).status = 'wirksam'; p.feststellungen.push({ id: 'F-006', quelle: 'audit', einstufung: 'nk-schwer', beschreibung: 'x', normbezug: 'A.5.2', korrektur: 'k', ursache: 'u', massnahmen: [], status: 'geschlossen', wirksamkeit: { am: '2026-10-17', ergebnis: 'wirksam' } }); } },
  { fall: 'nur Beobachtung', aendere: (p) => { control(p).status = 'wirksam'; p.feststellungen.push({ id: 'F-006', quelle: 'audit', einstufung: 'beobachtung', beschreibung: 'x', normbezug: 'A.5.2', korrektur: '', ursache: '', massnahmen: [], status: 'offen' }); } },
  { fall: 'Normbezug A.5.20 trifft A.5.2 nicht', aendere: (p) => { control(p).status = 'wirksam'; p.feststellungen.push({ id: 'F-006', quelle: 'audit', einstufung: 'nk-schwer', beschreibung: 'x', normbezug: 'A.5.20', korrektur: '', ursache: '', massnahmen: [], status: 'offen' }); } },
];
klasse('A3-04 (F34): Control «wirksam» bei offener Nichtkonformität', 'F34', f34Positiv, f34Negativ);

// ------------------------------------------------------------------------------------------------- F35 (ersetzt H90)

const f35Positiv: Positiv[] = [
  { fall: 'eingeführt ohne jede Aufzeichnung (PR-06)', aendere: (p) => { p.prozesse = [{ id: 'PR-06', reife: 2, reifeAm: '2020-01-01' }]; }, id: 'PR-06', schwere: 'fehler' },
  { fall: 'ableitbare Aufzeichnung erst nach der Einstufung (PR-26, MB-001 am 18.10.2026)', aendere: (p) => { p.prozesse = [{ id: 'PR-26', reife: 3, reifeAm: '2026-09-01' }]; }, id: 'PR-26', schwere: 'fehler' },
  { fall: 'Durchführung von Hand erst nach der Einstufung', aendere: (p) => { p.prozesse = [{ id: 'PR-06', reife: 2, reifeAm: '2026-06-01', letzteDurchfuehrung: '2026-09-01' }]; }, id: 'PR-06', schwere: 'fehler' },
];
const f35Negativ: Negativ[] = [
  { fall: 'Durchführung von Hand vor der Einstufung', aendere: (p) => { p.prozesse = [{ id: 'PR-06', reife: 2, reifeAm: '2020-01-01', letzteDurchfuehrung: '2019-12-01' }]; } },
  { fall: 'Reife 1', aendere: (p) => { p.prozesse = [{ id: 'PR-06', reife: 1, reifeAm: '2020-01-01' }]; } },
  { fall: 'ableitbare Aufzeichnung vor der Einstufung (PR-26, MB-001)', aendere: (p) => { p.prozesse = [{ id: 'PR-26', reife: 3, reifeAm: '2026-11-01' }]; } },
  { fall: 'ableitbare Erfassung eines KI-Systems vor der Einstufung (PR-06)', aendere: (p) => { p.kiSysteme[0]!.erfasstAm = '2019-06-01'; p.prozesse = [{ id: 'PR-06', reife: 2, reifeAm: '2020-01-01' }]; } },
  { fall: 'Prozess nicht anwendbar', aendere: (p) => { p.prozesse = [{ id: 'PR-06', anwendbar: 'nein', begruendung: 'Keine KI-Systeme im Inventar zu führen', reife: 2, reifeAm: '2020-01-01' }]; } },
];
klasse('F35: Prozess «eingeführt» ohne Durchführung', 'F35', f35Positiv, f35Negativ);
describe('F35 ersetzt H90', () => {
  it('H90 kommt in keinem Befund mehr vor', () => {
    const p = vollstaendigesProjekt();
    p.prozesse = [{ id: 'PR-06', reife: 2, reifeAm: '2020-01-01' }];
    expect(pruefe(p).filter((b) => b.regel === 'H90')).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------- F37 (A3-01)

/** Rollen der Bahnen im Katalog, die besetzt sein müssen (ohne gl, aims, ki-eigner, mitarbeitende) */
const BAHNROLLEN_IMMER_BESETZT = new Set(['gl', 'aims', 'ki-eigner', 'mitarbeitende']);
const BAHNROLLEN = [...new Set(
  (kataloge.prozesse_katalog as { prozesse: { schritte?: { bahn: string }[] }[] }).prozesse.flatMap((x) => (x.schritte ?? []).map((s) => s.bahn)),
)].filter((r) => !BAHNROLLEN_IMMER_BESETZT.has(r)).sort();

/**
 * Grundfassung für F37: Projekt führt Prozesse, PR-17 ausdrücklich anwendbar, und P-002 trägt alle Bahnrollen des
 * Katalogs in aimsRollen. Ohne Angabe der fehlenden Rolle löst F37 nicht aus.
 */
function mitBesetztenBahnen(p: Projekt, ohne: string[] = []) {
  p.prozesse = [{ id: 'PR-17', anwendbar: 'ja' }, { id: 'PR-21', anwendbar: 'ja' }];
  p.personen.push({ id: 'P-002', name: 'Rolf Rollen', funktion: 'Leiter Betrieb', aimsRollen: BAHNROLLEN.filter((r) => !ohne.includes(r)) });
}

const f37Positiv: Positiv[] = [
  {
    fall: 'Rolle hr (Personal, PR-21) unbesetzt, D-04 freigegeben',
    aendere: (p) => { mitBesetztenBahnen(p, ['hr']); p.dokumente.push(dok('D-04', '2026-10-10')); },
    id: 'D-04', schwere: 'fehler',
  },
  {
    fall: 'Rolle kommunikation (PR-17) unbesetzt im Pfad mit ISMS, nur D-04-EB freigegeben',
    aendere: (p) => { p.meta.mitIsms = true; mitBesetztenBahnen(p, ['kommunikation']); p.dokumente.push(dok('D-04-EB', '2026-10-10', { giltFuerIsms: true })); },
    id: 'D-04-EB', schwere: 'fehler',
  },
  {
    fall: 'eigene Bahn einkauf im Ablauf von PR-06, D-04 nicht im Register',
    aendere: (p) => {
      mitBesetztenBahnen(p);
      p.prozesse!.push({
        id: 'PR-06', anwendbar: 'ja',
        bahnen: [{ id: 'ki-eigner', rolle: 'ki-eigner' }, { id: 'einkauf', rolle: 'einkauf' }],
        schritte: [
          { id: 'PR-06.00', art: 'start', text: 'Bedarf', bahn: 'ki-eigner', naechste: ['PR-06.01'] },
          { id: 'PR-06.01', art: 'aufgabe', text: 'Angebot einholen', bahn: 'einkauf', naechste: ['PR-06.90'] },
          { id: 'PR-06.90', art: 'ende', text: 'Erfasst', bahn: 'ki-eigner' },
        ],
      });
    },
    id: 'D-04', schwere: 'hinweis',
  },
];
const f37Negativ: Negativ[] = [
  { fall: 'alle Bahnrollen bei einer Person in aimsRollen, D-04 freigegeben', aendere: (p) => { mitBesetztenBahnen(p); p.dokumente.push(dok('D-04', '2026-10-10')); } },
  { fall: 'Rolle hr als Bereich in den Rollen', aendere: (p) => { mitBesetztenBahnen(p, ['hr']); p.rollen.push({ id: 'RO-003', bereich: 'hr', verantwortlich: 'P-001', konsultiert: [], informiert: [] }); } },
  {
    fall: 'eigene Bahn einkauf mit Person',
    aendere: (p) => {
      mitBesetztenBahnen(p);
      p.prozesse!.push({ id: 'PR-06', anwendbar: 'ja', bahnen: [{ id: 'einkauf', rolle: 'einkauf', person: 'P-001' }], schritte: [{ id: 'PR-06.01', art: 'aufgabe', text: 'Angebot einholen', bahn: 'einkauf' }] });
    },
  },
  { fall: 'Projekt führt keine Prozesse', aendere: (p) => { mitBesetztenBahnen(p, ['hr']); delete p.prozesse; } },
];
klasse('A3-01 (F37): Rolle einer Prozessbahn ohne Besetzung', 'F37', f37Positiv, f37Negativ);
describe('F37 bündelt', () => {
  it('zwei unbesetzte Rollen ergeben einen einzigen Befund', () => {
    expect(befunde('F37', (p) => { mitBesetztenBahnen(p, ['hr', 'kommunikation']); p.dokumente.push(dok('D-04', '2026-10-10')); })).toEqual([{ id: 'D-04', schwere: 'fehler' }]);
  });
});

// ------------------------------------------------------------------------------------------------- F38 (A3-22)

/** Kataloge mit einem zusätzlichen Hinweis zu Art. 6(3) (Status auslegung); der Rechtsstand des Kits nennt 6(3) heute nicht */
function katalogeMitHinweis63(): Kataloge {
  const stand = kataloge['aiact_stand'] as { hinweise: { id: string; status: string; artikel: string[] }[] };
  return { ...kataloge, aiact_stand: { ...stand, hinweise: [...stand.hinweise, { id: 'test-ausnahme-6-3', status: 'auslegung', artikel: ['6(3)'] }] } };
}
const f38Positiv: Positiv[] = [
  { fall: 'juristisch geprüft ohne Beleg (wer, wann)', aendere: (p) => { p.kiSysteme[0]!.aiAct.juristischGeprueft = true; }, id: 'KI-001', schwere: 'fehler' },
  {
    fall: 'juristisch geprüft mit Beleg, aber Art. 50(2) mit offener Auslegung (Hinweis uebergang-art-111-4)',
    aendere: (p) => { Object.assign(p.kiSysteme[0]!.aiAct, { juristischGeprueft: true, geprueft: { von: 'Kanzlei', am: '2026-10-01' }, transparenz: ['50-2'] }); },
    id: 'KI-001', schwere: 'fehler',
  },
  {
    fall: 'eingeschränktes zweites System mit Ausnahme nach Art. 6(3) und Hinweis mit Status auslegung',
    aendere: (p) => {
      p.kiSysteme.push(kiSystem({ id: 'KI-002', name: 'Bewerbungsfilter', status: 'eingeschraenkt' }));
      Object.assign(p.kiSysteme[1]!.aiAct, { juristischGeprueft: true, geprueft: { von: 'Kanzlei', am: '2026-10-01' }, ausnahmeArt63: true });
    },
    id: 'KI-002', schwere: 'fehler', kataloge: katalogeMitHinweis63(),
  },
];
const f38Negativ: Negativ[] = [
  { fall: 'juristisch geprüft mit Beleg, ohne Transparenzpflicht', aendere: (p) => { Object.assign(p.kiSysteme[0]!.aiAct, { juristischGeprueft: true, geprueft: { von: 'Kanzlei', am: '2026-10-01' }, transparenz: [] }); } },
  { fall: 'nicht juristisch geprüft, Art. 50(2) betroffen', aendere: (p) => { Object.assign(p.kiSysteme[0]!.aiAct, { juristischGeprueft: false, transparenz: ['50-2'] }); } },
  { fall: 'juristisch geprüft mit Beleg, Art. 50(1) ohne offene Auslegung', aendere: (p) => { Object.assign(p.kiSysteme[0]!.aiAct, { juristischGeprueft: true, geprueft: { von: 'Kanzlei', am: '2026-10-01' }, transparenz: ['50-1'] }); } },
  { fall: 'abgelöstes System ohne Beleg', aendere: (p) => { p.kiSysteme[0]!.status = 'abgeloest'; p.kiSysteme[0]!.aiAct.juristischGeprueft = true; } },
];
klasse('A3-22 (F38): «juristisch geprüft» ohne Beleg oder neben offener Auslegung', 'F38', f38Positiv, f38Negativ);

// ------------------------------------------------------------------------------------------------- F39 (A3-07, A3-23)

const f39Positiv: Positiv[] = [
  { fall: 'Wirksamkeit eines wirksamen Controls nennt jüngeren Nachweis', aendere: (p) => { wirksamkeit(p, 'Stichprobe, Beleg N-002', '2026-10-15'); nachweis(p, 'N-002', '2026-11-01'); }, id: 'A.5.2', schwere: 'fehler' },
  { fall: 'Wirksamkeit eines umgesetzten Controls nennt jüngeren Nachweis', aendere: (p) => { wirksamkeit(p, 'Stichprobe, Beleg N-002', '2026-10-15', 'umgesetzt'); nachweis(p, 'N-002', '2026-11-01'); }, id: 'A.5.2', schwere: 'hinweis' },
  { fall: 'Managementbewertung nennt jüngeren Nachweis in den Entscheiden', aendere: (p) => { p.managementbewertungen[0]!.entscheide = 'Massnahmen gemäss N-002 umsetzen'; nachweis(p, 'N-002', '2026-11-01'); }, id: 'MB-001', schwere: 'fehler' },
  { fall: 'Wirksamkeit nennt ein Audit ohne Durchführung', aendere: (p) => { wirksamkeit(p, 'Internes Audit AU-002', '2026-10-15'); p.audits.push({ ...p.audits[0]!, id: 'AU-002', durchgefuehrt: undefined, geplant: '2027-01-10' }); }, id: 'A.5.2', schwere: 'fehler' },
  { fall: 'Wirksamkeit am ersten Tag eines mehrtägigen Audits', aendere: (p) => { wirksamkeit(p, 'Internes Audit AU-002', '2026-10-15'); p.audits.push({ ...p.audits[0]!, id: 'AU-002', durchgefuehrt: '2026-10-14', durchgefuehrtBis: '2026-10-16' }); }, id: 'A.5.2', schwere: 'fehler' },
  {
    fall: 'Feststellung nennt eine später erfasste Massnahme',
    aendere: (p) => {
      p.feststellungen.push({ id: 'F-001', quelle: 'pruefung', einstufung: 'verbesserung', beschreibung: 'Korrektur mit M-002', normbezug: '10.1', korrektur: '', ursache: '', massnahmen: ['M-002'], status: 'offen', datum: '2026-10-01' });
      p.massnahmen.push({ id: 'M-002', titel: 'Vorlage anpassen', beschreibung: '', status: 'offen', prioritaet: 'mittel', herkunft: { art: 'pruefung' }, erfasstAm: '2026-10-10', verantwortlich: 'P-001', termin: '2027-03-31' });
    },
    id: 'F-001', schwere: 'fehler',
  },
  {
    fall: 'Messung eines Ziels nennt eine später erfasste Feststellung',
    aendere: (p) => {
      p.ziele[0]!.messungen = [{ datum: '2026-10-01', wert: '90 %', sollErreicht: 'nein', bemerkung: 'Abweichung in F-002' }];
      p.feststellungen.push({ id: 'F-002', quelle: 'pruefung', einstufung: 'verbesserung', beschreibung: 'Inventar unvollständig', normbezug: '9.1', korrektur: '', ursache: '', massnahmen: [], status: 'offen', datum: '2026-09-28', erfasstAm: '2026-10-05' });
    },
    id: 'Z-001', schwere: 'fehler',
  },
];
const f39Negativ: Negativ[] = [
  { fall: 'Nachweis vom selben Tag wie die Wirksamkeit', aendere: (p) => { wirksamkeit(p, 'Stichprobe, Beleg N-002', '2026-10-15'); nachweis(p, 'N-002', '2026-10-15'); } },
  { fall: 'Nachweis vom selben Tag wie die Managementbewertung', aendere: (p) => { p.managementbewertungen[0]!.entscheide = 'Massnahmen gemäss N-002 umsetzen'; nachweis(p, 'N-002', '2026-10-18'); } },
  { fall: 'Audit vor der Wirksamkeit durchgeführt', aendere: (p) => { wirksamkeit(p, 'Internes Audit AU-002', '2026-10-15'); p.audits.push({ ...p.audits[0]!, id: 'AU-002', durchgefuehrt: '2026-10-10' }); } },
];
klasse('A3-07 (F39): Beleg jünger als die Aussage', 'F39', f39Positiv, f39Negativ);

// ------------------------------------------------------------------------------------------------- F40 (A3-10)

/** D-12 mit Version 1.0 am 01.09.2026 und Version 1.1 am 15.11.2026 */
const d12ZweiVersionen = () => dok('D-12', '2026-11-15', {
  version: '1.1',
  aenderungen: [{ version: '1.0', datum: '2026-09-01', was: 'Erstfassung', von: 'P-001' }, { version: '1.1', datum: '2026-11-15', was: 'Auslöser ergänzt', von: 'P-001' }],
});
const f40Positiv: Positiv[] = [
  { fall: 'Wirksamkeit verweist auf Dokument vor dessen erster Freigabe', aendere: (p) => { wirksamkeit(p, 'Übung nach D-12', '2026-10-15'); p.dokumente.push(dok('D-12', '2026-12-08')); }, id: 'A.5.2', schwere: 'fehler' },
  { fall: 'umgesetztes Control, gleicher Verweis', aendere: (p) => { wirksamkeit(p, 'Übung nach D-12', '2026-10-15', 'umgesetzt'); p.dokumente.push(dok('D-12', '2026-12-08')); }, id: 'A.5.2', schwere: 'hinweis' },
  {
    fall: 'erledigte Massnahme verweist auf Dokument, erste Freigabe laut Änderungshistorie danach',
    aendere: (p) => {
      p.massnahmen.push({ id: 'M-001', titel: 'Schulung', beschreibung: 'Schulung gemäss D-17 durchgeführt', verantwortlich: 'P-001', termin: '2026-10-01', status: 'erledigt', prioritaet: 'mittel', herkunft: { art: 'risiko' }, erledigtAm: '2026-10-01', nachweise: ['N-001'] });
      p.dokumente.push(dok('D-17', '2026-11-01', { aenderungen: [{ version: '1.0', datum: '2026-11-01', was: 'Erstfassung', von: 'P-001' }] }));
    },
    id: 'M-001', schwere: 'fehler',
  },
  { fall: 'Verweis mit Version «v1.1», die erst danach freigegeben wurde', aendere: (p) => { wirksamkeit(p, 'Prüfung nach D-12 v1.1', '2026-10-15'); p.dokumente.push(d12ZweiVersionen()); }, id: 'A.5.2', schwere: 'fehler' },
  { fall: 'Verweis mit «Version 2.0», die es nicht gibt', aendere: (p) => { wirksamkeit(p, 'Prüfung gemäss D-12 Version 2.0', '2026-10-15'); p.dokumente.push(dok('D-12', '2026-09-01')); }, id: 'A.5.2', schwere: 'fehler' },
  {
    fall: 'Originalfall: Ereignisdatum im Text vor der ersten Freigabe, Wirksamkeit danach',
    aendere: (p) => { wirksamkeit(p, 'Aussetzen von KI-001 am 25.08.2026 nach den Schritten in D-12', '2027-01-20'); p.dokumente.push(dok('D-12', '2026-12-08')); },
    id: 'A.5.2', schwere: 'fehler',
  },
  {
    fall: 'Ereignisdatum englisch mit Schrägstrich und «according to»',
    aendere: (p) => { wirksamkeit(p, 'Suspension of KI-001 on 25/08/2026 according to D-12', '2027-01-20'); p.dokumente.push(dok('D-12', '2026-12-08')); },
    id: 'A.5.2', schwere: 'fehler',
  },
  { fall: 'Checkliste des Audits nennt Dokument vor dessen Freigabe', aendere: (p) => { p.audits[0]!.checkliste = { 'A.5.2': { nachweis: 'D-12', ergebnis: 'konform' } }; p.dokumente.push(dok('D-12', '2026-12-08')); }, id: 'AU-001', schwere: 'hinweis' },
  {
    fall: 'Wirksamkeitsprüfung einer Feststellung nennt Dokument vor dessen Freigabe',
    aendere: (p) => {
      p.feststellungen.push({ id: 'F-001', quelle: 'audit', einstufung: 'nk-leicht', beschreibung: 'x', normbezug: '7.2', korrektur: 'k', ursache: 'u', massnahmen: [], status: 'geschlossen', datum: '2026-09-01', wirksamkeit: { am: '2026-10-01', ergebnis: 'wirksam laut D-14' } });
      p.dokumente.push(dok('D-14', '2026-11-01'));
    },
    id: 'F-001', schwere: 'hinweis',
  },
];
const f40Negativ: Negativ[] = [
  { fall: 'Dokument vor der Wirksamkeit freigegeben', aendere: (p) => { wirksamkeit(p, 'Übung nach D-12', '2026-10-15'); p.dokumente.push(dok('D-12', '2026-10-01')); } },
  { fall: 'Zusatz «(in Erarbeitung)» direkt nach dem Verweis', aendere: (p) => { wirksamkeit(p, 'Übung nach D-12 (in Erarbeitung)', '2026-10-15'); p.dokumente.push(dok('D-12', '2026-12-08')); } },
  { fall: 'Version 1.0 vor der Wirksamkeit freigegeben, 1.1 erst danach', aendere: (p) => { wirksamkeit(p, 'Prüfung nach D-12 v1.0', '2026-10-15'); p.dokumente.push(d12ZweiVersionen()); } },
  { fall: 'Ereignisdatum nach der ersten Freigabe', aendere: (p) => { wirksamkeit(p, 'Aussetzen von KI-001 am 15.12.2026 nach den Schritten in D-12', '2027-01-20'); p.dokumente.push(dok('D-12', '2026-12-08')); } },
];
klasse('A3-10 (F40): Verweis auf eine Version, die zum Belegdatum nicht freigegeben war', 'F40', f40Positiv, f40Negativ);

// ------------------------------------------------------------------------------------------------- F41 (A3-07)

const STAND_GEPRUEFT = (kataloge['aiact_stand'] as { geprueft_am: string }).geprueft_am;
const f41Positiv: Positiv[] = [
  { fall: 'E-09 vor dem Prüfdatum des Rechtsstands freigegeben', aendere: (p) => { p.dokumente.push(dok('E-09', tagDavor(STAND_GEPRUEFT))); }, id: 'E-09', schwere: 'fehler' },
  { fall: 'E-01 alt freigegeben, Bestätigung ebenfalls vor dem Prüfdatum', aendere: (p) => { p.dokumente.push(dok('E-01', '2026-08-01', { bestaetigt: { von: 'P-001', am: tagDavor(STAND_GEPRUEFT) } })); }, id: 'E-01', schwere: 'fehler' },
  { fall: 'Wirksamkeit mit «Stand» nach dem Datum der Aussage', aendere: (p) => { wirksamkeit(p, 'Abgleich der Rechtsquellen, Stand 02.11.2026', '2026-10-15'); }, id: 'A.5.2', schwere: 'fehler' },
  { fall: 'Managementbewertung mit «abgerufen am» nach dem Datum', aendere: (p) => { p.managementbewertungen[0]!.ergebnisse = { aiact: 'Leitlinien der Kommission abgerufen am 02.11.2026' }; }, id: 'MB-001', schwere: 'fehler' },
  { fall: 'Nachweis englisch mit «as of» nach dem Datum', aendere: (p) => { nachweis(p, 'N-002', '2026-10-01', 'Legal sources as of 15.10.2026'); }, id: 'N-002', schwere: 'fehler' },
];
const f41Negativ: Negativ[] = [
  { fall: 'E-09 am Prüfdatum freigegeben', aendere: (p) => { p.dokumente.push(dok('E-09', STAND_GEPRUEFT)); } },
  { fall: 'E-09 alt, aber am Prüfdatum bestätigt', aendere: (p) => { p.dokumente.push(dok('E-09', '2026-08-01', { bestaetigt: { von: 'P-001', am: STAND_GEPRUEFT } })); } },
  { fall: 'Termin ohne Kennzeichnung in einer älteren Aussage', aendere: (p) => { wirksamkeit(p, 'Nachprüfung bis 31.03.2027', '2026-10-15'); } },
  { fall: '«Stand» am selben Tag wie die Aussage', aendere: (p) => { wirksamkeit(p, 'Abgleich der Rechtsquellen, Stand 15.10.2026', '2026-10-15'); } },
];
klasse('A3-07 (F41): Datum im Text jünger als das Kopfdatum', 'F41', f41Positiv, f41Negativ);

// ------------------------------------------------------------------------------------------------- F42 (A3-03)

/** Zwei Systeme im Betrieb; Ziel Z-001 mit Messmethode und Messung am Datum, PR-12 meldet am selben Tag */
function stichprobe(p: Projekt, o: { messmethode: string; kiSysteme?: string[]; messDatum?: string; pr12Datum?: string; wert?: string; zaehler?: number; nenner?: number }) {
  p.kiSysteme.push(kiSystem({ id: 'KI-002', name: 'Offerten KI', status: 'freigegeben' }));
  const z = p.ziele[0]!;
  z.messmethode = o.messmethode;
  z.kiSysteme = o.kiSysteme ?? [];
  z.messungen = [{ datum: o.messDatum ?? '2026-12-31', wert: '95 %', sollErreicht: 'ja' }];
  p.kennzahlMessungen = [{ kennzahl: 'PR-12', datum: o.pr12Datum ?? '2026-12-31', wert: o.wert ?? '100 %', sollErreicht: 'ja', zaehler: o.zaehler, nenner: o.nenner }];
}
const KLAUSEL_DE = 'Stichprobe von 10 Antworten aus Copilot; ab 2027 zusätzlich 10 Vorschläge der Offerten KI';
const f42Positiv: Positiv[] = [
  { fall: 'Klausel «ab 2027» nennt ein Wort aus dem Namen, Wert «2 von 2» im Text', aendere: (p) => { stichprobe(p, { messmethode: `${KLAUSEL_DE}.`, wert: '2 von 2 (100 %)' }); }, id: 'PR-12', schwere: 'fehler' },
  { fall: 'Klausel englisch «from 2027» mit KI-ID, Zähler im Feld (KI-001 in der Methode genannt, damit nur die Klausel auslöst)', aendere: (p) => { stichprobe(p, { messmethode: 'Sample of 10 answers from Copilot; from 2027 also 10 proposals of KI-002.', zaehler: 2, nenner: 2 }); }, id: 'PR-12', schwere: 'fehler' },
  { fall: 'Ziel führt das zweite System nicht', aendere: (p) => { stichprobe(p, { messmethode: 'Stichprobe von 10 Antworten', kiSysteme: ['KI-001'], wert: '2 von 2' }); }, id: 'PR-12', schwere: 'fehler' },
  {
    fall: 'zweites System nur mit Messung älter als drei Monate',
    aendere: (p) => {
      stichprobe(p, { messmethode: 'Stichprobe von 10 Antworten', kiSysteme: ['KI-001'], zaehler: 2, nenner: 2 });
      p.ziele.push({ ...p.ziele[0]!, id: 'Z-002', kiSysteme: ['KI-002'], messungen: [{ datum: '2026-06-30', wert: '90 %', sollErreicht: 'ja' }] });
    },
    id: 'PR-12', schwere: 'fehler',
  },
];
const f42Negativ: Negativ[] = [
  { fall: 'Ziel-Messung nach Beginn der Klausel', aendere: (p) => { stichprobe(p, { messmethode: `${KLAUSEL_DE}.`, messDatum: '2027-03-31', pr12Datum: '2027-04-15', zaehler: 2, nenner: 2 }); }, heute: '2027-05-01' },
  { fall: 'Zähler passt zur Stichprobe (1 von 2)', aendere: (p) => { stichprobe(p, { messmethode: `${KLAUSEL_DE}.`, wert: '1 von 2 (50 %)', zaehler: 1, nenner: 2 }); } },
  {
    fall: 'keine Messung möglich',
    aendere: (p) => { stichprobe(p, { messmethode: `${KLAUSEL_DE}.` }); p.kennzahlMessungen = [{ kennzahl: 'PR-12', datum: '2026-12-31', wert: 'noch keine Messung', keineMessung: 'erste-offen', bemerkung: 'erste Stichprobe im Januar' }]; },
  },
];
klasse('A3-03 (F42): Stichprobe deckt nicht alle gezählten Systeme', 'F42', f42Positiv, f42Negativ);

// ------------------------------------------------------------------------------------------------- F43 (A3-15)

const f43Positiv: Positiv[] = [
  { fall: 'PR-19 mit Wert und Sollvergleich', aendere: (p) => { p.kennzahlMessungen = [{ kennzahl: 'PR-19', datum: '2026-12-31', wert: '6 Stunden', sollErreicht: 'ja' }]; }, id: 'PR-19', schwere: 'fehler' },
  {
    fall: 'PR-19 ohne Sollvergleich, trotz Vorfall mit Datum',
    aendere: (p) => {
      p.feststellungen.push({ id: 'F-001', quelle: 'vorfall', einstufung: 'nk-leicht', beschreibung: 'Falsche Antwort versendet', normbezug: 'A.8.4', korrektur: 'k', ursache: 'u', massnahmen: [], status: 'geschlossen', datum: '2026-11-03', wirksamkeit: { am: '2026-12-01', ergebnis: 'wirksam' } });
      p.kennzahlMessungen = [{ kennzahl: 'PR-19', datum: '2026-12-31', wert: '30 Stunden' }];
    },
    id: 'PR-19', schwere: 'hinweis',
  },
  {
    // P14 (AF-104): Entdeckung mit Uhrzeit, aber keine Eindämmung im Register D-22
    fall: 'PR-19, Beinahe-Vorfall mit Entdeckung um 09:40, ohne Eindämmung',
    aendere: (p) => {
      p.feststellungen.push({ id: 'F-001', quelle: 'beinahe-vorfall', einstufung: 'beobachtung', beschreibung: 'Falsche Zahl knapp vor Versand bemerkt', normbezug: 'A.8.4', korrektur: 'k', ursache: 'u', massnahmen: [], status: 'geschlossen', datum: '2026-11-03', entdecktAm: '2026-11-03T09:40' });
      p.kennzahlMessungen = [{ kennzahl: 'PR-19', datum: '2026-12-31', wert: '2 Stunden', sollErreicht: 'ja' }];
    },
    id: 'PR-19', schwere: 'fehler',
  },
  {
    // P14 (AF-104): Eindämmung nur mit Datum, ohne Uhrzeit: Stunden nicht messbar
    fall: 'PR-19, Eindämmung ohne Uhrzeit',
    aendere: (p) => {
      p.feststellungen.push({ id: 'F-001', quelle: 'vorfall', einstufung: 'nk-leicht', beschreibung: 'Falsche Antwort versendet', normbezug: 'A.8.4', korrektur: 'k', ursache: 'u', massnahmen: [], status: 'geschlossen', datum: '2026-11-03', entdecktAm: '2026-11-03T09:40', eingedaemmtAm: '2026-11-04' });
      p.kennzahlMessungen = [{ kennzahl: 'PR-19', datum: '2026-12-31', wert: '24 Stunden', sollErreicht: 'ja' }];
    },
    id: 'PR-19', schwere: 'fehler',
  },
  { fall: 'PR-07 ohne System mit Erfassung und Freigabe', aendere: (p) => { p.kennzahlMessungen = [{ kennzahl: 'PR-07', datum: '2026-12-31', wert: '5 Tage', sollErreicht: 'ja' }]; }, id: 'PR-07', schwere: 'fehler' },
  {
    fall: 'PR-07, Freigabe erst nach dem Messdatum, ohne Sollvergleich',
    aendere: (p) => { p.kiSysteme[0]!.erfasstAm = '2026-09-01'; p.kiSysteme[0]!.freigabe = { von: 'P-001', am: '2027-01-10' }; p.kennzahlMessungen = [{ kennzahl: 'PR-07', datum: '2026-12-31', wert: '5 Tage' }]; },
    id: 'PR-07', schwere: 'hinweis',
  },
  {
    // P14 (AF-104): Erfassung und Freigabe sind nicht Antrag und Entscheid; ohne «Antrag am» ist PR-07 nicht messbar
    fall: 'PR-07, erfasst und freigegeben, aber ohne Antrag und Entscheid',
    aendere: (p) => { p.kiSysteme[0]!.erfasstAm = '2026-09-01'; p.kiSysteme[0]!.freigabe = { von: 'P-001', am: '2026-09-15' }; p.kennzahlMessungen = [{ kennzahl: 'PR-07', datum: '2026-12-31', wert: '14 Tage', sollErreicht: 'nein' }]; },
    id: 'PR-07', schwere: 'fehler',
  },
  {
    fall: 'PR-07, Entscheid erst nach dem Messdatum',
    aendere: (p) => { p.kiSysteme[0]!.antragAm = '2026-12-01'; p.kiSysteme[0]!.entscheidAm = '2027-01-05'; p.kennzahlMessungen = [{ kennzahl: 'PR-07', datum: '2026-12-31', wert: '5 Tage', sollErreicht: 'ja' }]; },
    id: 'PR-07', schwere: 'fehler',
  },
];
const f43Negativ: Negativ[] = [
  { fall: 'PR-19 ohne Anlass', aendere: (p) => { p.kennzahlMessungen = [{ kennzahl: 'PR-19', datum: '2026-12-31', wert: 'noch keine Messung', keineMessung: 'kein-anlass', bemerkung: 'kein Vorfall' }]; } },
  {
    // Erwartung geändert (P14, AF-104): Datenquelle PR-07 sind «Antrag am» und «Entscheid am» (D-10), nicht Erfassung und Freigabe
    fall: 'PR-07 mit System, Antrag und Entscheid vor dem Messdatum',
    aendere: (p) => { p.kiSysteme[0]!.antragAm = '2026-09-01'; p.kiSysteme[0]!.entscheidAm = '2026-09-15'; p.kennzahlMessungen = [{ kennzahl: 'PR-07', datum: '2026-12-31', wert: '14 Tage', sollErreicht: 'nein' }]; },
  },
  {
    fall: 'PR-19 mit Vorfall und Beinahe-Vorfall, Entdeckung und Eindämmung mit Uhrzeit',
    aendere: (p) => {
      p.feststellungen.push({ id: 'F-001', quelle: 'vorfall', einstufung: 'nk-leicht', beschreibung: 'Falsche Antwort versendet', normbezug: 'A.8.4', korrektur: 'k', ursache: 'u', massnahmen: [], status: 'geschlossen', datum: '2026-11-03', entdecktAm: '2026-11-03T09:40', eingedaemmtAm: '2026-11-03T15:10' });
      p.feststellungen.push({ id: 'F-002', quelle: 'beinahe-vorfall', einstufung: 'beobachtung', beschreibung: 'Knapp bemerkt', normbezug: 'A.8.4', korrektur: 'k', ursache: 'u', massnahmen: [], status: 'geschlossen', datum: '2026-12-02', entdecktAm: '2026-12-02T08:00', eingedaemmtAm: '2026-12-02T08:30' });
      p.kennzahlMessungen = [{ kennzahl: 'PR-19', datum: '2026-12-31', wert: '6 Stunden', sollErreicht: 'ja' }];
    },
  },
];
klasse('A3-15 (F43): Kennzahl ohne Datenquelle', 'F43', f43Positiv, f43Negativ);

// ------------------------------------------------------------------------------------------------- F44 bis F47 (A3-02b)
// P14 (AF-095, QK-52): Folgenabschätzung tragfähig. Vor der Umsetzung der Regeln geschrieben (W28), Grundlage nur die
// Schnittstelle: Regel, ID (Abschätzung IA-xxx, bei F47 das KI-System) und Schwere (Fehler mit Freigabe der Abschätzung).

type Ia = Projekt['folgenabschaetzungen'][number];
/** Folgenabschätzung für KI-001 ohne Befund: Kurzprüfung ohne Schwelle, je Ziel eigener Text, kein Ausmass */
function ia(teil: Partial<Ia> = {}): Ia {
  return {
    id: 'IA-001', kiSystem: 'KI-001',
    triage: { rechtspositionOderChancen: false, gesundheitOderSicherheit: false, verletzlicheGruppen: false, besondereDaten: false, automatisierteEntscheidung: false, grosseReichweite: false, ergebnis: 'kurz', begruendung: 'keine Schwelle', durch: 'P-001', am: '2026-10-01' },
    systembeschreibung: 'Assistent', verwendungen: 'Texte', fehlanwendungen: 'keine', daten: 'intern', einsatzumfeld: 'Büro', betroffene: [],
    nutzenSchaden: {
      rechenschaft: { nutzen: 'Entwürfe sind nachvollziehbar abgelegt', schaden: 'Verantwortung für Fehler unklar' },
      fairness: { nutzen: 'Gleiche Vorlage für alle Kunden', schaden: 'Ungleiche Tonalität je Sprache' },
      zuverlaessigkeit: { nutzen: 'Weniger Tippfehler', schaden: 'Falsche Zahlen in Offerten (R-001)' },
    },
    ausfaelle: 'manuell', massnahmen: 'Vier-Augen-Prinzip', sensibleNutzung: false, eingeschraenkteNutzung: false, ergebnis: 'einsetzen',
    freigabe: { von: 'P-001', am: '2026-10-05' },
    ...teil,
  };
}
/** Auswirkungsskala mit vier Stufen (D-06): hoch sind 3 und 4 */
function vierStufen(p: Projekt) {
  p.organisation.risikokriterien.auswirkung = [1, 2, 3, 4].map((stufe) => ({ stufe, bezeichnung: ['gering', 'spürbar', 'erheblich', 'schwer'][stufe - 1]!, beschreibung: '' }));
}
const gleich = { nutzen: 'Zeitersparnis bei Entwürfen und Zusammenfassungen', schaden: 'Kein besonderer Schaden erkennbar' };
function ohneFreigabe(x: Ia): Ia {
  const kopie = { ...x };
  delete kopie.freigabe;
  return kopie;
}

const f44Positiv: Positiv[] = [
  {
    fall: 'fünf Ziele mit wortgleichem Nutzen und Schaden (IA-001 im Beispiel P), freigegeben',
    aendere: (p) => { p.folgenabschaetzungen = [ia({ nutzenSchaden: { rechenschaft: gleich, fairness: gleich, zuverlaessigkeit: gleich, erklaerbarkeit: gleich, umwelt: gleich } })]; },
    id: 'IA-001', schwere: 'fehler',
  },
  {
    fall: 'drei Ziele mit gleichem Schaden, abweichend nur in Gross- und Kleinschreibung, Leerzeichen und Punkt, nicht freigegeben',
    aendere: (p) => {
      p.folgenabschaetzungen = [ohneFreigabe(ia({ id: 'IA-002', nutzenSchaden: {
        datenschutz: { nutzen: 'Weniger Kopien', schaden: 'Kein Schaden erkennbar.' },
        transparenz: { nutzen: 'Kennzeichnung', schaden: 'kein  Schaden erkennbar' },
        sicherheit: { nutzen: 'Prüfung vor Versand', schaden: 'Kein Schaden Erkennbar' },
      } }))];
    },
    id: 'IA-002', schwere: 'hinweis',
  },
];
const f44Negativ: Negativ[] = [
  { fall: 'eine Wiederholung je Abschätzung ist zulässig', aendere: (p) => { p.folgenabschaetzungen = [ia({ nutzenSchaden: { umwelt: { nutzen: 'Weniger Papier', schaden: 'Kein Schaden erkennbar' }, sicherheit: { nutzen: 'Prüfung vor Versand', schaden: 'Kein Schaden erkennbar' } } })]; } },
  { fall: 'leere Zellen und Striche zählen nicht', aendere: (p) => { p.folgenabschaetzungen = [ia({ nutzenSchaden: { umwelt: { nutzen: '', schaden: '-' }, sicherheit: { nutzen: '', schaden: '-' }, transparenz: { nutzen: '', schaden: '' }, fairness: { nutzen: 'x', schaden: '' } } })]; } },
  {
    fall: 'knappe Antworten wie «Keiner.» und «Nicht wesentlich» zählen nicht (Schatten-KI ohne Nutzen)',
    aendere: (p) => { p.folgenabschaetzungen = [ia({ nutzenSchaden: { rechenschaft: { nutzen: 'Keiner.', schaden: 'Keine verantwortliche Person' }, transparenz: { nutzen: 'Keiner.', schaden: 'Kunden wussten nichts davon' }, sicherheit: { nutzen: 'Keiner', schaden: 'Daten ausserhalb unserer Kontrolle' }, umwelt: { nutzen: 'Nicht wesentlich.', schaden: 'Nicht wesentlich.' } } })]; },
  },
];
klasse('A3-02b (F44): Folgenabschätzung mit wortgleichen Zellen über Ziele', 'F44', f44Positiv, f44Negativ);

const f45Positiv: Positiv[] = [
  {
    fall: 'Sicherheit nennt R-001 mit Ausmass 2, Register A 3 vor und nach der Behandlung, freigegeben',
    aendere: (p) => { vierStufen(p); p.folgenabschaetzungen = [ia({ nutzenSchaden: { sicherheit: { nutzen: 'Prüfung', schaden: 'Datenabfluss nach R-001', ausmass: 2 } } })]; },
    id: 'IA-001', schwere: 'fehler',
  },
  {
    fall: 'Datenschutz nennt R-001 im Nutzen mit Ausmass 4, nicht freigegeben',
    aendere: (p) => { vierStufen(p); p.folgenabschaetzungen = [ohneFreigabe(ia({ nutzenSchaden: { datenschutz: { nutzen: 'Schutz nach Massnahme zu R-001', schaden: 'Personendaten im Prompt', ausmass: 4 } } }))]; },
    id: 'IA-001', schwere: 'hinweis',
  },
  {
    // Erwartung geändert (P14 S1): Ausmass ist der Schaden vor Massnahmen; gleich A nach der Behandlung genügt nicht mehr
    fall: 'Ausmass gleich A nach der Behandlung, aber nicht gleich A vor der Behandlung',
    aendere: (p) => { vierStufen(p); p.risiken[0]!.a = 4; p.risiken[0]!.aNach = 3; p.folgenabschaetzungen = [ia({ nutzenSchaden: { sicherheit: { nutzen: 'Prüfung', schaden: 'R-001', ausmass: 3 } } })]; },
    id: 'IA-001', schwere: 'fehler',
  },
];
const f45Negativ: Negativ[] = [
  { fall: 'Ausmass gleich A vor der Behandlung', aendere: (p) => { vierStufen(p); p.risiken[0]!.a = 4; p.risiken[0]!.aNach = 2; p.folgenabschaetzungen = [ia({ eingeschraenkteNutzung: true, nutzenSchaden: { sicherheit: { nutzen: 'Prüfung', schaden: 'R-001', ausmass: 4 } } })]; } },
  { fall: 'Ziel ohne Ausmass oder ohne Risiko-ID', aendere: (p) => { vierStufen(p); p.folgenabschaetzungen = [ia({ nutzenSchaden: { sicherheit: { nutzen: 'Prüfung', schaden: 'R-001' }, umwelt: { nutzen: 'x', schaden: 'Strom', ausmass: 1 } } })]; } },
];
klasse('A3-02b (F45): Ausmass in der Folgenabschätzung anders als im Risikoregister', 'F45', f45Positiv, f45Negativ);

const f46Positiv: Positiv[] = [
  {
    fall: 'Ausmass 3 auf vier Stufen, eingeschränkte Nutzung nein (IA-001 im Beispiel P), freigegeben',
    aendere: (p) => { vierStufen(p); p.folgenabschaetzungen = [ia({ triage: { ...ia().triage, ergebnis: 'voll' }, nutzenSchaden: { datenschutz: { nutzen: 'x', schaden: 'Personendaten in Offerten', ausmass: 3 } } })]; },
    id: 'IA-001', schwere: 'fehler',
  },
  {
    fall: 'Ausmass 4, eingeschränkte Nutzung ja, System aber freigegeben ohne Auflagen',
    aendere: (p) => { vierStufen(p); p.folgenabschaetzungen = [ia({ eingeschraenkteNutzung: true, nutzenSchaden: { sicherheit: { nutzen: 'x', schaden: 'Fehlsteuerung', ausmass: 4 } } })]; },
    id: 'IA-001', schwere: 'fehler',
  },
  {
    fall: 'Kurzprüfung: Frage 2 (Gesundheit) ja, Ergebnis trotzdem Kurzprüfung, nicht freigegeben',
    aendere: (p) => { p.folgenabschaetzungen = [ohneFreigabe(ia({ triage: { ...ia().triage, gesundheitOderSicherheit: true } }))]; },
    id: 'IA-001', schwere: 'hinweis',
  },
  {
    fall: 'Kurzprüfung: zwei der Fragen 3 bis 6 ja, volle Abschätzung, aber sensible Nutzung nein',
    aendere: (p) => { p.folgenabschaetzungen = [ia({ triage: { ...ia().triage, besondereDaten: true, grosseReichweite: true, ergebnis: 'voll' } })]; },
    id: 'IA-001', schwere: 'fehler',
  },
];
const f46Negativ: Negativ[] = [
  { fall: 'Ausmass 3, eingeschränkte Nutzung ja, System eingeschränkt', aendere: (p) => { vierStufen(p); p.kiSysteme[0]!.status = 'eingeschraenkt'; p.folgenabschaetzungen = [ia({ eingeschraenkteNutzung: true, nutzenSchaden: { datenschutz: { nutzen: 'x', schaden: 'y', ausmass: 3 } } })]; } },
  { fall: 'Ausmass 4, eingeschränkte Nutzung ja, System freigegeben mit Auflagen', aendere: (p) => { vierStufen(p); p.kiSysteme[0]!.auflagen = 'nur mit Prüfung durch Fachperson'; p.folgenabschaetzungen = [ia({ eingeschraenkteNutzung: true, nutzenSchaden: { datenschutz: { nutzen: 'x', schaden: 'y', ausmass: 4 } } })]; } },
  { fall: 'Ausmass 2 auf vier Stufen', aendere: (p) => { vierStufen(p); p.folgenabschaetzungen = [ia({ nutzenSchaden: { datenschutz: { nutzen: 'x', schaden: 'y', ausmass: 2 } } })]; } },
  // P14 S2: untersagtes oder ausgesetztes System erfüllt «gar nicht erlaubt» (D-08), auch ohne eingeschränkte Nutzung
  { fall: 'Ausmass 4, eingeschränkte Nutzung nein, System untersagt', aendere: (p) => { vierStufen(p); p.kiSysteme[0]!.status = 'untersagt'; p.folgenabschaetzungen = [ia({ nutzenSchaden: { datenschutz: { nutzen: 'x', schaden: 'y', ausmass: 4 } } })]; } },
  { fall: 'Ausmass 3, eingeschränkte Nutzung nein, System ausgesetzt', aendere: (p) => { vierStufen(p); p.kiSysteme[0]!.status = 'ausgesetzt'; p.folgenabschaetzungen = [ia({ nutzenSchaden: { sicherheit: { nutzen: 'x', schaden: 'y', ausmass: 3 } } })]; } },
  { fall: 'Grenzfall: genau eine der Fragen 3 bis 6 ja', aendere: (p) => { p.folgenabschaetzungen = [ia({ triage: { ...ia().triage, verletzlicheGruppen: true } })]; } },
  {
    fall: 'ältere Abschätzung mit Ausmass 4, die neuere ohne hohes Ausmass gilt',
    aendere: (p) => {
      vierStufen(p);
      p.folgenabschaetzungen = [
        ia({ nutzenSchaden: { sicherheit: { nutzen: 'x', schaden: 'y', ausmass: 4 } }, freigabe: { von: 'P-001', am: '2026-03-01' } }),
        ia({ id: 'IA-002', nutzenSchaden: { sicherheit: { nutzen: 'x', schaden: 'nach Massnahmen gering', ausmass: 1 } }, freigabe: { von: 'P-001', am: '2026-10-05' } }),
      ];
    },
  },
];
klasse('A3-02b (F46): Entscheid der Folgenabschätzung folgt nicht der Schwelle aus D-08', 'F46', f46Positiv, f46Negativ);

// P14 S1: Ausmass in D-09 ist der Schaden vor Massnahmen; F45 vergleicht mit A vor der Behandlung, F46 prüft dasselbe Ausmass
describe('P14 S1: F45 und F46 rechnen beide mit dem Ausmass vor Massnahmen', () => {
  const mit = (eingeschraenkt: boolean) => (p: Projekt) => {
    vierStufen(p);
    p.risiken[0]!.a = 3;
    p.risiken[0]!.aNach = 2;
    p.folgenabschaetzungen = [ia({ eingeschraenkteNutzung: eingeschraenkt, nutzenSchaden: { sicherheit: { nutzen: 'Prüfung', schaden: 'Datenabfluss (R-001)', ausmass: 3 } } })];
  };
  it('Ausmass 3 gleich A vor der Behandlung, A nach 2: F45 still, F46 verlangt eingeschränkte Nutzung', () => {
    expect(befunde('F45', mit(false))).toEqual([]);
    expect(befunde('F46', mit(false))).toEqual([{ id: 'IA-001', schwere: 'fehler' }]);
  });
  it('mit eingeschränkter Nutzung und Auflagen: weder F45 noch F46', () => {
    const auflagen = (p: Projekt) => { mit(true)(p); p.kiSysteme[0]!.auflagen = 'nur mit Prüfung'; };
    expect(befunde('F45', auflagen)).toEqual([]);
    expect(befunde('F46', auflagen)).toEqual([]);
  });
});

const f47Positiv: Positiv[] = [
  {
    fall: 'Abschätzung «sensible Nutzung», Inventar nicht (D-10 im Beispiel P), freigegeben',
    aendere: (p) => { p.kiSysteme[0]!.sensibleNutzung = false; p.folgenabschaetzungen = [ia({ sensibleNutzung: true, triage: { ...ia().triage, rechtspositionOderChancen: true, ergebnis: 'voll' } })]; },
    id: 'KI-001', schwere: 'fehler',
  },
  {
    fall: 'Inventar «sensibel», Abschätzung nicht, Abschätzung nicht freigegeben',
    aendere: (p) => { p.kiSysteme[0]!.sensibleNutzung = true; p.folgenabschaetzungen = [ohneFreigabe(ia())]; },
    id: 'KI-001', schwere: 'hinweis',
  },
];
const f47Negativ: Negativ[] = [
  { fall: 'Inventar und Abschätzung gleich', aendere: (p) => { p.kiSysteme[0]!.sensibleNutzung = true; p.folgenabschaetzungen = [ia({ sensibleNutzung: true, triage: { ...ia().triage, rechtspositionOderChancen: true, ergebnis: 'voll' } })]; } },
  { fall: 'System abgelöst', aendere: (p) => { p.kiSysteme[0]!.status = 'abgeloest'; p.kiSysteme[0]!.sensibleNutzung = false; p.folgenabschaetzungen = [ia({ sensibleNutzung: true, triage: { ...ia().triage, rechtspositionOderChancen: true, ergebnis: 'voll' } })]; } },
  // P14 S2: untersagtes System wird nicht mehr genutzt, das Inventar muss nicht nachgeführt werden
  { fall: 'System untersagt', aendere: (p) => { p.kiSysteme[0]!.status = 'untersagt'; p.kiSysteme[0]!.sensibleNutzung = true; p.folgenabschaetzungen = [ia()]; } },
  { fall: 'massgebend ist die neuere Abschätzung', aendere: (p) => { p.kiSysteme[0]!.sensibleNutzung = false; p.folgenabschaetzungen = [ia({ sensibleNutzung: true, freigabe: { von: 'P-001', am: '2026-01-10' } }), ia({ id: 'IA-002', freigabe: { von: 'P-001', am: '2026-10-05' } })]; } },
];
klasse('A3-02b (F47): Inventar «sensible Nutzung» passt nicht zur Folgenabschätzung', 'F47', f47Positiv, f47Negativ);

// ------------------------------------------------------------------------------------------------- F36

const f36Positiv: Positiv[] = [
  { fall: 'Person «noch nicht zugewiesen», D-04 freigegeben', aendere: (p) => { p.personen[0]!.funktion = 'noch nicht zugewiesen'; p.dokumente.push(dok('D-04', '2026-10-10')); }, id: 'D-04', schwere: 'fehler' },
  { fall: 'Zweck eines KI-Systems «TBD», D-10 freigegeben', aendere: (p) => { p.kiSysteme[0]!.zweck = 'TBD'; p.dokumente.push(dok('D-10', '2026-10-10')); }, id: 'D-10', schwere: 'fehler' },
  { fall: 'Zweck eines KI-Systems «TBD», D-10 nicht im Register', aendere: (p) => { p.kiSysteme[0]!.zweck = 'TBD'; }, id: 'D-10', schwere: 'hinweis' },
  { fall: 'Massnahme mit «TT.MM.JJJJ», D-07 freigegeben', aendere: (p) => { p.massnahmen.push({ id: 'M-001', titel: 'Schulung bis TT.MM.JJJJ', beschreibung: '', verantwortlich: 'P-001', termin: '2027-03-31', status: 'offen', prioritaet: 'mittel', herkunft: { art: 'risiko' } }); }, id: 'D-07', schwere: 'fehler' },
  { fall: 'Umsetzung eines Controls «Text ergänzen»', aendere: (p) => { control(p).umsetzung = 'Text ergänzen'; }, id: 'D-11', schwere: 'hinweis' },
  { fall: 'Grundsatz der Leitlinie mit TODO', aendere: (p) => { p.organisation.leitlinie.grundsaetze.push('TODO Grundsatz zur Transparenz'); }, id: 'D-03', schwere: 'hinweis' },
  { fall: 'Anforderung einer Partei englisch «not yet assigned»', aendere: (p) => { p.parteien.push({ id: 'IP-001', name: 'Customers', art: 'extern', anforderungen: [{ text: 'Owner not yet assigned', quelle: 'vertrag', adressiert: 'ja' }] }); }, id: 'D-01', schwere: 'hinweis' },
];
const f36Negativ: Negativ[] = [
  { fall: 'Wort «Todos» ist kein Platzhalter', aendere: (p) => { p.personen[0]!.funktion = 'CIO, koordiniert die Todos der Geschäftsleitung'; p.dokumente.push(dok('D-04', '2026-10-10')); } },
  { fall: 'Wort «XXL» ist kein Platzhalter', aendere: (p) => { p.kiSysteme[0]!.zweck = 'Texte für Plakate im Format XXL'; p.dokumente.push(dok('D-10', '2026-10-10')); } },
];
klasse('F36: Dokument «freigegeben» mit offenem Platzhalter', 'F36', f36Positiv, f36Negativ);

// ------------------------------------------------------------------------------------------------- Abdeckung (AF-080)

describe('AF-080: Abdeckung der Befundklassen', () => {
  const tabelle: [klasse: string, regel: string, positiv: number][] = [
    ['A3-01', 'F37', f37Positiv.length],
    ['A3-03', 'F42', f42Positiv.length],
    ['A3-04', 'F34', f34Positiv.length],
    ['A3-07', 'F39', f39Positiv.length],
    ['A3-07', 'F41', f41Positiv.length],
    ['A3-10', 'F40', f40Positiv.length],
    ['A3-15', 'F43', f43Positiv.length],
    ['A3-22', 'F38', f38Positiv.length],
    ['A3-02b', 'F44', f44Positiv.length],
    ['A3-02b', 'F45', f45Positiv.length],
    ['A3-02b', 'F46', f46Positiv.length],
    ['A3-02b', 'F47', f47Positiv.length],
    ['neu', 'F35', f35Positiv.length],
    ['neu', 'F36', f36Positiv.length],
  ];
  it('Klassen mit mindestens 2 Abwandlungen: 100 %', () => {
    const erfuellt = tabelle.filter(([, , n]) => n >= 2).length;
    expect(Math.round((erfuellt / tabelle.length) * 100)).toBe(100);
    // 7 von 7 maschinell prüfbaren A3-Befunden mit Regel (AF-079, mit A3-02b aus P14, AF-095)
    for (const k of ['A3-01', 'A3-02b', 'A3-03', 'A3-04', 'A3-07', 'A3-10', 'A3-15']) expect(tabelle.some(([x]) => x === k)).toBe(true);
  });
});
