// Dialog zur Rückfrage (V-11, V-18, Designsystem AIMS Nachtblau): die eine Dialogart der App. role alertdialog, modal, Titel als
// Frage mit Handlung (aria-labelledby), Esc schliesst ohne Handlung, der zweite Knopf nennt die Handlung. Fokus: bei Gefahr
// (Löschen, Verwerfen) auf «Abbrechen», sonst auf der Handlung. Die Frage kommt aus zustand/bestaetigen.ts (bestaetigen()).
import { useLayoutEffect, useRef } from 'preact/hooks';
import { t } from '../i18n.ts';
import { offeneFrage } from '../zustand/bestaetigen.ts';

export function Bestaetigen() {
  const f = offeneFrage.value;
  const ref = useRef<HTMLDialogElement>(null);
  const nein = useRef<HTMLButtonElement>(null);
  const ja = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const d = ref.current;
    if (!f || !d) return;
    // Fokus nach der Antwort zurück zum auslösenden Knopf, sofern es ihn noch gibt
    const vorher = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!d.open) d.showModal();
    (f.gefahr ? nein : ja).current?.focus();
    return () => {
      if (d.open) d.close();
      if (vorher?.isConnected) vorher.focus();
    };
  }, [f]);
  if (!f) return null;
  return (
    <dialog ref={ref} class="bestaetigen" id="bestaetigen" role="alertdialog" aria-modal="true" aria-labelledby="bestaetigen-titel" aria-describedby="bestaetigen-text"
      onCancel={(e) => {
        e.preventDefault();
        f.antwort(false);
      }}>
      <h2 id="bestaetigen-titel">{f.titel}</h2>
      <p id="bestaetigen-text" class="vorformatiert">{f.text}</p>
      {f.inhalt && <div class="bestaetigen-inhalt">{f.inhalt}</div>}
      <div class="leiste ende">
        <button type="button" id="bestaetigen-nein" ref={nein} onClick={() => f.antwort(false)}>{f.nein ?? t('allgemein.abbrechen')}</button>
        <button type="button" id="bestaetigen-ja" ref={ja} class={f.gefahr ? 'gefahr' : 'primaer'} onClick={() => f.antwort(true)}>{f.ja}</button>
      </div>
    </dialog>
  );
}
