// Zustand des Rahmens (Symbolleiste, Untermenü, Blatt «Mehr»), getrennt von Rahmen.tsx, damit Seitenkopf und Ansichten
// ihn ohne Zyklus lesen können. Breiten: unter 900 px Untermenü als Blatt, unter 640 px (Telefon) Symbolleiste unten.
import { signal } from '@preact/signals';
import { lokalLesen, lokalSchreiben } from '../lokal.ts';

/** Untermenü eingeklappt (Desktop, gemerkt) */
export const untermenueZu = signal(lokalLesen('untermenue') === 'zu');
/** Untermenü als Blatt geöffnet (unter 900 px) */
export const untermenueMobil = signal(false);
/** Blatt «Mehr» der unteren Leiste geöffnet (unter 640 px) */
export const mehrOffen = signal(false);

export function setzeUntermenueZu(zu: boolean): void {
  untermenueZu.value = zu;
  lokalSchreiben('untermenue', zu ? 'zu' : 'offen');
}

export const schmal = (): boolean => globalThis.matchMedia?.('(max-width: 899.98px)').matches ?? false;
export const telefon = (): boolean => globalThis.matchMedia?.('(max-width: 639.98px)').matches ?? false;

/**
 * Kopf kompakt zwischen 900 und 1279 px (V-20, A-15): Suche als Symbolknopf, Speicherstand nur mit Zeichen und der Stichtag in
 * der Zeile über dem Titel, damit der Seitenkopf auch mit langem Titel einzeilig bleibt.
 */
const KOMPAKT = '(min-width: 900px) and (max-width: 1279.98px)';
export const kopfKompakt = signal<boolean>(globalThis.matchMedia?.(KOMPAKT).matches ?? false);
globalThis.matchMedia?.(KOMPAKT).addEventListener?.('change', (e) => (kopfKompakt.value = e.matches));

/** 640 bis 1023 px (A-25): breite Tabellen legen Nebenspalten in die Zeile darunter; das Telefon zeigt Karten (A-03) */
const UNTER_1024 = '(min-width: 640px) and (max-width: 1023.98px)';
export const unter1024 = signal<boolean>(globalThis.matchMedia?.(UNTER_1024).matches ?? false);
globalThis.matchMedia?.(UNTER_1024).addEventListener?.('change', (e) => (unter1024.value = e.matches));

/** Breite als Signal (Wechsel über die Grenzen 640 und 900 px zeichnet neu) */
export const breite = signal<'telefon' | 'schmal' | 'breit'>(telefon() ? 'telefon' : schmal() ? 'schmal' : 'breit');
for (const q of ['(max-width: 639.98px)', '(max-width: 899.98px)']) {
  globalThis.matchMedia?.(q).addEventListener?.('change', () => {
    breite.value = telefon() ? 'telefon' : schmal() ? 'schmal' : 'breit';
    if (breite.value !== 'telefon') mehrOffen.value = false;
    if (breite.value === 'breit') untermenueMobil.value = false;
  });
}
