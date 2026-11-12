// Beispiel 1 zusammensetzen: Muster Maschinenbau AG.
import type { Projekt } from '../../model/typen.ts';
import { rc3Muster } from './rc3.mts';
import { prozessDatenMuster, prozesseMuster } from './prozesse.mts';
import { etappenChecklisten, etappenStand, soa, vorschlaegeZuordnen, wirksamNachPruefung } from './gemeinsam.mts';
import { folgenabschaetzungen, kiSysteme, organisation, parteien, personen, rollen } from './muster-1.mts';
import { massnahmen, nachweise, risiken } from './muster-2.mts';
import { konsolidierungMuster, pruefDaten } from './muster-4.mts';
import { rc2Muster } from './muster-5.mts';
import {
  audits, dokumente, eigeneControlEintraege, eigeneControls, euaiaControls, feststellungen, kommunikation, kompetenzen, lieferanten, managementbewertungen, soaEintraege, ziele,
} from './muster-3.mts';

export function musterMaschinenbau(): Projekt {
  const p: Projekt = {
    schemaVersion: 1,
    kitVersion: '1.0.0',
    meta: {
      projektId: '6f1c2a8e-4b7d-4e2a-9c51-3d8e0b7a1f42',
      erstellt: '2026-08-03T08:00:00.000Z',
      geaendert: '2027-02-05T16:30:00.000Z',
      dokumentSprache: 'de',
      mitIsms: true,
      ismsZertifiziert: true,
      modulAiAct: true,
      gefuehrt: {
        aktuelleEtappe: 'E13',
        aktuelleSeite: 'E13-pruefung',
        etappen: {},
        antworten: {
          isms: 'zertifiziert',
          bekannteKiWerkzeuge: ['M365 Copilot', 'ChatGPT Team', 'Kamerasystem Linie 3', 'Wartungsfunktion MX-Predict', 'Prognosemodell Planung', 'Ersatzteil-Assistent'],
          ausloeser: ['kunde', 'aiact', 'geschaeftsleitung'],
          vorhandeneSysteme: ['iso9001', 'iso27001', 'iso14001', 'datenschutz'],
          gap: { k4: 'begonnen', k5: 'begonnen', k6: 'weitgehend', inventar: 'fehlt', k7: 'weitgehend', k8: 'begonnen', k9: 'weitgehend', k10: 'erfuellt' },
          projekt: {
            ziel: 'Zertifizierung nach ISO/IEC 42001 bis 30.06.2027 als Erweiterung des ISMS, mit den Pflichten aus dem EU AI Act für Produkt-KI, Kundenportal und Personalbereich; Stage-1-Bereitschaft nach rund 6 Monaten.',
            aufwandPt: 50, budget: 85000, pensumProzent: 40,
            freigabe: { von: 'P-001', am: '2026-08-04' }, glTraktandum: 'monatlich',
          },
          ismsKontext: { deckung: 'teilweise', ablage: 'SharePoint ISMS/AIMS > 01_Kontext (ISMS-Kontextanalyse Version 3.2 mit KI-Ergänzung)' },
          grundlagen: {
            prozesse: ['Verkauf und Angebotswesen', 'Entwicklung und Konstruktion', 'Fertigung und Qualitätsprüfung', 'Montage und Inbetriebnahme', 'Kundendienst und Ersatzteile', 'Einkauf und Planung', 'Personal'],
            organigramm: 'SharePoint ISMS/AIMS > 04_Organisation > Organigramm 2027',
            itBetrieb: 'Eigene IT mit 5 Personen am Hauptsitz; Büro-IT und Produktions-IT getrennt; M365 und HR-SaaS als Cloud-Dienste.',
          },
          kiZweck: { ziele: ['qualitaet', 'produkt', 'kundenservice', 'effizienz', 'entwicklung'], text: 'KI verbessert Qualität und Planbarkeit in der Fertigung, macht unsere Maschinen durch vorausschauende Wartung wertvoller und entlastet Kundendienst und Büro von Routinearbeit.' },
          aimsProzesse: ['inventar', 'freigabe-werkzeuge', 'risiko', 'folgen', 'lieferanten', 'schulung', 'vorfall', 'aenderung', 'audit', 'managementbewertung'],
          leitlinie: { elemente: ['zweck', 'zielrahmen', 'anforderungen', 'verbesserung'], bezug: ['informationssicherheit', 'datenschutz', 'qualitaet', 'personal', 'beschaffung'], bezugNotiz: 'Abgleich am 27.08.2026 (N-042).' },
          ismsFuehrung: { rollenErgaenzen: true, meldewegErgaenzen: true, leitlinieVerweis: true },
          meldeweg: { kanaele: ['vorgesetzte', 'aims', 'whistleblowing'], ausweichstelle: 'P-009', vertraulich: true, fristTage: 10 },
          inventar: { quellen: ['softwareliste', 'lizenzen', 'einkauf', 'umfrage', 'fachbereiche', 'produktentwicklung', 'spesen'], fragebogenBereiche: ['verkauf', 'einkauf', 'produktion', 'entwicklung', 'qualitaet', 'hr', 'service', 'it'], ruecklaufBis: '2026-08-28' },
          werkzeugFreigabe: { wer: 'P-002', kriterien: ['datenschutz', 'vertraulichkeit', 'vertrag', 'sicherheit', 'nutzen', 'aiact', 'exportkontrolle'], fristTage: 10 },
          aiActVermerk: { text: 'Das AI-Act-Modul ist eingeschaltet: Kunden in der ganzen EU, Vertriebsgesellschaft in Deutschland, KI als Produktfunktion und im Kundenportal, Hochrisiko-Fall im Personalbereich. Jährliche Überprüfung des Stands.', naechstePruefung: '2027-07-31' },
          oeffentlicheDienste: false,
          neubeurteilung: { rhythmus: 'halbjaehrlich', ausloeser: ['neues-system', 'wesentliche-aenderung', 'vorfall', 'rechtslage', 'lieferantenwechsel', 'audit'] },
          folgen: { durchfuehrung: 'P-002', freigabe: 'P-001', rhythmus: 'jaehrlich', ausloeser: ['neues-system', 'wesentliche-aenderung', 'vorfall', 'rechtslage'] },
          protokolle: { inhalt: ['eingaben', 'ausgaben', 'fehler', 'aenderungen', 'nutzende'], aufbewahrungMonate: 12, auswertung: 'quartalsweise' },
          meldekanal: { adresse: 'ki-feedback@muster-maschinenbau.example und Formular «KI-Rückmeldung» im Kundenportal', bearbeitung: 'P-008', fristTage: 5, vorfallVerfahren: 'ISMS-Vorfallverfahren VA-ISMS-07 mit KI-Ergänzung' },
          nutzung: { regeln: ['nur-freigegebene', 'keine-vertraulichen-daten', 'ergebnisse-pruefen', 'kennzeichnen', 'firmenkonten', 'exportkontrolle', 'melden'], bestaetigung: true },
          bewusstsein: { formate: ['einfuehrung', 'e-learning', 'intranet', 'teamsitzung', 'bestaetigung'], rhythmus: 'jaehrlich' },
          kiKompetenz: { zielgruppen: ['alle', 'generativ', 'aufsicht', 'entwicklung', 'geschaeftsleitung'], massnahmen: 'Grundschulung für alle Nutzenden (E-Learning 45 Minuten), Vertiefung für Entwicklung (Lebenszyklus, Maschinensicherheit), Aufsichtsschulung für die Personalabteilung, Halbtag für die Geschäftsleitung zu AI Act und Haftung.' },
          lenkung: { ismsRegelnGelten: true, ablage: 'SharePoint ISMS/AIMS mit Versionsverlauf; Lenkung nach ISMS-Verfahren VA-ISMS-02', namensregel: 'ID_Titel', freigabe: 'eigner', aufbewahrungJahre: 10, extern: 'Normen, Rechtstexte und Lieferantenunterlagen im Ordner 99_Extern mit Stand-Datum.' },
          aenderungen: { weg: 'aims-team', notiz: 'Änderungen am AIMS bespricht das AIMS-Team monatlich; grössere Änderungen gehen in die GL-Sitzung.' },
          auditprogramm: { rhythmus: 'jaehrlich', methoden: ['interviews', 'dokumente', 'stichproben', 'begehung'], kombiniert: true },
          verbesserung: { quellen: ['audit', 'managementbewertung', 'meldungen', 'vorfaelle', 'kennzahlen', 'mitarbeitende', 'kunden'] },
          zertifizierung: { stelle: 'Certimont Zertifizierung AG', akkreditiert: true, kombiniert: true, offertenBis: '2026-09-30', angefragt: 'Drei akkreditierte Stellen angefragt: die Zertifizierungsstelle des ISMS und zwei weitere mit Akkreditierung für ISO/IEC 42001; Wahl nach Preis, Erfahrung mit Maschinenbau und kombinierten Audits.', wahlBis: '2026-10-09', unterlagen: ['geltungsbereich', 'leitlinie', 'rollen', 'inventar', 'risiko', 'folgen', 'soa', 'ziele', 'audit', 'managementbewertung', 'nichtkonformitaeten', 'dokumente'] },
          jahr: { monatAudit: 'januar', monatMb: 'februar', monatUeberwachung: 'maerz' },
        },
      },
      checklisten: {},
    },
    organisation,
    personen,
    parteien,
    rollen,
    kiSysteme,
    risiken,
    folgenabschaetzungen,
    controls: [],
    eigeneControls,
    nachweise,
    dokumente,
    massnahmen,
    lieferanten,
    ziele,
    kompetenzen,
    kommunikation,
    audits,
    feststellungen,
    managementbewertungen,
  };
  p.controls = [...soa(soaEintraege, risiken, true), ...euaiaControls, ...eigeneControlEintraege];
  konsolidierungMuster(p);
  rc2Muster(p);
  rc3Muster(p);
  // Risiken, die einem Vorschlag GenAI-Sicherheit entsprechen (Vorschlagsliste im Risikoregister)
  vorschlaegeZuordnen(p, {
    'R-001': 'GS-02', 'R-003': 'GS-02', 'R-004': 'GS-07', 'R-014': 'GS-07', 'R-016': 'GS-01', 'R-018': 'GS-02', 'R-027': 'GS-01',
    'R-028': 'GS-06', 'R-029': 'GS-05', 'R-030': 'GS-01', 'R-031': 'GS-04', 'R-032': 'GS-04', 'R-033': 'GS-22',
  });
  // Positiv geprüft: «wirksam»; mit Feststellung F-001 (Korrektur bis 30.04.2027) oder Lücke (Stellvertretung M-013) «umgesetzt»
  wirksamNachPruefung(p, ['A.4.6', 'A.5.2', 'A.6.2.4', 'A.6.2.5']);
  p.meta.gefuehrt.etappen = etappenStand(p, ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12'], ['E13']);

  // Checklisten der Etappen: Datum und Nachweis zum Stand beim Abschluss der Etappe
  const datum: Record<string, string> = { E1: '2026-08-04', E2: '2026-09-01', E3: '2026-09-07', E4: '2026-09-11', E5: '2026-09-25', E6: '2026-10-16', E7: '2026-11-10', E8: '2026-11-24', E9: '2026-12-22', E10: '2026-12-22', E11: '2027-01-12', E12: '2027-02-02', E13: '2027-02-05' };
  const nachweis: Record<string, string> = { E1: 'N-001', E2: 'D-01 v1.0, D-02 v1.0', E3: 'N-002, N-004, N-005', E4: 'N-006', E5: 'N-045', E6: 'D-06-EB v1.0, Risikoworkshops Oktober 2026', E7: 'N-007, N-008', E8: 'D-07-EB v1.0, D-11 v1.0, E-03 v1.0', E9: 'N-010, N-019, N-021, N-024, N-026', E10: 'D-17-EB v1.0, E-04 v1.0', E11: 'D-05 v1.0, D-26-EB v1.0, N-043', E12: 'N-034, N-035', E13: 'D-25' };
  for (const [etappe, ids] of Object.entries(etappenChecklisten(p))) {
    if (!datum[etappe]) continue;
    ids.forEach((id, i) => {
      const offen = etappe === 'E13' && i === ids.length - 1;
      p.meta.checklisten[id] = offen ? { erledigt: false } : { erledigt: true, nachweis: nachweis[etappe], datum: datum[etappe] };
    });
  }
  // Betreiberpflichten KI-008 (E-05): Stand vor der Wiederinbetriebnahme
  const e05: [string, boolean, string?, string?][] = [
    ['betriebsanleitung', false],
    ['aufsicht', true, 'K-001, Rollenbeschreibung Personalabteilung', '2026-10-20'], ['organisation', true, 'Rollenbeschreibung Personalabteilung mit Stellvertretung', '2026-10-20'],
    ['eingabedaten', false], ['ueberwachung', false], ['protokolle', false],
    ['arbeitnehmende', true, 'Information Betriebsrat DE und Personalkommission CH, N-038', '2026-10-14'],
    ['eu-stellen', true, 'Nicht anwendbar: keine Behörde, kein öffentlicher Dienst', '2026-09-25'],
    ['dsfa', true, 'DSFA-2026-04, N-009', '2026-10-20'], ['biometrie', true, 'Nicht anwendbar: keine biometrische Fernidentifizierung', '2026-09-25'],
    ['betroffene', false], ['erlaeuterung', false], ['behoerden', true, 'Behördenkontakt ISMS, EUAIA-18', '2026-11-24'],
  ];
  for (const [punkt, erledigt, nw, d] of e05) p.meta.checklisten[`E-05.${punkt}.KI-008`] = erledigt ? { erledigt, nachweis: nw!, datum: d! } : { erledigt };
  p.meta.checklisten['E-07.hinweis.KI-006'] = { erledigt: true, nachweis: 'Hinweis im Chatfenster seit dem Start im März 2026 und in jeder Antwort, N-051', datum: '2026-10-23' };
  p.meta.checklisten['E-07.kennzeichnung.KI-006'] = { erledigt: true, nachweis: 'Maschinenlesbare Kennzeichnung jeder Antwort in Metadaten und Schnittstelle, N-051', datum: '2026-10-23' };
  p.meta.checklisten['E-08.einstufung.KI-002'] = { erledigt: true, nachweis: 'Nicht-Hochrisiko nach Art. 6(1a), Grenzfall 6(1b) dokumentiert, N-036', datum: '2026-09-25' };
  p.meta.checklisten['E-08.anleitung.KI-002'] = { erledigt: true, nachweis: 'Betriebsanleitung Kapitel MX-Predict, N-017', datum: '2026-11-30' };
  p.meta.checklisten['E-08.einstufung.KI-003'] = { erledigt: true, nachweis: 'Minimales Risiko, Eigengebrauch, N-045', datum: '2026-09-25' };
  p.meta.checklisten['E-08.einstufung.KI-006'] = { erledigt: true, nachweis: 'Transparenzpflichten Art. 50(1) und 50(2), kein Hochrisiko, N-045, N-047', datum: '2026-09-25' };
  p.meta.checklisten['E-08.anleitung.KI-006'] = { erledigt: true, nachweis: 'Nutzungshinweise im Kundenportal, N-051', datum: '2026-10-23' };
  // Prozessstand (Plan Prozesse 7); der Ablauf PR-07 aus draw.io kommt je Sprache dazu (bauen.mts, mitDrawioBeispiel)
  p.prozesse = prozesseMuster();
  prozessDatenMuster(p);
  // Prüfdaten der Dokumente erst, wenn alle datierten Einträge stehen
  pruefDaten(p);
  return p;
}
