# Hinweis

Ruhige Notiz mit gestricheltem Rand oder Banner mit Status, Titel, Text und optionaler Aktion.

**Verwendung:** ohne `status` für Erklärungen am Rand («Ihre Daten bleiben auf diesem Gerät.»), in `gedaempft` mit Rand `linie-stark` gestrichelt. Mit `status` als Banner auf `status-<s>-hauch`, Rand `status-<s>-flaeche`, Titel in `status-<s>`, Text in `tinte`.

**Was Sie liefern:** `children` (ein bis zwei Sätze), optional `status`, `titel`, `aktion` (ein kleiner Knopf) und `rolle` (`status` oder `alert` für Meldungen, die nach einer Aktion erscheinen).

**Regeln:** Ein Banner je Ansicht oben im Inhalt; mehrere Meldungen fassen Sie zusammen. Der Titel sagt das Ergebnis, der Text das Nächste. Kein farbiger Linksbalken, der Rahmen läuft rundum.

Herkunft: `.hinweis` der Website (.9rem, gestrichelt, `radius-klein`). Status-Banner für Applikationen ergänzt.
