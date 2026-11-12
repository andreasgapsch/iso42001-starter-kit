# Methodik: in 10 Schritten zum minimalen AIMS

Ziel ist ein schlankes, prüffähiges KI-Managementsystem (AI management system, AIMS), das ein KMU mit kleinem Geltungsbereich bis zur Stage-1-Reife bringt. Reifegrad ist kein Zertifizierungskriterium: Der Auditor prüft, ob die Anforderungen erfüllt und belegt sind, nicht wie «reif» ein Prozess wirkt.

Den Wortlaut der Anforderungen lesen Sie in Ihrer eigenen Ausgabe von ISO/IEC 42001 nach. Hier stehen nur Abschnittsnummern und eigene Erklärungen.

## Grundsatz «minimal zuerst»

- **Pflichtfassung zuerst:** Jede Pflicht-Dokumentation (documented information) gibt es in einer kurzen Fassung, die für Betreiber (Nutzer eingekaufter KI) ausreicht.
- **Ausbau nur bei Bedarf:** Ausbaustufen (z. B. Entwicklungsprozess A.6, Datenmanagement A.7.2 bis A.7.6, volle Folgenabschätzung) nur, wenn die Firma KI selbst entwickelt, KI in Produkte einbaut, KI mit Wirkung auf Menschen einsetzt (Personal, Kredit, Sicherheit) oder die Nutzerin oder der Nutzer es wünscht.
- **Kleiner Geltungsbereich:** Lieber wenige Systeme sauber als alle halb. Ausschlüsse begründen (Abschnitt 4.3).
- **Einmal erfassen, mehrfach nutzen:** Die Projektdatei hält alles fest; Dokumente werden daraus erzeugt.

## Die 10 Schritte

| Schritt | Ziel | Normabschnitt | Vorlagen | Modus |
|---|---|---|---|---|
| 1 Auftrag und Ausgangslage | Schnellcheck und Gap-Analyse (Reifegrad 0 bis 5), Projektauftrag, Freigabekalender, Freigabe durch die Geschäftsleitung; ohne ISMS Kurzfassung der Dokumentenlenkung ab Woche 2 | alle, 5.1, 7.1, 7.5 | D-00, D-23 (mit ISMS), D-26 (ohne ISMS) | 1 |
| 2 Kontext, Rollen, Geltungsbereich | Themen inkl. Klimawandel, interessierte Parteien, Rolle der Organisation, Grenzen | 4.1 bis 4.4 | D-01, D-02 | 2 |
| 3 Leitlinie, Rollen, Meldewege | KI-Leitlinie (AI policy), RACI, Meldeweg für Bedenken | 5.2, 5.3, A.2, A.3 | D-03, D-04 | 7 |
| 4 KI-Inventar | alle KI-Systeme inkl. KI in SaaS und Schatten-KI, Ressourcen | A.4, 4.3 | D-10 | 3 |
| 5 Rolle zuerst und Einstufung | Anbieter oder Betreiber je System; mit Modul Risikoklasse | 4.1; AI Act Art. 3, 6, 25 | D-24, E-01, E-02 | 4, 11 |
| 6 Risiken und Folgenabschätzungen | Kriterien, Kurzprüfung (Triage) für alle Systeme zuerst, Verfahren D-08 freigeben, Register, volle Folgenabschätzung bei Schwelle (je rund 1 bis 1,5 PT und eine Woche Durchlauf) | 6.1.1, 6.1.2, 6.1.4, 8.2, 8.4 | D-06 bis D-09 | 5 |
| 7 Controls, SoA, Behandlungsplan | Erklärung zur Anwendbarkeit (statement of applicability), Behandlungsplan, Restrisiko-Annahme; Umsetzungshinweise je Control in Anhang B der Norm (wie ISO/IEC 27002) | 6.1.3, 8.3 | D-07, D-11 | 6 |
| 8 Umsetzen | Lebenszyklus, Daten, Transparenz, Nutzungsregeln, Lieferanten, Kompetenz, Kommunikation, Dokumentenlenkung | 7, 8.1, A.6 bis A.10 | D-12 bis D-17, D-26 | 7 |
| 9 Messen und verbessern | Ziele und Kennzahlen, internes Audit (Auditperson mit Kenntnissen in ISO/IEC 42001, unabhängig vom Projekt), Managementbewertung, Korrekturmassnahmen | 6.2, 9, 10 | D-05, D-20 bis D-22 | 9 |
| 10 Zertifizierung | Stelle früh wählen (Offerten mit ISMS in Woche 4, ohne ISMS in Woche 7 bis 8; akkreditiert nach ISO/IEC 17021-1, für ISO/IEC 42001 mit den Zusatzanforderungen von ISO/IEC 42006, in der Schweiz durch die SAS), Stage 1, Stage 2 | 9, 10 | D-25 | 8 |

Richtwerte: mit ISMS rund 90 Tage bis Stage-1-Reife bei kleinem Geltungsbereich, ohne ISMS rund 150 Tage, jeweils mit rund 40 bis 50 % Pensum der AIMS-Verantwortlichen (bei 20 % ohne ISMS rund 9 Monate) und Freigaben der Geschäftsleitung innert einer Woche. Erweiterter Umfang mit ISMS (mehrere Eigenentwicklungen, KI im Produkt, Hochrisiko, mehrere Gesellschaften): rund 6 Monate und 45 bis 55 Personentage. Bis zum Zertifikat rechnen Praxisquellen mit 6 bis 12 Monaten (mit ISMS) bzw. 12 bis 18 Monaten (ohne ISMS). Aufwand grob 25 bis 35 Personentage mit ISMS, 45 bis 65 ohne. Kennzeichnen Sie diese Zahlen als Richtwerte.

## Pfad «mit ISMS» (ISO/IEC 27001 vorhanden)

- Kapitel 4 bis 10 sind in beiden Normen gleich aufgebaut (harmonisierte Struktur). Bestehende Prozesse werden **erweitert**, nicht verdoppelt.
- Es gibt **13 Ergänzungsblätter** (`D-xx-EB`): D-03-EB, D-04-EB, D-06-EB, D-07-EB, D-10-EB, D-14-EB, D-15-EB, D-16-EB, D-17-EB, D-20-EB, D-21-EB, D-22-EB, D-26-EB. Sie enthalten die Abschnitte, die in das bestehende ISMS-Dokument aufgenommen werden.
- Für D-04, D-06, D-10, D-14, D-15, D-16, D-17, D-20, D-21, D-22 und D-26 erhält die Firma **nur das Ergänzungsblatt**, kein eigenes Dokument. D-10-EB ergänzt das Asset-Inventar um das KI-Inventar.
- Bei D-03 und D-07 gibt es **beide**: die KI-Leitlinie D-03 und das Blatt D-03-EB für die Informationssicherheitsleitlinie; das KI-Risikoregister D-07 und das Blatt D-07-EB für das ISMS-Risikoregister.
- **Neu** bleiben in jedem Fall: D-03 KI-Leitlinie, D-08/D-09 Folgenabschätzung, D-11 SoA für 42001, D-12, D-13, D-24, D-25.
- Risikomethode: eine Methode mit denselben Skalen; KI-Risiken ergänzen die Auswirkungen auf Einzelpersonen und Gesellschaft. Informationssicherheitsrisiken bleiben im ISMS-Register und werden verknüpft (`ismsRisiko`).
- Gemeinsames internes Audit und gemeinsame Managementbewertung (`kombiniertMitIsms: true`).
- Details: `isms-integration.md`, Modus 10.

## Pfad «ohne ISMS»

- Grundlagen, die ein ISMS sonst liefert, entstehen schlank neu: Dokumentenlenkung (D-26), internes Audit (D-20), Managementbewertung (D-21), Nichtkonformitäten (D-22), Lieferantenprüfung (D-16), Kompetenz und Kommunikation (D-17).
- Mehr Grundfragen im Scoping (Modus 2): Wer entscheidet, wo liegen Dokumente, wie werden Freigaben belegt.
- Informationssicherheit nur so weit, wie sie KI-Risiken behandelt (z. B. Zugriffsrechte für Copilot, Vertraulichkeit bei Chatbots). Ein ISMS wird nicht verlangt.

## Typische Abfolge im Gespräch

1. Startblock, ISMS-Frage, Modul-Frage, Moduswahl.
2. Schnellcheck (Modus 1) oder direkt Scoping (2) und Inventar (3).
3. Rolle zuerst (4), Risiken und Kurzprüfungen (5), SoA (6).
4. Dokumente zuschneiden (7): D-01, D-02, D-03, D-04, D-15 zuerst, dann der Rest.
5. Internes Audit, Managementbewertung (9), Probeaudit (8).

## Die fünf häufigsten Auditfeststellungen (Praxisbeobachtung von Beratern, keine Statistik)

1. Unvollständiges KI-Inventar und Geltungsbereich, besonders eingebettete und eingekaufte KI.
2. Generische Risikobeurteilung ohne systemspezifische Risiken, ohne Restrisiko-Annahme und ohne Auslöser für eine neue Beurteilung.
3. Fehlende oder unvollständige Folgenabschätzung; SoA-Ausschlüsse ohne Begründung.
4. Lücke zwischen Richtlinie und Praxis: keine Test-, Protokoll-, Freigabe- oder Aufsichtsnachweise.
5. Schwaches internes Audit, Managementbewertung ohne alle Pflichteingaben, Korrekturen ohne Ursachenanalyse.
