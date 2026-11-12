Die Systemkarte ist die Gestaltung von kmu-cio.ch, der Website von Andreas Gapsch (KMU-CIO), und die Grundlage für seine Applikationen, zuerst den AIMS-Manager des ISO/IEC 42001 Starter-Kits (offline, Preact). Alles, was die Website festlegt, gilt hier unverändert. Was Applikationen zusätzlich brauchen, ist in diesem Buch und in den Token-Notizen mit **Für Applikationen ergänzt** markiert und aus den Website-Werten abgeleitet.

## Grundsätze

- **Eine Bühne, kein Baukasten.** Wichtiges steht auf einer abgerundeten Fläche (`buehne`, `radius-buehne`), alles andere ruhig auf `seite`. Pro Ansicht gibt es höchstens eine Bühne.
- **Knoten und Leitung tragen die Struktur.** Etiketten, aktive Navigation, Etappen, Fristen und Rollen hängen an Leitungen mit Knoten wie in einem Architekturdiagramm. Das Motiv zeigt Zusammenhang, es schmückt nicht.
- **Blau ist die Marke.** `blau` (#1c5d94 hell, #6fa8dc dunkel) führt: Links, Primärknopf, aktive Knoten. Alles andere bleibt neutral.
- **Typografie vor Dekoration.** Archivo, breit und schwer, für Titel und Bedienung; Source Serif 4 für Lesetext. Gewicht und Breite schaffen die Hierarchie, nicht Farbe oder Kästen.
- **Ruhig und genau.** Haarlinien statt Rahmen, wenige Schatten, keine Effekte. Zahlen stehen still und in festen Breiten.
- **Hell und dunkel sind gleichwertig.** Jede Farbe hat beide Werte; jede Kombination hält WCAG 2.2 AA in beiden.

## Ton und Sprache

- Schreiben Sie sachlich, knapp und in der Sie-Form: «Erfassen Sie alle KI-Systeme, die Ihre Firma nutzt.» Kein «Wir», keine Ausrufezeichen, keine Werbesprache.
- Deutsch in Schweizer Rechtschreibung: «ss» statt Eszett, Anführungszeichen «so», Tausendertrenner Apostroph (`1’240`), Dezimalkomma (`18,5`), Datum `21.10.2026`.
- Keine Gedankenstriche. Verbinden Sie mit Komma, Doppelpunkt oder einem neuen Satz; Spannen schreiben Sie mit «bis» (`5 bis 11`).
- Knöpfe beginnen mit dem Verb oder nennen das Ergebnis: «Entwurf speichern», «Freigeben», «Zur SoA». Statuswörter sind kurz und klein: «umgesetzt», «teilweise», «überfällig».
- Fachbegriffe der Norm bleiben, wie die Norm sie nennt (Erklärung zur Anwendbarkeit, SoA, Control), und werden beim ersten Auftreten erklärt.
- Englische Fassungen: US-Schreibweise wie auf der Website.

## Visuelle Grundlagen

- **Flächen.** Grund ist `seite`. Erhöhte Inhalte liegen auf `karte` mit 1px `linie` und `radius` (16px). Die Bühne nutzt `buehne`, 1px `linie`, `radius-buehne` (28px) und `schatten-hoch`. Vertieftes (Code, Platzhalter, gesperrte Felder) liegt auf `flaeche-tief`.
- **Linien.** `linie` trennt (Tabellenzeilen, Kartenrand, Kopf beim Scrollen), `linie-stark` verbindet (Leitungen, Passermarken, Tabellenkopf, gestrichelter Hinweis). Ränder von Bedienelementen sind `kontur` (mind. 3:1).
- **Schatten.** Nur zwei: `schatten` für Kleines (Sprechblase, runde Symbole) und `schatten-hoch` für das, was schwebt (Bühne, Rollenkarte, Dialog). Im dunklen Theme entfällt `schatten`; Tiefe entsteht dort aus Linien.
- **Radien.** `radius-buehne` 28px für die Bühne, `radius` 16px für Karten, `radius-klein` 10px für Felder und Hinweise, `radius-symbol` 12px für Symbolfelder, `radius-pille` für Knöpfe und Pillen. Die kleinen Literale `radius-fein` (6px), `radius-code` (5px) und `radius-fokus` (4px) nur, wo ihre Notiz es sagt.
- **Layout.** Inhalt höchstens `breite` (1180px) breit, Seitenrand fluid zwischen `rand-min` und `rand-max` (in CSS `--rand`). Fliesstext höchstens 68 Zeichen breit, Einleitungen 60. Der Kopf ist mindestens `kopf-hoehe` hoch und klebt oben.
- **Passermarken.** Die Bühne trägt zwei Passermarken aus dem Druck (oben links, unten rechts, 18px vom Rand, `passermarke` 22px, Strich 1px in `linie-stark`). Sie sind das ruhige Erkennungszeichen; setzen Sie sie nirgends sonst.
- **Bewegung.** Übergänge 0,15s ease für Farbe, Rand und `translate` (Karten heben sich beim Hover um 2px). Leitungen dürfen sich einmalig einzeichnen (0,7s). Bei `prefers-reduced-motion: reduce` entfällt alle Bewegung. Nichts zählt hoch, nichts pulsiert.
- **Zustände.** Hover: Linkfarbe `blau-tief`, Rand-Knopf erhält `blau-hauch`. Fokus: 2px durchgehender Ring in `fokus`, 3px Abstand (Eingabefelder: 2px `blau`, 1px Abstand). Deaktiviert: Deckkraft 0,6. Fehler: Rand und Text in `status-kritisch` mit Raute und Wort.

## Farben

Verwenden Sie Farben nur über ihre Tokens. Jede Textfarbe nennt in ihrer Notiz die Gründe, auf denen sie lesbar ist.

**Flächen:** `seite` (Seitengrund), `buehne` (Bühne, Band), `karte` (Karten, Felder), `scheibe` (Porträtscheibe der Website), `flaeche-tief` (vertieft).

**Text:** `tinte` für Überschriften, Namen und Betontes; `text` für Fliesstext; `gedaempft` für Metadaten, Etiketten, Tabellenköpfe. Alle drei auf `seite`, `buehne` und `karte`.

**Marke:** `blau` für Links, Primärknopf und aktive Knoten, `blau-tief` für deren Hover, `auf-blau` für Text auf blauer Fläche, `blau-hauch` als Hauch hinter Symbolen und für Hover.

**Signal:** `signal` ist das einzige Orange der Marke und steht nur dort, wo die Website es heute hat: im Fokusring (über den Alias `fokus`) und im Punkt der Wortmarke «kmu-cio.». Setzen Sie es nicht als Akzent ein. Für das Logo ist kein Orange und kein Rot vorgesehen; mit dem Logo kommt eine Kobalt-Palette, die `signal` ersetzen kann. Weil der Fokusring über `fokus` läuft, ändert sich dann nur ein Alias.

**Status der Website:** `ok`, `warn`, `fehler` bleiben für Website-Inhalte. Das Grün `ok` und das Rot `fehler` unterscheiden sich fast nur im Farbton; verwenden Sie in Applikationen die Statusfarben unten.

### Statusfarben (Für Applikationen ergänzt)

Fünf Status, je vier Tokens: `status-<s>` (Text und Symbol), `status-<s>-flaeche` (Ampelform, Balken, Fortschritt), `status-<s>-hauch` (Grund von Pille und Banner), `auf-status-<s>` (Text auf der Fläche).

| Status | Bedeutung | Form | hell (Text / Fläche) | dunkel (Text / Fläche) |
|---|---|---|---|---|
| `gut` | erfüllt, umgesetzt, wirksam | Kreis mit Haken | #17606a / #2e95a5 | #6cc4d0 / #227a86 |
| `warnung` | teilweise, bald fällig, Handlung nötig | Dreieck mit Ausrufezeichen | #8a5a00 / #8a5a00 | #e0b050 / #d78c19 |
| `kritisch` | nicht erfüllt, überfällig, unannehmbar | Raute mit Ausrufezeichen | #9c3510 / #772106 | #f5a273 / #ffab78 |
| `neutral` | nicht bewertet, nicht anwendbar, Entwurf | hohler Kreis | `gedaempft` / #616a74 | `gedaempft` / #7d8791 |
| `info` | Hinweis, in Prüfung | Kreis mit i | `blau` / `blau` | `blau` / `blau` |

- Gut ist Blaugrün, kritisch Orangerot: Die beiden liegen nicht auf der Rot-Grün-Achse und bleiben für Menschen mit Rot-Grün-Schwäche unterscheidbar.
- Die Flächen sind zusätzlich nach Helligkeit gestaffelt: Je kritischer, desto stärker der Kontrast zum Grund. Hell ist `gut` die hellste und `kritisch` die dunkelste Fläche (Leuchtdichte 0,248 zu 0,050, Verhältnis 2,97:1), dunkel umgekehrt (0,160 zu 0,517, 2,70:1).
- Ein Status erscheint nie als Farbe allein: immer mit Wort und mit seiner Form (Komponente `StatusPille`, `StatusSymbol`).
- `info` ist das Markenblau. Verwenden Sie es für Hinweise, nicht für Erfolg.

### Risikostufen (Für Applikationen ergänzt)

`risiko-tief`, `risiko-mittel`, `risiko-hoch` und optional `risiko-sehr-hoch` färben die Zellen der Risikomatrix, Text darauf mit `auf-risiko-<stufe>`. Die Skala ist ein Orangeton mit stetig wachsendem Kontrast zum Grund (hell: Nachbarstufen 1,58:1, 2,03:1, 2,69:1; dunkel: 1,63:1, 2,50:1, 1,99:1). Die Stufen folgen dem Kit: tief bis `akzeptanzBis`, hoch ab `unannehmbarAb` (Wert W×A). Jede Zelle zeigt ihren Wert, die höchste Stufe ist zusätzlich schraffiert.

## Hell und dunkel

- Setzen Sie das Theme immer als `data-theme="light"` oder `data-theme="dark"` auf `<html>`, bevor gezeichnet wird. Ohne gespeicherte Wahl folgt es `prefers-color-scheme`; die Wahl liegt unter `kmu-cio-theme` im localStorage, gemeinsam mit Website und Lernplattform. `Systemkarte.theme.anwenden()` und `.umschalten()` tun genau das.
- Prüfen Sie jede neue Fläche in beiden Themes. Im dunklen Theme werden Akzente heller; Text auf ihnen ist dann dunkel (`auf-blau`, `auf-status-*`), nie Weiss als Literal.

## Typografie

- **Familien.** `display`: Archivo Variable (Gewicht 100 bis 900, Breite 62 bis 125 %) für Namen, Titel, Bedienung, Tabellen und alles mit Zahlen. `text`: Source Serif 4 Variable (Gewicht 200 bis 900, normal und kursiv, optische Grössen automatisch) für Fliesstext, Einleitungen und Zitate.
- **Breite als Stimme.** Grosse Titel laufen breit: Name 125 %, Seitentitel 112 %, Sektion 110 %, Fliesstext-h2 106 %, Kennzahl 125 %, Wortmarke 118 %. `tokens.css` setzt keine Breite; `components/bundle.css` ergänzt `font-stretch` an den Klassen `typo-*`.
- **Stile.** Anzeige: `typo-name`, `typo-seitentitel`, `typo-sektion`, `typo-titel-2`, `typo-kartentitel`, `typo-titel-3`, `typo-gruss`, `typo-kennzahl`, `typo-wortmarke`. Bedienung: `typo-knopf`, `typo-knopf-klein`, `typo-navigation`, `typo-feldbeschriftung`, `typo-eingabe`, `typo-etikett`, `typo-tabellenkopf`, `typo-tabelle`, `typo-meta`, `typo-rollentitel`, `typo-station`, `typo-notiz`, `typo-status`. Text: `typo-fliesstext` (1.0625rem, Zeilenhöhe 1.62), `typo-einleitung`, `typo-zitat`. Fluide Grössen der Website stehen als Höchstwert; die `clamp()`-Spanne nennt die Notiz.
- **Überschriften** in `tinte`, Zeilenhöhe 1.12, Sperrung -0.01em bis -0.025em, `text-wrap: balance`. Fliesstext `text-wrap: pretty`.
- **Zahlen** in Archivo mit `font-variant-numeric: tabular-nums`, Kennzahlen zusätzlich `lining-nums`. Zahlen erscheinen sofort mit ihrem Endwert.
- **Lizenz.** Beide Schriften stehen unter der SIL Open Font License 1.1 (Archivo: The Archivo Project Authors; Source Serif 4: Adobe). Die Dateien unter `fonts/` stammen aus @fontsource-variable 5.3.0 (Teilmengen latin und latin-ext); die Lizenztexte liegen unter `assets/Schriften/`. Geben Sie sie mit jeder Applikation weiter, die die Schriften einbettet, und verkaufen Sie die Schriften nicht einzeln.
- Schriften werden immer lokal geladen, nie von Google Fonts.

## Abstände und Masse

- Die Website hat keine Abstandsskala, sondern feste rem-Werte je Komponente. Für Applikationen ergänzt sind `abstand-1` bis `abstand-8` (.35rem, .5rem, .6rem, .8rem, 1rem, 1.4rem, 2rem, 3rem); jede Stufe ist ein Wert, den die Website verwendet, und ihre Notiz sagt, wo.
- Formularfelder stehen mit `abstand-5` untereinander, Beschriftung und Feld mit `abstand-1`. Karten haben innen `abstand-7` (schmal 1.4rem), Karten untereinander `abstand-6`.
- Bedienelemente sind mindestens 2.35rem hoch (kleiner Knopf, Moduswahl), normale Knöpfe 2.75rem.

## Motiv: Knoten und Leitung

- **Knoten** sind Kreise: `knoten` 9px, `knoten-klein` 7px im Etikett, `knoten-gross` 14px für das Aktuelle. Voll in `blau` heisst erledigt oder aktiv, hohl (Grund `seite`, Rand 1.5px `kontur`) heisst offen.
- **Leitungen** sind 1px (`leitung`) in `linie-stark`; die erledigte Strecke einer Etappenleiste und der Strich der aktiven Navigation sind 2px (`leitung-aktiv`) in `blau`.
- Ein Knoten auf einer Leitung erhält einen Ring im Grundton (`knoten-ring`, 4px), damit er die Leitung sauber trennt.
- Einsatz: Etikett über Überschriften (Knoten, Leitung, Text) statt «// LABEL»; aktive Navigation (kurzer Strich unter dem Eintrag); Etappenleiste und Zeitleiste; Rollenkarten, die über eine Leitung an der Bühne hängen. Erfinden Sie keine weiteren Ornamente aus dem Motiv.

## Logo und Wortmarke

- Ein Logo gibt es noch nicht. Bis es steht, gilt als Favicon und App-Symbol die Zwischenlösung «k.»: weisses «k.» aus Archivo (820, Breite 118 %) auf `blau`, Ecken 14 von 64 (`assets/Logos/favicon-k.svg` und PNG-Grössen). Zeichnen Sie keine eigene Bildmarke.
- Die Wortmarke ist gesetzte Schrift, keine Datei: «kmu-cio» in Archivo 820, Breite 118 %, 1.3rem, Sperrung -0.02em, `tinte`, gefolgt von einem Punkt in `signal` (Komponente `Navigationsleiste`). Der orange Punkt ist der heutige Stand der Website und offen, bis Logo und Kobalt-Palette entschieden sind.
- Applikationen setzen ihren Namen als Zusatz neben die Wortmarke («kmu-cio. AIMS-Manager», Zusatz in `gedaempft`).

## Ikonografie

- Keine Emojis, nirgends. Keine Icon-Schrift, keine fremde Icon-Bibliothek.
- Symbole sind Inline-SVG mit Strich: Rollen-Symbole 32×32 mit Strich 1.4 (in einem 48px-Feld `radius-symbol` auf `blau-hauch`, Farbe `blau`), Werkzeug-Symbole 24×24 mit Strich 1.7, beide mit runden Enden. Ein einzelner Punkt in `blau` darf ein Symbol akzentuieren (wie im Organigramm).
- Statusformen (Kreis mit Haken, Dreieck, Raute, hohler Kreis, Kreis mit i) sind 12×12 und kommen aus `StatusSymbol`.
- Pfeile in Text sind Zeichen: «→» nach «Mehr»-Links, «↗» bei externen Links.
- Als Bilddatei liegen die Symbole unter `assets/Icons/` in `blau` (#1c5d94) bzw. `tinte` (#121821) eingefärbt; im Code zeichnen Sie sie mit `currentColor`.

## Datenvisualisierung (Für Applikationen ergänzt)

- **Kategorien:** `kat-1` bis `kat-6` (Blau, Orange, Blaugrün, Violett, Ocker, Grau), in dieser Reihenfolge, höchstens sechs. Jede hält mind. 3:1 auf `seite` und `karte` (hell 4,18:1 bis 6,90:1, dunkel 5,84:1 bis 9,00:1). Beschriften Sie Linien und Flächen direkt; eine Legende allein genügt nicht.
- **Sequenziell:** `seq-1` bis `seq-5` in Blau für Mengen, Abdeckung, Reifegrad. Die Helligkeit läuft stetig; im dunklen Theme ist «viel» hell. Werte auf Zellen in `auf-seq-<n>`.
- **Divergierend:** `div-1` bis `div-5` von Orange über die neutrale Mitte zu Blau für Abweichungen (Ist gegen Ziel). Werte in `auf-div-<n>`.
- **Status in Diagrammen:** Für erfüllt, teilweise, offen, nicht anwendbar nehmen Sie `status-*-flaeche`; «teilweise» erhält zusätzlich die Schraffur.
- **Formen statt Farbe allein:** Schraffur, Statusformen, Werte in Zellen, Text in der Zeile. Jedes Diagramm hat eine Textalternative: die Tabelle hinter der Risikomatrix, `aria-label` mit allen Werten bei Balken und Sparklines.
- **Achsen und Raster** in `linie` bzw. `linie-stark`, Beschriftung in `gedaempft`, Zahlen in tabular-nums. Keine 3D-Effekte, keine Verläufe, keine Torten mit mehr als drei Teilen.

## Komponenten

Die Komponenten liegen in `components/bundle.js` als `window.Systemkarte`, das Stylesheet in `components/bundle.css` (nach `tokens.css` laden), die Typen in `components/index.d.ts`. Das Bündel ist ein klassisches Skript ohne Abhängigkeiten und ohne Netz.

- **Ohne Bibliothek:** `Systemkarte.Knopf({ variante: 'primaer', children: 'Speichern' })` liefert ein DOM-Element; `Systemkarte.montieren('#ziel', element)` hängt es ein.
- **Mit Preact:** `const SK = Systemkarte.erzeugen(h)`, dann `<SK.Knopf variante="primaer">Speichern</SK.Knopf>`. Die Komponenten halten keinen Zustand; Werte und Ereignisse (`onClick`, `onInput`, `onChange`) kommen von der Applikation.
- Aktionen: `Knopf`. Formulare: `Eingabefeld`, `Auswahl`, `Kontrollkaestchen`. Status: `StatusPille` (mit `StatusSymbol`), `Hinweis`, `Fortschritt`. Flächen: `Karte` (auch Rollenkarte), `Buehne`. Motiv: `Etikett`, `Knoten`. Navigation: `Navigationsleiste` (mit `Moduswahl`), `Etappenleiste`. Daten: `Tabelle`, `Kennzahl` (mit `Kennzahlen`), `BalkenGestapelt`, `Risikomatrix`, `Zeitleiste`.
- Jede Komponente hat eine Richtlinie unter `components/<Name>/README.md`. Bauen Sie keine Bedienelemente von Hand nach, die das Bündel hat.

## Barrierefreiheit

- Ziel ist WCAG 2.2 AA in beiden Themes. Text hält mind. 4,5:1, grosser Text, Ränder von Bedienelementen, Fokusring und bedeutungstragende Grafik mind. 3:1. Alle 160 geprüften Paare halten das, unter anderem:

| Paar | hell | dunkel |
|---|---|---|
| `tinte` auf `seite` | 15,65:1 | 15,39:1 |
| `text` auf `seite` | 12,20:1 | 12,46:1 |
| `gedaempft` auf `seite` / `karte` | 5,96:1 / 6,79:1 | 7,35:1 / 6,34:1 |
| `blau` auf `seite` | 6,06:1 | 7,44:1 |
| `auf-blau` auf `blau` | 6,90:1 | 7,27:1 |
| `kontur` auf `karte` (Bedienelement) | 4,81:1 | 4,43:1 |
| `fokus` auf `seite` (Fokusring) | 4,03:1 | 6,78:1 |
| `status-gut` auf `status-gut-hauch` | 6,34:1 | 7,84:1 |
| `status-warnung` auf `seite` | 5,20:1 | 9,39:1 |
| `status-kritisch` auf `status-kritisch-hauch` | 5,89:1 | 8,00:1 |
| `status-gut-flaeche` auf `seite` (Grafik) | 3,09:1 | 3,75:1 |
| `auf-risiko-hoch` auf `risiko-hoch` | 4,58:1 | 5,11:1 |

- Setzen Sie `lang="de-CH"` und einen Sprunglink zum Inhalt. Überschriften folgen der Gliederung, nicht der Grösse.
- Formulare: Jede Eingabe hat ein sichtbares `label`; Hinweise und Fehler hängen über `aria-describedby` am Feld, Fehler setzen `aria-invalid`. Pflicht steht als Wort, nicht nur als Stern.
- Navigation: aktive Seite `aria-current="page"`, aktuelle Etappe `aria-current="step"`; Zustände der Etappen stehen auch als Text.
- Tabellen: `caption`, `th scope`. Die Risikomatrix ist eine echte Tabelle mit Zeilen- und Spaltenköpfen und hat eine zweite Tabelle als Liste.
- Bewegung nur ohne `prefers-reduced-motion: reduce`. Zielgrössen mind. 24×24px, Knöpfe 2.35rem und mehr.

## Verzichte

Bewusst nicht: Verlaufsblasen, Glas und Unschärfe, Bento-Kacheln (Kacheln unterschiedlicher Grösse im Raster), Monospace-Etiketten mit «//», Emojis, hochzählende Zahlen, farbige Linksbalken an Karten, Rot gegen Grün als einzige Unterscheidung, Orange ausserhalb von Fokusring und Wortmarkenpunkt, Schatten im dunklen Theme als Tiefe, Icon-Schriften, Fotos als Dekoration.

## Nicht übernommen

Von der Website nicht übernommen: das Porträt und die Scheibe mit Orbit-Ring (persönlich, nur Website), das House of IT (eigene Komponente der Website), die Sozial-Symbole (Marken Dritter), die Sprechblase, die Kontaktverschleierung, Sprachwahl, Fuss, Blog- und Kit-Listen, Lauf- und Profilseiten. Die Variablen `--rand` (clamp) und die fluiden Schriftgrössen stehen als Grenzwerte in den Tokens. Die Komponenten sind von Hand aus `src/styles/base.css`, `src/styles/komponenten.css`, `src/components/Hero.astro` und `src/layouts/Base.astro` geschrieben; die Website hat keine Komponentenbibliothek, die sich bündeln liesse.
