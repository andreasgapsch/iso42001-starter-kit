# ISMS-Integration (ISO/IEC 27001 und ISO/IEC 42001)

Beide Normen folgen der harmonisierten Struktur für Managementsysteme: Kapitel 4 bis 10 sind gleich gegliedert. Ein bestehendes ISMS wird darum **erweitert**, nicht verdoppelt. Die Zuordnungen hier sind eine fachliche Einschätzung, keine Aussage der Normen.

## Grundsätze

1. **Ein Managementsystem, zwei Normen:** gemeinsame Leitung, gemeinsames Dokumentensystem, gemeinsames internes Audit, gemeinsame Managementbewertung.
2. **Ergänzen statt neu schreiben:** Wo das ISMS ein Dokument hat, entsteht ein Ergänzungsblatt `D-xx-EB` mit den KI-Abschnitten.
3. **Eine Risikomethode:** gleiche Skalen und Kriterien; KI ergänzt die Sicht auf Einzelpersonen und Gesellschaft. Informationssicherheitsrisiken bleiben im ISMS-Register und werden verknüpft (Feld `ismsRisiko`).
4. **Nachweise wiederverwenden:** Ein 27001-Nachweis kann ein 42001-Control ganz oder teilweise belegen (Feld `iso27001` in der SoA).
5. **Was immer neu ist:** KI-Leitlinie (oder ein KI-Teil der Leitlinie), KI-Inventar mit Ressourcen, Folgenabschätzung (D-08, D-09), SoA für ISO/IEC 42001 (D-11), Lebenszyklus (D-12), Daten (D-13).

## Ergänzungsblätter (Pfad «mit ISMS»)

| Blatt | Ergänzt im ISMS | Inhalt (KI-Abschnitte) | 42001 |
|---|---|---|---|
| D-03-EB | Informationssicherheitsleitlinie | Geltung für KI, Verhältnis zur KI-Leitlinie, Sicherheitsgrundsätze für KI, gemeinsame Überprüfung | 5.2, A.2 |
| D-04-EB | Rollen, Organigramm | AIMS-Verantwortung, Eigner/in je KI-System, RACI für KI, Meldeweg für Bedenken | 5.3, A.3 |
| D-06-EB | Risikoverfahren | eine Methode, Auswirkungen auf Personen und Gesellschaft, KI-Risikoquellen, Verbindung zur Folgenabschätzung, Risikoeigner | 6.1, 8.2, 8.3 |
| D-07-EB | Risikoregister | KI-Spalten (System, Ebenen, Folgenabschätzung), Verknüpfung zu ISMS-Risiken | 6.1.3 |
| D-10-EB | Asset-Inventar | KI-Systeme als Assets, Ressourcen A.4.2 bis A.4.6, Verweis auf KI-Inventar | A.4 |
| D-14-EB | Vorfallmanagement | KI-Vorfälle, Kommunikation an Betroffene, Meldepflichten | A.8.4, A.8.5 |
| D-15-EB | Akzeptable Nutzung | Regeln für KI-Werkzeuge, Freigabe neuer Werkzeuge | A.9 |
| D-16-EB | Lieferantenmanagement | KI-Prüffragen, Vertragsklauseln, Verantwortungsaufteilung | A.10 |
| D-17-EB | Kompetenz, Awareness, Kommunikation | KI-Rollen und Schulungen, KI-Themen im Kommunikationsplan | 7.2 bis 7.4 |
| D-20-EB | Auditprogramm | 42001-Abschnitte und Controls im gemeinsamen Programm | 9.2 |
| D-21-EB | Managementbewertung | KI-Eingaben und Entscheide | 9.3 |
| D-22-EB | Nichtkonformitäten | KI-Feststellungen im gemeinsamen Register | 10.2 |
| D-26-EB | Lenkung DI | KI-Dokumente im Register, Änderungen am AIMS | 6.3, 7.5 |

Jedes Blatt nennt: ISMS-Dokument, das ergänzt wird; einzufügende Abschnitte mit Text; Normbezug; Freigabe.

## Zuordnung 42001 zu 27001:2022 (Auszug, verwandt)

| 42001 Anhang A | 27001:2022 Anhang A | Wiederverwendung |
|---|---|---|
| A.2.2 bis A.2.4 | 5.1 | Leitlinienprozess, Freigabe, Überprüfung |
| A.3.2 | 5.2, 5.3, 5.4 | Rollenmodell |
| A.3.3 | 6.8 | Meldewesen |
| A.4.2 bis A.4.5 | 5.9, 5.12, 5.23, 8.6 | Asset-Inventar, Klassifizierung, Cloud |
| A.4.6 | 6.3 | Schulung |
| A.5.2 bis A.5.5 | 5.34 (teilweise) | Datenschutz-Folgenabschätzung als Brücke |
| A.6.1.2, A.6.1.3 | 5.8, 8.25, 8.27 | sichere Entwicklung |
| A.6.2.2 bis A.6.2.5 | 8.26 bis 8.29, 8.31, 8.32 | Anforderungen, Tests, Änderungen |
| A.6.2.6 | 5.37, 8.8, 8.16, 8.32 | Betrieb und Überwachung |
| A.6.2.8 | 8.15, 8.17 | Protokollierung |
| A.7.2 bis A.7.6 | 5.12, 5.32 bis 5.34, 8.11 | Datenschutz, Klassifizierung (Datenqualität ohne Pendant) |
| A.8.2, A.8.5 | 5.31, 5.5 | rechtliche Anforderungen, Behördenkontakt |
| A.8.3 | 6.8 | Meldewesen |
| A.8.4 | 5.24 bis 5.28, 5.5 | Vorfallmanagement |
| A.9.2 bis A.9.4 | 5.10, 5.37 | akzeptable Nutzung |
| A.10.2, A.10.3 | 5.19 bis 5.23 | Lieferanten |
| A.10.4 | 5.31 | Kundenanforderungen |

Kapitel 4 bis 10: Kontext (4), Führung (5), Planung (6.1, 6.2, 6.3), Unterstützung (7), Betrieb (8), Bewertung (9), Verbesserung (10) werden gemeinsam geführt. KI-spezifisch neu sind vor allem 6.1.4 und 8.4 (Folgenabschätzung) sowie die KI-Ziele.

## Gemeinsames Audit und gemeinsame Managementbewertung

- **Internes Audit:** ein Programm für beide Normen, je Audit die Abschnitte beider Normen; Auditorinnen und Auditoren mit KI-Grundkenntnissen; `kombiniertMitIsms: true`.
- **Zertifizierungsaudit:** viele Stellen bieten kombinierte Audits an (geringerer Aufwand); die Stelle muss für ISO/IEC 42001 akkreditiert sein (Akkreditierung nach ISO/IEC 17021-1, für ISO/IEC 42001 mit den Zusatzanforderungen von ISO/IEC 42006; in der Schweiz durch die SAS). ISMS-Auditoren kennen ISO/IEC 42001 oft nicht: Einarbeitung oder externe Fachauditorin früh einplanen; das ISMS-Team auditiert nur, soweit es nicht im AIMS-Projekt mitarbeitet.
- **Managementbewertung:** eine Sitzung, ein Protokoll mit Eingaben für beide Systeme; KI-Teil mit Risiken, Folgenabschätzungen, KI-Zielen und AI-Act-Stand (mit Modul).

## Wiederverwendungsgrad

Anteil der anwendbaren 42001-Controls mit mindestens einem zugeordneten 27001-Control, dessen Nachweis vorhanden ist. Typisch 40 bis 60 % bei einem gelebten ISMS.
