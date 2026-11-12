# Karte

Erhöhte Fläche für zusammengehörigen Inhalt; als Rollenkarte mit Leitung und Knoten oder als ganze klickbare Link-Karte.

**Verwendung**
- `standard`: Abschnitt auf `karte`, 1px `linie`, `radius`, Innenabstand bis 2rem; optional `etikett` und `titel` (1.3rem).
- `rolle`: Rollenkarte wie auf der Bühne der Website: Symbolfeld 48px (`blau-hauch`, `radius-symbol`), Etikett, Titel, Meta; links eine Leitung (`linie-stark`) mit Knoten in `blau`. `leitung` setzt die Länge, `false` lässt sie weg.
- `link`: ganze Karte als Link mit «Öffnen →», hebt sich beim Hover um 2px.

**Was Sie liefern:** Inhalt als `children`; je nach Variante `titel`, `etikett`, `meta`, `symbol` (Inline-SVG 32×32, Strich 1.4), `href`, `mehr`, `ebene` der Überschrift.

**Nicht:** Karten in Karten; Raster aus Karten unterschiedlicher Grösse (Bento); farbige Linksbalken; Rollenkarten ohne die Fläche, an der ihre Leitung hängt.

Herkunft: `.karte`, `.rolle`, `.kitkarte` der Website.
