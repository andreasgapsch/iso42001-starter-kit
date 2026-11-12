# BalkenGestapelt

Gestapelte Balken je Zeile, etwa der Umsetzungsgrad der SoA je Kapitel von Anhang A, mit Legende und Wert am Ende.

**Verwendung:** Anteile, die zusammen ein Ganzes ergeben: umgesetzt, teilweise, offen, nicht anwendbar. Segmente in `status-*-flaeche` oder `kat-*`, getrennt durch 2px Grund; «teilweise» schraffiert. Rechts steht der Anteil der ersten Kategorie in Prozent oder ein eigener Text.

**Was Sie liefern:** `kategorien` (`schluessel`, `text`, `ton`, optional `muster`) in der Reihenfolge der Stapel und `zeilen` (`titel`, `werte` je Schlüssel, optional `summe`); `beschriftung` der Liste.

**Regeln:** erste Kategorie ist die erwünschte (umgesetzt), «nicht anwendbar» zuletzt. Jede Zeile hat ein `aria-label` mit allen Werten. Höchstens fünf Kategorien.

Herkunft: für Applikationen ergänzt.
