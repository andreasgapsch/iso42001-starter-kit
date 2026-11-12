// Ein in sich vollständiges Testprojekt, das keine Prüfregel auslöst. Tests verändern es gezielt.
import { leeresProjekt } from '../../src/model/neu.ts';
import type { ControlEintrag, KiSystem, Projekt } from '../../src/model/typen.ts';

export const CONTROLS_42001 = [
  'A.2.2', 'A.2.3', 'A.2.4', 'A.3.2', 'A.3.3', 'A.4.2', 'A.4.3', 'A.4.4', 'A.4.5', 'A.4.6',
  'A.5.2', 'A.5.3', 'A.5.4', 'A.5.5', 'A.6.1.2', 'A.6.1.3', 'A.6.2.2', 'A.6.2.3', 'A.6.2.4', 'A.6.2.5',
  'A.6.2.6', 'A.6.2.7', 'A.6.2.8', 'A.7.2', 'A.7.3', 'A.7.4', 'A.7.5', 'A.7.6', 'A.8.2', 'A.8.3',
  'A.8.4', 'A.8.5', 'A.9.2', 'A.9.3', 'A.9.4', 'A.10.2', 'A.10.3', 'A.10.4',
];

export function kiSystem(teil: Partial<KiSystem> = {}): KiSystem {
  return {
    id: 'KI-001', name: 'Copilot', typ: 'saas', beschreibung: 'Assistent', zweck: 'Texte', fachbereich: 'alle', eigner: 'P-001',
    personendaten: false, besondereDaten: false, betroffene: 'Mitarbeitende', automatisierung: 'unterstuetzend', lebenszyklus: 'betrieb',
    status: 'freigegeben', ressourcen: { daten: '', werkzeuge: '', rechenressourcen: '', personal: '' }, sensibleNutzung: false,
    aiAct: { rollen: ['betreiber'], risikoklasse: 'minimal', transparenz: [], gpai: false, begruendung: 'Bürounterstützung', juristischGeprueft: false },
    naechsteUeberpruefung: '2027-06-30',
    // ab rc.2 (Prüfregeln H31, H33)
    modell: { anbieter: 'Anbieter', name: 'Modell', version: '2026-09' },
    einsatzentscheid: { nutzen: 'Zeitersparnis', alternativeOhneKi: 'Vorlagen genügen nicht', wiedervorlage: '2027-06-30' },
    ...teil,
  };
}

export function vollstaendigesProjekt(): Projekt {
  const p = leeresProjekt({ jetzt: '2026-10-20T08:00:00Z', mitIsms: false, modulAiAct: true });
  p.organisation.name = 'Test AG';
  p.personen = [{ id: 'P-001', name: 'Anna Muster', funktion: 'CIO, Mitglied der Geschäftsleitung', aimsRollen: ['aims'] }];
  p.organisation.geltungsbereich.beschreibung = 'Ganze Firma';
  p.organisation.geltungsbereich.freigabe = { von: 'P-001', am: '2026-10-01' };
  p.organisation.leitlinie.grundsaetze = ['Der Mensch entscheidet.'];
  p.organisation.leitlinie.freigabe = { von: 'P-001', am: '2026-10-01' };
  p.organisation.leitlinie.naechsteUeberpruefung = '2027-10-01';
  p.organisation.risikokriterien = {
    zeitraum: 'pro Jahr',
    wahrscheinlichkeit: [{ stufe: 1, bezeichnung: 'selten', beschreibung: '' }],
    auswirkung: [{ stufe: 1, bezeichnung: 'gering', beschreibung: '' }],
    akzeptanzBis: 4, unannehmbarAb: 12, ausIsmsUebernommen: false,
  };
  p.rollen = [
    { id: 'RO-001', bereich: 'konformitaet', verantwortlich: 'P-001', konsultiert: [], informiert: [] },
    { id: 'RO-002', bereich: 'berichterstattung', verantwortlich: 'P-001', konsultiert: [], informiert: [] },
  ];
  p.kiSysteme = [kiSystem()];
  p.risiken = [{
    id: 'R-001', art: 'risiko', titel: 'Datenabfluss', beschreibung: '', kiSystem: 'KI-001', quelle: 'Daten', ebenen: ['organisation'],
    ursache: '', folge: '', bestehendeMassnahmen: '', w: 2, a: 3, wNach: 1, aNach: 3, behandlung: 'vermindern', controls: ['A.9.2'],
    massnahmen: [], eigner: 'P-001', restrisikoAkzeptiert: { von: 'P-001', am: '2026-10-10' }, status: 'akzeptiert',
  }];
  p.controls = CONTROLS_42001.map((id): ControlEintrag => ({
    id, rahmenwerk: 'ISO42001', anwendbar: 'ja', begruendung: 'Risiko R-001', status: 'umgesetzt', nachweise: ['N-001'], umsetzung: 'gemäss D-15', iso27001: [], kiSysteme: [],
    // je Control eigener Text (H47 meldet viele gleiche Texte)
    wirksamkeit: { wie: `Stichprobe zu ${id}`, wann: '2026-10-15', wer: 'P-001', ergebnis: 'wirksam' },
  }));
  p.dokumente = [{ id: 'D-07', version: '1.0', status: 'freigegeben', freigabe: { von: 'P-001', am: '2026-10-10' }, geprueft: { von: 'P-001', am: '2026-10-10' }, ablageort: 'SharePoint', giltFuerIsms: false, naechsteUeberpruefung: '2027-10-01' }];
  p.ziele = [{ id: 'Z-001', ziel: 'Inventar vollständig', kennzahl: 'Anteil erfasst', sollwert: '100 %', messmethode: '', haeufigkeit: 'quartalsweise', verantwortlich: 'P-001', ressourcen: '', termin: '2027-03-31', bewertung: 'MB', messungen: [] }];
  p.audits = [{ id: 'AU-001', art: 'intern', kombiniertMitIsms: false, durchgefuehrt: '2026-10-15', umfang: 'alles', kriterien: '42001', auditor: 'extern', unabhaengigkeit: 'externe Auditorin', ergebnis: 'ok' }];
  p.managementbewertungen = [{ id: 'MB-001', datum: '2026-10-18', kombiniertMitIsms: false, teilnehmende: 'GL', eingaben: { statusMassnahmen: '', aenderungenThemen: '', aenderungenParteien: '', leistung: '', verbesserungen: '', weitere: '' }, entscheide: '', massnahmen: [] }];
  p.kommunikation = [{ id: 'KO-001', was: 'Leitlinie', wann: 'jährlich', mitWem: 'Kunden', wie: 'Website', richtung: 'extern' }];
  // Verweisregister (F33): die Controls verweisen auf N-001, der Nachweis muss es geben
  p.nachweise = [{ id: 'N-001', titel: 'Stichprobe Controls', art: 'aufzeichnung', ablageort: 'SharePoint' }];
  return p;
}
