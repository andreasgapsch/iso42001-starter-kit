# Architektur AIMS-Manager

Beschreibt Aufbau und Laufzeit des AIMS-Managers. Verbindlich für Änderungen am Werkzeug.

## Laufzeit

- Eine Datei `aims-manager.html`, gebaut mit Vite 8 + vite-plugin-singlefile aus `src/app/main.tsx`. Kein Netzwerk, CSP per Meta-Tag (Hashes nach dem Build, `scripts/csp.mts`).
- Preact 10 + @preact/signals, TypeScript strict. Keine weiteren UI-Bibliotheken.
- **Auswahl statt `<select>`**: WebKit meldet für jedes `<select>` im Dokument eine Verletzung von `style-src-attr` (Ziel SELECT) und eine Konsolenzeile «Refused to apply a stylesheet …». Eingrenzung: Die Meldung erscheint auf einer Seite ohne Skript und ohne eigenen Stil, ebenso mit `appearance: none`, eigener Schrift oder Farbe, Stil für `option`, `size`, `multiple`, leerem, verstecktem (`hidden`, `display: none`) oder `appearance: base-select`; Chromium und Firefox melden nichts. Keine CSS-Änderung beseitigt sie, eine Lockerung der CSP kommt nicht in Frage. Der AIMS-Manager nutzt deshalb überall `src/app/ui/Auswahl.tsx`: Muster «select-only combobox» der ARIA Authoring Practices (Knopf mit `role=combobox`, beschriftet über `<label for>` oder `aria-label`; Liste mit `role=listbox`, Gruppen mit `role=group`; Fokus bleibt auf dem Knopf, `aria-activedescendant`), Tastatur ↓ ↑ Alt+↓ Pos1 Ende Bild↑ Bild↓, Tippsuche, Enter und Leertaste übernehmen, Escape schliesst ohne Änderung, Tab übernimmt; die Liste liegt fest positioniert über rollenden Tabellen, unter 640 px als Blatt am unteren Rand mit Zeilen von mindestens 44 px. Aufruf wie `<select>` (Kinder `<option>`, `<optgroup>`; `onChange` mit `currentTarget.value`), der Wert steht für Tests in `data-wert` (`tests/e2e/auswahl-hilfen.ts`). Ergebnis: in keiner Engine eine CSP-Meldung auf allen Routen (`tests/e2e/app/webkit-csp.e2e.ts`, ohne Ausnahme in `tests/e2e/app/app-hilfen.ts`). Bleibt die Meldung `style-src-elem` mit Ziel `#document`: der Stilblock, den Playwright in WebKit für jedes Bildschirmfoto einsetzt (auch mit `caret: 'initial'`); Tests werten die CSP vor dem Foto aus (`foto()` in `app-hilfen.ts`). Die Diagrammansicht behält ihr `<select>`: ihre eigene CSP erlaubt Stilattribute für den Viewer, WebKit meldet dort nichts.
- Daten zur Laufzeit aus `src/generiert/*.json` (erzeugt mit `npm run kataloge` aus den YAML-Quellen): Texte DE/EN, Kataloge, Etappen und Seiten des Guides, Prüfregeln.
- Dokumentengenerator, Vorlagen (`src/vorlagen`), docx, exceljs und fflate laufen in einem Web Worker aus einer Blob-URL; der Worker-Code ist als Text eingebettet und wird erst beim ersten Erzeugen gestartet (Startzeit).

## Module

```
src/app/
  main.tsx            Einstieg, globale Fehlerbehandlung, Theme, Sprache
  zustand/            Store (Signals): projekt, ungespeichert, ui; aendere(pfad, wert), aendereMit(fn)
  speicher/           Projektdatei öffnen/speichern, Zwischenspeicher
  import/             Schema-Prüfung (Ajv standalone), Migrationen, Import Skill-JSON und Fragebogen
  logik/              reine Funktionen: Fortschritt, Vorschläge (SoA aus Risiken, EUAIA aus Rolle/Klasse), Bedingungen (wenn), IDs
  ui/                 Bausteine: Feld, Tabelle (virtualisiert), Dialog, Hilfebereich, Glossar-Tooltip, Ampel
  ansichten/
    start/            Start: Neues Projekt, Öffnen, Beispiele, Wiederherstellen
    gefuehrt/         Etappenleiste, Einführungsseite, Formularseite, Liste, SoA, Folgenabschätzung, Prüfung, Live-Vorschau
    formular/         Übersicht + 13 Module (Organisation, Inventar, Risiken, Folgen, SoA, Dokumente, Massnahmen, Lieferanten, Audits/MB, AI Act, 27001-Brücke, Generator)
    pruefung/         Befundliste mit Sprung
    einstellungen/    Pfad, Modul, Sprachen, Theme, Über
  worker/             Generator-Worker (Einstieg), Protokoll main <-> worker
```

## Routen (Hash)

`#/start`, `#/gefuehrt/<etappe>/<seite>`, `#/formular/<modul>[/<id>]`, `#/pruefung`, `#/dokumente`, `#/einstellungen`, `#/ueber`. Sprungziele der Prüfregeln (`inventar/KI-001`, `risiken?ki=KI-001`) werden auf diese Routen abgebildet.

## Zustand

- `projekt: Signal<Projekt | null>`, `ungespeichert: Signal<boolean>`, `uiSprache`, `theme`.
- Änderungen nur über `aendere(pfad, wert)` (kopiert entlang des Pfads, unveränderliche Daten) oder `aendereMit(entwurf => …)` für Listenoperationen. Jede Änderung setzt `meta.geaendert`, `ungespeichert = true` und plant den Zwischenspeicher (2 s Entprellung).
- IDs neuer Einträge: nächste Nummer über dem Zähler der Liste (`meta.idZaehler`, ab Schemaversion 2) und der höchsten vorhandenen Nummer, mit `ID_PRAEFIX` (`src/model/typen.ts`), dreistellig (`src/app/logik/ids.ts`). Der Zähler sinkt nie; Löschen entfernt alle Verweise auf den Eintrag (`eintragLoeschen` in `src/app/logik/eintraege.ts`, Verweisregister `src/model/verweise.ts`).

## Sprache

UI-Sprache (Voreinstellung Browsersprache, umschaltbar, gemerkt) und Dokumentsprache (`projekt.meta.dokumentSprache`) sind getrennt. Freitexte werden nie übersetzt.

## Gestaltung

Designpaket «AIMS Nachtblau» (`docs/design-system/nachtblau`): Farben nur über CSS-Variablen (dunkel Standard, `[data-theme=hell]`, ohne Attribut «wie System»), Schrift Inter, Kontrast der Tokens geprüft (`tests/unit/tokens-kontrast.test.ts`). Rahmen in `src/app/rahmen/`: Symbolleiste mit den Hauptbereichen und der Projekt-Kachel (Name, Speicherstand, Speichern, Speichern unter, Öffnen), Untermenü je Bereich (einklappbar, unter 900 px als Blatt). Kein projektweiter Kopf: jede Ansicht setzt `Seitenkopf` (`rahmen/Seitenkopf.tsx`) mit H1, globaler Suche (`suche-quellen.ts`, Erweiterungsstelle für weitere Quellen), einer dezenten Anzeige des Speicherstands (Klick speichert, Ctrl/Cmd+S ebenso; Stichtag der Beispiele) und genau einer Hauptaktion (`rahmen/aktionen.tsx`); ausgenommen sind Seiten, deren Inhalt selbst die Wahl ist (Start ohne Projekt), Seiten im Guide (wie im Mockup) und Einstellungen (dort wird Speichern zur Hauptaktion). Druck und Druckansicht der Dokumente ohne Kopf. Unter 640 px liegt die Symbolleiste unten: die ersten vier sichtbaren Bereiche (Start, Guide, Register, Bibliothek) und «Mehr» mit den übrigen Bereichen und dem Projekt als Blatt; Blätter sind modal (`rahmen/blatt.ts`: übriger Rahmen inert, Fokusfalle, Escape, Fokus zurück), Abstände mit `env(safe-area-inset-bottom)` und `viewport-fit=cover`. Tabellen mit Klasse `kartenliste` (Zellen `k-titel`, `k-id`, `k-status`, übrige mit `data-label`) und die Register (`ui/VListe.tsx`) zeigen auf dem Telefon je Zeile eine Karte; Desktop unverändert. Ältere Hash-Routen bleiben gültig und werden über `bereichVon(route)` einem Bereich zugeordnet. Fokusrahmen sichtbar, Tastatur: «/» Suche, «g» dann Buchstabe für Bereiche, Pfeiltasten, Pos1 und Ende in der Symbolleiste (oben wie unten), Enter weiter, Alt+Pfeil links zurück, Alt+P Prüfung. Druckansicht immer hell. Namensnennung «ISO/IEC 42001 Starter-Kit von Andreas Gapsch, KMU-CIO, kmu-cio.ch» im Untermenü, auf der Startseite, in der Hilfe und unter «Über» (nicht entfernbar), Hinweis beim Start «Ihre Daten verlassen diesen Rechner nicht. Speichern Sie die Projektdatei an einem gesicherten Ort.»

## Generator im Werkzeug

Anfrage an den Worker: `{ art: 'set', projekt, sprache, ids?: string[] }` → Fortschritt `{ art: 'fortschritt', fertig, gesamt }` → Ergebnis ZIP-Bytes. Modus immer `firma` (keine Kit-Hinweise, keine «KMU-CIO» in Inhalt und Eigenschaften); Pfad mit ISMS erzeugt für `eb: true`-Vorlagen das Ergänzungsblatt. Einzeldokumente als Download, gesamtes Set als ZIP. Druckansicht für PDF über eine eigene HTML-Darstellung desselben IR.

## Gestaltung der Dokumente (DOCX, XLSX)

- **Farben** aus den hellen Tokens des Design Systems «KMU-CIO Systemkarte» (`docs/design-system/tokens.json`), festgehalten in `src/generator/palette.ts`; Dokumente werden immer hell gedruckt. Überschriften in `tinte`, Fliesstext in `text`, Tabellenkopf auf `flaeche-tief`, Feldbeschriftung auf `seite`, Linien `linie-stark` (auf Weiss vorberechnet). Hinweise als Banner: Grund `status-<s>-hauch`, Rahmen rundum in `status-<s>-flaeche` (Ausfüllen und Vorlage: warnung, Norm: info, Ausbau: gut, Beispiel: neutral). Platzhalter bleiben gelb hervorgehoben (auffindbar und entfernbar).
- **Risikostufen und Ampeln**: `risiko-tief`, `risiko-mittel`, `risiko-hoch` mit dunkler Schrift (`tinte` auf `risiko-hoch` 4,58:1; Weiss hätte nur 3,1:1); Status als Hauch mit Text in `tinte`. Jede farbige Zelle trägt zusätzlich Text (Stufenkürzel und Wert, Status als Wort). Test: Kontrast aller Farbrollen mindestens 4,5:1 (`tests/unit/generator-grafik.test.ts`).
- **Schriften**: Archivo und Source Serif 4 sind bei Firmen in der Regel nicht installiert, und Word kennt in `w:rFonts` keine Ersatzliste wie CSS. Die Dokumente nennen deshalb direkt Schriften, die mit Office (Windows, macOS, Word für das Web) vorhanden sind und für die LibreOffice metrisch gleiche Ersatzschriften mitbringt, damit Seitenumbrüche überall gleich bleiben: Titel, Tabellen, Kopf/Fuss, Diagramme, Formen und XLSX in **Arial** (Grotesk wie Archivo; LibreOffice: Liberation Sans), Lesetext in **Cambria** (Serifenschrift wie Source Serif 4; LibreOffice: Caladea). Georgia (Ersatz der Website) hat in LibreOffice keinen metrisch gleichen Ersatz. Keine eingebetteten Schriften (Grösse, Weitergabe).
- **Grafiken** als IR-Blöcke `matrix` (Tabelle mit Zellfarben, Legende, Textalternative), `diagramm` (natives Word-Diagramm über `docx/charts`, «Daten bearbeiten» in Word, Alternativtext mit allen Werten) und `ablauf` (bearbeitbare Formen über `docx/shapes`, Zeichenbereich mit Rückfallgruppe, Konnektoren mit expliziten Seiten). Daten aus `src/grafik/daten.ts`, Bausteine der Vorlagen in `src/vorlagen/grafik.ts`. Grafiken, die die Seitenvorgabe sprengen würden, stehen als Anlage am Dokumentende (`grafikAnlage`).
- **XLSX**: Ampeln auf mehreren Spalten, Datenbalken, Farbskalen und Farbe nach Text als bedingte Formate; Matrix-Blätter mit `COUNTIFS` über ein Datenblatt und zwischengespeichertem Ergebnis aus JS (gleich der Aggregation, geprüft mit Neuberechnung in LibreOffice).
- **Reproduzierbarkeit**: `paketBereinigen` normalisiert zufällige Beziehungs-IDs von docx, die prozessweit gezählten Zeichnungs-IDs (auch beim Firmenlogo), die Zeitstempel der eingebetteten Arbeitsmappen und die GUIDs der Datenbalken. Zwei Dokumente im selben Prozess oder Worker sind bytegleich.

## Normtexte aus der eigenen Normausgabe

Die Firma lädt ihre gekaufte PDF-Ausgabe von ISO/IEC 42001 oder ISO/IEC 27001 (ISO, SN EN, DIN EN; deutsch oder englisch) unter Einstellungen. Danach zeigt die App die Titel und Anforderungstexte der Norm statt der eigenen Kurztitel; auf Wunsch übernimmt der Generator sie in die Firmendokumente. Das Kit, das Repo, Tests und Projektdateien enthalten nie Normtext.

- **Module**: `src/normtexte/` (rein, isomorph): `zeilen.ts` (Textstücke zu Zeilen und Läufen), `bereinigen.ts` (Ligaturen, weiche Trennung, Kopf- und Fusszeilen, Seitenzahlen, Inhaltsverzeichnis, Vermerke wie «Normen-Download … KdNr.», gedrehte Wasserzeichen), `parser.ts` (Erkennung von Norm, Sprache, Ausgabe, nationaler Bezeichnung und Amd 1:2024; Kapitel 4 bis 10 über Abschnittsnummern in fortlaufender Folge und Auszeichnung, Unterabschnitte ohne Katalogeintrag wie 7.5.1 beim übergeordneten Abschnitt; Anhang A als Tabelle mit Spalten je Seite, Läufe an der Spaltengrenze geteilt; Silbentrennung über die Wortliste des Dokuments), `erwartet.ts` (Pflicht-IDs aus den Katalogen: 27 Abschnitte und 38 Controls bei 42001, 93 Controls bei 27001), `aufloesung.ts` (zentrale Funktion `normText(quelle, id, art, sprache)`: zuerst Normpaket in der gewünschten, sonst in der anderen Sprache, sonst eigener Text des Kits), `vermerk.ts` (Quellenvermerk), `pdf-worker.ts` (Einstieg des PDF-Workers).
- **PDF lesen**: pdf.js (`pdfjs-dist` 6.4.299, Apache-2.0, Legacy-Build für ältere Safari-Versionen) läuft in einem eigenen Worker aus einer Blob-URL (Block `#code-normpdf`, deflate + Base64 wie der Generator, Trusted-Types-Policy `aims-worker`), erst beim ersten Import entpackt. pdf.js arbeitet dort ohne eigenen Unterworker (`globalThis.pdfjsWorker`), ohne eval, ohne Schriften, CMaps und Wasm, nur Text; die CSP bleibt unverändert (`worker-src blob:`, `connect-src 'none'`). Zuwachs der HTML-Datei: rund 738 KB (Worker roh 1,74 MB, deflate 554 KB); der moderne Build wäre 70 KB kleiner, liefe aber nicht auf älteren Safari-Versionen.
- **Ohne Bibliothek** (eigener Leser mit fflate für FlateDecode) wäre die Datei nur um wenige Kilobyte gewachsen, wurde aber verworfen: Normen-PDF der Verkäufer sind verschlüsselt (RC4 oder AES mit Besitzerkennwort), nutzen Objekt- und Querverweisströme, CID-Schriften mit ToUnicode-CMaps und eigene Kodierungen. Ein eigener Leser müsste das alles nachbauen und gegen jede Ausgabe getestet werden.
- **Speicher**: IndexedDB `aims-normpaket` (Schlüssel `normpaket`), getrennt vom Zwischenspeicher des Projekts; Rückfall nur im Arbeitsspeicher mit Hinweis. Geladen nach dem ersten Zeichnen (`body[data-normpaket]`). Anzeige des Gespeicherten je Norm und Sprache, «Normtexte löschen», Export als eigene Datei `*.normpaket.json` mit Lizenzhinweis (ohne die Bestätigung für Dokumente), Import einer solchen Datei.
- **Bestätigungen**: Vor dem Import bestätigt die Firma, dass sie eine gültige Lizenz besitzt. Die Übernahme in Dokumente («Unsere Lizenz erlaubt die Übernahme in interne Dokumente») ist getrennt und standardmässig aus; ohne sie zeigt nur die App Normtexte. Lizenzgeber und Lizenznummer gehen in den Quellenvermerk.
- **App**: `src/app/normtexte/zustand.ts` (`normTitel`, `normErlaeuterung`) in Formularen, SoA, Feldern zur Control-Auswahl und zum Normbezug, Geführtem Modus, 27001-Brücke, Lagebild (Gruppen) und Hilfe («Normtext anzeigen»). Nicht im KI-Prompt und nicht im Skill-Export.
- **Generator**: Der Worker erhält das Normpaket nur als Laufzeitparameter `normtexte` der Aufträge `set` und `ir` (nie im Projekt). `erstelleHelfer` bietet `normTitel`, `normAnforderung`, `mitNormtext`; in leeren Vorlagen (`modus: 'leer'`) immer aus. Mit Normtext: D-11 Spalte «Control-Text», D-20 und D-00 Spalte «Anforderungstext», D-23 Titel und 27001-Control-Text, DOCX am Ende «Anforderungen der Norm (Auszug)» für die Abschnitte des Normverweises; Quellenvermerk am Dokumentende (DOCX) oder auf dem Lenkungsblatt (XLSX).
- **Tests**: Parser, Bereinigung, Auflösung und Generator mit synthetischen Normen (`tests/fixtures/normpdf.ts`, erfundener Text, PDF zur Testzeit erzeugt); E2E Import, Anzeige, Löschen, Projektdatei ohne Normtext, Netzwerk in drei Engines; lokaler Zusatztest gegen die eigene Ausgabe nur mit Zählungen (in CI übersprungen).

## Datensicherheit beim Speichern und Laden

Projektdatei und bibliothek.json werden beim Eingang gegen das Schema geprüft; vor dem Speichern wird validiert, die App ändert dabei nichts still. Scheitert die Prüfung beim Öffnen, bietet die App «Datei reparieren und öffnen»; lässt sich eine Datei vor dem Speichern nicht reparieren, entsteht eine `.rettung.json`. Extern geänderte Dateien werden nur nach Rückfrage überschrieben (Prüfsumme). Die Diagrammansicht prüft fremde Dateien vor dem unveränderten Viewer auf DTD, doppelte IDs und Elternzyklen. Pflege der Beispiele: `src/beispiele/*.aims.json` sind die Quelle, `src/beispiele/bau` erzeugt den Stand nicht mehr; `src/regeln/stimmigkeit.ts` prüft sie.
