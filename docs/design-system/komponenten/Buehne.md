# Buehne

Die abgerundete Bühne: Einstieg einer Applikation mit Gruss, breitem Titel in Grossbuchstaben, Lead, Aktionen und rechts angehängten Rollenkarten.

**Verwendung:** nur auf der Startansicht, einmal. Grund `buehne`, Rand `linie`, `radius-buehne`, `schatten-hoch`, Passermarken oben links und unten rechts. Der Titel steht in Archivo 900 mit Breite 125 % und der versetzten Haarlinien-Kontur in `blau`, dem einen verspielten Detail der Marke.

**Was Sie liefern:** `titel` (Zeichenkette oder Zeilen als Array), optional `gruss`, `lead` (höchstens 34 Zeichen breit gesetzt), Aktionen als `children` (ein Primärknopf, ein sekundärer) und `seite` (meist drei `Karte` mit `variante: 'rolle'`).

**Nicht:** Porträt und Scheibe der Website nachbauen; mehrere Bühnen; Bühne als Rahmen für Formulare.

Herkunft: `.buehne`, `.passer`, `.gruss`, `.name` aus `src/components/Hero.astro` und `komponenten.css` der Website, ohne Porträt und Orbit-Ring.
