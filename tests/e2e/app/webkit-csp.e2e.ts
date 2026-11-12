// CSP-Meldungen in WebKit (Nutzertest rc.10, U-22).
// 1. style-src-attr mit Ziel SELECT: WebKit meldet sie für jedes <select> im Dokument, auch ohne Skript, ohne Stil, mit
//    appearance:none, versteckt oder leer (Beleg 1; Eingrenzung in docs/ARCHITEKTUR-WERKZEUG.md). Keine CSS-Regel beseitigt
//    sie, deshalb nutzt der AIMS-Manager ab rc.12 kein <select> mehr, sondern ui/Auswahl.tsx (Muster «select-only combobox»).
// 2. style-src-elem mit Ziel #document: der Stilblock, den Playwright in WebKit für jedes Bildschirmfoto einsetzt, auch mit
//    caret: 'initial' (Beleg 2). Tests werten die CSP deshalb vor dem Foto aus (app-hilfen.ts, foto()).
// Ergebnis: Der AIMS-Manager löst auf allen Routen in keiner Engine eine CSP-Verletzung aus; die CSP bleibt unverändert eng.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { test } from './app-hilfen.ts';
import { REPO, TMP } from '../spikes/hilfen.ts';
import { waehle } from '../auswahl-hilfen.ts';
import { HTML, foto, oeffne, starte } from './app-hilfen.ts';

const MUSTER = join(REPO, 'src/beispiele/muster-maschinenbau.de.aims.json');

/** Seite mit enger CSP (keine Stile erlaubt), ohne Formularelement oder mit einem <select> im Markup */
function seite(name: string, mitSelect: boolean): string {
  const ordner = join(TMP, '..', 'webkit-csp');
  mkdirSync(ordner, { recursive: true });
  const datei = join(ordner, `${name}.html`);
  writeFileSync(datei, `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'none'">
<title>CSP</title></head><body><p>Beleg</p>${mitSelect ? '<select><option>eins</option><option>zwei</option></select>' : ''}</body></html>`);
  return pathToFileURL(datei).href;
}

async function verletzungen(page: Page, url: string): Promise<string[]> {
  const liste: string[] = [];
  await page.exposeFunction('__csp', (s: string) => liste.push(s));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __csp(s: string): void }).__csp(`${e.violatedDirective} ${(e.target as Element | null)?.nodeName ?? ''}`)));
  await page.goto(url);
  await page.waitForTimeout(300);
  return liste;
}

test('Beleg 1: ein <select> im Markup löst in WebKit style-src-attr aus, ohne Skript und ohne Stil der Seite', async ({ page, browserName }) => {
  const mit = await verletzungen(page, seite(`select-${browserName}`, true));
  if (browserName === 'webkit') expect([...new Set(mit)]).toEqual(['style-src-attr SELECT']);
  else expect(mit).toEqual([]);
});

test('Beleg 2: das Bildschirmfoto von Playwright löst in WebKit style-src-elem aus, die Seite selbst nicht', async ({ page, browserName }) => {
  const liste = await verletzungen(page, seite(`foto-${browserName}`, false));
  expect(liste, 'vor dem Foto').toEqual([]);
  await page.screenshot({ caret: 'initial' });
  await page.waitForTimeout(200);
  if (browserName === 'webkit') expect([...new Set(liste)]).toEqual(['style-src-elem #document']);
  else expect(liste).toEqual([]);
});

test('AIMS-Manager: auf allen Routen kein <select> und in keiner Engine eine CSP-Verletzung, auch mit offener Auswahl', async ({ page }) => {
  test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  for (const r of ['#/start', '#/formular/uebersicht', '#/uebersicht/faellig', '#/uebersicht/bereitschaft', '#/gefuehrt', '#/gefuehrt/E4', '#/formular/organisation',
    '#/formular/inventar', '#/formular/risiken', '#/formular/soa', '#/formular/massnahmen', '#/formular/nistrmf', '#/prozesse', '#/prozesse?ansicht=karte',
    '#/prozesse/PR-08', '#/bibliothek', '#/dokumente', '#/wissen', '#/wissen/glossar', '#/pruefung', '#/pruefung/stage1', '#/hinweise', '#/hilfe', '#/einstellungen', '#/ueber']) {
    await page.evaluate((h) => (location.hash = h), r);
    await expect(page.locator('main h1').first()).toBeVisible();
    await page.waitForTimeout(100);
    expect(await page.locator('select').count(), r).toBe(0);
  }
  // Auswahl öffnen, wählen und schliessen: keine Inline-Stile aus dem Markup
  await page.evaluate(() => (location.hash = '#/einstellungen/darstellung'));
  await waehle(page.locator('#e-theme'), 'hell');
  await waehle(page.locator('#e-theme'), 'dunkel');
  // Bildschirmfoto: CSP vor dem Foto ausgewertet, die Meldung des Stilblocks von Playwright (WebKit) zählt nicht
  await foto(page, fehler);
  expect(fehler).toEqual([]);
});
