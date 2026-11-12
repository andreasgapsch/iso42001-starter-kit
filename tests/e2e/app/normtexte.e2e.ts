// Normtexte aus der eigenen Normausgabe: Import einer SYNTHETISCHEN Norm-PDF (zur Testzeit erzeugt, erfundener Text),
// Lizenzbestätigung, Vorschau mit Abgleich, Anzeige in der App, nicht in der Projektdatei, Bestätigung für Dokumente,
// Löschen, Netzwerkprotokoll (nur file:, data:, blob:). Drei Engines (Legacy-Build von pdf.js für Safari/WebKit).
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test, beantworteRueckfragen } from './app-hilfen.ts';
import { strFromU8, unzipSync } from 'fflate';
import { ladeKataloge } from '../../../src/kataloge/laden-node.ts';
import { erwartet42001 } from '../../../src/normtexte/erwartet.ts';
import { alsPdf, synthetischeNorm } from '../../fixtures/normpdf.ts';
import { REPO, netzProtokoll } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte } from './app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true });

// Lokaler Zusatztest gegen die echten, lizenzierten Normausgaben (nur auf dem Rechner des Autors, in CI übersprungen).
// Ausgabe nur Zählungen; Spuren und Bilder bei Fehlern enthalten Normtext und bleiben nur lokal in test-results/.
const QUELLEN = join(homedir(), 'work/iso42001-quellen/norm');
const lokal = (datei: string) => existsSync(join(QUELLEN, datei)) && !process.env['CI'];

const norm = synthetischeNorm(erwartet42001(ladeKataloge()), { norm: '42001', sprache: 'de', national: 'SN EN' });
const TITEL_A22 = norm.erwartet['A.2.2']!.titel;

async function pdfLaden(page: Page): Promise<void> {
  await page.evaluate(() => (location.hash = '#/einstellungen'));
  await expect(page.locator('#normtexte-stand')).toContainText('Noch keine Normtexte');
  // Import erst nach der Lizenzbestätigung
  await expect(page.locator('#normtexte-pdf')).toBeDisabled();
  await page.check('#normtexte-lizenz');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#normtexte-pdf')]);
  await fc.setFiles({ name: 'synthetische-norm.pdf', mimeType: 'application/pdf', buffer: Buffer.from(alsPdf(norm)) });
  await expect(page.locator('#normtexte-vorschau')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#normtexte-abgleich')).toContainText('SN EN ISO/IEC 42001:2026');
  await expect(page.locator('#normtexte-abgleich')).toContainText('65 von 65');
  await expect(page.locator('#normtexte-vorschau tr[data-id="A.2.2"]')).toContainText('gefunden');
}

test('Norm-PDF laden, anzeigen, nicht in der Projektdatei, löschen', async ({ page, context }) => {
  test.setTimeout(120_000);
  const netz = netzProtokoll(context);
  await beantworteRueckfragen(page, true);
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('normtexte.aims.json'));
  await pdfLaden(page);
  // Manuelle Korrektur eines Eintrags
  await page.click('#normtexte-vorschau tr[data-id="A.2.3"] button');
  await page.fill('#normtexte-vorschau tr[data-id="A.2.3"] input', 'Von Hand korrigierter Testtitel');
  await page.click('#normtexte-uebernehmen');
  await expect(page.locator('#normtexte-stand')).toContainText('SN EN ISO/IEC 42001:2026');
  await expect(page.locator('#normtexte-stand')).toContainText('65 von 65');
  await expect(page.locator('#normtexte-ablage')).toBeVisible();

  // Anzeige in der App: Titel der Norm statt Kurztitel
  await page.evaluate(() => (location.hash = '#/formular/soa'));
  await expect(page.locator('main')).toContainText(TITEL_A22);
  await expect(page.locator('main')).toContainText('Von Hand korrigierter Testtitel');

  // Projektdatei enthält keinen Normtext
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#speichern')]);
  const gespeichert = readFileSync(await dl.path(), 'utf8');
  expect(gespeichert).not.toContain('Testcontrol');
  expect(gespeichert).not.toContain('Prüfobjekt');
  expect(gespeichert).not.toContain('normpaket');

  // Nach dem Neuladen noch vorhanden (eigener Speicher im Browser)
  await page.reload();
  await page.waitForSelector('body[data-normpaket]');
  await page.evaluate(() => (location.hash = '#/einstellungen'));
  await expect(page.locator('#normtexte-stand')).toContainText('SN EN ISO/IEC 42001:2026');

  // Löschen
  await page.click('#normtexte-loeschen');
  await expect(page.locator('#normtexte-stand')).toContainText('Noch keine Normtexte');
  await page.reload();
  await page.waitForSelector('body[data-normpaket]');
  await page.evaluate(() => (location.hash = '#/einstellungen'));
  await expect(page.locator('#normtexte-stand')).toContainText('Noch keine Normtexte');

  expect(netz.fremd(), 'Anfragen ausserhalb von file:, data:, blob:').toEqual([]);
  expect(fehler).toEqual([]);
});

test('Dokumente: Normtext nur nach ausdrücklicher Bestätigung, mit Quellenvermerk', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Generator einmal genügt');
  test.setTimeout(180_000);
  await beantworteRueckfragen(page, true);
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('normtexte-dok.aims.json'));
  await pdfLaden(page);
  await page.click('#normtexte-uebernehmen');
  const soa = async (): Promise<string> => {
    await page.evaluate(() => (location.hash = '#/dokumente'));
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90_000 }), page.click('#set-erzeugen')]);
    const zip = unzipSync(new Uint8Array(readFileSync(await dl.path())));
    const name = Object.keys(zip).find((n) => n.startsWith('D-11'))!;
    const xlsx = unzipSync(zip[name]!);
    return strFromU8(xlsx['xl/sharedStrings.xml']!);
  };
  // Standard aus: Dokument ohne Normtext
  await expect(page.locator('#normtexte-dokumente')).not.toBeChecked();
  expect(await soa()).not.toContain(TITEL_A22);
  // Bestätigung und Lizenzgeber
  await page.evaluate(() => (location.hash = '#/einstellungen'));
  await page.check('#normtexte-dokumente');
  await page.fill('#normtexte-lizenzgeber', 'Testlizenzgeber');
  await page.locator('#normtexte-lizenzgeber').blur();
  const mit = await soa();
  expect(mit).toContain(TITEL_A22);
  expect(mit).toContain(norm.erwartet['A.2.2']!.text);
  expect(mit).toContain('Auszug aus SN EN ISO/IEC 42001:2026');
  expect(mit).toContain('Testlizenzgeber');
  expect(fehler).toEqual([]);
});

test('Rückfall: nur englischer Normtext bei deutscher Oberfläche, gekennzeichnet «Normtext Englisch»', async ({ page }) => {
  test.setTimeout(120_000);
  await beantworteRueckfragen(page, true);
  const en = synthetischeNorm(erwartet42001(ladeKataloge()), { norm: '42001', sprache: 'en' });
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('normtexte.aims.json'));
  await page.evaluate(() => (location.hash = '#/einstellungen'));
  await page.check('#normtexte-lizenz');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#normtexte-pdf')]);
  await fc.setFiles({ name: 'synthetic-standard.pdf', mimeType: 'application/pdf', buffer: Buffer.from(alsPdf(en)) });
  await expect(page.locator('#normtexte-vorschau')).toBeVisible({ timeout: 30_000 });
  await page.click('#normtexte-uebernehmen');
  await expect(page.locator('#normtexte-rueckfall')).toContainText('Normtext Englisch');
  await page.evaluate(() => (location.hash = '#/formular/soa/A.2.2'));
  await expect(page.locator('main')).toContainText(en.erwartet['A.2.2']!.titel);
  await expect(page.locator('main .normtext-sprache[data-sprache="en"]').first()).toHaveText('Normtext Englisch');
  await page.evaluate(() => (location.hash = '#/einstellungen'));
  await page.click('#normtexte-loeschen');
  expect(fehler).toEqual([]);
});

async function echtLaden(page: Page, datei: string): Promise<void> {
  await page.evaluate(() => (location.hash = '#/einstellungen'));
  await page.check('#normtexte-lizenz');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#normtexte-pdf')]);
  await fc.setFiles(join(QUELLEN, datei));
}

test('Lokal: echte ISO/IEC 27001:2022 im Browser, 93 Controls und alle Abschnitte (nur Zählungen)', async ({ page, browserName }) => {
  test.skip(!lokal('ISO-IEC_27001-2022_en.pdf'), 'Normausgabe nur lokal');
  test.setTimeout(180_000);
  await beantworteRueckfragen(page, true);
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('normtexte.aims.json'));
  await echtLaden(page, 'ISO-IEC_27001-2022_en.pdf');
  await expect(page.locator('#normtexte-vorschau')).toBeVisible({ timeout: 120_000 });
  const zeilen = page.locator('#normtexte-vorschau tbody tr');
  const zaehle = async (praefix: RegExp) => {
    const ids = await zeilen.evaluateAll((tr) => tr.map((x) => [x.getAttribute('data-id') ?? '', x.querySelector('[data-gefunden=ja]') ? 1 : 0] as const));
    const t = ids.filter(([id]) => praefix.test(id));
    return { gefunden: t.filter(([, ok]) => ok).length, gesamt: t.length };
  };
  const controls = await zaehle(/^27001-[5-8]\.\d+$/);
  const abschnitte = await zaehle(/^27001-K-/);
  const amd = (await page.locator('#normtexte-ohne-amd').count()) === 0 ? 'ja' : 'nein';
  console.log(JSON.stringify({ browser: browserName, controls: `${controls.gefunden}/${controls.gesamt}`, abschnitte: `${abschnitte.gefunden}/${abschnitte.gesamt}`, amd }));
  await expect(page.locator('#normtexte-abgleich')).toContainText('ISO/IEC 27001:2022');
  await expect(page.locator('#normtexte-abgleich')).toContainText('93 von 93');
  expect(controls).toEqual({ gefunden: 93, gesamt: 93 });
  expect(abschnitte.gefunden).toBe(abschnitte.gesamt);
  expect(abschnitte.gesamt).toBe(25);
  expect(fehler).toEqual([]);
});

test('Lokal: ISO/IEC 27002 wird als nicht unterstützt erkannt (nur Zählungen)', async ({ page, browserName }) => {
  test.skip(!lokal('ISO-IEC_27002-2022_en.pdf'), 'Normausgabe nur lokal');
  test.setTimeout(180_000);
  await beantworteRueckfragen(page, true);
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('normtexte.aims.json'));
  await echtLaden(page, 'ISO-IEC_27002-2022_en.pdf');
  await expect(page.locator('#normtexte-fehler')).toContainText('ISO/IEC 27002', { timeout: 120_000 });
  const vorschau = await page.locator('#normtexte-vorschau').count();
  console.log(JSON.stringify({ browser: browserName, nichtUnterstuetzt: 1, vorschau }));
  expect(vorschau).toBe(0);
  await expect(page.locator('#normtexte-stand')).toContainText('Noch keine Normtexte');
  expect(fehler).toEqual([]);
});
