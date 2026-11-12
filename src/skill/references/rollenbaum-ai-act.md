# Rollenbaum EU AI Act (role decision tree)

Stand: konsolidierte Fassung der Verordnung (EU) 2024/1689 vom **27.07.2026** (inkl. Änderungsverordnung (EU) 2026/1744 und Berichtigung vom 29.09.2026). Artikelangaben beziehen sich auf diese Fassung. Jede Einstufung ist ein begründeter Vorschlag und keine Rechtsberatung; empfehlen Sie die **juristische Prüfung**, besonders bei Hochrisiko, Rollenwechsel und Grenzfällen.

Wichtig: ISO/IEC 42001 begründet **keine** Konformitätsvermutung nach dem AI Act. Das AIMS hilft, Pflichten organisiert zu erfüllen, ersetzt sie aber nicht.

## Schritt 0: Ist es ein KI-System?

KI-System im Sinne von Art. 3(1): maschinengestütztes System, das mit einem gewissen Grad an Autonomie aus Eingaben ableitet, wie es Ausgaben wie Vorhersagen, Inhalte, Empfehlungen oder Entscheidungen erzeugt. Reine Regelwerke, die nur von Menschen festgelegte Regeln ausführen, fallen meist nicht darunter. Im Zweifel: ja, und vermerken.

## Schritt 1: Räumlicher Anwendungsbereich (Art. 2(1))

Der AI Act erfasst unter anderem:
- Anbieter, die KI-Systeme in der EU in Verkehr bringen oder in Betrieb nehmen, egal wo sie sitzen (Art. 2(1)(a));
- Betreiber mit Sitz oder Standort in der EU (Art. 2(1)(b));
- Anbieter und Betreiber in Drittstaaten (z. B. Schweiz), wenn die **Ausgabe des KI-Systems in der EU verwendet** wird (Art. 2(1)(c)).

Ausnahmen (Auswahl): rein private, nicht berufliche Nutzung (Art. 2(10)); Forschung und Entwicklung vor dem Inverkehrbringen (Art. 2(8)); Militär und nationale Sicherheit (Art. 2(3)).

## Schritt 2: Rolle je System bestimmen (Art. 3)

```
Haben Sie das System entwickelt oder entwickeln lassen und bringen es
unter eigenem Namen oder eigener Marke in Verkehr / nehmen es in Betrieb
(auch für den Eigengebrauch)?
  ja  -> ANBIETER (provider, Art. 3(3))
  nein
   |
Nutzen Sie das System in eigener Verantwortung beruflich?
  ja  -> BETREIBER (deployer, Art. 3(4))
   |
Bringen Sie ein System eines Anbieters aus einem Drittstaat erstmals in der EU in Verkehr?
  ja  -> EINFÜHRER (importer, Art. 3(6), Pflichten Art. 23)
   |
Stellen Sie ein System auf dem EU-Markt bereit, ohne Anbieter oder Einführer zu sein?
  ja  -> HÄNDLER (distributor, Art. 3(7), Pflichten Art. 24)
   |
Bauen Sie das KI-System als Teil Ihres Produkts (Anhang I) unter eigenem Namen ein?
  ja  -> PRODUKTHERSTELLER (Art. 25(3)), gilt als Anbieter des Hochrisiko-Systems
   |
Handeln Sie im Auftrag eines Anbieters aus einem Drittstaat?
  ja  -> BEVOLLMÄCHTIGTER (authorised representative, Art. 3(5), Art. 22)
```

Eine Firma kann je System eine andere Rolle haben und für ein System mehrere Rollen.

**Faustregeln für KMU:**
- ChatGPT, Copilot, DeepL, KI im CRM oder HR-Tool, intern genutzt: **Betreiber**.
- Chatbot auf der eigenen Website, mit eingekauftem Modell, unter eigenem Namen: in der Regel **Anbieter** des Chatbots (Transparenzpflicht Art. 50(1)), zugleich Betreiber.
- Eigenes Modell oder eigene KI-Funktion im verkauften Produkt: **Anbieter** (bzw. Produkthersteller).
- Eigenes Modell nur für die eigene Fertigung: **Anbieter** durch Inbetriebnahme für den Eigengebrauch und zugleich Betreiber. Pflichten hängen von der Risikoklasse ab.

## Schritt 3: Rollenwechsel nach Art. 25(1)

Ein Betreiber, Händler, Einführer oder Dritter **gilt als Anbieter eines Hochrisiko-KI-Systems** (mit den Pflichten nach Art. 16), wenn er:
- (a) seinen Namen oder seine Marke auf ein bereits in Verkehr gebrachtes Hochrisiko-System setzt (vertragliche Aufteilung bleibt möglich);
- (b) ein Hochrisiko-System **wesentlich ändert** (substantial modification), so dass es hochriskant bleibt;
- (c) die **Zweckbestimmung** (intended purpose) eines Systems, auch eines Systems mit allgemeinem Verwendungszweck, so ändert, dass es hochriskant wird.

Der ursprüngliche Anbieter muss dann mit dem neuen Anbieter zusammenarbeiten (Art. 25(2)). Beispiele: ein HR-Team nutzt einen allgemeinen Chatbot gezielt zur Rangierung von Bewerbungen (Zweckänderung in Richtung Anhang III Nr. 4); ein nachtrainiertes Prüfmodell eines Lieferanten wird unter eigenem Namen an Kunden verkauft.

Wichtig: Art. 25(1) betrifft **Hochrisiko**-Systeme. Wer ein nicht hochriskantes System anpasst, wird dadurch nicht nach 25(1) zum Anbieter, kann aber aus Schritt 2 schon Anbieter sein.

## Schritt 4: Risikoklasse (nur mit Modul vertiefen)

1. **Verboten** (Art. 5): z. B. manipulative Techniken, Ausnutzen von Schwächen, Social Scoring, Emotionserkennung am Arbeitsplatz und in Bildungseinrichtungen (ausser medizinisch oder sicherheitsbedingt), ungezieltes Auslesen von Gesichtsbildern. Neu ab **02.12.2026**: Art. 5(1)(ba) (nicht einvernehmliche intime Bilder realer Personen) und (bb) (Material sexuellen Kindesmissbrauchs). Verbotene Praktiken: sofort einstellen, juristisch prüfen (Prüfregel F24).
2. **Hochrisiko nach Art. 6(1) und Anhang I:** KI als Sicherheitsbauteil eines Produkts nach Anhang I mit Konformitätsbewertung durch Dritte (oder selbst ein solches Produkt). **Art. 6(1a):** KI nur für Nutzerunterstützung, Leistungsoptimierung, Effizienz, Automatisierung, Benutzerfreundlichkeit oder **Qualitätskontrolle** ohne Sicherheitsbezug ist kein Sicherheitsbauteil. **Art. 6(1b):** Gefährdet ein Ausfall Gesundheit und Sicherheit, ist es doch ein Sicherheitsbauteil. Maschinen (VO (EU) 2023/1230) stehen neu in Anhang I Abschnitt B; KI-Anforderungen kommen dort über die Maschinenverordnung, voraussichtlich ab 02.08.2028.
3. **Hochrisiko nach Art. 6(2) und Anhang III:** z. B. Nr. 4 Beschäftigung (Auswahl und Filterung von Bewerbungen, Beförderung, Kündigung, Leistungsüberwachung), Nr. 5(b) Kreditwürdigkeit, Nr. 5(c) Lebens- und Krankenversicherung, Nr. 3 Bildung, Nr. 1 Biometrie, Nr. 2 kritische Infrastruktur.
   - **Ausnahme Art. 6(3):** kein Hochrisiko, wenn kein erhebliches Risiko besteht, weil das System nur eine eng gefasste Verfahrensaufgabe erfüllt, ein bereits abgeschlossenes menschliches Ergebnis verbessert, Entscheidungsmuster erkennt ohne die menschliche Bewertung zu ersetzen, oder nur eine vorbereitende Aufgabe erfüllt. **Profiling** natürlicher Personen ist immer hochriskant.
   - Wer als Anbieter die Ausnahme nutzt, dokumentiert die Einschätzung (Art. 6(4)) und registriert (Art. 49(2)).
4. **Transparenz** (Art. 50): Chatbots und Interaktion mit Menschen (50(1), Anbieter), maschinenlesbare Kennzeichnung erzeugter Inhalte (50(2), Anbieter), Emotionserkennung und biometrische Kategorisierung (50(3), Betreiber), Deepfakes und KI-Texte zu Themen öffentlichen Interesses (50(4), Betreiber).
5. **Minimal:** alles übrige; es gelten Art. 4 (KI-Kompetenz) und freiwillige Verhaltenskodizes.

Modell mit allgemeinem Verwendungszweck (GPAI, Art. 51 ff.): Pflichten für dessen Anbieter (Art. 53 bis 55). KMU, die solche Modelle nur nutzen, sind nicht GPAI-Anbieter.

## Pflichten in Kürze (Kernartikel)

- **Alle:** Art. 4 KI-Kompetenz (Massnahmen ergreifen, kein garantiertes Niveau; seit 02.02.2025), Art. 5 Verbote, Art. 50 je nach Funktion.
- **Anbieter Hochrisiko:** Art. 8 bis 15, 16, 17 (QMS, für KMU vereinfacht, Art. 63), 18 bis 22, 43, 47 bis 49, 72, 73.
- **Betreiber Hochrisiko:** Art. 26 (u. a. Nutzung nach Betriebsanleitung 26(1), menschliche Aufsicht 26(2), Eingabedaten 26(4), Überwachung 26(5), Protokolle mindestens 6 Monate 26(6), Information der Arbeitnehmenden 26(7), Information Betroffener 26(11)), Art. 27 (Grundrechte-Folgenabschätzung nur für öffentliche Stellen, Private mit öffentlichen Diensten, Kredit Anhang III 5(b) und Versicherung 5(c)), Art. 86 (Recht auf Erläuterung).
- **Einführer** Art. 23, **Händler** Art. 24, **Bevollmächtigter** Art. 22.

## Fristen (Art. 113, Stand 27.07.2026)

| Was | ab |
|---|---|
| Kapitel I und II (Art. 4, Art. 5) | 02.02.2025 |
| neue Verbote Art. 5(1)(ba), (bb) | 02.12.2026 |
| GPAI-Pflichten, Governance, Sanktionen | 02.08.2025 |
| allgemeiner Geltungsbeginn, u. a. Art. 50 | 02.08.2026 (Altsysteme Art. 50(2) bis 02.12.2026) |
| Hochrisiko nach Anhang III | **02.12.2027** |
| Hochrisiko nach Anhang I | **02.08.2028** |

Art. 43, 47 bis 49, 72 und 73 gelten formell ab 02.08.2026, greifen praktisch aber erst mit den Hochrisiko-Pflichten. Das ist eine Auslegung; so kennzeichnen.

## Schweizer Blick

- Die Schweiz übernimmt den AI Act nicht. Schweizer Firmen sind erfasst, wenn sie KI-Systeme in der EU in Verkehr bringen oder in Betrieb nehmen (Art. 2(1)(a)) oder wenn die **Ausgabe in der EU verwendet** wird (Art. 2(1)(c)), etwa über EU-Kunden oder eine EU-Niederlassung (dort Betreiber nach 2(1)(b)).
- Rein schweizerische Betreiber ohne EU-Bezug sind nicht erfasst.
- Anbieter von Hochrisiko-KI aus der Schweiz brauchen einen **Bevollmächtigten in der EU** (Art. 22).
- Schweiz selbst (Stand November 2026): Der Bundesrat will die KI-Konvention des Europarats ratifizieren und Gesetze möglichst sektorbezogen anpassen; das EJPD soll die Vernehmlassungsvorlage bis Ende 2026 dem Bundesrat vorlegen (Stellungnahme des Bundesrats vom 20.05.2026 zur Interpellation 26.3414; die Vorlage soll grundsätzlich auch Pflichten für Private vorsehen, wo Grundrechte zwischen Privaten wirken), das KMU-Portal des Bundes erwartet sie im Frühjahr 2027 (kmu.admin.ch, 23.09.2026), die Vernehmlassung ist am 07.11.2026 nicht eröffnet; kein eigenes KI-Gesetz. In der Schweiz gelten heute vor allem revDSG, Arbeitsrecht, Produktehaftung und Branchenregeln.

## Ausgabe je System

Je System eine Zeile: ID | System | Rolle(n) | Begründung (ein bis zwei Sätze mit Artikel) | Risikoklasse (nur mit Modul, sonst «offen») | Rollenwechsel möglich? | juristische Prüfung empfohlen ja/nein. Darunter immer: «Diese Einstufung ist ein begründeter Vorschlag nach der konsolidierten Fassung vom 27.07.2026 und keine Rechtsberatung. Lassen Sie sie juristisch prüfen.»
