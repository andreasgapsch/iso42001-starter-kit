# Navigationsleiste

Klebender Kopf mit Wortmarke, Hauptnavigation mit Knotenstrich unter der aktiven Seite und Werkzeugen rechts.

**Verwendung:** oben in jeder Ansicht der Applikation. Wortmarke «kmu-cio.» (Archivo 820, Breite 118 %, Punkt in `signal`) mit dem Applikationsnamen als `zusatz` in `gedaempft`. Einträge in `text`, aktiv in `tinte` mit 1.1rem langem, 2px starkem Strich in `blau`.

**Was Sie liefern:** `eintraege` (`text`, `href`, `aktiv`, optional `onClick`), optional `zusatz`, `markeHref`, `beschriftung` der Navigation; Werkzeuge als `children`: `Moduswahl` (Sonne und Mond, `aria-pressed`) und höchstens ein kleiner Primärknopf.

**Regeln:** fünf bis sechs Einträge; mehr gehören in eine Seitennavigation. Auf schmalen Bildschirmen scrollt die Navigation waagrecht. Die Moduswahl schaltet `data-theme` und speichert unter `kmu-cio-theme` (`Systemkarte.theme.umschalten()`).

Herkunft: `.kopf`, `.wortmarke`, `.hauptnav`, `.modus` aus `src/layouts/Base.astro` und `base.css`. Der orange Punkt ist der heutige Stand der Website und offen, bis das Logo steht.
