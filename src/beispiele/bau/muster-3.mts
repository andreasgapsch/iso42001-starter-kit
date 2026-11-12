// Beispiel 1, Teil 3: Erklärung zur Anwendbarkeit, Zusatz-Controls, Dokumente, Lieferanten, Ziele, Kompetenz, Kommunikation, Audit, Managementbewertung.
import type {
  Audit, ControlEintrag, DokumentEintrag, EigenesControl, Feststellung, JaNeinOffen, Kommunikation, Kompetenz, Lieferant, Managementbewertung, Ziel,
} from '../../model/typen.ts';
import { euaia27001, type CTeil } from './gemeinsam.mts';

const EIGENBAU = ['KI-002', 'KI-003', 'KI-006'];
const MIT_TRAINING = ['KI-001', 'KI-002', 'KI-003'];

export const soaEintraege: Record<string, CTeil> = {
  'A.2.2': { begruendung: 'Pflicht für jedes AIMS; Grundlage für alle KI-Systeme, besonders für den Umgang mit vertraulichen Daten (R-001).', status: 'wirksam', verantwortlich: 'P-001', nachweise: ['N-002', 'N-003'], umsetzung: 'KI-Leitlinie D-03 Version 1.0, freigegeben 01.09.2026, im Intranet veröffentlicht; Verweis in der ISMS-Leitlinie IS-LL-01 Version 5.0 (D-03-EB).' },
  'A.2.3': { begruendung: 'Die KI-Leitlinie muss zu ISMS-, Datenschutz-, Qualitäts- und Personalrichtlinien passen; Exportkontrolle (R-002).', status: 'umgesetzt', verantwortlich: 'P-002', nachweise: ['N-042', 'N-003'], umsetzung: 'Abgleichsprotokoll vom 27.08.2026; Verweise in ISMS-Leitlinie, Datenschutzrichtlinie und Personalreglement ergänzt.' },
  'A.2.4': { begruendung: 'Leitlinie muss mit Technik und Recht Schritt halten (AI Act, Maschinenverordnung, R-026).', status: 'umgesetzt', verantwortlich: 'P-002', nachweise: ['N-043', 'N-035'], umsetzung: 'Jährliche Überprüfung gemeinsam mit der ISMS-Leitlinie im Jahresplan; erste Überprüfung in der Managementbewertung MB-001 am 02.02.2027 (angemessen, keine Änderung), nächste bis 31.08.2027; vorzeitige Überprüfung bei neuen Rechtsakten.' },
  'A.3.2': { begruendung: 'Klare Zuständigkeiten für acht Systeme in zwei Gesellschaften.', status: 'wirksam', verantwortlich: 'P-001', nachweise: ['N-004'], umsetzung: 'KI-Rollen und RACI im Ergänzungsblatt D-04-EB zu den ISMS-Rollen; Systemeigner je KI-System im Inventar.' },
  'A.3.3': { begruendung: 'Mitarbeitende sollen Bedenken melden können; Schatten-KI-Fälle zeigen den Bedarf (R-020).', status: 'umgesetzt', verantwortlich: 'P-002', nachweise: ['N-005'], umsetzung: 'Meldeweg über Vorgesetzte, AIMS-Postfach und das bestehende Hinweisgebersystem (vertraulich); Eingangsbestätigung innert 10 Arbeitstagen, Rückmeldung zum Ergebnis innert 30 Tagen.' },
  'A.4.2': { begruendung: 'Vollständiges Inventar ist Grundlage aller Controls; still aktivierte Funktionen (R-025).', status: 'wirksam', verantwortlich: 'P-003', nachweise: ['N-006', 'N-025'], umsetzung: 'KI-Inventar mit 8 Systemen, gepflegt im Werkzeug und als KI-Kennzeichen im ISMS-Asset-Inventar; quartalsweise Überprüfung.' },
  'A.4.3': { begruendung: 'Datenressourcen bestimmen Vertraulichkeit und Qualität (R-001, R-003).', status: 'umgesetzt', verantwortlich: 'P-004', nachweise: ['N-040', 'N-019'], umsetzung: 'Ressourcenblatt je System mit Datenquellen, Klassifikation und zugelassenen Datenklassen.' },
  'A.4.4': { begruendung: 'Werkzeuge und Modelle müssen bekannt sein, auch die Grundmodelle eingekaufter Systeme.', status: 'umgesetzt', verantwortlich: 'P-003', nachweise: ['N-040'], umsetzung: 'Modelle, Versionen und Plattformen je System im Ressourcenblatt; Modellregister für Eigenentwicklungen.' },
  'A.4.5': { begruendung: 'Rechenressourcen in Cloud, Rechenzentrum, OT und auf der Maschinensteuerung.', status: 'umgesetzt', verantwortlich: 'P-003', nachweise: ['N-040'], umsetzung: 'Rechenressourcen und Standorte je System im Ressourcenblatt, Abgleich mit dem ISMS-Asset-Inventar.' },
  'A.4.6': { begruendung: 'Kompetenzen der Beteiligten sind für Entwicklung und Aufsicht entscheidend (R-013).', status: 'umgesetzt', verantwortlich: 'P-005', nachweise: ['N-041', 'N-040'], umsetzung: 'Personal je System im Ressourcenblatt, Kompetenzmatrix D-17-EB.' },
  'A.5.2': { begruendung: 'Pflicht zur Beurteilung der Folgen; vier Systeme mit voller Abschätzung (IA-002, IA-006, IA-007, IA-008); Nachtrainieren als Auslöser (R-006).', status: 'umgesetzt', verantwortlich: 'P-002', nachweise: ['N-007'], umsetzung: 'Verfahren D-08 mit Kurzprüfung für jedes System und voller Abschätzung bei Schwelle; Auslöser für Neubeurteilung festgelegt.' },
  'A.5.3': { begruendung: 'Ergebnisse müssen aufbewahrt und bei Änderungen nachgeführt werden (R-019).', status: 'umgesetzt', verantwortlich: 'P-002', nachweise: ['N-008'], umsetzung: 'Acht Folgenabschätzungen IA-001 bis IA-008 freigegeben und abgelegt; Aufbewahrung 10 Jahre.' },
  'A.5.4': { begruendung: 'Wirkung auf Bewerbende und Kunden (IA-006, IA-008, R-019).', status: 'umgesetzt', verantwortlich: 'P-002', nachweise: ['N-008', 'N-009'], umsetzung: 'Betroffene Gruppen, Nutzen und Schaden je Ziel in den vier vollen Abschätzungen IA-002, IA-006, IA-007 und IA-008; Verknüpfung mit der DSFA.' },
  'A.5.5': { begruendung: 'Gesellschaftliche Wirkungen (Arbeitsmarkt, Umwelt) sind zu beurteilen, besonders bei KI-008 und KI-002 (R-019).', status: 'umgesetzt', verantwortlich: 'P-002', nachweise: ['N-008'], umsetzung: 'Abschnitt Gesellschaft und Umwelt in den vollen Abschätzungen; Ergebnis für KI-008: mittelbare Diskriminierung als gesellschaftliches Risiko behandelt.' },
  'A.6.1.2': { begruendung: 'Wir entwickeln KI als Produktfunktion und für eigene Prozesse; gilt für die Eigenentwicklungen (R-009).', status: 'umgesetzt', verantwortlich: 'P-004', nachweise: ['N-010', 'N-011', 'N-013'], umsetzung: 'Ziele für verantwortungsvolle Entwicklung in D-12 Abschnitt 10.1 (Fairness, Nachvollziehbarkeit, Datenschutz, Robustheit und Sicherheit, menschliche Kontrolle); für MX-Predict im Lastenheft ergänzt um «keine Sicherheitsfunktion» und «keine Felddaten ohne Zustimmung». Erfüllung je Release im Validierungsbericht, gemessen mit Ziel Z-007 (D-05).', kiSysteme: EIGENBAU },
  'A.6.1.3': { begruendung: 'Ein festgelegter Entwicklungsprozess fehlte bei KI-003 (R-012).', status: 'teilweise', verantwortlich: 'P-004', nachweise: ['N-010', 'N-015'], umsetzung: 'Lebenszyklus mit Phasen und Freigaben in D-12, gekoppelt an den ISMS-Änderungsprozess; für KI-003 in Einführung (M-012).', kiSysteme: EIGENBAU },
  'A.6.2.2': { begruendung: 'Anforderungen an KI-Funktionen müssen festgehalten sein (R-009).', status: 'umgesetzt', verantwortlich: 'P-004', nachweise: ['N-011'], umsetzung: 'Lastenheft je Release mit funktionalen, Sicherheits- und Transparenzanforderungen; für MX-Predict ausdrücklich «keine Sicherheitsfunktion».', kiSysteme: EIGENBAU },
  'A.6.2.3': { begruendung: 'Nachvollziehbarkeit von Entwurf und Modellständen (R-006, R-012, R-013).', status: 'umgesetzt', verantwortlich: 'P-004', nachweise: ['N-012'], umsetzung: 'Architektur- und Entwurfsdokumentation im Wiki, Modellregister mit Daten- und Codestand.', kiSysteme: EIGENBAU },
  'A.6.2.4': { begruendung: 'Tests vor Freigabe sind zentral für Qualitätsprüfung, Wartungsfunktion und Chatbot (R-005, R-008, R-014, R-016).', status: 'umgesetzt', verantwortlich: 'P-004', nachweise: ['N-013', 'N-014', 'N-044'], umsetzung: 'Validierung je Release gegen festgelegte Kennzahlen: Testset 3 000 Bilder (KI-001), Prüfstanddaten (KI-002), Vergleichszeiträume (KI-003), Testkatalog 400 Fragen (KI-006).', kiSysteme: [...MIT_TRAINING, 'KI-006'] },
  'A.6.2.5': { begruendung: 'Einführung und Nachtrainieren sind Änderungen mit Freigabe (R-006, R-024).', status: 'umgesetzt', verantwortlich: 'P-004', nachweise: ['N-015', 'N-014'], umsetzung: 'Einführungsplan je Release im ISMS-Änderungsprozess; Freigabeformular QS-F-118 für Nachtrainings.', kiSysteme: [...MIT_TRAINING, 'KI-006'] },
  'A.6.2.6': { begruendung: 'Betrieb und Überwachung im Feld (R-003, R-005, R-010, R-014, R-027).', status: 'teilweise', verantwortlich: 'P-003', nachweise: ['N-016'], umsetzung: 'Monatliche Monitoring-Berichte: Schlupf und Pseudoausschuss (KI-001), Drift (KI-002), Antwortqualität (KI-006), Nutzungsauswertung (KI-004). Nach dem Beinahe-Vorfall F-005: Einschränkung externer Links und Bilder in Antworten von Copilot in Arbeit (M-029).' },
  'A.6.2.7': { begruendung: 'Kunden und Nutzende brauchen passende Dokumentation (R-009, R-017).', status: 'umgesetzt', verantwortlich: 'P-004', nachweise: ['N-017', 'N-012'], umsetzung: 'Betriebsanleitung mit Kapitel MX-Predict, Integratorhandbuch, interne Betriebsdokumentation je Eigenentwicklung.', kiSysteme: EIGENBAU },
  'A.6.2.8': { begruendung: 'Protokolle sind für Fehlersuche, Vorfälle und ab 2027 für KI-008 nötig (R-016).', status: 'umgesetzt', verantwortlich: 'P-003', nachweise: ['N-018'], umsetzung: 'Protokollierungskonzept: Eingaben, Ausgaben, Fehler und Änderungen; Aufbewahrung 12 Monate, Auswertung quartalsweise, Anbindung an das SIEM des ISMS. Abweichung bei KI-005: Der Team-Plan bewahrt Nutzungsprotokolle nur 90 Tage auf; deshalb monatlicher Export ins SIEM, dort 12 Monate (festgehalten in D-12).' },
  'A.7.2': { begruendung: 'Wir trainieren eigene Modelle und trainieren das Kamerasystem nach.', status: 'umgesetzt', verantwortlich: 'P-004', nachweise: ['N-019'], umsetzung: 'Datenverfahren D-13: Auswahl, Schutz, Dokumentation und Löschung von Trainings- und Testdaten.', kiSysteme: MIT_TRAINING },
  'A.7.3': { begruendung: 'Wir nutzen Daten und Modelle Dritter: Branchenindizes im Prognosemodell (KI-003) und die Grundmodelle der Lieferanten bei KI-001 und KI-006. Herkunft, Rechte und Qualität müssen geklärt sein.', status: 'umgesetzt', verantwortlich: 'P-004', nachweise: ['N-049', 'N-026'], umsetzung: 'Herkunft, Lizenz und Aktualisierung der Branchenindizes im Datenblatt D-13; Angaben der Lieferanten L-001 und L-004 zu Grundmodell und Trainingsdaten über die Prüffragen PF-05 (D-16-EB). Felddaten von Kunden fliessen nicht ins Training.', kiSysteme: ['KI-001', 'KI-003', 'KI-006'] },
  'A.7.4': { begruendung: 'Datenqualität bestimmt die Erkennungs- und Prognosegüte (R-005, R-010).', status: 'umgesetzt', verantwortlich: 'P-004', nachweise: ['N-020'], umsetzung: 'Messbare Qualitätskriterien je Datensatz (Labelgenauigkeit, Vollständigkeit, Ausgewogenheit der Klassen); Prüfung vor jedem Training.', kiSysteme: [...MIT_TRAINING, 'KI-006', 'KI-008'] },
  'A.7.5': { begruendung: 'Rückverfolgbarkeit bei Reklamationen und Modellfehlern (R-010, R-012).', status: 'umgesetzt', verantwortlich: 'P-004', nachweise: ['N-019', 'N-012'], umsetzung: 'Versionierte Datensätze mit Herkunftsangabe im Modellregister; jeder Modellstand verweist auf den Datenstand.', kiSysteme: MIT_TRAINING },
  'A.7.6': { begruendung: 'Labeln von Bildern und Bereinigung von Mess- und ERP-Daten beeinflussen das Ergebnis.', status: 'umgesetzt', verantwortlich: 'P-004', nachweise: ['N-019', 'N-020'], umsetzung: 'Aufbereitungsschritte und Kriterien je Datensatz im Datenblatt D-13 (Ausreisser, Lücken, Labelrichtlinie).', kiSysteme: MIT_TRAINING },
  'A.8.2': { begruendung: 'Kunden, Bewerbende und Mitarbeitende müssen über KI informiert werden (R-004, R-008, R-014, R-015, R-020).', status: 'umgesetzt', verantwortlich: 'P-008', nachweise: ['N-021', 'N-017'], umsetzung: 'Informationen je System in D-14-EB: Chatbot-Hinweis, Kapitel in der Betriebsanleitung, Hinweise für Nutzende von Copilot und ChatGPT Team; für KI-008 vor der Wiederinbetriebnahme (Betreiberpflichten, E-05).' },
  'A.8.3': { begruendung: 'Externe sollen nachteilige Wirkungen melden können (Kunden, Bewerbende).', status: 'umgesetzt', verantwortlich: 'P-008', nachweise: ['N-022'], umsetzung: 'Formular «KI-Rückmeldung» im Kundenportal und Adresse ki-feedback@muster-maschinenbau.example; Bearbeitung durch den Kundendienst mit Eingangsbestätigung innert 5 Arbeitstagen und Antwort innert 30 Tagen; Register der Meldungen in D-22-EB.' },
  'A.8.4': { begruendung: 'Vorfälle mit Produkt-KI und Chatbot müssen rasch kommuniziert werden.', status: 'umgesetzt', verantwortlich: 'P-003', nachweise: ['N-023'], umsetzung: 'ISMS-Vorfallverfahren um KI-Vorfälle ergänzt (Definition, Kommunikationsplan, Fristen); Übung am 02.12.2026.' },
  'A.8.5': { begruendung: 'Verträge mit Grosskunden verlangen Information über KI-Einsatz, Unterauftragnehmer und Vorfälle (IP-006, D-14-EB); für KI-008 kommen ab 2.12.2027 Meldungen an Anbieter und Behörden hinzu (Art. 26(5)).', status: 'umgesetzt', verantwortlich: 'P-002', nachweise: ['N-050', 'N-021'], umsetzung: 'Liste der Informationspflichten aus Kundenverträgen mit Frist und Zuständigkeit; Information der Grosskunden bei neuen KI-Systemen und Vorfällen über den Vorfallprozess (D-14-EB); Meldungen nach Art. 26(5) vor der Wiederinbetriebnahme von KI-008 vorbereitet (Betreiberpflichten, E-05).' },
  'A.9.2': { begruendung: 'Nutzungsregeln und Freigabeprozess für alle Werkzeuge (R-001, R-002, R-017, R-018, R-025).', status: 'wirksam', verantwortlich: 'P-003', nachweise: ['N-024', 'N-025'], umsetzung: 'Richtlinie KI-Nutzung als Ergänzungsblatt D-15-EB zur ISMS-Nutzungsrichtlinie; Anträge an die AIMS-Verantwortliche, Entscheid mit der verantwortlichen Person, bei hohem Risiko durch die GL, Frist 10 Arbeitstage; Bestätigung durch 100 % der Nutzenden.' },
  'A.9.3': { begruendung: 'Menschliche Prüfung der Ergebnisse (R-001, R-004, R-017, R-019).', status: 'umgesetzt', verantwortlich: 'P-002', nachweise: ['N-031', 'N-024'], umsetzung: 'Ziele Z-003 und Z-005 für die Nutzung, Aufsichtsregeln in D-15-EB; erste Stichprobe für Z-003 am 26.01.2027 (M-023).' },
  'A.9.4': { begruendung: 'Nutzung nur für den festgelegten Zweck (R-003, R-014, R-017, R-019).', status: 'umgesetzt', verantwortlich: 'P-002', nachweise: ['N-006', 'N-024', 'N-016'], umsetzung: 'Zweck je System im Inventar, Schulung, stichprobenweise Prüfung der Nutzung im Monitoring.' },
  'A.10.2': { begruendung: 'Aufteilung der Verantwortung mit Lieferanten und Kunden (R-007, R-011).', status: 'umgesetzt', verantwortlich: 'P-007', nachweise: ['N-028', 'N-029'], umsetzung: 'Verantwortungsmatrix je System (D-16-EB, Blatt «Verantwortung»), Vertragsanhang Datennutzung für Kunden.' },
  'A.10.3': { begruendung: 'Sieben KI-Lieferanten, davon ein Dienst ohne Vertrag; still aktivierte Funktion bei der HR-SaaS (R-001, R-007, R-024, R-025).', status: 'teilweise', verantwortlich: 'P-007', nachweise: ['N-026', 'N-027'], umsetzung: 'KI-Prüfpunkte PF-01 bis PF-21 in der ISMS-Lieferantenbewertung (D-16-EB), jährliche Prüfung; Funktionsscan und Vertragsnachtrag in Arbeit (M-021, M-027).' },
  'A.10.4': { begruendung: 'Kunden der Maschinen und des Portals haben Erwartungen an unsere KI (R-008, R-009, R-011).', status: 'umgesetzt', verantwortlich: 'P-008', nachweise: ['N-029', 'N-017'], umsetzung: 'Kundenanforderungen aus Verträgen und Lieferantenaudits in D-01; Grenzen der Funktionen in Betriebsanleitung und Produktdatenblatt.' },
};

type Z = { id: string; begruendung: string; status?: ControlEintrag['status']; verantwortlich?: string; nachweise?: string[]; umsetzung?: string; kiSysteme: string[]; anwendbar?: JaNeinOffen };
const z = (x: Z): ControlEintrag => ({
  id: x.id, rahmenwerk: 'EUAIA', anwendbar: x.anwendbar ?? 'ja', begruendung: x.begruendung,
  status: (x.anwendbar ?? 'ja') === 'ja' ? (x.status ?? 'umgesetzt') : 'offen',
  ...((x.anwendbar ?? 'ja') === 'ja' && x.verantwortlich ? { verantwortlich: x.verantwortlich } : {}),
  nachweise: x.nachweise ?? [], umsetzung: x.umsetzung ?? '', iso27001: (x.anwendbar ?? 'ja') === 'ja' ? euaia27001(x.id) : [], kiSysteme: x.kiSysteme, vorschlag: 'aiact',
});
const ALLE = ['KI-001', 'KI-002', 'KI-003', 'KI-004', 'KI-005', 'KI-006', 'KI-007', 'KI-008'];

export const euaiaControls: ControlEintrag[] = [
  z({ id: 'EUAIA-01', kiSysteme: ALLE, begruendung: 'Gilt für alle Systeme: keine verbotene Praxis nach Art. 5.', verantwortlich: 'P-009', nachweise: ['N-045'], umsetzung: 'Prüfung aller acht Systeme in E-02 gegen Art. 5 einschliesslich der ab 2.12.2026 geltenden Verbote nach Art. 5(1a) und 5(1b); keine verbotene Praxis. Die HR-SaaS hat keine Video- oder Emotionsanalyse. Wiederholung bei jedem neuen System.' }),
  z({ id: 'EUAIA-02', kiSysteme: ALLE, begruendung: 'Wir sind Anbieter und Betreiber; Massnahmen zur KI-Kompetenz nach Art. 4.', status: 'wirksam', verantwortlich: 'P-005', nachweise: ['N-030'], umsetzung: 'E-Learning und Teamsitzungen (M-022), zielgruppengerechte Vertiefung für Entwicklung, Aufsicht HR und Geschäftsleitung (E-04).' }),
  z({ id: 'EUAIA-03', kiSysteme: ALLE, begruendung: 'Rolle je System bestimmt, inklusive Rollenwechsel nach Art. 25(1).', verantwortlich: 'P-002', nachweise: ['N-045', 'N-036', 'N-037'], umsetzung: 'Rollenbestimmung E-01 für alle Systeme; Schweizer Bezug über EU-Kunden, EU-Output und Niederlassung in Deutschland geprüft.' }),
  z({ id: 'EUAIA-04', kiSysteme: ALLE, begruendung: 'Risikoklasse je System; Grenzfall Art. 6(1b) bei KI-002.', verantwortlich: 'P-002', nachweise: ['N-045', 'N-036'], umsetzung: 'Einstufung in E-02 mit Begründung; KI-002 als Nicht-Sicherheitsbauteil nach Art. 6(1a) dokumentiert und juristisch geprüft; KI-008 Hochrisiko Anhang III Nr. 4a.' }),
  z({ id: 'EUAIA-05', kiSysteme: ['KI-006'], begruendung: 'Ersatzteil-Assistent interagiert direkt mit Personen (Art. 50(1)).', status: 'wirksam', verantwortlich: 'P-008', nachweise: ['N-021'], umsetzung: 'Hinweis vor dem ersten Gespräch seit dem Start im März 2026, seit 23.10.2026 auch in jeder Antwort, barrierearm im Portal (E-07); geprüft im Testkatalog.' }),
  z({ id: 'EUAIA-06', kiSysteme: ['KI-006'], begruendung: 'Der Ersatzteil-Assistent erzeugt Antworttexte mit einem Sprachmodell (Art. 50(2)); die Ausnahme für unterstützende Standardbearbeitung greift nicht, weil er keine Eingaben der Nutzenden bearbeitet.', verantwortlich: 'P-008', nachweise: ['N-047', 'N-051'], umsetzung: 'Maschinenlesbare Kennzeichnung jeder Antwort in den Metadaten der Seite, in der Schnittstelle und in Exporten des Gesprächs seit 23.10.2026 (M-016), vor der Frist vom 2.12.2026; rechtliche Einschätzung vom 22.09.2026.' }),
  z({ id: 'EUAIA-08', kiSysteme: ['KI-008'], begruendung: 'Betreiber eines Hochrisiko-Systems: Betrieb gemäss Betriebsanleitung, technische und organisatorische Massnahmen.', status: 'geplant', verantwortlich: 'P-005', nachweise: ['N-046'], umsetzung: 'Betriebsanleitung beim Lieferanten angefordert (PF-05), Konfiguration als Sortierhilfe, Nutzungsanweisung für die Personalabteilung bis 30.09.2027 (M-019).' }),
  z({ id: 'EUAIA-09', kiSysteme: ['KI-008'], begruendung: 'Menschliche Aufsicht durch kompetente Personen (Art. 26(2)).', status: 'umgesetzt', verantwortlich: 'P-005', nachweise: ['N-030', 'N-041'], umsetzung: 'Zwei Recruiterinnen und Leiterin Personal im Oktober 2026 geschult (K-001); Befugnis, Werte zu übersteuern und die Funktion abzuschalten, in der Rollenbeschreibung.' }),
  z({ id: 'EUAIA-10', kiSysteme: ['KI-008'], begruendung: 'Eingabedaten unter unserer Kontrolle müssen dem Zweck entsprechen (Art. 26(4)).', status: 'geplant', verantwortlich: 'P-005', nachweise: ['N-046'], umsetzung: 'Prüfliste für Anforderungsprofile auf mittelbar diskriminierende Merkmale; Ausblenden von Foto, Geburtsdatum und Nationalität (M-019).' }),
  z({ id: 'EUAIA-11', kiSysteme: ['KI-008'], begruendung: 'Überwachung des Betriebs und Meldung an den Anbieter (Art. 26(5)).', status: 'geplant', verantwortlich: 'P-005', nachweise: ['N-046'], umsetzung: 'Halbjährliche Stichprobe von 30 Bewerbungen, Meldeweg an den Lieferanten und Aussetzen der Funktion bei Auffälligkeiten; Verfahren bis 30.09.2027.' }),
  z({ id: 'EUAIA-12', kiSysteme: ['KI-008'], begruendung: 'Automatisch erzeugte Protokolle mindestens 6 Monate aufbewahren (Art. 26(6)).', status: 'teilweise', verantwortlich: 'P-003', nachweise: ['N-018'], umsetzung: 'Protokolle der HR-SaaS 12 Monate beim Lieferanten; Exportweg für Prüfungen vertraglich geregelt, Test steht aus.' }),
  z({ id: 'EUAIA-13', kiSysteme: ['KI-008'], begruendung: 'Information der Arbeitnehmendenvertretung und der betroffenen Mitarbeitenden vor dem Einsatz (Art. 26(7)).', status: 'umgesetzt', verantwortlich: 'P-005', nachweise: ['N-038'], umsetzung: 'Betriebsrat der deutschen Gesellschaft und Personalkommission am 14.10.2026 informiert; erneute Information vor der Wiederinbetriebnahme.' }),
  z({ id: 'EUAIA-14', kiSysteme: ['KI-008'], begruendung: 'Information der Bewerbenden über die Verwendung des Systems (Art. 26(11)).', status: 'geplant', verantwortlich: 'P-005', nachweise: ['N-009'], umsetzung: 'Hinweis in Stelleninseraten und Datenschutzerklärung (M-020), bis 30.09.2027.' }),
  z({ id: 'EUAIA-15', kiSysteme: ['KI-008'], begruendung: 'Recht auf Erläuterung der Rolle des Systems im Entscheid (Art. 86).', status: 'geplant', verantwortlich: 'P-005', nachweise: ['N-046'], umsetzung: 'Erläuterungsverfahren mit Musterantwort und Angaben des Lieferanten, Frist 30 Tage (M-020).' }),
  z({ id: 'EUAIA-16', anwendbar: 'nein', kiSysteme: ['KI-008'], begruendung: 'Keine Grundrechte-Folgenabschätzung nach Art. 27: Wir sind eine private Arbeitgeberin ohne öffentliche Dienste, und KI-008 ist kein Fall nach Anhang III Nr. 5 Bst. b oder c (E-06). Die Folgen für Bewerbende sind in IA-008 und DSFA-2026-04 abgeschätzt. Neubeurteilung, falls wir öffentliche Aufgaben übernehmen.' }),
  z({ id: 'EUAIA-17', kiSysteme: ['KI-008'], begruendung: 'Informationen des Anbieters für die Datenschutz-Folgenabschätzung nutzen (Art. 26(9)).', status: 'umgesetzt', verantwortlich: 'P-009', nachweise: ['N-009'], umsetzung: 'DSFA-2026-04 mit Verweis auf IA-008; Aktualisierung, sobald die Angaben des Lieferanten zu Trainingsdaten vorliegen.' }),
  z({ id: 'EUAIA-18', kiSysteme: ALLE, begruendung: 'Zusammenarbeit mit Behörden und Korrekturmassnahmen gilt für alle Rollen.', verantwortlich: 'P-003', nachweise: ['N-023'], umsetzung: 'Behördenanfragen über den Behördenkontakt des ISMS (27001-5.5) mit Beizug der AIMS-Verantwortlichen; Korrekturmassnahmen über D-22-EB.' }),
  z({ id: 'EUAIA-33', kiSysteme: ['KI-008'], begruendung: 'Schwerwiegende Vorfälle mit einem Hochrisiko-System melden (Art. 73, 26(5)).', status: 'geplant', verantwortlich: 'P-003', nachweise: ['N-023'], umsetzung: 'Kriterien für schwerwiegende Vorfälle und Meldeweg an Anbieter und Marktüberwachung im ISMS-Vorfallverfahren ergänzen, bis 30.09.2027.' }),
  z({ id: 'EUAIA-39', anwendbar: 'nein', kiSysteme: ['KI-006'], begruendung: 'Nicht anwendbar: KI-006 beruht auf einem Modell mit allgemeinem Verwendungszweck, wir bringen aber kein solches Modell in Verkehr: Der Ersatzteil-Assistent nutzt das Modell der Cloud-KI-Plattform über eine Schnittstelle, ohne es zu verändern oder weiterzugeben. Die Pflichten nach Art. 53 bis 55 trägt deren Anbieter. Neubeurteilung, falls wir ein Modell feinabstimmen oder selbst anbieten.' }),
];

export const eigeneControls: EigenesControl[] = [
  { id: 'EC-01', titel: 'Exportkontrolle bei generativer KI', beschreibung: 'Technische Daten mit Exportkontrollkennzeichen werden in kein KI-System eingegeben. Vor jeder Eingabe technischer Daten prüfen die Nutzenden das Kennzeichen im ERP oder PDM; im Zweifel entscheidet die Exportkontrollbeauftragte. Gilt für alle Werkzeuge der generativen KI.', quelle: 'Güterkontrollgesetz und Güterkontrollverordnung, Risiken R-001 und R-002' },
  { id: 'EC-02', titel: 'Fachprüfung KI-übersetzter Sicherheitshinweise', beschreibung: 'Sicherheits- und Warnhinweise in Betriebsanleitungen, die mit KI übersetzt wurden, prüft vor der Freigabe eine Fachübersetzerin oder ein Fachübersetzer der Zielsprache; die Prüfung wird im Redaktionssystem vermerkt.', quelle: 'Maschinenverordnung (Anforderungen an die Betriebsanleitung), Risiko R-017' },
];

export const eigeneControlEintraege: ControlEintrag[] = [
  { id: 'EC-01', rahmenwerk: 'EIGENE', anwendbar: 'ja', begruendung: 'Exportkontrollierte Konstruktionsdaten (TH-004).', status: 'umgesetzt', verantwortlich: 'P-007', nachweise: ['N-039'], umsetzung: 'Arbeitsanweisung AA-EXP-07, Hinweis im E-Learning, Kennzeichen im ERP und PDM.', iso27001: ['27001-5.31', '27001-5.12'], kiSysteme: ['KI-004', 'KI-005'] },
  { id: 'EC-02', rahmenwerk: 'EIGENE', anwendbar: 'ja', begruendung: 'Sicherheit der Bediener beim Kunden.', status: 'teilweise', verantwortlich: 'P-004', nachweise: ['N-048'], umsetzung: 'Fachprüfung jeder Übersetzung mit Prüfvermerk im Redaktionssystem: Deutsch, Englisch und Französisch intern, Italienisch und Polnisch durch beauftragte Fachübersetzer im Einzelauftrag; Rahmenvertrag mit Fachübersetzung über L-006 bis April 2027 (M-018).', iso27001: [], kiSysteme: ['KI-007'] },
];

const pp = (werte: JaNeinOffen[]): Record<string, JaNeinOffen> => Object.fromEntries(werte.map((w, i) => [`PF-${String(i + 1).padStart(2, '0')}`, w]));

export const lieferanten: Lieferant[] = [
  { id: 'L-001', name: 'Optikwerk Vision Systems GmbH', leistung: 'Kamerasystem mit lernendem Bildklassifikator für die Prüfstation Linie 3, Software-Updates und Fernsupport (KI-001).', pruefstatus: 'mit-auflagen',
    pruefpunkte: pp(['ja', 'ja', 'ja', 'offen', 'ja', 'nein', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja']),
    bemerkung: 'Lokaler Betrieb ohne Cloud. Auflagen: Ankündigung von Modelländerungen (PF-06 nein), Liste der Unterauftragnehmer fehlt (PF-04), Fernzugriff nur über den Fernwartungsprozess; Vertragsnachtrag M-021 bis 30.04.2027.', naechstePruefung: '2027-10-31' },
  { id: 'L-002', name: 'M365 Copilot (Bezug über Rheintal Informatik AG)', leistung: 'Lizenzen und Betrieb von M365 Copilot im eigenen Mandanten (KI-004).', pruefstatus: 'mit-auflagen',
    pruefpunkte: pp(['ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja']),
    bemerkung: 'Datenhaltung Schweiz und EU, keine Trainingsnutzung, Zertifikate liegen vor. Hinweis: Risiko der Berechtigungen liegt bei uns (R-003). Auflagen: Externe Links und Bilder in Antworten sind nicht abschaltbar (PF-20 offen), Einschränkung über die Mandanteneinstellungen mit M-029 bis 31.03.2027; Modellversion je Funktion nicht ausgewiesen (PF-21 offen), Angaben beim Anbieter angefragt, bis dahin Missbrauchsfälle nach jedem grösseren Update.', naechstePruefung: '2027-09-30' },
  { id: 'L-003', name: 'ChatGPT Team (Direktvertrag)', leistung: 'Arbeitsbereich mit Firmenkonten für Konstruktion, Einkauf und Vertrieb (KI-005).', pruefstatus: 'mit-auflagen',
    pruefpunkte: pp(['ja', 'nein', 'ja', 'ja', 'ja', 'offen', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja']),
    bemerkung: 'Verarbeitung in den USA, keine Regionswahl (PF-02 nein). Auflage: keine Daten über der Klasse «intern», keine exportkontrollierten Daten (EC-01). Protokolle im Team-Plan nur 90 Tage, monatlicher Export ins SIEM (PF-11).', naechstePruefung: '2027-06-30' },
  { id: 'L-004', name: 'Nordwind Cloud Services AG (Cloud-KI-Plattform)', leistung: 'Sprachmodell über Schnittstelle für den Ersatzteil-Assistenten, Rechenzentrum in der EU (KI-006).', pruefstatus: 'mit-auflagen',
    pruefpunkte: pp(['ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'ja', 'offen']),
    bemerkung: 'Modellwechsel werden 60 Tage im Voraus angekündigt; Ausstieg technisch möglich, Aufwand für Wechsel des Modells noch nicht bewertet (PF-15).', naechstePruefung: '2027-09-30' },
  { id: 'L-005', name: 'Talentis HR Cloud AG', leistung: 'Bewerbungsmanagement-Software als SaaS mit KI-Funktion «Kandidaten-Ranking» (KI-008).', pruefstatus: 'mit-auflagen',
    pruefpunkte: pp(['ja', 'ja', 'ja', 'ja', 'offen', 'nein', 'ja', 'ja', 'ja', 'offen', 'ja', 'ja', 'ja', 'ja', 'ja']),
    bemerkung: 'Funktion ohne Ankündigung aktiviert (PF-06 nein, Feststellung F-002). Angeforderte Unterlagen: Betriebsanleitung nach Art. 13, Angaben zu Trainingsdaten und Bias-Tests (PF-05, PF-10); Frist 31.05.2027. Bis dahin Funktion deaktiviert.', naechstePruefung: '2027-05-31' },
  { id: 'L-006', name: 'Linguatext Sprachdienste AG', leistung: 'Übersetzungsdienst mit KI und Fachübersetzung für Betriebsanleitungen, Firmenkonto, Ablösung von KI-007.', pruefstatus: 'in-pruefung',
    pruefpunkte: pp(['ja', 'ja', 'ja', 'offen', 'ja', 'ja', 'offen', 'ja', 'ja', 'offen', 'ja', 'ja', 'ja', 'ja', 'ja']),
    bemerkung: 'Test mit zwei Betriebsanleitungen erfolgreich; Vertrag in Verhandlung, Abschluss bis 31.03.2027 (M-018).', naechstePruefung: '2027-03-31' },
  { id: 'L-007', name: 'Kostenloser Online-Übersetzungsdienst (ohne Vertrag)', leistung: 'Öffentlicher Webdienst mit KI für Vorübersetzungen der Technischen Redaktion (KI-007), ohne Firmenkonto.', pruefstatus: 'mit-auflagen',
    pruefpunkte: pp(['nein', 'nein', 'nein', 'offen', 'nein', 'nein', 'nein', 'offen', 'nein', 'offen', 'nein', 'nein', 'offen', 'ja', 'ja']),
    bemerkung: 'Geprüft nach Entdeckung als Schatten-KI: Nutzungsbedingungen erlauben Training mit unseren Eingaben, Region und Unterauftragnehmer unbekannt, keine Zusicherungen. Auflage: nur beschreibende Textbausteine der Klasse «öffentlich» ohne Sicherheits- und Warnhinweise, Fachprüfung jeder Übersetzung (EC-02); Nutzung als befristete Ausnahme der Geschäftsleitung bis 12.04.2027, Ablösung durch L-006 (M-018).', naechstePruefung: '2027-04-09' },
];

const dok = (id: string, version: string, eigner: string, freigabe: { von: string; am: string } | undefined, ablage: string, naechste: string | undefined, isms: boolean, status: DokumentEintrag['status'] = 'freigegeben'): DokumentEintrag => ({
  id, version, status, eigner, ...(freigabe ? { freigabe } : {}), ...(naechste ? { naechsteUeberpruefung: naechste } : {}), ablageort: `SharePoint ISMS/AIMS > ${ablage}`, giltFuerIsms: isms,
});
const GL = (am: string) => ({ von: 'P-001', am });
const AIMS = (am: string) => ({ von: 'P-002', am });

export const dokumente: DokumentEintrag[] = [
  dok('D-00', '1.0', 'P-002', GL('2026-08-04'), '00_Projekt', undefined, false),
  dok('D-01', '1.1', 'P-002', GL('2027-02-02'), '01_Kontext', '2027-08-31', true),
  dok('D-02', '1.2', 'P-002', GL('2027-02-02'), '01_Kontext', '2027-08-31', false),
  dok('D-03', '1.0', 'P-002', GL('2026-09-01'), '03_Leitlinien', '2027-08-31', false),
  dok('D-04-EB', '1.1', 'P-002', GL('2027-02-02'), '04_Organisation', '2027-08-31', true),
  dok('D-05', '1.1', 'P-002', GL('2027-02-02'), '05_Messung', '2027-10-31', false),
  dok('D-06-EB', '1.0', 'P-003', GL('2026-09-29'), '07_Risiken', '2027-09-30', true),
  dok('D-07', '1.1', 'P-002', GL('2027-02-02'), '07_Risiken', '2027-04-30', false),
  dok('D-07-EB', '1.0', 'P-003', AIMS('2026-09-29'), '07_Risiken', '2027-09-30', true),
  dok('D-08', '1.0', 'P-002', GL('2026-09-29'), '08_Folgen', '2027-09-30', false),
  dok('D-09', '1.0', 'P-002', GL('2026-11-10'), '08_Folgen', '2027-09-30', false),
  // Folgenabschätzungen als eigene Dokumente D-09-KI-xxx; Freigabe und Datum aus der Abschätzung
  ...([['KI-001', '1.1', 'P-006'], ['KI-002', '1.0', 'P-004'], ['KI-003', '1.0', 'P-007'], ['KI-004', '1.1', 'P-003'], ['KI-005', '1.1', 'P-004'], ['KI-006', '1.0', 'P-008'], ['KI-007', '1.0', 'P-004'], ['KI-008', '1.0', 'P-005']] as const).map(([ki, v, e]) =>
    dok(`D-09-${ki}`, v, e, undefined, '08_Folgen', undefined, false)),
  dok('D-10-EB', '1.3', 'P-003', AIMS('2027-01-28'), '10_Inventar', '2027-04-30', true),
  dok('D-11', '1.1', 'P-002', GL('2027-02-02'), '11_SoA', '2027-10-31', false),
  dok('D-12', '1.1', 'P-004', GL('2027-02-02'), '12_Lebenszyklus', '2027-12-31', false),
  dok('D-13', '1.0', 'P-004', AIMS('2026-12-08'), '13_Daten', '2027-12-31', false),
  dok('D-14-EB', '1.0', 'P-008', AIMS('2026-12-08'), '14_Information', '2027-12-31', true),
  dok('D-15-EB', '1.0', 'P-003', GL('2026-11-24'), '15_Nutzung', '2027-11-30', true),
  dok('D-16-EB', '1.1', 'P-007', AIMS('2027-01-28'), 'ISMS > Lieferanten', '2027-07-31', true),
  dok('D-17-EB', '1.1', 'P-005', AIMS('2027-02-04'), 'HR > Kompetenzen', '2027-12-31', true),
  dok('D-20-EB', '1.1', 'P-002', GL('2027-01-22'), '20_Audit', '2027-12-31', true),
  dok('D-21-EB', '1.0', 'P-002', GL('2027-02-02'), '21_Managementbewertung', '2028-01-31', true),
  dok('D-22-EB', '1.1', 'P-002', GL('2027-02-04'), '22_Korrekturen', '2027-12-31', true),
  dok('D-23', '1.1', 'P-003', AIMS('2027-02-04'), '00_Projekt', '2027-08-31', true),
  dok('D-24', '1.1', 'P-002', GL('2026-10-27'), 'E_AI-Act', '2027-09-30', false),
  dok('D-25', '1.1', 'P-002', GL('2027-02-02'), '00_Projekt', '2027-06-30', false),
  dok('D-26-EB', '1.1', 'P-003', AIMS('2027-02-04'), 'ISMS > Dokumentenlenkung', '2027-06-30', true),
  dok('D-03-EB', '1.0', 'P-003', GL('2026-09-01'), '03_Leitlinien', '2027-08-31', true),
  dok('E-01', '1.1', 'P-002', GL('2026-10-27'), 'E_AI-Act', '2027-04-30', false),
  dok('E-02', '1.1', 'P-002', GL('2026-10-27'), 'E_AI-Act', '2027-04-30', false),
  dok('E-03', '1.1', 'P-009', AIMS('2027-02-02'), 'E_AI-Act', '2027-04-30', false),
  dok('E-04', '1.1', 'P-005', AIMS('2027-02-04'), 'E_AI-Act', '2027-11-30', false),
  dok('E-05', '1.1', 'P-005', GL('2027-02-02'), 'E_AI-Act', '2027-09-30', false),
  dok('E-06', '1.0', 'P-009', AIMS('2026-10-27'), 'E_AI-Act', '2027-10-31', false),
  dok('E-07', '1.0', 'P-008', AIMS('2026-10-27'), 'E_AI-Act', '2027-09-30', false),
  dok('E-08', '1.1', 'P-004', AIMS('2026-11-30'), 'E_AI-Act', '2027-09-30', false),
  dok('E-09', '1.0', 'P-009', AIMS('2026-10-27'), 'E_AI-Act', '2027-04-30', false),
  // NIST AI RMF (für Kunden in den USA, Projektauftrag D-00)
  // Eignerin ist die AIMS-Verantwortliche: Freigabe durch die Geschäftsleitung (D-26-EB Abschnitt 5)
  dok('N-01', '1.0', 'P-002', GL('2027-02-02'), 'N_AI-RMF', '2027-08-31', false),
  dok('N-02', '1.0', 'P-002', GL('2027-02-02'), 'N_AI-RMF', '2027-08-31', false),
  dok('N-03', '1.1', 'P-002', GL('2027-02-02'), 'N_AI-RMF', '2027-06-30', false),
  dok('N-04', '1.1', 'P-003', AIMS('2027-02-02'), 'N_AI-RMF', '2027-06-30', false),
];

export const ziele: Ziel[] = [
  { id: 'Z-001', ziel: 'KI-Inventar vollständig und aktuell', kennzahl: 'Anteil der KI-Systeme mit vollständigem Eintrag, Eigner und gültigem Überprüfungsdatum', sollwert: '100 %', messmethode: 'Auswertung des KI-Inventars im Werkzeug, Abgleich mit Lizenz- und Softwareliste', haeufigkeit: 'quartalsweise', verantwortlich: 'P-003', ressourcen: '2 Stunden pro Quartal IT', termin: '2027-03-31', bewertung: 'Managementbewertung', messungen: [
    { datum: '2026-11-30', wert: '88 % (7 von 8)', bemerkung: 'Ressourcenangaben für KI-007 unvollständig' }, { datum: '2026-12-31', wert: '100 %' }, { datum: '2027-01-31', wert: '100 %', bemerkung: 'Stichtag nach dem internen Audit' }] },
  { id: 'Z-002', ziel: 'Nutzende generativer KI sind geschult', kennzahl: 'Anteil der Nutzenden von Copilot und ChatGPT Team mit abgeschlossener Schulung KI-Kompetenz', sollwert: 'mindestens 95 %', messmethode: 'Export der Lernplattform, Abgleich mit Lizenzliste', haeufigkeit: 'monatlich', verantwortlich: 'P-005', ressourcen: 'Lernplattform, 45 Minuten je Person', termin: '2027-01-31', bewertung: 'Managementbewertung, AIMS-Team', messungen: [
    { datum: '2026-11-30', wert: '64 %' }, { datum: '2026-12-31', wert: '82 %' }, { datum: '2027-01-31', wert: '96 %', bemerkung: 'Nachschulung Aussendienst im Januar abgeschlossen' }] },
  { id: 'Z-003', ziel: 'Ergebnisse generativer KI werden geprüft', kennzahl: 'Anteil der Stichproben ohne relevanten Fehler nach menschlicher Prüfung', sollwert: 'mindestens 95 %', messmethode: 'Key-User prüfen 20 Ergebnisse pro Quartal aus Angeboten und Konstruktion (M-023)', haeufigkeit: 'quartalsweise', verantwortlich: 'P-002', ressourcen: '4 Stunden pro Quartal Key-User', termin: '2027-06-30', bewertung: 'AIMS-Team, Managementbewertung', messungen: [
    { datum: '2027-01-26', wert: '95 % (19 von 20)', bemerkung: 'Erste Messung nach Feststellung F-003; ein falscher Normverweis in einem Angebot' }] },
  { id: 'Z-004', ziel: 'Qualitätsprüfung mit KI hält den Schlupf tief', kennzahl: 'Schlupf fehlerhafter Teile bei den von KI-001 geprüften Merkmalen', sollwert: 'höchstens 50 ppm', messmethode: 'Reklamationen und Montagebefunde je Monat im QM-System, bezogen auf geprüfte Teile', haeufigkeit: 'monatlich', verantwortlich: 'P-006', ressourcen: 'QM-Auswertung', termin: '2027-12-31', bewertung: 'Qualitätsbericht, Managementbewertung', messungen: [
    { datum: '2026-11-30', wert: '38 ppm' }, { datum: '2026-12-31', wert: '41 ppm' }, { datum: '2027-01-31', wert: '29 ppm', bemerkung: 'Modellversion 3.2, ab 27.01.2027 Version 3.3' }] },
  { id: 'Z-005', ziel: 'Ersatzteil-Assistent antwortet richtig', kennzahl: 'Anteil korrekter Antworten im Testkatalog und in der Stichprobe von 50 Gesprächen', sollwert: 'mindestens 97 %', messmethode: 'Testkatalog vor jedem Release, monatliche Stichprobe durch den Kundendienst', haeufigkeit: 'monatlich', verantwortlich: 'P-008', ressourcen: '6 Stunden pro Monat Kundendienst', termin: '2027-12-31', bewertung: 'AIMS-Team, Managementbewertung', messungen: [
    { datum: '2026-10-31', wert: '97,8 %' }, { datum: '2026-11-30', wert: '96,0 %', bemerkung: 'Lücken im italienischen Katalog, nachgeführt' }, { datum: '2026-12-31', wert: '98,0 %' }, { datum: '2027-01-31', wert: '98,0 %' }] },
  { id: 'Z-006', ziel: 'Schatten-KI wird rasch bewertet', kennzahl: 'Anteil neu entdeckter KI-Nutzungen, die innert 30 Tagen bewertet und entschieden sind', sollwert: '100 %', messmethode: 'Erfassungs- und Entscheiddatum im Inventar', haeufigkeit: 'quartalsweise', verantwortlich: 'P-003', ressourcen: 'AIMS-Team', termin: '2027-12-31', bewertung: 'Managementbewertung', messungen: [
    { datum: '2026-11-30', wert: '100 % (2 von 2)', bemerkung: 'KI-007 am Tag nach der Entdeckung eingeschränkt, KI-008 am Tag der Entdeckung deaktiviert' }, { datum: '2026-12-31', wert: 'keine neuen Fälle' }] },
  { id: 'Z-007', ziel: 'Eigene KI-Systeme werden erst nach vollständiger Validierung freigegeben', kennzahl: 'Anteil der Releases und Modellstände von KI-002, KI-003 und KI-006 mit Validierungsbericht gegen die Ziele aus D-12 Abschnitt 10.1 vor der Freigabe', sollwert: '100 %', messmethode: 'Abgleich der Freigaben im Modellregister mit den Validierungsberichten (N-013)', haeufigkeit: 'quartalsweise', verantwortlich: 'P-004', ressourcen: '2 Stunden pro Quartal Entwicklung', termin: '2027-12-31', bewertung: 'AIMS-Team, Managementbewertung', messungen: [
    { datum: '2026-12-31', wert: '100 % (3 von 3)', bemerkung: 'MX-Predict Release 2.1, Prognosemodell 2026-10, Testkatalog Ersatzteil-Assistent' }] },
  { id: 'Z-008', ziel: 'Sicherheits- und Warnhinweise sind in jeder Sprache fachgeprüft', kennzahl: 'Anteil der übersetzten Sicherheits- und Warnhinweise mit Prüfvermerk einer Fachübersetzerin oder eines Fachübersetzers', sollwert: '100 %', messmethode: 'Auswertung der Prüfvermerke im Redaktionssystem (N-048)', haeufigkeit: 'monatlich', verantwortlich: 'P-004', ressourcen: '1 Stunde pro Monat Technische Redaktion', termin: '2027-06-30', bewertung: 'AIMS-Team, Managementbewertung', messungen: [
    { datum: '2027-01-31', wert: '100 % (46 von 46)', bemerkung: 'Erste Auswertung über alle Übersetzungen seit August 2026' }] },
  { id: 'Z-009', ziel: 'Die Bewerbungsvorselektion benachteiligt keine Gruppe von Bewerbenden', kennzahl: 'Verhältnis der Einladungsquoten zwischen Gruppen (Alter, Geschlecht, Herkunft des Abschlusses), kumuliert über alle Bewerbungen mit Sortierhilfe seit der Wiederinbetriebnahme', sollwert: 'Verhältnis mindestens 0,8 je Gruppe; erste Auswertung ab 200 Bewerbungen, kleinere Gruppen nur als Einzelfallprüfung', messmethode: 'Halbjährliche Auswertung aller Bewerbungen mit Sortierhilfe durch die Leiterin Personal, kumuliert ab der Wiederinbetriebnahme, weil eine Stichprobe von 30 Bewerbungen für Gruppenvergleiche zu klein ist; zusätzlich Durchsicht von 30 Dossiers auf Plausibilität (M-019)', haeufigkeit: 'halbjährlich', verantwortlich: 'P-005', ressourcen: '4 Stunden pro Halbjahr Personalabteilung', termin: '2027-12-31', bewertung: 'Managementbewertung', messungen: [] },
];

export const kompetenzen: Kompetenz[] = [
  { id: 'K-001', rolle: 'Menschliche Aufsicht Bewerbungsvorselektion (KI-008)', anforderung: 'Funktionsweise und Grenzen des Passungswerts kennen, Automatisierungsneigung erkennen, Werte übersteuern und Funktion aussetzen können, Rechte der Bewerbenden kennen.', personen: ['P-005'], gruppe: 'Recruiterinnen Lea Graf und Sara Imhof', massnahme: 'Schulung durch den Lieferanten und Workshop zur Aufsicht mit der Datenschutzberaterin (je 4 Stunden).', nachweis: 'Teilnahmebestätigungen 10/2026 der Leiterin Personal und der Recruiterinnen Lea Graf und Sara Imhof in N-030, Rollenbeschreibung in N-041', wirksamkeit: 'Übung mit 20 Testbewerbungen im Januar 2027: alle Abweichungen erkannt.', status: 'erfuellt' },
  { id: 'K-002', rolle: 'Entwicklung und Validierung eigener Modelle (KI-002, KI-003, KI-006)', anforderung: 'Lebenszyklus nach D-12, Validierung, Datenqualität, Dokumentation, Einstufung nach AI Act und Maschinenverordnung.', personen: ['P-004'], gruppe: 'zwei Data Scientists und vier Software-Ingenieure der Entwicklung, Data Scientist der Planung (KI-003)', massnahme: 'Interne Schulung D-12, externer Kurs zu KI in der Maschinensicherheit (2 Tage) für zwei Entwickler.', nachweis: 'Kurszertifikate und Schulungsliste in N-030', wirksamkeit: 'Review der Validierungsberichte Release 2.1 ohne Abweichungen.', status: 'erfuellt' },
  { id: 'K-003', rolle: 'QS-Freigabe Nachtrainieren (KI-001)', anforderung: 'Labelrichtlinie, Testset, Kriterien für wesentliche Änderung, Formular QS-F-118.', personen: ['P-002'], gruppe: 'zwei QS-Fachpersonen für Labelprüfung und Test; Freigabe der Modellversion durch die Leiterin Qualität, nicht durch den Eigner des Systems', massnahme: 'Schulung des Lieferanten und interne Einweisung für QS und Schichtleitungen (M-026).', nachweis: 'Schulungsliste 01/2027 in N-030', wirksamkeit: 'Nachtraining vom 27.01.2027 mit vollständiger Freigabe nach QS-F-118 (N-014).', status: 'erfuellt' },
  { id: 'K-004', rolle: 'AIMS-Verantwortliche', anforderung: 'ISO/IEC 42001, Integration ins ISMS, Risikomethode, Folgenabschätzung, AI-Act-Grundlagen.', personen: ['P-002'], massnahme: 'Lehrgang Lead Implementer ISO/IEC 42001 (5 Tage).', nachweis: 'Zertifikat Lead Implementer 06/2026 in N-041', wirksamkeit: 'Internes Audit ohne Feststellung zu Methodik.', status: 'erfuellt' },
  { id: 'K-005', rolle: 'Nutzende generativer KI (alle mit Lizenz)', anforderung: 'Regeln D-15-EB, Datenklassen, Exportkontrolle, Prüfen der Ergebnisse, Meldeweg.', personen: ['P-003', 'P-004', 'P-007', 'P-008', 'P-010'], gruppe: 'alle Lizenznutzenden: 60 Personen mit Copilot und 25 mit ChatGPT Team, gemäss Lizenzliste', massnahme: 'E-Learning und Teamsitzung (M-022), jährliche Auffrischung.', nachweis: 'Export der Lernplattform 01/2027 in N-030: 96 % geschult (Z-002)', wirksamkeit: 'Stichprobe Z-003; Quiz im E-Learning mit mindestens 80 %.', status: 'erfuellt' },
  { id: 'K-006', rolle: 'Interne Auditorinnen und Auditoren AIMS', anforderung: 'ISO/IEC 42001 und Auditmethodik, Unabhängigkeit vom geprüften Bereich.', personen: ['P-011'], massnahme: 'Kurs interner Auditor ISO/IEC 42001 für den internen Auditor QM/ISMS; Beizug einer externen Fachauditorin.', nachweis: 'Zertifikat interner Auditor 11/2026 (HR-Ablage)', wirksamkeit: 'Bewertung des Auditberichts in der Managementbewertung MB-001.', status: 'erfuellt' },
];

export const kommunikation: Kommunikation[] = [
  { id: 'KO-001', was: 'KI-Leitlinie und Regeln zur KI-Nutzung', wann: 'bei Freigabe, danach jährlich', wer: 'P-002', mitWem: 'Alle Mitarbeitenden beider Gesellschaften', wie: 'Intranet, Teamsitzungen, E-Learning', richtung: 'intern' },
  { id: 'KO-002', was: 'Stand AIMS, Risiken mit hohem Wert, Ziele', wann: 'monatlich', wer: 'P-002', mitWem: 'Geschäftsleitung', wie: 'Traktandum in der GL-Sitzung', richtung: 'intern' },
  { id: 'KO-003', was: 'Information zur Bewerbungsvorselektion (Art. 26(7))', wann: 'vor der Wiederinbetriebnahme und bei Änderungen', wer: 'P-005', mitWem: 'Betriebsrat DE, Personalkommission CH', wie: 'Sitzung mit Protokoll', richtung: 'intern' },
  { id: 'KO-004', was: 'Hinweis auf den KI-Assistenten und Grenzen der Antworten', wann: 'laufend, in jedem Gespräch', wer: 'P-008', mitWem: 'Kunden im Kundenportal', wie: 'Hinweis im Chatfenster, Nutzungsbedingungen', richtung: 'extern' },
  { id: 'KO-005', was: 'Funktionsweise, Grenzen und Datennutzung von MX-Predict', wann: 'bei Auslieferung und mit jedem Release', wer: 'P-004', mitWem: 'Kunden der Baureihe MX', wie: 'Betriebsanleitung, Release Notes, Schulung bei der Inbetriebnahme', richtung: 'extern' },
  { id: 'KO-006', was: 'Nachweis der KI-Steuerung und Zertifikat', wann: 'auf Anfrage und nach der Zertifizierung', wer: 'P-002', mitWem: 'Grosskunden mit Lieferantenaudits', wie: 'Selbstauskunft, Zertifikat, Auszug der KI-Leitlinie', richtung: 'extern' },
  { id: 'KO-007', was: 'Information über KI in der Bewerbung und Erläuterung auf Anfrage', wann: 'ab Wiederinbetriebnahme, in jedem Inserat', wer: 'P-005', mitWem: 'Bewerbende', wie: 'Stelleninserat, Datenschutzerklärung, Antwort auf Anfrage', richtung: 'extern' },
  { id: 'KO-008', was: 'Meldung von Fehlfunktionen und Vorfällen', wann: 'sofort nach Erkennen', wer: 'P-003', mitWem: 'KI-Lieferanten', wie: 'Supportkanal gemäss Vertrag, Kopie an AIMS', richtung: 'extern' },
];

// Checkliste AU-001: gesehener Nachweis und Stichprobe je Prüfpunkt (Stand der Dokumente zum Audit); das Ergebnis
// folgt aus den Feststellungen (Normbezug), sonst «konform»
const MA = 'Interview mit fünf Mitarbeitenden in Fertigung und Kundendienst';
const checkliste: Record<string, [string, string]> = {
  '4.1': ['D-01 v1.0, D-24 v1.1, E-01 v1.1', 'TH-001, TH-004, KI-002, KI-008'], '4.2': ['D-01 v1.0', 'IP-005, IP-006'], '4.3': ['D-02 v1.1', 'KI-007, KI-008'],
  '4.4': ['D-02 v1.1, D-23 v1.0', 'Antrag und Freigabe von KI-005'], '5.1': ['N-001, D-03 v1.0, D-07-EB v1.0 mit Register D-07', 'Interview mit Daniel Keller'], '5.2': ['D-03 v1.0, N-005', MA],
  '5.3': ['D-04-EB v1.0', 'RO-008, RO-015'], '6.1.1': ['D-06-EB v1.0, D-07-EB v1.0 mit Register D-07', 'R-021, R-022'], '6.1.2': ['D-06-EB v1.0, D-07-EB v1.0 mit Register D-07', 'R-005, R-014, R-019'],
  '6.1.3': ['D-07-EB v1.0 mit Register und Behandlungsplan D-07, D-11 v1.0', 'R-001, R-017'], '6.1.4': ['D-08 v1.0, D-09-KI-002 v1.0, D-09-KI-008 v1.0', 'IA-002, IA-008'], '6.2': ['D-05 v1.0', 'Z-003, Z-004'],
  '6.3': ['D-26-EB v1.0, N-015', 'M-011'], '7.1': ['D-00 v1.0, D-05 v1.0, D-10-EB v1.2', 'KI-003'], '7.2': ['D-17-EB v1.0, E-04 v1.0', 'K-001, K-006'],
  '7.3': ['D-17-EB v1.0, D-15-EB v1.0, N-024', MA], '7.4': ['D-17-EB v1.0', 'KO-003, KO-004'], '7.5': ['D-26-EB v1.0', 'D-08, D-11, E-05'],
  '8.1': ['D-12 v1.0, D-16-EB v1.0, N-015', 'KI-001, KI-008'], '8.2': ['Register D-07 zu D-07-EB v1.0', 'R-005, R-006'], '8.3': ['Behandlungsplan D-07 zu D-07-EB v1.0', 'M-008, M-016'], '8.4': ['D-09-KI-001 v1.0', 'IA-001'],
  '9.1': ['D-05 v1.0', 'Z-002, Z-003, Z-005'], '9.2': ['D-20-EB v1.0, N-043', 'AU-001'], '9.3': ['N-043 Jahresplan mit Termin der Managementbewertung, Protokoll ISMS-Managementbewertung 2026', 'Einladung zur gemeinsamen Bewertung am 02.02.2027'],
  '10.1': ['D-22-EB v1.0', 'M-025'], '10.2': ['D-22-EB v1.0', 'ISMS-Korrekturmassnahme KM-2026-07'],
  'A.2.2': ['D-03 v1.0, N-002', MA], 'A.2.3': ['N-042, D-03-EB v1.0', 'IS-LL-01'], 'A.2.4': ['N-043 Jahresplan mit Überprüfung der Leitlinie in der Managementbewertung', 'D-03'], 'A.3.2': ['D-04-EB v1.0, N-004', 'RO-008, RO-012'],
  'A.3.3': ['N-005, D-04-EB v1.0', 'Interview mit Petra Widmer'], 'A.4.2': ['D-10-EB v1.2, N-006', 'KI-001, KI-002, KI-006, KI-008'], 'A.4.3': ['D-10-EB v1.2, N-040', 'KI-004'],
  'A.4.4': ['D-10-EB v1.2, N-040', 'KI-001, KI-006'], 'A.4.5': ['D-10-EB v1.2, N-040', 'KI-001'], 'A.4.6': ['D-10-EB v1.2, D-17-EB v1.0', 'KI-003'],
  'A.5.2': ['D-08 v1.0, N-007', 'IA-001, IA-008'], 'A.5.3': ['N-008', 'IA-002, IA-006'], 'A.5.4': ['D-09-KI-008 v1.0, N-009', 'IA-008'], 'A.5.5': ['D-09-KI-002 v1.0, D-09-KI-008 v1.0', 'IA-002, IA-008'],
  'A.6.1.2': ['D-12 v1.0, N-011', 'KI-002'], 'A.6.1.3': ['D-12 v1.0, N-015', 'KI-003'], 'A.6.2.2': ['N-011', 'KI-002'], 'A.6.2.3': ['N-012', 'KI-003'],
  'A.6.2.4': ['N-013, N-044', 'KI-002, KI-006'], 'A.6.2.5': ['N-015', 'KI-001, KI-002'], 'A.6.2.6': ['D-12 v1.0', 'KI-001, KI-006'], 'A.6.2.7': ['N-017', 'KI-002'],
  'A.6.2.8': ['N-018', 'KI-005, KI-006'], 'A.7.2': ['D-13 v1.0, N-019', 'KI-001'], 'A.7.3': ['N-049', 'KI-003'], 'A.7.4': ['N-020', 'KI-001, KI-002'], 'A.7.5': ['N-019, N-012', 'KI-002'],
  'A.7.6': ['N-019, N-020', 'KI-001'], 'A.8.2': ['D-14-EB v1.0, N-017, N-021', 'KI-006'], 'A.8.3': ['D-14-EB v1.0', 'KI-006'], 'A.8.4': ['N-023', 'Übung vom 02.12.2026'],
  'A.8.5': ['N-050', 'IP-006'], 'A.9.2': ['D-15-EB v1.0, N-024', 'KI-005'], 'A.9.3': ['D-05 v1.0, D-15-EB v1.0', 'Z-003'], 'A.9.4': ['D-10-EB v1.2, N-024', 'KI-004, KI-005'],
  'A.10.2': ['N-028, N-029', 'L-001, L-004'], 'A.10.3': ['D-16-EB v1.0, N-026, N-027', 'L-005'], 'A.10.4': ['N-029, N-017', 'IP-003'],
  // Zusatz-Controls EU AI Act, eigene Controls und NIST AI RMF (Umfang: alle anwendbaren Controls)
  'EUAIA-01': ['E-02 v1.1, N-045', 'KI-006, KI-008'], 'EUAIA-02': ['E-04 v1.0, Export der Lernplattform vom 15.01.2027', 'Testfrage an fünf Mitarbeitende'],
  'EUAIA-03': ['E-01 v1.1, N-036, N-037', 'KI-001, KI-002'], 'EUAIA-04': ['E-02 v1.1, N-036', 'KI-002, KI-008'], 'EUAIA-05': ['E-07 v1.0, N-051', 'KI-006'],
  'EUAIA-06': ['E-07 v1.0, N-047, N-051', 'KI-006'], 'EUAIA-08': ['E-05 v1.0', 'KI-008'],
  'EUAIA-09': ['Rollenbeschreibung der Aufsicht in der Personalabteilung, Teilnahmebestätigungen 10/2026', 'Interview mit Petra Widmer, Übung mit 20 Testbewerbungen'],
  'EUAIA-10': ['E-05 v1.0, Entwurf der Prüfliste für Anforderungsprofile', 'KI-008'], 'EUAIA-11': ['E-05 v1.0', 'KI-008'], 'EUAIA-12': ['N-018', 'KI-008'],
  'EUAIA-13': ['N-038', 'KI-008'], 'EUAIA-14': ['E-05 v1.0', 'Stelleninserate Dezember 2026'], 'EUAIA-15': ['E-05 v1.0', 'KI-008'], 'EUAIA-17': ['N-009', 'IA-008'],
  'EUAIA-18': ['N-023', 'Behördenkontakt im Vorfallverfahren'], 'EUAIA-33': ['N-023', 'KI-008'],
  'EC-01': ['N-039', 'Stichprobe von 10 Zeichnungen im PDM'], 'EC-02': ['Prüfvermerke im Redaktionssystem, Stand 15.01.2027', 'Betriebsanleitung MX-300 Französisch und Italienisch'],
  'RMF-01': ['N-052', 'KI-002, KI-006'], 'RMF-02': ['D-12 v1.0', 'KI-008'], 'RMF-03': ['N-008', 'IA-006, IA-008'], 'RMF-04': ['D-10-EB v1.2, Rollenbeschreibung der Aufsicht', 'KI-001, KI-008'],
  'RMF-05': ['Bearbeitungsprotokoll der Rückmeldungen im CRM, Stand 15.01.2027', 'Rückmeldung vom 11.01.2027'], 'RMF-06': ['N-027, N-049', 'KI-001, KI-003'],
  'RMF-07': ['D-10-EB v1.2, D-12 v1.0, N-023', 'KI-001'], 'RMF-08': ['N-008', 'IA-006, IA-008'], 'RMF-09': ['N-052', 'KI-002, KI-006'], 'RMF-10': ['N-052, N-044', 'KI-002, KI-006'],
  'RMF-11': ['N-013, N-051', 'KI-002, KI-006'], 'RMF-12': ['N-044, Testprotokolle der Missbrauchsfälle vom Oktober 2026', 'KI-004, KI-006'], 'RMF-13': ['E-05 v1.0', 'KI-008'],
  'RMF-14': ['N-043', 'Jahresplan 2027'], 'RMF-15': ['N-017, N-021', 'KI-002, KI-006'], 'RMF-16': ['N-040, N-026', 'KI-001, KI-006'],
  'RMF-G01': ['D-15-EB v1.0, N-013', 'KI-004, KI-006'], 'RMF-G02': ['D-15-EB v1.0, D-10-EB v1.2', 'KI-004, KI-005'], 'RMF-G03': ['N-051', 'KI-006'],
  'RMF-G04': ['N-044, Testprotokolle der Missbrauchsfälle vom Oktober 2026', 'KI-004, KI-005, KI-006'], 'RMF-G05': ['D-15-EB v1.0, N-027', 'KI-005'],
  'RMF-G06': ['N-044, Auswertung von 50 Gesprächen im Dezember 2026', 'KI-006'], 'RMF-G07': ['D-15-EB v1.0, E-Learning KI-Kompetenz', 'Testfrage an fünf Mitarbeitende'],
};

/** Stichproben AU-001 (D-20, Blatt «Stichproben»): KI-001 durch alle Schritte, danach die Prüftests */
const stichproben: NonNullable<Audit['stichproben']> = [
  { nr: 1, ergebnis: 'konform', nachweis: 'KI-001 im Inventar D-10-EB v1.2 mit Eigner, Zweck, Handlungsbefugnis und Modellversion 3.2; Vorführung an der Prüfstation stimmte mit dem Eintrag überein.' },
  { nr: 2, ergebnis: 'nk-leicht', nachweis: 'R-005, R-006 und R-007 im Register D-07 mit Beurteilung vom 06.10.2026, Behandlung und angenommenem Restrisiko; nach dem Nachtraining vom 20.11.2026 nicht neu beurteilt (F-001).' },
  { nr: 3, ergebnis: 'nk-leicht', nachweis: 'Kurzprüfung IA-001 vom 06.10.2026, freigegeben am 09.10.2026 vor der Freigabe des Systems; Neubeurteilung nach dem Nachtraining vom 20.11.2026 fehlte (F-001).' },
  { nr: 4, ergebnis: 'konform', nachweis: 'Controls der Risiken R-005 und R-006 (A.6.2.4, A.6.2.5, A.6.2.6, A.7.4, A.7.6) in D-11 v1.0 anwendbar und umgesetzt.' },
  { nr: 5, ergebnis: 'nk-leicht', nachweis: 'Freigabe am 13.10.2026 durch die Geschäftsleitung, weil das System die Ausschleusweiche ohne Bestätigung steuert (D-03); Auflage «Nachtrainieren nur durch die QS» beim Nachtraining vom 20.11.2026 nicht eingehalten (F-001).' },
  { nr: 6, ergebnis: 'konform', nachweis: 'Monitoring-Bericht Dezember 2026 mit Schlupf 41 ppm und Pseudoausschuss; Prüfprotokolle der Prüfstation 12 Monate abrufbar.' },
  { nr: 7, ergebnis: 'konform', nachweis: 'Keine Meldung zu KI-001; Reklamationen des 4. Quartals 2026 im QM-System ohne Bezug zur KI-Prüfung.' },
  { nr: 8, ergebnis: 'nk-leicht', nachweis: 'Interviews mit Claudia Frei (Einkauf) und Stefan Ammann (Kundendienst): alle genannten Werkzeuge im Inventar; die neue Funktion im Release der HR-SaaS vom 15.12.2026 war nicht geprüft (F-002).' },
  { nr: 9, ergebnis: 'konform', nachweis: 'Übersteuerungsquote an der Prüfstation KI-001 im Dezember 2026: 3,1 % der ausgeschleusten Teile nach Nachprüfung als gut freigegeben; Weiterleitungen an den Kundendienst bei KI-006: 4 %.' },
  { nr: 10, ergebnis: 'konform', nachweis: 'Testfrage an fünf Mitarbeitende in Fertigung und Kundendienst («Dürfen Kundenzeichnungen in ChatGPT Team?»): alle Antworten richtig.' },
  { nr: 11, ergebnis: 'konform', nachweis: 'Rückmeldung zu einem Katalogfehler vom 11.01.2027 vom Eingang bis zur Korrektur verfolgt: Eingang nach 1 Arbeitstag bestätigt, Korrektur nach 4 Tagen.' },
  { nr: 12, ergebnis: 'konform', nachweis: 'Noch keine geschlossenen Feststellungen des AIMS; Stichprobe der ISMS-Korrekturmassnahme KM-2026-07 mit belegter Wirksamkeitsprüfung.' },
  { nr: 13, ergebnis: 'nicht-pruefbar', nachweis: 'Erste Managementbewertung des AIMS am 02.02.2027 geplant; Protokoll der ISMS-Managementbewertung 2026 mit Entscheiden, Verantwortlichen und Terminen.' },
];

export const audits: Audit[] = [
  { id: 'AU-001', art: 'intern', kombiniertMitIsms: true, geplant: '2027-01-18', durchgefuehrt: '2027-01-18', durchgefuehrtBis: '2027-01-20',
    umfang: '3 Audittage vom 18.01. bis 20.01.2027 (2 Tage Hauptsitz, 1 Tag Deutschland remote); die Auditzeit richtet sich nach 180 Mitarbeitenden, 8 KI-Systemen und den kombinierten ISMS-Teilen. Kombiniertes internes Audit ISMS und AIMS an beiden Standorten: Abschnitte 4 bis 10 der ISO/IEC 42001, alle anwendbaren Controls der Erklärung zur Anwendbarkeit mit Stichproben bei KI-001, KI-002, KI-006 und KI-008, EU AI Act (Rollen, Einstufungen, Zusatz-Controls); ISMS-Teile Lieferanten, Berechtigungen und Änderungen.',
    kriterien: 'ISO/IEC 42001:2023, ISO/IEC 27001:2022 (Teilbereiche), KI-Leitlinie, D-15-EB, Pflichtenmatrix E-03',
    auditor: 'Reto Lehmann (interner Auditor QM und ISMS) mit externer Fachauditorin ISO/IEC 42001 der Kessler Audit GmbH',
    unabhaengigkeit: 'Reto Lehmann (Bereich Finanzen) gehört nicht zum AIMS-Projektteam und hat keine AIMS-Dokumente erstellt. Als interner Auditor QM und ISMS wirkt er an der Dokumentenlenkung und am Auditprogramm des ISMS mit, die das AIMS mitnutzt; die Abschnitte 7.5 und 9.2 hat deshalb die externe Fachauditorin geprüft.',
    ergebnis: 'Das AIMS ist eingeführt und weitgehend wirksam. 2 leichte Nichtkonformitäten (F-001, F-002), 1 Beobachtung (F-003), 1 Verbesserungsvorschlag (F-004). Keine schwere Nichtkonformität; Empfehlung, die Stage-1-Prüfung wie geplant durchzuführen.',
    bericht: 'Auditbericht AU-001 Version 1.0 vom 22.01.2027 mit ausgefüllter Checkliste (N-034), SharePoint ISMS/AIMS > 20_Audit',
    checkliste: Object.fromEntries(Object.entries(checkliste).map(([id, [nachweis, stichprobe]]) => [id, { nachweis, stichprobe }])), stichproben },
  { id: 'AU-002', art: 'extern-stage1', kombiniertMitIsms: true, geplant: '2027-03-02',
    umfang: 'Stage-1-Audit ISO/IEC 42001 kombiniert mit dem Überwachungsaudit ISO/IEC 27001, Hauptsitz Ostschweiz, 2 Audittage.',
    kriterien: 'ISO/IEC 42001:2023, ISO/IEC 27001:2022', auditor: 'Certimont Zertifizierung AG', unabhaengigkeit: 'Externe akkreditierte Zertifizierungsstelle', ergebnis: '' },
  { id: 'AU-003', art: 'extern-stage2', kombiniertMitIsms: true, geplant: '2027-05-04',
    umfang: 'Stage-2-Audit an beiden Standorten, 4 Audittage.', kriterien: 'ISO/IEC 42001:2023', auditor: 'Certimont Zertifizierung AG', unabhaengigkeit: 'Externe akkreditierte Zertifizierungsstelle', ergebnis: '' },
  // Auditprogramm über den Zertifizierungszyklus: internes Audit jährlich im Januar, Überwachungsaudit jährlich im März
  ...([['AU-004', 'intern', '2028-01-17'], ['AU-005', 'ueberwachung', '2028-03-14'], ['AU-006', 'intern', '2029-01-16'], ['AU-007', 'ueberwachung', '2029-03-13']] as const).map(([id, art, geplant]): Audit =>
    art === 'intern'
      ? { id, art, kombiniertMitIsms: true, geplant,
          umfang: '3 Audittage, kombiniert mit dem ISMS an beiden Standorten: Abschnitte 4 bis 10, alle anwendbaren Controls über zwei Jahre verteilt, Schwerpunkte nach Risiko und Ergebnissen des Vorjahres; EU AI Act jährlich.',
          kriterien: 'ISO/IEC 42001:2023, ISO/IEC 27001:2022 (Teilbereiche), KI-Leitlinie, D-15-EB, Pflichtenmatrix E-03',
          auditor: 'Reto Lehmann (interner Auditor QM und ISMS) mit externer Fachauditorin ISO/IEC 42001',
          unabhaengigkeit: 'Reto Lehmann (Bereich Finanzen) arbeitet nicht im AIMS mit; die Abschnitte 7.5 und 9.2, an denen er als interner Auditor QM und ISMS mitwirkt, prüft die externe Fachauditorin.', ergebnis: '' }
      : { id, art, kombiniertMitIsms: true, geplant,
          umfang: 'Überwachungsaudit ISO/IEC 42001 kombiniert mit ISO/IEC 27001, Hauptsitz Ostschweiz, 2 Audittage.',
          kriterien: 'ISO/IEC 42001:2023, ISO/IEC 27001:2022', auditor: 'Certimont Zertifizierung AG', unabhaengigkeit: 'Externe akkreditierte Zertifizierungsstelle', ergebnis: '' }),
];

export const feststellungen: Feststellung[] = [
  { id: 'F-001', audit: 'AU-001', quelle: 'audit', einstufung: 'nk-leicht',
    beschreibung: 'Das Nachtraining der Qualitätsprüfung vom 20.11.2026 (Modellversion 3.2) wurde durch eine Schichtleitung ohne Freigabe nach Formular QS-F-118 durchgeführt; die Prüfung gegen das Testset erfolgte erst nachträglich, die Neubeurteilung der Kurzprüfung fehlte.',
    normbezug: '8.1, 8.2, 8.4, A.5.2, A.6.2.4, A.6.2.5', korrektur: 'Nachträgliche Verifikation gegen das Testset am 25.11.2026 (Erkennungsrate unverändert); Freigabe nachgeholt. Nach dem Audit am 28.01.2027 die Kurzprüfung IA-001 und alle Risiken von KI-001 (R-005, R-006, R-007, R-022, R-024) neu beurteilt, Restrisiken von R-005 bis R-007 am 02.02.2027 erneut angenommen; die Neubeurteilung nach jedem Nachtraining ist Pflichtschritt in QS-F-118 und D-12 (M-035). Meldepflicht geprüft: kein fehlerhaftes Teil ausgeliefert, keine Meldung an Kunden nötig.',
    ursache: 'Das Freigabeverfahren war nur in der QS geschult; im Kamerasystem konnten alle Anwender nachtrainieren. Das Verfahren verlangte eine Neubeurteilung der Risiken nur bei wesentlicher Änderung, das Risikoverfahren bei jedem Nachtraining.', massnahmen: ['M-026', 'M-035'],
    nachweis: 'Änderungsprotokoll des Kamerasystems mit Modellversion 3.2 vom 20.11.2026 (Benutzer einer Schichtleitung), kein Formular QS-F-118 zu dieser Version, Interview mit Thomas Gerber.',
    ursacheKategorie: 'Prozess', meldepflicht: 'ja',
    wirksamkeitGeplant: '2027-04-30', status: 'in-arbeit' },
  { id: 'F-002', audit: 'AU-001', quelle: 'audit', einstufung: 'nk-leicht',
    beschreibung: 'Neue KI-Funktionen in bestehenden SaaS-Diensten werden zwischen den jährlichen Lieferantenprüfungen nicht erkannt, weil niemand die Release Notes auswertet. Die still aktivierte Vorselektion (KI-008) wurde nur durch das Inventarinterview gefunden; ein Release der HR-SaaS vom 15.12.2026 mit einer neuen KI-Funktion zur Zusammenfassung von Bewerbungsgesprächen war bis zum Audit nicht geprüft.',
    normbezug: 'A.10.3, 8.1', korrektur: 'Release vom 15.12.2026 am 20.01.2027 geprüft: neue Funktion ausgeschaltet und im Inventar bei KI-008 vermerkt. Meldepflicht geprüft: keine Meldung nötig.',
    ursache: 'Die Lieferantenprüfung ist jährlich angelegt; für Releases zwischen den Prüfungen gibt es keine Zuständigkeit.', massnahmen: ['M-027'],
    nachweis: 'Release Notes der HR-SaaS vom 15.12.2026 ohne Prüfvermerk, Lieferantenbewertung L-005 im Prüfprotokoll N-026, Interviews mit Claudia Frei und Marco Huber.',
    ursacheKategorie: 'Lieferant', meldepflicht: 'ja', wirksamkeitGeplant: '2027-07-31', status: 'in-arbeit' },
  { id: 'F-003', audit: 'AU-001', quelle: 'audit', einstufung: 'beobachtung',
    beschreibung: 'Für Ziel Z-003 (Prüfung der Ergebnisse generativer KI) lag zum Auditzeitpunkt noch kein Messwert vor.',
    normbezug: '6.2, 9.1', korrektur: 'Erste Stichprobe am 26.01.2027 durchgeführt.', ursache: 'Die Messmethode war festgelegt, aber die Key-User hatten keinen Auftrag zur Durchführung.', massnahmen: ['M-023'],
    nachweis: 'Messplan D-05 Version 1.0 mit Z-003 ohne Messwert, Interview mit Sandra Brunner.', ursacheKategorie: 'Prozess', meldepflicht: 'nicht-noetig', status: 'in-arbeit' },
  { id: 'F-004', audit: 'AU-001', quelle: 'audit', einstufung: 'verbesserung',
    beschreibung: 'Die Angaben zum EU AI Act (E-01 bis E-09) beruhen auf der Fassung vom 27.07.2026. Vor Stage 1 sollte geprüft werden, ob neuere Konsolidierungen oder Leitlinien vorliegen.',
    normbezug: '4.1, 6.1.3', korrektur: '', ursache: '', massnahmen: ['M-028'], nachweis: 'E-02 Version 1.1 und E-09 Version 1.0 mit Rechtsstand 27.07.2026 und Berichtigung vom 29.09.2026.', status: 'in-arbeit' },
  { id: 'F-005', quelle: 'beinahe-vorfall', einstufung: 'beobachtung', datum: '2027-01-25', kiSystem: 'KI-004', bereich: 'Einkauf, M365', schwere: 2,
    beschreibung: 'Ein Mitarbeiter im Einkauf liess die Mail eines unbekannten Absenders von Copilot zusammenfassen. Die Zusammenfassung forderte dazu auf, die aktuelle Preisliste über einen Link «zur Prüfung» zu senden; die Mail enthielt dafür versteckten Text. Der Mitarbeiter sandte nichts, sondern meldete die Antwort über den Meldeweg. Es flossen keine Daten ab.',
    normbezug: 'A.6.2.6, A.8.4, 8.2', korrektur: 'Mail und Absender im Mailfilter gesperrt; Protokoll von Copilot ausgewertet: keine weitere Zusammenfassung dieser Mail. Meldepflicht geprüft: keine Daten abgeflossen, keine Meldung nötig.',
    ursache: 'Copilot verarbeitet Inhalte unbekannter Absender mit den Rechten der Nutzenden, und seine Antworten durften externe Links enthalten.', massnahmen: ['M-029'],
    nachweis: 'Meldung im AIMS-Postfach vom 25.01.2027, Auswertung des Copilot-Protokolls, Ticket im ISMS-Vorfallverfahren.', ursacheMethode: '5 Warum', aehnlicheFaelle: 'Protokolle von Copilot und ChatGPT Team für Januar 2027 auf ähnliche Mails ausgewertet: kein weiterer Fall.',
    risikoAngepasst: true, ursacheKategorie: 'Modell', meldepflicht: 'ja', wirksamkeitGeplant: '2027-04-30', status: 'in-arbeit' },
  // Schatten-KI-Fälle von 2026: in der Managementbewertung MB-001 als KI-Vorfälle ins Register aufgenommen
  { id: 'F-006', quelle: 'vorfall', einstufung: 'nk-leicht', datum: '2026-08-20', erfasstAm: '2027-02-02', kiSystem: 'KI-007', bereich: 'Technische Dokumentation', schwere: 2,
    beschreibung: 'Die Technische Redaktion hat seit 2025 einen kostenlosen Übersetzungsdienst ohne Vertrag genutzt und dabei vollständige Betriebsanleitungen mit Konstruktionsdetails eingegeben; die Nutzungsbedingungen erlauben Training mit den Eingaben. Entdeckt in der Inventarumfrage am 20.08.2026, als Schatten-KI behandelt (R-017, R-018) und erst mit der Managementbewertung als KI-Vorfall erfasst.',
    normbezug: 'A.4.2, A.9.2, A.8.4, 10.2', korrektur: 'Seit 21.08.2026 nur beschreibende Textbausteine der Klasse «öffentlich» ohne Sicherheits- und Warnhinweise im Dienst; geprüft, dass keine Sonderanlagen mit Geheimhaltungsvereinbarung betroffen sind (keine Information von Kunden nötig); Sicherheits- und Warnhinweise der 14 vorübersetzten Anleitungen bis 30.09.2026 durch Fachübersetzer nachgeprüft, ohne sinnverändernden Fehler (N-057). Meldepflicht geprüft: keine Personendaten, keine Vertragsverletzung, keine Meldung nötig.',
    ursache: 'Vor dem AIMS gab es keinen Freigabeprozess für KI-Werkzeuge und kein freigegebenes Übersetzungswerkzeug; unter Zeitdruck nutzte die Redaktion einen frei verfügbaren Dienst. Der Fall wurde vor der Einrichtung des Registers behandelt und nicht als Vorfall nachgetragen.', massnahmen: ['M-018', 'M-036'],
    nachweis: 'Antwort der Inventarumfrage vom 20.08.2026, Auflage in der Freigabeliste vom 21.08.2026, Prüfprotokolle der Fachübersetzungen (N-057), Lieferantenprüfung L-007.', ursacheMethode: '5 Warum', aehnlicheFaelle: 'Inventarumfrage in allen Bereichen und Interviews: ein weiterer Fall (F-007).',
    risikoAngepasst: true, ursacheKategorie: 'Prozess', meldepflicht: 'ja', wirksamkeitGeplant: '2027-04-30', status: 'in-arbeit' },
  { id: 'F-007', quelle: 'vorfall', einstufung: 'nk-leicht', datum: '2026-08-25', erfasstAm: '2027-02-02', kiSystem: 'KI-008', bereich: 'Personal', schwere: 3,
    beschreibung: 'Die KI-Funktion «Kandidaten-Ranking» der HR-SaaS war seit einem Release im Februar 2026 ohne Wissen der Personalabteilung aktiv. Sie markierte Bewerbungen unter einem Schwellenwert als «geringe Eignung»; diese Bewerbungen wurden meist nicht mehr geöffnet. Damit konnte das System Bewerbende benachteiligen. Entdeckt im Inventarinterview am 25.08.2026 und am gleichen Tag deaktiviert; als Schatten-KI behandelt (R-019, R-020, IA-008) und erst mit der Managementbewertung als KI-Vorfall erfasst.',
    normbezug: 'A.4.2, A.5.4, A.8.4, 10.2', korrektur: 'Funktion am 25.08.2026 deaktiviert. Folgen für die Bewerbenden: Die Personalabteilung hat bis 30.09.2026 alle 112 als «geringe Eignung» markierten Bewerbungen von Februar bis August 2026 nachgeprüft; 9 Personen wurden nachträglich eingeladen oder für eine ähnliche Stelle angefragt, alle 112 erhielten eine Information über die Vorselektion und ihr Recht auf Auskunft (N-057). Die Datenschutzberaterin hat die Information geprüft. Meldepflicht geprüft: keine Verletzung der Datensicherheit, keine Meldung an die Aufsicht nötig; die Arbeitnehmendenvertretung wurde am 14.10.2026 informiert.',
    ursache: 'Der Lieferant hat die Funktion mit einem Release standardmässig aktiviert; Release Notes wurden nicht ausgewertet (F-002). Der Fall wurde vor der Einrichtung des Registers behandelt und nicht als Vorfall nachgetragen.', massnahmen: ['M-019', 'M-027', 'M-036'],
    nachweis: 'Protokoll des Inventarinterviews vom 25.08.2026, Konfigurationsprotokoll der HR-SaaS, Liste der nachgeprüften Bewerbungen und Informationsschreiben (N-057), Protokoll N-038.', ursacheMethode: '5 Warum', aehnlicheFaelle: 'Release Notes aller SaaS-Dienste seit Juli 2026 geprüft (F-002): kein weiterer Fall.',
    risikoAngepasst: true, ursacheKategorie: 'Lieferant', meldepflicht: 'ja', wirksamkeitGeplant: '2027-07-31', status: 'in-arbeit' },
];

export const managementbewertungen: Managementbewertung[] = [
  { id: 'MB-001', datum: '2027-02-02', kombiniertMitIsms: true,
    teilnehmende: 'Daniel Keller (CEO), Michael Schmid (Geschäftsführer DE), Sandra Brunner (AIMS), Marco Huber (ISMS, IT), Lukas Meier (Entwicklung), Petra Widmer (Personal), Nina Roth (Datenschutz, Gast)',
    eingaben: {
      statusMassnahmen: 'Erste Bewertung. Stand vor der Sitzung: 31 Massnahmen (M-001 bis M-031), davon 18 erledigt, 11 in Arbeit und 2 offen mit Termin (M-020, M-024); keine überfällig. Neu in der Sitzung: M-032 bis M-036 (Profil NIST AI RMF, R-030 bis R-032, Korrektur zu F-001, Erfassung der Vorfälle); der Behandlungsplan vom 02.02.2027 führt 36 Massnahmen.',
      aenderungenThemen: 'Maschinenverordnung seit 20.1.2027 anwendbar; seit 2.12.2026 gelten die neuen Verbote und Art. 50(2) auch für bestehende Systeme (Kennzeichnung seit 23.10.2026); zwei Schatten-KI-Fälle behandelt, noch nicht als Vorfälle erfasst.',
      aenderungenParteien: 'Betriebsrat DE verlangt Information vor jeder KI-Nutzung im Personalbereich; ein Grosskunde verlangt Zustimmung vor KI-Nutzung mit seinen Daten (IP-006, Neubeurteilung 2027).',
      leistung: 'F-001 korrigiert, M-026 umgesetzt, Kontrolle beim Nachtraining vom 27.01.2027 ohne Abweichung, Wirksamkeitsprüfung bis 30.04.2027; IA-001 und die Risiken von KI-001 am 28.01.2027 neu beurteilt. F-002 korrigiert, M-027 in Arbeit. Keine schwere Nichtkonformität, keine meldepflichtigen Vorfälle.',
      messung: 'Inventar 100 %, Schulung 96 %, Prüfung generativer KI 95 % (erste Messung), Schlupf 29 ppm, Ersatzteil-Assistent 98 %, Schatten-KI 100 %, Validierung 100 %. Erreicht sind Z-001, Z-002 und Z-006; die übrigen Ziele laufen bis Mitte oder Ende 2027 und liegen im Soll.',
      audits: 'AU-001 (18. bis 20.01.2027): AIMS eingeführt und weitgehend wirksam; 2 leichte Nichtkonformitäten, 1 Beobachtung, 1 Verbesserung. Noch keine externen Audits.',
      verbesserungen: 'Funktionsscan der SaaS-Dienste (M-027), frühe Einstufung von MX-Predict 3.0 (M-024).',
      weitere: 'Aufwand bis zur Bewertung 49 Personentage (Plan 50).',
    },
    ergebnisse: {
      inventar: 'Acht Systeme mit Eigner und Freigabeentscheid; Schatten-KI behandelt (KI-007 eingeschränkt, KI-008 ausgesetzt), neue HR-Funktion ausgeschaltet. Bewertung: vollständig.',
      risiken: '29 Risiken und 3 Chancen, Restrisiken angenommen (R-019, R-020 nur deaktiviert); R-030 bis R-032 neu (Risiken generativer KI), Risiken von KI-001 nach den Nachtrainings neu beurteilt; vier volle Abschätzungen, IA-001, IA-004 und IA-005 neu beurteilt. Bewertung: angemessen.',
      meldungen: '6 Rückmeldungen von Kunden, 2 interne Meldungen (darunter F-005). Zwei KI-Vorfälle im Bewertungszeitraum: die Schatten-KI-Fälle KI-007 und KI-008, behandelt, aber nicht im Register erfasst; Nachtrag als F-006 und F-007. Folgen für die Bewerbenden behandelt (Nachprüfung, Information, N-057). Fristen eingehalten. Bewertung: Kanäle wirken; Vorfälle sofort erfassen.',
      lieferanten: 'Sechs Lieferanten geprüft, davon vier mit Auflagen; L-006 in Prüfung, Vertrag in Verhandlung; M-021 und M-018 in Arbeit. Bewertung: gesteuert, Lücke bei Releases (M-027).',
      ziele: 'Ziele Z-001 bis Z-007 für 2027 bestätigt, Z-008 und Z-009 für KI-007 und KI-008 ergänzt; Z-003 quartalsweise messen.',
      ressourcen: 'AIMS-Verantwortliche bis Stage 2 mit 40 %, Budget 2027 CHF 85 000; zusätzlich CHF 15 000 für M-024.',
      aiact: 'Rollen und Einstufungen gelten; Art. 50(2) fristgerecht umgesetzt; KI-008 bis 30.09.2027 vorbereitet (M-019); Stand vor Stage 1 prüfen (M-028).',
      leitlinie: 'KI-Leitlinie Version 1.0 angemessen für Zweck und KI-Einsatz; keine Änderung, nächste Überprüfung bis 31.08.2027.',
    },
    entscheide: 'Das AIMS ist geeignet, angemessen und wirksam; Stage 1 am 02.03.2027 wie geplant. KI-Leitlinie unverändert in Kraft. Restrisiken R-005 bis R-007 und R-024 bis R-032 angenommen. Schatten-KI-Fälle als Vorfälle F-006 und F-007 nachtragen (M-036), Neubeurteilung nach jedem Nachtraining verankern (M-035). Ohne Änderung bestätigt: D-03, D-06-EB, D-08, D-14-EB, D-15-EB; neu freigegeben: D-02, D-04-EB. CHF 15 000 für die rechtliche Prüfung der Wartungsfunktion 3.0 (M-024). Die Bewerbungsvorselektion bleibt bis zum Abschluss von M-019 und zur Freigabe durch die GL deaktiviert. AI-Act-Stand vor Stage 1 aktualisieren (M-028).',
    massnahmen: ['M-024', 'M-028', 'M-035', 'M-036'] },
];
