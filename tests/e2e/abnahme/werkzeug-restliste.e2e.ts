// Abnahme Restliste B (Werkzeug): Rückweg zur Prüfung nach einem Sprung, Seite mit nicht zutreffender Bedingung bei
// direktem Aufruf, Liste ohne Pflichteintrag als «nicht nötig», Teilimport des KI-Ergebnisses mit Vorschau.
// Voraussetzung: npm run build:app. Testtiefe: Chromium.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test } from '../app/app-hilfen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte } from '../app/app-hilfen.ts';
import { text } from './abnahme-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true });

test('Rückweg zur Prüfung, nicht zutreffende Seite, Liste ohne Eintrag', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Testtiefe Chromium');
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('restliste.aims.json', false, (p) => delete p.organisation.leitlinie.freigabe));
  // Sprung von der Prüfseite im Guide und zurück
  await page.evaluate(() => (location.hash = '#/gefuehrt/E13/E13-pruefung'));
  await page.locator('.befunde li a.knopf').first().click();
  await expect(page).toHaveURL(/von=gefuehrt-pruefung/);
  await page.locator('#rueckweg a').click();
  await expect(page).toHaveURL(/#\/gefuehrt\/E13\/E13-pruefung/);
  // Sprung aus der Prüfansicht (Formular oder Guide): Rückweg zur Prüfansicht
  await page.evaluate(() => (location.hash = '#/gefuehrt/E3/E3-leitlinie-freigabe?von=pruefung'));
  await expect(page.locator('#rueckweg a')).toHaveAttribute('href', '#/pruefung');
  // Pfad ohne ISMS: die Seite für das Ergänzungsblatt gilt nicht
  await page.evaluate(() => (location.hash = '#/gefuehrt/E8/E8-plan-freigabe-eb'));
  const hinweis = page.locator('#nicht-zutreffend');
  await expect(hinweis).toContainText(text('de', 'app.gefuehrt.nicht_zutreffend'));
  await expect(hinweis).toContainText(text('de', 'app.gefuehrt.bedingung.mitIsms.true'));
  await hinweis.getByRole('link', { name: text('de', 'app.gefuehrt.weiter') }).click();
  await expect(page).toHaveURL(/#\/gefuehrt\/E8\/abschluss/);
  // Liste ohne Eintrag: «Kein Eintrag nötig» schliesst die Seite ohne Pflichtwarnung ab
  await page.evaluate(() => (location.hash = '#/gefuehrt/E12/E12-feststellungen'));
  await page.locator('#nicht-noetig').check();
  await page.locator('.seite .knoepfe button.weiter').click();
  await expect(page).toHaveURL(/E12-korrektur/);
  expect(fehler).toEqual([]);
});

test('Teilimport: Auszug zum offenen Projekt, Auswahl übernehmen, andere Angaben bleiben', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Testtiefe Chromium');
  const { fehler } = await starte(page);
  const datei = fixtureDatei('teilimport.aims.json');
  await oeffne(page, datei);
  const p = JSON.parse(readFileSync(datei, 'utf8'));
  const geaendert = { ...p.kiSysteme[0], zweck: 'Vom Assistenten präzisierter Zweck' };
  const neu = { ...p.kiSysteme[0], id: 'KI-002', name: 'Übersetzungsdienst' };
  // AF-003: Ein Auszug trägt schemaVersion (Skill-Format); ohne Version lehnt der Import ihn mit Handlungshinweis ab
  const auszug = { schemaVersion: p.schemaVersion, meta: { projektId: p.meta.projektId }, kiSysteme: [geaendert, neu], organisation: { name: 'Umbenannt AG' } };
  await page.evaluate(() => (location.hash = '#/start'));
  await page.click('#ki-import-start');
  await page.fill('#ki-import-text', `Hier der Auszug:\n\`\`\`json\n${JSON.stringify(auszug, null, 2)}\n\`\`\``);
  await page.click('#ki-import-uebernehmen');
  const vorschau = page.locator('#ki-teilimport');
  await expect(vorschau).toContainText('1 neu, 1 geändert, 0 unverändert');
  // Firmenname nicht übernehmen
  await vorschau.locator('[data-liste=bereiche] input[type=checkbox]').uncheck();
  await vorschau.locator('#ki-teil-uebernehmen').click();
  await expect(page).toHaveURL(/#\/formular\/uebersicht/);
  await expect(page.locator('#projekt-kachel')).toHaveAttribute('aria-label', new RegExp(`Projekt ${p.organisation.name}`));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#speichern')]);
  const g = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  expect(g.kiSysteme.map((s: { id: string }) => s.id)).toEqual(['KI-001', 'KI-002']);
  expect(g.kiSysteme[0].zweck).toBe('Vom Assistenten präzisierter Zweck');
  expect(g.risiken).toEqual(p.risiken);
  expect(g.organisation.name).toBe(p.organisation.name);
  expect(fehler).toEqual([]);
});

test('Teilimport: Auszug ohne Schemaversion zeigt eine handlungsfähige Meldung', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Testtiefe Chromium');
  const { fehler } = await starte(page);
  const datei = fixtureDatei('teilimport.aims.json');
  await oeffne(page, datei);
  const p = JSON.parse(readFileSync(datei, 'utf8'));
  const auszug = { meta: { projektId: p.meta.projektId }, kiSysteme: [{ ...p.kiSysteme[0], zweck: 'Ohne Version' }] };
  await page.evaluate(() => (location.hash = '#/start'));
  await page.click('#ki-import-start');
  await page.fill('#ki-import-text', JSON.stringify(auszug));
  await page.click('#ki-import-uebernehmen');
  await expect(page.locator('#ki-teilimport')).toHaveCount(0);
  await expect(page.locator('#ki-import-fehler')).toContainText('Schemaversion');
  await expect(page.locator('#ki-import-fehler')).toContainText('neu auszugeben');
  expect(fehler).toEqual([]);
});
