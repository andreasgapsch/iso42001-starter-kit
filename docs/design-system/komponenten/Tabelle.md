# Tabelle

Daten in Zeilen und Spalten mit Haarlinien, Zahlen rechtsbündig in tabular-nums; «dicht» für Register.

**Verwendung:** KI-Inventar, Risikoregister, SoA, Nachweise. Kopf in `gedaempft` (.8rem, 600, Sperrung .03em) über einer Linie `linie-stark`, Zeilen getrennt durch `linie`, erste Spalte als Zeilenkopf in `tinte` und 600. `dicht` verringert Zellabstand und Schrift für lange Listen.

**Was Sie liefern:** `spalten` (`schluessel`, `titel`, optional `zahl`, `stellen`, `text`, `breite`) und `zeilen` als Objekte; Zellen dürfen Elemente enthalten, z. B. eine `StatusPille`. Optional `beschriftung` (caption), `leer` für den Leerzustand.

**Regeln:** Zahlen mit Dezimalkomma und Apostroph als Tausendertrenner (macht die Komponente). Status in einer eigenen Spalte als Pille mit Wort. Keine Zebrastreifen, keine senkrechten Linien. Sortierung und Filter liefert die Applikation.

Herkunft: `.tabelle` der Website (Zellen .8rem, Kopf .5rem). Dichte Variante, Zahlenspalten und Hover in `blau-hauch` für Applikationen ergänzt.
