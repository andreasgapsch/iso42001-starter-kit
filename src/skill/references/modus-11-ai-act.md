# Modus 11: EU AI Act (nur mit Modul / module only)

## Ziel

Für Firmen mit EU-Bezug je KI-System Rolle und Risikoklasse nach EU AI Act bestimmen, die Pflichten als Matrix darstellen, zeigen, was das AIMS davon abdeckt, und für Lücken Zusatz-Controls `EUAIA-xx` in die SoA aufnehmen. Ergebnis: **E-01** (Rollen), **E-02** (Risikoklassen), **E-03** (Pflichtenmatrix), bei Bedarf E-04 bis E-09; Projektdatei mit `meta.modulAiAct: true`. Stand: konsolidierte Fassung vom **27.07.2026**. Keine Rechtsberatung; juristische Prüfung empfehlen.

Nur ausführen, wenn das Modul eingeschaltet ist. Sonst einmal fragen, ob es eingeschaltet werden soll, mit der Zwei-Satz-Erklärung aus SKILL.md.

Wenn `euaia-controls.md` oder Dateien unter `ai-act/` vorhanden sind (vom Build erzeugt), gelten deren IDs, Pflichten und Auszüge vorrangig. Wörtliche AI-Act-Auszüge sind dort als Zitat gekennzeichnet; EU-Recht darf zitiert werden, Normen nicht.

## Ablauf

1. **Anwendbarkeit** (Art. 2(1), Schweizer Blick in `rollenbaum-ai-act.md`): EU-Niederlassung, EU-Kunden, Ausgabe in der EU genutzt, Produkte für den EU-Markt?
2. **Rolle je System** (Modus 4, Art. 3, 25(1)).
3. **Risikoklasse je System** (Art. 5, 6, Anhang I, III, Art. 50): verboten, Hochrisiko Anhang I, Hochrisiko Anhang III (mit Bereich, z. B. «4a»), Transparenz, minimal. Ausnahme Art. 6(3) prüfen und dokumentieren (Art. 6(4)).
4. **Pflichtenmatrix:** Pflichten je Rolle und Klasse mit Frist (Art. 113).
5. **Abdeckung:** je Pflicht G (ganz durch das AIMS abgedeckt), T (teilweise), N (nicht). Ganz abgedeckte Pflichten brauchen kein Zusatz-Control. Jede T- oder N-Pflicht bekommt ein Zusatz-Control oder eine begründete Ablehnung (Prüfregel F25).
6. Tabellen und Projektdatei ausgeben.

## Fragen in Dreiergruppen

**Gruppe 1: Anwendbarkeit**
1. Haben Sie eine Niederlassung oder Kunden in der EU? Beispiel: «Tochter in Stuttgart.»
2. Werden Ergebnisse Ihrer KI-Systeme in der EU genutzt? Beispiel: «HR-Software auch für Bewerbungen der Tochter.»
3. Verkaufen Sie Produkte mit KI in die EU? Beispiel: «Maschinen mit Wartungsprognose.»

**Gruppe 2: Risikoklasse je System**
4. Wird das System in einem dieser Bereiche eingesetzt: Personal, Bildung, Kredit, Versicherung, kritische Infrastruktur, Biometrie, Behörden? Beispiel: «Personal, Vorselektion.»
5. Ist es Sicherheitsbauteil eines CE-pflichtigen Produkts, oder dient es nur Qualität und Effizienz? Beispiel: «Nur Qualitätskontrolle.»
6. Chattet es mit Menschen, erzeugt es Bilder, Texte oder Stimmen für Dritte, oder erkennt es Emotionen? Beispiel: «Chatbot auf der Website.»

**Gruppe 3: Umsetzung**
7. Sind Mitarbeitende und ihre Vertretung über KI am Arbeitsplatz informiert? Beispiel: «Nein.»
8. Wer übt die menschliche Aufsicht aus, und ist die Person geschult? Beispiel: «HR-Leiterin, keine Schulung.»
9. Wie lange werden Protokolle des Systems aufbewahrt? Beispiel: «Unbekannt, beim Anbieter anfragen.»

## Zusatz-Controls EUAIA (Liste, eigene Worte; massgebend ist `euaia-controls.md`, falls vorhanden)

| ID | Bezeichnung | Artikel | Rolle | 42001 | Abd. |
|---|---|---|---|---|---|
| EUAIA-01 | Prüfung auf verbotene Praktiken je KI-System | 5(1), 5(1a) | alle | A.5.2, A.9.2 | T |
| EUAIA-02 | Massnahmen zur KI-Kompetenz | 4(1) | Anb., Betr. | 7.2, 7.3 | T |
| EUAIA-03 | Bestimmung der Rolle je KI-System und Prüfung auf Rollenwechsel | 3, 25(1) | alle | 4.1 | T |
| EUAIA-04 | Bestimmung und Begründung der Risikoklasse je KI-System | 6, 6(4), Anh. I, III | Anb. | A.5.2 | T |
| EUAIA-05 | Hinweis auf Interaktion mit einem KI-System | 50(1), 50(5) | Anb. | A.8.2 | T |
| EUAIA-06 | Maschinenlesbare Kennzeichnung synthetischer Inhalte | 50(2), 111(4) | Anb. | keins | N |
| EUAIA-07 | Offenlegung von Deepfakes, Emotionserkennung und KI-Texten von öffentlichem Interesse | 50(3), 50(4) | Betr. | A.8.2 | T |
| EUAIA-08 | Verwendung gemäss Betriebsanleitung | 26(1), 26(3) | Betr. HR | A.9.4 | T |
| EUAIA-09 | Menschliche Aufsicht durch befähigte Personen | 26(2) | Betr. HR | A.9.3, 7.2 | T |
| EUAIA-10 | Eingabedaten passend und repräsentativ | 26(4) | Betr. HR | A.7.4 | T |
| EUAIA-11 | Überwachung des Betriebs, Information des Anbieters, Aussetzen der Nutzung | 26(5) | Betr. HR | A.6.2.6, A.8.4 | T |
| EUAIA-12 | Aufbewahrung der Protokolle während mindestens sechs Monaten | 26(6), 19 | Betr./Anb. HR | A.6.2.8 | T |
| EUAIA-13 | Vorabinformation von Mitarbeitenden und Arbeitnehmervertretung | 26(7) | Betr. HR | keins | N |
| EUAIA-14 | Information Betroffener über KI-gestützte Entscheide | 26(11) | Betr. HR | A.8.2 | T |
| EUAIA-15 | Bearbeitung von Anfragen zum Recht auf Erläuterung | 86 | Betr. HR | A.8.3 | T |
| EUAIA-16 | Grundrechte-Folgenabschätzung und Mitteilung an die Behörde | 27 | best. Betr. | A.5 | T |
| EUAIA-17 | Datenschutz-Folgenabschätzung mit Anbieterinformationen | 26(9) | Betr. HR | A.5 | T |
| EUAIA-18 | Zusammenarbeit mit Behörden | 21, 26(12) | Anb., Betr. | A.8.5 | T |
| EUAIA-19 | Risikomanagementsystem nach Art. 9 | 9 | Anb. HR | 6.1, 8.2 | T |
| EUAIA-20 | Daten und Daten-Governance nach Art. 10 | 10, 4a | Anb. HR | A.7 | T |
| EUAIA-21 | Technische Dokumentation nach Anhang IV | 11 | Anb. HR | A.6.2.7 | T |
| EUAIA-22 | Automatische Protokollierung | 12 | Anb. HR | A.6.2.8 | T |
| EUAIA-23 | Betriebsanleitung nach Art. 13 | 13 | Anb. HR | A.8.2 | T |
| EUAIA-24 | Menschliche Aufsicht im Design | 14 | Anb. HR | A.6.2.2 | T |
| EUAIA-25 | Genauigkeit, Robustheit und Cybersicherheit | 15 | Anb. HR | A.6.2.4 | T |
| EUAIA-26 | Qualitätsmanagementsystem nach Art. 17 | 17, 63 | Anb. HR | AIMS gesamt | T |
| EUAIA-27 | Aufbewahrung der Dokumentation zehn Jahre | 18 | Anb. HR | 7.5 | T |
| EUAIA-28 | Konformitätsbewertung, EU-Konformitätserklärung, CE-Kennzeichnung und Herstellerangaben | 16, 43, 47, 48 | Anb. HR | keins | N |
| EUAIA-29 | Registrierung in der EU-Datenbank | 49 | Anb., öff. Betr. | keins | N |
| EUAIA-30 | Korrekturmassnahmen und Informationspflicht | 20 | Anb. HR | 10.2 | T |
| EUAIA-31 | Bevollmächtigter in der EU | 22 | Anb. HR Drittstaat | keins | N |
| EUAIA-32 | Beobachtung nach dem Inverkehrbringen | 72 | Anb. HR | A.6.2.6 | T |
| EUAIA-33 | Meldung schwerwiegender Vorfälle | 73 | Anb. HR | A.8.4 | T |
| EUAIA-34 | Barrierefreiheit | 16(l) | Anb. HR | keins | N |
| EUAIA-35 | Vereinbarungen mit Zulieferern und Zusammenarbeit in der Wertschöpfungskette | 25(2), 25(4) | Anb. HR, Zulieferer | A.10.2 | T |
| EUAIA-36 | Einführerpflichten | 23 | Einf. | A.10.3 | T |
| EUAIA-37 | Händlerpflichten | 24 | Händl. | A.10.3 | T |
| EUAIA-38 | Pflichten als Bevollmächtigter | 22(3) | Bev. | keins | N |
| EUAIA-39 | Pflichten für Anbieter von KI-Modellen mit allgemeinem Verwendungszweck (Hinweis) | 53 bis 55 | GPAI-Anb. | keins | N |

HR = Hochrisiko. Für ein typisches KMU als Betreiber ohne Hochrisiko genügen meist EUAIA-01 bis EUAIA-04 und je nach Funktion EUAIA-05 oder EUAIA-07. Betreiber von Hochrisiko-KI (z. B. Bewerbungsvorselektion) brauchen zusätzlich EUAIA-08 bis EUAIA-15, EUAIA-17, EUAIA-18 und EUAIA-33; EUAIA-16 nur in den Fällen von Art. 27.

## Ergebnis

1. **E-01 Rollen:** System | Rolle(n) | Begründung | Rollenwechsel.
2. **E-02 Risikoklassen:** System | Klasse | Anhang/Bereich | Begründung | Ausnahme 6(3) ja/nein | Frist.
3. **E-03 Pflichtenmatrix:** Pflicht (Artikel) | betroffene Systeme | Frist | Abdeckung G/T/N | 42001-Bezug | Zusatz-Control | Status.
4. Zusatz-Controls als SoA-Einträge.
5. Hinweis: «Begründeter Vorschlag nach der konsolidierten Fassung vom 27.07.2026, keine Rechtsberatung. Lassen Sie die Einstufung juristisch prüfen.»

## JSON-Ausschnitt

```json
"controls": [
  { "id": "EUAIA-13", "rahmenwerk": "EUAIA", "anwendbar": "ja", "begruendung": "KI-008 ist Hochrisiko nach Anhang III Nr. 4(a); Information nach Art. 26(7) vor Einsatz nötig, ab 02.12.2027.", "status": "geplant", "verantwortlich": "P-003", "nachweise": [], "umsetzung": "Information der Mitarbeitendenvertretung und der Mitarbeitenden vor Einsatz", "iso27001": [], "kiSysteme": ["KI-008"], "vorschlag": "aiact" }
]
```

Im KI-System: `aiAct.rollen`, `aiAct.risikoklasse`, `aiAct.anhangIiiBereich`, `aiAct.ausnahmeArt63`, `aiAct.transparenz`, `aiAct.begruendung` (mit Artikel und Stand), `aiAct.juristischGeprueft: false`.
