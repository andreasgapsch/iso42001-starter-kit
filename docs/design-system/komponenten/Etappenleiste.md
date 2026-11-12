# Etappenleiste

Etappen als Leitung mit Knoten, waagrecht oder senkrecht; erledigte Strecke in Blau, die aktuelle Etappe mit grossem Knoten.

**Verwendung:** geführter Modus (E0 bis E13), Unterschritte einer Etappe (senkrecht), Fahrplan-Phasen. Erledigt: voller Knoten und blaue Strecke (2px) bis zur nächsten Etappe. Aktiv: `knoten-gross` mit Ring in `blau-hauch`, `aria-current="step"`. Offen: hohler Knoten, Titel leichter.

**Was Sie liefern:** `schritte` mit `titel`, `zustand` (`erledigt`, `aktiv`, `offen`) und optional `kuerzel`, `text`, `meta` (z. B. Dauer), `href` oder `onClick`; `ausrichtung`, `beschriftung` (aria-label).

**Regeln:** Der Zustand steht auch als Wort in der Meta-Zeile. Waagrecht passen sechs bis sieben Etappen; mehr scrollen waagrecht oder laufen senkrecht.

**AIMS-Manager (Für Applikationen ergänzt):** Der Knoten trägt den Zustand als Form: vollständig Kreis mit Haken in `status-gut-flaeche`, teilweise Teilkreis in `blau` (Sektor nach Anteil erledigter Seiten), offen hohler Kreis. Die aktuelle Etappe hat zusätzlich eine Fläche in `blau-hauch` mit Rand `blau`, ihren vollen Titel, «Sie sind hier» und die Seite («Seite 7 von 10»). Die übrigen Etappen zeigen Kurztitel mit Silbentrennung (`hyphens: auto`, `lang`), der volle Titel steht im Tooltip und für Bildschirmleser. Reicht der Platz nicht, zeigt die Leiste nur die Nummern; Beschriftungen überlappen nie (`src/grafik/preact/Diagramme.tsx`, Modus `kurz` oder `nummern`).

Herkunft: `.leitung` (waagrecht) und `.laufbahn` (senkrecht) der Website. Zustände und erledigte Strecke für Applikationen ergänzt.
