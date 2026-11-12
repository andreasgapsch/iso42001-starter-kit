# Kennzahl

Eine Zahl, gross und breit, mit Beschriftung, optionaler Sparkline und Trend; in einer Reihe mit Haarlinien oder einzeln als Karte.

**Verwendung:** Übersicht des AIMS: umgesetzte Controls, Risiken über Akzeptanz, überfällige Prüfungen. Mehrere Kennzahlen stehen in `Kennzahlen` nebeneinander, getrennt durch `linie`, wie auf der Website. `rahmen: 'karte'` nur für eine einzelne Zahl.

**Was Sie liefern:** `beschriftung`, `wert` (Zahl oder Text), optional `einheit`, `stellen`, `verlauf` (Werte, ältester zuerst), `trend` (`text`, `richtung` auf/ab, `bewertung` als Status), `text`.

**Regeln:** Der Trend sagt in Worten, was sich änderte («1 weniger als im Vormonat»); die Pfeilform und die Statusfarbe sagen, ob das gut ist. Die Sparkline zeigt Verlauf ohne Achsen, ihr `aria-label` nennt alle Werte. Zahlen erscheinen sofort, nichts zählt hoch.

**Nicht:** Raster aus Kennzahl-Karten unterschiedlicher Grösse (Bento); mehr als vier Kennzahlen in einer Reihe.

Herkunft: `.kennzahlen`, `.kennzahl` der Website (Archivo 850, Breite 125 %, Einheit .5em). Sparkline, Trend und Kartenrahmen für Applikationen ergänzt.
