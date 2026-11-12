// Abnahme 6: Offline. Netzwerkprotokoll beim Durchklicken aller Module (Formularansicht mit Reitern, Guide
// aller Etappen, Prüfung, Dokumente mit Set-Erzeugung, Einstellungen, Über) enthält nur file:, data: und blob:.
// Voraussetzung: npm run build:app. Testtiefe: Chromium.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test } from '../app/app-hilfen.ts';
import { MODULE, REITER } from '../../../src/app/logik/routen.ts';
import { REPO, netzProtokoll } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte } from '../app/app-hilfen.ts';
import { ETAPPEN, hilfeAufklappen } from './abnahme-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true, actionTimeout: 15_000 });

test('Netzwerkprotokoll beim Durchklicken aller Module: nur file:, data:, blob:', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Testtiefe Chromium');
  test.setTimeout(240_000);
  const netz = netzProtokoll(context);
  const sockets: string[] = [];
  page.on('websocket', (w) => sockets.push(w.url()));
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('offline.aims.json', true));
  const geh = async (h: string) => {
    await page.evaluate((x) => (location.hash = x), h);
    await expect(page.locator('main h1').first()).toBeVisible();
  };
  for (const m of MODULE) for (const r of REITER[m] ?? [undefined]) await geh(`#/formular/${m}${r ? `/${r}` : ''}`);
  await geh('#/formular/inventar/KI-001');
  for (const e of ETAPPEN) {
    for (const s of e.seiten) await geh(`#/gefuehrt/${e.id}/${s}`);
    await geh(`#/gefuehrt/${e.id}/abschluss`);
  }
  // Hilfe: KI-Dialog öffnen (Prompt wird lokal erzeugt)
  await geh('#/gefuehrt/E4/E4-systeme');
  await hilfeAufklappen(page);
  await page.locator('aside.hilfe section').last().locator('button').click();
  await page.keyboard.press('Escape');
  for (const h of ['#/pruefung', '#/einstellungen', '#/ueber', '#/start']) await geh(h);
  // Dokumente: Vorschau und ganzes Set (Generator im Worker über blob:)
  await geh('#/dokumente');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90_000 }), page.click('#set-erzeugen')]);
  expect(dl.suggestedFilename()).toMatch(/\.zip$/);
  expect(netz.alle.length).toBeGreaterThan(0);
  expect(netz.fremd(), 'Anfragen ausserhalb von file:, data:, blob:').toEqual([]);
  expect(sockets).toEqual([]);
  expect(fehler).toEqual([]);
});
