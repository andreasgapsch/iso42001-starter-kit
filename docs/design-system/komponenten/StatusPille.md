# StatusPille

Ein Status als Wort mit Form und Farbe, als Pille oder als ruhiger Punkt.

**Verwendung:** in Tabellen, Karten und Kopfzeilen, wo ein Zustand auf einen Blick lesbar sein muss. `stil: 'pille'` (Standard) auf `status-<s>-hauch` mit Text in `status-<s>`; `stil: 'punkt'` mit Text in `gedaempft` wie die Statuspunkte der Website, für ruhige Listen.

**Was Sie liefern:** `status` (`gut`, `warnung`, `kritisch`, `neutral`, `info`) und das Wort als `children` («umgesetzt», «überfällig», «nicht bewertet»).

**Formen:** gut Kreis mit Haken, warnung Dreieck mit Ausrufezeichen, kritisch Raute mit Ausrufezeichen, neutral hohler Kreis, info Kreis mit i. Die Form (`StatusSymbol`) ist auch einzeln verwendbar, etwa in der Zeitleiste.

**Nicht:** Farbe ohne Wort; eigene Status-Farben; mehr als ein Status je Zelle.

Herkunft: `.status` der Website (Punkt 7px, .76rem, 620). Pille, Formen und die Statusfarben für Applikationen ergänzt.
