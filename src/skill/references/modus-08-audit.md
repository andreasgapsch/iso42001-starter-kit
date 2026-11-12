# Modus 8: Auditvorbereitung (audit preparation)

## Ziel

Die Firma auf das Zertifizierungsaudit vorbereiten: Probeaudit Stage 1 (Dokumente und Bereitschaft) und Stage 2 (Umsetzung und Wirksamkeit), Interviewfragen je Rolle, Stichproben und Feststellungen nach Schweregrad. Ergebnis: Befundliste mit Ampel, Massnahmen und Projektdatei (Audit `extern-stage1` oder `intern` als Probeaudit, Feststellungen F-xxx). Grundlage: `audit-checklisten.md`, Fahrplan D-25.

## Ablauf

1. Umfang klären: Stage 1, Stage 2 oder beides; Zieltermin; welche Unterlagen liegen vor (Projektdatei, Dokumente als Text).
2. **Stage 1:** Prüfpunkte S1-01 bis S1-16 durchgehen. Je Punkt «erfüllt», «teilweise», «fehlt», mit Begründung. Mit Projektdatei die Prüfregeln F01 bis F26 und H01 bis H23 sinngemäss anwenden (H19 bis H23 prüfen die Reihenfolge der Freigaben).
3. **Stage 2:** Stichproben auswählen (je Prüfpunkt S2 eine konkrete Stichprobe nennen) und Interviewfragen je Rolle bereitstellen. Auf Wunsch ein Rollenspiel: Sie stellen als Auditor/in Fragen, die Person antwortet, Sie bewerten.
4. Feststellungen formulieren: Was wurde gesehen (Beleg), welche Anforderung (Abschnitt), Einstufung (`nk-schwer`, `nk-leicht`, `beobachtung`, `verbesserung`).
5. Massnahmen je Feststellung mit Verantwortung und Termin; schwere Nichtkonformitäten zuerst.
6. Befundliste, Ampel und Projektdatei ausgeben.

## Fragen in Dreiergruppen

**Gruppe 1: Rahmen**
1. Wann ist das Stage-1-Audit geplant, und mit welcher Zertifizierungsstelle? Beispiel: «Im März 2027, Stelle noch offen.»
2. Welche Dokumente sind freigegeben, welche im Entwurf? Beispiel: «D-01 bis D-04 freigegeben, Rest Entwurf.»
3. Gab es schon ein internes Audit und eine Managementbewertung? Beispiel: «Internes Audit im Januar, Managementbewertung geplant.»

**Gruppe 2: Stichproben**
4. Welches KI-System hat das höchste Risiko? Beispiel: «Die Bewerbungsvorselektion.»
5. Welches Werkzeug wurde zuletzt eingeführt? Beispiel: «Copilot im September.»
6. Wer kann für Interviews zur Verfügung stehen? Beispiel: «Geschäftsführer, IT-Leiterin, zwei Sachbearbeitende.»

## Ampel

- **Grün:** alle Stage-1-Punkte erfüllt, keine schwere Nichtkonformität.
- **Gelb:** höchstens leichte Nichtkonformitäten; Stage 1 möglich mit Korrekturplan.
- **Rot:** mindestens eine schwere Nichtkonformität (z. B. fehlendes internes Audit, fehlende Managementbewertung, keine Risikobeurteilung, Inventar offensichtlich unvollständig). Stage 1 verschieben.

## Ergebnis

1. Ampel und ein Satz Gesamturteil (ohne Zertifizierungsgarantie).
2. Tabelle Stage 1: Nr | Prüfpunkt | Ergebnis | Beleg oder Lücke.
3. Stage 2: Stichprobenplan (Prüfpunkt, konkrete Stichprobe, Person).
4. Interviewfragen für die genannten Rollen (aus `audit-checklisten.md`, an die Firma angepasst).
5. Feststellungen: ID | Einstufung | Beschreibung | Abschnitt | Massnahme | verantwortlich | Termin.
6. Projektdatei.

## JSON-Ausschnitt

```json
"audits": [
  { "id": "AU-001", "art": "intern", "kombiniertMitIsms": false, "durchgefuehrt": "2026-10-19", "umfang": "Probeaudit Stage 1, ganzes AIMS", "kriterien": "ISO/IEC 42001, eigene Vorgaben", "auditor": "[[Name]]", "unabhaengigkeit": "Auditorin ist nicht am AIMS beteiligt", "ergebnis": "Gelb: 2 leichte Nichtkonformitäten, 1 Beobachtung" }
],
"feststellungen": [
  { "id": "F-001", "audit": "AU-001", "quelle": "audit", "einstufung": "nk-leicht", "beschreibung": "Für KI-003 liegt keine Kurzprüfung zur Folgenabschätzung vor.", "normbezug": "6.1.4, A.5.2", "korrektur": "", "ursache": "", "massnahmen": ["M-004"], "status": "offen" }
]
```
