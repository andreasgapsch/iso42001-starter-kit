// Globale Fehlerbehandlung: unerwartete Fehler erscheinen in einem Dialog mit «Fehlerbericht kopieren».
// Der Bericht enthält keine Projektdaten, nur Version, Browser, Ansicht und Fehlermeldung.
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { t } from './i18n.ts';
import { fehlerAbbildung, technikText } from './worker/fehlertext.ts';

export interface FehlerInfo {
  meldung: string;
  stapel?: string;
  zeit: string;
}

export const fehler = signal<FehlerInfo | null>(null);
/** Der Zwischenspeicher schreibt gerade nicht (gesetzt vom Rahmen über den Speicherstatus) */
export const speicherFehler = signal(false);
let version = '';

export function setzeVersion(v: string): void {
  version = v;
}

export function meldeFehler(e: unknown): void {
  const stapel = e instanceof Error ? e.stack : undefined;
  fehler.value = { meldung: technikText(e), stapel, zeit: new Date().toISOString() };
}

/** Pfade im Stapel auf den Dateinamen kürzen: Der Bericht soll keinen Benutzernamen und Ordner verraten. */
export function stapelOhnePfad(stapel: string): string {
  return stapel.replace(/(?:file|https?):\/\/[^\s)]*\/([^\s)/]+)/g, '$1').replace(/\b[A-Za-z]:\\[^\s)]*\\([^\s)\\]+)/g, '$1');
}

export function fehlerbericht(f: FehlerInfo): string {
  return [
    `AIMS-Manager ${version}`,
    `Zeit: ${f.zeit}`,
    `Browser: ${globalThis.navigator?.userAgent ?? ''}`,
    `Ansicht: ${globalThis.location?.hash.replace(/\/[A-Z]{1,3}-\d+.*$/, '/…') ?? ''}`,
    `Fehler: ${stapelOhnePfad(f.meldung)}`,
    '',
    stapelOhnePfad((f.stapel ?? '').split('\n').slice(0, 12).join('\n')),
  ].join('\n');
}

export function installiereFehlerbehandlung(): void {
  globalThis.addEventListener('error', (e) => {
    // Ressourcenfehler (ohne error-Objekt) und ResizeObserver-Rauschen ignorieren
    if (!e.error || /ResizeObserver/.test(technikText(e))) return;
    e.preventDefault();
    meldeFehler(e.error);
  });
  globalThis.addEventListener('unhandledrejection', (e) => {
    e.preventDefault();
    meldeFehler(e.reason);
  });
}

export function FehlerDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const f = fehler.value;
  useEffect(() => {
    if (f && !ref.current?.open) ref.current?.showModal();
  }, [f]);
  if (!f) return null;
  const bericht = fehlerbericht(f);
  // Ursache und nächster Schritt in Klartext, wo der Rohtext bekannt ist; der Rohtext selbst steht nur in der Technikzeile des Berichts
  const ursache = fehlerAbbildung(f.meldung);
  return (
    <dialog ref={ref} onClose={() => (fehler.value = null)} aria-labelledby="fehler-titel" id="fehler-dialog">
      <h2 id="fehler-titel">{t('fehler.titel')}</h2>
      {/* Nicht mehr versprechen als wahr ist: Zwischenspeicher kann voll oder gesperrt sein */}
      <p>{speicherFehler.value ? t('fehler.text_ohne_speicher') : t('fehler.text')}</p>
      {ursache && <p id="fehler-ursache"><strong>{t('fehler.ursache')}:</strong> {ursache}</p>}
      {/* Der Rohtext steht nur hier, eingeklappt: sichtbar bleiben Ursache und nächster Schritt */}
      <details id="fehler-technik">
        <summary>{t('fehler.technik')}</summary>
        <pre class="fehlerbericht">{bericht}</pre>
      </details>
      <div class="leiste ende">
        <button type="button" onClick={() => void navigator.clipboard?.writeText(bericht).catch(() => undefined)}>{t('fehler.kopieren')}</button>
        <button type="button" class="primaer" onClick={() => ref.current?.close()}>{t('fehler.schliessen')}</button>
      </div>
    </dialog>
  );
}
