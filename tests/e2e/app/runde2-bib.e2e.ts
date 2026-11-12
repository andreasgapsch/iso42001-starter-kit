// Runde 2 (C2-03, C2-09): Sammelfreigabe übernimmt die Eigner/in ins Register, ein zweiter Lauf ohne Änderung erzeugt keine Entwürfe.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test, beantworteRueckfragen } from './app-hilfen.ts';
import { waehle } from '../auswahl-hilfen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte } from './app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.skip(({ browserName }) => browserName !== 'chromium', 'Ablauf einmal genügt, Speichervorgabe der VM');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true });

test('C2-03, C2-09: Sammelfreigabe, dann erneut erzeugen', async ({ page }) => {
  test.setTimeout(280_000);
  await starte(page);
  await oeffne(page, fixtureDatei('r2-bib.aims.json', false, (p) => {
    p.personen.push({ id: 'P-010', name: 'Hans Keller', funktion: 'CEO', aimsRollen: [] }, { id: 'P-011', name: 'Rita Graf', funktion: 'CIO', aimsRollen: [] });
    p.dokumente = [];
    p.organisation.aimsVerantwortlich = 'P-001';
  }));
  await page.evaluate(() => (location.hash = '#/bibliothek/alle'));
  await page.click('#bib-browser');
  await page.click('#bib-erzeugen');
  await expect(page.locator('#meldung')).toContainText(/Neue Versionen/, { timeout: 120_000 });
  await page.locator('#bib-sammel summary').click();
  await page.click('#bib-sammel-pruefung');
  await waehle(page.locator('#bib-sammel-pruefer'), 'P-010');
  await waehle(page.locator('#bib-sammel-freigeber'), 'P-011');
  await page.click('#bib-sammel-freigeben');
  // Nach dem Lauf ist nichts mehr in Prüfung, der Knopf ist aus
  await expect(page.locator('#bib-sammel-freigeben')).toBeDisabled({ timeout: 200_000 });
  await expect(page.locator('#meldung')).toContainText(/Dokumente geändert/, { timeout: 30_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  const gespeichert = JSON.parse(readFileSync(await dl.path(), 'utf8')) as { dokumente: { id: string; eigner?: string }[] };
  expect(gespeichert.dokumente.length).toBeGreaterThan(5);
  expect(gespeichert.dokumente.filter((d) => !d.eigner).map((d) => d.id)).toEqual([]);
  await page.click('#bib-erzeugen');
  // Einzig das Dokumentenregister D-26 ändert sich wirklich: Es führt die Freigaben als Inhalt. Vorher waren es 5 Entwürfe
  await expect(page.locator('#meldung')).toContainText(/Firmendokumente erzeugt\. Neue Versionen: [01],/, { timeout: 120_000 });
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  const stand = JSON.parse(readFileSync(await dl2.path(), 'utf8')) as { bibliothek: { eintraege: { id: string; versionen: { version: string }[] }[] } };
  const neue = stand.bibliothek.eintraege.filter((e) => e.versionen.some((v) => /^1\.[1-9]/.test(v.version))).map((e) => e.id);
  expect(neue.filter((id) => !id.startsWith('D-26'))).toEqual([]);
  await expect(page.locator('#meldung')).toContainText(/heruntergeladen/);
  await page.click('#bib-erzeugen');
  await expect(page.locator('#meldung')).toContainText(/Firmendokumente erzeugt\. Neue Versionen: 0,/, { timeout: 120_000 });
  // C2-09: Spalte «Gültig» nennt die freigegebene Version
  const kopf = await page.locator('.kartenliste thead th').allTextContents();
  const spalte = kopf.findIndex((k) => k.includes('Gültig'));
  expect(spalte).toBeGreaterThan(0);
  const gueltig = await page.locator(`.kartenliste tbody tr td:nth-child(${spalte + 1})`).allTextContents();
  expect(gueltig.filter((g) => /^v1\./.test(g)).length).toBeGreaterThan(5);
  // C2-09: Lauf, der viele freigegebene Dokumente betrifft (neuer Firmenname), fragt zuerst; Absage lässt alles, wie es ist
  await page.evaluate(() => (location.hash = '#/formular/organisation'));
  await page.locator('#hauptinhalt input[type=text]').first().fill('Neue Firma AG');
  await page.evaluate(() => (location.hash = '#/bibliothek/alle'));
  let frage = '';
  await beantworteRueckfragen(page, (text) => { frage = text; return false; }, { einmal: true });
  await page.click('#bib-erzeugen');
  await expect(page.locator('#meldung')).toContainText('Nichts erzeugt', { timeout: 120_000 });
  expect(frage).toMatch(/\d+ Dokumente ändern sich, \d+ davon sind freigegeben/);
});
