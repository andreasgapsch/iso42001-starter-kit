# Modus 6: SoA-Vorschlag (statement of applicability)

## Ziel

Eine risikobasierte Erklärung zur Anwendbarkeit (statement of applicability, SoA) für alle 38 Controls aus ISO/IEC 42001 Anhang A: je Control Entscheid (anwendbar ja/nein), Begründung, Status, Nachweis und, mit ISMS, die wiederverwendbaren ISO/IEC 27001-Controls. Ergebnis: **D-11** und die Projektdatei. Normbezug: ISO/IEC 42001, Abschnitt 6.1.3; den Wortlaut der Controls lesen Sie in Ihrer eigenen Normausgabe nach (Anhang A, Hinweise zur Umsetzung in Anhang B).

Wenn `controls-42001.md` vorhanden ist, nutzen Sie dessen Kurzbezeichnungen und Erläuterungen. Zitieren Sie nie den Normtext eines Controls.

## Ablauf

1. Grundlagen klären: Rolle(n) (Modus 4), Risiken und Folgenabschätzungen (Modus 5), Eigenentwicklung ja/nein, ISMS ja/nein.
2. Standardentscheid aus der Tabelle unten übernehmen und je Control an Risiken und Systeme anpassen.
3. **Begründung immer**, für Aufnahme (z. B. «behandelt R-001, R-004») und Ausschluss (z. B. «keine eigene Entwicklung oder Anpassung von Modellen; bei Änderung neu beurteilen»).
4. Mit ISMS: verwandte 27001-Controls eintragen (`iso27001`) und Status aus dem ISMS übernehmen, wo der Nachweis trägt.
5. AI-Act-Modul an: Zusatz-Controls EUAIA-xx nach Modus 11 anhängen (`rahmenwerk: "EUAIA"`, `vorschlag: "aiact"`). Modul NIST AI RMF an: Zusatz-Controls RMF-xx nach Modus 12 (`rahmenwerk: "NISTRMF"`, `vorschlag: "nistrmf"`).
5a. Status «wirksam» nur mit Angabe in `wirksamkeit` (wie, wann, wer, Ergebnis; Prüfregel H35).
6. Tabelle und Projektdatei ausgeben. Offene Entscheide markieren.

## Regeln für Ausschlüsse

- Ausschluss nur, wenn die Tätigkeit nicht vorkommt **und** kein Risiko darauf verweist (Hinweis H04).
- «Schon vorhanden» ist kein Ausschlussgrund: Dann ist das Control anwendbar und umgesetzt (Hinweis H12).
- Die Controls zu Leitlinie, Rollen, Ressourcen, Folgenabschätzung, Information, Nutzung und Dritten (A.2 bis A.5, A.8 bis A.10) sind für fast jede Firma anwendbar.
- Für reine Betreiber gelten einige Lebenszyklus-Controls in angepasster Form (Prüfung vor Einsatz, Einführung, Überwachung, Protokolle), nicht als Entwicklungsprozess.
- Das Auditteam schaut Ausschlüsse besonders an. Lieber anwendbar mit schlanker Umsetzung als ein schwach begründeter Ausschluss.

## Fragen in Dreiergruppen

**Gruppe 1: Grundlagen**
1. Entwickeln, trainieren oder passen Sie KI-Modelle an? Beispiel: «Nein, nur Nutzung von SaaS.»
2. Bereiten Sie selbst Daten für KI auf (Training, Feinabstimmung, Wissensbasis)? Beispiel: «Wir laden Vorlagen in eine Copilot-Wissensbasis.»
3. Geben Sie KI-Leistungen an Kunden weiter? Beispiel: «Nein.»

**Gruppe 2: ISMS und Nachweise**
4. Welche ISMS-Nachweise gibt es schon (Asset-Inventar, Lieferantenprüfung, Vorfallmanagement, Protokollierung)? Beispiel: «Alle, ISO 27001 zertifiziert.»
5. Wo werden Nachweise abgelegt? Beispiel: «SharePoint, Ordner ISMS.»
6. Wer verantwortet die SoA? Beispiel: «ISMS-Verantwortliche.»

## Standardentscheide (B = reiner Betreiber, E = Eigenentwicklung)

| Control | Kurzbezeichnung (eigene Worte) | B | E | ISO/IEC 27001 (verwandt) |
|---|---|---|---|---|
| A.2.2 | KI-Leitlinie festlegen | ja | ja | 5.1 |
| A.2.3 | Abgleich mit anderen Leitlinien | ja | ja | 5.1 |
| A.2.4 | KI-Leitlinie regelmässig überprüfen | ja | ja | 5.1 |
| A.3.2 | KI-Rollen und Zuständigkeiten | ja | ja | 5.2, 5.3, 5.4 |
| A.3.3 | Meldeweg für Bedenken | ja | ja | 6.8 |
| A.4.2 | Ressourcen je KI-System erfassen | ja | ja | 5.9, 5.12 |
| A.4.3 | Datenressourcen beschreiben | ja | ja | 5.9, 5.12 |
| A.4.4 | Werkzeuge und Modelle beschreiben | ja | ja | 5.9, 8.6 |
| A.4.5 | Rechen- und Systemressourcen beschreiben | ja | ja | 5.23, 8.6 |
| A.4.6 | Personal und Kompetenzen beschreiben | ja | ja | 6.3 |
| A.5.2 | Verfahren für Folgenabschätzungen | ja | ja | 5.34 (teilweise) |
| A.5.3 | Ergebnisse der Folgenabschätzung aufbewahren | ja | ja | 5.34 (teilweise) |
| A.5.4 | Folgen für Personen und Gruppen beurteilen | ja | ja | 5.34 (teilweise) |
| A.5.5 | Folgen für die Gesellschaft beurteilen | ja | ja | keins |
| A.6.1.2 | Ziele für verantwortungsvolle Entwicklung | nein* | ja | 5.8, 8.25 |
| A.6.1.3 | Entwicklungsprozess festlegen | nein* | ja | 8.25, 8.27 |
| A.6.2.2 | Anforderungen an das KI-System festhalten | ja (Auswahlkriterien vor Einkauf) | ja | 8.26 |
| A.6.2.3 | Entwurf und Entwicklung dokumentieren | nein* | ja | 8.27, 8.28 |
| A.6.2.4 | Prüfen und Validieren | ja (Test mit eigenen Fällen vor Einsatz) | ja | 8.29 |
| A.6.2.5 | Einführung planen und freigeben | ja | ja | 8.31, 8.32 |
| A.6.2.6 | Betrieb und Überwachung | ja | ja | 8.16, 8.32 |
| A.6.2.7 | Technische Dokumentation je Zielgruppe | ja (Anbieterdokumentation bereithalten) | ja | 5.37 |
| A.6.2.8 | Ereignisprotokolle führen | ja (Protokolle des Dienstes nutzen) | ja | 8.15 |
| A.7.2 | Datenmanagement für die Entwicklung | nein* | ja | 5.12, 5.33 |
| A.7.3 | Datenbeschaffung festhalten | nein* | ja | 5.32 |
| A.7.4 | Anforderungen an die Datenqualität | ja (Eingabedaten) | ja | keins |
| A.7.5 | Datenherkunft nachverfolgen | nein* | ja | 5.33 |
| A.7.6 | Datenaufbereitung festlegen | nein* | ja | 8.11 (teilweise) |
| A.8.2 | Information für Nutzende | ja | ja | 5.31 |
| A.8.3 | Meldemöglichkeit für Externe | ja | ja | 6.8 |
| A.8.4 | Kommunikation bei Vorfällen | ja | ja | 5.24 bis 5.28, 5.5 |
| A.8.5 | Informationspflichten gegenüber Dritten | ja | ja | 5.31, 5.5 |
| A.9.2 | Regeln für verantwortungsvolle Nutzung | ja | ja | 5.10 |
| A.9.3 | Ziele für verantwortungsvolle Nutzung | ja | ja | 5.10 |
| A.9.4 | Nutzung gemäss Zweckbestimmung | ja | ja | 5.10, 5.37 |
| A.10.2 | Verantwortung mit Dritten aufteilen | ja | ja | 5.19, 5.20 |
| A.10.3 | Lieferanten steuern | ja | ja | 5.19 bis 5.23 |
| A.10.4 | Erwartungen der Kunden berücksichtigen | ja, wenn Kunden betroffen | ja | 5.31 |

\* «nein» nur, wenn weder Entwicklung noch Anpassung noch eigene Datenaufbereitung stattfindet. Sobald die Firma Modelle nachtrainiert, eigene Wissensbasen mit Kundendaten aufbaut oder Prompts und Agenten als Produkt baut: prüfen und eher «ja» mit schlanker Umsetzung.

Die 27001-Zuordnung ist eine fachliche Einschätzung, keine Aussage der Normen. IDs in der Projektdatei mit Präfix: `"27001-5.23"`.

## Ergebnis

Tabelle (D-11): Control | Kurzbezeichnung | anwendbar | Begründung | Status | Nachweis | verantwortlich | ISO/IEC 27001. Darunter: Anzahl anwendbar / ausgeschlossen, offene Entscheide, mit ISMS den Wiederverwendungsgrad (Anteil anwendbarer 42001-Controls mit zugeordnetem 27001-Nachweis).

Status für neue Firmen meist `offen` oder `geplant`; `umgesetzt` nur mit Nachweis (Prüfregel F07).

## JSON-Ausschnitt

```json
"controls": [
  { "id": "A.9.2", "rahmenwerk": "ISO42001", "anwendbar": "ja", "begruendung": "Behandelt R-001 und R-002 (Eingabe vertraulicher Daten).", "status": "geplant", "verantwortlich": "P-001", "nachweise": [], "umsetzung": "Nutzungsrichtlinie D-15 mit Freigabeprozess für neue Werkzeuge", "iso27001": ["27001-5.10"], "kiSysteme": [], "vorschlag": "risiko" },
  { "id": "A.7.2", "rahmenwerk": "ISO42001", "anwendbar": "nein", "begruendung": "Keine Entwicklung, kein Training und keine eigene Datenaufbereitung; bei Änderung neu beurteilen.", "status": "offen", "nachweise": [], "umsetzung": "", "iso27001": [], "kiSysteme": [] }
]
```
