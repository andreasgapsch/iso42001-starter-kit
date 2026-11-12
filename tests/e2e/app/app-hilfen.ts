// Gemeinsame Hilfen der E2E-Tests des AIMS-Managers (file://, drei Engines).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test as basis, type Page } from '@playwright/test';
import type { Projekt } from '../../../src/model/typen.ts';
import { vollstaendigesProjekt } from '../../fixtures/projekt.ts';
import { TMP, dateiUrl } from '../spikes/hilfen.ts';
import { waehle } from '../auswahl-hilfen.ts';

export const HTML = 'dist/app/aims-manager.html';
export const ORDNER = join(TMP, '..', 'app-e2e');


export function fixtureDatei(name: string, mitIsms = false, aendern?: (p: Projekt) => void): string {
  mkdirSync(ORDNER, { recursive: true });
  // Engines laufen parallel: Dateiname je Engine und Test eindeutig
  name = `${test.info().project.name}-${test.info().testId}-${test.info().repeatEachIndex}-${name}`;
  const p = vollstaendigesProjekt();
  p.meta.mitIsms = mitIsms;
  aendern?.(p);
  const datei = join(ORDNER, name);
  writeFileSync(datei, JSON.stringify(p, null, 2));
  return datei;
}

/** Fehlerlisten der Seiten je Test (starte() legt sie an, der automatische Haken wertet sie nach dem Test aus) */
const listen = new Map<string, string[][]>();

/**
 * `test` mit automatischem Haken (AF-031, QK-16): Nach jedem Test, der starte() aufruft, gilt: CSP-Verletzungen 0 und Netzwerkanfragen 0.
 * Alle E2E des AIMS-Managers importieren dieses `test` statt `@playwright/test`. Ausnahme nur mit der Anmerkung `haken-aus` samt
 * Grund (nur der Test des Hakens selbst). Ohne starte() laufen die Spikes (spikes/) und die Kit-Tests (kit/): Sie prüfen das
 * Verhalten der CSP und der Dateien selbst und haben keine Seite des AIMS-Managers; aiact-links.e2e.ts liest nur Dateien.
 */
export const test = basis.extend<{ haken: void }>({
  haken: [
    async ({}, use, info) => {
      await use();
      const gemeldet = (listen.get(info.testId) ?? []).flat().filter((m) => /^(CSP|NETZ): /.test(m));
      listen.delete(info.testId);
      if (info.annotations.some((a) => a.type === 'haken-aus')) return;
      expect(gemeldet, 'CSP-Verletzungen und Netzwerkanfragen (AF-031)').toEqual([]);
    },
    { auto: true },
  ],
});

/** Anfragen, die der AIMS-Manager (file://) stellen darf: Datei, eingebettete Daten, Blob, leere Seite */
const NETZ_ERLAUBT = /^(file|data|blob|about):/;

/**
 * Gemeinsamer Haken (AF-031, QK-16): Jeder Ablauf, der über starte() läuft, zählt CSP-Verletzungen («CSP: …») und Netzwerkanfragen
 * («NETZ: …») in derselben Liste wie die übrigen Fehler. Da jeder Test am Ende `expect(fehler).toEqual([])` prüft, gilt für alle E2E
 * in allen Engines: CSP-Verletzungen 0 und Netzwerkanfragen 0. `zaehleHaken` gibt die Zahlen für Tests des Hakens selbst.
 */
export function zaehleHaken(fehler: readonly string[]): { csp: number; netz: number } {
  return { csp: fehler.filter((m) => /^CSP: /.test(m)).length, netz: fehler.filter((m) => /^NETZ: /.test(m)).length };
}

export async function starte(page: Page): Promise<{ fehler: string[] }> {
  const fehler: string[] = [];
  const id = test.info().testId;
  listen.set(id, [...(listen.get(id) ?? []), fehler]);
  page.on('pageerror', (e) => fehler.push(e.message));
  page.on('request', (r) => {
    if (!NETZ_ERLAUBT.test(r.url())) fehler.push(`NETZ: ${r.method()} ${r.url()}`);
  });
  // CSP-Meldungen (Nutzertest rc.10, U-22): ab rc.12 enthält der AIMS-Manager kein <select> mehr (ui/Auswahl.tsx); jede
  // Verletzung in jeder Engine ist ein Fehler. Ausgenommen bleibt nur das Bildschirmfoto von Playwright in WebKit, das einen
  // Stilblock einsetzt (style-src-elem, Ziel #document, Beleg in webkit-csp.e2e.ts): Tests mit Foto werten die Meldungen vor
  // dem Foto aus (foto() unten) oder fotografieren nur in Chromium.
  page.on('console', (m) => {
    if (m.type() === 'error') fehler.push(m.text());
  });
  // Einheitlicher Weg für alle Engines: Dateiauswahl über input[type=file]
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>)['showOpenFilePicker'];
    delete (window as unknown as Record<string, unknown>)['showSaveFilePicker'];
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP: ${e.violatedDirective} ${e.blockedURI} ${(e.target as Element | null)?.nodeName ?? ''}`);
    });
  });
  await page.goto(dateiUrl(HTML));
  await page.waitForSelector('body[data-bedienbar]', { timeout: 10_000 });
  return { fehler };
}

/** Meldungen, die das Bildschirmfoto von Playwright selbst auslöst (Stilblock in WebKit, webkit-csp.e2e.ts Beleg 2) */
const FOTO_MELDUNG = /^(CSP: style-src-elem inline #document|Refused to apply a stylesheet because its hash)/;

/**
 * Bildschirmfoto mit CSP-Prüfung davor: bis zum Foto dürfen keine Fehler aufgelaufen sein; danach werden nur die Meldungen
 * entfernt, die das Foto selbst auslöst. Ohne Pfad nur zur Prüfung des Ablaufs (z. B. in WebKit).
 */
export async function foto(page: Page, fehler: string[], optionen: Parameters<Page['screenshot']>[0] = {}): Promise<Buffer> {
  expect(fehler, 'CSP und Konsole vor dem Bildschirmfoto').toEqual([]);
  const vorher = fehler.length;
  const bild = await page.screenshot({ caret: 'initial', ...optionen });
  await page.waitForTimeout(150);
  const neu = fehler.splice(vorher);
  fehler.push(...neu.filter((m) => !FOTO_MELDUNG.test(m)));
  return bild;
}

export async function oeffne(page: Page, datei: string): Promise<void> {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#start-oeffnen')]);
  await fc.setFiles(datei);
  await expect(page).toHaveURL(/#\/formular\/uebersicht/);
}


/** Hauptbereich über die Symbolleiste (Rolle navigation «Hauptbereiche», Link mit dem Namen des Bereichs). */
export function bereichLink(page: Page, name: string | RegExp, leiste = 'Hauptbereiche|Main areas') {
  return page.getByRole('navigation', { name: new RegExp(`^(${leiste})$`) }).getByRole('link', { name: typeof name === 'string' ? new RegExp(`^${name}`) : name });
}

/** Eintrag im Untermenü des aktiven Bereichs (Rolle navigation «Unterbereiche: …»). */
export function untermenueLink(page: Page, name: string | RegExp) {
  return page.getByRole('navigation', { name: /^(Unterbereiche|Sub-areas):/ }).getByRole('link', { name: typeof name === 'string' ? new RegExp(`^${name}`) : name });
}

/** Darstellung wie ein Nutzer wählen: Einstellungen › Sprache und Darstellung, danach zurück zur bisherigen Seite. */
export async function waehleTheme(page: Page, modus: 'hell' | 'dunkel' | 'system'): Promise<void> {
  const zurueck = await page.evaluate(() => location.hash);
  await page.evaluate(() => (location.hash = '#/einstellungen/darstellung'));
  await waehle(page.locator('#e-theme'), modus);
  // Maus aus dem Inhalt nehmen: sonst liegt sie auf der nächsten Seite über einem Element (Hover-Farben in axe)
  await page.mouse.move(0, 0);
  await page.evaluate((h) => (location.hash = h || '#/start'), zurueck);
}

/** Sprache der Oberfläche wählen (Einstellungen › Sprache und Darstellung), danach zurück zur bisherigen Seite. */
export async function waehleSprache(page: Page, sprache: 'de' | 'en'): Promise<void> {
  const zurueck = await page.evaluate(() => location.hash);
  await page.evaluate(() => (location.hash = '#/einstellungen/darstellung'));
  await waehle(page.locator('#e-ui'), sprache);
  await page.mouse.move(0, 0);
  await page.evaluate((h) => (location.hash = h || '#/start'), zurueck);
}

/** Darstellung vor dem Laden festlegen (ab rc.10 ist dunkel Standard; ohne Wahl folgt die App nicht der Systemeinstellung). */
export async function themaVorab(page: Page, thema: 'hell' | 'dunkel' | 'system'): Promise<void> {
  await page.addInitScript((t) => {
    try { localStorage.setItem('aims-manager:einstellung:theme', t); } catch { /* egal */ }
  }, thema);
}

const rueckfragen = new WeakMap<Page, { antwort: (text: string) => boolean | null }>();

/** Im Browser: beobachtet den Dialog #bestaetigen (V-11) und fragt den Test nach der Antwort (null: Dialog bleibt offen) */
const RUECKFRAGE_BEOBACHTER = () => {
  const w = window as unknown as { __rueckfrage?: (text: string) => Promise<boolean | null>; __rueckfrageAktiv?: boolean };
  if (w.__rueckfrageAktiv) return;
  w.__rueckfrageAktiv = true;
  const pruefen = async () => {
    const d = document.getElementById('bestaetigen');
    if (!d || d.dataset['beantwortet'] || !w.__rueckfrage) return;
    d.dataset['beantwortet'] = '1';
    const r = await w.__rueckfrage(document.getElementById('bestaetigen-text')?.textContent ?? '');
    if (r === null) return;
    document.getElementById(r ? 'bestaetigen-ja' : 'bestaetigen-nein')?.click();
  };
  const starten = () => new MutationObserver(() => void pruefen()).observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) starten();
  else document.addEventListener('DOMContentLoaded', starten);
};

/**
 * Rückfragen der App (eigener Dialog statt confirm(), V-11) wie früher page.on('dialog') beantworten: true bestätigt die Handlung,
 * false bricht ab; eine Funktion erhält den Text der Frage. «einmal»: nur die nächste Frage so, danach Abbrechen (wie page.once,
 * nach dem Playwright weitere Dialoge verwirft). Ein neuer Aufruf ersetzt die bisherige Antwort.
 */
export async function beantworteRueckfragen(page: Page, antwort: boolean | ((text: string) => boolean), optionen: { einmal?: boolean } = {}): Promise<void> {
  let r = rueckfragen.get(page);
  const neu = !r;
  if (!r) {
    r = { antwort: () => null };
    rueckfragen.set(page, r);
  }
  let benutzt = false;
  r.antwort = (text) => {
    if (optionen.einmal && benutzt) return false;
    benutzt = true;
    return typeof antwort === 'function' ? antwort(text) : antwort;
  };
  if (!neu) return;
  await page.exposeFunction('__rueckfrage', (text: string) => rueckfragen.get(page)?.antwort(text) ?? null);
  await page.addInitScript(RUECKFRAGE_BEOBACHTER);
  await page.evaluate(RUECKFRAGE_BEOBACHTER).catch(() => undefined);
}
