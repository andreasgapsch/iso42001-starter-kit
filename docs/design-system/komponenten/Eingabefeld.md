# Eingabefeld

Ein- oder mehrzeiliges Textfeld mit sichtbarer Beschriftung, Hinweis und Fehlermeldung.

**Verwendung:** für jede freie Eingabe. Beschriftung über dem Feld in `tinte` (.88rem, 600), Feld auf `karte` mit Rand `kontur` und `radius-klein`, Hinweis darunter in `gedaempft`.

**Was Sie liefern:** `beschriftung`, `wert` und `onInput`/`onChange`; optional `id`, `name`, `typ`, `platzhalter`, `hinweis`, `pflicht`, `mehrzeilig` mit `zeilen`. Bei einem Fehler `fehler` mit einem Satz, der sagt, was zu tun ist («Bitte im Format TT.MM.JJJJ.»).

**Regeln:** Platzhalter ersetzen nie die Beschriftung. Pflicht steht als Wort. Fehler erst nach dem Verlassen des Felds oder beim Speichern zeigen, nicht bei jedem Tastendruck. Gesperrte Felder (`deaktiviert`) liegen auf `flaeche-tief`.

Herkunft: `.feld` der Website (Padding .75rem .9rem, Archivo 1rem, Fokus 2px `blau` mit 1px Abstand). Fehler, Hinweis und Pflicht für Applikationen ergänzt.
