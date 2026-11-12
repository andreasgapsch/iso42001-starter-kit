# Modus 7: Dokumente zuschneiden (tailor documents)

## Ziel

Aus den leeren Kit-Vorlagen fertige Firmendokumente machen: Firmendaten einsetzen, nicht zutreffende Teile kürzen, Hinweistexte und den Kit-Hinweis entfernen, als Markdown (oder DOCX, wenn die Umgebung Dateien erzeugen kann). Normbezug: je Dokument (Tabelle unten); Wortlaut in der eigenen Normausgabe nachlesen.

## Ablauf

1. Welches Dokument, in welcher Sprache, für welchen Pfad (mit/ohne ISMS)? Mit ISMS bei Dokumenten mit Ergänzungsblatt das **Ergänzungsblatt** `D-xx-EB` erzeugen statt eines neuen Dokuments (siehe `isms-integration.md`).
2. Vorlage lesen: `assets/de/` oder `assets/en/` (DOCX/XLSX), falls die Umgebung Dateien lesen kann. Sonst die Gliederung unten verwenden.
3. Fakten aus Gespräch und Projektdatei einsetzen (Name, Personen, Systeme, Risiken). Unbekanntes als `[[Platzhalter]]` stehen lassen und unter «Offen» auflisten.
4. **Entfernen:** alle Hinweise an die ausfüllende Person (Absätze mit «Hinweis», «Tipp», «Beispiel» als Ausfüllhilfe, graue Kästen), Vorschlagslisten, die nicht gewählt wurden, und den Kit-Block «Vorlage aus dem … Starter-Kit … Diesen Block vor der Freigabe löschen». Kein Verweis auf das Kit, seinen Autor oder dessen Website.
5. Minimal zuerst: Pflichtfassung, Ausbaustufe nur bei Eigenentwicklung, hohem Risiko oder auf Wunsch.
6. Dokument ausgeben, danach die Projektdatei mit dem Eintrag in `dokumente` (Status `entwurf`).
7. **Firmen-CI** (Logo, Farben, Schrift): nicht im Skill. Für Dokumente im Erscheinungsbild der Firma das Ergebnis als Projektdatei ins Werkzeug übernehmen und dort erzeugen (Einstellungen › Dokumentgestaltung). In DOCX aus dem Skill nur Firmenname und Klassifikation in Kopf- und Fusszeile setzen.

## Fragen in Dreiergruppen

1. Welches Dokument brauchen Sie zuerst? Beispiel: «Die KI-Leitlinie D-03.»
2. In welcher Sprache und in welchem Format? Beispiel: «Deutsch, Markdown für Word.»
3. Wer gibt es frei und wer ist Eigner/in? Beispiel: «Geschäftsführerin gibt frei, IT-Leiter ist Eigner.»

## Aufbau jedes Dokuments

Kopf (Lenkungstabelle): Dokument-ID | Titel | Version | Eigner/in | Freigabe durch | Datum | Klassifikation | Normbezug. Mit ISMS zusätzlich «Gilt für ISMS und AIMS: ja/nein».
Schluss: Freigabe (Name, Funktion, Datum), nächste Überprüfung, Änderungshistorie (Version, Datum, Änderung).

## Gliederungen (Pflichtfassung)

**D-01 Kontext, interessierte Parteien und Rollen** (4.1, 4.2): siehe Modus 2.
**D-02 Geltungsbereich und AIMS-Überblick** (4.3, 4.4): siehe Modus 2.

**D-03 KI-Leitlinie** (5.2, A.2), zwei bis drei Seiten, keine Produktnamen (Hinweis H13):
1. Zweck und Geltungsbereich; 2. Unsere Grundsätze (vier bis sieben, z. B. Mensch entscheidet, Vertraulichkeit, Transparenz, Fairness, Sicherheit und Qualität, Recht und Verträge, Verantwortung für Folgen); 3. Unsere Verpflichtungen (anwendbare Anforderungen erfüllen, fortlaufend verbessern, Mittel bereitstellen); 4. Rahmen für KI-Ziele (Verweis D-05); 5. Zuständigkeiten (Verweis D-04); 6. Bezug zu anderen Leitlinien (Tabelle Leitlinie, Bezug, Massnahme); 7. Abweichungen und Ausnahmen; 8. Bekanntmachung und Verfügbarkeit; 9. Überprüfung; 10. Freigabe durch die Geschäftsleitung.

**D-04 Rollen, Verantwortlichkeiten und Meldewege** (5.3, A.3): 1. Gesamtverantwortung Geschäftsleitung; 2. AIMS-Verantwortung (sorgt für Normkonformität, berichtet der Geschäftsleitung); 3. Eigner/in je KI-System; 4. RACI-Tabelle (Aufgabe | R | A | C | I) für Inventar, Risiko, Folgenabschätzung, Freigabe neuer Werkzeuge, Lieferanten, menschliche Aufsicht, Vorfälle, Audit; 5. Meldeweg für Bedenken (Kanal, Vertraulichkeit, Frist, Eskalation).

**D-05 KI-Ziele, Kennzahlen und Messplan** (6.2, 9.1), Tabelle: Ziel | Kennzahl | Sollwert | Messmethode | Häufigkeit | Verantwortlich | Ressourcen | Termin | Bewertung.

**D-06 Verfahren KI-Risikomanagement** (6.1.1 bis 6.1.3, 8.2, 8.3): 1. Zweck; 2. Auslöser (jährlich, neues System, wesentliche Änderung, Vorfall); 3. Skalen und Kriterien; 4. Ablauf identifizieren, analysieren, bewerten, behandeln; 5. Behandlungsoptionen; 6. Restrisiko-Annahme; 7. Verbindung zur Folgenabschätzung; 8. Rollen; 9. Aufzeichnungen (D-07).

**D-07 Risikoregister und Behandlungsplan** (XLSX): Spalten siehe Modus 5; Blätter Risiken, Chancen, Behandlungsplan, Freigabe.

**D-08 Verfahren Folgenabschätzung** (6.1.4, A.5.2), Aufbau nach ISO/IEC 42005 Kapitel 5 in eigenen Worten: 1. Einbettung in die Prozesse; 2. Zeitpunkt und Auslöser, Kurzprüfung; 3. Umfang; 4. Zuständigkeiten; 5. Schwellen für sensible und eingeschränkte Nutzung, Ausmassskala; 6. Durchführung; 7. Auswertung; 8. Berichte intern und extern; 9. Freigaben; 10. Überwachung und Wiederholung.

**D-09 Folgenabschätzung je System**: Gliederung siehe Modus 5.

**D-10 KI-Inventar** (XLSX): Spalten siehe Modus 3; Blätter Inventar, Ressourcen (A.4.2 bis A.4.6), Fragebogen.

**D-11 Erklärung zur Anwendbarkeit** (XLSX): Spalten siehe Modus 6.

**D-12 Lebenszyklus von KI-Systemen** (8.1, A.6): Pflichtfassung Betreiber: 1. Auswahl und Anforderungen vor dem Einkauf; 2. Prüfung mit eigenen Fällen; 3. Einführung und Freigabe; 4. Betrieb und Überwachung (Kennzahlen, Fehlerbehandlung, Updates); 5. Protokollierung; 6. Dokumentation je Zielgruppe; 7. Ausserbetriebnahme. Ausbaustufe Entwicklung: Ziele, Entwicklungsprozess, Anforderungen, Entwurf, Verifikation und Validierung.

**D-13 Daten für KI-Systeme** (A.7): Pflichtfassung: Qualität der Eingabedaten, Vertraulichkeit, Aufbewahrung. Ausbau: Datenbeschaffung, Herkunft, Aufbereitung, Datenblatt je Datensatz.

**D-14 Information, Transparenz und Meldungen** (A.8): 1. Information für Nutzende je System; 2. Meldekanal für Externe; 3. Kommunikation bei KI-Vorfällen (was ist ein Vorfall, wer informiert wen, Fristen); 4. Informationspflichten gegenüber Dritten (Liste).

**D-15 Richtlinie zur verantwortungsvollen KI-Nutzung** (A.9, 7.3), zwei Seiten: 1. Für wen; 2. Erlaubte Werkzeuge (Verweis D-10); 3. Was nie in KI-Werkzeuge gehört; 4. Ergebnisse prüfen (Mensch entscheidet); 5. Kennzeichnung; 6. Neue Werkzeuge beantragen und freigeben; 7. Melden von Problemen; 8. Folgen bei Verstössen.

**D-16 Lieferanten und eingekaufte KI** (XLSX): Lieferant | Leistung | Prüffragen (Datennutzung für Training, Region, Unterauftragnehmer, Dokumentation, Vorfallmeldung, Kündigung und Datenrückgabe) | Prüfstatus | nächste Prüfung; Verantwortungsmatrix.

**D-17 Kompetenz, Bewusstsein und Kommunikation** (XLSX): Rolle | Anforderung | Personen | Massnahme | Nachweis | Wirksamkeit; Kommunikationsplan: Was | Wann | Wer | Mit wem | Wie | intern/extern.

**D-20 Internes Audit**, **D-21 Managementbewertung**, **D-22 Nichtkonformitäten**: siehe Modus 9.

**D-26 Lenkung dokumentierter Information** (6.3, 7.5), zwei Seiten: 1. Kennzeichnung (ID, Version, Datum, Eigner); 2. Prüfung und Freigabe; 3. Ablage und Schutz; 4. Versionen und Änderungshistorie; 5. Externe Dokumente; 6. Aufbewahrung und Löschung; 7. Änderungen am AIMS planen; Dokumentenregister (ID | Titel | Version | Status | Eigner | Ablageort | nächste Überprüfung).

Mit Modul EU AI Act zusätzlich E-01 bis E-09 (siehe Modus 11), mit Modul NIST AI RMF N-01 bis N-04 (siehe Modus 12).

## Ergebnis

Das Dokument als Markdown (Überschriften, Tabellen), danach «Offen» mit allen Platzhaltern, danach die Projektdatei mit dem Dokumenteintrag. Kein Hinweis auf das Kit im Dokument.

## JSON-Ausschnitt

```json
"dokumente": [
  { "id": "D-03", "version": "0.1", "status": "entwurf", "eigner": "P-002", "naechsteUeberpruefung": "2027-10-31", "ablageort": "[[Ablageort]]", "giltFuerIsms": false }
]
```
