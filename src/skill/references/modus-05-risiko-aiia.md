# Modus 5: Risiko und Folgenabschätzung (risk and AIIA)

## Ziel

KI-Risiken (AI risks) und Chancen je KI-System nach einer festen Methode beurteilen und behandeln, und je System per Kurzprüfung (triage) entscheiden, ob eine volle Folgenabschätzung für KI-Systeme (AI system impact assessment, AIIA) nötig ist. Ergebnis: Risikokriterien (**D-06**), Risikoregister mit Behandlungsplan (**D-07**), Verfahren (**D-08**, Aufbau nach ISO/IEC 42005 Kapitel 5), Kurzprüfung und gegebenenfalls volle Folgenabschätzung je System (**D-09**), Projektdatei. Normbezug: ISO/IEC 42001, Abschnitte 6.1.1 bis 6.1.4, 8.2 bis 8.4 und Anhang A.5; Wortlaut in der eigenen Normausgabe nachlesen.

Mit AI-Act-Modul: Prüfen, ob eine Grundrechte-Folgenabschätzung nach Art. 27 nötig ist (nur öffentliche Stellen, Private mit öffentlichen Diensten, Kredit und Lebens- oder Krankenversicherung) und ob eine DSFA nach Art. 26(9) verknüpft wird (`verknuepfteDsfa`), siehe Modus 11.

## Ablauf

1. **Kriterien festlegen** (einmal): Skalen, Bezugszeitraum, Akzeptanzgrenze. Mit ISMS die ISMS-Skalen übernehmen (`ausIsmsUebernommen: true`) und nur die Auswirkungen auf Einzelpersonen und Gesellschaft ergänzen.
2. **Kurzprüfung je System** (sechs Fragen, Schwellen unten). Ergebnis `kurz` oder `voll`, immer mit Begründung.
3. **Risiken je System** identifizieren: zwei bis fünf systemspezifische Risiken, keine generischen Sammelrisiken. Mindestens ein Risiko je System (Prüfregel F02) und, wo sinnvoll, eine Chance. Bei generativer KI die Vorschlagsliste GS-01 bis GS-22 aus `genai-sicherheit.md` als Gedankenstütze nutzen (reine Betreiber: Einträge mit Zielgruppe «betreiber») und den Einsatzentscheid je System festhalten (`einsatzentscheid`: Nutzen, geprüfte Lösung ohne KI, Wiedervorlage; H31).
4. **Bewerten** (W x A vor und nach Behandlung), **behandeln** (Option, Controls, Massnahmen).
5. **Volle Folgenabschätzung** für Systeme mit `voll` nach der Gliederung unten; Massnahmen daraus als Risiken und Massnahmen übernehmen.
6. **Restrisiko** von der zuständigen Person annehmen lassen (Name, Datum; Prüfregel F09); Behandlungsplan freigeben lassen (F10); Folgenabschätzungen mit Freigabe und nächster Überprüfung (F04).
7. Register, Kurzprüfungen, Folgenabschätzungen und Projektdatei ausgeben.

## Vorschlag Risikokriterien (Pflichtfassung)

- Bezugszeitraum: «pro Jahr».
- Wahrscheinlichkeit 1 selten (seltener als alle 5 Jahre), 2 möglich (alle 1 bis 5 Jahre), 3 wahrscheinlich (mehrmals pro Jahr), 4 häufig (monatlich oder öfter).
- Auswirkung 1 gering, 2 spürbar, 3 erheblich, 4 schwer; jeweils für Organisation (Geld, Ruf, Recht), **Einzelpersonen** (Rechte, Chancen, Gesundheit, Privatsphäre) und **Gesellschaft** (Umwelt, Vertrauen, Diskriminierung) beschreiben. Es zählt die höchste Stufe.
- Risikowert W x A: bis 4 akzeptabel, 5 bis 11 behandeln oder begründet tragen, ab 12 unannehmbar (zwingend behandeln).

## Risikoquellen (eigene Kategorien, angelehnt an ISO/IEC 42001 Anhang C)

Daten (Qualität, Herkunft, Vertraulichkeit), Modell (Fehler, Halluzination, Verzerrung), Nutzung (Fehlanwendung, Übervertrauen, fehlende Aufsicht), Lieferant (Abhängigkeit, Vertrag, Datennutzung für Training), Recht (Datenschutz, Urheberrecht, Berufsgeheimnis, AI Act), Sicherheit (Prompt Injection, Datenabfluss, Zugriffsrechte), Transparenz (Kennzeichnung, Erklärbarkeit), Umwelt (Energiebedarf), Betrieb (Ausfall, Drift).

## Fragen in Dreiergruppen

**Gruppe 1: Kriterien**
1. Haben Sie bereits Risikoskalen (z. B. aus dem ISMS)? Beispiel: «Ja, 4 x 4 aus dem ISMS, pro Jahr.»
2. Ab welchem Risiko muss die Geschäftsleitung entscheiden? Beispiel: «Ab Wert 12.»
3. Wer darf Restrisiken annehmen? Beispiel: «Die Geschäftsleitung, bei kleinen Risiken die Bereichsleitung.»

**Gruppe 2: Kurzprüfung je System (triage)**
4. Beeinflusst das System Rechte, Chancen oder Leistungen von Personen (z. B. Anstellung, Kredit, Preis) oder ihre Gesundheit oder Sicherheit? Beispiel: «Ja, Vorselektion von Bewerbungen.»
5. Sind verletzliche Gruppen betroffen (Kinder, Patientinnen, Abhängige wie Bewerbende) oder besondere Personendaten (Gesundheit, Religion, Biometrie)? Beispiel: «Bewerbende, keine besonderen Daten.»
6. Entscheidet das System weitgehend automatisch oder erreicht es sehr viele Personen? Beispiel: «Automatische Absage unter 50 Punkten.»

**Gruppe 3: Risiken je System**
7. Was könnte schiefgehen (Daten, Fehler, Missbrauch, Lieferant)? Beispiel: «Mandantendaten landen im Training des Anbieters.»
8. Was tun Sie heute schon dagegen? Beispiel: «Team-Lizenz ohne Trainingsnutzung, Regel in der Weisung.»
9. Wer ist für das Risiko verantwortlich? Beispiel: «Leiter Treuhand.»

**Gruppe 4: Betroffene und Massnahmen (nur bei voller Folgenabschätzung)**
10. Welche Personengruppen sind direkt oder indirekt betroffen, und wurden sie oder ihre Vertretung angehört? Beispiel: «Bewerbende direkt, HR-Team indirekt; nicht angehört.»
11. Was kann bei Fehlern oder Missbrauch passieren? Beispiel: «Geeignete Personen werden aussortiert, ohne dass es jemand merkt.»
12. Welche Schutzmassnahmen gibt es oder sind geplant? Beispiel: «Stichprobe der Absagen durch HR, Information der Bewerbenden.»

## Schwellen der Kurzprüfung

Ergebnis **voll**, wenn mindestens eines zutrifft:
- Rechtsposition oder Chancen von Personen betroffen (`rechtspositionOderChancen`);
- Gesundheit oder Sicherheit betroffen (`gesundheitOderSicherheit`);
- verletzliche Gruppen betroffen (`verletzlicheGruppen`);
- **zwei oder mehr** von: besondere Personendaten, weitgehend automatisierte Entscheidung, grosse Reichweite.

Sonst **kurz**: Die Kurzprüfung mit Begründung ist der Nachweis. Bei `voll` gilt das System als sensible Nutzung (`sensibleNutzung: true`, Prüfregel F03). Eingeschränkte Nutzung (`eingeschraenkteNutzung`) festhalten, wenn der Einsatz nur unter Auflagen zulässig ist.

## Volle Folgenabschätzung (eigene Gliederung, Struktur nach ISO/IEC 42005 Kapitel 6)

1. Kurzprüfung und Begründung
2. Systembeschreibung und Zweck
3. Vorgesehene Verwendungen und vernünftigerweise vorhersehbare Fehlanwendungen (reasonably foreseeable misuse)
4. Daten (als Betreiber oft «beim Lieferanten angefragt»)
5. Modell und Algorithmus (nur Ausbaustufe bei Eigenentwicklung)
6. Einsatzumfeld (Länder, Sprachen, Prozesse)
7. Betroffene Parteien (direkt, indirekt) und ob sie konsultiert wurden
8. Nutzen und Schaden je Ziel: Rechenschaft, Transparenz, Fairness, Datenschutz, Zuverlässigkeit, Sicherheit, Erklärbarkeit, Umwelt
9. Ausfälle, Fehler und Missbrauch
10. Massnahmen (mit Verweis auf Risiken R-xxx und Controls)
11. Ergebnis, Verknüpfung mit DSFA (Datenschutz-Folgenabschätzung) bzw. FRIA
12. Freigabe (Name, Datum) und nächste Überprüfung (jährlich und bei wesentlicher Änderung)

Den Wortlaut von ISO/IEC 42005 lesen Sie in Ihrer eigenen Ausgabe nach; hier steht nur der Aufbau in eigenen Worten.

## Ergebnis

- **Risikoregister (D-07):** ID | System | Titel | Quelle | Ebenen | W | A | Wert | Behandlung | Controls | Massnahmen | W nach | A nach | Wert nach | Eigner/in | Restrisiko angenommen (Name, Datum) | Status.
- **Kurzprüfung je System:** sechs Kriterien ja/nein, Ergebnis kurz/voll, Begründung.
- **Volle Folgenabschätzung** (D-09) als Markdown für Systeme mit `voll`.
- Hinweis: Behandlungsplan und Restrisiken durch die zuständige Leitung freigeben lassen (Prüfregel F10).

## JSON-Ausschnitt

```json
"risiken": [
  {
    "id": "R-001",
    "art": "risiko",
    "titel": "Mandantendaten im Chat-Assistenten",
    "beschreibung": "Mitarbeitende geben vertrauliche Mandantendaten in ChatGPT Team ein.",
    "kiSystem": "KI-002",
    "quelle": "Daten",
    "ebenen": ["organisation", "individuen"],
    "ursache": "Fehlende Regeln und Schulung",
    "folge": "Verletzung des Berufsgeheimnisses, Vertrauensverlust",
    "bestehendeMassnahmen": "Team-Lizenz ohne Trainingsnutzung",
    "w": 3, "a": 3, "wNach": 2, "aNach": 3,
    "behandlung": "vermindern",
    "controls": ["A.9.2", "A.4.3", "A.10.3"],
    "massnahmen": ["M-001"],
    "eigner": "P-001",
    "status": "in-behandlung"
  }
],
"folgenabschaetzungen": [
  {
    "id": "IA-001",
    "kiSystem": "KI-002",
    "triage": { "rechtspositionOderChancen": false, "gesundheitOderSicherheit": false, "verletzlicheGruppen": false, "besondereDaten": false, "automatisierteEntscheidung": false, "grosseReichweite": false, "ergebnis": "kurz", "begruendung": "Unterstützende Textarbeit, jede Ausgabe wird von Fachpersonen geprüft." },
    "systembeschreibung": "", "verwendungen": "", "fehlanwendungen": "", "daten": "", "einsatzumfeld": "",
    "betroffene": [], "nutzenSchaden": {}, "ausfaelle": "", "massnahmen": "",
    "sensibleNutzung": false, "eingeschraenkteNutzung": false,
    "ergebnis": "Keine volle Folgenabschätzung nötig.",
    "freigabe": { "von": "P-001", "am": "2026-10-19" },
    "naechsteUeberpruefung": "2027-10-19"
  }
]
```

Risikokriterien in `organisation.risikokriterien` (Stufen als Liste `{ "stufe": 1, "bezeichnung": "selten", "beschreibung": "seltener als alle 5 Jahre" }`, `zeitraum`, `akzeptanzBis`, `unannehmbarAb`, `ausIsmsUebernommen`).
