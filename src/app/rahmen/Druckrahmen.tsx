// Kopf und Fuss jedes Ausdrucks (A-06, V-14, G8): Organisation und Stand im Kopf, «Organisation · Stand» und
// «Seite x / y» im Fuss, ohne Bezug zum Kit. Chromium setzt die Randfelder von @page (Regel über CSSOM, weil die Felder nur feste
// Texte kennen und die CSP keine eingefügten <style> erlaubt). Firefox und WebKit kennen keine Randfelder: dort stehen Kopf und
// Fuss als Kopf- und Fusszeile einer Tabelle um die Ansicht, die beide Engines auf jeder Druckseite wiederholen (ohne Seitenzahl,
// wie beim Stage-1-Bericht, B12).
// Der Stage-1-Bericht setzt seinen eigenen Fuss (Stage1Bericht.tsx); seine spätere Regel hat Vorrang.
import type { ComponentChildren } from 'preact';
import { effect, signal } from '@preact/signals';
import { datumText, t, uiSprache } from '../i18n.ts';
import { projekt, stichtag } from '../zustand/store.ts';

let entfernen: (() => void) | null = null;

/** Name des Ausdrucks (Titel der Ansicht, z. B. «Lagebild»); setzt Rahmen.tsx bei jeder Ansicht (V-22) */
export const ausdruckTitel = signal('');
/**
 * Dokumenttitel während des Drucks (V-22, A-19, G8): «<Ausdruck> · <Organisation> · Stand <Datum>», ohne «AIMS-Manager». Der
 * Titel ist die einzige Stelle, die Firefox und Safari in ihre eigenen Kopfzeilen übernehmen. Rahmen.tsx nimmt ihn, solange
 * gedruckt wird, statt des Titels der Registerkarte.
 */
export const druckTitel = signal<string | null>(null);

function titelFuerDruck(): string | null {
  const p = projekt.value;
  if (!p) return null;
  const bericht = document.body.classList.contains('druck-bericht') ? document.querySelector('#druck-bericht h1')?.textContent?.trim() : undefined;
  const ausdruck = bericht || ausdruckTitel.value || document.querySelector('main h1')?.textContent?.trim() || '';
  return [ausdruck, p.organisation.name || t('kopf.ohne_name'), t('druck.stand', { datum: datumText(stichtag.value) })].filter(Boolean).join(' · ');
}

/** Text für content: in Anführungszeichen, Zeilenumbrüche und Anführungszeichen entschärft */
const inhaltText = (x: string) => `"${x.replace(/[\\"]/g, '\\$&').replace(/\s+/g, ' ')}"`;

function regelSetzen(org: string, stand: string): boolean {
  entfernen?.();
  entfernen = null;
  const blatt = document.styleSheets[0];
  if (!blatt) return false;
  const links = `${org} · ${stand}`;
  try {
    const i = blatt.insertRule(
      `@page { @top-left { content: ${inhaltText(org)}; font-family: 'Inter Variable', sans-serif; font-size: 9pt; color: #3d444d; } `
      + `@top-right { content: ${inhaltText(stand)}; font-family: 'Inter Variable', sans-serif; font-size: 9pt; color: #3d444d; } `
      + `@bottom-left { content: ${inhaltText(links)}; font-family: 'Inter Variable', sans-serif; font-size: 9pt; color: #3d444d; } `
      + `@bottom-right { content: ${inhaltText(t('stage1.seite'))} " " counter(page) " / " counter(pages); font-family: 'Inter Variable', sans-serif; font-size: 9pt; color: #3d444d; } }`,
      blatt.cssRules.length,
    );
    const regel = blatt.cssRules[i]!;
    entfernen = () => {
      const j = [...blatt.cssRules].indexOf(regel);
      if (j >= 0) blatt.deleteRule(j);
    };
    if (!regel.cssText.includes('@bottom-left')) {
      entfernen();
      entfernen = null;
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Hält die Regel aktuell (Projekt, Stichtag, Sprache); data-druck-raender sagt dem CSS, ob die festen Elemente nötig sind. */
export function druckrahmenStarten(): void {
  let vorher: string | null = null;
  globalThis.addEventListener('beforeprint', () => {
    const titel = titelFuerDruck();
    if (!titel) return;
    if (druckTitel.value === null) vorher = document.title;
    druckTitel.value = titel;
    document.title = titel;
  });
  globalThis.addEventListener('afterprint', () => {
    if (druckTitel.value === null) return;
    druckTitel.value = null;
    if (vorher !== null) document.title = vorher;
    vorher = null;
  });
  effect(() => {
    const p = projekt.value;
    void uiSprache.value;
    if (!p) {
      entfernen?.();
      entfernen = null;
      return;
    }
    const ok = regelSetzen(p.organisation.name || t('kopf.ohne_name'), t('druck.stand', { datum: datumText(stichtag.value) }));
    document.documentElement.toggleAttribute('data-druck-raender', ok);
  });
}

/**
 * Rückfall für Engines ohne Randfelder (Firefox, WebKit; Prüfung test.7 N4): die Ansicht steht in einer Tabelle (CSS display: table), deren
 * Kopf (table-header-group) und Fuss (table-footer-group) die Engines im Druck auf jeder Seite wiederholen und für die sie Platz lassen, wie beim Stage-1-Bericht
 * (B12). Am Bildschirm und in Chromium (Randfelder) wirken Tabelle, Zeile und Zelle wie nicht vorhanden (display: contents).
 */
export function DruckRahmen({ children }: { children: ComponentChildren }) {
  const p = projekt.value;
  if (!p) return <>{children}</>;
  const org = p.organisation.name || t('kopf.ohne_name');
  const stand = t('druck.stand', { datum: datumText(stichtag.value) });
  // Elemente div statt table/tr/td: die Ansicht bleibt im DOM ohne Tabellenzeile um alles (Tests und Hilfsmittel suchen Zeilen)
  return (
    <div class="druck-rahmen">
      <div class="druck-rahmen-kopf" aria-hidden="true"><div class="druck-rahmen-zelle"><div class="druck-kopf-fest"><span>{org}</span><span>{stand}</span></div></div></div>
      <div class="druck-rahmen-koerper"><div class="druck-rahmen-zeile"><div class="druck-rahmen-inhalt">{children}</div></div></div>
      {/* V-22: Ersatzfuss ohne Seitenzahl (die zählt nur in den Randfeldern), mit dem Namen des Ausdrucks */}
      <div class="druck-rahmen-fuss" aria-hidden="true"><div class="druck-rahmen-zelle"><div class="druck-fuss-fest"><span>{org} · {stand}</span><span>{ausdruckTitel.value}</span></div></div></div>
    </div>
  );
}
