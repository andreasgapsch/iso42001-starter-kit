# Designpaket «AIMS Nachtblau»

Eigene Gestaltung des AIMS-Managers. Ersetzt in der App die «KMU-CIO Systemkarte» (bleibt als Archiv in `docs/design-system/`).

- `tokens.json`: Quelle aller Werte (Farben dunkel und hell, Statusfarben, Schrift, Abstände, Radien, Masse, Regeln)
- `tokens.css`: daraus erzeugte CSS-Variablen (dunkel Standard, hell über `data-theme="hell"` oder Systemeinstellung)
- `mockup-shell.html`: klickbares Mockup (Symbolleiste, Untermenü, Start, Guide, Bibliothek)

Regeln: Statusfarben nur mit Wort oder Symbol; Ampel, Risiko und Reife nie in Primärfarbe oder CI-Farben; eine Hauptaktion je Ansicht; Text mindestens 4,5:1, Bedienelemente 3:1; Druck und erzeugte Dokumente bleiben hell. Schrift Inter (SIL OFL 1.1).

Stand 0.1.1 (24.10.2026): Drei Werte der dunklen Fassung für den Kontrast angehoben, geprüft in `tests/unit/tokens-kontrast.test.ts`: `primaer_hover` #6169da (weisse Schrift 4,6:1), `status.kritisch_grund` mit Deckkraft 0,13 (Statustext auf eigenem Grund 4,6:1), `status.neutral` #99a2b6 (4,6:1 auch auf aktiv und hover). Die App übernimmt die Tokens in `src/app/stil.css`; der Test vergleicht beide.
