// Rückfrage vor folgenreichen Handlungen (V-11, AF-157, C4-18): ersetzt window.confirm. Die Frage liegt in einem Signal; der
// Dialog ui/Bestaetigen.tsx zeigt sie (role alertdialog, Fokus auf Abbrechen, Esc bricht ab). Der Knopf zum Bestätigen nennt
// die Handlung, nie nur «OK». Ohne Oberfläche (Unit-Tests) beantwortet ein Abonnent des Signals die Frage.
// V-18 (A-12): die eine Dialogart für alle Rückfragen, auch Löschen mit Verweisen; der Titel ist eine Frage mit Handlung und
// Gegenstand («Risiko R-004 löschen?»), nie «Bitte bestätigen».
import type { ComponentChildren } from 'preact';
import { signal } from '@preact/signals';

export interface Frage {
  /** Frage oder Erklärung (Zeilenumbrüche bleiben erhalten) */
  text: string;
  /** Text des Knopfs, der die Handlung ausführt, z. B. «Eintrag entfernen» */
  ja: string;
  /** Text des Knopfs, der nichts tut (Standard: «Abbrechen») */
  nein?: string;
  /** Titel des Dialogs: Frage mit Handlung und Gegenstand, z. B. «Zwischenspeicher leeren?» (V-18) */
  titel: string;
  /** Zusätzlicher Inhalt unter dem Text, z. B. die Liste der Verweise beim Löschen */
  inhalt?: ComponentChildren;
  /** Handlung löscht oder verwirft etwas: Knopf in der Gefahrenfarbe statt in der Primärfarbe, Fokus auf Abbrechen */
  gefahr?: boolean;
}

export interface OffeneFrage extends Frage {
  antwort: (ja: boolean) => void;
}

export const offeneFrage = signal<OffeneFrage | null>(null);

/** Stellt die Frage und liefert true, wenn die Handlung bestätigt wurde; eine neue Frage beantwortet eine offene mit Nein */
export function bestaetigen(frage: Frage): Promise<boolean> {
  offeneFrage.value?.antwort(false);
  return new Promise<boolean>((aufloesen) => {
    let erledigt = false;
    offeneFrage.value = {
      ...frage,
      antwort: (ja) => {
        if (erledigt) return;
        erledigt = true;
        offeneFrage.value = null;
        aufloesen(ja);
      },
    };
  });
}
