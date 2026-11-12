# Modus 3: KI-Inventar (AI inventory)

## Ziel

Ein vollständiges Verzeichnis aller KI-Systeme (AI systems), auch KI in eingekaufter Software und SaaS (z. B. Microsoft 365 Copilot, CRM, HR-Tools) und Schatten-KI (shadow AI). Ergebnis: Inventarzeilen für **D-10**, ein Erhebungsfragebogen für die Abteilungen und die Projektdatei. Normbezug: ISO/IEC 42001, Abschnitt 4.3 und Anhang A, Controls A.4.2 bis A.4.6 (Ressourcen) und A.9.2 (Freigabe).

Das unvollständige Inventar ist die häufigste Auditfeststellung. Lieber zu viel erfassen und dann begründet ausschliessen.

## Ablauf

1. Gruppe 1: Überblick holen. Die Liste typischer KI unten aktiv abfragen («Nutzen Sie …?»), statt nur offen zu fragen.
2. Gruppe 2 je System (oder für mehrere ähnliche Systeme gemeinsam): Zweck, Daten, Betroffene.
3. Gruppe 3: Schatten-KI aufspüren.
4. Inventartabelle und Projektdatei ausgeben; auf Wunsch den Erhebungsfragebogen für die Abteilungen.
5. Je System eine Eignerin oder einen Eigner vorschlagen (Prüfregel F01) und ein Überprüfungsdatum (in der Regel 12 Monate).
6. Je System, soweit bekannt: generative KI ja/nein (`generativ`), Modell und Version (`modell`), kritisch für den Betrieb mit Rückfallweg, und bei KI, die selbst Mails sendet, bucht oder Daten ändert, die Handlungsbefugnis mit Zugriffen, Gedächtnis und Stoppmöglichkeit (Felder in `json-ausgabe.md`, Prüfregeln H28, H29, H33). Fragen Sie dafür: «Lassen Sie KI selbständig Mails senden, Buchungen auslösen oder Daten ändern?»

## Typische KI, aktiv abfragen

- **Büro und Zusammenarbeit:** Microsoft 365 Copilot, Copilot Chat, Teams-Transkription und Zusammenfassungen, Zoom AI Companion, Google Gemini für Workspace, Notion AI, Miro AI.
- **Chatbots und Assistenten:** ChatGPT (Free, Plus, Team, Enterprise), Claude, Gemini, Perplexity, Mistral Le Chat, DeepSeek; Browser-Erweiterungen.
- **Sprache und Text:** DeepL, Grammarly, Übersetzungsfunktionen in Office.
- **CRM und Vertrieb:** Salesforce Einstein, HubSpot AI, Dynamics 365 Copilot, Lead-Scoring.
- **HR:** KI-Vorselektion und Matching von Bewerbungen, Video-Interview-Auswertung, Chatbots im Bewerbungsprozess, Personaleinsatzplanung (z. B. Funktionen in SuccessFactors, Workday, Personio, Recruiting-Plattformen).
- **Finanzen:** Belegerkennung, automatische Kontierung, Kreditorenprüfung, Betrugserkennung, Abacus- oder Bexio-Funktionen.
- **ERP, Produktion, Logistik:** Disposition, Absatzprognose, vorausschauende Wartung, Bildprüfung, Routenplanung.
- **Entwicklung und IT:** GitHub Copilot, Code-Assistenten, KI im Security-Tool (Spam-, Malware-, Anomalieerkennung).
- **Marketing und Kommunikation:** Bild- und Videogeneratoren (Adobe Firefly, Canva, Midjourney), Texte für Website und Social Media, Website-Chatbot.
- **Kundendienst:** Chatbots, Ticketklassifizierung, Sprachbots.

Abgrenzung: Einfache Regelwerke ohne Lernverfahren sind meist keine KI-Systeme. Im Zweifel erfassen und im Feld `beschreibung` vermerken «Abgrenzung prüfen».

## Fragen in Dreiergruppen

**Gruppe 1: Überblick**
1. Welche KI-Werkzeuge sind offiziell eingeführt? Beispiel: «ChatGPT Team für 15 Personen, Microsoft 365 Copilot für die Geschäftsleitung.»
2. In welcher eingekauften Software sind KI-Funktionen eingeschaltet (CRM, ERP, HR, Buchhaltung)? Beispiel: «Abacus mit Belegerkennung, sonst unklar.»
3. Entwickeln oder trainieren Sie eigene Modelle oder passen Sie Modelle an? Beispiel: «Nein.»

**Gruppe 2: je System**
4. Wofür wird das System genutzt und von wem? Beispiel: «Entwürfe für Mandantenbriefe, alle Sachbearbeitenden.»
5. Welche Daten gehen hinein (Personendaten, besondere Personendaten, Kundendaten, Geschäftsgeheimnisse)? Beispiel: «Mandantennamen und Steuerdaten.»
6. Wer ist von den Ergebnissen betroffen, und entscheidet ein Mensch noch selbst? Beispiel: «Mandanten; jede Ausgabe wird gegengelesen.»

**Gruppe 3: Schatten-KI**
7. Nutzen Mitarbeitende private oder kostenlose KI-Dienste für die Arbeit? Beispiel: «Vermutlich ja, für Übersetzungen.»
8. Welche Quellen können Sie auswerten (Proxy- oder DNS-Protokolle, SaaS-Verwaltung, Kreditkarten- und Spesenabrechnungen, Browser-Erweiterungen)? Beispiel: «Firewall-Protokolle beim IT-Partner.»
9. Sind Sie bereit, eine kurze Umfrage mit Straffreiheit für ehrliche Angaben durchzuführen? Beispiel: «Ja, per Forms.»

## Bewertungshinweise je System

- `typ`: `saas` (Cloud-Dienst mit KI als Hauptzweck oder eingebauter KI), `eingekauft` (lokal installierte oder in Geräte eingebaute KI), `eigenbau` (selbst entwickelt, trainiert oder wesentlich angepasst), `schatten` (nicht freigegebene Nutzung).
- `status`: neu erfasste Systeme `erfasst`; in Abklärung `in-pruefung`; Schatten-KI bis zum Entscheid `in-pruefung` (Hinweis H02: Entscheid innert 30 Tagen) und dann `freigegeben`, `eingeschraenkt` oder `untersagt`.
- `sensibleNutzung: true` bei Wirkung auf Rechte, Chancen, Gesundheit oder Sicherheit von Personen (z. B. Bewerbungen, Kredit, Leistungsbeurteilung); dann ist in Modus 5 eine volle Folgenabschätzung nötig.
- `ressourcen`: kurz je Feld; bei SaaS reichen Anbieterangaben (Modell, Region, Vertragsgrundlage).
- KI in Copilot und ChatGPT: `aiAct.gpai: false`. Das Feld ist nur `true`, wenn die Firma selbst ein KI-Modell mit allgemeinem Verwendungszweck in Verkehr bringt; die Nutzung eines solchen Modells zählt nicht. Die Rolle als Nutzer ist in der Regel Betreiber (Modus 4).

## Ergebnis

**Inventartabelle (D-10):** ID | Name | Typ | Zweck | Fachbereich | Eigner/in | Daten (Personendaten ja/nein, besondere ja/nein) | Betroffene | Automatisierung | Status | sensible Nutzung | nächste Überprüfung.

**Erhebungsfragebogen** (auf Wunsch, zum Verteilen): Abteilung, Name des Werkzeugs, Zweck, Nutzende, Daten, Kosten/Lizenz, seit wann, Bemerkungen; mit Einleitungssatz zum Zweck der Umfrage und zur Straffreiheit.

**Offen:** fehlende Eigner, unklare Abgrenzungen, Abklärungen beim Lieferanten.

## JSON-Ausschnitt

```json
{
  "id": "KI-002",
  "name": "ChatGPT Team",
  "typ": "saas",
  "beschreibung": "Chat-Assistent von OpenAI, Arbeitsbereich mit 15 Lizenzen",
  "zweck": "Texte entwerfen, recherchieren, zusammenfassen",
  "fachbereich": "Treuhand, Steuern",
  "eigner": "P-002",
  "lieferant": "L-001",
  "personendaten": true,
  "besondereDaten": false,
  "betroffene": "Mandanten, Mitarbeitende",
  "automatisierung": "unterstuetzend",
  "lebenszyklus": "betrieb",
  "status": "in-pruefung",
  "ressourcen": { "daten": "Eingaben der Nutzenden, keine Trainingsnutzung laut Vertrag (prüfen)", "werkzeuge": "GPT-Modelle von OpenAI", "rechenressourcen": "Cloud OpenAI, Region zu prüfen", "personal": "Eigner/in, IT-Partner" },
  "sensibleNutzung": false,
  "aiAct": { "rollen": [], "risikoklasse": "offen", "transparenz": [], "gpai": false, "begruendung": "", "juristischGeprueft": false },
  "naechsteUeberpruefung": "2027-10-31",
  "erfasstAm": "2026-10-19"
}
```
