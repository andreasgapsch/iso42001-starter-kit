// AIMS-Manager, Breite: Organisation, EU AI Act, 27001-Brücke, Ziele, Kompetenz, Fragebogen für Fachbereiche,
// Ergebnis des KI-Assistenten, Jahreskalender. Über file:// in Chromium, Firefox und WebKit.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test } from './app-hilfen.ts';
import ExcelJS from 'exceljs';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte, untermenueLink } from './app-hilfen.ts';
import { waehle } from '../auswahl-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true });

const geh = (page: Page, hash: string) => page.evaluate((h) => (location.hash = h), hash);
const KI = join(REPO, 'tests/fixtures/ki-ergebnis');

test('Organisation: Reiter, Felder mit Normabschnitt, Sprung aus der Prüfung', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('org.aims.json', false, (p) => delete p.organisation.geltungsbereich.freigabe));
  await geh(page, '#/pruefung');
  await page.locator('.befunde li', { hasText: 'F11' }).locator('a.knopf').click();
  await expect(page).toHaveURL(/#\/formular\/organisation\/geltungsbereich/);
  await expect(page.locator('#reiter-geltungsbereich')).toHaveAttribute('aria-current', 'page');
  const feld = page.locator('#f-E2-grenzen-organisation_geltungsbereich_beschreibung');
  await expect(feld).toHaveValue('Ganze Firma');
  await feld.fill('Ganze Firma inklusive Tochtergesellschaft');
  await expect(page.locator('.feld .norm').first()).toContainText('ISO/IEC 42001');
  await page.click('#reiter-parteien');
  await expect(page).toHaveURL(/organisation\/parteien/);
  await page.getByRole('button', { name: 'Partei erfassen' }).click();
  await expect(page).toHaveURL(/parteien\?eintrag=IP-001/);
  await page.click('#reiter-geltungsbereich');
  await expect(feld).toHaveValue('Ganze Firma inklusive Tochtergesellschaft');
  await geh(page, '#/formular/kompetenz/kommunikation');
  await expect(page.locator('.vliste .zeile')).toHaveCount(1);
  await geh(page, '#/formular/ziele/Z-001');
  await expect(page.locator('#editor-ziele')).toContainText('Z-001');
  expect(fehler).toEqual([]);
});

test('EU AI Act: Zusatz-Control übernehmen und ablehnen, Pflichten als Massnahmen, Modul aus und ein ohne Datenverlust', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('aiact.aims.json'));
  await geh(page, '#/formular/aiact/vorschlaege');
  await page.click('#uebernehmen-EUAIA-01');
  await expect(page.locator('#vorschlag-EUAIA-01 .pille')).toHaveText('in der SoA als anwendbar');
  const zweite = page.locator('section[id^=vorschlag-EUAIA]').nth(1);
  await zweite.getByRole('button', { name: 'Begründet ablehnen' }).click();
  await zweite.locator('textarea').fill('Betrifft uns nicht, nur interne Bürounterstützung.');
  await zweite.getByRole('button', { name: 'Ablehnung speichern' }).click();
  await expect(zweite.locator('.pille')).toHaveText('abgelehnt');
  await geh(page, '#/formular/aiact/pflichten');
  const anzahlVorher = await page.evaluate(() => document.querySelectorAll('details.abschnitt').length);
  expect(anzahlVorher).toBe(1);
  await page.click('#pflichten-massnahmen');
  await expect(page.locator('#meldung')).toContainText('Massnahmen erfasst');
  await geh(page, '#/formular/massnahmen');
  const massnahmen = await page.locator('.vliste .zeile').count();
  expect(massnahmen).toBeGreaterThan(0);
  await geh(page, '#/formular/aiact/fristen');
  await expect(page.locator('tr.naechste')).toHaveCount(1);
  // Modul aus: Navigation und Ansicht verschwinden, Daten bleiben
  await geh(page, '#/einstellungen');
  await page.uncheck('#modul-aiact');
  await geh(page, '#/formular/organisation');
  await expect(untermenueLink(page, 'Organisation')).toHaveAttribute('aria-current', 'page');
  await expect(untermenueLink(page, 'EU AI Act')).toHaveCount(0);
  await geh(page, '#/formular/aiact');
  await expect(page.locator('.ersatz')).toContainText('ausgeschaltet');
  await geh(page, '#/einstellungen');
  await page.check('#modul-aiact');
  await geh(page, '#/formular/aiact/vorschlaege');
  await expect(page.locator('#vorschlag-EUAIA-01 .pille')).toHaveText('in der SoA als anwendbar');
  await geh(page, '#/formular/massnahmen');
  await expect(page.locator('.vliste .zeile')).toHaveCount(massnahmen);
  expect(fehler).toEqual([]);
});

test('ISO 27001-Brücke: Wiederverwendungsgrad, Verknüpfungen eintragen, ISMS-Dokumente', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('bruecke.aims.json', true));
  await geh(page, '#/formular/brucke27001');
  await expect(page.locator('#wv-grad strong')).toHaveText(/^\d+ %$/);
  await expect(page.locator('#wv-projekt strong')).toHaveText('0 %');
  await page.getByRole('button', { name: /Entsprechungen bei anwendbaren Controls/ }).click();
  await expect(page.locator('#wv-projekt strong')).not.toHaveText('0 %');
  await waehle(page.locator('#bruecke-filter'), 'hoch');
  const stark = await page.locator('tbody tr').count();
  expect(stark).toBeGreaterThan(0);
  expect(stark).toBeLessThan(38);
  await page.click('#reiter-dokumente');
  await expect(page.locator('tbody tr', { hasText: 'D-03-EB' })).toBeVisible();
  expect(fehler).toEqual([]);
});

test('Fragebogen für Fachbereiche: Export, Ausfüllen, Import mit Bestätigung', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('fragebogen.aims.json'));
  await geh(page, '#/formular/inventar');
  await waehle(page.locator('#fragebogen-bereich'), 'hr');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), page.click('#fragebogen-export')]);
  expect(dl.suggestedFilename()).toMatch(/^D-10_.*\.xlsx$/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(await dl.path());
  const ws = wb.worksheets.find((w) => w.name.startsWith('Fragebogen'))!;
  let kopf = 0;
  ws.eachRow((r, n) => {
    if (!kopf && (r.values as unknown[]).some((v) => typeof v === 'string' && v.startsWith('1 Name'))) kopf = n;
  });
  expect(kopf).toBeGreaterThan(0);
  const zeilen = [
    ['Personal', 'Eva', 'CV-Screener', 'Bewerbungen vorsortieren', 'selbst beschafft oder Gratisversion', 'Recruit AI', 3, 'täglich', 'Lebensläufe', 'ja', 'weiss nicht', 'Bewerbende', 'selten oder nie', ''],
    ['Personal', 'Eva', 'Copilot', 'Mails', 'von der Firma bereitgestellt', '', 20, 'täglich', 'Mails', 'nein', 'nein', 'Kunden', 'immer', ''],
  ];
  zeilen.forEach((z, i) => z.forEach((w, j) => (ws.getCell(kopf + 1 + i, j + 1).value = w)));
  const ausgefuellt = join(REPO, 'test-results', `fragebogen-${test.info().project.name}.xlsx`);
  await wb.xlsx.writeFile(ausgefuellt);
  await page.setInputFiles('#fragebogen-datei', ausgefuellt);
  const dialog = page.locator('#fragebogen-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('2 Zeilen gelesen, 1 neu, 1 bereits vorhanden');
  await dialog.locator('#fragebogen-uebernehmen').click();
  await expect(page.locator('#meldung')).toContainText('1 KI-System ins Inventar übernommen');
  await expect(page.locator('.vliste .zeile')).toHaveCount(2);
  await expect(page.locator('.vliste')).toContainText('CV-Screener');
  // Falsche Datei: verständliche Meldung
  await page.setInputFiles('#fragebogen-datei', join(KI, 'muster-treuhand.aims.json'));
  await expect(page.locator('#fragebogen-fehler')).toContainText('keine lesbare Excel-Arbeitsmappe');
  expect(fehler).toEqual([]);
});

test('Ergebnis des KI-Assistenten: Antwort mit Codeblock einfügen, fehlerhafte Datei mit Meldung', async ({ page }) => {
  const { fehler } = await starte(page);
  await page.click('#ki-import-start');
  await page.setInputFiles('#ki-import-datei', join(KI, 'fehlerhaft.aims.json'));
  const meldung = page.locator('#ki-import-fehler');
  await expect(meldung).toContainText('passt nicht ganz zum Format');
  await expect(meldung).toContainText('kiSysteme[1].typ: unzulässiger Wert (erlaubt: eingekauft, saas, eigenbau, schatten)');
  await expect(meldung).toContainText('unbekanntes Feld «anbieter»');
  await page.fill('#ki-import-text', readFileSync(join(KI, 'antwort-mit-codeblock.md'), 'utf8'));
  await page.click('#ki-import-uebernehmen');
  await expect(page).toHaveURL(/#\/formular\/uebersicht/);
  await expect(page.locator('#projekt-kachel')).toHaveAttribute('aria-label', /Projekt Muster Treuhand AG/);
  await expect(page.locator('#speicherstatus')).toHaveText('Ungespeicherte Änderungen');
  await geh(page, '#/formular/inventar');
  await expect(page.locator('.vliste .zeile')).toHaveCount(2);
  // Speichern liefert eine gültige Projektdatei mit denselben Daten
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#speichern')]);
  const gespeichert = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  const original = JSON.parse(readFileSync(join(KI, 'muster-treuhand.aims.json'), 'utf8'));
  expect(gespeichert.kiSysteme).toEqual(original.kiSysteme);
  expect(gespeichert.meta.projektId).toBe(original.meta.projektId);
  expect(fehler).toEqual([]);
});

test('Jahreskalender: Stand und überfällige Einträge', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('kalender.aims.json', false, (p) => (p.kiSysteme[0]!.naechsteUeberpruefung = '2026-01-15')));
  await geh(page, '#/gefuehrt/J/J-kalender');
  await expect(page.locator('#kalender-stand')).toContainText('überfällig');
  const inventar = page.locator('.kalender li.st-ueberfaellig', { hasText: 'KI-Inventar durchsehen' });
  await expect(inventar).toContainText('1 Eintrag überfällig');
  await inventar.locator('input[type=checkbox]').check();
  await expect(inventar.locator('input[type=checkbox]')).toBeChecked();
  expect(fehler).toEqual([]);
});

test('Barrierefreiheit der neuen Module (axe, WCAG 2.1 AA)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'axe einmal genügt');
  await starte(page);
  await oeffne(page, fixtureDatei('a11y-breite.aims.json', true));
  for (const h of [
    '#/formular/organisation', '#/formular/organisation/rollen', '#/formular/organisation/risikokriterien', '#/formular/ziele', '#/formular/kompetenz',
    '#/formular/aiact', '#/formular/aiact/pflichten', '#/formular/aiact/vorschlaege', '#/formular/aiact/fristen', '#/formular/brucke27001',
    '#/formular/brucke27001/dokumente', '#/formular/inventar', '#/gefuehrt/J/J-kalender', '#/start',
  ]) {
    await geh(page, h);
    await page.waitForTimeout(200);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(r.violations.map((v) => `${h}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
  }
  await geh(page, '#/start');
  await page.click('#ki-import-start');
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});
