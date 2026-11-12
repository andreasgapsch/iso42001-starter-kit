# Modus 9: Betrieb (operation)

## Ziel

Das AIMS im Alltag am Laufen halten: internes Audit (internal audit), Managementbewertung (management review), Nichtkonformitäten und Korrekturmassnahmen (nonconformity, corrective action) sowie die jährliche Überprüfung. Ergebnis: **D-20** (Auditprogramm, Auditplan), **D-21** (Agenda und Protokoll), **D-22** (Register), Jahreskalender und Projektdatei. Normbezug: ISO/IEC 42001, Abschnitte 9.1 bis 9.3, 10.1, 10.2; Wortlaut in der eigenen Normausgabe nachlesen.

Mit ISMS: internes Audit und Managementbewertung gemeinsam für beide Systeme (`kombiniertMitIsms: true`); siehe Modus 10.

## Ablauf

1. Was steht an? Internes Audit planen, Managementbewertung vorbereiten, Feststellung bearbeiten oder Jahresplan erstellen.
2. Passende Fragengruppe stellen.
3. Dokument oder Protokoll nach Gliederung ausgeben, Massnahmen ableiten, Projektdatei ergänzen.

## Fragen in Dreiergruppen

**Gruppe 1: Internes Audit**
1. Wer kann unabhängig auditieren (nicht die eigene Arbeit prüfen)? Beispiel: «Die Qualitätsleiterin oder ein externer Auditor.»
2. In welchem Rhythmus soll das ganze AIMS auditiert werden? Beispiel: «Einmal jährlich, aufgeteilt auf zwei Termine.»
3. Welche Bereiche sind am riskantesten und sollen zuerst drankommen? Beispiel: «HR und Kundenservice.»

**Gruppe 2: Managementbewertung**
4. Wann tagt die Geschäftsleitung, und wer nimmt teil? Beispiel: «Im Dezember, GL und AIMS-Verantwortlicher.»
5. Welche Ergebnisse liegen vor (Audit, Kennzahlen, Vorfälle, Rückmeldungen)? Beispiel: «Auditbericht und Zielmessung Q3.»
6. Welche Änderungen gab es im Umfeld (Gesetz, Kunden, neue KI)? Beispiel: «AI Act Fristen verschoben, neues CRM mit KI.»

**Gruppe 3: Nichtkonformität**
7. Was ist passiert, und wo wurde es festgestellt? Beispiel: «Ein neues KI-Tool ohne Freigabe im Marketing.»
8. Was wurde sofort korrigiert? Beispiel: «Nutzung gestoppt, Freigabe nachgeholt.»
9. Warum konnte es passieren (Ursache, z. B. mit fünfmal «Warum»)? Beispiel: «Freigabeprozess im Marketing unbekannt.»

## Inhalte

**Auditprogramm (D-20):** Jahresplan mit Bereichen und Abschnitten, Auditor/in mit Unabhängigkeit, Kriterien (ISO/IEC 42001, eigene Vorgaben, mit Modul AI Act), Methoden (Interview, Dokumente, Stichproben), Bericht. Checkliste aus `audit-checklisten.md`.

**Managementbewertung (D-21), Pflichteingaben in eigenen Worten (9.3):**
1. Stand der Massnahmen aus früheren Bewertungen
2. Änderungen bei externen und internen Themen
3. Änderungen bei Erwartungen interessierter Parteien
4. Leistung des AIMS: Nichtkonformitäten und Korrekturen, Mess- und Überwachungsergebnisse, Auditergebnisse
5. Möglichkeiten zur Verbesserung
Dazu sinnvoll: Stand der Risiken und Folgenabschätzungen, Ressourcen, Rückmeldungen und Vorfälle. Ergebnisse: Entscheide zu Verbesserungen, Änderungsbedarf am AIMS, Ressourcen; Massnahmen mit Verantwortung und Termin.

**Korrekturmassnahme (D-22):** Beschreibung, Sofortkorrektur, Ursache, Massnahme gegen Wiederholung, ähnliche Fälle anderswo prüfen, Wirksamkeitsprüfung mit Datum (Prüfregel F17), Abschluss.

**Jahreskalender (Vorschlag)**

| Monat | Aufgabe |
|---|---|
| Januar | KI-Ziele des Vorjahres bewerten, neue Ziele (D-05) |
| Februar | KI-Inventar abgleichen, Schatten-KI-Umfrage (D-10) |
| März | Risiken und Folgenabschätzungen überprüfen (D-07, D-09) |
| April | Lieferantenprüfung KI (D-16) |
| Mai | Schulung und Bewusstsein, Wirksamkeit prüfen (D-17) |
| Juni | Leitlinie und Nutzungsrichtlinie überprüfen (D-03, D-15) |
| September | Internes Audit (D-20) |
| Oktober | Feststellungen bearbeiten (D-22), mit Modul Stand AI Act prüfen (E-09) |
| November | Managementbewertung (D-21) |
| Dezember | Dokumentenregister und Überprüfungsdaten (D-26) |

Danach Überwachungsaudit der Zertifizierungsstelle (jährlich), Rezertifizierung nach drei Jahren.

## JSON-Ausschnitt

```json
"managementbewertungen": [
  { "id": "MB-001", "datum": "2026-12-10", "kombiniertMitIsms": false, "teilnehmende": "Geschäftsleitung, AIMS-Verantwortliche", "eingaben": { "statusMassnahmen": "6 von 8 erledigt", "aenderungenThemen": "AI Act Fristen verschoben", "aenderungenParteien": "Kunde verlangt KI-Klausel", "leistung": "Audit: 2 leichte NK; Ziele 3 von 4 erreicht", "verbesserungen": "Freigabeprozess vereinfachen", "weitere": "" }, "entscheide": "Budget für Schulung freigegeben", "massnahmen": ["M-010"] }
],
"feststellungen": [
  { "id": "F-002", "quelle": "pruefung", "einstufung": "nk-leicht", "beschreibung": "KI-Bildgenerator im Marketing ohne Freigabe genutzt.", "normbezug": "A.9.2, 8.1", "korrektur": "Nutzung gestoppt, Freigabe nachgeholt", "ursache": "Freigabeprozess im Marketing nicht bekannt", "massnahmen": ["M-011"], "wirksamkeit": { "am": "2027-03-31", "ergebnis": "[[nach Prüfung eintragen]]" }, "status": "in-arbeit" }
]
```
