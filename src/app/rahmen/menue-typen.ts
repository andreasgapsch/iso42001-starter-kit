/**
 * Gemeinsame Typen für das Untermenü des Rahmens (R2).
 * Wird vom Rahmen und von den Bereichen (z. B. Bibliothek) genutzt.
 */

/** Ein Eintrag im Untermenü eines Bereichs. */
export interface MenuePunkt {
  /** Unterbereich-Kennung, wird an die Route des Bereichs angehängt (#/<bereich>/<id>). */
  id: string
  /** Sichtbarer Titel (bereits übersetzt). */
  titel: string
  /** Name eines Symbols aus src/app/rahmen/symbole.tsx (z. B. "ordner", "datei"). */
  icon: string
  /** Optionaler Zähler rechts im Eintrag. */
  zahl?: number
  /** Zähler als Warnung (fällig/offen) hervorheben. */
  warn?: boolean
}

/** Eine Gruppe im Untermenü, optional mit Überschrift. */
export interface MenueGruppe {
  name?: string
  punkte: MenuePunkt[]
}
