// «Dokumente erzeugen»: erzeugte Firmendokumente als neue Versionen (Entwurf) in die Bibliothek legen.
import { useEffect } from 'preact/hooks';
import type { Projekt } from '../../../model/typen.ts';
import { ablage, arbeit, bt, firmendokumenteAblegen, verbindungPruefen } from './zustand.ts';

export function InBibliothekLegen({ p, gesperrt }: { p: Projekt; gesperrt: boolean }) {
  useEffect(() => {
    void verbindungPruefen(p);
  }, [p.meta.projektId]);
  if (!ablage.value) return null;
  return (
    <button type="button" id="dokumente-bibliothek" disabled={gesperrt || !!arbeit.value} title={bt('hochladen.erzeugen_hinweis')} onClick={() => void firmendokumenteAblegen()}>
      {bt('aktion.erzeugen')}
    </button>
  );
}
