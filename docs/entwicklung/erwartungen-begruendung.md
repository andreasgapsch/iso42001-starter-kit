# Begründungen geänderter Erwartungen

Alternative zur Commit-Nachricht für das Tor G33 (`scripts/pruefen/erwartungen.mts`). Wer eine Testerwartung, einen Snapshot, ein Referenzbild, eine Schwelle oder die Abdeckungsbasis ändert, hängt hier eine neue Zeile an. Die Zeile beginnt mit «Erwartung geändert:» und nennt danach den Grund (mindestens 20 Zeichen und vier verschiedene Wörter, kein Platzhalter).

Der Vermerk nennt seinen Gegenstand:

- Abdeckungsbasis: das Wort «Abdeckungsbasis», «abdeckung-basis» oder «Abdeckung»
- Referenzbild: eine Befund-Kennung in der Form `AF-123` oder `GH-123` (etwa die Nummer des Issues) und den Bildnamen (mit oder ohne Endung, oder ein Präfix mit Stern wie `gefuehrt-*`)
- alles andere: den Dateinamen der geänderten Datei

Beispiel: `Erwartung geändert: tests/unit/pruefen-alle.test.ts erwartet zusätzlich das neue Tor, die Liste der Tore wächst`

Das Tor wertet nur neu angehängte Zeilen aus; bearbeitete alte Zeilen zählen nicht als neuer Vermerk. Bestehende Zeilen bleiben stehen.

## Vermerke
