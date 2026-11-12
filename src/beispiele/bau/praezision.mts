// Beispiel 2: Beispiel Präzisionsteile GmbH (ohne ISMS, ohne AI-Act-Modul). Schlanker Aufbau.
import { prozessDatenPraezision, prozessePraezision } from './prozesse.mts';
import type { Audit, DokumentEintrag, JaNeinOffen, Massnahme, Nachweis, Projekt, Risiko } from '../../model/typen.ts';
import { etappenChecklisten, etappenStand, soa, vorschlaegeZuordnen, wirksamNachPruefung, type CTeil } from './gemeinsam.mts';
import { pruefDaten } from './muster-4.mts';
import { konsolidierungPraezision } from './praezision-2.mts';
import { rc2Praezision } from './praezision-3.mts';
import { rc3Praezision } from './rc3.mts';

const gf = (am: string) => ({ von: 'P-001', am });
type R = Omit<Risiko, 'art' | 'status' | 'ebenen'> & Partial<Pick<Risiko, 'art' | 'status' | 'ebenen'>>;
const r = (x: R): Risiko => ({ art: 'risiko', status: 'akzeptiert', ebenen: ['organisation'], ...x });
const pp = (werte: JaNeinOffen[]): Record<string, JaNeinOffen> => Object.fromEntries(werte.map((w, i) => [`PF-${String(i + 1).padStart(2, '0')}`, w]));
const leerVoll = { systembeschreibung: '', verwendungen: '', fehlanwendungen: '', daten: '', einsatzumfeld: '', betroffene: [], nutzenSchaden: {}, ausfaelle: '', massnahmen: '' };
const kurz = (begruendung: string, t: Partial<Record<'rechtspositionOderChancen' | 'gesundheitOderSicherheit' | 'verletzlicheGruppen' | 'besondereDaten' | 'automatisierteEntscheidung' | 'grosseReichweite', boolean>> = {}) => ({
  rechtspositionOderChancen: false, gesundheitOderSicherheit: false, verletzlicheGruppen: false, besondereDaten: false, automatisierteEntscheidung: false, grosseReichweite: false, ...t, ergebnis: 'kurz' as const, begruendung,
});
const res = (daten: string, werkzeuge: string, rechenressourcen: string, personal: string) => ({ daten, werkzeuge, rechenressourcen, personal });
const AUSSCHLUSS_ENTWICKLUNG = 'Wir entwickeln und trainieren keine KI-Systeme; alle vier Systeme sind eingekauft oder als Dienst genutzt, Training und Modellpflege liegen beim Lieferanten (D-16). Anforderungen an eingekaufte Systeme, Eingabedaten und Betrieb decken A.6.2.2, A.6.2.4 bis A.6.2.8, A.7.3 bis A.7.5, A.9 und A.10 ab. Neubeurteilung, sobald wir ein eigenes Modell entwickeln, nachtrainieren oder ein System wesentlich anpassen.';

const risiken: Risiko[] = [
  r({ id: 'R-001', titel: 'Kundenzeichnungen in einem kostenlosen Chatbot', kiSystem: 'KI-004', quelle: 'vertraulichkeit', ebenen: ['organisation', 'individuen'],
    beschreibung: 'Der Verkauf hat Offerten mit einem kostenlosen Chatbot geschrieben und dazu Kundenzeichnungen und Stücklisten hochgeladen.',
    ursache: 'Zeitdruck im Offertwesen, keine Regeln für KI, kein freigegebenes Werkzeug.',
    folge: 'Verletzung von Geheimhaltungsvereinbarungen mit Medizintechnik- und Automobilkunden, Verlust des Grosskunden, Vertragsstrafen; Übermittlung von Personendaten der Kontaktpersonen ohne Vertrag.',
    bestehendeMassnahmen: 'Geheimhaltungsvereinbarungen, Zugriffsschutz auf das Zeichnungsarchiv.',
    w: 3, a: 3, wNach: 1, aNach: 3, behandlung: 'vermeiden', controls: ['A.9.2', 'A.10.3', 'A.3.3', 'A.5.2', 'A.5.3', 'A.5.4', 'A.5.5', 'A.7.3', 'A.8.4'], massnahmen: ['M-009', 'M-010'], eigner: 'P-005', restrisikoAkzeptiert: gf('2026-11-17'), status: 'behandelt' }),
  r({ id: 'R-002', titel: 'Exportkontrollierte Zeichnungen verlassen die Schweiz', kiSystem: 'KI-004', quelle: 'recht',
    beschreibung: 'Einzelne Zeichnungen für Automobilkunden betreffen Dual-Use-Güter; der kostenlose Dienst verarbeitet Daten in den USA.',
    ursache: 'Fehlende Kennzeichnung der Exportkontrolle in den Zeichnungen.',
    folge: 'Verstoss gegen das Güterkontrollrecht, Busse.',
    bestehendeMassnahmen: 'Exportkontrolle bei Lieferungen durch die Geschäftsführung.',
    w: 2, a: 3, wNach: 1, aNach: 3, behandlung: 'vermeiden', controls: ['A.9.2', 'A.2.3', 'A.4.5'], massnahmen: ['M-010'], eigner: 'P-005', restrisikoAkzeptiert: gf('2026-11-17'), status: 'behandelt' }),
  r({ id: 'R-003', titel: 'Copilot zeigt Daten wegen zu breiter Freigaben', kiSystem: 'KI-001', quelle: 'sicherheit', ebenen: ['organisation', 'individuen'],
    beschreibung: 'Copilot findet Lohnlisten oder Kundendaten in Ordnern, die für alle freigegeben sind.',
    ursache: 'Gewachsene Ordnerfreigaben, keine regelmässige Prüfung.',
    folge: 'Verletzung der Vertraulichkeit, Datenschutzverletzung.',
    bestehendeMassnahmen: 'IT-Partner verwaltet Berechtigungen.',
    w: 2, a: 3, wNach: 1, aNach: 2, behandlung: 'vermindern', controls: ['A.4.3', 'A.9.4'], massnahmen: ['M-011'], eigner: 'P-003', restrisikoAkzeptiert: gf('2026-11-17') }),
  r({ id: 'R-004', titel: 'Falsche Angaben in Offerten und Prüfberichten aus Copilot', kiSystem: 'KI-001', quelle: 'modell',
    beschreibung: 'Copilot formuliert Toleranzen, Werkstoffangaben oder Normverweise falsch, und sie werden ungeprüft übernommen.',
    ursache: 'Halluzinationen, Vertrauen in flüssige Texte.',
    folge: 'Falsche Zusicherungen, Reklamationen, Abweichungen im Kundenaudit.',
    bestehendeMassnahmen: 'Offerten über CHF 20 000 im Vier-Augen-Prinzip. Neu beurteilt am 26.01.2027 nach Feststellung F-004 (Ziel Z-002 verfehlt) nach der Wirksamkeit der Kontrolle, nicht nach dem Ausbleiben eines Schadens: Die Prüfung fehlte in 1 von 20 Offerten, und ME-001 zeigt das Fehlerbild (falsche Werkstoffbezeichnung aus Copilot). Bis der Prüfvermerk für jede Offerte mit KI-Text eingeführt und mit Z-002 gemessen ist (M-022), gilt Wahrscheinlichkeit 2 nach der Behandlung. Ausmass 2 nach der Behandlung: Prüfberichte gehen nur nach Freigabe durch die Qualität an Kunden, und ein Fehler in einer Offerte fällt spätestens bei der Auftragsbestätigung auf (Reklamation, keine Gefährdung).',
    w: 2, a: 3, wNach: 2, aNach: 2, behandlung: 'vermindern', controls: ['A.9.3', 'A.8.2', 'A.8.3'], massnahmen: ['M-012', 'M-022'], eigner: 'P-005', restrisikoAkzeptiert: gf('2027-01-26'), status: 'in-behandlung',
    restrisikoBegruendung: 'Der Restwert 4 liegt über der Akzeptanzgrenze 3. Der Geschäftsführer trägt das Risiko bis zur Messung von Z-002 nach Einführung des Prüfvermerks (M-022, Termin 31.03.2027), weil jede Offerte ab CHF 20 000 im Vier-Augen-Prinzip geprüft wird und die Offerte ohne Prüfvermerk keine falsche Angabe enthielt. Danach Neubeurteilung mit dem Ziel Restwert 2.' }),
  r({ id: 'R-005', titel: 'Fehldisposition durch die ERP-KI', kiSystem: 'KI-002', quelle: 'modell',
    beschreibung: 'Die KI-Funktion im ERP schlägt zu tiefe Bestellmengen für Stangenmaterial vor oder schätzt Liefertermine zu optimistisch.',
    ursache: 'Wenig Daten bei Sonderwerkstoffen, Nachfrageschwankungen in der Medizintechnik.',
    folge: 'Lieferverzug bei Medizintechnikkunden, Expresskosten.',
    bestehendeMassnahmen: 'Disponentin prüft jeden Vorschlag vor der Bestellung. Neu beurteilt am 08.01.2027 nach dem ERP-Update vom 08.12.2026: Bewertung unverändert, die Monatskontrolle (M-013) hat die Änderung erkannt.',
    w: 2, a: 2, wNach: 1, aNach: 2, behandlung: 'vermindern', controls: ['A.9.4', 'A.6.2.6', 'A.7.4'], massnahmen: ['M-013'], eigner: 'P-005', restrisikoAkzeptiert: gf('2027-01-08') }),
  r({ id: 'R-006', titel: 'ERP-Anbieter ändert die KI-Funktion ohne Ankündigung', kiSystem: 'KI-002', quelle: 'lieferant',
    beschreibung: 'Mit einem Update ändert sich das Verhalten der Vorschläge, ohne dass wir es merken.',
    ursache: 'Release Notes werden nicht gelesen.',
    folge: 'Unbemerkte Verschlechterung der Disposition.',
    bestehendeMassnahmen: 'Monatskontrolle der Dispositionsvorschläge (M-013) und Prüfung jedes Vorschlags durch die Disponentin. Neu beurteilt am 08.01.2027 nach dem ERP-Update vom 08.12.2026: Die Monatskontrolle hat die Änderung nach vier Wochen erkannt, ohne Fehlbestellung. Angenommen ist der heutige Restwert mit diesen Kontrollen (Wahrscheinlichkeit 1, Ausmass 2). Ziel nach M-014 (Termin 31.03.2027): Änderungen werden vor dem Update angekündigt und ausgewertet statt erst im Nachhinein erkannt; der Wert bleibt gleich, die Zeit bis zur Erkennung sinkt.',
    w: 2, a: 2, wNach: 1, aNach: 2, behandlung: 'vermindern', controls: ['A.10.3', 'A.4.2', 'A.4.4', 'A.6.2.5', 'A.10.2'], massnahmen: ['M-014'], eigner: 'P-003', restrisikoAkzeptiert: gf('2027-01-08'), status: 'in-behandlung' }),
  r({ id: 'R-007', titel: 'CAM-KI erzeugt kollisionsgefährdete oder fehlerhafte Werkzeugwege', kiSystem: 'KI-003', quelle: 'modell', ebenen: ['organisation', 'individuen'],
    beschreibung: 'Vorgeschlagene Werkzeugwege berücksichtigen Spannmittel oder Restmaterial nicht richtig.',
    ursache: 'Unvollständige Spannmittelmodelle, Vertrauen in den Vorschlag.',
    folge: 'Maschinencrash mit Schaden über CHF 50 000 und Ausschuss bei Implantatteilen; ein unerkannt fehlerhaftes Implantatteil könnte Patientinnen und Patienten gefährden. Personen an der Maschine schützen die verriegelten Schutztüren und der Einrichtbetrieb mit reduzierter Geschwindigkeit, unabhängig vom Programm.',
    bestehendeMassnahmen: 'Simulation im CAM vor jedem neuen Programm, Einfahren im Einzelsatz; Erstmusterprüfung und Endprüfung der Medizinteile nach ISO 13485 unabhängig von der KI.',
    w: 2, a: 3, wNach: 1, aNach: 3, behandlung: 'vermindern', controls: ['A.9.3', 'A.9.4', 'A.6.2.4', 'A.6.2.2', 'A.6.2.7', 'A.7.4', 'A.5.4'], massnahmen: ['M-015'], eigner: 'P-004', restrisikoAkzeptiert: gf('2026-11-17') }),
  r({ id: 'R-008', titel: 'Programmstände für Medizinteile nicht rückverfolgbar', kiSystem: 'KI-003', quelle: 'daten',
    beschreibung: 'Bei KI-Vorschlägen ist nicht dokumentiert, welche Programmversion mit welchem Vorschlag freigegeben wurde.',
    ursache: 'Ablage der CAM-Programme ohne Versionsangabe zur KI-Funktion.',
    folge: 'Abweichung im Kundenaudit nach ISO 13485, Nachweisprobleme bei Reklamationen.',
    bestehendeMassnahmen: 'Programmfreigabe durch die Arbeitsvorbereitung.',
    w: 2, a: 2, wNach: 1, aNach: 2, behandlung: 'vermindern', controls: ['A.6.2.8', 'A.7.5'], massnahmen: ['M-015'], eigner: 'P-004', restrisikoAkzeptiert: gf('2026-11-17') }),
  r({ id: 'R-009', titel: 'Mitarbeitende kennen die KI-Regeln nicht', quelle: 'kompetenz',
    beschreibung: 'Neue und temporäre Mitarbeitende nutzen private KI-Konten oder geben Kundendaten ein.',
    ursache: 'Fluktuation in der Produktion, fehlende Einführung.',
    folge: 'Neue Fälle von Schatten-KI, Vertraulichkeitsverletzungen.',
    bestehendeMassnahmen: 'Einführung neuer Mitarbeitender durch die Vorgesetzten. Neu beurteilt am 20.01.2027 nach Feststellung F-001: Temporärmitarbeitende in die Einführung aufgenommen (M-018); Restrisiko am 26.01.2027 erneut angenommen.',
    w: 3, a: 2, wNach: 2, aNach: 2, behandlung: 'vermindern', controls: ['A.9.2', 'A.4.6', 'A.2.2'], massnahmen: ['M-012', 'M-018'], eigner: 'P-002', restrisikoAkzeptiert: gf('2027-01-26'),
    restrisikoBegruendung: 'Der Restwert 4 liegt über der Akzeptanzgrenze 3. Der Geschäftsführer trägt das Risiko bis zur Wirksamkeitsprüfung von M-018 am 31.03.2027, weil Fluktuation und kurzfristige Temporäreinsätze nicht ganz vermeidbar sind und seit der Nachschulung alle 45 Personen im Werk geschult sind. Danach Neubeurteilung mit dem Ziel Restwert 2; bis dahin prüft die AIMS-Verantwortliche jeden neuen Einsatz von Temporärmitarbeitenden.' }),
  r({ id: 'R-010', titel: 'Kunde verlangt Nachweise, die wir nicht liefern können', quelle: 'recht',
    beschreibung: 'Im nächsten Lieferantenaudit fragt der Grosskunde nach Inventar, Risiken und Lieferantenprüfung für KI.',
    ursache: 'Bisher kein Managementsystem für KI.',
    folge: 'Abwertung im Lieferantenrating, Verlust von Aufträgen.',
    bestehendeMassnahmen: 'ISO 9001 und ISO 13485 zertifiziert.',
    w: 3, a: 3, wNach: 1, aNach: 3, behandlung: 'vermindern', controls: ['A.4.2', 'A.10.4', 'A.8.2', 'A.2.4', 'A.3.2', 'A.8.5'], massnahmen: ['M-016'], eigner: 'P-002', restrisikoAkzeptiert: gf('2026-12-01'), status: 'behandelt' }),
  { id: 'R-011', art: 'chance', titel: 'Kürzere Programmierzeit mit CAM-KI', kiSystem: 'KI-003', quelle: 'modell', ebenen: ['organisation'],
    beschreibung: 'Feature-Erkennung und Werkzeugweg-Vorschläge verkürzen die Programmierung neuer Teile um rund 30 %.',
    ursache: 'Viele Kleinserien mit ähnlichen Geometrien.', folge: 'Schnellere Offerten und Erstmuster.', bestehendeMassnahmen: 'Zwei CAM-Programmierer mit Herstellerschulung.',
    w: 3, a: 2, wNach: null, aNach: null, behandlung: 'nutzen', controls: ['A.9.3'], massnahmen: ['M-015'], eigner: 'P-004', status: 'in-behandlung' },
  r({ id: 'R-012', titel: 'Präparierte Mail bringt Copilot zur Preisgabe von Kundendaten', kiSystem: 'KI-001', quelle: 'sicherheit', ebenen: ['organisation', 'individuen'],
    beschreibung: 'Eine Kundenmail oder ein Anhang enthält versteckte Anweisungen. Fasst Copilot die Mail zusammen, folgt er den Anweisungen und gibt Zeichnungen, Preise oder Kontaktdaten in einer Antwort oder einem Link weiter.',
    ursache: 'Copilot liest eingehende Mails und Dokumente mit den Rechten der Nutzenden; versteckte Anweisungen lassen sich vom übrigen Text nicht sicher trennen.',
    folge: 'Abfluss von Kundenzeichnungen oder Personendaten ohne Zutun der Nutzenden, Verletzung von Geheimhaltungsvereinbarungen.',
    bestehendeMassnahmen: 'Updates des Herstellers, Agenten und Konnektoren nicht freigeschaltet, Lohn- und Personalordner ausgenommen, Missbrauchsfälle vor der Freigabe getestet; Schulung mit dem Hinweis, auffällige Antworten zu melden.',
    w: 2, a: 3, wNach: 1, aNach: 3, behandlung: 'vermindern', controls: ['A.6.2.6', 'A.9.4', 'A.10.3'], massnahmen: ['M-011', 'M-012'], eigner: 'P-003', restrisikoAkzeptiert: gf('2026-11-17') }),
  r({ id: 'R-013', titel: 'Copilot verarbeitet exportkontrollierte Zeichnungen', kiSystem: 'KI-001', quelle: 'recht',
    beschreibung: 'Im Verkaufsordner liegen auch Zeichnungen für Automobilkunden mit Exportkontrollvermerk. Copilot könnte sie in Zusammenfassungen oder Offertentwürfen verwenden, obwohl exportkontrollierte Daten nicht in KI-Systeme gehören (D-13, D-15).',
    ursache: 'Zeichnungen mit und ohne Exportkontrollvermerk lagen im selben Ordner; die Kennzeichnung fehlte in einem Teil der Zeichnungen (R-002).',
    folge: 'Verstoss gegen das Güterkontrollrecht und die Geheimhaltungsvereinbarungen, Busse.',
    bestehendeMassnahmen: 'Liste der exportkontrollierten Teile aus der Abklärung M-010; Zeichnungen mit Exportkontrollvermerk vor der Freigabe von Copilot in einen eigenen Ordner ohne Copilot-Zugriff verschoben (M-011); neue Zeichnungen mit Vermerk legt der Verkauf nur dort ab.',
    w: 2, a: 3, wNach: 1, aNach: 3, behandlung: 'vermindern', controls: ['A.4.3', 'A.7.3', 'A.9.2'], massnahmen: ['M-010', 'M-011'], eigner: 'P-003', restrisikoAkzeptiert: gf('2026-11-17') }),
];

const s = (x: CTeil): CTeil => x;
const soaEintraege: Record<string, CTeil> = {
  'A.2.2': s({ begruendung: 'Pflicht für jedes AIMS; vom Grosskunden verlangt; Grundlage für klare Regeln (R-009).', verantwortlich: 'P-001', nachweise: ['N-002'], umsetzung: 'KI-Leitlinie D-03 auf zwei Seiten, freigegeben 06.10.2026, an alle verteilt.' }),
  'A.2.3': s({ begruendung: 'Abgleich mit QM-Handbuch (ISO 9001, ISO 13485), Datenschutz und Geheimhaltung (R-002).', verantwortlich: 'P-002', nachweise: ['N-002'], umsetzung: 'Verweise auf QM-Handbuch Kapitel 7, Datenschutzweisung und Verhaltenskodex in der Leitlinie; eine eigene Informationssicherheitsleitlinie gibt es nicht.' }),
  'A.2.4': s({ begruendung: 'Leitlinie jährlich prüfen, auch wegen der Anforderungen der Kunden (R-010).', verantwortlich: 'P-002', nachweise: ['N-017'], umsetzung: 'Überprüfung mit der Managementbewertung; erste Überprüfung am 26.01.2027 (MB-001): angemessen, keine Änderung; nächste bis 31.10.2027.' }),
  'A.3.2': s({ begruendung: 'Klare Zuständigkeiten auch in einer kleinen Organisation (R-010).', verantwortlich: 'P-001', nachweise: ['N-003'], umsetzung: 'Rollen und RACI in D-04; AIMS-Verantwortliche ist die Leiterin Qualität (40 % im Aufbau).' }),
  'A.3.3': s({ begruendung: 'Bedenken sollen gemeldet werden können; Schatten-KI-Fall (R-001).', verantwortlich: 'P-002', nachweise: ['N-003'], umsetzung: 'Meldung an Vorgesetzte, direkt an die AIMS-Verantwortliche oder an das Postfach qualitaet@praezisionsteile.example, auf Wunsch vertraulich; Ausweichstelle ist der Geschäftsführer.' }),
  'A.4.2': s({ begruendung: 'Inventar ist Kern des Kundennachweises (R-006, R-010).', verantwortlich: 'P-002', nachweise: ['N-004'], umsetzung: 'KI-Inventar D-10 mit vier Systemen, davon eines untersagt; halbjährliche Überprüfung.' }),
  'A.4.3': s({ begruendung: 'Kundenzeichnungen und Personendaten (R-003).', verantwortlich: 'P-003', nachweise: ['N-004'], umsetzung: 'Datenarten und zugelassene Daten je System im Inventar.' }),
  'A.4.4': s({ begruendung: 'Werkzeuge und Modelle der Lieferanten müssen bekannt sein, auch nach Updates (R-006).', verantwortlich: 'P-003', nachweise: ['N-004'], umsetzung: 'Produkt, Version und Modellangaben der Lieferanten im Inventar.' }),
  'A.4.5': s({ begruendung: 'Cloud-Dienste und lokale CAM-Arbeitsplätze; Ort der Verarbeitung (R-002).', verantwortlich: 'P-003', nachweise: ['N-004'], umsetzung: 'Standort der Verarbeitung je System im Inventar.' }),
  'A.4.6': s({ begruendung: 'Wenige Fachleute, hohe Abhängigkeit (R-009).', verantwortlich: 'P-002', nachweise: ['N-004', 'N-014'], umsetzung: 'Verantwortliche Personen und Schulungsbedarf je System im Inventar und in D-17.' }),
  'A.5.2': s({ begruendung: 'Pflicht zur Folgenabschätzung; Kurzprüfung für alle Systeme (R-001).', verantwortlich: 'P-002', nachweise: ['N-005'], umsetzung: 'Verfahren D-08 in der Kurzform: Kurzprüfung je System, volle Abschätzung bei Schwelle; Neubeurteilung bei wesentlichen Änderungen.' }),
  'A.5.3': s({ begruendung: 'Ergebnisse aufbewahren (R-001).', verantwortlich: 'P-002', nachweise: ['N-006'], umsetzung: 'Vier Folgenabschätzungen IA-001 bis IA-004 freigegeben und abgelegt; IA-002 nach dem ERP-Update neu beurteilt.' }),
  'A.5.4': s({ begruendung: 'Wirkung auf Kunden, Mitarbeitende und bei Medizinteilen auf Patientinnen und Patienten (R-001, R-007).', verantwortlich: 'P-002', nachweise: ['N-006'], umsetzung: 'Volle Abschätzungen IA-003 und IA-004 mit direkt und indirekt betroffenen Gruppen.' }),
  'A.5.5': s({ begruendung: 'Gesellschaftliche Wirkungen beurteilen, auch wenn gering (R-001).', verantwortlich: 'P-002', nachweise: ['N-006'], umsetzung: 'Abschnitt Gesellschaft in IA-003 und IA-004; für die übrigen Systeme in der Kurzprüfung als gering bewertet.' }),
  'A.6.1.2': s({ anwendbar: 'nein', begruendung: AUSSCHLUSS_ENTWICKLUNG }),
  'A.6.1.3': s({ anwendbar: 'nein', begruendung: AUSSCHLUSS_ENTWICKLUNG }),
  'A.6.2.2': s({ begruendung: 'Anforderungen an eingekaufte KI-Systeme vor dem Kauf und vor wesentlichen Updates festhalten (R-007).', verantwortlich: 'P-004', nachweise: ['N-008'], umsetzung: 'Mindestanforderungen je Antrag nach D-12 (Zweck, Qualität, Daten, Grenzen); für die CAM-KI Anforderungen an Spannmittelerkennung und Simulation im Abnahmeprotokoll.' }),
  'A.6.2.3': s({ anwendbar: 'nein', begruendung: AUSSCHLUSS_ENTWICKLUNG }),
  'A.6.2.4': s({ begruendung: 'Eingekaufte Systeme werden vor dem Einsatz mit eigenen Fällen geprüft (R-007).', verantwortlich: 'P-004', nachweise: ['N-008'], umsetzung: 'Abnahmetest mit 10 typischen Teilen für die CAM-KI, Testphase von 4 Wochen für die ERP-KI, für Copilot 15 eigene Fälle (Offerttexte, Prüfberichte, Zusammenfassungen) und 5 Missbrauchsfälle vor der Freigabe; Kriterien und Ergebnisse im Abnahmeprotokoll.' }),
  'A.6.2.5': s({ begruendung: 'Einführung und Updates eingekaufter Systeme planen (R-006).', status: 'teilweise', verantwortlich: 'P-003', nachweise: ['N-008'], umsetzung: 'Einführungscheckliste mit Abnahme und Schulung; Auswertung der Release Notes vor jedem Update und Vereinbarung mit dem ERP-Anbieter in Einführung (M-014).' }),
  'A.6.2.6': s({ begruendung: 'Betrieb überwachen (R-005).', verantwortlich: 'P-003', nachweise: ['N-009'], umsetzung: 'Monatliche Kontrolle der Dispositionsabweichungen, Crash- und Ausschussmeldungen nach Programm.' }),
  'A.6.2.7': s({ begruendung: 'Nutzende brauchen kurze Anleitungen (R-007).', verantwortlich: 'P-004', nachweise: ['N-010'], umsetzung: 'Einseitige Arbeitsanweisung je System (Zweck, Grenzen, Prüfpflicht).' }),
  'A.6.2.8': s({ begruendung: 'Rückverfolgbarkeit von Programmständen und Nutzung (R-008).', verantwortlich: 'P-003', nachweise: ['N-011'], umsetzung: 'Protokolle: Audit-Log im M365-Admin-Center 6 Monate, ERP-Änderungsprotokoll, CAM-Programmversion mit Vermerk «KI-Vorschlag»; Auswertung halbjährlich.' }),
  'A.7.2': s({ anwendbar: 'nein', begruendung: AUSSCHLUSS_ENTWICKLUNG }),
  'A.7.3': s({ begruendung: 'Kundenzeichnungen und 3D-Modelle sind Eingabedaten von Copilot und CAM-KI; Herkunft, Rechte und Geheimhaltung müssen geklärt sein (R-001).', verantwortlich: 'P-004', nachweise: ['N-019'], umsetzung: 'Herkunft und Nutzungsrechte der Eingabedaten je System in D-13; Kundenzeichnungen nur nach Geheimhaltungsvereinbarung und nur in KI-001 und KI-003.' }),
  'A.7.4': s({ begruendung: 'Eingabedaten unter unserer Kontrolle bestimmen die Ergebnisse: Stammdaten im ERP, Spannmittelmodelle im CAM (R-005, R-007).', verantwortlich: 'P-005', nachweise: ['N-019', 'N-009'], umsetzung: 'Qualitätskriterien je System in D-13: vollständige Materialstammdaten mit jährlicher Bereinigung, freigegebene Spannmittel- und Werkzeugbibliothek, aktuelle Textbausteine; Prüfung in der Monatskontrolle.' }),
  'A.7.5': s({ begruendung: 'Herkunft der Eingabedaten bei Medizinteilen nachweisen (R-008).', verantwortlich: 'P-004', nachweise: ['N-011'], umsetzung: 'Zeichnungsindex und Programmversion im Fertigungsauftrag verknüpft.' }),
  'A.7.6': s({ anwendbar: 'nein', begruendung: AUSSCHLUSS_ENTWICKLUNG }),
  'A.8.2': s({ begruendung: 'Mitarbeitende und Kunden wissen, wo KI mitwirkt (R-004, R-010).', verantwortlich: 'P-002', nachweise: ['N-010', 'N-016'], umsetzung: 'Arbeitsanweisungen je System; Kundeninformation im Lieferantenselbstauskunftsbogen.' }),
  'A.8.3': s({ begruendung: 'Kunden sollen Bedenken zu unserem KI-Einsatz melden können, etwa zu Offerten (R-004).', verantwortlich: 'P-002', nachweise: ['N-013'], umsetzung: 'Adresse qualitaet@praezisionsteile.example auf der Website und in der Selbstauskunft; Eingangsbestätigung innert 10 Arbeitstagen, Antwort innert 30 Tagen im Reklamationsprozess.' }),
  'A.8.4': s({ begruendung: 'Vorfälle wie der Schatten-KI-Fall müssen kommuniziert werden (R-001).', verantwortlich: 'P-001', nachweise: ['N-013'], umsetzung: 'Vorfallablauf in D-14: Der Geschäftsführer informiert betroffene Kunden so rasch wie möglich, spätestens innert 72 Stunden und innert der Fristen der Qualitätssicherungsvereinbarungen.' }),
  'A.8.5': s({ begruendung: 'Vertragliche Informationspflichten gegenüber Kunden aus den Qualitätssicherungsvereinbarungen (R-010).', verantwortlich: 'P-002', nachweise: ['N-020', 'N-016'], umsetzung: 'Liste der Informationspflichten aus den QSV der zwei Grosskunden mit Frist, Empfänger und Zuständigkeit (N-020); Information über den Vorfallablauf in D-14.' }),
  'A.9.2': s({ begruendung: 'Nutzungsregeln und Freigabe neuer Werkzeuge (R-001, R-002, R-009).', verantwortlich: 'P-002', nachweise: ['N-007', 'N-014'], umsetzung: 'Richtlinie KI-Nutzung D-15 mit Verbot kostenloser Dienste für Firmendaten; Anträge an die AIMS-Verantwortliche, Entscheid mit der verantwortlichen Person, bei hohem Risiko durch den Geschäftsführer; Unterschrift aller 45 Personen im Werk einschliesslich Temporärmitarbeitende (Stand 20.01.2027).' }),
  'A.9.3': s({ begruendung: 'Menschliche Prüfung aller KI-Ergebnisse (R-004, R-007).', status: 'teilweise', verantwortlich: 'P-002', nachweise: ['N-015'], umsetzung: 'Ziel Z-002 zur Prüfpflicht; Simulation jedes CAM-Programms; jede Offerte mit KI-Text wird vor dem Versand geprüft und mit Prüfvermerk versehen, ab CHF 20 000 im Vier-Augen-Prinzip (M-022, nach Feststellung F-004).' }),
  'A.9.4': s({ begruendung: 'Nutzung nur für den festgelegten Zweck (R-003, R-005, R-007).', verantwortlich: 'P-002', nachweise: ['N-004', 'N-007'], umsetzung: 'Zweck im Inventar, Stichprobe im internen Audit.' }),
  'A.10.2': s({ begruendung: 'Verantwortung mit den drei Lieferanten klären, auch für Updates (R-006).', verantwortlich: 'P-003', nachweise: ['N-012'], umsetzung: 'Verantwortungsmatrix in D-16.' }),
  'A.10.3': s({ begruendung: 'Alle KI-Systeme sind eingekauft (R-001, R-006).', status: 'teilweise', verantwortlich: 'P-003', nachweise: ['N-012'], umsetzung: 'Prüffragen PF-01 bis PF-21 je Lieferant, jährliche Prüfung; alle drei Lieferanten mit Auflagen. Auswertung der Release Notes und Vereinbarung mit dem ERP-Anbieter in Einführung (M-014).' }),
  'A.10.4': s({ begruendung: 'Grosskunden haben Anforderungen an unseren KI-Einsatz (R-010).', verantwortlich: 'P-002', nachweise: ['N-016'], umsetzung: 'Kundenanforderungen in D-01, Antwort in der Lieferantenselbstauskunft.' }),
};

const n = (id: string, titel: string, art: Nachweis['art'], ablageort: string, datum?: string): Nachweis => ({ id, titel, art, ablageort, ...(datum ? { datum } : {}) });
const Q = 'Laufwerk Q: > AIMS';
const nachweise: Nachweis[] = [
  n('N-001', 'Projektauftrag und Gap-Analyse (D-00)', 'dokument', `${Q} > 00_Projekt`, '2026-09-01'),
  n('N-002', 'KI-Leitlinie (D-03) Version 1.0', 'dokument', `${Q} > 03_Leitlinie`, '2026-10-06'),
  n('N-003', 'Rollen, RACI und Meldeweg (D-04)', 'dokument', `${Q} > 04_Organisation`, '2026-10-06'),
  n('N-004', 'KI-Inventar (D-10)', 'aufzeichnung', `${Q} > 10_Inventar`, '2026-10-16'),
  n('N-005', 'Verfahren Folgenabschätzung (D-08)', 'dokument', `${Q} > 08_Folgen`, '2026-11-03'),
  n('N-006', 'Folgenabschätzungen IA-001 bis IA-004 (D-09)', 'aufzeichnung', `${Q} > 09_Folgen`, '2026-11-17'),
  n('N-007', 'Richtlinie KI-Nutzung (D-15) mit Unterschriften', 'dokument', `${Q} > 15_Nutzung`, '2026-12-18'),
  n('N-008', 'Abnahmeprotokolle CAM-KI, ERP-KI und Copilot', 'protokoll', `${Q} > 12_Betrieb`, '2026-11-13'),
  n('N-009', 'Monatskontrolle Disposition und Programmmeldungen', 'aufzeichnung', `${Q} > 05_Messung`, '2027-01-05'),
  n('N-010', 'Arbeitsanweisungen je KI-System', 'dokument', 'QM-Handbuch > Arbeitsanweisungen', '2026-12-15'),
  n('N-011', 'Protokollierungsvorgaben (D-12) und Protokollauszüge', 'aufzeichnung', `${Q} > 12_Betrieb`, '2026-12-15'),
  n('N-012', 'Lieferantenprüfung KI (D-16) mit Verträgen', 'aufzeichnung', `${Q} > 16_Lieferanten`, '2026-12-15'),
  n('N-013', 'Information und Meldekanal (D-14), Vorfallablauf', 'dokument', `${Q} > 14_Information`, '2026-12-15'),
  n('N-014', 'Schulungsliste KI-Nutzung und Kompetenzen (D-17)', 'schulung', `${Q} > 17_Kompetenz`, '2027-01-20'),
  n('N-015', 'Ziele und Messungen (D-05)', 'aufzeichnung', `${Q} > 05_Messung`, '2027-01-20'),
  n('N-016', 'Lieferantenselbstauskunft KI an Medivo Medtech AG', 'dokument', `${Q} > 01_Kontext`, '2026-11-20'),
  n('N-017', 'Bericht internes Audit (D-20) und Protokoll Managementbewertung (D-21)', 'protokoll', `${Q} > 20_Audit`, '2027-01-26'),
  n('N-018', 'Risikoregister und Behandlungsplan (D-07), freigegeben', 'aufzeichnung', `${Q} > 07_Risiken`, '2027-01-26'),
  n('N-019', 'Datenregeln und Qualitätskriterien je KI-System (D-13)', 'dokument', `${Q} > 13_Daten`, '2026-12-15'),
  n('N-020', 'Liste der Informationspflichten aus den Qualitätssicherungsvereinbarungen', 'dokument', `${Q} > 14_Information`, '2026-12-15'),
];

const massnahmen: Massnahme[] = [
  { id: 'M-009', titel: 'Kostenlosen Chatbot untersagen und Konten löschen', beschreibung: 'Nutzung untersagt, private Konten der drei Verkaufsmitarbeitenden gelöscht, Löschantrag an den Dienst gestellt, Webzugriff im Firmennetz gesperrt.', verantwortlich: 'P-001', termin: '2026-09-22', status: 'erledigt', prioritaet: 'hoch', herkunft: { art: 'risiko', ref: 'R-001' }, erledigtAm: '2026-09-22' },
  { id: 'M-010', titel: 'Betroffene Kunden informieren und Exportkontrolle prüfen', beschreibung: 'Prüfung der hochgeladenen Zeichnungen (12 Zeichnungen von 4 Kunden), Information der Kunden, Abklärung der Exportkontrolle mit dem Branchenverband.', verantwortlich: 'P-001', termin: '2026-10-09', status: 'erledigt', prioritaet: 'hoch', herkunft: { art: 'risiko', ref: 'R-001, R-002' }, erledigtAm: '2026-10-09' },
  { id: 'M-011', titel: 'Ordnerfreigaben vor Copilot bereinigen', beschreibung: 'Freigaben «Jeder» entfernen, Lohn- und Personalordner von Copilot ausnehmen, Zeichnungen mit Exportkontrollvermerk in einen eigenen Ordner ohne Copilot-Zugriff verschieben (IT-Partner, Liste aus M-010).', verantwortlich: 'P-003', termin: '2026-11-13', status: 'erledigt', prioritaet: 'mittel', herkunft: { art: 'risiko', ref: 'R-003, R-013' }, erledigtAm: '2026-11-13' },
  { id: 'M-012', titel: 'Schulung KI-Nutzung für alle Mitarbeitenden', beschreibung: 'Einführung von 30 Minuten in Teamsitzungen, Merkblatt, Unterschrift der Richtlinie; Teil der Einführung neuer Mitarbeitender.', verantwortlich: 'P-002', termin: '2026-12-18', status: 'erledigt', prioritaet: 'mittel', herkunft: { art: 'risiko', ref: 'R-004, R-009' }, erledigtAm: '2026-12-18' },
  { id: 'M-013', titel: 'Monatskontrolle der Dispositionsvorschläge', beschreibung: 'Abweichung zwischen Vorschlag und tatsächlichem Bedarf monatlich auswerten; Grenzwert 10 %.', verantwortlich: 'P-005', termin: '2026-12-31', status: 'erledigt', prioritaet: 'mittel', herkunft: { art: 'risiko', ref: 'R-005' }, erledigtAm: '2027-01-05' },
  { id: 'M-014', titel: 'Release Notes von ERP und CAM auswerten', beschreibung: 'IT-Verantwortlicher liest die Release Notes vor jedem Update und meldet Änderungen an KI-Funktionen; Vereinbarung mit dem ERP-Anbieter, Änderungen an KI-Funktionen vorab anzukündigen, mit Liste der Unterauftragnehmer und den offenen Klauseln (PF-04, VK-04, VK-05, VK-13).', verantwortlich: 'P-003', termin: '2027-03-31', status: 'in-arbeit', prioritaet: 'mittel', herkunft: { art: 'risiko', ref: 'R-006' } },
  { id: 'M-015', titel: 'Simulations- und Freigabepflicht für CAM-Programme mit KI-Vorschlag', beschreibung: 'Vermerk «KI-Vorschlag» in der Programmversion, Simulation mit vollständigem Spannmittelmodell, Freigabe durch zweite Person bei Medizinteilen.', verantwortlich: 'P-004', termin: '2026-11-13', status: 'erledigt', prioritaet: 'hoch', herkunft: { art: 'risiko', ref: 'R-007, R-008' }, erledigtAm: '2026-11-13' },
  { id: 'M-016', titel: 'Lieferantenselbstauskunft KI an den Grosskunden', beschreibung: 'Antwort auf die Anfrage aus dem Lieferantenaudit mit Inventar, Leitlinie, Risikoregister und Zertifizierungsplan.', verantwortlich: 'P-002', termin: '2026-11-20', status: 'erledigt', prioritaet: 'mittel', herkunft: { art: 'risiko', ref: 'R-010' }, erledigtAm: '2026-11-20' },
  { id: 'M-018', titel: 'Schulungsnachweise für Temporärmitarbeitende nachführen', beschreibung: 'Vier Temporärmitarbeitende ohne Unterschrift der Richtlinie; Nachschulung, Aufnahme in die Checkliste der Einführung und Messung von Z-003 über alle Personen im Werk.', verantwortlich: 'P-002', termin: '2027-01-29', status: 'erledigt', prioritaet: 'mittel', herkunft: { art: 'audit', ref: 'F-001' }, start: '2027-01-13', erledigtAm: '2027-01-20' },
  { id: 'M-019', titel: 'Jährliche Überprüfung der AI-Act-Betroffenheit', beschreibung: 'Fester Termin im Jahresplan: prüfen, ob KI in Produkte oder Dienstleistungen kommt, Ergebnisse in der EU genutzt werden oder Hochrisiko-Fälle entstehen; bei Unsicherheit juristische Prüfung. Erste Prüfung vor Stage 1.', verantwortlich: 'P-002', termin: '2027-01-29', status: 'erledigt', prioritaet: 'mittel', herkunft: { art: 'audit', ref: 'F-003' }, start: '2027-01-13', erledigtAm: '2027-01-20' },
  // Massnahmen aus der Gap-Analyse (D-00) mit Bezug auf einen Normabschnitt oder ein Control
  { id: 'M-001', titel: 'Kontext, Geltungsbereich, KI-Leitlinie und Rollen erarbeiten', beschreibung: 'Themen und Parteien erfassen (D-01), Geltungsbereich (D-02), KI-Leitlinie (D-03) und Rollen (D-04) zur Freigabe durch den Geschäftsführer.', verantwortlich: 'P-002', termin: '2026-10-06', status: 'erledigt', prioritaet: 'hoch', herkunft: { art: 'pruefung', ref: 'K-4, K-5, A.2, A.3' }, erledigtAm: '2026-10-06' },
  { id: 'M-002', titel: 'KI-Inventar aufbauen', beschreibung: 'Umfrage in allen Bereichen, Auswertung von Lizenzen und Spesen, Gespräche mit Verkauf, AVOR und Disposition.', verantwortlich: 'P-003', termin: '2026-10-16', status: 'erledigt', prioritaet: 'hoch', herkunft: { art: 'pruefung', ref: 'A.4' }, erledigtAm: '2026-10-16' },
  { id: 'M-003', titel: 'Folgenabschätzungen einführen', beschreibung: 'Verfahren D-08 in der Kurzform, Kurzprüfung für jedes KI-System, vollständige Abschätzung bei Erreichen der Schwelle.', verantwortlich: 'P-002', termin: '2026-11-17', status: 'erledigt', prioritaet: 'hoch', herkunft: { art: 'pruefung', ref: 'K-6.1.4, K-8.4, A.5' }, erledigtAm: '2026-11-17' },
  { id: 'M-005', titel: 'Dokumentenlenkung für das AIMS festlegen', beschreibung: 'Kurzfassung der Lenkungsregeln zu Beginn (Ablage, Kennzeichnung, Freigabeweg), danach Register der Dokumente, Aufzeichnungen und externen Dokumente (D-26).', verantwortlich: 'P-002', termin: '2026-12-04', status: 'erledigt', prioritaet: 'mittel', herkunft: { art: 'pruefung', ref: 'K-7.5' }, erledigtAm: '2026-12-15' },
  { id: 'M-020', titel: 'Copilot-Lizenzen auf 15 erweitern', beschreibung: 'Drei weitere Lizenzen für die Arbeitsvorbereitung, Einführung der neuen Nutzenden nach D-15 und Eintrag im KI-Inventar.', verantwortlich: 'P-003', termin: '2027-03-31', status: 'offen', prioritaet: 'tief', herkunft: { art: 'aenderung', ref: 'MB-001' } },
  // Weitere Massnahmen aus der Gap-Analyse, geplante Änderungen am AIMS (6.3) und Entscheide der Managementbewertung
  { id: 'M-004', titel: 'Risikomethode, Behandlungsplan, Erklärung zur Anwendbarkeit und Ziele festlegen', beschreibung: 'Risikoverfahren D-06 mit Skalen und Akzeptanzkriterien, Register und Behandlungsplan D-07, Erklärung zur Anwendbarkeit D-11, Ziele und Messplan D-05; Freigabe durch den Geschäftsführer.', verantwortlich: 'P-002', termin: '2026-12-01', status: 'erledigt', prioritaet: 'hoch', herkunft: { art: 'pruefung', ref: 'K-6.1.1, K-6.1.2, K-6.1.3, K-6.2, K-6.3' }, erledigtAm: '2026-12-22' },
  { id: 'M-006', titel: 'Kompetenz, Bewusstsein, Kommunikation und Information festlegen', beschreibung: 'Kompetenzbedarf und Schulung (D-17), Bewusstsein und Kommunikationsplan, Information für Nutzende und Meldekanal für Kunden (D-14).', verantwortlich: 'P-002', termin: '2026-12-22', status: 'erledigt', prioritaet: 'mittel', herkunft: { art: 'pruefung', ref: 'K-7.1, K-7.2, K-7.3, K-7.4, A.8' }, erledigtAm: '2026-12-22' },
  { id: 'M-007', titel: 'Betrieb, Daten, Nutzungsregeln und Lieferanten regeln', beschreibung: 'Lebenszyklus mit Abnahme und Überwachung eingekaufter Systeme (D-12), Datenregeln (D-13), Richtlinie KI-Nutzung (D-15) und Lieferantenprüfung (D-16).', verantwortlich: 'P-003', termin: '2026-12-15', status: 'erledigt', prioritaet: 'hoch', herkunft: { art: 'pruefung', ref: 'K-8, A.6, A.7, A.9, A.10' }, erledigtAm: '2026-12-15' },
  { id: 'M-008', titel: 'Internes Audit, Managementbewertung und Verbesserung einrichten', beschreibung: 'Auditprogramm und Beauftragung einer externen Auditorin (D-20), Agenda der Managementbewertung (D-21), Register der Nichtkonformitäten und Verbesserungen (D-22).', verantwortlich: 'P-002', termin: '2027-01-26', status: 'erledigt', prioritaet: 'hoch', herkunft: { art: 'pruefung', ref: 'K-9, K-10' }, erledigtAm: '2027-01-26' },
  { id: 'M-017', titel: 'ERP-Update vom 08.12.2026 mit geänderter KI-Funktion bewerten', beschreibung: 'Das Update änderte die Gewichtung der Auftragslage in den Bestellvorschlägen. Release Notes nachträglich ausgewertet, Vorschläge eines Monats mit dem tatsächlichen Bedarf verglichen, Risiken R-005 und R-006 und die Kurzprüfung IA-002 neu beurteilt, den Lieferanten L-002 neu geprüft (D-16), Disposition informiert.', verantwortlich: 'P-003', termin: '2027-01-08', status: 'erledigt', prioritaet: 'mittel', herkunft: { art: 'aenderung', ref: 'KI-002' }, start: '2027-01-05', erledigtAm: '2027-01-08' },
  { id: 'M-021', titel: 'Pensum der AIMS-Verantwortlichen nach Stage 1 auf 20 % festlegen', beschreibung: 'Pensum ab März 2027 auf 20 % senken, Aufgaben im Jahresplan verteilen, Stellvertretung durch den Geschäftsführer bestätigen.', verantwortlich: 'P-001', termin: '2027-03-31', status: 'offen', prioritaet: 'mittel', herkunft: { art: 'aenderung', ref: 'MB-001' } },
  { id: 'M-022', titel: 'Prüfregel für Offerten vereinheitlichen', beschreibung: 'Jede Offerte mit KI-Text wird vor dem Versand geprüft und mit Prüfvermerk versehen, ab CHF 20 000 im Vier-Augen-Prinzip; Regel in D-15, D-07 und D-11 gleich beschreiben; Messung von Z-002 im nächsten Quartal.', verantwortlich: 'P-005', termin: '2027-03-31', status: 'in-arbeit', prioritaet: 'hoch', herkunft: { art: 'managementbewertung', ref: 'MB-001, F-004' }, start: '2027-01-26' },
];

const dokIds = ['D-00', 'D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06', 'D-07', 'D-08', 'D-09', 'D-10', 'D-11', 'D-12', 'D-13', 'D-14', 'D-15', 'D-16', 'D-17', 'D-20', 'D-21', 'D-22', 'D-24', 'D-25', 'D-26'];
const dokDaten: Record<string, [string, string, string, string | undefined]> = {
  'D-00': ['1.0', 'P-002', '2026-09-01', undefined], 'D-01': ['1.1', 'P-002', '2027-01-26', '2028-01-31'], 'D-02': ['1.1', 'P-002', '2026-12-15', '2027-10-31'],
  'D-03': ['1.0', 'P-002', '2026-10-06', '2027-10-31'], 'D-04': ['1.2', 'P-002', '2027-01-26', '2027-10-31'], 'D-05': ['1.1', 'P-002', '2027-01-26', '2027-10-31'],
  'D-06': ['1.0', 'P-002', '2026-11-03', '2027-11-30'], 'D-07': ['1.1', 'P-002', '2027-01-26', '2027-04-30'], 'D-08': ['1.0', 'P-002', '2026-11-03', '2027-11-30'],
  'D-09': ['1.0', 'P-002', '2026-11-17', '2027-11-30'], 'D-10': ['1.2', 'P-003', '2027-01-08', '2027-07-31'], 'D-11': ['1.1', 'P-002', '2027-01-26', '2027-10-31'],
  'D-12': ['1.0', 'P-003', '2026-12-15', '2027-12-31'], 'D-13': ['1.0', 'P-004', '2026-12-15', '2027-12-31'], 'D-14': ['1.0', 'P-002', '2026-12-15', '2027-12-31'],
  'D-15': ['1.0', 'P-002', '2026-12-15', '2027-12-31'], 'D-16': ['1.1', 'P-003', '2027-01-08', '2027-12-31'], 'D-17': ['1.1', 'P-002', '2027-01-28', '2027-12-31'],
  'D-20': ['1.1', 'P-002', '2027-01-15', '2027-12-31'], 'D-21': ['1.0', 'P-002', '2027-01-26', '2028-01-31'], 'D-22': ['1.1', 'P-002', '2027-01-28', '2027-12-31'],
  'D-24': ['1.0', 'P-002', '2026-10-20', '2027-10-31'], 'D-25': ['1.0', 'P-002', '2027-01-26', '2027-06-30'], 'D-26': ['1.2', 'P-002', '2027-01-28', '2027-12-31'],
};
const dokumente: DokumentEintrag[] = dokIds.map((id) => {
  const [version, eigner, am, naechste] = dokDaten[id]!;
  return { id, version, status: 'freigegeben', eigner, freigabe: gf(am), ...(naechste ? { naechsteUeberpruefung: naechste } : {}), ablageort: `${Q} (Ordner nach Dokumentnummer)`, giltFuerIsms: false };
});
// Folgenabschätzungen als eigene Dokumente D-09-KI-xxx; Freigabe und Datum aus der Abschätzung (letzte Neubeurteilung)
for (const [ki, version, eigner] of [['KI-001', '1.1', 'P-003'], ['KI-002', '1.1', 'P-005'], ['KI-003', '1.0', 'P-004'], ['KI-004', '1.0', 'P-005']] as const) {
  dokumente.push({ id: `D-09-${ki}`, version, status: 'freigegeben', eigner, ablageort: `${Q} > 09_Folgen`, giltFuerIsms: false });
}

// Checkliste AU-001: gesehener Nachweis und Stichprobe je Prüfpunkt (Stand der Dokumente zum Audit); das Ergebnis folgt
// aus den Feststellungen (Normbezug), sonst «konform». Ausgeschlossene Controls: Prüfung der Begründung in D-11.
const MA = 'Interview mit vier Mitarbeitenden in Produktion und Verkauf';
const CHECKLISTE: Record<string, [string, string?]> = {
  '4.1': ['D-01 v1.0, D-24 v1.0', 'TH-001, TH-004'], '4.2': ['D-01 v1.0', 'IP-001, IP-002'], '4.3': ['D-02 v1.1', 'KI-003, KI-004'], '4.4': ['D-02 v1.1', 'Antrag und Freigabe von KI-001'],
  '5.1': ['N-001, D-03 v1.0, D-07 v1.0', 'Interview mit Martin Zürcher'], '5.2': ['D-03 v1.0', MA], '5.3': ['D-04 v1.1', 'RO-001, RO-016'],
  '6.1.1': ['D-06 v1.0, D-07 v1.0', 'R-010, R-011'], '6.1.2': ['D-06 v1.0, D-07 v1.0', 'R-001, R-007'], '6.1.3': ['D-07 v1.0, D-11 v1.0', 'R-001, R-005'],
  '6.1.4': ['D-08 v1.0, D-09-KI-003 v1.0, D-09-KI-004 v1.0', 'IA-003, IA-004'], '6.2': ['D-05 v1.0', 'Z-002, Z-003'], '6.3': ['D-26 v1.1', 'M-014'], '7.1': ['D-00 v1.0, D-10 v1.2', 'KI-003'],
  '7.2': ['D-17 v1.0', 'K-001, K-003'], '7.3': ['D-17 v1.0, D-15 v1.0, N-007', MA], '7.4': ['D-17 v1.0', 'KO-001, KO-003'], '7.5': ['D-26 v1.1', 'D-03, D-07, D-09'],
  '8.1': ['D-12 v1.0, D-16 v1.1', 'KI-002, KI-003'], '8.2': ['D-07 v1.0', 'R-005, R-006'], '8.3': ['D-07 v1.0', 'M-009, M-015'], '8.4': ['D-09-KI-002 v1.1', 'IA-002'],
  '9.1': ['D-05 v1.0, N-009', 'Z-001, Z-002, Z-003'], '9.2': ['D-20 v1.0', 'AU-001'], '9.3': ['Jahresplan mit Termin der Managementbewertung', 'Einladung zur Bewertung am 26.01.2027'], '10.1': ['D-22 v1.0', 'M-013'], '10.2': ['D-22 v1.0', 'QM-Korrekturmassnahme KM-2026-11'],
  'A.2.2': ['D-03 v1.0, N-002', MA], 'A.2.3': ['D-03 v1.0', 'QM-Handbuch Kapitel 7'], 'A.2.4': ['D-03 v1.0, Jahresplan mit Überprüfung in der Managementbewertung', 'D-03'], 'A.3.2': ['D-04 v1.1, N-003', 'RO-006, RO-011'], 'A.3.3': ['D-04 v1.1, N-003', 'Interview mit Sabine Hofer'],
  'A.4.2': ['D-10 v1.2, N-004', 'KI-001, KI-002, KI-003, KI-004'], 'A.4.3': ['D-10 v1.2', 'KI-001'], 'A.4.4': ['D-10 v1.2', 'KI-002'], 'A.4.5': ['D-10 v1.2', 'KI-001, KI-003'], 'A.4.6': ['D-10 v1.2, D-17 v1.0', 'KI-003'],
  'A.5.2': ['D-08 v1.0, N-005', 'IA-002, IA-004'], 'A.5.3': ['N-006', 'IA-001, IA-004'], 'A.5.4': ['D-09-KI-003 v1.0, D-09-KI-004 v1.0', 'IA-003, IA-004'], 'A.5.5': ['D-09-KI-003 v1.0, D-09-KI-004 v1.0', 'IA-003, IA-004'],
  'A.6.1.2': ['D-11 v1.0'], 'A.6.1.3': ['D-11 v1.0'], 'A.6.2.2': ['N-008, D-12 v1.0', 'KI-003'], 'A.6.2.3': ['D-11 v1.0'], 'A.6.2.4': ['N-008', 'KI-002, KI-003'], 'A.6.2.5': ['N-008', 'KI-002'],
  'A.6.2.6': ['N-009', 'KI-002'], 'A.6.2.7': ['N-010', 'KI-003'], 'A.6.2.8': ['N-011', 'KI-001, KI-003'], 'A.7.2': ['D-11 v1.0'], 'A.7.3': ['N-019', 'KI-003'], 'A.7.4': ['N-019, N-009', 'KI-002'], 'A.7.5': ['N-011', 'KI-003'], 'A.7.6': ['D-11 v1.0'],
  'A.8.2': ['N-010, N-016', 'KI-001'], 'A.8.3': ['N-013', 'IP-001'], 'A.8.4': ['N-013', 'KI-004'], 'A.8.5': ['N-020', 'IP-001'], 'A.9.2': ['D-15 v1.0, N-007', 'KI-004'], 'A.9.3': ['D-05 v1.0', 'Z-002'],
  'A.9.4': ['D-10 v1.2, N-007', 'KI-001, KI-002'], 'A.10.2': ['D-16 v1.1', 'L-002'], 'A.10.3': ['D-16 v1.1, N-012', 'L-002, L-003'], 'A.10.4': ['N-016', 'IP-001'],
};

// Blatt «Stichproben» des Audits AU-001: KI-003 durch die Schritte 1 bis 7, danach die Prüftests 8 bis 13
const STICHPROBEN: NonNullable<Audit['stichproben']> = [
  { nr: 1, nachweis: 'D-10 v1.2: KI-003 mit Eigner, Zweck, Handlungsbefugnis «bereitet vor» und Version 2026.2; Vorführung am CAM-Arbeitsplatz stimmt mit dem Inventar überein.', ergebnis: 'konform' },
  { nr: 2, nachweis: 'R-007 und R-008 mit Behandlung, Restrisiko am 17.11.2026 mit der Freigabe von KI-003 vom Geschäftsführer angenommen (D-07 v1.0).', ergebnis: 'konform' },
  { nr: 3, nachweis: 'IA-003: Kurzprüfung vom 05.11.2026, vollständige Abschätzung am 17.11.2026 freigegeben, Fairness begründet als nicht relevant.', ergebnis: 'konform' },
  { nr: 4, nachweis: 'D-11 v1.0: A.6.2.4, A.9.3 und A.9.4 aus R-007 anwendbar, Umsetzung mit Nachweis N-008.', ergebnis: 'konform' },
  { nr: 5, nachweis: 'Freigabe von KI-003 durch den Geschäftsführer am 17.11.2026 mit Auflagen (Simulation, Einzelsatz, zweite Person bei Medizinteilen), wie in D-04 für hohes Risiko verlangt.', ergebnis: 'konform' },
  { nr: 6, nachweis: 'Stichprobe von 10 CAM-Programmen im Dezember 2026 (Z-002) mit Simulation und Vermerk «KI-Vorschlag»; Protokolle der Programmversionen.', ergebnis: 'konform' },
  { nr: 7, nachweis: 'Keine Meldung und kein Vorfall zu KI-003; Crash- und Ausschussmeldungen Oktober bis Dezember 2026 ohne Bezug zur KI.', ergebnis: 'konform' },
  { nr: 8, nachweis: 'Befragung in Verkauf und Qualität: genannte Werkzeuge Copilot und ERP-KI stehen im Inventar, keine weitere Schatten-KI.', ergebnis: 'konform' },
  { nr: 9, nachweis: 'Korrekturquote vom 31.12.2026: Copilot 3 von 10 Offerttexten wesentlich geändert, CAM-KI 4 von 10 Vorschlägen angepasst; plausibel zum Abnahmetest.', ergebnis: 'konform' },
  { nr: 10, nachweis: 'Testfrage an zwei Personen in der Produktion: beide richtig; vier Temporärmitarbeitende ohne Einführung (F-001).', ergebnis: 'nk-leicht' },
  { nr: 11, nachweis: 'Meldung ME-001 vom 21.12.2026 vom Eingang bis zum Abschluss am 29.12.2026 verfolgt, Fristen eingehalten.', ergebnis: 'konform' },
  { nr: 12, nachweis: 'Vor dem ersten Audit keine geschlossenen Feststellungen; Korrektur der Schatten-KI KI-004 (Konten gelöscht, Webzugriff gesperrt) in der Proxy-Auswertung nachvollzogen.', ergebnis: 'konform' },
  { nr: 13, nachweis: 'Erste Managementbewertung am 26.01.2027 geplant, Einladung mit Traktanden liegt vor.', ergebnis: 'nicht-pruefbar' },
];

export function praezisionsteile(): Projekt {
  const p: Projekt = {
    schemaVersion: 1,
    kitVersion: '1.0.0',
    meta: {
      projektId: '0b9e4d27-8c3a-4f61-a5d2-7e1f6c9b3a80',
      erstellt: '2026-08-31T07:30:00.000Z',
      geaendert: '2027-01-29T15:10:00.000Z',
      dokumentSprache: 'de', mitIsms: false, ismsZertifiziert: false, modulAiAct: false,
      gefuehrt: {
        aktuelleEtappe: 'E13', aktuelleSeite: 'E13-unterlagen', etappen: {},
        antworten: {
          isms: 'nein',
          bekannteKiWerkzeuge: ['M365 Copilot', 'KI-Funktion im ERP (Disposition)', 'KI-Assistent im CAM-System'],
          ausloeser: ['lieferantenaudit', 'kunde'],
          vorhandeneSysteme: ['iso9001', 'iso13485', 'datenschutz'],
          gap: { k4: 'fehlt', k5: 'fehlt', k6: 'begonnen', inventar: 'fehlt', k7: 'begonnen', k8: 'fehlt', k9: 'weitgehend', k10: 'weitgehend' },
          projekt: { ziel: 'Nachweis der KI-Steuerung für das Lieferantenaudit der Medivo Medtech AG und Zertifizierung nach ISO/IEC 42001 bis 30.06.2027 mit schlankem Aufbau; Stage-1-Bereitschaft nach rund 150 Tagen.', aufwandPt: 55, budget: 38000, pensumProzent: 40, freigabe: gf('2026-09-01'), glTraktandum: 'quartalsweise' },
          grundlagen: {
            prozesse: ['Offerte und Auftragsabwicklung', 'Arbeitsvorbereitung und CAM-Programmierung', 'CNC-Fertigung', 'Qualitätsprüfung und Freigabe', 'Disposition und Einkauf', 'Versand'],
            organigramm: 'QM-Handbuch Kapitel 5, Organigramm 2026',
            itBetrieb: 'Ein IT-Verantwortlicher (Teilzeit) mit externem IT-Partner; M365 und ERP als Cloud-Dienste, CAM-Arbeitsplätze lokal.',
          },
          kiZweck: { ziele: ['effizienz', 'qualitaet'], text: 'KI hilft beim Programmieren, Disponieren und Schreiben; sie trifft keine Entscheide und kommt nicht in unsere Produkte.' },
          aimsProzesse: ['inventar', 'freigabe-werkzeuge', 'risiko', 'folgen', 'lieferanten', 'schulung', 'vorfall', 'audit', 'managementbewertung'],
          leitlinie: { elemente: ['zweck', 'zielrahmen', 'anforderungen', 'verbesserung'], bezug: ['qualitaet', 'datenschutz', 'verhaltenskodex'], bezugNotiz: 'Abgleich am 29.09.2026.' },
          meldeweg: { kanaele: ['vorgesetzte', 'aims', 'postfach'], ausweichstelle: 'P-001', vertraulich: true, fristTage: 10 },
          inventar: { quellen: ['lizenzen', 'umfrage', 'fachbereiche', 'spesen'], fragebogenBereiche: ['verkauf', 'produktion', 'qualitaet', 'logistik'], ruecklaufBis: '2026-09-25' },
          werkzeugFreigabe: { wer: 'P-002', kriterien: ['vertraulichkeit', 'vertrag', 'datenschutz', 'nutzen', 'exportkontrolle'], fristTage: 10 },
          aiActVermerk: {
            text: 'Das AI-Act-Modul ist derzeit nicht nötig. Wir bringen keine KI in Verkehr und bauen keine KI in unsere Produkte ein; alle KI-Systeme sind eingekaufte Werkzeuge für interne Arbeit (Betreiber). Offerttexte, die mit Copilot entworfen werden, gehen auch an Kunden in Deutschland; damit wird eine KI-Ausgabe in der EU verwendet (Art. 2(1) Bst. c). Kein System fällt unter Anhang III, ist ein Sicherheitsbauteil oder löst eine Transparenzpflicht aus. Für Betreiber minimaler Risiken gilt die Förderung der KI-Kompetenz (Art. 4), die wir mit der Schulung abdecken. Die Einstufung ist eine eigene Einschätzung ohne juristische Prüfung; sie wird jährlich und bei jedem neuen KI-System überprüft, zuerst am 20.01.2027. Bei Unsicherheit, etwa wenn KI im Personalbereich eingesetzt wird oder KI in Produkte kommt, lassen wir die Frage juristisch prüfen und schalten das Modul ein.',
            naechstePruefung: '2027-09-30',
          },
          neubeurteilung: { rhythmus: 'jaehrlich', ausloeser: ['neues-system', 'wesentliche-aenderung', 'vorfall', 'lieferantenwechsel'] },
          folgen: { durchfuehrung: 'P-002', freigabe: 'P-001', rhythmus: 'jaehrlich', ausloeser: ['neues-system', 'wesentliche-aenderung', 'vorfall'] },
          protokolle: { inhalt: ['nutzende', 'aenderungen', 'fehler'], aufbewahrungMonate: 6, auswertung: 'halbjaehrlich' },
          meldekanal: { adresse: 'qualitaet@praezisionsteile.example', bearbeitung: 'P-002', fristTage: 10, vorfallVerfahren: 'Vorfallablauf in D-14, Reklamationsprozess QM' },
          nutzung: { regeln: ['nur-freigegebene', 'keine-vertraulichen-daten', 'ergebnisse-pruefen', 'firmenkonten', 'exportkontrolle', 'melden'], bestaetigung: true },
          bewusstsein: { formate: ['einfuehrung', 'teamsitzung', 'merkblatt', 'bestaetigung'], rhythmus: 'jaehrlich' },
          lenkung: { ablage: 'Laufwerk Q: > AIMS, Ordner nach Dokumentnummer', namensregel: 'ID_Titel', freigabe: 'geschaeftsleitung', aufbewahrungJahre: 10, extern: 'Normen und Kundenvorgaben im Ordner 99_Extern mit Stand-Datum.' },
          aenderungen: { weg: 'massnahmenliste', notiz: 'Änderungen am AIMS als Massnahme in D-07 bzw. D-22 erfassen.' },
          auditprogramm: { rhythmus: 'jaehrlich', methoden: ['interviews', 'dokumente', 'stichproben'] },
          verbesserung: { quellen: ['audit', 'managementbewertung', 'meldungen', 'kunden', 'mitarbeitende'] },
          zertifizierung: { stelle: 'Certimont Zertifizierung AG', akkreditiert: true, unterlagen: ['geltungsbereich', 'leitlinie', 'rollen', 'inventar', 'risiko', 'folgen', 'soa', 'ziele', 'audit', 'managementbewertung', 'nichtkonformitaeten', 'dokumente'] },
          jahr: { monatAudit: 'januar', monatMb: 'januar', monatUeberwachung: 'februar' },
        },
      },
      checklisten: {},
    },
    organisation: {
      name: 'Beispiel Präzisionsteile GmbH',
      branche: 'metall',
      mitarbeitende: 45,
      standorte: 'Ein Werk im Mittelland (CNC-Drehen und Fräsen, Qualitätsprüfung, Verwaltung).',
      euBezug: { kundenEu: true, outputEu: true, niederlassungEu: false },
      entwickeltKi: false,
      verkauftKiProdukte: false,
      zielterminZertifizierung: '2027-06-30',
      zielterminStage1: '2027-01-29',
      aimsVerantwortlich: 'P-002',
      kontext: {
        themen: [
          { id: 'TH-001', art: 'extern', kategorie: 'vertrag', beschreibung: 'Der Grosskunde Medivo Medtech AG verlangte im Lieferantenaudit vom 16.06.2026 einen Nachweis, wie wir KI steuern; ein zweiter Grosskunde (Automobil) stellte im Dezember 2026 dieselbe Anfrage.', auswirkung: 'Auslöser des Projekts; Selbstauskunft und Zertifizierung.' },
          { id: 'TH-002', art: 'extern', kategorie: 'vertrag', beschreibung: 'Geheimhaltungsvereinbarungen mit Medizintechnik- und Automobilkunden für Zeichnungen und Stücklisten.', auswirkung: 'Kundendaten nur in freigegebenen Systemen.' },
          { id: 'TH-003', art: 'extern', kategorie: 'regulierung', beschreibung: 'ISO 13485 der Kunden: validierte Prozesse und Rückverfolgbarkeit für Medizinteile.', auswirkung: 'Programmfreigabe und Versionsvermerk bei CAM-KI.' },
          { id: 'TH-004', art: 'extern', kategorie: 'recht', beschreibung: 'Datenschutzgesetz, Güterkontrollrecht für einzelne Automobilteile; EU AI Act für Betreiber minimaler Risiken: Offerttexte aus Copilot gehen auch an Kunden in Deutschland (Art. 2(1) Bst. c).', auswirkung: 'KI-Kompetenz nach Art. 4 mit der Schulung abgedeckt; Prüfung der AI-Act-Betroffenheit jährlich und bei jedem neuen KI-System, zuletzt am 20.01.2027 (M-019).' },
          { id: 'TH-005', art: 'intern', kategorie: 'kultur', beschreibung: 'Kleine Teams, kurze Wege, wenig Zeit für Dokumentation; Schatten-KI im Verkauf.', auswirkung: 'Schlanker Aufbau, wenige klare Regeln.' },
          { id: 'TH-006', art: 'intern', kategorie: 'governance', beschreibung: 'QM nach ISO 9001 und ISO 13485, kein ISMS; IT mit externem Partner.', auswirkung: 'AIMS nutzt QM-Prozesse für Dokumente, Audit und Korrekturen.' },
        ],
        klimawandelRelevant: 'nein',
        klimawandelBegruendung: 'Nicht relevant für unseren KI-Einsatz: nur eingekaufte Werkzeuge mit geringem Rechenbedarf, keine eigenen Modelle. Der Klimawandel wirkt auf die Energiekosten der Fertigung, nicht auf die KI-Nutzung. Überprüfung mit dem Kontext jährlich.',
      },
      rollenIso: [
        { rolle: 'kunde', bemerkung: 'Wir nutzen eingekaufte KI (Copilot, ERP-KI, CAM-KI); keine eigene Entwicklung, kein Verkauf von KI.' },
      ],
      geltungsbereich: {
        beschreibung: 'Das KI-Managementsystem umfasst die Nutzung aller KI-Systeme der Beispiel Präzisionsteile GmbH in Offertwesen, Arbeitsvorbereitung, Disposition und Verwaltung. Grundlage sind die Themen TH-001 bis TH-006 und die Anforderungen der Parteien IP-001 bis IP-005. Die Organisation ist Kundin (Betreiberin) eingekaufter KI.',
        grenzenOrganisation: 'Ganze Firma.', grenzenTechnik: 'M365-Mandant, ERP (Cloud), CAM-Arbeitsplätze; nicht enthalten sind Steuerungen der CNC-Maschinen ohne KI-Funktion.', grenzenStandorte: 'Werk Mittelland.',
        schnittstellen: 'Kunden (Selbstauskunft, Qualitätssicherungsvereinbarungen), IT-Partner, ERP- und CAM-Lieferant, QM-System.',
        ausschluesse: [],
        freigabe: gf('2026-10-06'),
      },
      leitlinie: {
        version: '1.0',
        grundsaetze: [
          'KI unterstützt, der Mensch entscheidet und prüft jedes Ergebnis, bevor es zum Kunden oder in die Maschine geht.',
          'Kundenzeichnungen, Stücklisten und Personendaten geben wir nur in freigegebene Systeme mit Firmenkonto ein.',
          'Neue KI-Werkzeuge beantragen wir bei der AIMS-Verantwortlichen, bevor wir sie nutzen; bei hohem Risiko entscheidet der Geschäftsführer.',
          'Wir halten Geheimhaltungsvereinbarungen, Datenschutz und Exportkontrolle ein und erfüllen die Anforderungen unserer Kunden.',
          'Fehler und Bedenken melden wir sofort; wer meldet, hat keine Nachteile.',
          'Wir prüfen den KI-Einsatz jährlich und verbessern unsere Regeln.',
        ],
        ausnahmeprozess: 'Ausnahmen bewilligt die Geschäftsführung schriftlich, befristet auf höchstens 3 Monate, nach Rücksprache mit der AIMS-Verantwortlichen.',
        freigabe: gf('2026-10-06'), kommuniziertAm: '2026-10-12', naechsteUeberpruefung: '2027-10-31',
      },
      risikokriterien: {
        zeitraum: 'pro-jahr',
        wahrscheinlichkeit: [
          { stufe: 1, bezeichnung: 'selten', beschreibung: 'seltener als alle 3 Jahre' },
          { stufe: 2, bezeichnung: 'möglich', beschreibung: 'einmal in 1 bis 3 Jahren' },
          { stufe: 3, bezeichnung: 'häufig', beschreibung: 'mindestens einmal pro Jahr' },
        ],
        auswirkung: [
          { stufe: 1, bezeichnung: 'gering', beschreibung: 'unter CHF 10 000, intern behebbar' },
          { stufe: 2, bezeichnung: 'mittel', beschreibung: 'CHF 10 000 bis 100 000, Reklamation, Abweichung im Kundenaudit' },
          { stufe: 3, bezeichnung: 'hoch', beschreibung: 'über CHF 100 000, Verlust eines Grosskunden, Verletzung von Rechten Dritter, Gefährdung von Personen' },
        ],
        akzeptanzBis: 3, unannehmbarAb: 6, ausIsmsUebernommen: false,
      },
    },
    personen: [
      { id: 'P-001', name: 'Martin Zürcher', funktion: 'Geschäftsführer', aimsRollen: ['gl'] },
      { id: 'P-002', name: 'Andrea Baumann', funktion: 'Leiterin Qualität, AIMS-Verantwortliche', aimsRollen: ['aims', 'dsb'] },
      { id: 'P-003', name: 'Reto Schneider', funktion: 'IT-Verantwortlicher (Teilzeit)', aimsRollen: ['it'] },
      { id: 'P-004', name: 'Jonas Kälin', funktion: 'Leiter Arbeitsvorbereitung und CAM', aimsRollen: ['fachbereich'] },
      { id: 'P-005', name: 'Sabine Hofer', funktion: 'Leiterin Verkauf und Disposition', aimsRollen: ['fachbereich', 'einkauf'] },
      { id: 'P-006', name: 'Ursula Brand', funktion: 'Externe Auditorin, Brunnmatt Audit GmbH', aimsRollen: ['auditor'] },
    ],
    parteien: [
      { id: 'IP-001', name: 'Medivo Medtech AG (Grosskunde Medizintechnik)', art: 'extern', anforderungen: [
        { text: 'Nachweis, wie KI gesteuert wird, und dass Kundenzeichnungen nicht in öffentliche KI-Dienste gelangen.', quelle: 'vertrag', adressiert: 'ja', begruendung: 'Selbstauskunft N-016, Zertifizierung, Richtlinie D-15' },
        { text: 'Rückverfolgbarkeit von Programmständen bei Medizinteilen.', quelle: 'norm', adressiert: 'ja', begruendung: 'M-015, A.6.2.8' },
      ] },
      { id: 'IP-002', name: 'Automobilkunden in Deutschland', art: 'extern', anforderungen: [
        { text: 'Einhaltung der Geheimhaltungsvereinbarungen und der Exportkontrolle.', quelle: 'vertrag', adressiert: 'ja', begruendung: 'Richtlinie D-15, M-010' },
      ] },
      { id: 'IP-003', name: 'Mitarbeitende', art: 'intern', anforderungen: [
        { text: 'Klare, kurze Regeln und freigegebene Werkzeuge statt Verboten ohne Alternative.', quelle: 'intern', adressiert: 'ja', begruendung: 'Copilot freigegeben, Richtlinie auf zwei Seiten' },
      ] },
      { id: 'IP-004', name: 'Geschäftsführung und Inhaber', art: 'intern', anforderungen: [
        { text: 'Kundennachweis mit vertretbarem Aufwand (unter 60 Personentagen).', quelle: 'intern', adressiert: 'ja', begruendung: 'Schlanker Aufbau, Projektauftrag D-00' },
      ] },
      { id: 'IP-005', name: 'Lieferanten von ERP, CAM und M365', art: 'extern', anforderungen: [
        { text: 'Nutzung gemäss Lizenz- und Nutzungsbedingungen.', quelle: 'vertrag', adressiert: 'ja', begruendung: 'Lieferantenprüfung D-16' },
      ] },
    ],
    rollen: [
      { id: 'RO-001', bereich: 'konformitaet', verantwortlich: 'P-002', rechenschaft: 'P-001', konsultiert: ['P-003'], informiert: [] },
      { id: 'RO-002', bereich: 'berichterstattung', verantwortlich: 'P-002', rechenschaft: 'P-001', konsultiert: [], informiert: [] },
      { id: 'RO-003', bereich: 'risikomanagement', verantwortlich: 'P-002', rechenschaft: 'P-001', konsultiert: ['P-003', 'P-004', 'P-005'], informiert: [] },
      { id: 'RO-004', bereich: 'inventar', verantwortlich: 'P-003', rechenschaft: 'P-002', konsultiert: ['P-004', 'P-005'], informiert: ['P-001'] },
      { id: 'RO-005', bereich: 'lieferanten', verantwortlich: 'P-003', rechenschaft: 'P-001', konsultiert: ['P-002'], informiert: [] },
      { id: 'RO-006', bereich: 'menschliche-aufsicht', verantwortlich: 'P-004', rechenschaft: 'P-001', konsultiert: ['P-002'], informiert: ['P-005'] },
      { id: 'RO-007', bereich: 'vorfall', verantwortlich: 'P-001', rechenschaft: 'P-001', konsultiert: ['P-002', 'P-003'], informiert: [] },
    ],
    kiSysteme: [
      { id: 'KI-001', name: 'M365 Copilot', typ: 'saas', beschreibung: 'KI-Assistent in Word, Outlook, Excel und Teams mit 12 Lizenzen in Verkauf, Qualität und Verwaltung; ersetzt im Verkauf den untersagten kostenlosen Chatbot.', zweck: 'Offerttexte, Prüfberichte und Korrespondenz entwerfen, Sitzungen zusammenfassen.', fachbereich: 'verkauf', eigner: 'P-003', lieferant: 'L-001', personendaten: true, besondereDaten: false, betroffene: 'Mitarbeitende; Kunden, deren Daten in Dokumenten vorkommen.', automatisierung: 'unterstuetzend', lebenszyklus: 'betrieb', status: 'freigegeben',
        ressourcen: res('Daten im eigenen M365-Mandanten gemäss Berechtigungen, inklusive Kundenzeichnungen im Verkaufsordner.', 'M365 Copilot.', 'Cloud-Dienst, Datenhaltung Schweiz und EU.', 'IT-Verantwortlicher mit IT-Partner, 12 Nutzende.'), sensibleNutzung: false,
        aiAct: { rollen: ['betreiber'], risikoklasse: 'minimal', transparenz: [], gpai: true, anwendungsbereich: ['c'], begruendung: 'Betreiber eines Büroassistenten; Offerttexte gehen auch an Kunden in Deutschland, damit wird die Ausgabe in der EU verwendet (Art. 2(1) Bst. c). Minimales Risiko: kein Anhang-III-Fall und keine Transparenzpflicht nach Art. 50(4), weil die Texte nicht zur Information der Öffentlichkeit veröffentlicht werden; es gilt die KI-Kompetenz nach Art. 4 (eigene Einschätzung).', juristischGeprueft: false },
        datenqualitaet: 'Textbausteine und Vorlagen für Offerten jährlich geprüft; Werkstoff- und Toleranzangaben nur aus dem freigegebenen Werkstoffkatalog; Kundenzeichnungen nur im Verkaufsordner mit Geheimhaltungsvereinbarung.',
        naechsteUeberpruefung: '2027-06-30', erfasstAm: '2026-09-10' },
      { id: 'KI-002', name: 'KI-Funktion Disposition im ERP', typ: 'saas', beschreibung: 'Funktion des Cloud-ERP, die Bestellvorschläge für Stangenmaterial und Werkzeuge sowie Liefertermine aus der Auftragslage schätzt. Das Update vom 08.12.2026 änderte die Berechnung der Bestellvorschläge; neu beurteilt am 08.01.2027.', zweck: 'Material rechtzeitig und in passender Menge bestellen, realistische Liefertermine nennen.', fachbereich: 'logistik', eigner: 'P-005', lieferant: 'L-002', personendaten: false, besondereDaten: false, betroffene: 'Disposition und Verkauf; indirekt Kunden über Liefertermine.', automatisierung: 'unterstuetzend', lebenszyklus: 'betrieb', status: 'freigegeben',
        ressourcen: res('Auftrags-, Lager- und Lieferantendaten im ERP.', 'ERP-Modul «Bedarfsprognose».', 'Cloud-Dienst des ERP-Anbieters, Rechenzentrum Schweiz.', 'Disponentin, Leiterin Verkauf und Disposition.'), sensibleNutzung: false,
        aiAct: { rollen: ['betreiber'], risikoklasse: 'minimal', transparenz: [], gpai: false, anwendungsbereich: ['c'], begruendung: 'Betreiber der Dispositionsfunktion; die geschätzten Liefertermine teilen wir auch Kunden in Deutschland mit, damit wird eine Ausgabe in der EU verwendet (Art. 2(1) Bst. c). Minimales Risiko: interne Planung, kein Anhang-III-Fall, keine Transparenzpflicht (eigene Einschätzung).', juristischGeprueft: false },
        datenqualitaet: 'Materialstammdaten (Wiederbeschaffungszeit, Mindestbestand, Lieferant) für alle aktiven Artikel vollständig, jährliche Bereinigung; Abweichung zwischen Vorschlag und Bedarf höchstens 10 % in der Monatskontrolle.',
        naechsteUeberpruefung: '2027-06-30', erfasstAm: '2026-09-10', geaendertAm: '2027-01-08' },
      { id: 'KI-003', name: 'KI-gestützte CAM-Programmierung', typ: 'eingekauft', beschreibung: 'Funktion der CAM-Software, die Bearbeitungsmerkmale aus 3D-Modellen erkennt und Werkzeugwege mit Schnittdaten vorschlägt. Läuft lokal auf drei CAM-Arbeitsplätzen.', zweck: 'Programmierzeit für neue Teile verkürzen; jedes Programm wird simuliert und von einer Fachperson freigegeben.', fachbereich: 'produktion', eigner: 'P-004', lieferant: 'L-003', personendaten: false, besondereDaten: false, betroffene: 'CAM-Programmierer und Einrichter; indirekt Kunden über die Teilequalität und bei Implantat- und Medizinteilen Patientinnen und Patienten.', automatisierung: 'unterstuetzend', lebenszyklus: 'betrieb', status: 'eingeschraenkt',
        ressourcen: res('3D-Modelle und Zeichnungen der Kunden, Werkzeug- und Spannmittelbibliothek.', 'CAM-Software mit KI-Modul, Version 2026.2.', 'Lokale CAM-Arbeitsplätze, keine Cloud.', 'Zwei CAM-Programmierer, Leiter Arbeitsvorbereitung.'), sensibleNutzung: true,
        aiAct: { rollen: ['betreiber'], risikoklasse: 'minimal', transparenz: [], gpai: false, anwendungsbereich: [], begruendung: 'Betreiber eines Programmierwerkzeugs; die Programme laufen nur im Werk Mittelland, in die EU gehen nur die gefertigten Teile, deshalb kein Bezug nach Art. 2(1). Kein Sicherheitsbauteil eines Produkts; Ergebnisse werden simuliert und freigegeben (eigene Einschätzung).', juristischGeprueft: false },
        datenqualitaet: 'Spannmittel- und Werkzeugbibliothek vollständig und freigegeben; 3D-Modelle nur aus dem freigegebenen Zeichnungsindex; Prüfung bei jedem neuen Spannmittel.',
        naechsteUeberpruefung: '2027-06-30', erfasstAm: '2026-09-10' },
      { id: 'KI-004', name: 'Kostenloser Chatbot für Offerten (Schatten-KI)', typ: 'schatten', beschreibung: 'Öffentlicher KI-Chatbot mit privaten Konten, den drei Mitarbeitende im Verkauf seit Ende 2025 für Offerttexte nutzten; dabei wurden 12 Kundenzeichnungen und Stücklisten hochgeladen. Entdeckt in der Inventarumfrage am 17.09.2026 und am 22.09.2026 untersagt.', zweck: 'Bis zur Untersagung am 22.09.2026: Offerttexte und Begleitschreiben formulieren. Die Nutzung ist untersagt.', fachbereich: 'verkauf', eigner: 'P-005', personendaten: true, besondereDaten: false, betroffene: 'Kunden, deren Zeichnungen und Kontaktdaten hochgeladen wurden; Mitarbeitende im Verkauf.', automatisierung: 'unterstuetzend', lebenszyklus: 'ausserbetrieb', status: 'untersagt',
        ressourcen: res('Kundenzeichnungen, Stücklisten, Kontaktdaten.', 'Öffentlicher Chatbot ohne Vertrag.', 'Cloud-Dienst, Verarbeitung in den USA.', 'Drei Mitarbeitende im Verkauf.'), sensibleNutzung: false,
        aiAct: { rollen: ['betreiber'], risikoklasse: 'minimal', transparenz: [], gpai: true, anwendungsbereich: [], begruendung: 'Betreiber; untersagt aus Gründen der Vertraulichkeit, nicht wegen des AI Act.', juristischGeprueft: false }, naechsteUeberpruefung: '2027-05-31', erfasstAm: '2026-09-17' },
    ],
    risiken,
    folgenabschaetzungen: [
      { id: 'IA-001', kiSystem: 'KI-001', ...leerVoll, triage: kurz('Bürounterstützung, Ergebnisse werden vor der Verwendung geprüft; Berechtigungsrisiko als R-003 behandelt. Sitzungszusammenfassungen in Teams nur mit Wissen der Teilnehmenden; Copilot bewertet weder Leistung noch Verhalten von Mitarbeitenden, deshalb keine Wirkung auf abhängige Mitarbeitende (Frage 3 nein). Frage 5 nach der Neubeurteilung ja: Offerttexte werden meist unverändert übernommen (Grenzfall, Entscheid der AIMS-Verantwortlichen in der Neubeurteilung).', { automatisierteEntscheidung: true }), sensibleNutzung: false, eingeschraenkteNutzung: false, ergebnis: 'Kurzprüfung genügt; freigegeben.', freigabe: { von: 'P-002', am: '2026-11-17' }, naechsteUeberpruefung: '2027-11-30',
        neubeurteilungen: [
          { am: '2027-01-26', durch: 'P-003', anlass: 'Abgleich von Frage 5 mit der Korrekturquote vom 31.12.2026 (KZ-05): 7 von 10 Offerttexten aus Copilot ohne wesentliche Änderung übernommen.', ergebnis: 'Frage 5 neu mit «ja» beantwortet: Die Texte werden geprüft, aber meist unverändert übernommen. Damit ist genau eine der Fragen 3 bis 6 mit «ja» beantwortet (Grenzfall). Die AIMS-Verantwortliche entscheidet, dass die Kurzprüfung genügt: Copilot trifft keine Entscheide über Personen, jede Offerte mit KI-Text erhält einen Prüfvermerk und ab CHF 20 000 eine zweite Prüfung (M-022), und Ziel Z-002 misst die Prüfung quartalsweise.', freigabe: { von: 'P-002', am: '2027-01-26' } },
        ] },
      { id: 'IA-002', kiSystem: 'KI-002', ...leerVoll, triage: kurz('Interne Planung ohne Personendaten; Wirkung wirtschaftlich (R-005). Die Disponentin prüft jeden Vorschlag vor der Bestellung.'), sensibleNutzung: false, eingeschraenkteNutzung: false, ergebnis: 'Kurzprüfung genügt; freigegeben.', freigabe: { von: 'P-002', am: '2026-11-17' }, naechsteUeberpruefung: '2027-11-30',
        neubeurteilungen: [
          { am: '2027-01-08', durch: 'P-005', anlass: 'ERP-Update vom 08.12.2026 mit geänderter Berechnung der Bestellvorschläge, erkannt in der Monatskontrolle vom 05.01.2027', ergebnis: 'Weiterhin nur Vorschläge mit Prüfung durch die Disponentin; keine wesentliche Änderung, die Kurzprüfung genügt.', freigabe: { von: 'P-002', am: '2027-01-08' } },
        ] },
      {
        id: 'IA-003', kiSystem: 'KI-003',
        triage: { ...kurz('Frage 2 ja: Mit der CAM-KI programmieren wir auch Implantat- und Medizinteile; ein fehlerhafter Werkzeugweg, der unerkannt bleibt, könnte über ein fehlerhaftes Teil Patientinnen und Patienten gefährden (indirekt Betroffene). Frage 6 ja: Für Patientinnen und Patienten wären die Folgen schwer umkehrbar. Personen an der Maschine schützen die verriegelten Schutztüren und der Einrichtbetrieb unabhängig vom Programm. Deshalb vollständige Abschätzung.', { gesundheitOderSicherheit: true, grosseReichweite: true }), ergebnis: 'voll' },
        systembeschreibung: 'Die CAM-Software erkennt Bearbeitungsmerkmale aus den 3D-Modellen der Kunden und schlägt Werkzeugwege mit Schnittdaten vor. Die Programmiererin oder der Programmierer übernimmt, ändert oder verwirft den Vorschlag; jedes Programm wird mit vollständigem Spannmittelmodell simuliert, im Einzelsatz eingefahren und freigegeben, bei Medizinteilen durch eine zweite Person (M-015).',
        verwendungen: 'Programmierung neuer Dreh- und Frästeile, Anpassung bestehender Programme, Vorschläge für Schnittdaten.',
        fehlanwendungen: 'Übernahme eines Vorschlags ohne Simulation; Freigabe von Programmen für Medizinteile ohne zweite Person; Verwendung für Werkstoffe oder Spannmittel ohne Modell in der Bibliothek.',
        daten: '3D-Modelle und Zeichnungen der Kunden (Geheimhaltung), Werkzeug- und Spannmittelbibliothek; keine Personendaten. Das Modell des Herstellers ist vortrainiert, wir trainieren es nicht (L-003).',
        einsatzumfeld: 'Arbeitsvorbereitung mit drei CAM-Arbeitsplätzen im Werk Mittelland; zwei CAM-Programmierer und der Leiter Arbeitsvorbereitung. Medizinteile unterliegen der Erstmusterprüfung und der Endprüfung nach den Qualitätssicherungsvereinbarungen und ISO 13485.',
        betroffene: [
          { gruppe: 'CAM-Programmierer und Einrichter', art: 'direkt', wirkung: 'Schnellere Programmierung; Risiko, dem Vorschlag zu stark zu vertrauen.', konsultiert: true },
          { gruppe: 'Bediener an den CNC-Maschinen', art: 'direkt', wirkung: 'Geschützt durch verriegelte Schutztüren und Einrichtbetrieb, unabhängig vom Programm.', konsultiert: true },
          { gruppe: 'Kunden aus Medizintechnik und Automobil', art: 'indirekt', wirkung: 'Teilequalität und Liefertermine; fehlerhafte Teile führen zu Reklamationen.', konsultiert: false },
          { gruppe: 'Patientinnen und Patienten mit Implantat- und Medizinteilen', art: 'indirekt', wirkung: 'Ein unerkannt fehlerhaftes Implantatteil könnte die Gesundheit gefährden, die Folgen wären schwer umkehrbar; Erstmuster- und Endprüfung erkennen Mass- und Formfehler vor der Auslieferung.', konsultiert: false },
        ],
        nutzenSchaden: {
          rechenschaft: { nutzen: 'Eigner ist der Leiter Arbeitsvorbereitung; jede Freigabe ist mit Person und Programmversion dokumentiert.', schaden: 'Unklare Verantwortung, wenn ein Vorschlag ohne Vermerk übernommen wird.' },
          transparenz: { nutzen: 'Vermerk «KI-Vorschlag» in jeder Programmversion.', schaden: 'Ohne Vermerk ist bei einer Reklamation nicht erkennbar, ob ein Vorschlag beteiligt war.' },
          fairness: { nutzen: 'Nicht relevant: keine Entscheide über Personen.', schaden: 'Keine Benachteiligung von Personengruppen erkennbar.' },
          datenschutz: { nutzen: 'Keine Personendaten.', schaden: 'Kundenzeichnungen bleiben lokal auf den CAM-Arbeitsplätzen.' },
          zuverlaessigkeit: { nutzen: 'Rund 30 % kürzere Programmierzeit; Abnahmetest mit 10 typischen Teilen bestanden.', schaden: 'Kollisionsgefährdete Werkzeugwege bei unvollständigen Spannmittelmodellen (R-007).' },
          sicherheit: { nutzen: 'Simulation und Einzelsatz decken Kollisionen vor dem Einsatz auf.', schaden: 'Ein unerkannter Formfehler an einem Implantatteil könnte Patientinnen und Patienten gefährden; das Restrisiko ist gering, weil Erstmuster- und Endprüfung unabhängig von der KI wirken.' },
          erklaerbarkeit: { nutzen: 'Jeder Vorschlag ist als Werkzeugweg im CAM sichtbar und prüfbar.', schaden: 'Warum die KI einen Weg wählt, ist nicht erklärt; die Simulation zeigt nur das Ergebnis.' },
          umwelt: { nutzen: 'Weniger Ausschuss und Einfahrzeit.', schaden: 'Nicht wesentlich.' },
        },
        gesellschaft: 'Keine Wirkung über Kunden, Patientinnen und Patienten hinaus; das Vertrauen in die Sicherheit von Medizinteilen hängt an der unabhängigen Prüfung.',
        ausfaelle: 'Fehlerhafter Vorschlag: Simulation oder Einfahren erkennen ihn, sonst Crash und Ausschuss. Unerkannter Formfehler an einem Medizinteil: Erstmuster- und Endprüfung nach ISO 13485 vor der Auslieferung. Ausfall der KI-Funktion: Programmierung ohne Vorschlag, längere Durchlaufzeit.',
        massnahmen: 'Simulation mit vollständigem Spannmittelmodell, Einfahren im Einzelsatz, Vermerk «KI-Vorschlag», Freigabe durch eine zweite Person bei Medizinteilen (M-015); Erstmusterprüfung und Endprüfung der Medizinteile nach ISO 13485 unabhängig von der KI; Abnahmetest mit eigenen Teilen vor jedem grösseren Update; Schulung der CAM-Programmierer (K-001). Patientinnen und Patienten wurden nicht befragt; ihre Sicht vertreten die Qualitätssicherungsvereinbarungen der Kunden.',
        sensibleNutzung: true, eingeschraenkteNutzung: true,
        ergebnis: 'Eingeschränkte Nutzung mit Auflagen: jedes Programm simulieren und im Einzelsatz einfahren, Vermerk «KI-Vorschlag», Freigabe durch eine zweite Person bei Medizinteilen; Freigabe durch den Geschäftsführer. Grösster verbleibender Schaden: unerkannter Formfehler an einem Implantatteil (Ausmass 3), begrenzt durch die unabhängige Erstmuster- und Endprüfung. Neubeurteilung bei einem Versionswechsel der CAM-Software, bei neuen Teilefamilien für die Medizintechnik und jährlich.',
        verknuepfteDsfa: 'keine (keine Personendaten)',
        freigabe: gf('2026-11-17'), naechsteUeberpruefung: '2027-11-30',
      },
      {
        id: 'IA-004', kiSystem: 'KI-004',
        triage: { rechtspositionOderChancen: false, gesundheitOderSicherheit: false, verletzlicheGruppen: false, besondereDaten: false, automatisierteEntscheidung: true, grosseReichweite: true, ergebnis: 'voll', begruendung: 'Frage 5 ja: Die Mitarbeitenden übernahmen Ergebnisse ungeprüft in Offerten. Frage 6 ja: Vertrauliche Daten von vier Kunden und Personendaten ihrer Kontaktpersonen gingen ohne Vertrag an einen Dienst in den USA; die Folgen sind nicht umkehrbar. Frage 1 nein: Der Chatbot traf keine Entscheide über Personen. Damit ist die Schwelle für eine vollständige Abschätzung erreicht; sie ist zugleich Grundlage für die Information der Kunden.' },
        systembeschreibung: 'Öffentlicher Chatbot im Browser, genutzt mit privaten Konten. Die Mitarbeitenden luden Zeichnungen und Stücklisten hoch und liessen Offerttexte erstellen. Nach den Nutzungsbedingungen kann der Dienst Eingaben zur Verbesserung seiner Modelle verwenden.',
        verwendungen: 'Offerttexte, Begleitschreiben, Zusammenfassungen von Kundenanfragen.',
        fehlanwendungen: 'Hochladen von Zeichnungen und Stücklisten, Eingabe von Preisen und Kundennamen, Übernahme technischer Angaben ohne Prüfung.',
        daten: '12 Kundenzeichnungen und Stücklisten von 4 Kunden (davon 2 mit Exportkontrollvermerk), Namen und E-Mail-Adressen von Kontaktpersonen, eigene Preise.',
        einsatzumfeld: 'Verkauf mit drei Personen, hoher Zeitdruck bei Offerten, keine Regeln und kein freigegebenes Werkzeug zum Zeitpunkt der Nutzung.',
        betroffene: [
          { gruppe: 'Kunden, deren Zeichnungen hochgeladen wurden', art: 'direkt', wirkung: 'Möglicher Verlust von Geschäftsgeheimnissen; Vertrauensverlust in uns als Lieferant.', konsultiert: true },
          { gruppe: 'Kontaktpersonen bei Kunden', art: 'direkt', wirkung: 'Personendaten an einen Dienst ohne Auftragsbearbeitungsvertrag übermittelt.', konsultiert: false },
          { gruppe: 'Mitarbeitende im Verkauf', art: 'direkt', wirkung: 'Entlastung bei Offerten; Unsicherheit und mögliche arbeitsrechtliche Folgen.', konsultiert: true },
        ],
        nutzenSchaden: {
          rechenschaft: { nutzen: 'Keiner; die Nutzung war niemandem zugeordnet.', schaden: 'Keine verantwortliche Person, keine Kontrolle.' },
          transparenz: { nutzen: 'Keiner.', schaden: 'Kunden wussten nicht, dass ihre Zeichnungen in einen KI-Dienst gelangten.' },
          datenschutz: { nutzen: 'Keiner.', schaden: 'Übermittlung von Personendaten in die USA ohne Vertrag.' },
          zuverlaessigkeit: { nutzen: 'Schnellere Offerttexte.', schaden: 'Ungeprüfte technische Angaben in zwei Offerten (falsche Werkstoffbezeichnung).' },
          sicherheit: { nutzen: 'Keiner.', schaden: 'Daten ausserhalb unserer Kontrolle, Löschung nicht nachweisbar.' },
          fairness: { nutzen: 'Nicht relevant: keine Entscheide über Personen.', schaden: 'Keine Benachteiligung von Personengruppen erkennbar.' },
          erklaerbarkeit: { nutzen: 'Keiner.', schaden: 'Herkunft der Formulierungen und technischen Angaben nicht nachvollziehbar.' },
          umwelt: { nutzen: 'Nicht wesentlich.', schaden: 'Nicht wesentlich.' },
        },
        ausfaelle: 'Abfluss von Kundenzeichnungen: Vertragsstrafe, Verlust des Grosskunden. Falsche Angaben in Offerten: Reklamation. Exportkontrolle: Busse.',
        massnahmen: 'Nutzung untersagt und Konten gelöscht (M-009), Kunden informiert und Exportkontrolle abgeklärt (M-010), Copilot als freigegebene Alternative, Richtlinie D-15 und Schulung (M-012).',
        sensibleNutzung: false, eingeschraenkteNutzung: false,
        ergebnis: 'Nutzung untersagt. Ersatz durch M365 Copilot mit Firmenkonto und Regeln für Kundendaten. Solange die Untersagung gilt, prüfen wir im halbjährlichen Inventar, dass der Dienst nicht mehr genutzt wird; bei der nächsten Überprüfung entscheiden wir, ob die Abschätzung archiviert wird.',
        verknuepfteDsfa: 'Keine DSFA nötig; Vorfall am 22.09.2026 im Datenschutzverzeichnis dokumentiert',
        freigabe: gf('2026-11-17'), naechsteUeberpruefung: '2027-05-31',
      },
    ],
    controls: soa(soaEintraege, risiken, false),
    eigeneControls: [],
    nachweise,
    dokumente,
    massnahmen,
    lieferanten: [
      { id: 'L-001', name: 'M365 Copilot (Bezug über Mittelland Informatik GmbH)', leistung: 'Lizenzen und Einrichtung von M365 Copilot (KI-001).', pruefstatus: 'mit-auflagen', pruefpunkte: pp(['ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja']), bemerkung: 'Keine Trainingsnutzung, Datenhaltung Schweiz/EU. Rolle nach AI Act geklärt: Der Hersteller ist Anbieter, wir sind Betreiberin. Auflage zu PF-20: Ob Antworten externe Links und Bilder laden, ist beim Hersteller angefragt; bis zur Antwort öffnen Nutzende keine Links aus Antworten (Richtlinie D-15), und der Missbrauchsfall «externer Link» ist Teil jeder Wiederholung der Tests. Lizenzen sind fest, keine Abrechnung nach Verbrauch (PF-19).', naechstePruefung: '2027-10-31' },
      { id: 'L-002', name: 'Dispona ERP Software AG', leistung: 'Cloud-ERP mit KI-Funktion Disposition (KI-002).', pruefstatus: 'mit-auflagen', pruefpunkte: pp(['ja', 'ja', 'ja', 'offen', 'ja', 'nein', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja']), bemerkung: 'Änderungen an der KI-Funktion werden nicht angekündigt (PF-06); Auflage: Release Notes vor jedem Update prüfen und Vereinbarung zur Ankündigung abschliessen (M-014). Liste der Unterauftragnehmer (PF-04, VK-04), Klauseln VK-05 und VK-13 sowie Angaben zur Version des Modells (PF-21) werden mit derselben Vereinbarung bis 31.03.2027 nachverhandelt. Neu geprüft am 08.01.2027 nach dem Update vom 08.12.2026, das die Berechnung der Bestellvorschläge änderte: Antworten zu PF-01 bis PF-21 unverändert, die fehlende Ankündigung (PF-06) bestätigt; Prüfstatus mit Auflagen bleibt.', naechstePruefung: '2027-10-31' },
      { id: 'L-003', name: 'Kontura CAM Solutions GmbH', leistung: 'CAM-Software mit KI-Modul, lokal installiert (KI-003).', pruefstatus: 'mit-auflagen', pruefpunkte: pp(['ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'nein', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja']), bemerkung: 'Lokaler Betrieb, keine Datenübermittlung; Fernwartung nur auf Anfrage, mit Auftragsbearbeitungsvertrag und Liste der Unterauftragnehmer. Sicherheitszertifikat des Herstellers liegt nicht vor (PF-08), vertretbar wegen lokalem Betrieb; Auflage: Fernwartung nur mit Freischaltung durch die IT im Einzelfall, Klausel VK-10 bei der Vertragsverlängerung 2027 aufnehmen.', naechstePruefung: '2027-10-31' },
    ],
    ziele: [
      { id: 'Z-001', ziel: 'Keine Kundendaten in nicht freigegebenen KI-Diensten', kennzahl: 'Anzahl festgestellter Fälle (Inventarumfrage, Meldungen, Proxy-Auswertung)', sollwert: '0', messmethode: 'Halbjährliche Umfrage in allen Bereichen und Auswertung der Webfilter-Protokolle durch den IT-Partner', haeufigkeit: 'halbjaehrlich', verantwortlich: 'P-003', ressourcen: '2 Stunden IT-Partner pro Halbjahr', termin: '2027-06-30', bewertung: 'Managementbewertung', messungen: [{ datum: '2026-12-31', wert: '0' }] },
      { id: 'Z-002', ziel: 'KI-Ergebnisse werden vor der Verwendung geprüft', kennzahl: 'Anteil der stichprobenweise geprüften CAM-Programme, Offerten und Bestellvorschläge mit dokumentierter Prüfung', sollwert: '100 %', messmethode: 'Stichprobe von 10 CAM-Programmen und 10 Offerten pro Quartal, ab 2027 zusätzlich 10 Bestellvorschläge der ERP-KI', haeufigkeit: 'quartalsweise', verantwortlich: 'P-004', ressourcen: '3 Stunden pro Quartal', termin: '2027-06-30', bewertung: 'Managementbewertung', messungen: [{ datum: '2026-12-31', wert: '95 % (19 von 20)', bemerkung: 'Eine Offerte unter CHF 20 000 ohne Prüfvermerk; Ziel verfehlt' }] },
      { id: 'Z-003', ziel: 'Alle Mitarbeitenden kennen die KI-Regeln', kennzahl: 'Anteil der Personen im Werk mit unterschriebener Richtlinie und Schulung', sollwert: '100 %', messmethode: 'Abgleich der Personalliste und der Liste der Temporärmitarbeitenden mit der Schulungsliste', haeufigkeit: 'quartalsweise', verantwortlich: 'P-002', ressourcen: 'AIMS-Verantwortliche', termin: '2027-03-31', bewertung: 'Managementbewertung', messungen: [
        { datum: '2026-12-31', wert: '100 % (41 von 41)', bemerkung: 'Abgleich nur mit der Personalliste der Festangestellten' },
        { datum: '2027-01-20', wert: '100 % (45 von 45)', bemerkung: 'Inklusive vier Temporärmitarbeitende nach Feststellung F-001' }] },
    ],
    kompetenzen: [
      { id: 'K-001', rolle: 'Freigabe von CAM-Programmen mit KI-Vorschlag', anforderung: 'Grenzen der Feature-Erkennung kennen, Simulation mit Spannmitteln, Freigaberegel für Medizinteile.', personen: ['P-004'], gruppe: 'zwei CAM-Programmierer, zweite Freigabeperson bei Medizinteilen', massnahme: 'Herstellerschulung KI-Modul (1 Tag), interne Einweisung.', nachweis: 'Schulungsbestätigung 11/2026 in N-014', wirksamkeit: 'Keine Crashs seit Einführung; Stichprobe Z-002.', status: 'erfuellt' },
      { id: 'K-002', rolle: 'AIMS-Verantwortliche', anforderung: 'Grundlagen ISO/IEC 42001, Risikobeurteilung, Lieferantenprüfung.', personen: ['P-002'], massnahme: 'Kurs ISO/IEC 42001 Grundlagen (2 Tage) und Einarbeitung mit externer Begleitung.', nachweis: 'Kursbestätigung 09/2026 in N-014', wirksamkeit: 'Internes Audit ohne Feststellung zur Methodik.', status: 'erfuellt' },
      { id: 'K-003', rolle: 'Alle Mitarbeitenden mit Zugang zu KI-Werkzeugen', anforderung: 'Regeln D-15, Umgang mit Kundendaten, Prüfpflicht, Meldeweg.', personen: ['P-001', 'P-002', 'P-003', 'P-004', 'P-005'], gruppe: 'alle weiteren der 45 Personen im Werk einschliesslich Temporärmitarbeitende (Schulungsliste N-014)', massnahme: 'Einführung 30 Minuten in Teamsitzungen (M-012), Merkblatt, Unterschrift der Richtlinie, jährliche Auffrischung; für alle 45 Personen im Werk einschliesslich Temporärmitarbeitende.', nachweis: 'Schulungsliste 12/2026 und Nachschulung 01/2027 mit Unterschriften aller 45 Personen in N-014', wirksamkeit: 'Ziel Z-003 (100 % am 20.01.2027) und Ziel Z-001 (keine Fälle).', status: 'erfuellt' },
      { id: 'K-005', rolle: 'Prüfung der Bestellvorschläge der ERP-KI (KI-002)', anforderung: 'Grenzen der Bedarfsprognose kennen, Abweichungen erkennen, jeden Vorschlag vor der Bestellung prüfen, Änderungen nach Updates melden.', personen: ['P-005'], gruppe: 'Disponentin', massnahme: 'Einweisung durch den ERP-Anbieter und interne Einweisung in die Monatskontrolle (M-013).', nachweis: 'Einweisung 11/2026 in N-014', wirksamkeit: 'Die Monatskontrolle vom 05.01.2027 hat die Änderung nach dem Update erkannt (F-002).', status: 'erfuellt' },
      { id: 'K-004', rolle: 'Internes Audit AIMS', anforderung: 'ISO/IEC 42001 und Auditmethodik, keine Beteiligung am Aufbau des AIMS.', personen: ['P-006'], massnahme: 'Externe Auditorin mit Ausbildung ISO/IEC 42001 Lead Auditor beauftragt (Auftrag vom 17.11.2026).', nachweis: 'Auditorenzertifikat und Auftrag in N-017', wirksamkeit: 'Bewertung des Auditberichts in der Managementbewertung MB-001.', status: 'erfuellt' },
    ],
    kommunikation: [
      { id: 'KO-001', was: 'KI-Leitlinie und Richtlinie KI-Nutzung', wann: 'bei Freigabe und bei Eintritt neuer Mitarbeitender', wer: 'P-002', mitWem: 'Alle Mitarbeitenden', wie: 'Teamsitzung, Merkblatt, Anschlagbrett', richtung: 'intern' },
      { id: 'KO-002', was: 'Stand AIMS und Massnahmen', wann: 'quartalsweise', wer: 'P-002', mitWem: 'Geschäftsführer', wie: 'Besprechung mit Protokoll', richtung: 'intern' },
      { id: 'KO-003', was: 'Selbstauskunft zur KI-Steuerung', wann: 'auf Anfrage, jährlich zum Lieferantenaudit', wer: 'P-002', mitWem: 'Medivo Medtech AG und weitere Grosskunden', wie: 'Selbstauskunftsbogen, Zertifikat nach der Zertifizierung', richtung: 'extern' },
      { id: 'KO-004', was: 'Information bei KI-Vorfällen mit Kundendaten', wann: 'so rasch wie möglich, spätestens innert 72 Stunden', wer: 'P-001', mitWem: 'Betroffene Kunden', wie: 'Telefon und schriftliche Bestätigung', richtung: 'extern' },
    ],
    audits: [
      { id: 'AU-001', art: 'intern', kombiniertMitIsms: false, geplant: '2027-01-12', durchgefuehrt: '2027-01-12', umfang: 'Ganzes AIMS nach ISO/IEC 42001 Abschnitte 4 bis 10 und Erklärung zur Anwendbarkeit, Stichproben bei allen vier KI-Systemen, Begehung Arbeitsvorbereitung und Verkauf (1 Tag).', kriterien: 'ISO/IEC 42001:2023, KI-Leitlinie, Richtlinie KI-Nutzung', auditor: 'Ursula Brand, externe Auditorin der Brunnmatt Audit GmbH (Auftrag vom 17.11.2026)', unabhaengigkeit: 'Externe Auditorin, beauftragt am 17.11.2026; nicht im Projektteam und ohne Beteiligung am Aufbau des AIMS. Die Beratung beim Aufbau leistete eine andere Stelle.', ergebnis: 'AIMS angemessen für Grösse und KI-Einsatz. 1 leichte Nichtkonformität (F-001), 2 Beobachtungen (F-002, F-004), 1 Verbesserung (F-003). Bereit für Stage 1.',
        bericht: 'Auditbericht AU-001 Version 1.0 vom 15.01.2027 mit ausgefüllter Checkliste, Laufwerk Q: > AIMS > 20_Audit',
        checkliste: Object.fromEntries(Object.entries(CHECKLISTE).map(([id, [nachweis, stichprobe]]) => [id, stichprobe ? { nachweis, stichprobe } : { nachweis }])),
        stichproben: STICHPROBEN },
      { id: 'AU-002', art: 'extern-stage1', kombiniertMitIsms: false, geplant: '2027-02-23', umfang: 'Stage-1-Audit, 1 Audittag vor Ort.', kriterien: 'ISO/IEC 42001:2023', auditor: 'Certimont Zertifizierung AG', unabhaengigkeit: 'Externe akkreditierte Zertifizierungsstelle', ergebnis: '' },
      { id: 'AU-003', art: 'extern-stage2', kombiniertMitIsms: false, geplant: '2027-04-13', umfang: 'Stage-2-Audit, 2 Audittage vor Ort.', kriterien: 'ISO/IEC 42001:2023', auditor: 'Certimont Zertifizierung AG', unabhaengigkeit: 'Externe akkreditierte Zertifizierungsstelle', ergebnis: '' },
      // Auditprogramm über den Zertifizierungszyklus: internes Audit jährlich im Januar, Überwachungsaudit jährlich im Februar
      ...([['AU-004', 'intern', '2028-01-11'], ['AU-005', 'ueberwachung', '2028-02-22'], ['AU-006', 'intern', '2029-01-09'], ['AU-007', 'ueberwachung', '2029-02-20']] as const).map(([id, art, geplant]): Audit =>
        art === 'intern'
          ? { id, art, kombiniertMitIsms: false, geplant, umfang: 'Jährliches internes Audit (1 Tag): Abschnitte 9.2, 9.3 und 10.2 jedes Jahr, die übrigen Abschnitte und die Controls der Erklärung zur Anwendbarkeit über die drei Jahre des Zyklus verteilt; Stichproben bei allen KI-Systemen.', kriterien: 'ISO/IEC 42001:2023, KI-Leitlinie, Richtlinie KI-Nutzung', auditor: 'Externe Auditorin der Brunnmatt Audit GmbH', unabhaengigkeit: 'Externe Auditorin ohne Beteiligung am Aufbau und Betrieb des AIMS.', ergebnis: '' }
          : { id, art, kombiniertMitIsms: false, geplant, umfang: 'Überwachungsaudit ISO/IEC 42001, 1 Audittag vor Ort.', kriterien: 'ISO/IEC 42001:2023', auditor: 'Certimont Zertifizierung AG', unabhaengigkeit: 'Externe akkreditierte Zertifizierungsstelle', ergebnis: '' }),
    ],
    feststellungen: [
      { id: 'F-001', audit: 'AU-001', quelle: 'audit', einstufung: 'nk-leicht', beschreibung: 'Vier Temporärmitarbeitende in der Produktion haben die Richtlinie KI-Nutzung nicht unterschrieben und sind nicht geschult; die Messung von Z-003 erfasste nur die Festangestellten.', normbezug: '7.2, 7.3', korrektur: 'Einführung am 19.01.2027 nachgeholt. Meldepflicht geprüft: keine Kundendaten betroffen, keine Meldung nötig.', ursache: 'Die Checkliste für neue Mitarbeitende gilt nicht für Temporärmitarbeitende der Personalvermittlung, und die Messung beruhte auf der Personalliste.', massnahmen: ['M-018'],
        nachweis: 'Schulungsliste mit Stand 18.12.2026 ohne die vier Temporärmitarbeitenden, Einsatzliste der Personalvermittlung, Interview mit Andrea Baumann.', ursacheKategorie: 'Kompetenz', meldepflicht: 'ja', wirksamkeitGeplant: '2027-03-31', status: 'in-arbeit' },
      { id: 'F-002', audit: 'AU-001', quelle: 'audit', einstufung: 'beobachtung', beschreibung: 'Das Update des ERP vom 08.12.2026 änderte die Bestellvorschläge; die Änderung wurde erst in der Monatskontrolle vom 05.01.2027 bemerkt, weil die Release Notes noch nicht ausgewertet wurden (M-014 in Arbeit).', normbezug: 'A.10.3, A.6.2.6', korrektur: 'Neubeurteilung von R-005, R-006 und IA-002 und Neuprüfung des Lieferanten L-002 am 08.01.2027; Release Notes des Updates nachträglich ausgewertet.', ursache: 'Release Notes nicht ausgewertet; die Vereinbarung mit dem ERP-Anbieter fehlt noch.', massnahmen: ['M-014'],
        nachweis: 'Monatskontrolle vom 05.01.2027 (N-009), Release Notes des ERP-Updates vom 08.12.2026, Neubeurteilung IA-002 vom 08.01.2027.', ursacheKategorie: 'Lieferant', meldepflicht: 'nicht-noetig', wirksamkeitGeplant: '2027-04-30', status: 'in-arbeit' },
      { id: 'F-003', audit: 'AU-001', quelle: 'audit', einstufung: 'verbesserung', beschreibung: 'Die Prüfung der AI-Act-Betroffenheit sollte als fester Termin im Jahresplan stehen und vor Stage 1 einmal durchgeführt werden.', normbezug: '4.1', korrektur: '', ursache: '', massnahmen: ['M-019'], nachweis: 'D-24 Version 1.0, Jahresplan ohne Termin für die Prüfung.', wirksamkeit: { am: '2027-01-20', ergebnis: 'Termin im Jahresplan eingetragen, erste Prüfung am 20.01.2027 durchgeführt (M-019).' }, status: 'geschlossen' },
      { id: 'F-004', audit: 'AU-001', quelle: 'audit', einstufung: 'beobachtung', beschreibung: 'Ziel Z-002 verfehlt: In der Stichprobe vom 31.12.2026 war eine von 20 Offerten ohne dokumentierte Prüfung. Die Prüfregel für Offerten war uneinheitlich: Vier Augen erst ab CHF 20 000, darunter kein Prüfvermerk verlangt.', normbezug: '9.1, A.9.3', korrektur: 'Die Offerte wurde nachträglich geprüft; die technischen Angaben waren richtig. Meldepflicht geprüft: keine Meldung nötig.', ursache: 'Die Prüfregel verlangte unter CHF 20 000 keinen Vermerk; Richtlinie, Erklärung zur Anwendbarkeit und Risikoregister beschrieben die Prüfung unterschiedlich.', massnahmen: ['M-022'],
        nachweis: 'Messung von Z-002 vom 31.12.2026, Offerte ohne Prüfvermerk, Interview mit Sabine Hofer.', ursacheKategorie: 'Prozess', meldepflicht: 'nicht-noetig', wirksamkeitGeplant: '2027-06-30', status: 'in-arbeit' },
      { id: 'F-005', quelle: 'vorfall', datum: '2026-09-17', erfasstAm: '2027-01-26', einstufung: 'nk-leicht', schwere: 3,
        beschreibung: 'Drei Mitarbeitende im Verkauf haben mit privaten Konten eines kostenlosen Chatbots Offerten geschrieben und dabei 12 Kundenzeichnungen und Stücklisten von 4 Kunden sowie Namen und E-Mail-Adressen von Kontaktpersonen hochgeladen; der Dienst verarbeitet Daten in den USA. Entdeckt in der Inventarumfrage am 17.09.2026; im Register nach der ersten Managementbewertung nachgetragen.',
        normbezug: 'A.9.2, A.8.4', korrektur: 'Nutzung am 22.09.2026 untersagt, private Konten gelöscht, Löschantrag gestellt, Webzugriff gesperrt (M-009); die vier Kunden informiert und die Exportkontrolle abgeklärt (M-010). Meldepflicht nach DSG am 23.09.2026 geprüft: Name und E-Mail-Adresse von Kontaktpersonen ohne hohes Risiko für die Betroffenen, keine Meldung an den EDÖB nötig; Information der Kunden nach den Geheimhaltungsvereinbarungen.',
        ursache: 'Es gab weder Regeln für KI noch ein freigegebenes Werkzeug; unter Zeitdruck im Offertwesen griffen die Mitarbeitenden zu einem frei verfügbaren Dienst. Den Vorfall haben wir vor der Einrichtung des Registers am 22.12.2026 behandelt und danach nicht nachgetragen; den Nachtrag hat erst die Managementbewertung angestossen.', massnahmen: ['M-009', 'M-010', 'M-012'],
        nachweis: 'Antworten der Inventarumfrage vom 17.09.2026, Eintrag im Datenschutzverzeichnis vom 22.09.2026, Liste der hochgeladenen Zeichnungen, Bestätigungen der Kunden.', ursacheKategorie: 'Prozess', meldepflicht: 'ja',
        wirksamkeit: { am: '2026-12-31', ergebnis: 'Messung Z-001 vom 31.12.2026: keine Kundendaten in nicht freigegebenen Diensten; Webzugriff weiterhin gesperrt, Copilot mit Firmenkonto im Einsatz.' }, status: 'geschlossen' },
    ],
    managementbewertungen: [
      { id: 'MB-001', datum: '2027-01-26', kombiniertMitIsms: false, teilnehmende: 'Martin Zürcher (Geschäftsführer), Andrea Baumann (AIMS), Reto Schneider (IT), Jonas Kälin (AVOR), Sabine Hofer (Verkauf)',
        eingaben: {
          statusMassnahmen: 'Erste Bewertung. Von 19 Massnahmen aus Aufbau, Risiken, Änderungen und Audit sind 18 erledigt und 1 in Arbeit (M-014); keine Massnahme überfällig. Neu beschlossen: M-020 bis M-022.',
          aenderungenThemen: 'Kein neues KI-System; ERP-Update vom 08.12.2026 mit geänderter KI-Funktion, Risiko und Kurzprüfung am 08.01.2027 neu beurteilt (F-002). Überprüfung der AI-Act-Betroffenheit am 20.01.2027 (M-019): Offerttexte aus Copilot gehen auch an Kunden in Deutschland (Art. 2(1) Bst. c); es gilt die KI-Kompetenz nach Art. 4, keine Hochrisiko- und keine Transparenzpflichten.',
          aenderungenParteien: 'Ein zweiter Grosskunde (Automobil) hat dieselbe Anfrage gestellt wie die Medivo Medtech AG.',
          leistung: '1 leichte Nichtkonformität aus dem internen Audit (F-001): korrigiert, Korrekturmassnahme M-018 erledigt, Wirksamkeitsprüfung bis 31.03.2027. Ziel Z-002 verfehlt: Beobachtung F-004 aus dem Audit, Prüfregel für Offerten vereinheitlichen (M-022). Der Vorfall mit der Schatten-KI KI-004 im September 2026 wird als Nichtkonformität F-005 im Register nachgetragen; Korrektur und Massnahmen sind erledigt.',
          messung: 'Z-001: keine Kundendaten in nicht freigegebenen Diensten; Z-002: 95 % der Stichproben mit dokumentierter Prüfung (Soll 100 %, verfehlt, F-004); Z-003: 100 % geschult nach der Nachschulung der Temporärmitarbeitenden.',
          audits: 'Internes Audit AU-001 vom 12.01.2027 durch eine externe Auditorin: AIMS angemessen; 1 leichte Nichtkonformität, 2 Beobachtungen, 1 Verbesserung. Noch keine externen Audits.',
          verbesserungen: 'Temporärmitarbeitende in die Einführung aufgenommen (M-018), Prüfung der AI-Act-Betroffenheit als fester Termin im Jahresplan (M-019).',
          weitere: 'Aufwand bisher 52 Personentage (Plan 55), Budget eingehalten.',
        },
        ergebnisse: {
          inventar: 'Vier KI-Systeme: Copilot und ERP-KI freigegeben, die CAM-KI mit Auflagen freigegeben, der kostenlose Chatbot (KI-004) untersagt; keine neue Schatten-KI (Z-001). Bewertung: vollständig.',
          risiken: 'Zwölf Risiken und eine Chance; Restrisiken angenommen, R-005 und R-006 nach dem ERP-Update, R-004 nach F-004 und R-009 nach F-001 neu beurteilt. Zwei Kurzprüfungen und zwei vollständige Abschätzungen (CAM-KI, Chatbot). Bewertung: angemessen.',
          meldungen: 'Zwei Meldungen, beide innert Frist erledigt: ME-001 einer Mitarbeiterin zu einer falschen Werkstoffbezeichnung in einem Copilot-Entwurf (vor dem Versand erkannt), ME-002 Rückfrage der Medivo Medtech AG zur Prüfung von KI-Texten in Offerten. Ein KI-Vorfall im Bewertungszeitraum: die Schatten-KI KI-004 im September 2026 (Schweregrad 3, Kunden informiert, keine Meldung an den EDÖB nötig), als F-005 nachzutragen; seither keine Vorfälle. Bewertung: Kanäle bekannt und genutzt.',
          lieferanten: 'Drei Lieferanten vor der Freigabe der Systeme geprüft, alle mit Auflagen: Darstellung externer Links in Copilot-Antworten beim Hersteller angefragt (PF-20), ERP-Anbieter mit Release Notes, Vereinbarung und Unterauftragnehmern (M-014), Sicherheitszertifikat des CAM-Herstellers fehlt bei lokalem Betrieb. Bewertung: gesteuert, Auflagen bis zur nächsten Prüfung erfüllen.',
          ziele: 'Ziele Z-001 bis Z-003 für 2027 bestätigt; Z-002 mit Rückmeldung an die Mitarbeitenden auf 100 % bringen.',
          ressourcen: 'Pensum der AIMS-Verantwortlichen nach Stage 1 bei 20 % (M-021); Copilot-Lizenzen auf 15 erhöhen (M-020).',
          leitlinie: 'KI-Leitlinie Version 1.0 überprüft: angemessen für Zweck und KI-Einsatz, keine Änderung. Nächste Überprüfung bis 31.10.2027.',
        },
        entscheide: 'Das AIMS ist geeignet und angemessen; die Wirksamkeit ist bis auf Ziel Z-002 belegt und wird nach der Messung von Z-002 im März 2027 abschliessend beurteilt. Stage 1 am 23.02.2027. Der Vorfall mit KI-004 wird als F-005 im Register nachgetragen. Die KI-Leitlinie bleibt unverändert in Kraft. Ohne Änderung bestätigt: D-02, D-03, D-06, D-08, D-12, D-14 und D-15; D-04 in neuer Version freigegeben (nächsthöhere Stelle, Restrisiken ab hohem Risiko). Copilot-Lizenzen auf 15 erhöhen (M-020), Pensum der AIMS-Verantwortlichen nach Stage 1 auf 20 % (M-021), Prüfregel für Offerten vereinheitlichen (M-022). Die AI-Act-Betroffenheit wird jährlich und bei jedem neuen KI-System geprüft; juristische Prüfung, falls KI-Ergebnisse über Offerttexte hinaus an Kunden in der EU gehen oder KI in Produkte kommt.',
        massnahmen: ['M-020', 'M-021', 'M-022'] },
    ],
    meldungen: [
      { id: 'ME-001', datum: '2026-12-21', art: 'rueckmeldung', herkunft: 'intern', kanal: 'Postfach qualitaet@praezisionsteile.example', kiSystem: 'KI-001',
        beschreibung: 'Eine Mitarbeiterin im Verkauf meldet, dass Copilot in einem Offertentwurf eine falsche Werkstoffbezeichnung vorgeschlagen hat; der Fehler wurde vor dem Versand erkannt.',
        bearbeitung: 'P-002', bestaetigtAm: '2026-12-22', erledigtAm: '2026-12-29', ergebnis: 'Werkstoffkatalog als einzige Quelle in der Arbeitsanweisung hervorgehoben, Beispiel in die Auffrischung aufgenommen; Risiko R-004 bestätigt, kein Vorfall.', status: 'erledigt' },
      { id: 'ME-002', datum: '2027-01-14', art: 'rueckmeldung', herkunft: 'extern', kanal: 'E-Mail an qualitaet@praezisionsteile.example', kiSystem: 'KI-001',
        beschreibung: 'Die Medivo Medtech AG fragt, wie Offerttexte aus Copilot vor dem Versand geprüft werden.',
        bearbeitung: 'P-002', bestaetigtAm: '2027-01-15', erledigtAm: '2027-01-19', ergebnis: 'Prüfregel und Selbstauskunft N-016 erläutert; Anlass, die Prüfregel für Offerten in der Managementbewertung zu vereinheitlichen.', status: 'erledigt' },
    ],
    kennzahlen: [
      { id: 'KZ-05', messmethode: 'Stichprobe von 10 Ergebnissen je System und Quartal, gezogen mit der Stichprobe von Z-002 (Offerttexte aus Copilot, CAM-Vorschläge, ab 2027 Bestellvorschläge der ERP-KI); Vergleich mit dem Abnahmetest (D-12)', haeufigkeit: 'quartalsweise', werMisst: 'P-004', werWertetAus: 'P-002' },
    ],
    kennzahlMessungen: [
      { kennzahl: 'KZ-01', datum: '2027-01-26', wert: '30 von 33 anwendbaren Controls umgesetzt und mit Wirksamkeitsprüfung, 3 teilweise', bemerkung: 'Teilweise: A.6.2.5 und A.10.3 (M-014) sowie A.9.3 (M-022); Auswertung der Spalte «Wirksamkeit geprüft» in D-11 für die Managementbewertung.' },
      { kennzahl: 'KZ-02', datum: '2027-01-15', wert: 'AU-001: 1 leichte Nichtkonformität, 2 Beobachtungen, 1 Verbesserung', bemerkung: 'Keine schwere Nichtkonformität; Feststellungen F-001 bis F-004.' },
      { kennzahl: 'KZ-03', datum: '2026-12-31', wert: '1', bemerkung: 'Eine Meldung (ME-001), kein Vorfall im Quartal.' },
      { kennzahl: 'KZ-04', datum: '2026-12-31', wert: '1 Tag und 8 Tage', bemerkung: 'ME-001: Eingangsbestätigung nach 1 Tag, Abschluss nach 8 Tagen; Fristen von 10 Arbeitstagen und 30 Tagen eingehalten.' },
      { kennzahl: 'KZ-05', datum: '2026-12-31', wert: 'Copilot 30 %, CAM-KI 40 %', bemerkung: 'Copilot: 3 von 10 Offerttexten wesentlich geändert; CAM-KI: 4 von 10 Vorschlägen angepasst, im Abnahmetest 3 von 10; plausibel, keine Massnahme.' },
      { kennzahl: 'KZ-06', datum: '2027-01-22', wert: 'Kennzahlen geeignet', bemerkung: 'Abgleich vor der Managementbewertung: Z-002 hat die fehlende Prüfung angezeigt (F-004); kein Fehler und keine Meldung, die eine Kennzahl nicht angezeigt hätte.' },
    ],
  };
  konsolidierungPraezision(p);
  rc2Praezision(p);
  rc3Praezision(p);
  vorschlaegeZuordnen(p, { 'R-001': 'GS-02', 'R-003': 'GS-02', 'R-004': 'GS-07', 'R-012': 'GS-01', 'R-014': 'GS-17' });
  // Positiv geprüft: «wirksam»; A.6.2.6 mit Beobachtung F-002 (Release Notes, M-014) bleibt «umgesetzt»
  wirksamNachPruefung(p, ['A.6.2.6']);
  p.meta.gefuehrt.etappen = etappenStand(p, ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12'], ['E13']);
  const datum: Record<string, string> = { E1: '2026-09-08', E2: '2026-10-06', E3: '2026-10-12', E4: '2026-10-16', E5: '2026-10-20', E6: '2026-11-13', E7: '2026-11-17', E8: '2026-12-01', E9: '2026-12-15', E10: '2026-12-22', E11: '2026-12-31', E12: '2027-01-26', E13: '2027-01-29' };
  for (const [etappe, ids] of Object.entries(etappenChecklisten(p))) {
    if (!datum[etappe]) continue;
    ids.forEach((id, i) => {
      p.meta.checklisten[id] = etappe === 'E13' && i === ids.length - 1 ? { erledigt: false } : { erledigt: true, nachweis: 'Ablage Q: > AIMS', datum: datum[etappe] };
    });
  }
  // Prozessstand (Plan Prozesse 7): früher Stand, Mindestumfang der Basisprozesse ohne ISMS
  p.prozesse = prozessePraezision();
  prozessDatenPraezision(p);
  // Prüfdaten der Dokumente erst, wenn alle datierten Einträge stehen
  pruefDaten(p);
  return p;
}
