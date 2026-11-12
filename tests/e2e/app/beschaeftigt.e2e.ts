// V-05 Rest (Prüfbefund B5): KI-Import, draw.io-Import und Normtext-Import zeigen den Zustand Beschäftigt (aria-busy und
// gesperrt) und lösen bei Doppelklick nur einmal aus. Ein MutationObserver hält jeden Wechsel von aria-busy fest, weil das
// Prüfen kurzer Eingaben schneller fertig ist, als ein Test nachsehen kann. Drei Engines.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test } from './app-hilfen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte } from './app-hilfen.ts';
import { ladeKataloge } from '../../../src/kataloge/laden-node.ts';
import { erwartet42001 } from '../../../src/normtexte/erwartet.ts';
import { alsPdf, synthetischeNorm } from '../../fixtures/normpdf.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1440, height: 900 }, acceptDownloads: true });

/** Zeichnet jeden Wechsel von aria-busy auf: «id:busy:disabled» */
async function beobachte(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { busy: string[] };
    w.busy = [];
    new MutationObserver((m) => {
      for (const x of m) {
        const e = x.target as HTMLButtonElement;
        w.busy.push(`${e.id}:${e.getAttribute('aria-busy') ?? '-'}:${e.disabled}`);
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
  });
}
const aufzeichnung = (page: Page) => page.evaluate(() => (window as unknown as { busy: string[] }).busy);
const geh = (page: Page, hash: string) => page.evaluate((h) => (location.hash = h), hash);

test('B5: KI-Import «Übernehmen» ist beschäftigt und gesperrt; Doppelklick übernimmt einmal', async ({ page }) => {
  const { fehler } = await starte(page);
  const json = readFileSync(fixtureDatei('b5-ki.aims.json'), 'utf8');
  await page.click('#ki-import-start');
  await page.fill('#ki-import-text', json);
  await beobachte(page);
  await page.locator('#ki-import-uebernehmen').dblclick();
  await expect(page).toHaveURL(/#\/formular\/uebersicht/);
  const a = await aufzeichnung(page);
  expect(a).toContain('ki-import-uebernehmen:true:true');
  // genau ein Lauf: Beschäftigt wird einmal gesetzt
  expect(a.filter((x) => x.startsWith('ki-import-uebernehmen:true'))).toHaveLength(1);
  expect(fehler).toEqual([]);
});

test('B5: draw.io-Import ist beschäftigt, solange die Datei gelesen wird; Übernehmen wirkt einmal', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('b5-drawio.aims.json'));
  await geh(page, '#/prozesse/PR-08');
  await expect(page.locator('main h1')).toHaveText(/^PR-08 /);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pz-PR-08-drawio-export')]);
  const xml = readFileSync((await dl.path())!, 'utf8').replace(/label="Wahrscheinlichkeit und Ausmass bewerten"/, 'label="Wahrscheinlichkeit und Ausmass nach D-06 bewerten"');
  await beobachte(page);
  await page.setInputFiles('#drawio-datei-PR-08', { name: 'PR-08.drawio', mimeType: 'application/xml', buffer: Buffer.from(xml) });
  const dialog = page.locator('#drawio-import-dialog');
  await expect(dialog).toBeVisible();
  const a = await aufzeichnung(page);
  expect(a).toContain('drawio-datei-PR-08-waehlen:true:true');
  expect(a[a.length - 1]).toBe('drawio-datei-PR-08-waehlen:-:false');
  // N11: Übernahmen zählen. Jede Änderung am Projekt läuft über aendereMit mit structuredClone des ganzen Projekts; gezählt
  // werden Kopien eines Projekts (meta.projektId), solange der Dialog offen ist und kurz danach
  await page.evaluate(() => {
    const w = window as unknown as { kopien: number; structuredClone: typeof structuredClone };
    const original = w.structuredClone;
    w.kopien = 0;
    w.structuredClone = ((x: unknown, o?: StructuredSerializeOptions) => {
      if ((x as { meta?: { projektId?: string } } | null)?.meta?.projektId) w.kopien++;
      return original(x, o);
    }) as typeof structuredClone;
  });
  await page.locator('#drawio-import-uebernehmen').dblclick();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#meldung')).toContainText('übernommen');
  await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
  expect(await page.evaluate(() => (window as unknown as { kopien: number }).kopien), 'genau eine Übernahme').toBe(1);
  await expect(page.locator('#pz-PR-08-drawio-stand')).toContainText('PR-08.drawio');
  expect(fehler).toEqual([]);
});

test('N13: Ein gesperrter Knopf behält den Fokus; nach der Arbeit liegt er wieder auf dem Knopf (Tastatur)', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('n13.aims.json'));
  await geh(page, '#/prozesse/PR-08');
  await expect(page.locator('main h1')).toHaveText(/^PR-08 /);
  const knopf = page.locator('#pz-PR-08-beschreibung-docx');
  await knopf.focus();
  await beobachte(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  expect(dl.suggestedFilename()).toMatch(/\.docx$/);
  await expect(knopf).toBeEnabled();
  expect(await aufzeichnung(page)).toContain('pz-PR-08-beschreibung-docx:true:true');
  await expect(knopf).toBeFocused();
  // Weiter mit der Tastatur: Tab führt vom Knopf aus weiter, nicht vom Seitenanfang
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('pz-PR-08-beschreibung-docx');
  expect(fehler).toEqual([]);
});

test('B5: Normtext-Import (PDF und Übernehmen) ist beschäftigt und gesperrt', async ({ page }) => {
  test.setTimeout(120_000);
  const norm = synthetischeNorm(erwartet42001(ladeKataloge()), { norm: '42001', sprache: 'de', national: 'SN EN' });
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('b5-norm.aims.json'));
  await geh(page, '#/einstellungen');
  await page.check('#normtexte-lizenz');
  await beobachte(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#normtexte-pdf')]);
  await fc.setFiles({ name: 'synthetische-norm.pdf', mimeType: 'application/pdf', buffer: Buffer.from(alsPdf(norm)) });
  await expect(page.locator('#normtexte-vorschau')).toBeVisible({ timeout: 30_000 });
  expect(await aufzeichnung(page)).toContain('normtexte-pdf:true:true');
  await page.locator('#normtexte-uebernehmen').dblclick();
  await expect(page.locator('#normtexte-vorschau')).toBeHidden();
  const a = await aufzeichnung(page);
  expect(a).toContain('normtexte-uebernehmen:true:true');
  expect(a.filter((x) => x.startsWith('normtexte-uebernehmen:true'))).toHaveLength(1);
  await expect(page.locator('#normtexte-stand li')).toHaveCount(1);
  expect(fehler).toEqual([]);
});
