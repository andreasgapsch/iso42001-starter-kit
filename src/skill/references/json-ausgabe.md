# Projektdatei (project file) ausgeben und einlesen

Die Projektdatei (`*.aims.json`) ist das gemeinsame Format von AIMS-Manager, Dokumentengenerator und diesem Skill. Das formale Schema steht in `projektdatei-schema.json` (JSON Schema, aus dem Datenmodell des Werkzeugs erzeugt). Diese Seite fasst das Wichtigste zusammen.

## Grundregeln

1. **Neue Projekte: immer die ganze Datei.** Alle Wurzelfelder müssen vorhanden sein; leere Listen als `[]`. **Eingelesene Projekte:** Bei grossen Dateien (z. B. über 50 Einträge) genügt ein **Auszug**: `schemaVersion`, `kitVersion`, `meta` unverändert (vor allem `meta.projektId`) und nur die Listen oder Bereiche, die Sie geändert haben, mit **vollständigen** Einträgen (ganze Objekte, nicht nur geänderte Felder). Der AIMS-Manager erkennt den Auszug an der Projekt-ID, zeigt je ID «neu» oder «geändert» und übernimmt nur, was die Person anhakt. Sagen Sie dazu, dass es ein Auszug ist.
2. **Nur bekannte Felder.** Das Schema erlaubt keine zusätzlichen Felder (`additionalProperties: false`). Was nicht ins Modell passt, gehört in ein Textfeld (z. B. `beschreibung`, `begruendung`, `bemerkung`) oder in `meta.gefuehrt.antworten`.
3. **Gültiges JSON.** Doppelte Anführungszeichen, keine Kommentare, keine Auslassungen («...»), kein Komma nach dem letzten Element, `true`/`false`/`null` klein.
4. **Erlaubte Werte genau übernehmen** (Kleinschreibung, Bindestriche wie unten).
5. **Nur ergänzen, nie bestehende IDs ändern.** Bei einer eingelesenen Datei bleiben alle Einträge und IDs unverändert. Neue Einträge erhalten die nächste Nummer über dem Zähler `meta.idZaehler.<liste>` und über der höchsten vorhandenen Nummer (nach `KI-007` folgt `KI-008`, auch wenn `KI-003` fehlt; steht `"kiSysteme": 9` im Zähler, folgt `KI-010`). Gelöschte IDs werden nie neu vergeben. Den Zähler je neu vergebener ID auf deren Nummer setzen, nie senken. Löschen nur auf ausdrücklichen Wunsch und dann auch alle Verweise auf den Eintrag entfernen.
6. **Projekt-ID und Erstellungsdatum** (`meta.projektId`, `meta.erstellt`) einer eingelesenen Datei nie ändern. Neue Datei: neue UUID erzeugen.
7. **Datum** `JJJJ-MM-TT`, Zeitstempel ISO 8601 (`2026-10-19T09:00:00Z`). `meta.geaendert` bei jeder Ausgabe aktualisieren.
8. **Verweise per ID.** Personen (`P-001`) in `eigner`, `verantwortlich`, `freigabe.von`; Controls in `risiken[].controls`; Massnahmen in `risiken[].massnahmen`. Jede verwendete Personen-ID muss in `personen` stehen. Ist der Name unbekannt, legen Sie eine Person mit `"name": "[[Name]]"` und passender Funktion an.
9. **Keine Katalogtexte.** Normkapitel und Control-Texte stehen nicht in der Datei, nur IDs. Keine Hinweise auf das Kit oder seinen Autor.
10. **Unbekannt bleibt leer.** Leere Zeichenkette `""`, `null` bei Zahlen (`mitarbeitende`, `w`, `a`), `"offen"` bei Ja/Nein/Offen-Feldern, optionale Felder weglassen.

## ID-Präfixe

| Liste | Präfix | Beispiel |
|---|---|---|
| personen | P | P-001 |
| parteien (interessierte Parteien, interested parties) | IP | IP-001 |
| rollen (RACI) | RO | RO-001 |
| organisation.kontext.themen (issues) | TH | TH-001 |
| kiSysteme | KI | KI-001 |
| risiken (Risiken und Chancen) | R | R-001 |
| folgenabschaetzungen (AI system impact assessment) | IA | IA-001 |
| eigeneControls | EC | EC-01 |
| nachweise (evidence) | N | N-001 |
| massnahmen (actions) | M | M-001 |
| lieferanten | L | L-001 |
| ziele (objectives) | Z | Z-001 |
| kompetenzen | K | K-001 |
| kommunikation | KO | KO-001 |
| audits | AU | AU-001 |
| feststellungen (findings) | F | F-001 |
| managementbewertungen | MB | MB-001 |

Controls: `A.2.2` bis `A.10.4` (ISO/IEC 42001 Anhang A, `rahmenwerk: "ISO42001"`), `27001-5.23` (`"ISO27001"`), `EUAIA-07` (`"EUAIA"`), `RMF-09` und `RMF-G01` (`"NISTRMF"`, nur mit Modul NIST AI RMF), `EC-01` (`"EIGENE"`). Dokumente: `D-00` bis `D-27`, `D-xx-EB`, `E-01` bis `E-09`, `N-01` bis `N-04`. Prozesse (Katalog des Werkzeugs): `PR-01` bis `PR-27` (AIMS) und `PS-01` bis `PS-11` (Basisprozesse der Informationssicherheit), Schritte `PR-08.03`; eigene Prozesse der Firma `PE-01`, `PE-02` usw.

## Minimalbeispiel (gültig, leeres Projekt mit einem KI-System)

```json
{
  "schemaVersion": 3,
  "kitVersion": "{{version}}",
  "meta": {
    "projektId": "3f6c2a9e-8b1d-4e7a-9c55-0d2f7b41a6e3",
    "erstellt": "2026-10-19T09:00:00Z",
    "geaendert": "2026-10-19T09:00:00Z",
    "dokumentSprache": "de",
    "mitIsms": false,
    "ismsZertifiziert": false,
    "modulAiAct": false,
    "gefuehrt": { "aktuelleEtappe": "E0", "etappen": {}, "antworten": {} },
    "checklisten": {},
    "idZaehler": { "personen": 1, "kiSysteme": 1 }
  },
  "organisation": {
    "name": "Muster Treuhand AG",
    "branche": "Treuhand",
    "mitarbeitende": 40,
    "standorte": "Bern",
    "euBezug": { "kundenEu": false, "outputEu": false, "niederlassungEu": false },
    "entwickeltKi": false,
    "verkauftKiProdukte": false,
    "kontext": { "themen": [], "klimawandelRelevant": "offen", "klimawandelBegruendung": "" },
    "rollenIso": [],
    "geltungsbereich": { "beschreibung": "", "grenzenOrganisation": "", "grenzenTechnik": "", "grenzenStandorte": "", "schnittstellen": "", "ausschluesse": [] },
    "leitlinie": { "version": "", "grundsaetze": [], "ausnahmeprozess": "" },
    "risikokriterien": { "zeitraum": "", "wahrscheinlichkeit": [], "auswirkung": [], "akzeptanzBis": 4, "unannehmbarAb": 12, "ausIsmsUebernommen": false }
  },
  "personen": [
    { "id": "P-001", "name": "[[Name]]", "funktion": "Geschäftsleitung", "aimsRollen": ["aims-verantwortung"] }
  ],
  "parteien": [],
  "rollen": [],
  "kiSysteme": [
    {
      "id": "KI-001",
      "name": "Microsoft 365 Copilot",
      "typ": "saas",
      "beschreibung": "KI-Assistent in Word, Outlook, Teams",
      "zweck": "Texte entwerfen, zusammenfassen",
      "fachbereich": "alle",
      "eigner": "P-001",
      "personendaten": true,
      "besondereDaten": false,
      "betroffene": "Mitarbeitende, Kundschaft (Daten in Mandaten)",
      "automatisierung": "unterstuetzend",
      "lebenszyklus": "betrieb",
      "status": "in-pruefung",
      "ressourcen": { "daten": "Dokumente und E-Mails im Tenant", "werkzeuge": "Microsoft 365 Copilot", "rechenressourcen": "Microsoft Cloud, Region Schweiz/EU zu prüfen", "personal": "IT-Verantwortliche" },
      "sensibleNutzung": false,
      "aiAct": { "rollen": ["betreiber"], "risikoklasse": "offen", "transparenz": [], "gpai": false, "begruendung": "Annahme: Nutzung unter eigener Verantwortung, kein eigenes Angebot.", "juristischGeprueft": false }
    }
  ],
  "risiken": [],
  "folgenabschaetzungen": [],
  "controls": [],
  "eigeneControls": [],
  "nachweise": [],
  "dokumente": [],
  "massnahmen": [],
  "lieferanten": [],
  "ziele": [],
  "kompetenzen": [],
  "kommunikation": [],
  "audits": [],
  "feststellungen": [],
  "managementbewertungen": []
}
```

## Felder je Objekt (Pflichtfelder fett, optionale kursiv)

Werte in Klammern sind die einzig erlaubten.

**meta:** *modulNistRmf* (bool, optional: Modul NIST AI RMF eingeschaltet; fehlt = aus), **projektId** (UUID; bei neuer Datei eine neue zufällige UUID im Format 8-4-4-4-12 Hexziffern erzeugen, bei eingelesener Datei unverändert übernehmen), **erstellt**, **geaendert**, **dokumentSprache** (`de`, `en`), **mitIsms** (bool), **ismsZertifiziert** (bool), **modulAiAct** (bool), **gefuehrt** `{ aktuelleEtappe: "E0", etappen: {}, antworten: {} }`, **checklisten** `{}`. In `gefuehrt.antworten` dürfen beliebige Schlüssel stehen (z. B. `"schnellcheck"`), aber nur Arbeitsstand ohne eigenes Feld: Meldeweg, Meldekanal, Projektauftrag, Gap-Analyse, Dokumentenlenkung und Abgleich der Leitlinie gehören in ihre Felder (unten); in `gefuehrt.etappen` je Schlüssel `{ "status": "offen" | "in-arbeit" | "erledigt", "spaeter": [] }`; in `checklisten` je Schlüssel `{ "erledigt": bool, "nachweis"?: "", "datum"?: "" }`.

**organisation:** **name**, **branche**, **mitarbeitende** (Zahl oder null), **standorte**, **euBezug** `{ kundenEu, outputEu, niederlassungEu }` (bool), **entwickeltKi**, **verkauftKiProdukte** (bool), *zielterminZertifizierung*, *zielterminStage1*, *aimsVerantwortlich* (P-ID), **kontext** `{ themen: Thema[], klimawandelRelevant: ja|nein|offen, klimawandelBegruendung }`, **rollenIso** `[{ rolle: anbieter|produzent|kunde|partner|betroffene|behoerde, bemerkung }]`, **geltungsbereich** `{ beschreibung, grenzenOrganisation, grenzenTechnik, grenzenStandorte, schnittstellen, ausschluesse: [{ was, begruendung }], freigabe? }`, **leitlinie** `{ version, grundsaetze: [], ausnahmeprozess, freigabe?, kommuniziertAm?, naechsteUeberpruefung? }`, **risikokriterien** `{ zeitraum, wahrscheinlichkeit: [{ stufe, bezeichnung, beschreibung }], auswirkung: [{ stufe, bezeichnung, beschreibung }], akzeptanzBis, unannehmbarAb, ausIsmsUebernommen }`. *gestaltung* und *logoDataUrl* nicht setzen (siehe unten).

Optional in **organisation** (nur setzen, wenn bekannt; sonst weglassen):
- *meldeweg* (D-04) `{ kanaele: [vorgesetzte|aims|whistleblowing|postfach|formular], kanal?, ausweichstelle? (P-ID), vertraulich? (bool), fristTage? (erste Rückmeldung), fristErgebnisTage?, eskalation?, bekanntmachung? }`
- *meldekanalExtern* (D-14) `{ adresse, ort?, bearbeitung? (P-ID), fristTage? (Eingangsbestätigung, Arbeitstage), fristAntwortTage?, vorfallVerfahren?, fristKundenStunden? (späteste Information betroffener Kunden bei einem KI-Vorfall, Stunden) }`
- *meldestelle* (Text für Richtlinien, z. B. `"AIMS-Verantwortliche (ki-meldung@firma.example)"`)
- *gremien* `[{ name, themen, rhythmus, vorsitz? (P-ID) }]`
- *projektauftrag* (D-00) `{ ziel?, nutzen?, aufwandPt?, budget? (externe Kosten), pensumProzent?, sponsor? (P-ID), meilensteine?: [{ was, termin? }], risiken?, freigabe?, glTraktandum? (monatlich|quartalsweise|halbjaehrlich|jaehrlich) }`
- *dokumentenlenkung* (D-26) `{ ismsRegelnGelten?, ablage?, namensregel?, freigabe? (geschaeftsleitung|eigner|aims), aufbewahrungJahre?, klassifikation? (Standard für die Fusszeile, z. B. "intern"), extern? }`
- *oeffentlicheDienste* (bool, nur mit Modul: öffentliche Stelle oder private Erbringerin öffentlicher Dienste, Art. 27)
- in *geltungsbereich*: *keineAusschluesseBestaetigt* (bool); in *leitlinie*: *abgleich* `{ informationssicherheit|datenschutz|qualitaet|personal|beschaffung|verhaltenskodex|nachhaltigkeit: angepasst|verweis|keine|nicht-vorhanden }`, *abgleichNotiz*.

**Thema** (organisation.kontext.themen): **id** (TH-001), **art** (`extern`, `intern`), **kategorie** (frei, z. B. recht, regulierung, markt, kultur, governance, vertrag, zweck, klima), **beschreibung**, *auswirkung*.

**freigabe** (überall gleich): `{ "von": "P-001", "am": "2026-10-19" }`.

**personen:** **id**, **name**, **funktion**, **aimsRollen** (Liste freier Kürzel).

**parteien:** **id**, **name**, **art** (`intern`, `extern`), **anforderungen** `[{ text, quelle: gesetz|vertrag|norm|intern|markt, adressiert: ja|nein|offen, begruendung? }]`.

**rollen:** **id**, **bereich** (`konformitaet`, `berichterstattung`, `risikomanagement`, `folgenabschaetzung`, `inventar`, `daten`, `informationssicherheit`, `datenschutz`, `lieferanten`, `menschliche-aufsicht`, `recht`, `schulung`, `vorfall`, `entwicklung`, `internes-audit`, `dokumentenlenkung`), *verantwortlich*, *rechenschaft*, *stellvertretung* (je genau eine P-ID als Text, keine Liste), **konsultiert**, **informiert** (Listen von P-IDs). Beispiel: `{ "id": "RO-001", "bereich": "konformitaet", "verantwortlich": "P-002", "rechenschaft": "P-001", "konsultiert": [], "informiert": [] }`.

**kiSysteme:** **id**, **name**, **typ** (`eingekauft`, `saas`, `eigenbau`, `schatten`), **beschreibung**, **zweck**, **fachbereich**, *eigner*, *lieferant* (L-ID), **personendaten**, **besondereDaten** (bool), **betroffene**, **automatisierung** (`unterstuetzend`, `teilautomatisiert`, `vollautomatisiert`), **lebenszyklus** (`idee`, `entwicklung`, `test`, `betrieb`, `ausserbetrieb`), **status** (`erfasst`, `in-pruefung`, `freigegeben`, `eingeschraenkt`, `abgeloest`, `untersagt`), **ressourcen** `{ daten, werkzeuge, rechenressourcen, personal }`, **sensibleNutzung** (bool), **aiAct** `{ rollen: [anbieter|betreiber|einfuehrer|haendler|produkthersteller|bevollmaechtigter], risikoklasse: offen|verboten|hochrisiko-anhang-iii|hochrisiko-anhang-i|transparenz|minimal, anhangIiiBereich?, ausnahmeArt63?, transparenz: ["50-1"|"50-2"|"50-3"|"50-4"], gpai: bool, begruendung, juristischGeprueft: bool }`, *naechsteUeberpruefung*, *erfasstAm*, *geaendertAm*, *freigabe* (Freigabe zur Nutzung), *protokollierung* (was, wo, wie lange), *nutzerinformation* (wie Nutzende und Betroffene informiert werden, z. B. Hinweistext). **gpai** ist nur `true`, wenn die Organisation selbst ein KI-Modell mit allgemeinem Verwendungszweck in Verkehr bringt; Copilot, ChatGPT oder ein eigener Chatbot auf einem fremden Modell: `false`. Ohne Modul: `risikoklasse: "offen"` lassen, Rolle trotzdem eintragen, wenn Modus 4 gelaufen ist (sonst `rollen: []`).

**risiken:** **id**, **art** (`risiko`, `chance`), **titel**, **beschreibung**, *kiSystem* (KI-ID), **quelle**, **ebenen** (`organisation`, `individuen`, `gesellschaft`), **ursache**, **folge**, **bestehendeMassnahmen**, **w**, **a**, **wNach**, **aNach** (Zahl oder null), *behandlung* (`vermeiden`, `vermindern`, `teilen`, `tragen`, `nutzen`), **controls** (Control-IDs), **massnahmen** (M-IDs), *eigner*, *restrisikoAkzeptiert* (freigabe), *ismsRisiko*, **status** (`offen`, `in-behandlung`, `behandelt`, `akzeptiert`, `geschlossen`).

**folgenabschaetzungen:** **id**, **kiSystem**, **triage** `{ rechtspositionOderChancen, gesundheitOderSicherheit, verletzlicheGruppen, besondereDaten, automatisierteEntscheidung, grosseReichweite (bool), ergebnis: kurz|voll|offen, begruendung }`, **systembeschreibung**, **verwendungen**, **fehlanwendungen**, **daten**, **einsatzumfeld**, **betroffene** `[{ gruppe, art: direkt|indirekt, wirkung, konsultiert: bool }]`, **nutzenSchaden** (Objekt, Schlüssel nur aus `rechenschaft`, `transparenz`, `fairness`, `datenschutz`, `zuverlaessigkeit`, `sicherheit`, `erklaerbarkeit`, `umwelt`, je `{ nutzen, schaden }`), **ausfaelle**, **massnahmen** (Text), **sensibleNutzung**, **eingeschraenkteNutzung** (bool), **ergebnis**, *verknuepfteDsfa*, *freigabe*, *naechsteUeberpruefung*, *gesellschaft* (Auswirkungen über die Betroffenen hinaus), *fria* `{ erforderlich: ja|nein|offen, begruendung, ref?, durch?, am?, behoerde?, mitgeteiltAm? }` (nur mit Modul). In **triage** zusätzlich *durch* (P-ID) und *am* (Datum).

**controls** (SoA-Einträge): **id**, **rahmenwerk** (`ISO42001`, `ISO27001`, `EUAIA`, `EIGENE`, `NISTRMF`), **anwendbar** (`ja`, `nein`, `offen`), **begruendung**, **status** (`offen`, `geplant`, `teilweise`, `umgesetzt`, `wirksam`), *verantwortlich*, **nachweise** (N-IDs), **umsetzung**, **iso27001** (Liste wie `["27001-5.23"]`), **kiSysteme** (leer = alle), *vorschlag* (`risiko`, `aiact`, `nistrmf`), *wirksamkeit* `{ wie?, wann?, wer? (P-ID oder Funktion), ergebnis? }` (Spalte «Wirksamkeit geprüft» in D-11; `status: "wirksam"` erst, wenn ausgefüllt; Prüfregel H35).

**eigeneControls:** **id** (EC-01), **titel**, **beschreibung**, **quelle**.

**nachweise:** **id**, **titel**, **art** (`dokument`, `aufzeichnung`, `protokoll`, `vertrag`, `schulung`, `sonstiges`), **ablageort**, *datum*.

**dokumente:** **id** (D-xx, mit ISMS D-xx-EB), **version**, **status** (`entwurf`, `in-pruefung`, `freigegeben`, `veraltet`), *eigner*, *freigabe*, *naechsteUeberpruefung*, **ablageort**, **giltFuerIsms** (bool), *klassifikation* (z. B. `"intern"`), *aufbewahrung* (z. B. `"10 Jahre nach Ersatz"`), *aufgenommenIn* (Ergänzungsblätter und Dokumente, die ein ISMS-Dokument erweitern: bestehendes ISMS-Dokument mit Kennung und Version). Je Dokument nur ein Eintrag: im Pfad mit ISMS den Risikobehandlungsplan als `D-07-EB` führen, nicht zusätzlich `D-07`.

**massnahmen:** **id**, **titel**, **beschreibung**, *verantwortlich*, *nachweise* (N-xxx oder Dokument-ID), *termin*, **status** (`offen`, `in-arbeit`, `erledigt`, `verworfen`), **prioritaet** (`hoch`, `mittel`, `tief`), **herkunft** `{ art: risiko|audit|managementbewertung|pruefung|checkliste|aiact|ziel|aenderung|prozess|sonstige, ref? }` (`aenderung`: geplante Änderung am AIMS; `prozess`: Massnahme zu einem Prozess, `ref` = Prozess-ID wie `PR-14`), *start*, *erledigtAm*.

**lieferanten:** **id**, **name**, **leistung**, **pruefstatus** (`offen`, `in-pruefung`, `geprueft`, `mit-auflagen`, `abgelehnt`), **pruefpunkte** (Objekt mit den Schlüsseln `PF-01` bis `PF-27` der Prüffragen in D-16, Werte `ja`/`nein`/`offen`; keine anderen Schlüssel; PF-16 bis PF-21 betreffen generative KI und Lieferkette: manipulierte Eingaben, Berechtigungen bei der Suche, Erweiterungen und Aktionen, Kosten, Darstellung von Antworten, Modell und Version; PF-22 bis PF-27: Werkzeugserver und Konnektoren, Identität von Agenten, Einsicht des Anbieters in Inhalte, Zwischenspeicher und Gedächtnis, Notstopp und Entzug der Rechte, Nutzungsbedingungen und Lizenzschranken), **bemerkung**, *naechstePruefung*, *vertragsklauseln* (Objekt mit `VK-01` bis `VK-19`, Werte `ja`/`nein`/`offen`/`nicht-noetig`), *verantwortung* (Abweichung von der Verantwortungsaufteilung in D-16).

**ziele:** **id**, **ziel**, **kennzahl**, **sollwert**, **messmethode**, **haeufigkeit**, *verantwortlich*, **ressourcen**, *termin*, **bewertung**, **messungen** `[{ datum, wert, sollErreicht?: ja|teilweise|nein, bemerkung? }]`, *bezugLeitlinie*, *massnahmen* (Text: was getan wird), *status* (`geplant`, `in-arbeit`, `erreicht`, `nicht-erreicht`, `verworfen`), *werMisst*, *werWertetAus* (P-IDs), *auswertungWann*, *empfaenger*, *kiSysteme* (KI-IDs, für die die Kennzahl gilt; leer = alle; Prüfregel H34).

**kompetenzen:** **id**, **rolle**, **anforderung**, **personen** (P-IDs), **massnahme**, **nachweis**, **wirksamkeit**, **status** (`offen`, `teilweise`, `erfuellt`).

**kommunikation:** **id**, **was**, **wann**, *wer*, **mitWem**, **wie**, **richtung** (`intern`, `extern`).

**audits:** **id**, **art** (`intern`, `extern-stage1`, `extern-stage2`, `ueberwachung`), **kombiniertMitIsms** (bool), *geplant*, *durchgefuehrt*, **umfang**, **kriterien**, **auditor**, **unabhaengigkeit**, **ergebnis**, *ziel*, *ort*, *methode*, *berichtAn*, *umfangControls* (Control-IDs, leer = alle anwendbaren), *umfangProzesse* (Prozess-IDs wie `PR-08` oder `PE-01`, leer = alle; D-20 nennt sie im Auditprogramm, Hinweis H63, wenn ein Pflichtprozess in keinem internen Audit der letzten drei Jahre und keinem geplanten im Umfang ist), *auditierte*, *agenda*.

**feststellungen:** **id**, *audit* (AU-ID), **quelle** (`audit`, `managementbewertung`, `vorfall`, `beinahe-vorfall`, `pruefung`, `meldung`), *schwere* (1 gering, 2 mittel, 3 erheblich, 4 schwer; Schweregrad nach D-14 bei Vorfällen und Beinahe-Vorfällen), **einstufung** (`nk-schwer`, `nk-leicht`, `beobachtung`, `verbesserung`), **beschreibung**, **normbezug**, **korrektur**, **ursache**, **massnahmen** (M-IDs), *wirksamkeit* `{ am, ergebnis }`, **status** (`offen`, `in-arbeit`, `geschlossen`), *datum*, *kiSystem* (KI-ID), *bereich*, *ursacheMethode* (z. B. `"5 Warum"`), *aehnlicheFaelle*, *risikoAngepasst* (bool).

**managementbewertungen:** **id**, *datum*, **kombiniertMitIsms**, **teilnehmende**, **eingaben** `{ statusMassnahmen, aenderungenThemen, aenderungenParteien, leistung, verbesserungen, weitere }`, **entscheide**, **massnahmen** (M-IDs), *ort*, *leitung* (P-ID), *zeitraum* `{ von, bis }`, *gesamtbeurteilung* `{ geeignet?, angemessen?, wirksam? }` je `{ urteil: ja|nein|offen, begruendung }`, *entscheideListe* `[{ art: verbesserung|aenderung|ressourcen|ziele|restrisiko, text, verantwortlich?, termin?, massnahme? }]`.

**prozesse** (optional, Wurzelfeld; Stand der Prozesse aus dem Prozesskatalog, Status-Dashboard, D-02 und D-27): nur setzen, wenn die Firma ihre Prozesse führt. Mit dem Feld (auch als leere Liste `[]`) prüft das Werkzeug die Prozessregeln F31, F32, H55 bis H63 und erzeugt die Prozessbeschreibungen D-27. Je Eintrag: **id** (`PR-01` bis `PR-27`, `PS-01` bis `PS-11` oder ein eigener Prozess aus *eigeneProzesse*), *anwendbar* (`ja`, `nein`, `offen`; `nein` nur bei Control- und bedingten Prozessen und nur mit *begruendung*; Pflichtprozesse PR-01 bis PR-05, PR-08 bis PR-10, PR-21 bis PR-27 nie `nein`), *eigner*, *stellvertretung* (P-IDs), *reife* (Zahl `0` nicht begonnen, `1` definiert, `2` eingeführt, `3` wirksam, `4` überprüft; nur so hoch, wie Nachweise es tragen: ab `2` Durchführung oder Nachweis, ab `3` Kennzahl mit Messwert der letzten zwölf Monate, `4` internes Audit und Managementbewertung der letzten zwölf Monate), *reifeAm*, *rhythmus* (`vierzehntaeglich`, `monatlich`, `quartalsweise`, `halbjaehrlich`, `jaehrlich`; leer = Vorschlag des Katalogs), *letzteDurchfuehrung* und *naechsteFaelligkeit* (Datum, nur von Hand Bekanntes; das Werkzeug leitet die letzte Durchführung sonst aus den Projektdaten ab), *kennzahl* (`Z-001` oder `KZ-01`), *nachweise* (N-IDs), *ismsVerweis* (mit ISMS: Fundstelle im ISMS, z. B. `"ISMS-Handbuch, Prozess IS-07"`), *notiz*. Die Felder *schritte*, *bahnen* und *drawio* (eigener Ablauf, Daten aus draw.io) setzt nur das Werkzeug; nicht ausgeben. Beispiel: `{ "id": "PR-08", "eigner": "P-002", "reife": 2, "kennzahl": "Z-003" }`. **eigeneProzesse** (optional, Wurzelfeld): Prozesse der Firma, die der Katalog nicht abdeckt. Je Eintrag **id** (`PE-01`, `PE-02` …, fortlaufend), **titel** (höchstens 160 Zeichen), *zweck*, **gruppe** (`fuehrung`, `kern`, `unterstuetzung`, `bewertung`), **art** (`gemeinsam`, `gemeinsam-ki`, `nur-aims`, `nur-isms`), *normbezug* (Nummern von ISO/IEC 42001 wie `["8.1", "A.6.2.6"]`, kein Normtext). Stand (Eigner, Reife) dazu als Eintrag in **prozesse** mit derselben ID; den Ablauf (Schritte, Bahnen) baut die Firma im Werkzeug. Nur vorschlagen, wenn die Firma den Ablauf ausdrücklich nennt. In **managementbewertungen** optional *eingaben.prozesse* (Text zum Stand der Prozesse) und *prozesse* `[{ id, reife }]` (eingefrorener Stand zum Datum der Bewertung).

**Weitere optionale Felder (nur setzen, wenn bekannt):**

- In **kiSysteme**: *handlungsbefugnis* (`informiert`, `empfiehlt`, `bereitet-vor`, `fuehrt-begrenzt-aus`, `handelt-mehrstufig`; ab `fuehrt-begrenzt-aus` gilt das System als handelnde KI: Stoppmöglichkeit, Protokolle und Aufsicht nötig, Prüfregel H28), *zugriffe* (Systeme, Schnittstellen, Konnektoren, Werkzeuge), *gedaechtnis* (bool), *stoppmoeglichkeit* (wie und durch wen), *aufgabenart* (`erzeugt-inhalte`, `klassifiziert`, `prognostiziert`, `empfiehlt`, `steuert`), *generativ* (bool), *modell* `{ anbieter?, name?, version? }` (H33), *kritisch* (bool) und *rueckfallweg* (H29), *abhaengigkeiten*, *fremdeInhalte* (bool: liest Mails, Webseiten oder Dokumente Dritter), *oeffentlich* (bool: von aussen erreichbar), *missbrauchsfaelle* (Anzahl, Beispiele, Ergebnis und Datum der Prüfung vor dem Einsatz; H32), *aufsicht* (wer prüft Ergebnisse und darf eingreifen), *einsatzentscheid* `{ nutzen?, alternativeOhneKi?, wiedervorlage? }` (H31), *ausserbetrieb* `{ ausloeser?, schritteErledigt?, am? }` und *aufbewahrenBis* (H30).
- In **organisation**: *risikobereitschaft* `{ nie?: [], nurGl?: [], aimsAllein?: [] }` (D-03: was nie erlaubt ist, was nur mit Freigabe der Geschäftsleitung geht, was die oder der AIMS-Verantwortliche ohne Geschäftsleitung entscheidet, bei tiefem Risiko allein, bei mittlerem mit der Eignerin oder dem Eigner des Systems; je Eintrag ein kurzer Satz), *entscheidungsrechte* `[{ entscheid: einfuehren|restrisiko|ausnahme|stoppen|ausserbetrieb, wer: { tief?, mittel?, hoch? } }]` (D-04; `wer` als P-ID oder Funktion), *nichtGemessen* `[{ was, begruendung }]` (D-05).
- In **folgenabschaetzungen**: *mitgewirkt* (P-IDs oder Funktionen, z. B. `["P-004", "Datenschutz"]`).

**Dienst, Tarif und Abkündigung (alle optional; nur setzen, wenn belegt):**

- In **kiSysteme**: *tarif* (`gratis`, `privat`, `business`, `enterprise`, `eigenbetrieb`: Angebot oder Vertragsart des Dienstes; die Zusagen zu Training und Aufbewahrung hängen daran; vertrauliche Datenklasse mit `gratis` oder `privat` ist Fehler F30), *funktionen* (Objekt mit den Schlüsseln `websuche`, `codeausfuehrung`, `dateiupload`, `gedaechtnis`, `konnektoren`, `agenten`, `teilen`, Werte `an` oder `aus`; fehlender Schlüssel heisst ungeklärt, nie vorbelegen), *abkuendigung* (Datum der Abkündigung oder Abschaltung durch den Anbieter; H53 meldet überschrittene Daten und solche innert 90 Tagen), *quelleAngaben* `{ fundstelle?, abgerufen? }` (Fundstelle beim Hersteller oder Anbieter und Abrufdatum; keine Angaben aus Sammlungen Dritter).
- Prüfregeln: F30 (Datenklasse und Tarif), H50 (fremde Inhalte, vertrauliche Daten und Handeln ohne Bestätigung zusammen), H51 (handelnde KI mit Auswirkung aller Risiken auf der tiefsten Stufe), H52 (OWASP-Kennung ohne Jahr oder aus älterer Liste, AI-Act-Artikel 29 oder 52 im Sinn der Entwurfsfassung in Freitexten), H53 (Abkündigung).

**Bestätigung, Nachträge und Prüfstand (alle optional):**

- In **dokumente**: *bestaetigt* (freigabe-Objekt: Überprüfung ohne neue Version, z. B. in der Managementbewertung; nicht vor der Freigabe; Verweise auf bis dahin freigegebene Dokumente erscheinen ohne «in Erarbeitung»).
- In **feststellungen**: *erfasstAm* (nur wenn später als *datum*, z. B. nachgetragener Vorfall; die Kennung gilt ab diesem Datum).
- In **risiken**: *beurteiltAm* (letzte Beurteilung, nach jeder Änderung oder jedem Nachtraining des Systems; Prüfregel H49) und *erfasstAm* (Aufnahme ins Register).
- In **audits**: *zertifikatAm* (Zertifikat erteilt, bei Stage 2) und in *checkliste* je Control *soaStand* (Status in der SoA zur Zeit des Audits: `offen`, `geplant`, `teilweise`, `umgesetzt`, `wirksam`).
- In **organisation**: *naechsthoehereStelle* (z. B. `"Verwaltungsrat"`, `"Gesellschafterversammlung"`: entscheidet, wenn die Geschäftsleitung selbst betroffen ist; D-04).

**Ab Schemaversion 3 (alle optional):**

- In **kiSysteme**: *antragAm* und *entscheidAm* (Datum `JJJJ-MM-TT` des Antrags und des Entscheids über Freigabe, Auflagen oder Ablehnung; Freigabeliste D-10, Datenquelle der Kennzahl PR-07). Erfassung im Inventar und Freigabe ersetzen sie nicht (Prüfregel F43).
- In **feststellungen**: *entdecktAm* und *eingedaemmtAm* bei Vorfällen und Beinahe-Vorfällen, als Zeitpunkt mit Uhrzeit `JJJJ-MM-TTThh:mm` (Register D-22, Datenquelle der Kennzahl PR-19). Nur echte Zeitpunkte eintragen, nie aus dem Datum ergänzen.
- Folgenabschätzungen prüft das Werkzeug inhaltlich (F44 bis F47): je Ziel eigener Text in *nutzenSchaden*, *ausmass* (Schaden vor Massnahmen) gleich der Auswirkung `a` vor der Behandlung des genannten Risikos (`R-xxx`) im Register, Entscheid nach der Schwelle aus D-08 (Ausmass vor Massnahmen ab der hohen Stufe nur mit *eingeschraenkteNutzung* und Auflagen) und *sensibleNutzung* des Systems gleich der jüngsten Abschätzung.

**Nur mit Modul NIST AI RMF** (`meta.modulNistRmf: true`; Details in `modus-12-nist-rmf.md`):

- **nistProfil** (oberste Ebene, Objekt): Schlüssel = Subkategorie (`GV-1.1` bis `MG-4.3`), Wert `{ ist?: 0..3, ziel?: 0..3, prioritaet?, massnahmen?: [M-IDs], notiz? }`. Nur Subkategorien eintragen, zu denen etwas festgelegt ist; ohne `ist` leitet das Werkzeug die Stufe ab.
- In **kiSysteme**: *messkonzept* `{ merkmale?: [gueltig|sicher|geschuetzt|rechenschaft|erklaerbar|datenschutz|fair], zielkonflikte?, pruefungen?: [{ merkmal, prueffaelle?, messgroesse?, schwelle?, haeufigkeit?, nichtMessbar?, ergebnis? }], unabhaengig?: { wer?, wann?, ergebnis? } }` (N-03), *genaiBewertung* (nur bei `generativ: true`; Objekt mit den 12 Schlüsseln `gai-cbrn`, `gai-konfabulation`, `gai-gefaehrlich`, `gai-datenschutz`, `gai-umwelt`, `gai-verzerrung`, `gai-mensch-ki`, `gai-integritaet`, `gai-sicherheit`, `gai-schutzrechte`, `gai-anstoessig`, `gai-lieferkette`, je `{ relevant: ja|nein|offen, begruendung?, massnahme? }`; N-04).

**gapAnalyse** (optional, auf oberster Ebene neben `managementbewertungen`): `{ datum?, kapitel?: { k4, k5, k6, inventar, k7, k8, k9, k10: fehlt|begonnen|weitgehend|erfuellt }, abschnitte?: { "K-4.1": { ist?: 0..5, soll?: 0..5, beschreibung? } }, controls?: { "A.2.2": { … } } }`. Soll-Reife leer lassen, wenn nicht festgelegt.

**bibliothek** (optional, Wurzelfeld; nur das Werkzeug legt Dateien ab): Verweise und Metadaten der Bibliothek. Dateiinhalte stehen nie in der Projektdatei; die Dateien liegen im verbundenen Ordner (Edge, Chrome) oder im Browserspeicher, Layout `bibliothek.json`, `Firmendokumente/<Kennung>_<Titel>/v<Version>.<Endung>`, `Nachweise/…`, `Eigene/…`. Felder: *ablage* (`ordner`, `browser`), *ordnerName*, *gesichertAm* (letzte Sicherung als ZIP), *abgleich* `{ am, geaendert?, fehlend?, nichtLokal? }` (Kennungen aus dem letzten Abgleich), **eintraege**. Je Eintrag: **id** (Firmendokument wie im Dokumentenregister `D-07`, `D-07-EB`, `D-09-KI-001`; Nachweis `N-001`; eigene Datei `X-001`), **art** (`firmendokument`, `eigene`, `nachweis`, `vorlage`, `rechtstext`), *titel* (eigene Dateien; Firmendokumente und Nachweise nehmen den Titel aus Katalog bzw. **nachweise**), *status* (`entwurf`, `in-pruefung`, `freigegeben`, `ersetzt`, `archiviert`; nur ohne Versionen oder `archiviert` für den ganzen Eintrag), **versionen** (älteste zuerst; je Version **version**, **datei** (Pfad im Ordner), *name*, **groesse**, **pruefsumme** (SHA-256, 64 Hex-Zeichen), **datum** (ISO mit Zeit), *geaendert*, *autor*, *status*, *geprueft*, *freigabe*, *aenderung*, *quelle* (`generator`, `hochgeladen`, `eingecheckt`, `ordner`), *basis*, *ueberschrieben*), *eigner* und *naechstePruefung* (nur bei Einträgen ohne Registereintrag; sonst gelten **dokumente**), *normbezug* (Nummern), *verknuepfungen* `{ kiSysteme?, risiken?, controls?, prozesse?, nachweise? }` (IDs), *beschreibung*, *nachweisArt*. Für Firmendokumente mit Eintrag in **dokumente** und für Nachweise bleiben diese Register die Quelle von Version, Status, Eigner und Freigabe. **Der Skill legt keine Bibliothek an** und gibt keine Versionen aus (Prüfsummen und Pfade entstehen nur im Werkzeug); eine vorhandene `bibliothek` beim Ergänzen unverändert übernehmen. Prüfregeln H76 bis H80 (Prüfung überfällig, Freigabe ohne Angaben, Datei ausserhalb geändert, Datei fehlt, Browserspeicher ohne Sicherung) prüft das Werkzeug.

## Einlesen (import)

1. Prüfen Sie `schemaVersion`. Aktuell ist 3; die Versionen 1 und 2 sind ebenfalls lesbar (Version 1 fehlt `meta.idZaehler`, Version 2 fehlen Antrag, Entscheid, Entdeckung und Eindämmung; das Werkzeug ergänzt beim Öffnen, was sich aus der Datei ableiten lässt). Geben Sie eine ergänzte Datei mit `"schemaVersion": 3` aus und legen Sie `meta.idZaehler` mit der höchsten Nummer je Liste an. Ist die Version höher als 3, sagen Sie, dass Sie die Datei nur lesend nutzen, und geben Sie keine neue Datei aus.
2. Übernehmen Sie Pfad (`meta.mitIsms`), Module (`meta.modulAiAct`, `meta.modulNistRmf`) und Dokumentsprache, ohne erneut zu fragen.
3. Fassen Sie den Stand zusammen und nennen Sie Lücken (z. B. KI-System ohne Eigner/in, ohne Risiko, Control ohne Begründung). Die Prüfregeln des Werkzeugs (F01 bis F32, H01 bis H80; F27 bis F29 und H36 bis H41 nur mit Modul NIST AI RMF) geben die Richtung vor.
4. Ergänzen Sie nur. Ausgegeben wird die ganze Datei mit allen alten Einträgen oder, bei grossen Dateien, ein Auszug nach Grundregel 1.

## Typische Fehler vermeiden

- `typ: "SaaS"` statt `"saas"`, `status: "aktiv"` (gibt es nicht), `automatisierung: "unterstützend"` (ohne Umlaut: `"unterstuetzend"`).
- Felder erfinden wie `risikowert`, `kategorie` an KI-Systemen oder `notizen`.
- Personen-ID verwenden, ohne die Person in `personen` anzulegen.
- Auszug ohne `meta.projektId` oder mit unvollständigen Einträgen ausgeben; bei neuen Projekten einen Auszug statt der ganzen Datei.

**organisation.gestaltung** (optional, ab 1.1, nur das Werkzeug setzt sie): Erscheinungsbild der Firmendokumente. Felder: *logo* `{ png (data:image/png;base64, höchstens 200 KB), breite, hoehe, svg?, art?, alt?, quelle? }`, *kopfzeile* `{ logoPosition: links|rechts, firmennameZeigen, logoHoeheMm (6 bis 15) }`, *farben* `{ primaer, sekundaer, akzent (Hex RRGGBB ohne #, Grossbuchstaben), ueberschriften, tabellenkopf, diagramme, tabellenkopfKraeftig }`, *schrift* `{ paar: arial-cambria|arial|calibri|aptos|georgia|verdana|eigen, titel?, text?, installiertBestaetigt? }`, *kurzname* (höchstens 30), *fusszeileZusatz* (eine Zeile, höchstens 160), *titelseite* `keine|grundlagen|alle`, *wasserzeichenEntwurf* (bool), *kennungPraefix* (`[A-Za-z0-9._-]`, höchstens 12), *kennungPraefixDateien* (bool, Präfix auch vor die Dateinamen). Hinweise H64 (Logo für dunklen Grund) und H65 (Primärfarbe korrigiert) prüfen nur das Werkzeug. **Der Skill setzt keine Gestaltung**: Ein Logo als Base64 durch ein Sprachmodell ist fehleranfällig und gross. Das Werkzeug übernimmt `gestaltung` und `logoDataUrl` nie aus einem KI-Ergebnis und überschreibt die vorhandene Gestaltung nicht. Nennt die Firma CI-Farben (z. B. aus dem CI-Handbuch), den Hex-Wert im Text nennen; übernehmen tut ihn die Firma im Werkzeug unter Einstellungen › Dokumentgestaltung.
