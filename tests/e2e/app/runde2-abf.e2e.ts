// Runde 2, Nachprüfung im Browser: C2-15 (Klartext beim Schreibfehler), D2-04 (Form je Zustand), D2-05 (kein Bruch im Wort),
// D2-08 (Werte auf dem Telefon vollständig).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test } from './app-hilfen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte } from './app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.skip(({ browserName }) => browserName !== 'chromium', 'Nur Chromium, Speichervorgabe der VM');
test.use({ locale: 'de-CH', acceptDownloads: true });

const hash = (page: import('@playwright/test').Page, h: string) => page.evaluate((x) => (location.hash = x), h);

test('C2-15: Schreibfehler zeigt deutschen Klartext statt des Rohtexts des Browsers', async ({ page }) => {
  await page.addInitScript(() => {
    const datei = { name: 'x.aims.json', kind: 'file', getFile: async () => new File(['{}'], 'x.aims.json'), createWritable: async () => { throw new DOMException('It was determined that certain files are unsafe for access within a Web application', 'NotAllowedError'); }, queryPermission: async () => 'granted', requestPermission: async () => 'granted' };
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => datei });
  });
  await page.setViewportSize({ width: 1400, height: 900 });
  await starte(page);
  await oeffne(page, fixtureDatei('r2-c15.aims.json', false, (p) => { p.meta.geaendert = '2026-10-01T10:00:00.000Z'; }));
  await page.click('#speichern');
  const meldung = page.locator('[role=alert], .meldung, .toast').first();
  await expect(meldung).toBeVisible({ timeout: 10_000 });
  const text = await page.locator('body').innerText();
  expect(text).not.toContain('It was determined');
});

test('D2-04, D2-08: Telefon: Speicherstand mit Form je Zustand, Wert des Risikos vollständig', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await starte(page);
  await oeffne(page, fixtureDatei('r2-d08.aims.json', false));
  await hash(page, '#/formular/risiken');
  const zeichen = page.locator('.speicherstand-zeichen').first();
  await expect(zeichen).toBeVisible();
  const form = () => zeichen.evaluate((e) => { const s = getComputedStyle(e); return `${s.borderRadius}|${s.clipPath}`; });
  const gespeichert = await form();
  const knopf = page.locator('button.speicherstand');
  if (await knopf.evaluate((e) => e.classList.contains('ungespeichert'))) expect(gespeichert).toContain('polygon');
  else expect(gespeichert).toContain('50%');
  // Kein abgeschnittener Text in den Karten
  const gekappt = await page.locator('.zelle').evaluateAll((z) => z.filter((e) => e.scrollHeight > e.clientHeight + 2 && /→/.test(e.textContent ?? '')).map((e) => e.textContent));
  expect(gekappt).toEqual([]);
});

test('D2-05: Stage-1-Bericht bei 390 px ohne überlaufende Tabellenköpfe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await starte(page);
  await oeffne(page, fixtureDatei('r2-d05.aims.json', false));
  await hash(page, '#/pruefung/stage1');
  await page.waitForTimeout(300);
  const zuBreit = await page.locator('th').evaluateAll((k) => k.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  expect(zuBreit).toEqual([]);
});
