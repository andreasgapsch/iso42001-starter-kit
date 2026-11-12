// Beispiel 2: Beispiel Präzisionsteile GmbH. Felder ab rc.2 (handelnde und generative KI, Modell, Rückfallweg,
// Missbrauchsfälle, Einsatzentscheid, Ausserbetriebnahme, Risikobereitschaft, Entscheidungsrechte, Wirksamkeit,
// Lieferantenfragen PF-16 bis PF-21). Ohne NIST AI RMF und ohne EU AI Act.
import type { ControlEintrag, JaNeinOffen, KiSystem, KlauselStand, Projekt } from '../../model/typen.ts';
import { soaStandZumAudit } from './gemeinsam.mts';

type Kern = Pick<KiSystem, 'aufgabenart' | 'handlungsbefugnis' | 'zugriffe' | 'gedaechtnis' | 'stoppmoeglichkeit' | 'generativ' | 'modell' | 'kritisch' | 'rueckfallweg' | 'abhaengigkeiten' | 'fremdeInhalte' | 'oeffentlich' | 'missbrauchsfaelle' | 'einsatzentscheid' | 'ausserbetrieb' | 'aufbewahrenBis'>;

const KERN: Record<string, Kern> = {
  'KI-001': {
    aufgabenart: 'erzeugt-inhalte', handlungsbefugnis: 'informiert', gedaechtnis: false, generativ: true, kritisch: false, fremdeInhalte: true, oeffentlich: false,
    zugriffe: 'E-Mails, Kalender, Teams und Dokumente im M365-Mandanten mit den Rechten der jeweiligen Person; Lohn- und Personalordner ausgenommen; Agenten und Konnektoren nicht freigeschaltet.',
    stoppmoeglichkeit: 'Lizenz entziehen oder Copilot im Admin-Center abschalten (IT-Verantwortlicher oder IT-Partner, sofort).',
    modell: { anbieter: 'Microsoft (Bezug über Mittelland Informatik GmbH)', name: 'Microsoft 365 Copilot mit Sprachmodellen der GPT-Familie von OpenAI, betrieben in Microsoft Azure', version: 'Dienststand gemäss Message Center des Mandanten, Stand Dezember 2026; Modellwechsel kündigt Microsoft dort an' },
    rueckfallweg: 'Arbeit ohne Assistent mit Textbausteinen und Vorlagen; kein Ablauf hängt von Copilot ab.',
    abhaengigkeiten: 'M365-Mandant mit bereinigten Ordnerfreigaben (M-011); Ergebnisse fliessen in Offerten, Prüfberichte und Korrespondenz.',
    missbrauchsfaelle: '5 Fälle vor der Freigabe am 17.11.2026: Kundenmail mit versteckter Anweisung, Anhang mit unsichtbarem Text, Abfrage des Lohnordners, Bitte um Weiterleitung nach aussen, externer Link in der Zusammenfassung; bestanden. Wiederholung nach grösseren Updates des Herstellers. Kosten und Verbrauch sind kein Risiko: feste Lizenzen ohne Abrechnung nach Verbrauch.',
    einsatzentscheid: {
      nutzen: 'Schnellere Offerttexte, Prüfberichte und Protokolle; ersetzt den untersagten kostenlosen Chatbot.',
      alternativeOhneKi: 'Textbausteine im ERP und Vorlagen in Word geprüft: decken Standardofferten ab, nicht die Zusammenfassung von Kundenanfragen; bleiben im Einsatz.',
      wiedervorlage: '2027-11-30',
    },
  },
  'KI-002': {
    aufgabenart: 'prognostiziert', handlungsbefugnis: 'bereitet-vor', gedaechtnis: false, generativ: false, kritisch: false, fremdeInhalte: false, oeffentlich: false,
    zugriffe: 'Auftrags-, Lager- und Lieferantendaten im ERP; erzeugt Bestellvorschläge, die erst nach Bestätigung durch die Disponentin als Bestellung gelten.',
    stoppmoeglichkeit: 'Funktion im ERP ausschalten (IT-Verantwortlicher, sofort); dann Disposition nach Mindestbeständen.',
    modell: { anbieter: 'Dispona ERP Software AG', name: 'Bedarfsprognose im ERP', version: 'ERP-Release vom 08.12.2026' },
    rueckfallweg: 'Disposition nach Mindestbeständen und Erfahrungswerten ohne Vorschläge.',
    abhaengigkeiten: 'Stammdaten im ERP (D-13); danach Bestellungen bei Lieferanten und Liefertermine an Kunden.',
    einsatzentscheid: {
      nutzen: 'Rechtzeitige Bestellung von Stangenmaterial und Werkzeugen, realistischere Liefertermine.',
      alternativeOhneKi: 'Disposition nach festen Mindestbeständen: genügt für Standardmaterial, nicht für schwankende Aufträge der Medizintechnik; bleibt als Rückfall.',
      wiedervorlage: '2027-11-30',
    },
  },
  'KI-003': {
    aufgabenart: 'empfiehlt', handlungsbefugnis: 'bereitet-vor', gedaechtnis: false, generativ: false, kritisch: false, fremdeInhalte: false, oeffentlich: false,
    zugriffe: '3D-Modelle und Zeichnungen im Projektordner, Werkzeug- und Spannmittelbibliothek; kein Zugriff auf die Maschinen, Programme gehen erst nach Freigabe an die Steuerung.',
    stoppmoeglichkeit: 'KI-Funktion in der Konfiguration der CAM-Software ausschalten (Leiter Arbeitsvorbereitung); programmiert wird dann ohne Vorschlag.',
    modell: { anbieter: 'Kontura CAM Solutions GmbH', name: 'KI-Modul der CAM-Software, Feature-Erkennung', version: '2026.2' },
    rueckfallweg: 'Programmierung ohne KI-Vorschlag; rund 30 % mehr Zeit für neue Teile.',
    abhaengigkeiten: 'Zeichnungsindex und Spannmittelbibliothek; danach Simulation, Einfahren und Freigabe der Programme, Fertigung und Erstmusterprüfung.',
    einsatzentscheid: {
      nutzen: 'Rund 30 % kürzere Programmierzeit für neue Teile (R-011).',
      alternativeOhneKi: 'Programmierung mit Makros und Vorlagen der CAM-Software: bleibt für Standardteile, ist bei neuen Geometrien deutlich langsamer.',
      wiedervorlage: '2027-11-30',
    },
  },
  'KI-004': {
    aufgabenart: 'erzeugt-inhalte', handlungsbefugnis: 'informiert', gedaechtnis: true, generativ: true, kritisch: false, fremdeInhalte: false, oeffentlich: false,
    zugriffe: 'Nur hochgeladene Dateien und Eingaben der Nutzenden, über private Konten.',
    stoppmoeglichkeit: 'Webzugriff im Firmennetz gesperrt, private Konten gelöscht (M-009).',
    modell: { anbieter: 'Anbieter eines öffentlichen Chatbots, ohne Vertrag', name: 'Kostenlose Version des öffentlichen Chatbots, Modell vom Dienst nicht angegeben', version: 'unbekannt; Dienst seit 22.09.2026 untersagt' },
    rueckfallweg: 'Ersetzt durch KI-001 mit Firmenkonto.',
    abhaengigkeiten: 'Keine mehr; Offerten entstehen mit KI-001 und Textbausteinen.',
    einsatzentscheid: {
      nutzen: 'Schnellere Offerttexte; heute mit KI-001 erreicht.',
      alternativeOhneKi: 'Textbausteine im ERP genügen für Standardofferten; für Entwürfe dient KI-001 mit Firmenkonto, der Dienst bleibt untersagt.',
      wiedervorlage: '2027-05-31',
    },
    ausserbetrieb: { ausloeser: 'Schatten-KI mit Kundenzeichnungen in der Inventarumfrage entdeckt und untersagt.', schritteErledigt: true, am: '2026-09-22' },
    aufbewahrenBis: '2036-09-30',
  },
};

const MITGEWIRKT: Record<string, string[]> = {
  'IA-001': ['P-003', 'P-002', 'P-005'],
  'IA-002': ['P-005', 'P-003', 'Disponentin'],
  'IA-003': ['P-004', 'P-002', 'CAM-Programmierer'],
  'IA-004': ['P-005', 'P-002', 'P-001'],
};

type W = NonNullable<ControlEintrag['wirksamkeit']>;
/** Wirksamkeit je Control (D-11): eigene Prüfung je Control, passend zur Checkliste des Audits AU-001 */
const au = (wie: string, ergebnis: string): W => ({ wie: `Internes Audit AU-001: ${wie}`, wann: '2027-01-12', wer: 'P-006', ergebnis });
const WIRKSAMKEIT: Record<string, W> = {
  'A.2.2': au('Interviews mit vier Mitarbeitenden in Produktion und Verkauf zur KI-Leitlinie', 'Leitlinie bekannt, Grundsätze zur Prüfung und zu Kundenzeichnungen richtig wiedergegeben'),
  'A.2.3': au('Abgleich der Leitlinie mit QM-Handbuch Kapitel 7, Datenschutzweisung und Verhaltenskodex', 'Verweise vollständig und aktuell'),
  // Erste Überprüfung der Leitlinie in der Managementbewertung, nach dem Audit (dort nicht prüfbar)
  'A.2.4': { wie: 'Überprüfung der KI-Leitlinie in der Managementbewertung MB-001', wann: '2027-01-26', wer: 'P-001', ergebnis: 'Leitlinie angemessen für Zweck und KI-Einsatz, keine Änderung; nächste Überprüfung bis 31.10.2027' },
  'A.3.2': au('Zuständigkeitsmatrix D-04 mit Stichprobe der Rollen menschliche Aufsicht und Folgenabschätzung', 'Rollen besetzt und den Personen bekannt'),
  'A.3.3': au('Meldeweg in D-04 und Interview mit Sabine Hofer', 'Meldeweg bekannt, vertrauliche Meldung möglich'),
  'A.4.2': au('KI-Inventar mit allen vier Systemen gegen Lizenzliste und Begehung abgeglichen', 'Inventar vollständig, keine weitere Schatten-KI'),
  'A.4.3': au('Datenarten von Copilot im Inventar gegen die Ordnerfreigaben geprüft', 'Lohn- und Personalordner und exportkontrollierte Zeichnungen ausgenommen'),
  'A.4.4': au('Produkt- und Versionsangaben der ERP-KI im Inventar gegen das ERP-Release vom 08.12.2026', 'Version nach dem Update nachgeführt'),
  'A.4.5': au('Ort der Verarbeitung von Copilot und CAM-KI im Inventar gegen Verträge und Installation', 'Schweiz und EU für Copilot, lokale Arbeitsplätze für die CAM-KI bestätigt'),
  'A.4.6': au('Personal und Schulungsbedarf der CAM-KI im Inventar und in D-17', 'Zwei geschulte CAM-Programmierer und Stellvertretung belegt'),
  'A.5.2': au('Verfahren D-08 mit den Kurzprüfungen IA-002 und IA-004', 'Schwellen richtig angewendet, Neubeurteilung von IA-002 nach dem ERP-Update'),
  'A.5.3': au('Ablage der Folgenabschätzungen IA-001 und IA-004', 'Freigegeben, datiert und abgelegt'),
  'A.5.4': au('Betroffene in den vollständigen Abschätzungen IA-003 und IA-004', 'Direkt und indirekt Betroffene einschliesslich Patientinnen und Patienten beurteilt'),
  'A.5.5': au('Abschnitt Gesellschaft in IA-003 und IA-004', 'Gesellschaftliche Wirkung begründet als gering beurteilt'),
  'A.6.2.2': au('Anforderungen an die CAM-KI im Abnahmeprotokoll N-008', 'Anforderungen an Spannmittelerkennung und Simulation vor dem Kauf festgehalten'),
  'A.6.2.4': au('Abnahmeprotokolle N-008 der CAM-KI (10 typische Teile), der ERP-KI (Testphase 4 Wochen) und von Copilot (15 eigene Fälle, 5 Missbrauchsfälle)', 'Abnahme vor dem Einsatz für alle drei Systeme belegt'),
  'A.6.2.6': au('Monatskontrolle der Disposition (N-009) bei der ERP-KI', 'Die Monatskontrolle hat die Änderung nach dem ERP-Update erkannt; Beobachtung F-002, weil die Release Notes noch nicht ausgewertet werden (M-014)'),
  'A.6.2.7': au('Arbeitsanweisung der CAM-KI (N-010) am Arbeitsplatz', 'Anweisung vorhanden und den Programmierern bekannt'),
  'A.6.2.8': au('Audit-Log von Copilot und Programmversionen der CAM-KI (N-011)', 'Protokolle und Vermerk «KI-Vorschlag» vorhanden'),
  'A.7.3': au('Herkunft und Rechte der Eingabedaten der CAM-KI in D-13 (N-019)', 'Kundenmodelle nur mit Geheimhaltungsvereinbarung verwendet'),
  'A.7.4': au('Qualitätskriterien der Stammdaten der ERP-KI in D-13 und Monatskontrolle', 'Stammdaten vollständig, Abweichung unter 10 %'),
  'A.7.5': au('Verknüpfung von Zeichnungsindex und Programmversion in drei Fertigungsaufträgen für Medizinteile (N-011)', 'Herkunft der Eingabedaten nachvollziehbar'),
  'A.8.2': au('Arbeitsanweisungen und Selbstauskunft N-016 zum Einsatz von Copilot', 'Nutzende und Grosskunde über den KI-Einsatz informiert'),
  'A.8.3': au('Meldekanal für Kunden in D-14 und Angabe in der Selbstauskunft N-016', 'Adresse veröffentlicht, Fristen festgelegt'),
  'A.8.4': au('Vorfallablauf in D-14 und Information der Kunden zum Vorfall mit dem kostenlosen Chatbot KI-004 vom September 2026', 'Die vier betroffenen Kunden wurden informiert, die Exportkontrolle abgeklärt'),
  'A.8.5': au('Liste der Informationspflichten N-020 für die Medivo Medtech AG', 'Fristen, Empfänger und Zuständigkeit festgelegt'),
  'A.9.2': { wie: 'Abgleich der Schulungsliste mit Personal- und Einsatzliste; Proxy-Auswertung auf kostenlose KI-Dienste seit dem Vorfall mit KI-004 vom September 2026', wann: '2027-01-20', wer: 'P-002', ergebnis: '45 von 45 Personen nach der Nachschulung (F-001); keine Nutzung kostenloser KI-Dienste' },
  'A.9.4': au('Zweck von Copilot und ERP-KI im Inventar gegen die Vorführung', 'Nutzung im festgelegten Zweck'),
  'A.10.2': au('Verantwortungsmatrix in D-16 für den ERP-Anbieter', 'Verantwortung für Betrieb, Updates und Daten je Lieferant festgelegt'),
  'A.10.4': au('Kundenanforderungen der Medivo Medtech AG in D-01 und Selbstauskunft N-016', 'Anforderungen erfasst und beantwortet'),
};

const pf = (werte: JaNeinOffen[]): Record<string, JaNeinOffen> => Object.fromEntries(werte.map((w, i) => [`PF-${16 + i}`, w]));
const LIEFERANTEN: Record<string, [JaNeinOffen[], KlauselStand[]]> = {
  'L-001': [['ja', 'ja', 'ja', 'ja', 'offen', 'ja'], ['ja', 'ja', 'nicht-noetig']],
  'L-002': [['ja', 'ja', 'ja', 'ja', 'ja', 'nein'], ['offen', 'ja', 'nicht-noetig']],
  'L-003': [['ja', 'ja', 'ja', 'ja', 'ja', 'ja'], ['ja', 'nicht-noetig', 'nicht-noetig']],
};

export function rc2Praezision(p: Projekt): void {
  const o = p.organisation;
  o.risikobereitschaft = {
    nie: [
      'Kundenzeichnungen, Stücklisten oder Personendaten gehen in KI-Dienste ohne Firmenkonto und Vertrag.',
      'KI-Ergebnisse gehen ungeprüft an Kunden oder in die Maschine.',
    ],
    nurGl: [
      'Neue KI-Werkzeuge mit Kundendaten oder mit Bezug zu Medizinteilen.',
      'Restrisiken über der Akzeptanzgrenze.',
    ],
    aimsAllein: [
      'Neue KI-Werkzeuge mit tiefem Risiko, ohne Kundendaten und ohne Personendaten.',
      'Restrisiken bis zur Akzeptanzgrenze (Risikowert 3).',
    ],
  };
  const EIGNER = 'Eigner/in des Systems';
  o.entscheidungsrechte = [
    { entscheid: 'einfuehren', wer: { tief: 'P-002', mittel: 'P-001', hoch: 'P-001' } },
    { entscheid: 'restrisiko', wer: { tief: 'P-002', mittel: 'P-001', hoch: 'P-001' } },
    { entscheid: 'ausnahme', wer: { tief: 'P-001', mittel: 'P-001', hoch: 'P-001' } },
    { entscheid: 'stoppen', wer: { tief: EIGNER, mittel: EIGNER, hoch: EIGNER } },
    { entscheid: 'ausserbetrieb', wer: { tief: EIGNER, mittel: 'P-002', hoch: 'P-001' } },
  ];
  o.nichtGemessen = [
    { was: 'Zeitgewinn durch Copilot', begruendung: 'Nur mit einer Zeiterfassung je Offerte messbar; wir fragen die Nutzenden einmal im Jahr vor der Managementbewertung.' },
    { was: 'Qualität der Bestellvorschläge je Artikel', begruendung: 'Die Monatskontrolle misst die Abweichung über alle Artikel; eine Messung je Artikel lohnt sich bei rund 600 aktiven Artikeln nicht.' },
  ];

  for (const s of p.kiSysteme) Object.assign(s, KERN[s.id]!);
  for (const f of p.folgenabschaetzungen) f.mitgewirkt = MITGEWIRKT[f.id];
  // Ziel Z-002 gilt für die geprüften Ergebnisse von KI-001 bis KI-003 (KI-003 mit sensibler Nutzung)
  p.ziele.find((z) => z.id === 'Z-002')!.kiSysteme = ['KI-001', 'KI-002', 'KI-003'];

  for (const l of p.lieferanten) {
    const [fragen, klauseln] = LIEFERANTEN[l.id]!;
    Object.assign(l.pruefpunkte, pf(fragen));
    Object.assign(l.vertragsklauseln!, { 'VK-13': klauseln[0], 'VK-14': klauseln[1], 'VK-15': klauseln[2] });
  }

  for (const c of p.controls) {
    if (c.anwendbar !== 'ja' || (c.status !== 'umgesetzt' && c.status !== 'wirksam')) continue;
    const w = WIRKSAMKEIT[c.id];
    if (!w) throw new Error(`Wirksamkeit fehlt: ${c.id}`);
    c.wirksamkeit = w;
  }
  // Checkliste AU-001: Stand der SoA zum Audit (D-11 1.0); nachgeführt mit D-11 1.1 nach Audit und Managementbewertung
  soaStandZumAudit(p, 'AU-001', { 'A.2.4': 'teilweise', 'A.6.2.5': 'umgesetzt', 'A.9.3': 'umgesetzt' });
}
