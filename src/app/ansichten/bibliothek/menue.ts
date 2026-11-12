// Untermenü des Bereichs Bibliothek (Rahmen R2): Dokumentarten und Arbeitsliste mit Zählern.
import { zaehler, type Unterbereich } from '../../../bibliothek/sicht.ts';
import type { Projekt } from '../../../model/typen.ts';
import type { MenueGruppe, MenuePunkt } from '../../rahmen/menue-typen.ts';
import { stichtag } from '../../zustand/store.ts';
import { bt, sicht } from './zustand.ts';

export function bibliothekMenue(projekt: Projekt | null): MenueGruppe[] {
  const z = projekt ? zaehler(sicht(projekt), stichtag.value) : null;
  // Vorlagen ohne Zähler (immer alle des Kits); «Zu prüfen» als Warnung bei überfälligen Prüfungen
  const punkt = (id: Unterbereich, icon: string, mitZahl = true): MenuePunkt => ({
    id,
    titel: bt(`unter.${id}`),
    icon,
    ...(mitZahl && z?.[id] ? { zahl: z[id] } : {}),
    ...(id === 'pruefen' && z?.ueberfaellig ? { warn: true } : {}),
  });
  return [
    { punkte: [punkt('alle', 'bibliothek'), punkt('firma', 'doc'), punkt('eigene', 'hoch'), punkt('nachweise', 'haken'), punkt('vorlagen', 'tabelle', false), punkt('recht', 'pdf')] },
    { name: bt('menue.arbeitsliste'), punkte: [punkt('pruefen', 'kalender'), punkt('entwurf', 'doc'), punkt('ersetzt', 'ordner')] },
  ];
}
