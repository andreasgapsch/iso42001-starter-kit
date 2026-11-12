import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { PRUEFUNGEN, pruefeProjekt, type Regel } from '../../src/regeln/pruefungen.ts';
import { CONTROLS_42001, kiSystem, vollstaendigesProjekt } from '../fixtures/projekt.ts';
import type { Projekt } from '../../src/model/typen.ts';
import { pngDataUrl, pngKodieren } from '../../src/generator/png.ts';
import { ladeKataloge } from '../../src/kataloge/laden-node.ts';
import type { GenaiRisiko, Kataloge, NistKern, RmfControl } from '../../src/kataloge/typen.ts';
import { BEREITSCHAFT_REGELN, bereitschaftBerechnen } from '../../src/app/logik/bereitschaft.ts';
import type { Umfeld } from '../../src/app/logik/gefuehrt.ts';
import type { GefuehrtDaten } from '../../src/app/logik/gefuehrt-typen.ts';
import type { EuaiaControl } from '../../src/app/logik/vorschlaege.ts';

const kataloge = ladeKataloge();
const nistKern = kataloge.nistrmf_subkategorien as NistKern;
const rmfControls = (kataloge.nistrmf_rmfControls as { controls: RmfControl[] }).controls;
const genaiRisiken = (kataloge.nistrmf_genaiRisiken as { risiken: GenaiRisiko[] }).risiken;

/**
 * Modul NIST AI RMF eingeschaltet und vollständig: Entscheid zu allen Zusatz-Controls der Lücken, Notiz zu den
 * Präzisierungen, ein Ziel im Profil (nicht über dem Ist), Messkonzept mit Prüfung für KI-001.
 */
function mitNist(p: Projekt): Projekt {
  p.meta.modulNistRmf = true;
  for (const c of rmfControls) p.controls.push({ id: c.id, rahmenwerk: 'NISTRMF', anwendbar: 'ja', begruendung: 'Lücke des AIMS', status: 'umgesetzt', nachweise: ['N-001'], umsetzung: 'gemäss N-03', iso27001: [], kiSysteme: [], wirksamkeit: { wie: `Stichprobe zu ${c.id}`, wann: '2026-10-15', wer: 'P-001' } });
  p.nistProfil = Object.fromEntries(nistKern.subkategorien.filter((s) => s.praezisierung).map((s) => [s.id, { notiz: 'in D-09 umgesetzt' }]));
  p.nistProfil['GV-1.1'] = { ziel: 0 };
  p.kiSysteme[0]!.messkonzept = { merkmale: ['gueltig'], pruefungen: [{ merkmal: 'gueltig', prueffaelle: '20 Anfragen', messgroesse: 'Anteil brauchbar', schwelle: '80 %', haeufigkeit: 'quartalsweise' }] };
  return p;
}
const genaiAlle = (relevant: 'ja' | 'nein') => Object.fromEntries(genaiRisiken.map((r) => [r.id, { relevant, begruendung: 'x', massnahme: 'M-001' }]));

const regeln = (parse(readFileSync('src/regeln/pruefregeln.yaml', 'utf8')) as { regeln: Regel[] }).regeln;
const texteDe = parse(readFileSync('src/i18n/de/regeln.yaml', 'utf8')) as Record<string, { titel: string; erklaerung: string }>;
const pruefe = (p: Projekt, heute = '2026-10-20') => pruefeProjekt(regeln, { projekt: p, heute, controlIds42001: CONTROLS_42001, aiActStand: '2026-07-27', kataloge });
const ids = (p: Projekt, heute?: string) => pruefe(p, heute).map((b) => b.regel);

// Je Regel eine Veränderung des vollständigen Projekts, die genau diese Regel auslösen muss.
const faelle: Record<string, (p: Projekt) => void> = {
  F01: (p) => { p.kiSysteme[0]!.eigner = undefined; },
  F02: (p) => { p.risiken = []; },
  F03: (p) => { p.kiSysteme[0]!.sensibleNutzung = true; },
  F04: (p) => { p.folgenabschaetzungen.push({ id: 'IA-001', kiSystem: 'KI-001', triage: { rechtspositionOderChancen: false, gesundheitOderSicherheit: false, verletzlicheGruppen: false, besondereDaten: false, automatisierteEntscheidung: false, grosseReichweite: false, ergebnis: 'kurz', begruendung: '' }, systembeschreibung: '', verwendungen: '', fehlanwendungen: '', daten: '', einsatzumfeld: '', betroffene: [], nutzenSchaden: {}, ausfaelle: '', massnahmen: '', sensibleNutzung: false, eingeschraenkteNutzung: false, ergebnis: '' }); },
  F05: (p) => { p.controls = p.controls.filter((c) => c.id !== 'A.7.6'); },
  F06: (p) => { p.controls[0]!.begruendung = ''; },
  F07: (p) => { p.controls[0]!.status = 'offen'; },
  F08: (p) => { p.risiken[0]!.w = 4; p.risiken[0]!.a = 4; p.risiken[0]!.behandlung = undefined; p.risiken[0]!.restrisikoAkzeptiert = undefined; },
  F09: (p) => { p.risiken[0]!.restrisikoAkzeptiert = undefined; },
  F10: (p) => { p.dokumente[0]!.freigabe = undefined; },
  F11: (p) => { p.organisation.geltungsbereich.freigabe = undefined; },
  F12: (p) => { p.organisation.leitlinie.grundsaetze = []; },
  F13: (p) => { p.ziele[0]!.termin = undefined; },
  F14: (p) => { p.rollen.pop(); },
  F15: (p) => { p.audits = []; },
  F16: (p) => { p.managementbewertungen = []; },
  F17: (p) => { p.feststellungen.push({ id: 'F-001', quelle: 'audit', einstufung: 'nk-leicht', beschreibung: 'x', normbezug: '7.2', korrektur: '', ursache: '', massnahmen: [], status: 'offen' }); },
  F18: (p) => { p.massnahmen.push({ id: 'M-001', titel: 'x', beschreibung: '', status: 'offen', prioritaet: 'mittel', herkunft: { art: 'sonstige' } }); },
  F19: (p) => { p.organisation.risikokriterien.zeitraum = ''; },
  F20: (p) => { p.parteien.push({ id: 'IP-001', name: 'Kunden', art: 'extern', anforderungen: [{ text: 'x', quelle: 'vertrag', adressiert: 'offen' }] }); },
  F21: (p) => { p.risiken[0]!.controls = []; },
  F22: (p) => { p.kiSysteme[0]!.aiAct.rollen = []; },
  F23: (p) => { p.kiSysteme[0]!.aiAct.risikoklasse = 'offen'; },
  F24: (p) => { p.kiSysteme[0]!.aiAct.risikoklasse = 'verboten'; },
  F25: (p) => { p.controls.push({ id: 'EUAIA-02', rahmenwerk: 'EUAIA', anwendbar: 'offen', begruendung: '', status: 'offen', nachweise: [], umsetzung: '', iso27001: [], kiSysteme: [] }); },
  H01: (p) => { p.dokumente[0]!.naechsteUeberpruefung = '2026-01-01'; },
  H02: (p) => { p.kiSysteme.push(kiSystem({ id: 'KI-002', name: 'Gratis-Chatbot', typ: 'schatten', status: 'in-pruefung', erfasstAm: '2026-08-01' })); p.risiken.push({ ...p.risiken[0]!, id: 'R-002', kiSystem: 'KI-002' }); },
  H03: (p) => { p.meta.mitIsms = true; },
  H04: (p) => { p.risiken[0]!.w = 4; p.risiken[0]!.a = 4; p.controls.find((c) => c.id === 'A.9.2')!.anwendbar = 'nein'; },
  H05: (p) => { p.kompetenzen.push({ id: 'K-001', rolle: 'Aufsicht', anforderung: '', personen: [], massnahme: '', nachweis: '', wirksamkeit: '', status: 'offen' }); },
  H06: (p) => { p.kommunikation[0]!.richtung = 'intern'; },
  H07: (p) => { p.folgenabschaetzungen.push({ ...leereIa(), freigabe: { von: 'P-001', am: '2026-09-01' } }); p.kiSysteme[0]!.geaendertAm = '2026-10-01'; },
  H08: (p) => { p.kiSysteme[0]!.typ = 'eigenbau'; p.controls.find((c) => c.id === 'A.6.2.3')!.status = 'geplant'; },
  H09: (p) => { p.controls.find((c) => c.id === 'A.6.2.8')!.status = 'geplant'; },
  H10: (p) => { p.controls.find((c) => c.id === 'A.8.3')!.status = 'geplant'; },
  H11: (p) => { p.audits[0]!.unabhaengigkeit = ''; },
  H12: (p) => { const c = p.controls.find((x) => x.id === 'A.6.1.3')!; c.anwendbar = 'nein'; c.begruendung = 'bereits im ISMS vorhanden'; },
  H13: (p) => { p.organisation.leitlinie.grundsaetze.push('Wir nutzen nur ChatGPT Team.'); },
  H14: (p) => { Object.assign(p.kiSysteme[0]!.aiAct, { risikoklasse: 'hochrisiko-anhang-iii', anhangIiiBereich: '4a' }); },
  H15: () => {},
  H16: (p) => { Object.assign(p.kiSysteme[0]!.aiAct, { rollen: ['anbieter'], risikoklasse: 'hochrisiko-anhang-i' }); },
  F26: (p) => { const ia = leereIa(); ia.triage.gesundheitOderSicherheit = true; p.folgenabschaetzungen.push({ ...ia, id: 'IA-009', freigabe: { von: 'P-001', am: '2026-09-01' } }); },
  H17: (p) => { const ia = leereIa(); ia.triage.besondereDaten = true; p.folgenabschaetzungen.push({ ...ia, id: 'IA-009', freigabe: { von: 'P-001', am: '2026-09-01' } }); },
  H18: (p) => { const ia = leereIa(); p.folgenabschaetzungen.push({ ...ia, id: 'IA-009', triage: { ...ia.triage, begruendung: 'x', durch: 'P-001' }, freigabe: { von: 'P-001', am: '2026-09-01' } }); },
  H19: (p) => { p.kiSysteme[0]!.freigabe = { von: 'P-001', am: '2026-09-01' }; p.folgenabschaetzungen.push({ ...leereIa(), freigabe: { von: 'P-001', am: '2026-09-15' } }); },
  H20: (p) => { p.risiken[0]!.restrisikoAkzeptiert = { von: 'P-001', am: '2026-10-12' }; },
  H21: (p) => { p.dokumente.push({ id: 'D-11', version: '1.0', status: 'freigegeben', freigabe: { von: 'P-001', am: '2026-10-05' }, ablageort: 'SharePoint', giltFuerIsms: false }); },
  H22: (p) => { p.dokumente.push({ id: 'D-08', version: '1.0', status: 'freigegeben', freigabe: { von: 'P-001', am: '2026-09-10' }, ablageort: 'SharePoint', giltFuerIsms: false }); p.folgenabschaetzungen.push({ ...leereIa(), freigabe: { von: 'P-001', am: '2026-09-01' } }); },
  H23: (p) => { p.meta.checklisten['E5-c1'] = { erledigt: true, datum: '2026-10-15' }; },
  H24: (p) => { p.massnahmen.push({ id: 'M-099', titel: 'x', beschreibung: '', status: 'in-arbeit', prioritaet: 'mittel', herkunft: { art: 'risiko' } }); p.controls[0]!.status = 'umgesetzt'; p.controls[0]!.umsetzung = 'Umsetzung mit M-099'; },
  H25: (p) => { p.dokumente[0]!.version = '1.1'; },
  H26: (p) => { p.personen.push({ id: 'P-099', name: 'Audit', funktion: 'Interne Auditorin', aimsRollen: ['auditor'] }); p.organisation.projektauftrag = { ...p.organisation.projektauftrag, team: ['P-099'] }; },
  H27: (p) => { p.dokumente[0]!.eigner = p.dokumente[0]!.freigabe!.von; },
  // ab rc.2
  H28: (p) => { Object.assign(p.kiSysteme[0]!, { handlungsbefugnis: 'fuehrt-begrenzt-aus', protokollierung: 'Plattformprotokoll 6 Monate', aufsicht: 'Eignerin' }); },
  H29: (p) => { p.kiSysteme[0]!.kritisch = true; },
  H30: (p) => { Object.assign(p.kiSysteme[0]!, { lebenszyklus: 'ausserbetrieb', aufbewahrenBis: '2036-12-31', ausserbetrieb: { ausloeser: 'Ende der Laufzeit', schritteErledigt: false } }); },
  H31: (p) => { p.kiSysteme[0]!.einsatzentscheid = { nutzen: 'Zeitersparnis' }; },
  H32: (p) => { Object.assign(p.kiSysteme[0]!, { generativ: true, fremdeInhalte: true }); },
  H33: (p) => { p.kiSysteme[0]!.modell = { anbieter: 'Anbieter', name: 'Modell' }; },
  H34: (p) => { p.kiSysteme[0]!.sensibleNutzung = true; p.folgenabschaetzungen.push({ ...leereIa(), triage: { ...leereIa().triage, ergebnis: 'voll' }, betroffene: [{ gruppe: 'Kunden', art: 'direkt', wirkung: '', konsultiert: false }], nutzenSchaden: { fairness: { nutzen: '', schaden: '' } }, freigabe: { von: 'P-001', am: '2026-09-01' } }); },
  H35: (p) => { p.controls[3]!.wirksamkeit = undefined; },
  // Modul NIST AI RMF (ab rc.2): vom vollständigen Projekt mit Modul aus
  F27: (p) => { mitNist(p); p.controls = p.controls.filter((c) => c.id !== 'RMF-09'); },
  F28: (p) => { mitNist(p); p.kiSysteme[0]!.generativ = true; },
  F29: (p) => { mitNist(p); p.kiSysteme[0]!.messkonzept = undefined; },
  F33: (p) => { p.risiken[0]!.kiSystem = 'KI-999'; },
  H36: (p) => { mitNist(p); },
  H37: (p) => { mitNist(p); p.nistProfil!['GV-1.1'] = { ziel: 3 }; },
  H38: (p) => { mitNist(p); delete p.nistProfil!['GV-1.1']; },
  H39: (p) => { mitNist(p); p.kiSysteme[0]!.generativ = true; p.kiSysteme[0]!.genaiBewertung = { ...genaiAlle('nein'), 'gai-konfabulation': { relevant: 'ja', begruendung: 'Offerten' } }; },
  H40: (p) => { mitNist(p); p.kiSysteme[0]!.typ = 'eigenbau'; },
  H41: (p) => { mitNist(p); Object.assign(p.kiSysteme[0]!, { typ: 'eigenbau', generativ: true, modell: undefined, genaiBewertung: genaiAlle('nein') }); },
  // Stage-1-Runde 4
  H42: (p) => { p.organisation.leitlinie.ausnahmeHoechstMonate = 6; p.risiken[0]!.ausnahme = { von: 'P-001', am: '2026-10-13', bis: '2027-04-30' }; },
  H43: (p) => { p.risiken[0]!.wNach = 2; },
  H44: (p) => { p.kiSysteme[0]!.freigabe = { von: 'P-001', am: '2026-10-12' }; p.risiken[0]!.w = 4; p.risiken[0]!.a = 4; },
  H45: (p) => { p.lieferanten.push({ id: 'L-001', name: 'Anbieter', leistung: 'Copilot', pruefstatus: 'geprueft', pruefpunkte: { 'PF-01': 'ja', 'PF-20': 'offen' }, bemerkung: '' }); },
  H46: (p) => { p.dokumente[0]!.geprueft = { von: 'P-001', am: '2026-10-12' }; },
  H47: (p) => { for (const c of p.controls.slice(0, 6)) c.wirksamkeit = { wie: 'Internes Audit AU-001', wann: '2026-10-15', wer: 'P-001', ergebnis: 'Wirksam, keine Abweichung' }; },
  H48: (p) => { p.audits[0]!.checkliste = { 'A.2.2': { nachweis: 'D-03', ergebnis: 'konform' }, 'A.2.4': { ergebnis: 'nicht-pruefbar' } }; p.controls.find((c) => c.id === 'A.2.4')!.wirksamkeit = { wie: 'Internes Audit AU-001', wann: '2026-10-15', wer: 'P-001', ergebnis: 'wirksam' }; },
  // Nachtraining nach der letzten Beurteilung des Risikos (wie H07 für Folgenabschätzungen)
  H49: (p) => { p.kiSysteme[0]!.geaendertAm = '2026-12-01'; p.risiken[0]!.beurteiltAm = '2026-10-01'; },
  // ab rc.3
  F30: (p) => { Object.assign(p.kiSysteme[0]!, { tarif: 'privat', datenklasse: 'vertraulich' }); },
  H50: (p) => { Object.assign(p.kiSysteme[0]!, { fremdeInhalte: true, datenklasse: 'vertraulich', handlungsbefugnis: 'handelt-mehrstufig', stoppmoeglichkeit: 'Konsole', protokollierung: 'Plattform', aufsicht: 'Eignerin' }); },
  H51: (p) => { Object.assign(p.kiSysteme[0]!, { handlungsbefugnis: 'fuehrt-begrenzt-aus', stoppmoeglichkeit: 'Konsole', protokollierung: 'Plattform', aufsicht: 'Eignerin' }); p.risiken[0]!.a = 1; p.risiken[0]!.aNach = 1; },
  H52: (p) => { p.risiken[0]!.beschreibung = 'Versteckte Anweisungen (OWASP LLM01)'; },
  H53: (p) => { p.kiSysteme[0]!.abkuendigung = '2026-12-31'; },
  H54: (p) => { const r = p.risiken.find((x) => x.art === 'risiko')!; r.w = 1; r.a = 1; r.behandlung = undefined as never; },
  // Prozesse (nur mit Projekt.prozesse)
  F31: (p) => { p.prozesse = []; },
  F32: (p) => { p.prozesse = [{ id: 'PR-01', anwendbar: 'nein' }]; },
  H55: (p) => { p.prozesse = [{ id: 'PR-12', letzteDurchfuehrung: '2026-01-15', rhythmus: 'quartalsweise' }]; },
  H56: (p) => { p.prozesse = [{ id: 'PR-12', reife: 2 }]; },
  H57: (p) => { p.prozesse = [{ id: 'PR-12', reife: 3, letzteDurchfuehrung: '2026-10-01' }]; },
  H58: (p) => { p.audits = []; p.prozesse = [{ id: 'PR-12', reife: 4, letzteDurchfuehrung: '2026-10-01', kennzahl: 'Z-001' }]; },
  H59: (p) => { p.prozesse = [{ id: 'PR-12' }]; p.massnahmen.push({ id: 'M-009', titel: 'Stichproben einführen', beschreibung: '', verantwortlich: 'P-001', termin: '2026-09-30', status: 'offen', prioritaet: 'mittel', herkunft: { art: 'prozess', ref: 'PR-12' } }); },
  H60: (p) => { p.prozesse = [{ id: 'PR-14', reife: 2, letzteDurchfuehrung: '2026-09-01' }]; },
  H61: (p) => { p.prozesse = [{ id: 'PR-12', drawio: { roh: '<diagram id="PR-12"/>', hash: 'x', importiertAm: '2026-10-01T08:00:00Z', offen: { bahnen: ['Unbekannte Rolle'], formen: [] } } }]; },
  H62: (p) => { p.meta.mitIsms = true; p.prozesse = []; },
  // ab rc.9: Audit grenzt den Umfang auf PR-25 ein, die übrigen Pflichtprozesse sind im Zyklus nie im Umfang
  H63: (p) => { p.prozesse = []; p.audits[0]!.umfangProzesse = ['PR-25']; },
  H64: (p) => { p.organisation.gestaltung = { logo: { png: weissesLogo(), breite: 40, hoehe: 20, quelle: { dateiname: 'logo-weiss.png', format: 'png', sha256: '0'.repeat(64) } } }; },
  H65: (p) => { p.organisation.gestaltung = { farben: { primaer: 'FFD700' } }; },
  // Stage-1-Runde 6
  H66: (p) => { p.dokumente[0]!.geprueft = undefined; },
  H67: (p) => { p.prozesse = [{ id: 'PR-12', letzteDurchfuehrung: '2026-01-15', rhythmus: 'quartalsweise' }]; },
  H68: (p) => {
    p.personen.push({ id: 'P-002', name: 'Bea Beispiel', funktion: 'Leiterin Verkauf', aimsRollen: ['fachbereich'] });
    p.rollen.push({ id: 'RO-003', bereich: 'risikomanagement', verantwortlich: 'P-001', konsultiert: [], informiert: [] });
    p.prozesse = [{ id: 'PR-08', eigner: 'P-002' }];
  },
  H69: (p) => {
    p.risiken[0]!.ebenen = ['organisation', 'individuen'];
    p.risiken[0]!.a = 1;
    p.folgenabschaetzungen.push({ ...leereIa(), freigabe: { von: 'P-001', am: '2026-09-01' } });
  },
  H70: (p) => { p.prozesse = []; p.dokumente.push({ id: 'D-27', version: '1.0', status: 'freigegeben', freigabe: { von: 'P-001', am: '2026-10-12' }, geprueft: { von: 'P-001', am: '2026-10-12' }, ablageort: 'SharePoint', giltFuerIsms: false }); },
  H71: (p) => { p.prozesse = [{ id: 'PR-12', extern: { name: 'IT-Partner' } }]; },
  H72: (p) => { p.prozesse = []; p.eigeneProzesse = [{ id: 'PE-01', titel: 'Kundenanfragen', gruppe: 'kern', art: 'nur-aims' }]; },
  H73: (p) => { p.prozesse = []; p.rollen.push({ id: 'RO-003', bereich: 'folgenabschaetzung', verantwortlich: 'P-001', konsultiert: [], informiert: [] }); },
  H74: (p) => { p.prozesse = [{ id: 'PR-08', kennzahl: 'Z-001' }]; p.ziele[0]!.messungen = [{ datum: '2026-10-01', wert: '98 %' }]; },
  H75: (p) => { p.prozesse = [{ id: 'PS-02' }]; },
  // Bibliothek (ab rc.10)
  H76: (p) => { p.bibliothek = { eintraege: [{ id: 'X-001', art: 'eigene', titel: 'Vertrag', versionen: [], naechstePruefung: '2026-01-01' }] }; },
  H77: (p) => { p.bibliothek = { eintraege: [{ id: 'X-001', art: 'eigene', titel: 'Richtlinie', versionen: [{ version: '1.0', datei: 'Eigene/X-001_Richtlinie/v1.0.pdf', groesse: 1, pruefsumme: 'a'.repeat(64), datum: '2026-10-01T08:00:00Z', status: 'freigegeben' }] }] }; },
  H78: (p) => { p.bibliothek = { eintraege: [], abgleich: { am: '2026-10-19T08:00:00Z', geaendert: ['D-07'] } }; },
  H79: (p) => { p.bibliothek = { eintraege: [], abgleich: { am: '2026-10-19T08:00:00Z', fehlend: ['N-001'] } }; },
  H81: (p) => { const ia = leereIa(); ia.triage.rechtspositionOderChancen = true; p.folgenabschaetzungen.push({ ...ia, id: 'IA-009', triage: { ...ia.triage, ergebnis: 'voll' }, sensibleNutzung: false }); },
  H83: (p) => { p.massnahmen.push({ id: 'M-001', titel: 'x', beschreibung: '', verantwortlich: 'P-001', termin: '2026-10-01', status: 'erledigt', prioritaet: 'mittel', herkunft: { art: 'sonstige' }, erledigtAm: '2026-10-01' }); },
  // Runde 2b (AF-076, AF-077, AF-079): F35 ersetzt H90 mit demselben Fall; Gegenbeispiele (Negativfälle) je Regel in tests/unit/regeln-klassen.test.ts
  F35: (p) => { p.prozesse = [{ id: 'PR-06', reife: 2, reifeAm: '2020-01-01' }]; },
  F34: (p) => {
    p.controls[0]!.status = 'wirksam';
    p.feststellungen.push({ id: 'F-001', quelle: 'audit', einstufung: 'nk-leicht', beschreibung: 'x', normbezug: p.controls[0]!.id, korrektur: 'k', ursache: 'u', massnahmen: [], status: 'offen' });
  },
  F36: (p) => { p.kiSysteme[0]!.zweck = 'TBD'; },
  F37: (p) => { p.prozesse = [{ id: 'PR-21', anwendbar: 'ja' }]; },
  F38: (p) => { p.kiSysteme[0]!.aiAct.juristischGeprueft = true; },
  F39: (p) => { p.nachweise.push({ id: 'N-002', titel: 'Protokoll', art: 'aufzeichnung', ablageort: 'x', datum: '2026-10-19' }); p.managementbewertungen[0]!.entscheide = 'gemäss N-002'; },
  F40: (p) => { p.controls[0]!.wirksamkeit = { wie: 'Übung nach D-12', wann: '2026-10-15', wer: 'P-001' }; p.dokumente.push({ ...p.dokumente[0]!, id: 'D-12', freigabe: { von: 'P-001', am: '2026-10-19' } }); },
  F41: (p) => { p.dokumente.push({ ...p.dokumente[0]!, id: 'E-09' }); },
  F42: (p) => {
    p.kiSysteme.push(kiSystem({ id: 'KI-002', name: 'Offertassistent' }));
    p.ziele[0]!.kiSysteme = ['KI-001', 'KI-002'];
    p.ziele[0]!.messmethode = 'Stichprobe von 10 Texten aus Copilot, ab 2027 zusätzlich 10 Texte aus dem Offertassistent';
    p.ziele[0]!.messungen = [{ datum: '2026-10-01', wert: '100 %' }];
    p.kennzahlMessungen = [{ kennzahl: 'PR-12', datum: '2026-10-15', wert: '2 von 2 (100 %)', sollErreicht: 'ja' }];
  },
  F43: (p) => { p.kennzahlMessungen = [{ kennzahl: 'PR-07', datum: '2026-10-15', wert: '5 Tage', sollErreicht: 'ja' }]; },
  // Runde 3a (P14, AF-095): Folgenabschätzung tragfähig; Gegenbeispiele in tests/unit/regeln-klassen.test.ts
  F44: (p) => {
    const gleich = { nutzen: 'Zeitersparnis bei Entwürfen', schaden: 'Kein besonderer Schaden erkennbar' };
    p.folgenabschaetzungen.push({ ...leereIa(), nutzenSchaden: { rechenschaft: gleich, fairness: gleich, umwelt: gleich } });
  },
  F45: (p) => { p.folgenabschaetzungen.push({ ...leereIa(), nutzenSchaden: { sicherheit: { nutzen: 'Prüfung', schaden: 'Datenabfluss (R-001)', ausmass: 1 } } }); },
  F46: (p) => { const ia = leereIa(); p.folgenabschaetzungen.push({ ...ia, triage: { ...ia.triage, gesundheitOderSicherheit: true } }); },
  F47: (p) => { p.folgenabschaetzungen.push({ ...leereIa(), sensibleNutzung: true }); },
  H91: (p) => { p.organisation.kontext.themen = [{ id: 'TH-001', art: 'extern', text: 'x' } as never]; },
  H84: (p) => { p.prozesse = [{ id: 'PR-06', reife: 2, letzteDurchfuehrung: '2026-10-01' }]; },
  H85: (p) => { p.massnahmen.push({ id: 'M-001', titel: 'x', beschreibung: '', verantwortlich: 'P-001', termin: '2027-01-01', status: 'offen', prioritaet: 'mittel', herkunft: { art: 'risiko' } }); p.risiken[0]!.massnahmen = ['M-001']; p.risiken[0]!.status = 'akzeptiert'; },
  H86: (p) => {
    p.massnahmen.push({ id: 'M-001', titel: 'x', beschreibung: '', verantwortlich: 'P-001', termin: '2026-10-05', status: 'erledigt', prioritaet: 'mittel', herkunft: { art: 'audit' }, erledigtAm: '2026-10-05', nachweise: ['N-001'] });
    p.feststellungen.push({ id: 'F-001', quelle: 'audit', einstufung: 'nk-leicht', beschreibung: 'x', normbezug: '7.2', korrektur: 'k', ursache: 'u', massnahmen: ['M-001'], status: 'geschlossen', wirksamkeit: { am: '2026-10-01', ergebnis: 'ok' } });
  },
  H88: (p) => {
    // Eigner/in gibt die eigene Leitlinie frei, ohne Funktion in der Leitung (C2-05)
    p.personen[0]!.funktion = 'IT-Leitung';
    p.organisation.leitlinie.freigabe = { von: 'P-001', am: '2026-10-01' };
  },
  H89: (p) => {
    p.organisation.leitlinie.freigabe = { von: 'P-001', am: '2099-12-15' };
  },
  H87: (p) => {
    p.nachweise.push({ id: 'N-099', titel: 'x', art: 'dokument', ablageort: 'x', datum: '2026-09-01' });
    p.bibliothek = { eintraege: [{ id: 'N-099', art: 'nachweis', versionen: [{ version: '1', datei: 'x', groesse: 1, pruefsumme: 'a'.repeat(64), datum: '2026-09-01T08:00:00Z' }], verknuepfungen: { controls: [p.controls[0]!.id] } }] };
  },
  H82: (p) => {
    const k = p.organisation.risikokriterien;
    k.wahrscheinlichkeit = [{ stufe: 1, bezeichnung: 'a', beschreibung: '' }, { stufe: 2, bezeichnung: 'b', beschreibung: '' }, { stufe: 3, bezeichnung: 'c', beschreibung: '' }];
    k.auswirkung = [...k.wahrscheinlichkeit];
    k.akzeptanzBis = 4;
    k.unannehmbarAb = 12;
  },
  H80: (p) => { p.bibliothek = { ablage: 'browser', eintraege: [{ id: 'X-001', art: 'eigene', titel: 'Foto', versionen: [{ version: '0.1', datei: 'Eigene/X-001_Foto/v0.1.jpg', groesse: 1, pruefsumme: 'a'.repeat(64), datum: '2026-09-01T08:00:00Z' }] }] }; },
};

/** Weisses Logo auf Transparenz (für dunklen Grund): linke Hälfte deckend weiss, rechte Hälfte durchsichtig */
function weissesLogo(): string {
  const daten = new Uint8Array(40 * 20 * 4);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) daten.set([255, 255, 255, 255], (y * 40 + x) * 4);
  return pngDataUrl(pngKodieren({ breite: 40, hoehe: 20, daten }));
}
function leereIa() {
  return { id: 'IA-001', kiSystem: 'KI-001', triage: { rechtspositionOderChancen: false, gesundheitOderSicherheit: false, verletzlicheGruppen: false, besondereDaten: false, automatisierteEntscheidung: false, grosseReichweite: false, ergebnis: 'kurz' as const, begruendung: '' }, systembeschreibung: '', verwendungen: '', fehlanwendungen: '', daten: '', einsatzumfeld: '', betroffene: [], nutzenSchaden: {}, ausfaelle: '', massnahmen: '', sensibleNutzung: false, eingeschraenkteNutzung: false, ergebnis: '' };
}

describe('Prüfregeln', () => {
  it('vollständiges Projekt löst keine Regel aus', () => {
    expect(ids(vollstaendigesProjekt())).toEqual([]);
  });
  it('jede Regel hat Prüffunktion, Testfall und Texte', () => {
    for (const r of regeln) {
      expect(PRUEFUNGEN[r.id], r.id).toBeTypeOf('function');
      expect(faelle[r.id], r.id).toBeTypeOf('function');
      expect(texteDe[r.id]?.titel, r.id).toBeTruthy();
      expect(texteDe[r.id]?.erklaerung, r.id).toBeTruthy();
    }
  });
  it.each(regeln.map((r) => r.id))('%s wird ausgelöst', (id) => {
    const p = vollstaendigesProjekt();
    faelle[id]!(p);
    expect(ids(p, id === 'H15' || id === 'H36' ? '2027-06-01' : undefined)).toContain(id);
  });
  it('Modulregeln laufen nur mit Modul', () => {
    const p = vollstaendigesProjekt();
    p.meta.modulAiAct = false;
    p.kiSysteme[0]!.aiAct.risikoklasse = 'offen';
    expect(ids(p)).not.toContain('F23');
  });
  it('Modul NIST AI RMF: vollständiges Projekt mit Modul löst keine Regel aus; ohne Schalter laufen die Regeln nicht', () => {
    const p = mitNist(vollstaendigesProjekt());
    expect(ids(p)).toEqual([]);
    p.kiSysteme[0]!.messkonzept = undefined;
    p.controls = p.controls.filter((c) => c.rahmenwerk !== 'NISTRMF');
    expect(ids(p)).toEqual(expect.arrayContaining(['F27', 'F29']));
    p.meta.modulNistRmf = false;
    expect(ids(p).filter((r) => ['F27', 'F28', 'F29', 'H36', 'H37', 'H38', 'H39', 'H40', 'H41'].includes(r))).toEqual([]);
  });
  it('F27 fasst je Zusatz-Control die Subkategorien zusammen und meldet Präzisierungen ohne Notiz', () => {
    const p = mitNist(vollstaendigesProjekt());
    p.controls = p.controls.filter((c) => c.id !== 'RMF-09' && c.id !== 'RMF-10');
    delete p.nistProfil!['MS-2.12'];
    const b = pruefe(p).filter((x) => x.regel === 'F27').map((x) => `${x.name} ${x.ziel}`);
    expect(b).toEqual(['MS-2.12 nistrmf/MS-2.12', 'RMF-09 (MP-2.3, MS-2.2, MS-4.1) soa/RMF-09', 'RMF-10 (MS-1.3, MS-4.2) soa/RMF-10']);
  });
  it('F28 und H39: generatives System; F29 entfällt bei begründetem Ausschluss von RMF-09; H40 nur mit Vorschlag RMF-10', () => {
    const p = mitNist(vollstaendigesProjekt());
    p.kiSysteme[0]!.generativ = true;
    p.kiSysteme[0]!.genaiBewertung = genaiAlle('ja');
    expect(ids(p).filter((r) => r === 'F28' || r === 'H39')).toEqual([]);
    p.kiSysteme[0]!.genaiBewertung['gai-umwelt'] = { relevant: 'offen' };
    expect(ids(p)).toContain('F28');
    p.kiSysteme[0]!.messkonzept = undefined;
    const c = p.controls.find((x) => x.id === 'RMF-09')!;
    Object.assign(c, { anwendbar: 'nein', begruendung: 'nur Bürounterstützung' });
    expect(ids(p)).not.toContain('F29');
    expect(ids(p)).not.toContain('H40');
  });
  it('H12 prüft ganze Wörter: «bereitstellen» ist keine Begründung «bereits vorhanden»', () => {
    const mit = (text: string) => {
      const p = vollstaendigesProjekt();
      const c = p.controls.find((x) => x.id === 'A.6.1.3')!;
      c.anwendbar = 'nein';
      c.begruendung = text;
      return ids(p).includes('H12');
    };
    expect(mit('Der Lieferant muss die Protokolle bereitstellen.')).toBe(false);
    expect(mit('Wird durch den Anbieter bereitgestellt, keine eigene Entwicklung.')).toBe(false);
    expect(mit('Bereits im ISMS umgesetzt.')).toBe(true);
    expect(mit('Die vorhandenen Regeln des ISMS genügen.')).toBe(true);
    expect(mit('Already covered by the ISMS.')).toBe(true);
  });
  it('F10 akzeptiert im Pfad mit ISMS die Freigabe von D-07-EB', () => {
    const p = vollstaendigesProjekt();
    p.meta.mitIsms = true;
    p.dokumente = [{ id: 'D-07-EB', version: '1.0', status: 'freigegeben', freigabe: { von: 'P-001', am: '2026-10-10' }, ablageort: 'SharePoint', giltFuerIsms: true }];
    expect(ids(p)).not.toContain('F10');
    p.dokumente[0]!.freigabe = undefined;
    expect(pruefe(p).find((b) => b.regel === 'F10')!.ziel).toBe('dokumente/D-07-EB');
  });
  it('H19 bis H23: gleiche Daten oder richtige Reihenfolge lösen nicht aus', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme[0]!.freigabe = { von: 'P-001', am: '2026-09-15' };
    p.folgenabschaetzungen.push({ ...leereIa(), triage: { ...leereIa().triage, am: '2026-09-05' }, freigabe: { von: 'P-001', am: '2026-09-15' } });
    p.dokumente.push(
      { id: 'D-08', version: '1.0', status: 'freigegeben', freigabe: { von: 'P-001', am: '2026-09-01' }, ablageort: 'SharePoint', giltFuerIsms: false },
      { id: 'D-11', version: '1.0', status: 'freigegeben', freigabe: { von: 'P-001', am: '2026-10-10' }, ablageort: 'SharePoint', giltFuerIsms: false },
    );
    p.meta.checklisten['E5-c1'] = { erledigt: true, datum: '2026-09-05' };
    // Beginn einer Massnahme nach der Freigabe des Plans ist normal und zählt nicht
    p.massnahmen.push({ id: 'M-001', titel: 'x', beschreibung: '', status: 'offen', prioritaet: 'mittel', verantwortlich: 'P-001', termin: '2027-01-31', start: '2026-12-01', herkunft: { art: 'risiko', ref: 'R-001' } });
    expect(ids(p).filter((r) => ['H19', 'H20', 'H21', 'H22', 'H23'].includes(r))).toEqual([]);
  });
  it('H20 und H21: Massnahme aus Audit (Feststellung) oder Managementbewertung nach der Freigabe', () => {
    const mit = (herkunft: { art: 'audit' | 'managementbewertung'; ref: string }) => {
      const p = vollstaendigesProjekt();
      p.dokumente.push({ id: 'D-11', version: '1.0', status: 'freigegeben', freigabe: { von: 'P-001', am: '2026-10-10' }, ablageort: 'SharePoint', giltFuerIsms: false });
      p.feststellungen.push({ id: 'F-001', audit: 'AU-001', quelle: 'audit', einstufung: 'beobachtung', beschreibung: 'x', normbezug: '7.2', korrektur: '', ursache: '', massnahmen: ['M-001'], status: 'offen' });
      p.massnahmen.push({ id: 'M-001', titel: 'x', beschreibung: '', status: 'offen', prioritaet: 'mittel', verantwortlich: 'P-001', termin: '2027-01-31', herkunft });
      return pruefe(p).filter((b) => b.regel === 'H20' || b.regel === 'H21').map((b) => `${b.regel} ${b.name}`);
    };
    // F-001 ohne eigenes Datum: Datum des Audits AU-001 (15.10.2026)
    expect(mit({ art: 'audit', ref: 'F-001' })).toEqual(['H20 D-07 (M-001)', 'H21 D-11 (M-001)']);
    expect(mit({ art: 'audit', ref: 'AU-001' })).toEqual(['H20 D-07 (M-001)', 'H21 D-11 (M-001)']);
    expect(mit({ art: 'managementbewertung', ref: 'MB-001' })).toEqual(['H20 D-07 (M-001)', 'H21 D-11 (M-001)']);
  });
  it('H21 meldet eine Freigabe des Behandlungsplans nach der SoA, H20 im Pfad mit ISMS D-07-EB', () => {
    const p = vollstaendigesProjekt();
    p.meta.mitIsms = true;
    p.dokumente = [
      { id: 'D-07-EB', version: '1.1', status: 'freigegeben', freigabe: { von: 'P-001', am: '2026-10-05' }, ablageort: 'SharePoint', giltFuerIsms: true },
      { id: 'D-11', version: '1.0', status: 'freigegeben', freigabe: { von: 'P-001', am: '2026-10-01' }, ablageort: 'SharePoint', giltFuerIsms: false },
    ];
    const b = pruefe(p).filter((x) => x.regel === 'H20' || x.regel === 'H21');
    expect(b.map((x) => `${x.regel} ${x.name} ${x.ziel}`)).toEqual(['H20 D-07-EB (R-001) dokumente/D-07-EB', 'H21 D-11 (R-001) dokumente/D-11']);
  });
  it('H28 bis H35: Grenzfälle lösen nicht aus', () => {
    const p = vollstaendigesProjekt();
    // Handelnde KI mit allen Angaben, empfehlende KI ohne Angaben
    Object.assign(p.kiSysteme[0]!, { handlungsbefugnis: 'handelt-mehrstufig', stoppmoeglichkeit: 'Agent im Admin-Center sperren', protokollierung: 'Aktionsprotokoll', aufsicht: 'Eignerin' });
    p.kiSysteme.push(kiSystem({ id: 'KI-002', name: 'Prognose', typ: 'eigenbau', handlungsbefugnis: 'empfiehlt', kritisch: true, rueckfallweg: 'Planung von Hand', generativ: true, oeffentlich: false, fremdeInhalte: false, modell: undefined }));
    p.risiken.push({ ...p.risiken[0]!, id: 'R-002', kiSystem: 'KI-002' });
    // Kennzahl über ziele[].kiSysteme
    p.kiSysteme[1]!.sensibleNutzung = true;
    p.ziele[0]!.kiSysteme = ['KI-002'];
    // Schatten-KI ohne Einsatzentscheid und Control «geplant» ohne Wirksamkeit
    p.controls[0]!.status = 'geplant';
    p.controls[0]!.wirksamkeit = undefined;
    expect(ids(p).filter((r) => ['H28', 'H29', 'H30', 'H31', 'H32', 'H33', 'H34', 'H35'].includes(r))).toEqual([]);
  });
  it('H35 fasst alle Controls in einem Treffer zusammen', () => {
    const p = vollstaendigesProjekt();
    for (const c of p.controls) c.wirksamkeit = undefined;
    const b = pruefe(p).filter((x) => x.regel === 'H35');
    expect(b.map((x) => `${x.name} ${x.ziel}`)).toEqual([`${CONTROLS_42001.length} soa/A.2.2`]);
  });
  it('F30, H50, H53: Grenzfälle lösen nicht aus', () => {
    const p = vollstaendigesProjekt();
    // Business-Tarif mit vertraulichen Daten, Gratis mit internen Daten, untersagtes Gratis-System mit vertraulichen Daten
    Object.assign(p.kiSysteme[0]!, { tarif: 'business', datenklasse: 'vertraulich' });
    p.kiSysteme.push(kiSystem({ id: 'KI-002', tarif: 'gratis', datenklasse: 'intern', eigner: 'P-001' }), kiSystem({ id: 'KI-003', tarif: 'gratis', datenklasse: 'vertraulich', status: 'untersagt', eigner: 'P-001' }));
    p.risiken.push({ ...p.risiken[0]!, id: 'R-002', kiSystem: 'KI-002' }, { ...p.risiken[0]!, id: 'R-003', kiSystem: 'KI-003' });
    // fremde Inhalte und vertraulich, aber mit Bestätigung (bereitet vor); Abkündigung in 91 Tagen
    Object.assign(p.kiSysteme[0]!, { fremdeInhalte: true, handlungsbefugnis: 'bereitet-vor', abkuendigung: '2027-01-19' });
    expect(ids(p).filter((r) => ['F30', 'H50', 'H53'].includes(r))).toEqual([]);
    p.kiSysteme[0]!.abkuendigung = '2027-01-18';
    expect(ids(p)).toContain('H53');
  });
  it('H52: Kennungen mit Jahr und Artikel der Verordnung lösen nicht aus; veraltete Kennungen je Fundort', async () => {
    const { veralteteKennung } = await import('../../src/regeln/pruefungen.ts');
    for (const t of ['OWASP LLM01:2026', 'ASI06:2026', 'Art. 26 AI Act', 'Art. 50 AI Act Transparenz', 'Art. 52 AI Act Meldung GPAI', 'Art. 29 OR', 'LLM10: 2026', 'Kennung LLM011']) expect(veralteteKennung(t), t).toBeUndefined();
    for (const t of ['OWASP LLM01', 'LLM05:2025', 'ASI03 ohne Jahr', 'Betreiberpflichten nach Art. 29 AI Act', 'Transparenz nach Art. 52 der KI-Verordnung']) expect(veralteteKennung(t), t).toBeTruthy();
    const p = vollstaendigesProjekt();
    p.organisation.leitlinie.grundsaetze.push('Wir beachten Art. 29 AI Act.');
    const b = pruefe(p).filter((x) => x.regel === 'H52');
    expect(b.map((x) => x.ziel)).toEqual(['organisation/leitlinie']);
  });
  it('H51: Risiko mit höherer Auswirkung oder System mit Bestätigung löst nicht aus', () => {
    const p = vollstaendigesProjekt();
    Object.assign(p.kiSysteme[0]!, { handlungsbefugnis: 'bereitet-vor' });
    p.risiken[0]!.a = 1;
    expect(ids(p)).not.toContain('H51');
    Object.assign(p.kiSysteme[0]!, { handlungsbefugnis: 'fuehrt-begrenzt-aus', stoppmoeglichkeit: 'Konsole', protokollierung: 'Plattform', aufsicht: 'Eignerin' });
    p.risiken.push({ ...p.risiken[0]!, id: 'R-002', a: 2 });
    expect(ids(p)).not.toContain('H51');
  });
  it('H42 bis H48: Grenzfälle lösen nicht aus', () => {
    const p = vollstaendigesProjekt();
    p.personen.push({ id: 'P-002', name: 'Bruno Leiter', funktion: 'CEO', aimsRollen: ['gl'] });
    // Ausnahme genau 6 Monate, erteilt von der Geschäftsleitung; Restrisiko über der Grenze mit Begründung
    p.organisation.leitlinie.ausnahmeHoechstMonate = 6;
    p.risiken[0]!.ausnahme = { von: 'P-002', am: '2026-10-13', bis: '2027-04-13' };
    p.risiken.push({ ...p.risiken[0]!, id: 'R-002', ausnahme: undefined, wNach: 2, aNach: 3, restrisikoBegruendung: 'Getragen bis zum Abschluss von M-001 am 31.01.2027.' });
    // Freigabe bei hohem Risiko durch die Geschäftsleitung; Entscheidungsrecht als Person
    p.risiken[0]!.w = 4; p.risiken[0]!.a = 4;
    p.kiSysteme[0]!.freigabe = { von: 'P-002', am: '2026-10-12' };
    p.organisation.entscheidungsrechte = [{ entscheid: 'restrisiko', wer: { mittel: 'P-001' } }];
    // Lieferant mit Auflagen trotz offener Frage; Prüfung am Tag der Freigabe; fünf gleiche Texte
    p.lieferanten.push({ id: 'L-001', name: 'Anbieter', leistung: 'Copilot', pruefstatus: 'mit-auflagen', pruefpunkte: { 'PF-20': 'offen' }, bemerkung: 'Auflage: Links gesperrt' });
    p.dokumente[0]!.geprueft = { von: 'P-001', am: '2026-10-10' };
    for (const c of p.controls.slice(0, 5)) c.wirksamkeit = { wie: 'Internes Audit AU-001', wann: '2026-10-15', wer: 'P-001', ergebnis: 'keine Abweichung' };
    p.audits[0]!.checkliste = Object.fromEntries(p.controls.slice(0, 5).map((c) => [c.id, { nachweis: 'D-03' }]));
    expect(ids(p).filter((r) => ['H42', 'H43', 'H44', 'H45', 'H46', 'H47', 'H48'].includes(r))).toEqual([]);
  });
  it('H44 nennt System und Risiko mit Sprungziel; volle Folgenabschätzung gilt als hohes Risiko', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme[0]!.freigabe = { von: 'P-001', am: '2026-10-12' };
    p.folgenabschaetzungen.push({ ...leereIa(), triage: { ...leereIa().triage, ergebnis: 'voll' }, freigabe: { von: 'P-001', am: '2026-10-01' } });
    p.risiken[0]!.wNach = 4; p.risiken[0]!.aNach = 4; p.risiken[0]!.restrisikoBegruendung = 'x';
    expect(pruefe(p).filter((b) => b.regel === 'H44').map((b) => b.ziel)).toEqual(['inventar/KI-001', 'risiken/R-001']);
  });
  it('H49: Beurteilung am Tag der Änderung oder danach, Chancen und Systeme ohne Änderungsdatum lösen nicht aus; Treffer je Risiko mit Sprungziel', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme[0]!.geaendertAm = '2026-12-01';
    p.risiken[0]!.beurteiltAm = '2026-12-01';
    p.risiken.push({ ...p.risiken[0]!, id: 'R-002', art: 'chance', beurteiltAm: '2026-10-01' });
    expect(ids(p)).not.toContain('H49');
    // ohne beurteiltAm zählt die Annahme des Restrisikos
    p.risiken[0]!.beurteiltAm = undefined;
    p.risiken[0]!.restrisikoAkzeptiert = { von: 'P-001', am: '2026-11-15' };
    const b = pruefe(p).filter((x) => x.regel === 'H49');
    expect(b.map((x) => `${x.id} ${x.ziel}`)).toEqual(['R-001 risiken/R-001']);
    p.kiSysteme[0]!.geaendertAm = undefined;
    expect(ids(p)).not.toContain('H49');
  });
  it('H01 meldet die überfällige Wiedervorlage des Einsatzentscheids', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme[0]!.einsatzentscheid!.wiedervorlage = '2026-01-31';
    expect(pruefe(p).filter((x) => x.regel === 'H01').map((x) => x.ziel)).toEqual(['inventar/KI-001']);
  });
  it('Prozessregeln laufen nur, wenn das Projekt Prozesse führt; Grenzfälle lösen nicht aus', () => {
    const prozessRegeln = ['F31', 'F32', 'H55', 'H56', 'H57', 'H58', 'H59', 'H60', 'H61', 'H62', 'H63', 'H67', 'H68', 'H71', 'H72', 'H74'];
    const p = vollstaendigesProjekt();
    p.meta.mitIsms = true;
    expect(ids(p).filter((r) => prozessRegeln.includes(r))).toEqual([]);
    // Eigner über die Rolle in D-04, begründet nicht anwendbar (Control), Messwert aktuell, Verweis auf das ISMS
    p.meta.mitIsms = false;
    p.prozesse = [
      { id: 'PR-07', anwendbar: 'nein', begruendung: 'Keine neuen Werkzeuge, Liste geschlossen' },
      { id: 'PR-12', reife: 3, letzteDurchfuehrung: '2026-10-01', kennzahl: 'Z-001' },
    ];
    // Messung eines Ziels mit KI-System: gilt als Durchführung von PR-12 (Ableitung), passt zur Kennzahl (Prozent)
    p.ziele[0]!.messungen = [{ datum: '2026-09-30', wert: '98 %' }];
    p.ziele[0]!.kiSysteme = ['KI-001'];
    p.personen[0]!.aimsRollen = ['aims', 'gl', 'it', 'hr', 'fachbereich', 'einkauf', 'kommunikation', 'ism', 'dsb', 'recht'];
    p.rollen = ['risikomanagement', 'folgenabschaetzung', 'inventar', 'daten', 'lieferanten', 'schulung', 'vorfall', 'internes-audit', 'dokumentenlenkung', 'konformitaet', 'berichterstattung', 'informationssicherheit', 'datenschutz', 'recht', 'entwicklung', 'menschliche-aufsicht'].map((b, i) => ({ id: `RO-${String(i + 1).padStart(3, '0')}`, bereich: b, verantwortlich: 'P-001', konsultiert: [], informiert: [] }));
    expect(ids(p).filter((r) => prozessRegeln.includes(r))).toEqual([]);
  });

  it('Stage-1-Runde 6: Grenzfälle der neuen Regeln lösen nicht aus', () => {
    // H67: überfällig mit offener Massnahme zum Prozess
    const a = vollstaendigesProjekt();
    a.prozesse = [{ id: 'PR-12', letzteDurchfuehrung: '2026-01-15', rhythmus: 'quartalsweise' }];
    a.massnahmen.push({ id: 'M-001', titel: 'Stichprobe nachholen', beschreibung: '', verantwortlich: 'P-001', termin: '2026-11-30', status: 'offen', prioritaet: 'mittel', herkunft: { art: 'prozess', ref: 'PR-12' } });
    expect(ids(a)).toContain('H55');
    expect(ids(a)).not.toContain('H67');
    // H68: Eigner ist die Geschäftsleitung oder die zuständige Person; externe Person widerspricht immer
    const b = vollstaendigesProjekt();
    b.personen.push({ id: 'P-002', name: 'GL', funktion: 'Geschäftsführer', aimsRollen: ['gl'] }, { id: 'P-003', name: 'Extern', funktion: 'Externe Auditorin', aimsRollen: ['auditor'] });
    b.rollen.push({ id: 'RO-003', bereich: 'internes-audit', verantwortlich: 'P-003', rechenschaft: 'P-001', konsultiert: [], informiert: [] });
    b.prozesse = [{ id: 'PR-25', eigner: 'P-001' }, { id: 'PR-26', eigner: 'P-002' }];
    expect(ids(b)).not.toContain('H68');
    b.prozesse = [{ id: 'PR-25', eigner: 'P-003' }];
    expect(pruefe(b).filter((x) => x.regel === 'H68').map((x) => x.id)).toEqual(['PR-25']);
    // H69: volle Abschätzung vorhanden
    const c = vollstaendigesProjekt();
    faelle.H69!(c);
    c.folgenabschaetzungen[0]!.triage.ergebnis = 'voll';
    expect(ids(c)).not.toContain('H69');
    // H70: geplante Änderung mit Bezug auf D-27
    const d = vollstaendigesProjekt();
    faelle.H70!(d);
    d.massnahmen.push({ id: 'M-001', titel: 'Prozesse einführen', beschreibung: '', verantwortlich: 'P-001', termin: '2026-10-12', status: 'erledigt', prioritaet: 'mittel', herkunft: { art: 'aenderung', ref: 'D-27' } });
    expect(ids(d)).not.toContain('H70');
    // H71: geprüfter Lieferant und Steuerung
    const e = vollstaendigesProjekt();
    e.lieferanten.push({ id: 'L-001', name: 'IT-Partner', leistung: 'Konten', pruefstatus: 'mit-auflagen', pruefpunkte: {}, bemerkung: '' });
    e.prozesse = [{ id: 'PR-12', extern: { lieferant: 'L-001', steuerung: 'Auftrag mit Bericht' } }];
    expect(ids(e)).not.toContain('H71');
    // H73: Kurzprüfungen führt eine andere Person durch (triage.durch)
    const f = vollstaendigesProjekt();
    faelle.H73!(f);
    f.personen.push({ id: 'P-002', name: 'Eignerin', funktion: 'Leiterin', aimsRollen: ['fachbereich'] });
    f.folgenabschaetzungen.push({ ...leereIa(), triage: { ...leereIa().triage, durch: 'P-002' }, freigabe: { von: 'P-001', am: '2026-09-01' } });
    expect(ids(f)).not.toContain('H73');
    // H74: gleiche Einheit; unbekannte Einheit ohne Aussage
    const g = vollstaendigesProjekt();
    g.prozesse = [{ id: 'PR-06', kennzahl: 'Z-001' }];
    g.ziele[0]!.messungen = [{ datum: '2026-10-01', wert: '98 %' }];
    expect(ids(g)).not.toContain('H74');
    g.ziele[0]!.messungen = [{ datum: '2026-10-01', wert: '41 ppm' }];
    g.ziele[0]!.sollwert = 'höchstens 50 ppm';
    g.ziele[0]!.kennzahl = 'Schlupf';
    g.prozesse = [{ id: 'PR-08', kennzahl: 'Z-001' }];
    expect(ids(g)).not.toContain('H74');
    // H75: Durchführung von Hand oder Termin
    const h = vollstaendigesProjekt();
    h.prozesse = [{ id: 'PS-02', naechsteFaelligkeit: '2026-12-31' }];
    expect(pruefe(h).filter((x) => x.regel === 'H75').map((x) => x.id)).not.toContain('PS-02');
  });

  it('F31 und F32 nennen den Prozess mit Sprungziel in den Bereich Prozesse', () => {
    const p = vollstaendigesProjekt();
    p.prozesse = [{ id: 'PR-03', anwendbar: 'nein', begruendung: 'Nicht nötig' }];
    const b = pruefe(p).filter((x) => x.regel === 'F32');
    expect(b.map((x) => [x.id, x.ziel])).toEqual([['PR-03', 'prozesse/PR-03']]);
    expect(pruefe(p).filter((x) => x.regel === 'F31').every((x) => x.ziel === `prozesse/${x.id}` && /^PR-\d\d$/.test(x.id!))).toBe(true);
  });

  it('H63: Pflichtprozesse über den Auditzyklus; Audit ohne Auswahl umfasst alle, Audits älter als drei Jahre zählen nicht', () => {
    const p = vollstaendigesProjekt();
    p.prozesse = [{ id: 'PR-15', anwendbar: 'ja' }];
    const pflicht = (kataloge.prozesse_katalog as { prozesse: { id: string; pflicht: string; art: string }[] }).prozesse.filter((x) => x.pflicht === 'pflicht' && x.art !== 'nur-isms').map((x) => x.id);
    const h63 = () => pruefe(p).filter((x) => x.regel === 'H63').map((x) => x.id);
    // Durchgeführtes Audit mit Auswahl und geplantes Audit mit den übrigen Pflichtprozessen: alles abgedeckt
    p.audits[0]!.umfangProzesse = pflicht.slice(0, 5);
    p.audits.push({ ...p.audits[0]!, id: 'AU-002', durchgefuehrt: undefined, geplant: '2027-10-15', umfangProzesse: pflicht.slice(5) });
    expect(h63()).toEqual([]);
    // Geplantes Audit ohne Pflichtprozess PR-27: genau dieser fehlt im Zyklus (Control-Prozess PR-15 zählt nicht)
    p.audits[1]!.umfangProzesse = pflicht.slice(5).filter((x) => x !== 'PR-27');
    expect(h63()).toEqual(['PR-27']);
    expect(pruefe(p).find((x) => x.regel === 'H63')!.ziel).toBe('audits');
    // Ein Audit ohne Auswahl umfasst alle Prozesse
    p.audits[1]!.umfangProzesse = [];
    expect(h63()).toEqual([]);
    // Audit älter als 36 Monate zählt nicht zum Zyklus
    p.audits = [{ ...p.audits[0]!, durchgefuehrt: '2023-09-01', umfangProzesse: ['PR-25'] }];
    expect(h63()).toEqual([]);
    // Ohne Projekt.prozesse keine Prozessregel
    p.audits = [{ ...p.audits[0]!, durchgefuehrt: '2026-10-15', umfangProzesse: ['PR-25'] }];
    delete p.prozesse;
    expect(h63()).toEqual([]);
  });

  it('H64 und H65: Hinweise zur Gestaltung nur bei hellem Logo bzw. korrigierter Primärfarbe; Sprung in die Dokumentgestaltung', () => {
    const p = vollstaendigesProjekt();
    faelle['H64']!(p);
    const h64 = pruefe(p).filter((x) => x.regel === 'H64');
    expect(h64.map((x) => [x.name, x.ziel])).toEqual([['logo-weiss.png', 'einstellungen/gestaltung']]);
    // Dunkles Logo (schwarz auf Transparenz): kein Hinweis
    const daten = new Uint8Array(40 * 20 * 4);
    for (let i = 0; i < 20 * 20; i++) daten.set([20, 30, 60, 255], i * 4);
    p.organisation.gestaltung = { logo: { png: pngDataUrl(pngKodieren({ breite: 40, hoehe: 20, daten })), breite: 40, hoehe: 20 }, farben: { primaer: '1D3557' } };
    expect(ids(p).filter((r) => r === 'H64' || r === 'H65')).toEqual([]);
    // Gelb ist auf Weiss zu hell für Text: korrigierte Farbe im Namen
    p.organisation.gestaltung.farben = { primaer: 'FFD700' };
    const h65 = pruefe(p).filter((x) => x.regel === 'H65');
    expect(h65).toHaveLength(1);
    expect(h65[0]!.name).toMatch(/^#FFD700 \(#[0-9A-F]{6}(, #[0-9A-F]{6})*\)$/);
    expect(h65[0]!.ziel).toBe('einstellungen/gestaltung');
    // Überschriften schwarz und Diagramme im Kit-Design: die Primärfarbe wirkt nur noch als Fläche ohne Korrektur
    p.organisation.gestaltung.farben = { primaer: 'FFD700', ueberschriften: false, diagramme: false };
    expect(ids(p)).not.toContain('H65');
  });

  it('Sprungziel enthält die ID', () => {
    const p = vollstaendigesProjekt();
    p.kiSysteme[0]!.eigner = undefined;
    expect(pruefe(p).find((b) => b.regel === 'F01')!.ziel).toBe('inventar/KI-001');
  });
});

// V-12 (Designsystem AIMS Nachtblau): Die Prüfung erklärt die Bereitschaft wie der Code: rot bei Fehlern oder Lücken, gelb nur
// mit Hinweisen, die nicht binden. Die bindenden Regeln (Vier-Augen, Datum in der Zukunft) kommen aus BEREITSCHAFT_REGELN.
describe('V-12 Bereitschaft: bindende Hinweise aus BEREITSCHAFT_REGELN', () => {
  const gefuehrt = JSON.parse(readFileSync('src/generiert/gefuehrt.json', 'utf8')) as GefuehrtDaten;
  const k = JSON.parse(readFileSync('src/generiert/kataloge.json', 'utf8')) as Kataloge;
  const u: Umfeld = {
    gefuehrt, controlIds42001: k.controls42001.gruppen.flatMap((g) => g.controls.map((c) => c.id)),
    euaia: (k['aiact_euaiaControls'] as { controls: EuaiaControl[] }).controls, heute: () => '2027-02-05',
  };
  // Endstand des Beispiels Muster: alle Etappen erledigt, Pflichtregister gefüllt
  const muster = () => JSON.parse(readFileSync('src/beispiele/muster-maschinenbau.de.aims.json', 'utf8')) as Projekt;

  it('BEREITSCHAFT_REGELN nennt die Regeln, die als Lücke binden', () => {
    expect([...BEREITSCHAFT_REGELN]).toEqual(expect.arrayContaining(['H88', 'H89']));
  });

  it('ohne Lücken: keine Befunde ergeben gruen, nur Hinweise ausser den bindenden ergeben gelb («Bereit mit Hinweisen»)', () => {
    const p = muster();
    expect(bereitschaftBerechnen(p, u, [], []).luecken).toEqual([]);
    expect(bereitschaftBerechnen(p, u, [], []).stufe).toBe('gruen');
    const nichtBindend = ['H15', 'H33', 'H47'].filter((r) => !(BEREITSCHAFT_REGELN as readonly string[]).includes(r));
    const b = bereitschaftBerechnen(p, u, nichtBindend.map((regel) => ({ schwere: 'hinweis' as const, regel })), []);
    expect(b.stufe).toBe('gelb');
    expect(b.luecken).toEqual([]);
    expect(b.hinweise).toBe(nichtBindend.length);
  });

  for (const regel of BEREITSCHAFT_REGELN) {
    it(`ein Hinweis ${regel} bindet: rot mit Lücke { art: 'regel', id: '${regel}' }`, () => {
      const b = bereitschaftBerechnen(muster(), u, [{ schwere: 'hinweis', regel }], []);
      expect(b.stufe).toBe('rot');
      expect(b.luecken).toContainEqual(expect.objectContaining({ art: 'regel', id: regel }));
    });
  }
});
