# Fortschritt

Fortschrittsbalken als Leitung mit Knoten am Ende, mit Beschriftung und Wert als Text.

**Verwendung:** Stand des geführten Modus, Anteil umgesetzter Controls, vorhandene Nachweise. Bahn in `linie-stark`, Füllung in `blau` oder `status-<ton>-flaeche`, Knoten mit Ring im Grundton.

**Was Sie liefern:** `beschriftung`, `wert`, optional `max` (Standard 100), `anzeige` («26 von 38»; sonst Prozent) und `ton`.

**Regeln:** Der Wert steht immer als Text daneben. Keine Animation beim Laden, kein Hochzählen. Für mehrere Kategorien je Zeile nehmen Sie `BalkenGestapelt`.

Herkunft: für Applikationen ergänzt, aus dem Motiv Knoten und Leitung (`knoten-ring`, `radius-pille`).
