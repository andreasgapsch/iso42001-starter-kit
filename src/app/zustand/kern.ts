// Reiner Projektzustand ohne Browserabhängigkeiten: aendere(pfad, wert) und aendereMit(entwurf => …).
// Jede Änderung setzt meta.geaendert und meldet sich beim Beobachter (Zwischenspeicher, «ungespeichert»).
import { signal, type Signal } from '@preact/signals';
import type { Projekt } from '../../model/typen.ts';
import { lies, setze, type Pfad } from '../logik/pfad.ts';

export interface ProjektZustand {
  projekt: Signal<Projekt | null>;
  ungespeichert: Signal<boolean>;
  aendere(pfad: Pfad, wert: unknown): void;
  /** Für Listenoperationen: arbeitet auf einer Kopie (Entwurf) oder liefert ein neues Projekt zurück. */
  aendereMit(f: (entwurf: Projekt) => Projekt | void): void;
  laden(p: Projekt | null, ungespeichert?: boolean): void;
  lies(pfad: Pfad): unknown;
}

export function erstelleZustand(optionen: { beiAenderung?: (p: Projekt) => void; jetzt?: () => string; gesperrt?: () => boolean } = {}): ProjektZustand {
  const projekt = signal<Projekt | null>(null);
  const ungespeichert = signal(false);
  const jetzt = optionen.jetzt ?? (() => new Date().toISOString());
  const uebernehmen = (neu: Projekt) => {
    // Nur lesend geöffnet (AF-005): nichts wird geändert, nichts geschrieben
    if (optionen.gesperrt?.()) return;
    const mitZeit = { ...neu, meta: { ...neu.meta, geaendert: jetzt() } };
    projekt.value = mitZeit;
    ungespeichert.value = true;
    optionen.beiAenderung?.(mitZeit);
  };
  return {
    projekt,
    ungespeichert,
    aendere(pfad, wert) {
      const p = projekt.value;
      if (!p) return;
      if (Object.is(lies(p, pfad), wert)) return;
      uebernehmen(setze(p, pfad, wert));
    },
    aendereMit(f) {
      const p = projekt.value;
      if (!p) return;
      const entwurf = structuredClone(p);
      const r = f(entwurf);
      uebernehmen(r ?? entwurf);
    },
    laden(p, u = false) {
      projekt.value = p;
      ungespeichert.value = u;
    },
    lies(pfad) {
      return lies(projekt.value, pfad);
    },
  };
}
