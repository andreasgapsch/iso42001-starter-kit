// Leiste nach einem Sprung aus der Prüfung (C-12): Rückweg und nächste Stelle derselben Regel, ohne Browsertaste.
import { signal } from '@preact/signals';
import { t } from '../i18n.ts';
import { routeZuHash } from '../logik/routen.ts';
import { route } from '../zustand/store.ts';

export const pruefSprung = signal<{ ziele: string[] } | null>(null);

/** Beim Klick auf «Zur Stelle»: alle Ziele der Gruppe merken */
export function sprungMerken(ziele: readonly string[]): void {
  pruefSprung.value = { ziele: [...ziele] };
}

export function SprungLeiste() {
  const s = pruefSprung.value;
  const r = route.value;
  if (!s || r.art === 'pruefung') return null;
  const jetzt = routeZuHash(r);
  const i = s.ziele.indexOf(jetzt);
  // Wechsel über das Menü auf eine andere Art von Seite beendet die Leiste; sie zeigte sonst alte Stände (C2-12)
  if (i < 0 && r.art !== 'gefuehrt' && r.art !== 'formular') return null;
  const ziel = i >= 0 ? s.ziele[i + 1] : s.ziele[0];
  const naechste = ziel === jetzt ? undefined : ziel;
  return (
    <nav class="sprung-leiste kein-druck" id="sprung-leiste" aria-label={t('sprung.leiste')}>
      <a class="knopf klein" id="sprung-zurueck" href={routeZuHash({ art: 'pruefung' })}>{t('sprung.zurueck')}</a>
      {naechste && <a class="knopf klein" id="sprung-naechste" href={naechste}>{t('sprung.naechste', { nr: i + 2, anzahl: s.ziele.length })}</a>}
      <button type="button" class="klein leise" id="sprung-schliessen" onClick={() => (pruefSprung.value = null)}>{t('sprung.schliessen')}</button>
    </nav>
  );
}
