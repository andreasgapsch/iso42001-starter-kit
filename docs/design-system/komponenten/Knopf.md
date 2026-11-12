# Knopf

Löst eine Aktion aus; «primaer» höchstens einmal je Ansicht, für das, wofür die Ansicht da ist.

**Verwendung**
- `primaer` (blau gefüllt, `auf-blau`): die eine Hauptaktion, z. B. «Entwurf speichern», «Freigeben».
- `sekundaer` (Standard; Rand `kontur`, Text `tinte`): gleichrangige Nebenaktionen.
- `ruhig` (nur Text in `blau`): Abbrechen, Zurück, Aktionen in Tabellenzeilen.
- `gefahr` (`status-kritisch-flaeche`): Löschen und Unumkehrbares, immer mit Rückfrage davor.
- `groesse: 'klein'` im Kopf, in Tabellen und Bannern.

**Was Sie liefern:** den Text als `children` (Verb zuerst), `onClick` oder `typ: 'submit'`; `href` macht daraus einen Link im Knopfstil. `beschaeftigt` während einer laufenden Aktion, `deaktiviert` nur, wenn die Ansicht erklärt, warum. Knöpfe ohne Text brauchen `beschriftung`.

**Nicht:** zwei Primärknöpfe nebeneinander; Gefahr-Knopf als Primäraktion; Ausrufezeichen oder Emojis im Text.

Herkunft: `.knopf`, `.knopf--voll`, `.knopf--rand`, `.knopf--klein` der Website (Pille 999px, min. 2.75rem, Archivo 620). `ruhig` und `gefahr` für Applikationen ergänzt.
