# Zählweise Q9: Sicherheit und Robustheit

Gilt für das Qualitätsziel Q9 («0 Skriptausführung, 0 Absturz ohne Meldung, 0 Datenverlust, 0 Netzwerkanfragen») und für den Befehl `npm run abnahme:q9`.

Der Fuzz (`tests/fuzz/`, Befehl `npm run fuzz`) liefert die Zähler der Stufe ohne Browser. Die Zähler, die einen Browser brauchen (Netz, Skript im Viewer, Hänger der Diagrammansicht), kommen aus einem Browserlauf und werden in derselben Datei eingetragen. Wo ein Zähler hier «Browser» heisst, gilt er erst mit diesem Lauf als gemessen; vorher steht er als «nicht gemessen», nie als 0.

## 1. Kopfdaten jeder Messung

| Feld | Definition |
|---|---|
| Seed | Ganzzahl, mit der alle Fallnummern erzeugt werden. Standard 77123. Gleicher Seed ergibt gleiche Fallliste. |
| Fallzahl | Fälle je Ziel. Pflichtteil 50, Release-Lauf 500. Die Messung nennt die Zahl je Ziel. |
| Ziele | Die 9 Eingabearten ohne Browser (Projektdatei, KI-Ergebnis, Bibliothekssicherung, Gestaltungspaket, SVG-Logo, Word-Vorlage, draw.io in der App, Normpaket, Norm-PDF) plus das Browser-Ziel der Diagrammansicht. |
| Commit | Kurz-Hash des geprüften Stands (`git rev-parse --short HEAD`). Ungespeicherte Änderungen machen die Messung ungültig. |

## 2. Die Zähler

Jeder Zähler zählt **Fälle**, nicht Meldungen: Ein Fall, der mehrere Regeln verletzt, zählt je Zähler einmal. Ziel ist bei allen Zählern 0.

| Zähler | Definition | Zählt | Zählt nicht | Messort |
|---|---|---|---|---|
| Skript | Eingeschleuster Code läuft oder bleibt in einem Ergebnis, das weitergegeben wird. | Marker aus der Eingabe wird im Browser ausgeführt (`window.__pwn`); bereinigtes SVG enthält `script`, `foreignObject`, Ereignisattribut, `javascript:`, `data:` oder einen Verweis ausserhalb der Datei; Gestaltung aus einem KI-Ergebnis wird übernommen. | Skript, das der Bereiniger entfernt hat. Text, der «script» nur als Wort enthält. | Fuzz (Orakel `svgGift`, Klasse `skript`) und Browser |
| Absturz | Die App wirft statt zu antworten, zeigt Rohtext eines Systemfehlers statt einer eigenen Meldung oder verliert den Prozess. | Ungefangene Ausnahme im geprüften Code; `TypeError`, `RangeError`, `SyntaxError`, `ReferenceError`, `URIError` als Ablehnungsgrund; Speicherabbruch oder Abbruch des Arbeiters; Absturz des Browsertabs. | Ablehnung mit eigener Meldung, auch wenn die Eingabe zerstört war. Fehler der Prüfskripte selbst. | Fuzz (Klasse `absturz`) und Browser |
| Datenverlust | Eine Eingabe, die die App annimmt, geht nicht unverändert durch Speichern und Laden, oder die Datei, die sie schreibt, kann sie selbst nicht mehr lesen. | Rundreise (Prüfung vor dem Speichern, Serialisieren, Laden) liefert ein anderes Projekt; Prüfung vor dem Speichern lehnt ein gültig geladenes Projekt ab; reparierte Datei ist nicht gültig; Ergebnis eines Imports ist nicht lesbar oder verliert Einträge still. | Eintrag, den die App erkennbar und mit Meldung abgelehnt hat. Änderung, die eine Meldung der Migration oder Reparatur nennt. | Fuzz (Klasse `datenverlust`) |
| Netz | Anfrage, die das Gerät verlässt. | Jede Anfrage auf eine fremde Adresse im Netlog des Browsers; jede CSP-Verletzung, die auf einen Ladeversuch zeigt. | Anfragen auf `file://` oder `blob:` der App selbst. Ladeversuche, die die CSP stoppt, zählen als **CSP-Verletzung** (eigene Zeile, kein Netz), solange das Netlog leer ist. | Nur Browser (nicht gemessen im Fuzz ohne Browser) |
| Fehlende Meldung | Die App lehnt ab, ohne dass eine lesbare Meldung entsteht. | Ablehnung mit leerer Meldung oder ohne Angabe von Ort oder Art (Ablehnungsart fehlt, Liste abgelehnter Einträge ohne Angabe); Browser: nach dem Zeitlimit keine sichtbare Meldung und keine Anzeige der Datei. | Meldung, die unschön formuliert ist (Sprachbefund, nicht Q9). | Fuzz (Klasse `meldung`) und Browser |
| Hänger | Ein Fall endet nicht innerhalb des Zeitlimits. | Fall überschreitet das Zeitlimit je Fall der Spezifikation (höchstens 5 s, Browser: Zeit bis zur Meldung höchstens 20 s); der Wächter beendet den Arbeiter. Ein Fall, der erst nach dem Limit fertig wird, zählt ebenfalls. | Langsame Fälle unter dem Limit. Wartezeit beim Start des Arbeiters. | Fuzz (Wächter in `tests/fuzz/lauf.ts`) und Browser |

Eine Orakelverletzung, die keinem der sechs Zähler zugeordnet werden kann (Klasse `orakel`), ist ein Fehlerfall und lässt die Messung scheitern. Sie bekommt in der Auswertung eine eigene Spalte, damit die Zuordnung nachgeführt wird (Regel in Abschnitt 4).

### Grenzfälle mit erwarteter Ablehnungsart

Ein Grenzfall (Grösse, Tiefe, Anzahl über der Grenze) trägt die erwartete Ablehnungsart. Wird die Datei angenommen oder aus einem anderen Grund abgelehnt, greift die Grenze nicht mehr: Fehlerfall der Klasse `orakel` («Grenze greift nicht»). Damit fällt auf, wenn eine Grenze wegfällt und eine spätere Prüfung den Fall zufällig trotzdem ablehnt.

### Zuordnung der Orakeltexte

Die Zuordnung steht in `klasseVon` (`tests/fuzz/typen.ts`) und wird dort getestet. Der Text einer Orakelverletzung bestimmt die Klasse: «Gift im», «Skript» oder «Gestaltung aus dem KI-Ergebnis übernommen» ergibt Skript; «wirft», «Rohfehler», «Absturz» oder «Speicherabbruch» ergibt Absturz; «ohne Meldung» oder «ohne Angabe» ergibt fehlende Meldung; «Datenverlust», «lässt sich nicht mehr laden» und verwandte Texte ergeben Datenverlust; Hänger kommen vom Wächter.

## 3. Urteil je Fall (Fuzz)

Jeder Fall bekommt genau eines von drei Urteilen:

1. **angenommen**: Die App hat die Eingabe übernommen, und das Ergebnis ist wieder lesbar (Rundreise bestanden, Schema gültig, Orakel des Ziels erfüllt).
2. **abgelehnt**: Die App hat sie mit nicht leerer, eigener Meldung zurückgewiesen.
3. **Fehler**: alles andere. Die Fehlermeldung nennt Seed und Wiederholbefehl (`npm run fuzz -- --ziel <Ziel> --seed <Seed> --fall <Nummer>`).

Reparatur gehört zur Projektdatei: Bei Ablehnung wegen Schemafehlern wird die Reparatur als Probe gerechnet. Liefert sie eine Datei, muss diese gültig sein und die Rundreise bestehen («Reparaturen mit gültiger Datei 100 %»). Liefert sie nichts, ist das ein Fehlerfall der Klasse Datenverlust (`reparaturKeine` muss 0 sein): Eine Ausnahme (Eingabe, die ihrer Art nach nicht reparierbar sein darf) braucht einen Eintrag im Änderungsprotokoll mit Begründung und eine eigene Fallart mit erwarteter Ablehnung.

## 4. Regel: Änderung nur mit Begründung

Diese Datei, die Zähler, das Zeitlimit und die Mindestfallzahlen ändern sich nur mit einer Begründung im Änderungsprotokoll unten. Verboten sind Änderungen, die einen Zähler kleiner machen, ohne dass sich das Verhalten der App geändert hat: einen Fall aus der Zählung nehmen, ein Limit erhöhen, eine Klasse umbenennen, eine Ablehnung ohne Meldung als Ablehnung werten. Erlaubt und mit Begründung zu protokollieren sind Änderungen, die die Zählung genauer oder strenger machen (neue Klasse, neues Orakel, höhere Fallzahl) und solche, die eine Fehlzählung beheben. Bei einer Änderung, die Zähler früherer Messungen verändert, wird die letzte Messung nach alter und neuer Zählweise berichtet.

Das gilt auch für das Werkzeug: Ein Orakel wird nicht gelockert, um einen Fund verschwinden zu lassen. Ein Fund, der nicht in diesem Paket behoben wird, steht als erwarteter Fehlschlag in `tests/fuzz/bekannte-funde.ts` mit Fall-Datei unter `tests/fixtures/fuzz/` und dem Paket, das ihn behebt. Ein Eintrag ohne Fall-Datei oder ohne Paket ist ungültig, und der Test verlangt, dass der Fall weiter fehlschlägt. Bekannte Funde zählen in den Zählern mit; die Messung ist erst mit leerer Liste grün.

## 5. Mindestfallzahl

| Stufe | Fälle je Ziel | Einsatz |
|---|---|---|
| Pflichtteil | 50 | jeder CI-Lauf: Schritt «Fuzz Pflichtteil» in `.github/workflows/ci.yml` mit `npx vitest run --config vitest.fuzz.config.ts` (auf GitHub-Runnern nicht `npm run fuzz`, weil `begrenzt.sh` systemd-run braucht); lokal `npm run fuzz` |
| Release-Lauf | 500 | vor jedem Release, `npm run fuzz -- --faelle 500` |

Eine Messung mit weniger als der Mindestzahl in einem Ziel gilt als nicht erfüllt, auch wenn alle Zähler 0 sind. Ein Ziel, das nicht lief, steht in der Messung als «nicht gemessen».

## Änderungsprotokoll

| Datum | Änderung | Begründung |
|---|---|---|
| 12.11.2026 | Erste veröffentlichte Fassung: Zähler Skript, Absturz, Datenverlust, Netz, fehlende Meldung und Hänger; Stufe ohne Browser mit Mutationsklassen, Regressionsdateien, Grenzmessung und statischer Netzprüfung. | Feste Definitionen, damit die Zahlen über Releases vergleichbar bleiben. |
