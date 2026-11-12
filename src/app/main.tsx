// Einstieg des AIMS-Managers: Fehlerbehandlung, Theme, Sprache, Speicher, erstes Zeichnen.
import { render } from 'preact';
import { App } from './App.tsx';
import { appDaten } from './daten.ts';
import { installiereFehlerbehandlung, meldeFehler, setzeVersion } from './Fehler.tsx';
import { setzeUiSprache, t, uiSprache } from './i18n.ts';
import { ladeNormpaket } from './normtexte/zustand.ts';
import { holeSpeicher, projekt, speicherStarten, ungespeichert, wendeThemeAn } from './zustand/store.ts';
import './stil.css';
import { fehlerVerstaendlich } from './worker/fehlertext.ts';
import { fokusHalten } from './ui/fokus-halten.ts';
import { druckrahmenStarten } from './rahmen/Druckrahmen.tsx';

installiereFehlerbehandlung();
fokusHalten();
druckrahmenStarten();
wendeThemeAn();
setzeUiSprache(uiSprache.value);
setzeVersion(appDaten().version);

globalThis.addEventListener('beforeunload', (e) => {
  if (projekt.value && ungespeichert.value) {
    e.preventDefault();
    // Ältere Browser zeigen die Rückfrage nur mit gesetztem returnValue
    (e as unknown as { returnValue: string }).returnValue = '';
  }
});
// Beim Verlassen oder Verstecken sofort zwischenspeichern
const sichern = () => {
  if (projekt.value) void holeSpeicher().zwischenspeichern();
};
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && sichern());
globalThis.addEventListener('pagehide', sichern);

const ziel = document.getElementById('app')!;

/** Letzte Schranke: fällt der Fehler vor oder beim ersten Zeichnen, gibt es noch keinen Dialog. Text direkt ins DOM, ohne Preact. */
function statischeMeldung(e: unknown): void {
  ziel.textContent = '';
  const h = document.createElement('h1');
  h.textContent = t('fehler.start_titel');
  const p = document.createElement('p');
  p.textContent = t('fehler.start_text');
  const d = document.createElement('pre');
  // Der Rohtext gehört in die Konsole (Technik), nicht auf die Seite
  console.error(e);
  d.textContent = fehlerVerstaendlich(e);
  const k = document.createElement('a');
  k.href = '#/start';
  k.textContent = t('fehler.start_link');
  k.addEventListener('click', () => {
    globalThis.location.hash = '#/start';
    globalThis.location.reload();
  });
  const m = document.createElement('main');
  m.id = 'start-fehlerseite';
  m.append(h, p, d, k);
  ziel.append(m);
}

speicherStarten()
  .catch((e: unknown) => meldeFehler(e))
  .finally(() => {
    try {
      render(<App />, ziel);
    } catch (e) {
      statischeMeldung(e);
      return;
    }
    requestAnimationFrame(() =>
      setTimeout(() => {
        performance.mark('bedienbar');
        document.body.dataset['bedienbar'] = '1';
        // Normpaket (eigene Normtexte der Firma, getrennt vom Projekt) erst nach dem Start laden
        ladeNormpaket()
          .catch(() => undefined)
          .finally(() => (document.body.dataset['normpaket'] = '1'));
      }, 0),
    );
  });
