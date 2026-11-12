// Hauptaktionen der Seitenköpfe (U-34): Texte «… erfassen» je Liste, Drucken, KI-System erfassen.
import { t } from '../i18n.ts';
import { eintragHinzufuegen } from '../ansichten/gefuehrt/aktionen.ts';
import { navigiere } from '../zustand/store.ts';
import { Symbol } from './symbole.tsx';
import { tr } from './text.ts';

/** «KI-System erfassen», «Risiko erfassen» …; Rückfall «Eintrag hinzufügen» */
export function erfassenText(liste: string): string {
  const s = tr(`aktion.erfassen.${liste}`);
  return s === `aktion.erfassen.${liste}` ? t('liste.neu') : s;
}

/** Drucken (Lese- und Übersichtsseiten); die Druckansicht zeigt nur den Titel, ohne Suche und Aktion */
export function DruckAktion({ text, primaer = true }: { text?: string; primaer?: boolean }) {
  return <button type="button" class={primaer ? 'primaer' : undefined} id="seite-drucken" onClick={() => globalThis.print()}><Symbol name="drucken" />{text ?? tr('aktion.drucken')}</button>;
}

/** Neues KI-System anlegen und im KI-Inventar öffnen (Start, Mockup «Neues KI-System erfassen») */
export function kiSystemErfassen(): void {
  const id = eintragHinzufuegen({ id: '', typ: 'liste', liste: 'kiSysteme' }, {});
  if (!id) return;
  navigiere({ art: 'formular', modul: 'inventar', id });
  requestAnimationFrame(() => document.querySelector<HTMLElement>('#editor-kiSysteme input, #editor-kiSysteme [role=combobox], #editor-kiSysteme textarea')?.focus());
}
