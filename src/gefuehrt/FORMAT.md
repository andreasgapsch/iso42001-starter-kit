# Format des Guides

Der Guide ist regelbasiert und offline. Struktur in `src/gefuehrt/*.yaml`, Texte in `src/i18n/<sprache>/gefuehrt.yaml` bzw. `src/i18n/<sprache>/gefuehrt/<etappe>.yaml`.

## etappen.yaml

```yaml
etappen:
  - id: E2                      # E0 bis E13, J (Jahreskalender)
    norm: "4.1 bis 4.4"         # Normabschnitte zum Nachlesen
    vorlagen: [D-01, D-02]      # Ergebnisdokumente (Live-Vorschau, Erzeugung)
    leitfaden: 2                # Schritt im Leitfaden (1 bis 10)
    dauer_h: { mit_isms: 3, ohne_isms: 6 }   # Richtwert Stunden
    beteiligte: [gl, aims, it]  # Schlüssel in i18n gefuehrt.beteiligte
    wenn: { modul: true }       # optional: nur unter Bedingung
    seiten: [E2-themen, E2-klima, ...]
    checkliste: [E2-c1, E2-c2, { id: E2-c3, wenn: { mitIsms: true } }]  # Einträge zum Abhaken, Texte in i18n
```

Checklisteneinträge sind eine ID oder ein Objekt `{ id, wenn }`, wenn der Eintrag nur unter einer Bedingung gilt. Das Werkzeug speichert den Stand in `meta.checklisten.<id>` mit `erledigt`, `nachweis` (Ablageort oder Nachweis) und `datum`.

### Abschnitt `fahrplan`

Grundlage der Seite vom Typ `fahrplan` (E0-fahrplan). Sie rechnet vom Ziel Stage-1-Bereitschaft (`organisation.zielterminStage1`) rückwärts: Die letzte Woche des Plans ist die Woche des Ziels.

```yaml
fahrplan:
  wochen: { mit_isms: 13, ohne_isms: 22 }      # Länge des Plans je Pfad (Leitfaden Kapitel 4)
  erweitert: { wochen: 26, pt: [45, 55] }      # mit ISMS bei erweitertem Umfang: Plan gestreckt (rund 6 Monate)
  anteilAims: 0.6                              # Anteil der Personentage bei der AIMS-Verantwortlichen
  schritte: [{ nr, wochen: { mit_isms: [von, bis], ohne_isms: [...] }, pt: { ... } }]   # gleich wie src/leitfaden/schritte.yaml
  meilensteine: [{ id, wochen: { mit_isms: 4, ohne_isms: 8 } }]                        # fehlt ein Pfad, gilt der Meilenstein dort nicht
  freigaben: [{ id, wochen: { ... }, vorlagen: { mit_isms: [D-00], ohne_isms: [D-00, D-26] } }]   # Freigabekalender der Geschäftsleitung
  module: { nistRmf: { pt: [3, 5] } }          # Zuschlag in Personentagen je eingeschaltetem Modul (Richtwert, in der Summe enthalten)
```

Die Schritte stimmen mit `src/leitfaden/schritte.yaml` überein (Test in `tests/unit/gefuehrt.test.ts`). Erweiterter Umfang heisst: mehr als eine Eigenentwicklung, `organisation.verkauftKiProdukte` oder ein Hochrisiko-System. Die PT-Prüfung rechnet ab der Freigabe des Projektauftrags (sonst ab heute) bis zum Ziel mit fünf Arbeitstagen je Woche und `organisation.projektauftrag.pensumProzent`; sie meldet «knapp» unter dem oberen und «reicht nicht» unter dem unteren Richtwert für die AIMS-Verantwortliche. Texte unter `app.fahrplan.meilensteine.<id>` und `app.fahrplan.freigaben.<id>`.

## seiten/<etappe>.yaml

```yaml
seiten:
  - id: E2-themen
    typ: formular               # siehe Seitentypen
    norm: "4.1"
    vorlage: D-01               # passende Kit-Vorlage
    leitfaden: 2
    aiact: ["art-2"]            # optional: Sprunglinks ins beigelegte PDF (Schlüssel aus artikel-seiten.json)
    nist: [merkmale, messen]    # optional, Modul NIST AI RMF: Originaltexte auf der Seite (merkmale, messen, risiken) und
                                # Sprunglinks in die NIST-PDFs (zusätzlich kern, massnahmen), siehe NistZitat.tsx
    wenn: { mitIsms: false }    # optional
    felder:
      - pfad: organisation.kontext.klimawandelRelevant   # Punktpfad in der Projektdatei
        typ: auswahl            # siehe Feldtypen
        optionen: jaNeinOffen   # Optionsgruppe aus src/gefuehrt/optionen.yaml
        pflicht: true
    # typ liste: wiederholbarer Block über eine Projektliste
    liste: kiSysteme            # Projektliste, neue Einträge mit fortlaufender ID (ID_PRAEFIX)
    beispiel: kiSysteme[0]      # Pfad im Beispielprojekt Muster Maschinenbau AG für «als Vorlage übernehmen»
```

Jede Seite ausser `info`, `fahrplan`, `kalender` und `gestaltung` hat einen `beispiel`-Pfad. Bei Formularen zeigt er auf das Objekt, das die Felder enthält; bei Eintragsseiten auf einen typischen Eintrag.

### Seitentypen

| Typ | Zweck | Feldpfade |
|---|---|---|
| `info` | Einführung oder Erklärung ohne Eingabe. Einführungsseiten zeigen zusätzlich Ziel, Warum, Normabschnitt, Dauer, Beteiligte und Ergebnis aus der Etappe. | keine |
| `formular` | Eine Frage oder kleine Gruppe | absolut ab Projektwurzel |
| `liste` | Wiederholbarer Block über eine Projektliste (`liste`) | relativ zum Eintrag |
| `auswahl-systeme` | Dieselben Felder für jedes KI-System im Inventar, als Tabelle oder Karte je System | relativ zum Eintrag in `kiSysteme` |
| `folgenabschaetzung` | Abschnitt der Folgenabschätzung je KI-System; das Werkzeug legt je System einen Eintrag in `folgenabschaetzungen` an | relativ zum Eintrag in `folgenabschaetzungen` |
| `soa` | Controls mit Vorschlägen aus Risiken und AI-Act-Pflichten; optional gefiltert | relativ zum Eintrag in `controls` |
| `pruefung` | Führt alle Prüfregeln aus, zeigt Ampel und Stage-1-Bericht, erzeugt die Dokumente | keine |
| `fahrplan` | **neu.** Zeigt nach dem Startinterview Pfad (mit oder ohne ISMS), Modul, aktive Etappen, Stunden je Etappe und Wochen bis zum Zieltermin | keine |
| `kalender` | **neu.** Jahreskalender mit wiederkehrenden Aufgaben (`aufgaben`) und fälligen Daten aus der Projektdatei | keine |
| `vorschlaege` | Vorschlagsliste aus einem Katalog (`katalog`, heute `genaiRisiken`): je Eintrag Übernahme als Risiko für ein gewähltes KI-System mit generativer KI (Titel, Quelle, Ursache, Folge, Folgenebenen; Kennzeichen «Vorschlag GS-xx (OWASP …)» in der Beschreibung) | keine |
| `gestaltung` | **ab 1.1.** Optionale, überspringbare Seite der Dokumentgestaltung (E0-gestaltung): Logo und Primärfarbe mit Vorschlag aus dem Logo, Verweis auf Einstellungen › Dokumentgestaltung (`src/app/ansichten/einstellungen/Gestaltung.tsx`). Schreibt `organisation.gestaltung`; zählt nicht zum Fortschritt | keine |
| `nist-profil` | **Modul NIST AI RMF.** Profil `nistProfil` mit 72 Subkategorien nach Funktion, Ist und Ziel 0 bis 3, Priorität, Massnahmen, Notiz; Ist-Vorschlag aus `src/nist-rmf/logik.ts` (`istStufe`). `nistStand: true` zeigt zusätzlich den Stand der Fassung (`src/nist-rmf/stand.yaml`) | keine |

### Seitenattribute für Eintragsseiten

| Attribut | Gilt für | Bedeutung |
|---|---|---|
| `liste` | `liste` | Name der Projektliste (`kiSysteme`, `risiken`, `parteien`, `personen`, `rollen`, `ziele`, `kompetenzen`, `kommunikation`, `lieferanten`, `audits`, `feststellungen`, `managementbewertungen`, `massnahmen`, `nachweise`, `eigeneControls`, `dokumente`) |
| `filter` | `liste`, `auswahl-systeme`, `folgenabschaetzung`, `soa` | Zeigt nur Einträge, deren Feld (relativer Pfad) einen der Werte hat. Bei Listenfeldern genügt ein gemeinsamer Wert. `"*"` heisst: Feld ist gesetzt. |
| `filterEines` | `auswahl-systeme` | Wie `filter`, aber es genügt, wenn einer der Schlüssel passt (ODER), z. B. `{ lebenszyklus: [ausserbetrieb], status: [abgeloest] }`. Gilt zusätzlich zu `filter`. |
| `vorgabe` | `liste` | Werte, die neue Einträge erhalten (z. B. `art: chance`) |
| `startwerte` | `liste` | Einträge, die das Werkzeug beim ersten Öffnen vorschlägt, falls noch kein passender Eintrag existiert |
| `anlegen` | `liste` | `false`: nur bestehende Einträge bearbeiten (z. B. Bewertung von Risiken) |
| `mindestensEiner` | `liste` | `true`: die Norm verlangt mindestens einen Eintrag; «Für diese Seite ist kein Eintrag nötig» wird nicht angeboten |
| `eintrag` | `liste` | Bearbeitet genau den Eintrag mit dieser ID und legt ihn bei Bedarf an (z. B. `D-07` im Dokumentenregister). Zulässig sind Dokument-IDs und IDs von Ergänzungsblättern. Gilt je nach Pfad ein anderer Eintrag, gibt es zwei Seiten mit `wenn: { mitIsms: false }` und `wenn: { mitIsms: true }`, z. B. `E8-plan-freigabe` (D-07) und `E8-plan-freigabe-eb` (D-07-EB). |
| `filterSystem` | `folgenabschaetzung` | Bedingung an das verknüpfte KI-System (relativer Pfad in `kiSysteme`). Systeme ohne Angabe im Feld gelten als passend. |
| `rahmenwerk`, `controls` | `soa` | Filter auf Rahmenwerk (`ISO42001`, `EUAIA`, `NISTRMF`, `EIGENE`) bzw. eine Liste von Control-IDs. `EUAIA` und `NISTRMF` zeigen die Vorschläge (`vorschlag_wenn`) und bereits entschiedene Controls des Rahmenwerks. |
| `fragebogen` | `liste`, `formular` | `true`: Das Werkzeug bietet Export und Import eines Fragebogens für Fachbereiche an (XLSX nach D-10). Exportiert werden die Felder der Seite; importierte Zeilen erscheinen zur Bestätigung. |
| `aufgaben` | `kalender` | Wiederkehrende Aufgaben: `{ id, rhythmus, seite, norm, wenn?, monatAus?, faelligAus? }`. `rhythmus` aus Optionsgruppe `rhythmus`; `seite` ist die Seite, die das Werkzeug zur Erledigung öffnet; `monatAus` ist ein Pfad mit dem gewählten Monat; `faelligAus` ein Pfad mit Datumsfeldern (z. B. `kiSysteme[].naechsteUeberpruefung`). Erledigt-Vermerke speichert das Werkzeug in `meta.checklisten.J-<aufgabe>-<jahr>`. Texte in `gefuehrt.kalender.<id>`. |

### Feldtypen

| Typ | Wert | Bemerkung |
|---|---|---|
| `text`, `textarea`, `zahl`, `datum` | Zeichenkette bzw. Zahl, Datum JJJJ-MM-TT | `text` mit `vorschlaege: <gruppe>`: Auswahlliste mit Textbausteinen, freie Angaben bleiben möglich (gespeichert wird der Text) |
| `zeitpunkt` | Datum mit Uhrzeit JJJJ-MM-TTThh:mm | **ab Schemaversion 3:** z. B. `feststellungen[].entdecktAm`, `eingedaemmtAm` (Kennzahl PR-19) |
| `auswahl` | ein Wert | `optionen: <gruppe>`; Gruppen mit Zahlen (z. B. `schwere: [1, 2, 3, 4]`) speichern eine Zahl |
| `mehrfach` | Liste von Werten | `optionen: <gruppe>` |
| `janein` | Boolean | |
| `liste-text` | Liste von Zeichenketten | optional `vorschlaege: <gruppe>`: Textbausteine zum Übernehmen (Texte unter `gefuehrt.optionen.<gruppe>`) |
| `person` | Personen-ID | **erweitert:** Auswahl aus `personen` mit «Neue Person anlegen» (Name, Funktion) |
| `personen` | Liste von Personen-IDs | **neu:** Mehrfachauswahl aus `personen` |
| `freigabe` | `{ von, am }` | **neu:** Person und Datum einer Freigabe |
| `verweis` | ID oder Liste von IDs | **neu:** `quelle:` Projektliste (`kiSysteme`, `lieferanten`, `massnahmen`, `nachweise`, `audits`, `controls`, `prozesse`: Prozesse im Pfad mit eigenen Prozessen) oder Katalog (`katalog-27001`, `katalog-dokumente`). Ist das Zielfeld eine Liste, ist Mehrfachauswahl möglich. |
| `tabelle` | Liste von Objekten | **neu:** `spalten:` Liste von Feldern (gleiche Attribute, Pfade relativ zur Zeile, auch mit Punkt wie `wer.tief`). Für eingebettete Listen wie `organisation.kontext.themen` oder `parteien[].anforderungen`. |
| `pruefliste` | `Record<Prüfpunkt, { nachweis, stichprobe, ergebnis }>` | **neu:** Auditcheckliste (D-20) über alle Normabschnitte 4 bis 10 (Schlüssel ohne «K-», z. B. `6.1.2`) und Controls aus Anhang A; `ergebnis` aus Optionsgruppe `checklistenErgebnis`. Für `audits[].checkliste`. |
| `checkliste` | `meta.checklisten[schluessel]` | **neu:** Statt `pfad` steht `schluessel`, z. B. `"E-05.arbeitnehmende.{id}"`; `{id}` ist die ID des Eintrags. Abhaken mit Nachweis und Datum. Prüfregeln H14 und H16 lesen diese Schlüssel. Die Punkte stimmen mit der Vorlage überein (E-05: `E05_PUNKTE` in `src/vorlagen/E-05.ts`). |

### Feldattribute

| Attribut | Bedeutung |
|---|---|
| `pfad` | Punktpfad (absolut oder relativ, siehe Seitentyp). Alles, was ein Dokument braucht, hat ein eigenes Feld im Datenmodell (z. B. `organisation.meldeweg`, `organisation.projektauftrag`, `gapAnalyse`). Unter `meta.gefuehrt.antworten.<schluessel>` steht nur Arbeitsstand ohne Dokumentinhalt (z. B. Quellen für das Inventar, Monate im Jahreskalender). |
| `pflicht` | Muss vor «Weiter» ausgefüllt sein (sonst «Später»). Listenseiten mit Pflichtfeldern ohne Eintrag lassen sich mit «Kein Eintrag nötig» abschliessen (`meta.gefuehrt.nichtNoetig`, nicht beim KI-Inventar). |
| `wenn` | Feld nur unter Bedingung; gleiche Schlüssel wie bei Seiten, zusätzlich `eintrag: { <relativer Pfad>: [Werte] }` auf Eintragsseiten. |
| `setzt` | **neu:** Je Optionswert weitere Felder setzen, z. B. `zertifiziert: { meta.mitIsms: true, meta.ismsZertifiziert: true }`. |
| `vorschlag` | **neu:** Vorbelegung, die das Werkzeug vorschlägt: `{ wert, wennEines: [Pfade] }` (Wert vorschlagen, wenn mindestens einer der Pfade wahr ist). |

## optionen.yaml

Optionsgruppen mit ihren Werten. Felder verweisen mit `optionen: <gruppe>` darauf. Beschriftungen stehen in `gefuehrt.optionen.<gruppe>.<wert>`. Wo das Datenmodell einen Wertebereich vorgibt (z. B. `KiTyp`), stimmen die Werte genau damit überein.

## Bedingungen (`wenn`)

`mitIsms`, `modul` (Modul AI Act), `modulNistRmf` (Modul NIST AI RMF, `meta.modulNistRmf`), `entwickeltKi`, `verkauftKiProdukte`, `generativ` (mindestens ein aktives System mit `generativ: true`) (je `true` oder `false`), `rolle: anbieter|betreiber` (mindestens ein System mit dieser AI-Act-Rolle), `typ: eigenbau` (mindestens ein solches System). Mehrere Schlüssel = alle müssen zutreffen.

Ein Modul aus- und wieder einschalten verliert keine Angaben: Seiten, Felder und Ansichten des Moduls werden nur ausgeblendet, die Daten (z. B. `nistProfil`, Controls mit Rahmenwerk `NISTRMF`, `kiSysteme[].messkonzept`) bleiben in der Projektdatei.

Wird eine Seite oder Etappe direkt aufgerufen (Link, Lesezeichen), deren Bedingung nicht zutrifft, zeigt das Werkzeug einen Hinweis mit der Bedingung (Texte `app.gefuehrt.bedingung.<schluessel>.<wert>`) und den Weg zur nächsten zutreffenden Seite. Sprünge von der Prüfung tragen `?von=pruefung` bzw. `?von=gefuehrt-pruefung`; die Zielseite zeigt dann einen Link zurück zur Prüfung.

## Texte je Seite (i18n `gefuehrt.<etappe>.<id>`)

Die Datei `src/i18n/<sprache>/gefuehrt/<etappe>.yaml` enthält auf oberster Ebene die Seiten-IDs. Der Sprachlader führt den Ordner `gefuehrt/` mit `gefuehrt.yaml` zusammen (doppelte Schlüssel sind ein Fehler); die Texte einer Seite stehen damit unter `gefuehrt.<etappe>.<id>`, z. B. `gefuehrt.E2.E2-themen.titel`.

```yaml
E2-themen:
  titel: Was beeinflusst Ihren KI-Einsatz?
  frage: Welche Themen ausserhalb und innerhalb Ihres Unternehmens wirken auf Ihren Umgang mit KI?
  warum: Zwei bis drei Sätze, warum die Norm das will, in eigenen Worten.
  fehler: Typischer Fehler und was Auditoren sehen wollen.
  felder:
    organisation.kontext.klimawandelRelevant: { label: ..., hilfe: ... }
```

Feldschlüssel: der `pfad` wie in der Struktur; Tabellenspalten als `<pfad>.<spaltenpfad>`; Checklistenfelder als `schluessel` ohne `.{id}` (z. B. `E-05.arbeitnehmende`).

Etappentexte (`gefuehrt.etappen.<id>`): `titel`, `ziel`, `warum`, `ergebnis`. Checklisten (`gefuehrt.checklisten.<id>`): ein Satz. Kalenderaufgaben (`gefuehrt.kalender.<id>`): ein Satz. Allgemeine Texte des Modus unter `gefuehrt.ui`. Glossarbegriffe in Texten mit `[[g:schluessel]]` markieren (Tooltip aus `glossar.yaml`, Schlüssel in `src/kataloge/glossar.yaml`). Für eine gebeugte Form steht der angezeigte Text nach einem senkrechten Strich: `[[g:interessierte-partei|interessierten Parteien]]`.

Regel: Erklärungen in eigenen Worten, nie Normtext (docs/KONVENTIONEN.md).

## Schlüssel aus den Vorlagen

- Lieferanten: `pruefpunkte.PF-01` bis `PF-21` und `vertragsklauseln.VK-01` bis `VK-15` wie in D-16 (`PRUEFPUNKTE_LIEFERANT`, `VERTRAGSKLAUSELN` in `src/model/typen.ts`).
- Fragebogen für Fachbereiche (D-10): Spalten 1 bis 14 wie bisher; Frage 13 («Kann das Werkzeug selbst etwas tun?») «ja» oder «weiss nicht» ergibt `handlungsbefugnis: fuehrt-begrenzt-aus`, Frage 14 `zugriffe`.
- GenAI-Bewertung (E9-genai, Modul NIST AI RMF): `genaiBewertung.<id>.relevant|massnahme|begruendung` mit den 12 IDs aus `src/nist-rmf/genai-risiken.yaml`.
- Betreiberpflichten: `E-05.<punkt>.{id}` mit den Punkten aus `E05_PUNKTE`.
- Rollenbereiche (`rollenBereich`) wie die Bereiche in D-04.

## Fachbegriffe in den Seitentexten

Jeder Fachbegriff der Begriffsliste (`src/kataloge/glossar.yaml`, `liste: true`) wird auf jeder Seite bei der Erstnennung erklärt (Tor G43, AF-135): im Text von `frage`, `warum`, `fehler` oder einer Feldhilfe als `[[g:id|Text]]`. Das Glossar zeigt als Tooltip die Kurzerklärung (`kurz`, höchstens 20 Wörter, eigene Worte, in `src/i18n/<sprache>/glossar.yaml`), die Hilfespalte listet die Begriffe der Seite. `titel` und `label` zählen wie Überschriften nicht als Erstnennung; steht ein Begriff aber nur dort, fehlt auf der Seite die Erklärung und das Tor meldet es.

## Prüfregeln und Seitenstatus

Eine besuchte Seite gilt nur als «erledigt», wenn alle Pflichtangaben da sind und die Prüfregeln zur Seite nichts melden (AF-139). Die Zuordnung von Regel zu Seite steht in `src/app/logik/pruefsprung.ts` (dieselbe wie für die Sprünge der Prüfseite). Regeln ohne Seite im Guide stehen dort mit Grund in `OHNE_GUIDE_SEITE` (Prozesse, Bibliothek, Gestaltung, Stand des Kits). Hält nur ein Befund die Seite offen, zeigt sie den Befund mit Sprung, und der Status heisst «Prüfung meldet einen Befund».
