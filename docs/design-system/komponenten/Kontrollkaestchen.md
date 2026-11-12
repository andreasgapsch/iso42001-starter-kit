# Kontrollkaestchen

Ja-nein-Auswahl oder Mehrfachauswahl mit Beschriftung rechts und optionalem Hinweis.

**Verwendung:** für unabhängige Aussagen, die zutreffen oder nicht («Personendaten werden verarbeitet»). Gruppen mehrerer Kästchen stehen untereinander mit `abstand-4` und unter einer gemeinsamen Überschrift (`fieldset`/`legend` liefert die Applikation).

**Was Sie liefern:** `beschriftung`, `aktiv` (angehakt) und `onChange`; optional `id`, `name`, `wert`, `hinweis`, `deaktiviert`.

**Regeln:** Die Beschriftung ist eine Aussage, keine Frage. Angehakt ist `blau` mit Haken in `auf-blau`, leer ist `karte` mit Rand `kontur` (mind. 3:1).

Herkunft: für Applikationen ergänzt, aus `kontur`, `blau` und `radius-code`.
