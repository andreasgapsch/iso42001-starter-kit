// Zustand Beschäftigt für Knöpfe mit langer Arbeit (V-05, B5, Prüfung Dokumente und Download): aria-busy und gesperrt, solange
// die Arbeit läuft. Die Sperre im Ref greift sofort, auch wenn ein Doppelklick vor dem nächsten Zeichnen ein zweites Mal auslöst.
import { useRef, useState } from 'preact/hooks';

export function useBeschaeftigt(): [boolean, <T>(arbeit: () => Promise<T>) => Promise<T | undefined>] {
  const [an, setAn] = useState(false);
  const sperre = useRef(false);
  const lauf = async <T,>(arbeit: () => Promise<T>): Promise<T | undefined> => {
    if (sperre.current) return undefined;
    sperre.current = true;
    setAn(true);
    try {
      return await arbeit();
    } finally {
      sperre.current = false;
      setAn(false);
    }
  };
  return [an, lauf];
}

/**
 * Zweiter Klick eines Doppelklicks (MouseEvent.detail > 1). Ist die Arbeit schneller fertig als der Doppelklick, hebt die
 * Sperre den zweiten Klick nicht mehr auf (Firefox, Prüfung Dokumente und Download D2); Tastatur meldet detail 0.
 */
export const zweiterKlick = (e: { detail?: number }): boolean => (e.detail ?? 0) > 1;
