# Zeitleiste

Fahrplan und Fristen als senkrechte Leitung mit Datum, Titel und Zustand, mit einer Markierung für heute.

**Verwendung:** Fahrplan bis zur Stage-1-Bereitschaft, Prüftermine, Fristen. Erledigt: voller Knoten, Titel leichter. Aktiv: grosser Knoten. Offen: hohler Knoten. Bald fällig: Dreieck und Pille «in 3 Tagen». Überfällig: Raute und Pille «überfällig». «Heute» ist eine gestrichelte Linie in `blau`.

**Was Sie liefern:** `eintraege` mit `titel`, `datum` (sichtbar), `iso` (für `<time datetime>`), `zustand` (`erledigt`, `aktiv`, `offen`, `warnung`, `ueberfaellig`), optional `text`, `statusText`; `heute` mit `vorIndex` und `text`; `beschriftung`.

**Regeln:** chronologisch, älteste oben. Überfälliges bleibt an seinem Datum stehen, es rutscht nicht nach oben. Daten im Schweizer Format.

Herkunft: `.laufbahn` der Website. Fristen, Statusformen und Heute-Markierung für Applikationen ergänzt.
