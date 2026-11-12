# Audit-Checklisten (Stage 1, Stage 2, Interviews)

Eigene Prüffragen des Kits, keine Normtexte. Abschnittsnummern verweisen auf ISO/IEC 42001; den Wortlaut lesen Sie in Ihrer eigenen Normausgabe nach. Zertifizierungsstellen arbeiten nach ISO/IEC 17021-1 und ISO/IEC 42006.

## Stage 1: Dokumentenprüfung und Bereitschaft

Ziel des Stage-1-Audits: Ist das AIMS so weit dokumentiert und eingeführt, dass Stage 2 sinnvoll ist? Typisch vor Ort oder per Video, einen halben bis einen Tag für ein KMU.

| Nr | Prüfpunkt | Abschnitt | Nachweis |
|---|---|---|---|
| S1-01 | Geltungsbereich freigegeben, Grenzen und Ausschlüsse begründet | 4.3 | D-02 |
| S1-02 | Themen inkl. Klimawandel und Rolle der Organisation bestimmt | 4.1 | D-01 |
| S1-02a | AIMS-Prozesse und ihre Wechselwirkungen beschrieben (Prozesslandkarte, Schnittstellen zum ISMS) | 4.4 | D-02 |
| S1-03 | Interessierte Parteien mit Anforderungen und Entscheid «adressiert» | 4.2 | D-01 |
| S1-04 | KI-Inventar vollständig, inkl. KI in SaaS und Schatten-KI | 4.3, A.4 | D-10 |
| S1-05 | KI-Leitlinie freigegeben und bekannt gemacht | 5.2 | D-03, Verteilnachweis |
| S1-06 | Rollen nach 5.3 zugewiesen (Konformität, Berichterstattung) | 5.3 | D-04 |
| S1-07 | Risikokriterien mit Bezugszeitraum und Akzeptanzgrenze | 6.1.1, 6.1.2 | D-06 |
| S1-08 | Risikobeurteilung je System, Behandlungsplan freigegeben, Restrisiken angenommen | 6.1.2, 6.1.3 | D-07 |
| S1-09 | SoA mit allen 38 Controls, Begründung für Aufnahme und Ausschluss | 6.1.3 | D-11 |
| S1-10 | Verfahren und Ergebnisse der Folgenabschätzung | 6.1.4 | D-08, D-09 |
| S1-11 | KI-Ziele messbar und geplant | 6.2 | D-05 |
| S1-12 | Kompetenzbedarf und Kommunikationsplan | 7.2 bis 7.4 | D-17 |
| S1-13 | Lenkung dokumentierter Information | 7.5 | D-26 oder ISMS-Verfahren |
| S1-14 | Internes Audit über das ganze AIMS durchgeführt | 9.2 | D-20, Auditbericht |
| S1-15 | Managementbewertung mit allen Pflichteingaben durchgeführt | 9.3 | D-21, Protokoll |
| S1-16 | Nichtkonformitäten mit Ursache und Korrekturmassnahme | 10.2 | D-22 |

## Stage 2: Umsetzung und Wirksamkeit

Ziel: Wird das AIMS gelebt und wirkt es? Das Auditteam befragt Personen, prüft Stichproben und vergleicht Richtlinie und Praxis.

| Nr | Prüfpunkt | Abschnitt / Control | Stichprobe |
|---|---|---|---|
| S2-01 | Neue KI-Werkzeuge durchlaufen die Freigabe | A.9.2, 8.1 | zwei zuletzt eingeführte Werkzeuge mit Freigabe |
| S2-02 | Inventar stimmt mit der Praxis überein | A.4.2 | drei Mitarbeitende fragen, welche KI sie nutzen; abgleichen |
| S2-03 | Risiken werden bei Änderungen neu beurteilt | 8.2 | ein geändertes System mit Datum der Neubeurteilung |
| S2-04 | Massnahmen aus dem Behandlungsplan sind umgesetzt | 8.3 | drei Massnahmen mit Nachweis |
| S2-05 | Folgenabschätzung vor Einsatz, freigegeben | 8.4, A.5.3 | ein System mit sensibler Nutzung |
| S2-06 | Menschliche Aufsicht wird ausgeübt | A.9.3, A.9.4 | Protokoll oder Prüfspur einer Aufsichtsperson |
| S2-07 | Lieferanten geprüft, Verträge mit KI-Klauseln | A.10.2, A.10.3 | zwei KI-Lieferanten |
| S2-08 | Information für Nutzende und Meldekanal vorhanden | A.8.2, A.8.3 | Hinweistext, Meldeadresse, ein Eingang |
| S2-09 | Protokolle eingeschaltet und aufbewahrt | A.6.2.8 | Protokollauszug eines Systems |
| S2-10 | Schulungen mit Wirksamkeitsprüfung | 7.2, 7.3 | Teilnahmeliste, Test oder Gespräch |
| S2-11 | Ziele werden gemessen und bewertet | 9.1 | eine Messung mit Datum |
| S2-12 | Auditprogramm unabhängig, Feststellungen bearbeitet | 9.2, 10.2 | Auditbericht und eine geschlossene Feststellung mit Wirksamkeitsprüfung |
| S2-13 | Managementbewertung mit Entscheiden und Massnahmen | 9.3 | Protokoll, Massnahmen in D-22 oder D-07 |
| S2-14 | Eigenentwicklung: Anforderungen, Tests, Freigabe belegt | A.6.2.2 bis A.6.2.5 | ein Release mit Testbericht |
| S2-15 | Handelnde KI: Handlungsbefugnis, Zugriffe, Stoppmöglichkeit und Protokolle je System festgehalten; Aktionen mit Aussenwirkung nur nach Bestätigung | A.9.2, A.6.2.6, A.6.2.8 | ein Agent oder Konnektor: Rechte, Protokoll einer Aktion mit Auslöser und Freigabe, Notstopp erklärt |
| S2-16 | Missbrauchsfälle vor dem Einsatz geprüft, nach Modellwechsel wiederholt | A.6.2.4, A.6.2.5 | ein generatives System mit fremden Inhalten oder öffentlichem Zugang: Testkatalog mit Datum und Ergebnis |
| S2-17 | Wirksamkeit der Controls geprüft (wie, wann, wer) und nicht nur «umgesetzt» | 9.1, 6.1.3 | drei SoA-Zeilen mit Status «wirksam»: Spalte «Wirksamkeit geprüft» und Beleg |
| S2-18 | Einsatzentscheid mit Nutzen, geprüfter Lösung ohne KI und Wiedervorlage | 6.1.4, A.5.2 | ein freigegebenes System: Entscheid und ob die Wiedervorlage stattfand |
| S2-19 | Kennzahlen taugen: messen, was die Ziele aussagen, und gelten für die Systeme mit sensibler Nutzung | 9.1, 9.3 | Messplan D-05 gegen Ziele und Managementbewertung |

## Prüftechnik: ein System durch alle Schritte verfolgen

Auditoren wählen oft ein KI-System und verfolgen es durch das ganze AIMS. Proben Sie das vor Stage 2 mit dem wichtigsten System:

1. **Inventar** (D-10): Eintrag mit Eigner/in, Zweck, Typ, Daten, Modell und Version, Handlungsbefugnis; Freigabe zur Nutzung mit Datum.
2. **Rolle** (D-24, mit Modul E-01, E-02): begründet, mit Datum.
3. **Risiken** (D-07): systemspezifische Einträge, nicht nur allgemeine; bei generativer KI passende Einträge aus der Liste GS-01 bis GS-22.
4. **Folgenabschätzung** (D-09): Kurzprüfung oder vollständige Abschätzung, **datiert vor der Einführung**, mit Freigabe und Mitwirkenden; Einsatzentscheid.
5. **SoA** (D-11): die Controls, die die Risiken des Systems behandeln, mit Status und Wirksamkeitsprüfung.
6. **Betrieb** (D-12): Prüfung vor dem Einsatz inkl. Missbrauchsfällen, Überwachung, Protokolle, Aussetzen und Rückfallweg.
7. **Vorfälle und Meldungen** (D-14, D-22): Einträge zum System oder ein nachvollziehbarer Grund, warum es keine gibt.
8. **Bewertung** (D-05, D-21): Kennzahl zum System und Erwähnung in der Managementbewertung.

Lücke an einer Stelle = typische Feststellung. Das Ergebnis eignet sich als Feststellung oder Beobachtung in D-20.

**Stichproben, die Auditoren gern ziehen**

- Datum der Folgenabschätzung liegt vor dem Einführungsdatum des Systems.
- Übersteuerungsrate der menschlichen Aufsicht ist plausibel: Bei 0 Übersteuerungen über Monate fragen, ob wirklich geprüft wird («Abnicken»).
- Eine Testfrage aus der Schulung an eine zufällig gewählte Person, etwa welche Daten nicht in einen Chat-Dienst gehören oder was zu tun ist, wenn eine Mail versteckte Anweisungen enthält.
- Ein Lieferant: Antworten auf die Prüffragen inkl. PF-16 bis PF-21 und Vertragsklauseln.
- Bei handelnder KI: Wer kann das System jetzt sofort stoppen, und wie?

## Interviewfragen je Rolle

**Geschäftsleitung**
1. Warum betreiben Sie ein KI-Managementsystem, und was erwarten Sie davon?
2. Wie haben Sie die KI-Leitlinie freigegeben und bekannt gemacht?
3. Welche Mittel haben Sie bereitgestellt, und wie erfahren Sie, ob das AIMS wirkt?
4. Welche Entscheide haben Sie in der letzten Managementbewertung getroffen?

**AIMS-Verantwortliche**
1. Wie stellen Sie sicher, dass das Inventar vollständig bleibt?
2. Wie läuft eine Risikobeurteilung ab, und wann wird sie wiederholt?
3. Wie haben Sie Ausschlüsse in der SoA begründet?
4. Wie verfolgen Sie Massnahmen und Feststellungen bis zur Wirksamkeit?

**Eigner/in des Systems**
1. Wofür ist das System vorgesehen, und wofür darf es nicht genutzt werden?
2. Wie überwachen Sie Qualität und Fehler im Betrieb?
3. Was passiert bei einem Vorfall oder einer Beschwerde?
4. Wann wurde die Folgenabschätzung zuletzt überprüft?
5. Was darf das System selbst ausführen, und wie stoppen Sie es?
6. Woran erkennen Sie, dass der Anbieter das Modell gewechselt hat, und was prüfen Sie dann?

**Mitarbeitende (Nutzende)**
1. Welche KI-Werkzeuge nutzen Sie, und welche sind erlaubt?
2. Welche Daten dürfen Sie nicht eingeben?
3. Wie prüfen Sie KI-Ergebnisse, bevor Sie sie verwenden?
4. Wo melden Sie ein Problem oder Bedenken?
5. Was tun Sie, wenn ein Dokument oder eine Mail die KI zu etwas auffordert, das Sie nicht wollten?

**Einkauf / Lieferantenmanagement**
1. Wie prüfen Sie einen neuen KI-Lieferanten?
2. Welche Vertragsklauseln verwenden Sie für KI (Datennutzung, Region, Vorfallmeldung)?
3. Wann wurde der wichtigste KI-Lieferant zuletzt überprüft?

**HR (bei KI im Personalbereich)**
1. Wie werden Bewerbende und Mitarbeitende über den KI-Einsatz informiert?
2. Wer prüft KI-Vorschläge, bevor entschieden wird?
3. Wie stellen Sie sicher, dass niemand ungerechtfertigt benachteiligt wird?

**Entwicklung (nur bei Eigenentwicklung)**
1. Wie halten Sie Anforderungen, Daten und Modellversionen fest?
2. Welche Tests und Freigabekriterien gelten vor einem Release?
3. Wie verfolgen Sie Herkunft und Aufbereitung der Trainingsdaten?

## Einstufung von Feststellungen

| Einstufung | Wert in der Projektdatei | Bedeutung | Beispiel |
|---|---|---|---|
| Schwere Nichtkonformität (major) | `nk-schwer` | Anforderung nicht erfüllt, System versagt; blockiert die Zertifizierung | keine Risikobeurteilung, kein internes Audit, keine Managementbewertung |
| Leichte Nichtkonformität (minor) | `nk-leicht` | einzelne Lücke, System als Ganzes funktioniert | ein System ohne Folgenabschätzung, ein Ausschluss ohne Begründung |
| Beobachtung | `beobachtung` | kein Verstoss, aber Risiko einer künftigen Abweichung | Schulungsnachweise lückenhaft |
| Verbesserungsmöglichkeit (opportunity for improvement) | `verbesserung` | Anregung | Kennzahlen automatisch erheben |

Schwere Nichtkonformitäten müssen vor der Zertifizierung behoben und belegt sein; leichte brauchen einen akzeptierten Korrekturplan.
