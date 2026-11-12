// Beispiel 2: Beispiel Präzisionsteile GmbH. Angaben in den Feldern der Konsolidierung (früher teils unter
// meta.gefuehrt.antworten). Schlank: ohne ISMS, ohne AI-Act-Modul.
import type { KlauselStand, NutzenSchadenZiel, Projekt, Vertragsklausel } from '../../model/typen.ts';
import { VERTRAGSKLAUSELN } from '../../model/typen.ts';
import { dokumentenHistorie, gapAnalyse } from './muster-4.mts';

const vk = (werte: KlauselStand[]): Partial<Record<Vertragsklausel, KlauselStand>> => Object.fromEntries(VERTRAGSKLAUSELN.map((id, i) => [id, werte[i]!]));

export function konsolidierungPraezision(p: Projekt): void {
  const o = p.organisation;
  o.geltungsbereich.keineAusschluesseBestaetigt = true;
  o.meldeweg = {
    kanaele: ['vorgesetzte', 'aims', 'postfach'],
    kanal: 'Vorgesetzte Person, AIMS-Verantwortliche oder Postfach qualitaet@praezisionsteile.example',
    ausweichstelle: 'P-001',
    vertraulich: true,
    fristTage: 10,
    fristErgebnisTage: 30,
    eskalation: 'An den Geschäftsführer, wenn eine Meldung nicht innert Frist bearbeitet wird oder Kundendaten betroffen sind.',
    bekanntmachung: 'Einführung neuer Mitarbeitender, Merkblatt am Anschlagbrett, Richtlinie KI-Nutzung (D-15)',
  };
  o.meldekanalExtern = {
    adresse: 'qualitaet@praezisionsteile.example',
    ort: 'Website (Seite Kontakt) und Qualitätssicherungsvereinbarungen',
    bearbeitung: 'P-002',
    fristTage: 10,
    fristAntwortTage: 30,
    fristKundenStunden: 72,
    vorfallVerfahren: 'Reklamationsprozess QM (QM-Handbuch Kapitel 8)',
  };
  o.meldestelle = 'AIMS-Verantwortliche (qualitaet@praezisionsteile.example)';
  // Keine Selbstfreigabe ab hohem Risiko (D-04): Ist der Geschäftsführer selbst betroffen, entscheidet die Gesellschafterversammlung
  o.naechsthoehereStelle = 'Gesellschafterversammlung';
  o.gremien = [
    { name: 'Geschäftsleitungssitzung', themen: 'Freigaben (Leitlinie, Geltungsbereich, Restrisiken, Folgenabschätzungen), neue KI-Werkzeuge mit hohem Risiko, Managementbewertung', rhythmus: 'alle 14 Tage während des Aufbaus, danach quartalsweise; Managementbewertung jährlich', vorsitz: 'P-001' },
    { name: 'Qualitätsbesprechung', themen: 'Stand der Massnahmen, Meldungen, Stichproben der KI-Ergebnisse', rhythmus: 'monatlich', vorsitz: 'P-002' },
  ];
  o.projektauftrag = {
    ziel: 'Nachweis der KI-Steuerung für das Lieferantenaudit der Medivo Medtech AG und Zertifizierung nach ISO/IEC 42001 bis 30.06.2027 mit schlankem Aufbau; Stage-1-Bereitschaft nach rund 150 Tagen.',
    nutzen: 'Anforderung des Grosskunden erfüllen, alle genutzten KI-Werkzeuge erfassen und nicht freigegebene Nutzung beenden, klare Regeln für Kundenzeichnungen.',
    aufwandPt: 55,
    budget: 38000,
    pensumProzent: 40,
    sponsor: 'P-001',
    meilensteine: [
      { was: 'Projektauftrag, Gap-Analyse und Kurzfassung der Dokumentenlenkung', termin: '2026-09-08' },
      { was: 'Kontext, Geltungsbereich, KI-Leitlinie und Rollen', termin: '2026-10-06' },
      { was: 'KI-Inventar vollständig, Rolle je KI-System', termin: '2026-10-20' },
      { was: 'Risikomethode und Verfahren Folgenabschätzung', termin: '2026-11-03' },
      { was: 'Folgenabschätzungen freigegeben, Zertifizierungsstelle gewählt', termin: '2026-11-17' },
      { was: 'Behandlungsplan, Restrisiken und Erklärung zur Anwendbarkeit', termin: '2026-12-01' },
      { was: 'Richtlinien, Verfahren, Schulung und Ziele', termin: '2026-12-22' },
      { was: 'Internes Audit', termin: '2027-01-12' },
      { was: 'Managementbewertung', termin: '2027-01-26' },
      { was: 'Stage-1-Bereitschaft', termin: '2027-01-29' },
      { was: 'Stage 1', termin: '2027-02-23' },
    ],
    risiken: 'Wenig Zeit neben dem Tagesgeschäft, Abhängigkeit vom IT-Partner, Auskünfte der Lieferanten.',
    freigabe: { von: 'P-001', am: '2026-09-01' },
    glTraktandum: 'quartalsweise',
    // Projektteam: Leitung, Sponsor und Fachpersonen; die externe Auditorin gehört nicht dazu
    team: ['P-001', 'P-002', 'P-003', 'P-004', 'P-005'],
    geltungsbereich: 'Werk Mittelland mit Verkauf, Arbeitsvorbereitung, Disposition, Qualität und Verwaltung; alle eingesetzten KI-Systeme einschliesslich nicht freigegebener Werkzeuge, die die Erhebung findet; keine eigene Entwicklung.',
  };
  o.protokollierung = { inhalt: ['nutzende', 'aenderungen', 'fehler'], aufbewahrungMonate: 6, auswertung: 'halbjaehrlich' };
  o.dokumentenlenkung = {
    ablage: 'Laufwerk Q: > AIMS, Ordner nach Dokumentnummer',
    namensregel: 'Dokument-ID und Titel, z. B. D-07_Risikoregister',
    freigabe: 'geschaeftsleitung',
    aufbewahrungJahre: 10,
    klassifikation: 'intern',
    extern: 'Normen und Kundenvorgaben im Ordner 99_Extern mit Stand-Datum.',
  };
  o.leitlinie.abgleich = { informationssicherheit: 'nicht-vorhanden', datenschutz: 'verweis', qualitaet: 'verweis', personal: 'keine', verhaltenskodex: 'verweis' };
  o.leitlinie.abgleichNotiz = 'Abgleich am 29.09.2026 mit QM-Handbuch, Datenschutzweisung, Personalreglement und Verhaltenskodex (Geheimhaltung). Eine eigene Informationssicherheitsleitlinie besteht nicht; den Schutz der Daten in KI-Systemen regeln diese Leitlinie und die Richtlinie KI-Nutzung (D-15). Das Personalreglement braucht keine Anpassung, weil die KI-Leitlinie und die Richtlinie KI-Nutzung für alle Mitarbeitenden gelten und keine KI zur Überwachung am Arbeitsplatz eingesetzt wird.';

  for (const r of p.rollen) if (['konformitaet', 'berichterstattung', 'risikomanagement'].includes(r.bereich)) r.stellvertretung = 'P-001';
  p.rollen.push(
    { id: 'RO-008', bereich: 'datenschutz', verantwortlich: 'P-002', rechenschaft: 'P-001', konsultiert: ['P-003'], informiert: [] },
    { id: 'RO-009', bereich: 'informationssicherheit', verantwortlich: 'P-003', rechenschaft: 'P-001', konsultiert: ['P-002'], informiert: [] },
    { id: 'RO-010', bereich: 'dokumentenlenkung', verantwortlich: 'P-002', rechenschaft: 'P-001', konsultiert: [], informiert: [] },
    { id: 'RO-011', bereich: 'folgenabschaetzung', verantwortlich: 'P-002', rechenschaft: 'P-001', konsultiert: ['P-004', 'P-005'], informiert: [] },
    { id: 'RO-012', bereich: 'daten', verantwortlich: 'P-004', rechenschaft: 'P-002', konsultiert: ['P-003'], informiert: [] },
    { id: 'RO-013', bereich: 'recht', verantwortlich: 'P-001', rechenschaft: 'P-001', konsultiert: ['P-002'], informiert: [] },
    { id: 'RO-014', bereich: 'schulung', verantwortlich: 'P-002', rechenschaft: 'P-001', konsultiert: [], informiert: ['P-005'] },
    // Beschaffung, Abnahme und Einführung eingekaufter KI-Systeme (Phasenfreigaben in D-12); keine eigene Modellentwicklung
    { id: 'RO-015', bereich: 'entwicklung', verantwortlich: 'P-004', rechenschaft: 'P-001', konsultiert: ['P-002', 'P-003'], informiert: ['P-005'] },
    { id: 'RO-016', bereich: 'internes-audit', verantwortlich: 'P-006', rechenschaft: 'P-001', konsultiert: ['P-002'], informiert: [] },
  );
  // Stellvertretung je Rolle (D-04): wer die verantwortliche Person bei Abwesenheit vertritt; das interne Audit vertritt
  // eine zweite Auditorin derselben Firma (keine Person im Projekt), deshalb ohne Eintrag
  const vertretung: Record<string, string> = {
    'RO-004': 'P-002', 'RO-005': 'P-002', 'RO-006': 'P-005', 'RO-007': 'P-002', 'RO-008': 'P-001', 'RO-009': 'P-002', 'RO-010': 'P-001',
    'RO-011': 'P-001', 'RO-012': 'P-005', 'RO-013': 'P-002', 'RO-014': 'P-001', 'RO-015': 'P-005',
  };
  for (const r of p.rollen) if (vertretung[r.id]) r.stellvertretung = vertretung[r.id];

  p.gapAnalyse = gapAnalyse(
    { k4: 'fehlt', k5: 'fehlt', k6: 'begonnen', inventar: 'fehlt', k7: 'begonnen', k8: 'fehlt', k9: 'weitgehend', k10: 'weitgehend' },
    '2026-09-01',
    { 'A.2': 0, 'A.3': 1, 'A.4': 1, 'A.5': 0, 'A.6': 0, 'A.7': 1, 'A.8': 0, 'A.9': 1, 'A.10': 1 },
    {
      ...GAP_IST_PRAEZISION,
      'K-7.5': 'Dokumentenlenkung nach QM-Handbuch Kapitel 4', 'K-9.2': 'Internes Audit QM jährlich', 'K-10.2': 'Korrekturmassnahmen nach QM-Verfahren',
      'A.6.1.2': 'Keine eigene Entwicklung; voraussichtlich nicht anwendbar', 'A.6.1.3': 'Keine eigene Entwicklung; voraussichtlich nicht anwendbar', 'A.6.2.3': 'Keine eigene Entwicklung; voraussichtlich nicht anwendbar',
      'A.7.2': 'Kein eigenes Training; voraussichtlich nicht anwendbar', 'A.7.6': 'Kein eigenes Training; voraussichtlich nicht anwendbar',
    },
    ['A.6.1.2', 'A.6.1.3', 'A.6.2.3', 'A.7.2', 'A.7.6'],
  );

  const info: Record<string, [string | null, string, string]> = {
    'KI-001': ['2026-11-17', 'Audit-Log im M365-Admin-Center 6 Monate.', 'Richtlinie KI-Nutzung (D-15) und Merkblatt.'],
    'KI-002': ['2026-11-17', 'Änderungsprotokoll des ERP mit Release Notes; Bestellvorschläge und Übersteuerungen im ERP 2 Jahre.', 'Hinweis in der Arbeitsanweisung Disposition, dass Bestellvorschläge geprüft werden.'],
    'KI-003': ['2026-11-17', 'Programmstände mit Freigabe im CAM-System, Aufbewahrung 10 Jahre (Medizinteile).', 'Arbeitsanweisung CAM mit Freigaberegel für Medizinteile.'],
    'KI-004': ['2026-11-17', 'Keine Protokolle (Dienst untersagt).', 'Nutzung untersagt; Hinweis in D-15.'],
  };
  // Angaben der Freigabeliste (D-10): Auflagen, höchste Datenklasse, Begründung
  const freigabeliste: Record<string, [string, 'intern' | 'vertraulich', string]> = {
    'KI-001': ['Nur mit Firmenkonto; Ergebnisse vor der Verwendung prüfen; Lohn- und Personalordner und Zeichnungen mit Exportkontrollvermerk von der Suche ausgenommen; Lizenzen erst nach der Einführung in die Regeln zur KI-Nutzung zuteilen.', 'vertraulich', 'Kurzprüfung IA-001 ohne Schwelle; Lieferantenprüfung vom 12.11.2026: Datenhaltung in der Schweiz und der EU, keine Trainingsnutzung (L-001). Freigabe durch den Geschäftsführer, weil Copilot Kundendaten verarbeitet und Risiken mit Wert 6 hat (R-003, R-012, R-013).'],
    'KI-002': ['Bestellvorschläge nur als Vorschlag; Prüfung durch die Disponentin vor jeder Bestellung.', 'intern', 'Kurzprüfung IA-002 ohne Schwelle; Monatskontrolle der Abweichungen (M-013). Freigabe durch den Geschäftsführer bei mittlerem Risiko (R-005, R-006).'],
    'KI-003': ['Jedes Programm simulieren und im Einzelsatz einfahren; Freigabe durch eine zweite Person bei Medizinteilen (M-015).', 'vertraulich', 'Vollständige Abschätzung IA-003: verbleibender Schaden mit Ausmass 3 (unerkannter Formfehler an einem Implantatteil), daher nur eingeschränkte Nutzung mit Auflagen; Freigabe durch den Geschäftsführer bei hohem Risiko (R-007). Lokaler Betrieb ohne Datenübermittlung.'],
    'KI-004': ['Nutzung untersagt.', 'intern', 'Sofortmassnahme am 22.09.2026 (M-009), bestätigt durch die vollständige Abschätzung IA-004: Kundenzeichnungen ohne Vertrag in einem Dienst mit Verarbeitung in den USA; ersetzt durch KI-001.'],
  };
  for (const s of p.kiSysteme) {
    const [frei, prot, nutzer] = info[s.id]!;
    [s.auflagen, s.datenklasse, s.freigabeBegruendung] = freigabeliste[s.id]!;
    s.aiAct.gpai = false;
    // Freigabe der Nutzung durch den Geschäftsführer: alle drei Systeme haben mindestens mittleres Risiko oder eine volle
    // Folgenabschätzung (Entscheidungsrechte D-04); Untersagung ebenfalls durch den Geschäftsführer
    if (frei) s.freigabe = { von: 'P-001', am: frei };
    s.protokollierung = prot;
    s.nutzerinformation = nutzer;
    s.aufsicht = AUFSICHT_PRAEZISION[s.id];
  }
  const sys = (id: string) => p.kiSysteme.find((s) => s.id === id)!;
  sys('KI-001').aenderungsregel = 'Neue Copilot-Funktionen kündigt der Hersteller im Message Center an; die IT prüft sie monatlich und schaltet neue Funktionen erst nach Rücksprache mit der AIMS-Verantwortlichen frei. Wesentlich ist eine Änderung, wenn neue Datenquellen oder Agenten dazukommen; dann folgen eine neue Kurzprüfung (D-09) und eine Neubeurteilung von R-003.';
  sys('KI-002').aenderungsregel = 'Release Notes jedes ERP-Updates vor der Installation auswerten (M-014); geänderte Berechnungen der Bestellvorschläge gelten als wesentlich: Neubeurteilung von R-005, R-006 und der Kurzprüfung IA-002, Neuprüfung des Lieferanten L-002 (D-16), Information der Disposition.';
  sys('KI-003').aenderungsregel = 'Neue Versionen der CAM-Software nur nach Abnahmetest mit 10 typischen Teilen und Freigabe durch den Leiter Arbeitsvorbereitung; ein Versionswechsel der KI-Funktion oder neue Teilefamilien für die Medizintechnik führen zur Neubeurteilung von IA-003 und R-007.';
  // Durchführung durch die Eigner/in des Systems, Freigabe durch den Geschäftsführer (D-08)
  // Alle acht Ziele mit Ausmass (Fairness und Umwelt gering, Erklärbarkeit mittel), damit kein Abschnitt leer bleibt
  const ausmassIa004: Record<string, number> = { rechenschaft: 3, transparenz: 3, fairness: 1, datenschutz: 3, zuverlaessigkeit: 2, sicherheit: 3, erklaerbarkeit: 2, umwelt: 1 };
  // CAM-KI: grösster verbleibender Schaden bei der Sicherheit (Implantatteile), übrige Ziele gering
  const ausmassIa003: Record<string, number> = { rechenschaft: 1, transparenz: 1, fairness: 1, datenschutz: 1, zuverlaessigkeit: 2, sicherheit: 3, erklaerbarkeit: 2, umwelt: 1 };
  for (const f of p.folgenabschaetzungen) {
    f.triage.durch = p.kiSysteme.find((s) => s.id === f.kiSystem)!.eigner;
    if (f.id === 'IA-004') for (const [ziel, wert] of Object.entries(ausmassIa004)) f.nutzenSchaden[ziel as NutzenSchadenZiel]!.ausmass = wert;
    if (f.id === 'IA-003') for (const [ziel, wert] of Object.entries(ausmassIa003)) f.nutzenSchaden[ziel as NutzenSchadenZiel]!.ausmass = wert;
    f.triage.am = '2026-11-05';
    if (!f.verknuepfteDsfa) f.verknuepfteDsfa = 'keine (keine DSFA nötig)';
    if (f.kiSystem === 'KI-004') f.gesellschaft = 'Keine Wirkung über die Firma und ihre Kunden hinaus; Vertrauen der Kunden in den Schutz ihrer Zeichnungen betroffen.';
  }

  const ziele: Record<string, [string, string, 'in-arbeit' | 'erreicht', string, string]> = {
    'Z-001': ['Grundsatz 2 (Kundenzeichnungen nur in freigegebene Systeme)', 'Umfrage und Proxy-Auswertung halbjährlich, Sperre öffentlicher Chatbots', 'erreicht', 'P-003', 'Geschäftsführer'],
    'Z-002': ['Grundsatz 1 (der Mensch prüft jedes Ergebnis)', 'Stichproben durch AVOR und Verkauf, Rückmeldung an die Mitarbeitenden', 'in-arbeit', 'P-004', 'Geschäftsführer'],
    'Z-003': ['Grundsätze 2, 3 und 5 (Daten nur in freigegebene Systeme, neue Werkzeuge beantragen, Fehler und Bedenken melden)', 'Einführung für alle, auch Temporärmitarbeitende; jährliche Auffrischung', 'erreicht', 'P-002', 'Geschäftsführer'],
  };
  const soll: Record<string, ('ja' | 'teilweise' | 'nein')[]> = { 'Z-001': ['ja'], 'Z-002': ['teilweise'], 'Z-003': ['ja', 'ja'] };
  for (const z of p.ziele) {
    const [bezug, was, status, misst, an] = ziele[z.id]!;
    Object.assign(z, { bezugLeitlinie: bezug, massnahmen: was, status, werMisst: misst, auswertungWann: 'nach jeder Messung', werWertetAus: 'P-002', empfaenger: an });
    z.messungen.forEach((m, i) => (m.sollErreicht = soll[z.id]![i]));
  }

  Object.assign(p.audits.find((a) => a.id === 'AU-001')!, {
    ziel: 'Bereitschaft für Stage 1 prüfen und Wirksamkeit des AIMS bestätigen',
    ort: 'Werk Mittelland',
    methode: 'Interviews, Dokumentprüfung, Stichproben von CAM-Programmen und Offerten, Vorführung KI-001 bis KI-003',
    berichtAn: 'Geschäftsführer, AIMS-Verantwortliche',
    umfangControls: [],
    auditierte: 'Martin Zürcher (Geschäftsführer), Andrea Baumann (AIMS), Reto Schneider (IT), Jonas Kälin (AVOR), Sabine Hofer (Verkauf)',
  });
  Object.assign(p.audits.find((a) => a.id === 'AU-002')!, { berichtAn: 'Geschäftsführer, AIMS-Verantwortliche', methode: 'nach Auditplan der Zertifizierungsstelle' });

  const fs: Record<string, { kiSystem?: string; bereich: string; methode?: string; aehnlich?: string; risiko?: boolean }> = {
    'F-001': { bereich: 'Produktion, Schulung', methode: '5 Warum', aehnlich: 'Alle Eintritte seit 2026 mit der Schulungsliste abgeglichen; keine weiteren Lücken.', risiko: true },
    'F-002': { kiSystem: 'KI-002', bereich: 'Disposition', methode: '5 Warum', aehnlich: 'CAM-System und M365 geprüft: Updates werden vor der Installation angekündigt.', risiko: true },
    'F-003': { bereich: 'AIMS, Jahresplan' },
    'F-004': { bereich: 'Verkauf', methode: '5 Warum', aehnlich: 'Prüfregel für CAM-Programme und Bestellvorschläge verglichen: dort einheitlich beschrieben.', risiko: true },
    'F-005': { kiSystem: 'KI-004', bereich: 'Verkauf', methode: '5 Warum', aehnlich: 'Inventarumfrage in allen Bereichen und Auswertung der Spesen: keine weitere Nutzung kostenloser KI-Dienste mit Firmendaten.', risiko: true },
  };
  for (const f of p.feststellungen) {
    const d = fs[f.id]!;
    f.datum = f.datum ?? '2027-01-12';
    if (d.kiSystem) f.kiSystem = d.kiSystem;
    f.bereich = d.bereich;
    if (d.methode) f.ursacheMethode = d.methode;
    if (d.aehnlich) f.aehnlicheFaelle = d.aehnlich;
    if (d.risiko !== undefined) f.risikoAngepasst = d.risiko;
  }

  Object.assign(p.managementbewertungen[0]!, {
    ort: 'Sitzungszimmer Werk Mittelland',
    leitung: 'P-001',
    zeitraum: { von: '2026-09-01', bis: '2027-01-22' },
    gesamtbeurteilung: {
      geeignet: { urteil: 'ja', begruendung: 'Das AIMS deckt die drei genutzten KI-Systeme und den untersagten Chatbot ab und erfüllt die Anforderung des Grosskunden.' },
      angemessen: { urteil: 'ja', begruendung: 'Schlanker Aufbau mit QM-Prozessen; Aufwand im Rahmen des Budgets.' },
      wirksam: { urteil: 'offen', begruendung: 'Wirksamkeit bis auf Ziel Z-002 belegt; Z-001 und Z-003 erreicht, keine Kundendaten mehr in nicht freigegebenen Diensten. Z-002 verfehlt, die Prüfregel für Offerten wird vereinheitlicht (F-004, M-022). Nichtkonformität F-001 korrigiert, Wirksamkeit bis 31.03.2027 bestätigen. Abschliessende Beurteilung nach der Messung von Z-002 im März 2027.' },
    },
    entscheideListe: [
      { art: 'ressourcen', text: 'Copilot-Lizenzen auf 15 erhöhen', verantwortlich: 'P-003', termin: '2027-03-31', massnahme: 'M-020' },
      { art: 'ressourcen', text: 'Pensum der AIMS-Verantwortlichen nach Stage 1 auf 20 %', verantwortlich: 'P-001', termin: '2027-03-31', massnahme: 'M-021' },
      { art: 'aenderung', text: 'KI-Leitlinie Version 1.0 bleibt unverändert in Kraft; nächste Überprüfung bis 31.10.2027', verantwortlich: 'P-002', termin: '2027-10-31' },
      { art: 'verbesserung', text: 'Prüfregel für Offerten vereinheitlichen: jede Offerte mit KI-Text mit Prüfvermerk, ab CHF 20 000 im Vier-Augen-Prinzip (F-004)', verantwortlich: 'P-005', termin: '2027-03-31', massnahme: 'M-022' },
      { art: 'verbesserung', text: 'Jährliche Überprüfung der AI-Act-Betroffenheit im Jahresplan, nächste bis 30.09.2027; juristische Prüfung, falls KI-Ergebnisse über Offerttexte und Liefertermine hinaus an Kunden in der EU gehen', verantwortlich: 'P-002', termin: '2027-09-30' },
    ],
  });

  const klauseln: Record<string, KlauselStand[]> = {
    'L-001': ['ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja'],
    'L-002': ['ja', 'ja', 'ja', 'offen', 'nein', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja'],
    'L-003': ['ja', 'nicht-noetig', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'offen', 'ja', 'ja'],
  };
  for (const l of p.lieferanten) {
    l.vertragsklauseln = vk(klauseln[l.id]!);
    // Prüfung vor der Freigabe der Systeme am 17.11.2026; L-002 nach dem ERP-Update vom 08.12.2026 erneut (D-16: nach einem Modellwechsel)
    l.geprueft = { von: 'P-002', am: l.id === 'L-002' ? '2027-01-08' : '2026-11-12' };
  }

  for (const d of p.dokumente) {
    if (d.id === 'D-03') d.klassifikation = 'öffentlich';
    else if (d.id === 'D-09') d.klassifikation = 'vertraulich';
    d.aufbewahrung = d.id.startsWith('D-09') ? '10 Jahre nach Ausserbetriebnahme des Systems' : '10 Jahre nach Ersatz';
    if (d.id.startsWith('D-09-')) d.klassifikation = 'vertraulich';
  }
  dokumentenHistorie(p, HISTORIE_PRAEZISION, ['P-003', 'P-004']);
  // In der Managementbewertung MB-001 ohne Änderung bestätigt (Verweise auf die inzwischen freigegebenen Dokumente gelten)
  for (const id of ['D-02', 'D-03', 'D-06', 'D-08', 'D-12', 'D-14', 'D-15']) p.dokumente.find((d) => d.id === id)!.bestaetigt = { von: 'P-001', am: '2027-01-26' };

  // Risiken: Datum der letzten Beurteilung (Risikoworkshop November 2026, Neubeurteilungen danach)
  const beurteilt: Record<string, string> = { 'R-004': '2027-01-26', 'R-005': '2027-01-08', 'R-006': '2027-01-08', 'R-009': '2027-01-20' };
  for (const r of p.risiken) r.beurteiltAm = beurteilt[r.id] ?? '2026-11-17';
  // Erfassung: R-001 und R-002 mit den Sofortmassnahmen zur Schatten-KI, die übrigen im Risikoworkshop
  for (const r of p.risiken) r.erfasstAm = ['R-001', 'R-002'].includes(r.id) ? '2026-09-22' : '2026-11-03';
  // Massnahmen: Erfassung in der Reihenfolge der IDs (Gap-Analyse, Sofortmassnahmen, Risikoworkshop, Änderungen, Audit, Bewertung)
  const erfasst: Record<string, string> = {
    'M-009': '2026-09-22', 'M-010': '2026-09-22', 'M-017': '2027-01-05', 'M-018': '2027-01-12', 'M-019': '2027-01-12', 'M-020': '2027-01-26', 'M-021': '2027-01-26', 'M-022': '2027-01-26',
  };
  for (const m of p.massnahmen) m.erfasstAm = erfasst[m.id] ?? (m.herkunft.art === 'pruefung' ? '2026-09-01' : '2026-11-03');
  p.massnahmen.sort((x, y) => x.id.localeCompare(y.id, 'de', { numeric: true }));

  // Bewusstsein (D-17) mit Datum und Nachweis; Dokumente externer Herkunft (D-26)
  o.bewusstsein = [
    { thema: 'KI-Leitlinie', inhalt: 'Grundsätze für KI und Ablage der Leitlinie (D-03)', zielgruppe: 'alle Mitarbeitenden', kanal: 'Teamsitzung, Anschlagbrett', datum: '2026-10-12', nachweis: 'Teilnehmerlisten der Teamsitzungen (KO-001)' },
    { thema: 'Nutzungsrichtlinie', inhalt: 'Freigegebene Werkzeuge, was nie in KI-Werkzeuge gehört, neue Werkzeuge beantragen (D-15)', zielgruppe: 'alle Mitarbeitenden', kanal: 'Einführung 30 Minuten mit Unterschrift', datum: '2026-12-18', nachweis: 'Schulungsliste mit Unterschriften, N-014' },
    { thema: 'Eigener Beitrag', inhalt: 'Regeln einhalten, Ergebnisse prüfen, Probleme melden', zielgruppe: 'alle Mitarbeitenden', kanal: 'Einführung 30 Minuten', datum: '2026-12-18', nachweis: 'Schulungsliste, N-014' },
    { thema: 'Folgen bei Abweichung', inhalt: 'Folgen für Kunden, Betroffene und das Unternehmen sowie arbeitsrechtliche Folgen', zielgruppe: 'alle Mitarbeitenden', kanal: 'Einführung, Merkblatt', datum: '2026-12-18', nachweis: 'Merkblatt KI-Nutzung, N-007' },
    { thema: 'Meldewege', inhalt: 'Wohin Bedenken, Fehler und Vorfälle gehen (D-04, D-14)', zielgruppe: 'alle Mitarbeitenden', kanal: 'Merkblatt am Anschlagbrett', datum: '2026-12-18', nachweis: 'Aushang Merkblatt, N-013' },
    { thema: 'Nachschulung Temporärmitarbeitende', inhalt: 'Einführung in die KI-Regeln nach Feststellung F-001', zielgruppe: 'vier Temporärmitarbeitende', kanal: 'Einführung 30 Minuten mit Unterschrift', datum: '2027-01-19', nachweis: 'Schulungsliste, N-014' },
  ];
  const EXTERN = 'Laufwerk Q: > AIMS > 99_Extern';
  o.dokumentenlenkung!.externeDokumente = [
    { dokument: 'ISO/IEC 42001', herausgeber: 'ISO, SNV', stand: '2023', ablage: `${EXTERN} > Normen`, zustaendig: 'P-002', naechstePruefung: '2027-09-30' },
    { dokument: 'ISO 9001 und ISO 13485', herausgeber: 'ISO, SNV', stand: 'ISO 9001:2015, ISO 13485:2016', ablage: `${EXTERN} > Normen`, zustaendig: 'P-002', naechstePruefung: '2027-09-30' },
    { dokument: 'EU AI Act, Verordnung (EU) 2024/1689', herausgeber: 'EUR-Lex', stand: 'konsolidierte Fassung vom 27.07.2026 mit Berichtigung vom 29.09.2026', ablage: `${EXTERN} > Recht`, zustaendig: 'P-002', naechstePruefung: '2027-09-30' },
    { dokument: 'Datenschutzgesetz (DSG)', herausgeber: 'Bund', stand: 'in Kraft seit 1.9.2023', ablage: `${EXTERN} > Recht`, zustaendig: 'P-002', naechstePruefung: '2027-09-30' },
    { dokument: 'Güterkontrollverordnung', herausgeber: 'Bund', stand: 'Stand gemäss Fedlex', ablage: `${EXTERN} > Recht`, zustaendig: 'P-001', naechstePruefung: '2027-09-30' },
    { dokument: 'Qualitätssicherungsvereinbarungen der Grosskunden', herausgeber: 'Kunden', stand: 'Stand je Vertrag, Liste N-020', ablage: 'Laufwerk Q: > Verträge', zustaendig: 'P-002', naechstePruefung: '2027-06-30' },
    { dokument: 'Dokumentation und Nutzungsbedingungen der KI-Lieferanten L-001 bis L-003', herausgeber: 'Lieferanten (D-16)', stand: 'Stand je Lieferant im Prüfprotokoll N-012', ablage: 'Laufwerk Q: > AIMS > 16_Lieferanten', zustaendig: 'P-003', naechstePruefung: '2027-10-31' },
  ];

  const a = p.meta.gefuehrt.antworten as Record<string, unknown>;
  for (const k of ['projekt', 'gap', 'meldeweg', 'meldekanal', 'lenkung', 'protokolle']) delete a[k];
  const ll = a['leitlinie'] as Record<string, unknown>;
  delete ll['bezug'];
  delete ll['bezugNotiz'];
}

/** Ist-Beschreibung je Normabschnitt und Control zum Datum der Gap-Analyse (Beispiel Präzisionsteile GmbH, ohne ISMS) */
const GAP_IST_PRAEZISION: Record<string, string> = {
  'K-4.1': 'Kontext im QM-Handbuch ohne KI-Themen; KI-Einsatz und Schatten-KI nicht erhoben',
  'K-4.2': 'Kundenanforderungen im QM erfasst; Anforderungen zu KI aus den Qualitätssicherungsvereinbarungen nicht ausgewertet',
  'K-4.3': 'Kein Geltungsbereich für KI festgelegt',
  'K-4.4': 'QM-Prozesse beschrieben; keine Prozesse für KI',
  'K-5.1': 'Auftrag des Geschäftsführers mit diesem Projektauftrag; bisher keine Steuerung von KI',
  'K-5.2': 'Keine KI-Leitlinie; Qualitätspolitik ohne Aussagen zu KI',
  'K-5.3': 'QM-Rollen festgelegt; keine KI-Rollen und keine AIMS-Verantwortung',
  'K-6.1.1': 'Risikobasiertes Denken nach ISO 9001 und Risikomanagement nach ISO 13485 für Produkte; KI nicht einbezogen',
  'K-6.1.2': 'Keine Beurteilung von KI-Risiken',
  'K-6.1.3': 'Keine Behandlung von KI-Risiken und keine Erklärung zur Anwendbarkeit',
  'K-6.1.4': 'Keine Folgenabschätzung für KI',
  'K-6.2': 'Qualitätsziele vorhanden; keine KI-Ziele',
  'K-6.3': 'Änderungen am QM-System über die Managementbewertung; keine Planung von Änderungen für KI',
  'K-7.1': 'Pensum für das AIMS im Projektauftrag; sonst keine Ressourcen für KI geplant',
  'K-7.2': 'Schulungsplanung im QM; KI-Kompetenz nicht erfasst',
  'K-7.3': 'Einführung neuer Mitarbeitender; KI kein Thema',
  'K-7.4': 'Kommunikation über Teamsitzungen und Anschlagbrett; keine Inhalte zu KI',
  'K-7.5': 'Dokumentenlenkung nach QM-Handbuch Kapitel 4',
  'K-8.1': 'Betrieb nach QM-Prozessen; KI-Werkzeuge ohne Steuerung, Nutzung in den Bereichen nicht erhoben',
  'K-8.2': 'Keine Risikobeurteilung von KI im Betrieb',
  'K-8.3': 'Keine Massnahmen für KI-Risiken',
  'K-8.4': 'Keine Folgenabschätzungen im Betrieb',
  'K-9.1': 'Kennzahlen des QM monatlich; keine Messung zu KI',
  'K-9.2': 'Internes Audit QM jährlich',
  'K-9.3': 'Managementbewertung QM jährlich',
  'K-10.1': 'Verbesserung über die Managementbewertung und den Reklamationsprozess',
  'K-10.2': 'Korrekturmassnahmen nach QM-Verfahren',
  'A.2.2': 'Keine KI-Leitlinie',
  'A.2.3': 'QM-Handbuch, Datenschutzweisung und Personalreglement ohne Bezug zu KI',
  'A.2.4': 'Keine Überprüfung von Regeln zu KI',
  'A.3.2': 'Zuständigkeiten im QM; für KI nur informell beim IT-Verantwortlichen',
  'A.3.3': 'Reklamationen und Meldungen an Vorgesetzte; Bedenken zu KI nicht ausdrücklich vorgesehen',
  'A.4.2': 'Lizenzliste der IT; KI-Funktionen nicht gekennzeichnet, Schatten-KI unbekannt',
  'A.4.3': 'Kundendaten nach Geheimhaltungsvereinbarungen eingestuft; Daten der KI-Werkzeuge nicht erfasst',
  'A.4.4': 'Software in der Lizenzliste; KI-Funktionen und Versionen nicht erfasst',
  'A.4.5': 'Server, Arbeitsplätze und Cloud-Dienste in der IT-Dokumentation',
  'A.4.6': 'Personal je Bereich bekannt; Kompetenzen zu KI nicht erfasst',
  'A.5.2': 'Keine Folgenabschätzung für KI-Werkzeuge',
  'A.5.3': 'Keine dokumentierten Folgenabschätzungen',
  'A.5.4': 'Wirkung auf Kunden, Mitarbeitende und Patientinnen und Patienten nicht beurteilt',
  'A.5.5': 'Gesellschaftliche Wirkungen nicht beurteilt',
  'A.6.2.2': 'Lastenheft bei der Beschaffung von Software; keine Anforderungen an KI-Funktionen',
  'A.6.2.4': 'Abnahme neuer Software ohne Tests der KI-Funktionen',
  'A.6.2.5': 'Updates nach Ankündigung der Anbieter installiert, Release Notes nicht ausgewertet',
  'A.6.2.6': 'Keine Überwachung der Ergebnisse von KI-Funktionen',
  'A.6.2.7': 'Bedienungsanleitungen der Anbieter vorhanden, nicht für Nutzende aufbereitet',
  'A.6.2.8': 'Protokolle der Systeme nicht festgelegt',
  'A.7.3': 'Herkunft der Daten für CAM und ERP bekannt, nicht dokumentiert',
  'A.7.4': 'Stammdatenpflege im ERP; Datenqualität für KI nicht geprüft',
  'A.7.5': 'Programmstände im CAM-System versioniert; Datenherkunft nicht festgehalten',
  'A.8.2': 'Keine Information der Nutzenden über KI',
  'A.8.3': 'Kontakt für Reklamationen auf der Website, ohne Bezug zu KI',
  'A.8.4': 'Reklamationsprozess QM ohne KI-Vorfälle',
  'A.8.5': 'Informationspflichten aus den Qualitätssicherungsvereinbarungen nicht zusammengestellt',
  'A.9.2': 'Weisung IT-Nutzung ohne Regeln zu KI-Werkzeugen',
  'A.9.3': 'CAM-Programme werden simuliert; Offerttexte aus KI-Werkzeugen ohne Prüfregel',
  'A.9.4': 'Zweck der KI-Werkzeuge nicht festgelegt',
  'A.10.2': 'Verantwortung in Lieferantenverträgen für KI nicht geregelt',
  'A.10.3': 'Lieferantenbewertung im QM für Material und Dienstleistungen; ohne KI-Fragen',
  'A.10.4': 'Kundenanforderungen im QM; Erwartungen an KI nicht erfasst',
};

/** Menschliche Aufsicht je KI-System (D-10, Spalte «wer prüft») */
const AUFSICHT_PRAEZISION: Record<string, string> = {
  'KI-001': 'Die Nutzenden prüfen jedes Ergebnis vor der Verwendung, Offerten ab CHF 20 000 im Vier-Augen-Prinzip; die AVOR zieht quartalsweise eine Stichprobe (Z-002).',
  'KI-002': 'Die Disponentin prüft jeden Bestellvorschlag vor der Bestellung; die Monatskontrolle wertet die Abweichungen aus (M-013).',
  'KI-003': 'Die CAM-Programmierer simulieren jedes Programm und fahren es im Einzelsatz ein; bei Medizinteilen gibt eine zweite Person frei (M-015).',
  'KI-004': 'Nutzung untersagt; die IT prüft halbjährlich mit der Inventarumfrage und der Proxy-Auswertung, dass der Dienst nicht mehr genutzt wird.',
};

type Version = [version: string, datum: string, was: string, von?: string];
/** Änderungshistorie je Dokument (DokumentEintrag.aenderungen); ohne Angabe gibt die Person der aktuellen Freigabe frei */
const HISTORIE_PRAEZISION: Record<string, Version[]> = {
  'D-01': [['1.0', '2026-10-06', 'Erstfassung'], ['1.1', '2027-01-26', 'Überprüfung in der Managementbewertung MB-001: Themen und Anforderungen nachgeführt, jährliche Prüfung der AI-Act-Betroffenheit (M-019)']],
  'D-02': [['1.0', '2026-10-06', 'Erstfassung'], ['1.1', '2026-12-15', 'Ausgelagerte Tätigkeiten mit den Lieferanten L-001 bis L-003 und ihrem Prüfstand ergänzt']],
  'D-04': [['1.0', '2026-10-06', 'Erstfassung'], ['1.1', '2026-11-24', 'Rollen für Folgenabschätzung, Daten, Recht, Schulung, Beschaffung und internes Audit ergänzt'], ['1.2', '2027-01-26', 'Nächsthöhere Stelle Gesellschafterversammlung, Restrisiken ab hohem Risiko nur als befristete Ausnahme, Vorbehalte der Risikobereitschaft unabhängig von der Risikostufe (MB-001)']],
  'D-05': [['1.0', '2026-12-22', 'Erstfassung mit den Zielen Z-001 bis Z-003 und dem Messplan'], ['1.1', '2027-01-26', 'Messwerte bis 26.01.2027 mit Beurteilung der Kennzahlen (KZ-06) und Wirksamkeit der Controls (KZ-01), Ziel Z-002 verfehlt (F-004), Ziele für 2027 bestätigt (MB-001)']],
  'D-07': [['1.0', '2026-12-01', 'Erstfassung: Register, Behandlungsplan und Restrisiken'], ['1.1', '2027-01-26', 'R-005 und R-006 nach dem ERP-Update, R-009 nach Feststellung F-001 und R-004 nach Feststellung F-004 neu beurteilt']],
  'D-09-KI-001': [['1.0', '2026-11-17', 'Erstfassung (Kurzprüfung)', 'P-002'], ['1.1', '2027-01-26', 'Neubeurteilung: Frage 5 mit der Korrekturquote abgeglichen (KZ-05)', 'P-002']],
  'D-09-KI-002': [['1.0', '2026-11-17', 'Erstfassung (Kurzprüfung)', 'P-002'], ['1.1', '2027-01-08', 'Neubeurteilung nach dem ERP-Update vom 08.12.2026', 'P-002']],
  'D-10': [
    ['1.0', '2026-10-20', 'Erstfassung: Inventar mit vier Systemen und Rolle je System'],
    ['1.1', '2026-11-17', 'Freigabe je System nach den Folgenabschätzungen, Freigabeliste mit Datenklassen und Auflagen'],
    ['1.2', '2027-01-08', 'KI-002 nach dem ERP-Update vom 08.12.2026 neu beurteilt'],
  ],
  'D-11': [['1.0', '2026-12-01', 'Erstfassung'], ['1.1', '2027-01-26', 'Status nach internem Audit und Managementbewertung nachgeführt (A.2.4, A.6.2.5, A.9.3)']],
  'D-16': [['1.0', '2026-12-15', 'Erstfassung: Prüfung der Lieferanten L-001 bis L-003'], ['1.1', '2027-01-08', 'L-002 nach dem ERP-Update vom 08.12.2026 erneut geprüft']],
  'D-17': [['1.0', '2026-12-22', 'Erstfassung'], ['1.1', '2027-01-28', 'Nachschulung der Temporärmitarbeitenden (F-001), Kompetenz K-005 für die Disposition ergänzt']],
  'D-20': [['1.0', '2026-12-22', 'Auditprogramm und Auditplan'], ['1.1', '2027-01-15', 'Checkliste, Stichproben, Ergebnis und Feststellungen des Audits AU-001']],
  'D-22': [['1.0', '2026-12-22', 'Erstfassung: Register der Nichtkonformitäten und Verbesserungen'], ['1.1', '2027-01-28', 'Feststellungen F-001 bis F-004 aus dem Audit AU-001, Vorfall F-005 mit KI-004 nach der Managementbewertung nachgetragen, Register der Meldungen']],
  'D-26': [
    ['1.0', '2026-09-08', 'Kurzfassung der Dokumentenlenkung'],
    ['1.1', '2026-12-15', 'Register der Dokumente und Aufbewahrung ergänzt'],
    ['1.2', '2027-01-28', 'Prüfung durch eine zweite Person und Änderungshistorie im Register nachgeführt'],
  ],
};
