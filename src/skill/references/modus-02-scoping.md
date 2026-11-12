# Modus 2: Scoping-Interview (scoping interview)

## Ziel

Kontext der Organisation (context of the organization), interessierte Parteien (interested parties) mit Anforderungen, Rolle(n) der Organisation und Geltungsbereich (scope) klären. Ergebnis: **D-01** (Kontext, interessierte Parteien, Rollen) und **D-02** (Geltungsbereich und AIMS-Überblick). Normbezug: ISO/IEC 42001, Abschnitte 4.1 bis 4.4; Wortlaut in der eigenen Normausgabe nachlesen.

## Ablauf

1. Gruppen 1 bis 5 nacheinander, je höchstens drei Fragen. Was aus Inventar oder Projektdatei bekannt ist, nicht erneut fragen.
2. Ohne ISMS zusätzlich Gruppe 6 (Grundlagen). Mit ISMS: Kontext und Parteien des ISMS übernehmen und nur KI-spezifisch ergänzen.
3. Aus den Antworten Themen (TH-xxx), Parteien (IP-xxx) mit Entscheid «adressiert ja/nein» und den Geltungsbereich ableiten. Lücken als «Annahme:» füllen.
4. D-01 und D-02 als Markdown nach der Gliederung unten ausgeben, danach die Projektdatei.

## Fragen in Dreiergruppen

**Gruppe 1: Firma**
1. Name, Branche, Anzahl Mitarbeitende und Standorte? Beispiel: «Muster Treuhand AG, Treuhand und Steuerberatung, 40 Personen, Bern und Thun.»
2. Haben Sie Kunden, Niederlassungen oder Nutzung von KI-Ergebnissen in der EU? Beispiel: «Einige Mandanten in Süddeutschland, sonst Schweiz.»
3. Entwickeln oder verkaufen Sie selbst KI oder Produkte mit KI? Beispiel: «Nein, wir nutzen nur eingekaufte Werkzeuge.»

**Gruppe 2: Themen im Umfeld (4.1)**
4. Warum wollen Sie ein KI-Managementsystem: Kundenanforderung, Zertifikat, Gesetz, eigene Ordnung? Beispiel: «Ein Grosskunde fragt im Lieferantenaudit danach.»
5. Welche internen Themen beeinflussen den KI-Einsatz (Know-how, Kultur, Budget, IT-Landschaft)? Beispiel: «Wenig IT-Personal, alles in Microsoft 365.»
6. Spielt der Klimawandel für Ihren KI-Einsatz eine Rolle (z. B. Energiebedarf, Kundenanforderungen zu Nachhaltigkeit)? Beispiel: «Kaum; wir nutzen nur Cloud-Dienste.»

**Gruppe 3: Interessierte Parteien (4.2)**
7. Wer ist von Ihrem KI-Einsatz betroffen oder hat Erwartungen daran (Kunden, Mitarbeitende, Behörden, Lieferanten, Verwaltungsrat)? Beispiel: «Mandanten, Mitarbeitende, Revisionsaufsicht.»
8. Welche Anforderungen stellen diese Parteien (Gesetz, Vertrag, Branchenregeln)? Beispiel: «Berufsgeheimnis, revDSG, Vertraulichkeitsklauseln in Mandatsverträgen.»
9. Welche dieser Anforderungen soll das Managementsystem aufnehmen? Beispiel: «Alle ausser Marketingwünschen.»

**Gruppe 4: Rolle der Organisation (4.1, ISO/IEC 22989)**
10. Nutzen Sie KI nur, oder bieten Sie KI-Leistungen auch anderen an? Beispiel: «Nur Nutzung intern.»
11. Liefern Sie Daten oder Komponenten an KI-Anbieter (Partnerrolle)? Beispiel: «Nein.»
12. Sind Personen ausserhalb der Firma von Ergebnissen Ihrer KI betroffen? Beispiel: «Mandanten über Steuererklärungen, die KI mitformuliert.»

**Gruppe 5: Geltungsbereich (4.3)**
13. Welche Bereiche, Standorte und KI-Systeme sollen hinein? Beispiel: «Ganze Firma, beide Standorte, alle KI-Werkzeuge.»
14. Was soll ausgeschlossen werden und warum? Beispiel: «Die IT-Tochter, weil sie eigenständig ist.»
15. Welche Schnittstellen gibt es zu Dritten (IT-Dienstleister, Cloud, Mutterhaus)? Beispiel: «IT-Partner betreibt Microsoft 365.»

**Gruppe 6 (nur ohne ISMS): Grundlagen**
16. Wer entscheidet in der Geschäftsleitung über das Managementsystem? Beispiel: «Die Geschäftsführerin.»
17. Wo werden Dokumente abgelegt und wie werden Freigaben belegt? Beispiel: «SharePoint, Freigabe per E-Mail.»
18. Gibt es andere Managementsysteme (Qualität ISO 9001, Datenschutz)? Beispiel: «ISO 9001.»

## Ableitungsregeln

- **Rollen nach ISO/IEC 22989** (`rollenIso`): `kunde` (Nutzer eingekaufter KI, AI customer), `anbieter` (stellt KI-Leistungen bereit, AI provider), `produzent` (entwickelt KI, AI producer), `partner` (liefert Daten, Komponenten, Integration), `betroffene` (AI subject), `behoerde`. Mehrere Rollen sind normal. Die Rolle nach EU AI Act (Anbieter, Betreiber) ist davon getrennt (Modus 4).
- **Klimawandel:** immer eine begründete Antwort (`klimawandelRelevant` ja/nein, mit Satz). Das Auditteam fragt danach.
- **Anforderungen:** je Anforderung `adressiert` mit `ja` oder `nein` und kurzer Begründung; «offen» nur vorübergehend.
- **Geltungsbereich:** Organisation, Technik (KI-Systeme, Plattformen), Standorte, Schnittstellen, Ausschlüsse mit Begründung. Ausschlüsse dürfen die Fähigkeit nicht untergraben, die Anforderungen zu erfüllen (z. B. kein Ausschluss der Abteilung, die das riskanteste System nutzt).

## Ergebnis: Gliederung der Dokumente

**D-01 Kontext, interessierte Parteien und Rollen**
1. Zweck des Dokuments
2. Externe Themen (Tabelle: ID, Kategorie, Thema, Auswirkung)
3. Interne Themen (Tabelle wie oben)
4. Klimawandel (Entscheid und Begründung)
5. Zweck der KI-Systeme und Rolle(n) der Organisation
6. Interessierte Parteien und Anforderungen (Tabelle: ID, Partei, Anforderung, Quelle, adressiert ja/nein, Begründung)
7. Überprüfung (Rhythmus, Auslöser) und Freigabe

**D-02 Geltungsbereich und AIMS-Überblick**
1. Geltungsbereich in einem Satz (für das Zertifikat)
2. Organisatorische Grenzen
3. Technische Grenzen (KI-Systeme mit Verweis auf D-10)
4. Standorte
5. Schnittstellen und Abhängigkeiten
6. Ausschlüsse mit Begründung
7. AIMS-Überblick: Prozesse und ihr Zusammenwirken (Tabelle Prozess, Zweck, Verantwortlich, Vorlage)
8. Freigabe

## JSON-Ausschnitt

```json
"organisation": {
  "name": "Muster Treuhand AG",
  "branche": "Treuhand",
  "mitarbeitende": 40,
  "standorte": "Bern, Thun",
  "euBezug": { "kundenEu": true, "outputEu": false, "niederlassungEu": false },
  "entwickeltKi": false,
  "verkauftKiProdukte": false,
  "kontext": {
    "themen": [
      { "id": "TH-001", "art": "extern", "kategorie": "recht", "beschreibung": "Berufsgeheimnis und revDSG bei Mandatsdaten in KI-Diensten", "auswirkung": "Nur freigegebene Dienste mit Vertrag zur Auftragsbearbeitung" }
    ],
    "klimawandelRelevant": "nein",
    "klimawandelBegruendung": "Nur Cloud-Nutzung in geringem Umfang; keine Kundenanforderungen dazu."
  },
  "rollenIso": [ { "rolle": "kunde", "bemerkung": "Nutzt eingekaufte KI-Dienste" } ],
  "geltungsbereich": {
    "beschreibung": "Nutzung von KI-Systemen in allen Geschäftsprozessen der Muster Treuhand AG an den Standorten Bern und Thun.",
    "grenzenOrganisation": "Ganze Firma",
    "grenzenTechnik": "Alle KI-Systeme gemäss KI-Inventar D-10",
    "grenzenStandorte": "Bern, Thun",
    "schnittstellen": "IT-Partner betreibt Microsoft 365",
    "ausschluesse": []
  }
}
```

```json
"parteien": [
  { "id": "IP-001", "name": "Mandanten", "art": "extern", "anforderungen": [ { "text": "Vertraulichkeit der Mandatsdaten", "quelle": "vertrag", "adressiert": "ja", "begruendung": "Kern des Geschäfts" } ] }
]
```
