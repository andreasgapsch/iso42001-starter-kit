# Modus 4: Rolle zuerst (role first)

## Ziel

Für jedes KI-System festhalten, welche Rolle die Firma nach EU AI Act einnimmt (Anbieter/provider, Betreiber/deployer, Einführer, Händler, Produkthersteller, Bevollmächtigter), mit Begründung und dem Hinweis auf juristische Prüfung. Die Rolle bestimmt, welche Pflichten und welche Controls zählen. Ergebnis: Tabelle für **D-24** (Rolle zuerst) und, mit Modul, **E-01**. Normbezug: ISO/IEC 42001, Abschnitt 4.1 (Rolle der Organisation); AI Act Art. 3 und 25 (Stand 27.07.2026).

Dieser Modus läuft auch **ohne** AI-Act-Modul: Die Rolle gehört zum Kontext jeder Firma. Mit Modul folgt Modus 11 (Risikoklasse, Pflichten, Abdeckung). Ohne Modul bleibt die Risikoklasse `offen`; nur bei einem klaren Hinweis auf Hochrisiko oder Verbot (z. B. Bewerbungsvorselektion) weisen Sie darauf hin und fragen einmal, ob das Modul eingeschaltet werden soll.

## Ablauf

1. Inventar übernehmen (Modus 3 oder Projektdatei). Fehlt es, kurz die Systeme abfragen.
2. Je System den Rollenbaum in `rollenbaum-ai-act.md` durchgehen (Schritte 0 bis 3). Fragen nur, was für die Entscheidung fehlt.
3. Rollenwechsel nach Art. 25(1) prüfen: eigener Name, wesentliche Änderung, neue Zweckbestimmung bei Hochrisiko.
4. Räumlichen Bezug prüfen (Art. 2(1), Schweizer Blick): EU-Kunden, EU-Niederlassung, Ausgabe in der EU genutzt?
5. Tabelle ausgeben, darunter den Hinweis zur juristischen Prüfung, danach die Projektdatei.

## Fragen in Dreiergruppen

**Gruppe 1: Herkunft und Name**
1. Wer hat das System entwickelt, und unter wessen Namen läuft es (Ihr Name oder der des Lieferanten)? Beispiel: «Lieferant, aber im Kundenportal unter unserem Namen.»
2. Haben Sie das System angepasst, nachtrainiert oder mit eigenen Daten erweitert? Beispiel: «Mit unseren Bildern nachtrainiert.»
3. Nutzen Sie es nur intern, oder steht es Kunden oder Dritten zur Verfügung? Beispiel: «Nur intern in der Fertigung.»

**Gruppe 2: Zweck und Wirkung**
4. Wofür genau wird es eingesetzt, auch abweichend von dem, was der Lieferant vorsieht? Beispiel: «Der Chatbot sortiert auch Bewerbungen vor.»
5. Hat das Ergebnis Einfluss auf Rechte, Chancen, Gesundheit oder Sicherheit von Personen? Beispiel: «Ja, abgelehnte Bewerbungen sieht niemand mehr an.»
6. Ist es Teil eines Produkts mit CE-Kennzeichnung (z. B. Maschine, Medizinprodukt)? Beispiel: «Nein, nur Qualitätskontrolle in der eigenen Produktion.»

**Gruppe 3: EU-Bezug**
7. Haben Sie Kunden oder eine Niederlassung in der EU? Beispiel: «Tochter in Deutschland.»
8. Werden Ergebnisse des Systems in der EU verwendet? Beispiel: «Die Tochter nutzt dieselbe HR-Software.»
9. Verkaufen oder liefern Sie das System oder ein Produkt damit in die EU? Beispiel: «Nein.»

## Entscheidungshilfen

- Reine Nutzung eingekaufter Werkzeuge (ChatGPT Team, M365 Copilot, DeepL) in eigener Verantwortung: **Betreiber**; meist minimales Risiko, Art. 4 (KI-Kompetenz) gilt. Wird die Ausgabe nicht in der EU genutzt und hat die Firma keinen EU-Sitz, ist der AI Act nicht anwendbar; ISO/IEC 42001 gilt trotzdem.
- Eigenes Modell, auch nur für den Eigengebrauch: **Anbieter** (Inbetriebnahme für den Eigengebrauch) und Betreiber. Bei Qualitätskontrolle ohne Sicherheitsbezug kein Sicherheitsbauteil (Art. 6(1a)); Grenzfall Art. 6(1b) dokumentieren.
- KI-Vorselektion von Bewerbungen: Anhang III Nr. 4(a), in der Regel **Hochrisiko**; Firma meist **Betreiber** (Art. 26, Information der Arbeitnehmenden 26(7), Information Betroffener 26(11), Recht auf Erläuterung Art. 86). Rollenwechsel zum Anbieter, wenn ein allgemeines Werkzeug erst durch die Firma für diesen Zweck eingesetzt wird (Art. 25(1)(c)) oder unter eigenem Namen angeboten wird. Pflichten ab 02.12.2027.
- Website-Chatbot unter eigenem Namen: **Anbieter** nach Art. 50(1) (Hinweis auf KI-Interaktion) und Betreiber.

## Ergebnis

Tabelle: ID | System | Rolle(n) | Begründung mit Artikel | Rollenwechsel (Art. 25(1)) | EU-Bezug | Risikoklasse (ohne Modul «offen») | juristische Prüfung empfohlen.

Darunter immer der Satz: «Diese Einstufung ist ein begründeter Vorschlag nach der konsolidierten Fassung des AI Act vom 27.07.2026 und keine Rechtsberatung. Lassen Sie sie juristisch prüfen.» (EN: "This classification is a reasoned proposal based on the consolidated AI Act of 27.07.2026, not legal advice. Have it checked by a legal expert.")

Für D-24 zusätzlich: «Was ISO/IEC 42001 nachweist und was nicht»: Ein Zertifikat belegt ein funktionierendes Managementsystem, nicht die Erfüllung des AI Act und keine Konformitätsvermutung.

## JSON-Ausschnitt

```json
"aiAct": {
  "rollen": ["betreiber"],
  "risikoklasse": "hochrisiko-anhang-iii",
  "anhangIiiBereich": "4a",
  "transparenz": [],
  "gpai": false,
  "begruendung": "Betreiber nach Art. 3(4): eingekaufte HR-Software, Vorselektion von Bewerbungen fällt unter Anhang III Nr. 4(a). Die Ausnahme nach Art. 6(3) greift nicht, weil die Vorselektion das Ergebnis wesentlich beeinflusst und Bewerbende profiliert. Pflichten Art. 26 ab 02.12.2027. Stand 27.07.2026.",
  "juristischGeprueft": false
}
```

Ohne Modul: `"risikoklasse": "offen"`, Rolle und Begründung trotzdem eintragen. Organisation: `rollenIso` ergänzen (z. B. `kunde` für Nutzer eingekaufter KI, `anbieter` oder `produzent` bei Eigenentwicklung).
