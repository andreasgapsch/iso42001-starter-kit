# Risikomatrix

Heatmap Wahrscheinlichkeit × Auswirkung (5×5 oder 4×4) mit Zellwert, Risikopunkten, Legende und Tabelle als Textalternative.

**Verwendung:** Risikobeurteilung (Etappe 6) und Übersicht des Risikoregisters. Die Matrix ist eine echte Tabelle: Spalten W 1 bis W n, Zeilen A n bis A 1, jede Zelle mit Wert W×A. Die Stufen folgen den Risikokriterien des Kits: tief bis `akzeptanzBis`, mittel dazwischen, hoch ab `unannehmbarAb`; optional `sehrHochAb`. Die höchste Stufe ist schraffiert. Risiken erscheinen als Pillen mit ihrer Kennung.

**Was Sie liefern:** `risiken` (`id`, `titel`, `w`, `a`), `groesse` (5 oder 4), `akzeptanzBis` und `unannehmbarAb` aus den Risikokriterien (Standard 4 und 12 bei 5×5, 3 und 6 bei 4×4), optional Bezeichnungen der Stufen (`bezeichnungenW`, `bezeichnungenA`), Achsennamen, `beschriftung`.

**Regeln:** Zellfarben nur aus `risiko-*`, Text darauf aus `auf-risiko-*`. Die Tabelle «Risiken als Tabelle» bleibt eingeschaltet; sie ist die Textalternative und sortiert nach Wert. Viele Risiken in einer Zelle brechen um; die Tabelle bleibt die vollständige Übersicht.

**Nicht:** Rot-Gelb-Grün; Zellen ohne Wert; Matrix als Bild.

Herkunft: für Applikationen ergänzt; Skalen und Schwellen aus dem Datenmodell des Starter-Kits (`risikokriterien`).
