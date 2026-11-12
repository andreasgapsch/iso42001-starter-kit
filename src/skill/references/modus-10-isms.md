# Modus 10: ISMS-Integration (ISMS integration)

## Ziel

Für Firmen mit ISMS nach ISO/IEC 27001 klären, was wiederverwendet, was erweitert und was neu erstellt wird: Ergänzungsblätter (`D-xx-EB`), Zuordnung der 27001-Nachweise zu 42001-Controls, gemeinsames Audit und gemeinsame Managementbewertung. Ergebnis: Integrationsübersicht (wie **D-23**), Liste der Ergänzungsblätter, SoA-Einträge mit `iso27001` und Projektdatei mit `meta.mitIsms: true`. Grundlage: `isms-integration.md`.

## Ablauf

1. ISMS-Stand erfragen (Gruppe 1). Zertifiziert: `meta.ismsZertifiziert: true`.
2. Vorhandene ISMS-Dokumente den Ergänzungsblättern zuordnen (Gruppe 2).
3. Risikomethode abgleichen: Skalen übernehmen, KI-Auswirkungen ergänzen (`risikokriterien.ausIsmsUebernommen: true`).
4. 27001-Controls mit Nachweis den 42001-Controls zuordnen und den Wiederverwendungsgrad schätzen.
5. Gemeinsames Audit und gemeinsame Managementbewertung planen (Gruppe 3).
6. Übersicht ausgeben: Tabelle «Dokument | wiederverwendet / erweitert (Ergänzungsblatt) / neu | ISMS-Dokument | nächster Schritt», danach Projektdatei.

## Fragen in Dreiergruppen

**Gruppe 1: ISMS-Stand**
1. Ist das ISMS zertifiziert, seit wann und mit welchem Geltungsbereich? Beispiel: «Seit 2023 zertifiziert, ganze Firma.»
2. Welche Stelle zertifiziert, und bietet sie ISO/IEC 42001 an? Beispiel: «SQS, unklar.»
3. Wer leitet das ISMS, und soll dieselbe Person das AIMS führen? Beispiel: «Die ISB, ja.»

**Gruppe 2: Dokumente und Methoden**
4. Welche ISMS-Dokumente gibt es (Leitlinie, Rollen, Risikoverfahren, Asset-Inventar, Lieferanten, Vorfälle, akzeptable Nutzung, Auditprogramm)? Beispiel: «Alle, im SharePoint.»
5. Welche Risikoskalen verwenden Sie? Beispiel: «4 x 4, pro Jahr, akzeptabel bis 4.»
6. Sind KI-Werkzeuge schon im Asset-Inventar oder in der Lieferantenliste? Beispiel: «Copilot ja, ChatGPT nein.»

**Gruppe 3: Audit und Bewertung**
7. Wann sind internes Audit und Managementbewertung des ISMS? Beispiel: «Audit im Mai, Bewertung im Juni.»
8. Sollen beide Normen gemeinsam auditiert und bewertet werden? Beispiel: «Ja.»
9. Gibt es Auditorinnen oder Auditoren mit KI-Kenntnissen? Beispiel: «Nein, Schulung nötig.»

## Ergebnis

1. Tabelle Integrationsübersicht: Kit-Dokument | Behandlung (wiederverwendet / Ergänzungsblatt / neu) | ISMS-Dokument | nächster Schritt.
2. Liste der zu erstellenden Ergänzungsblätter mit den KI-Abschnitten (Inhalt auf Wunsch über Modus 7).
3. Zuordnung 27001 zu 42001 für die SoA (Spalte `iso27001`) und geschätzter Wiederverwendungsgrad.
4. Plan für gemeinsames internes Audit und gemeinsame Managementbewertung.
5. Projektdatei.

## JSON-Ausschnitt

```json
"meta": { "mitIsms": true, "ismsZertifiziert": true },
"dokumente": [
  { "id": "D-06-EB", "version": "0.1", "status": "entwurf", "eigner": "P-001", "ablageort": "SharePoint ISMS", "giltFuerIsms": true }
],
"controls": [
  { "id": "A.10.3", "rahmenwerk": "ISO42001", "anwendbar": "ja", "begruendung": "KI-Lieferanten (Copilot, ChatGPT) mit Zugriff auf Kundendaten; behandelt R-003.", "status": "teilweise", "nachweise": ["N-002"], "umsetzung": "Lieferantenprozess ISMS, ergänzt um KI-Prüffragen (D-16-EB)", "iso27001": ["27001-5.19", "27001-5.20", "27001-5.23"], "kiSysteme": [] }
]
```

(Ausschnitt; in der Ausgabe stehen in `meta` alle Pflichtfelder.)
