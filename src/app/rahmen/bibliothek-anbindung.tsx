// Anbindung des Bereichs Bibliothek (src/app/ansichten/bibliothek, eigenständig gebaut): Ansicht und Untermenü werden
// über import.meta.glob eingebunden. Fehlen die Dateien, bleibt der Build ganz und der Rahmen zeigt einen Platzhalter.
import type { ComponentType } from 'preact';
import type { Projekt } from '../../model/typen.ts';
import type { MenueGruppe } from './menue-typen.ts';
import { tr } from './text.ts';
import { Seitenkopf } from './Seitenkopf.tsx';

type AnsichtModul = { Bibliothek?: ComponentType<{ unterbereich?: string }> };
type MenueModul = { bibliothekMenue?: (p: Projekt) => MenueGruppe[] };

type ZustandModul = { verbindung?: { value: string }; verbindungPruefen?: (p: Projekt) => Promise<void> };
const zustaende = import.meta.glob<ZustandModul>('../ansichten/bibliothek/zustand.ts', { eager: true });

/** Ablage der Bibliothek in dieser Sitzung tatsächlich verbunden (Ordner mit Berechtigung oder Browserspeicher; U-10) */
export function bibliothekVerbunden(): boolean {
  const v = Object.values(zustaende)[0]?.verbindung?.value;
  return v === 'ordner' || v === 'browser';
}
/** Verbindung für das Projekt prüfen (einmal je Projekt), z. B. für «Erste Schritte» auf der Startseite */
export function bibliothekPruefen(p: Projekt): void {
  void Object.values(zustaende)[0]?.verbindungPruefen?.(p);
}

const ansichten = import.meta.glob<AnsichtModul>('../ansichten/bibliothek/Bibliothek.tsx', { eager: true });
const menues = import.meta.glob<MenueModul>('../ansichten/bibliothek/menue.ts', { eager: true });

/** Ansicht der Bibliothek oder null, solange sie fehlt */
export const BibliothekAnsicht: ComponentType<{ unterbereich?: string }> | null = Object.values(ansichten)[0]?.Bibliothek ?? null;

/** Untermenü der Bibliothek; ohne Bibliothek ein einzelner Eintrag zum Platzhalter */
export function bibliothekGruppen(p: Projekt): MenueGruppe[] {
  const f = Object.values(menues)[0]?.bibliothekMenue;
  if (f) {
    try {
      return f(p);
    } catch {
      /* Rückfall unten: ein Fehler im Menü der Bibliothek darf den Rahmen nicht brechen */
    }
  }
  return [{ punkte: [{ id: '', titel: tr('bibliothek.alle'), icon: 'bibliothek' }] }];
}

export function BibliothekPlatzhalter() {
  return (
    <div class="inhalt">
      <Seitenkopf titel={tr('bereich.bibliothek')} />
      <p class="ersatz" id="bibliothek-platzhalter">{tr('bibliothek.platzhalter')}</p>
    </div>
  );
}
