// AIMS-Manager (dist/app/aims-manager.html) über file:// in Chromium, Firefox und WebKit:
// Start, Guide, Projektdatei öffnen und speichern, Formularansicht, Prüfung, Dokumentset, CSP, Netzwerk, Barrierefreiheit.
// Voraussetzung: npm run build:app
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { test } from './app-hilfen.ts';
import { unzipSync } from 'fflate';
import { REPO, netzProtokoll } from '../spikes/hilfen.ts';
import { HTML, ORDNER, fixtureDatei, oeffne, starte } from './app-hilfen.ts';
import { waehle } from '../auswahl-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true });

test('Start: Namensnennung, Datenschutzhinweis, bedienbar unter 1,5 s, keine Fremdanfragen', async ({ page, context }) => {
  const netz = netzProtokoll(context);
  const t0 = Date.now();
  const { fehler } = await starte(page);
  expect(Date.now() - t0).toBeLessThan(1500 * (process.env['CI'] ? 3 : 1));
  await expect(page.locator('#namensnennung')).toContainText('Andreas Gapsch, KMU-CIO, kmu-cio.ch');
  await expect(page.locator('.datenschutz')).toContainText('verlassen diesen Rechner nicht');
  expect(netz.fremd()).toEqual([]);
  expect(fehler).toEqual([]);
});

test('Guide: Pflichtfelder, Enter für Weiter, Später, Etappenabschluss', async ({ page }) => {
  const { fehler } = await starte(page);
  await page.click('#start-neu');
  // ohne Antwort auf Pfad und Modul legt der Dialog nichts an (keine stille Vorbelegung)
  await page.click('#neu-anlegen');
  await expect(page.locator('#neu-titel')).toBeVisible();
  await page.locator('input[name=isms]').nth(2).check();
  await page.locator('input[name=modul]').nth(1).check();
  await page.click('#neu-anlegen');
  await expect(page.locator('h1')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/E0-firma/);
  await expect(page.locator('h1')).toHaveText('Ihr Unternehmen');
  await expect(page.locator('h1')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[role=alert]')).toBeVisible();
  await page.fill('#f-E0-firma-organisation_name', 'Beispiel AG');
  await waehle(page.locator('#f-E0-firma-organisation_branche'), { index: 1 });
  await page.locator('#f-E0-firma-organisation_name').press('Enter');
  await expect(page).toHaveURL(/E0-groesse/);
  await expect(page.locator('#speicherstatus')).toHaveText('Ungespeicherte Änderungen');
  for (let i = 0; i < 12 && !/abschluss/.test(page.url()); i++) {
    await page.getByRole('button', { name: 'Später' }).or(page.locator('.knoepfe button.weiter')).first().click();
  }
  await expect(page).toHaveURL(/E0\/abschluss/);
  await expect(page.locator('.befunde li').first()).toBeVisible();
  await page.locator('.knoepfe button.weiter').click();
  await expect(page).toHaveURL(/#\/gefuehrt\/E1/);
  expect(fehler).toEqual([]);
});

test('Projektdatei öffnen, Formularansicht, Prüfung mit Sprung, Speichern ohne Datenverlust', async ({ page }) => {
  const { fehler } = await starte(page);
  const datei = fixtureDatei('rundlauf.aims.json');
  await oeffne(page, datei);
  // Kein Befund der Regeln, aber der Guide ist nicht bearbeitet: nicht «bereit» (C-01). Das Beispiel unten prüft den Gutfall.
  await expect(page.locator('[data-bereitschaft]')).toHaveText('Noch nicht bereit');
  await expect(page.locator('.ampel-zahlen')).toContainText('0 Fehler');
  await page.evaluate(() => (location.hash = '#/formular/inventar/KI-001'));
  await page.fill('#editor-kiSysteme input[type=text] >> nth=0', 'Copilot Business');
  await page.evaluate(() => (location.hash = '#/formular/risiken'));
  await expect(page.locator('.vliste .zeile')).toHaveCount(1);
  // Eigner entfernen: Prüfung meldet F01 mit Sprungziel
  await page.evaluate(() => (location.hash = '#/formular/inventar/KI-001'));
  await waehle(page.locator('#ff-KI-001-eigner'), '');
  await page.evaluate(() => (location.hash = '#/pruefung'));
  await expect(page.locator('.ampel-zahlen')).toContainText('1 Fehler');
  await page.locator('.befunde li', { hasText: 'F01' }).locator('a.knopf').click();
  await expect(page).toHaveURL(/#\/formular\/inventar\/KI-001/);
  await waehle(page.locator('#ff-KI-001-eigner'), 'P-001');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#speichern')]);
  const gespeichert = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  const original = JSON.parse(readFileSync(datei, 'utf8'));
  original.kiSysteme[0].name = 'Copilot Business';
  delete original.meta.geaendert;
  delete gespeichert.meta.geaendert;
  expect(gespeichert).toEqual(original);
  await expect(page.locator('#speicherstatus')).toHaveText('Gespeichert');
  expect(fehler).toEqual([]);
});

test('Ungültige Datei: verständliche Meldung statt Absturz', async ({ page }) => {
  const { fehler } = await starte(page);
  mkdirSync(ORDNER, { recursive: true });
  const datei = join(ORDNER, 'kaputt.aims.json');
  writeFileSync(datei, '{"meta": ');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#start-oeffnen')]);
  await fc.setFiles(datei);
  await expect(page.locator('#start-fehler')).toContainText('keine gültige Projektdatei');
  expect(fehler).toEqual([]);
});

test('Dokumentset mit ISMS und Modul als ZIP unter CSP mit Trusted Types', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('set.aims.json', true));
  await page.evaluate(() => (location.hash = '#/dokumente'));
  const t0 = Date.now();
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.click('#set-erzeugen')]);
  const dauer = Date.now() - t0;
  const zip = unzipSync(new Uint8Array(readFileSync(await dl.path())));
  const namen = Object.keys(zip);
  expect(namen.length).toBeGreaterThanOrEqual(34);
  expect(namen).toEqual(expect.arrayContaining(['D-03_KI-Leitlinie.docx', 'D-06-EB_Verfahren-Risiko.docx', 'E-09_Fristen-Stand.docx']));
  expect(dauer).toBeLessThan(15_000 * (process.env['CI'] ? 3 : 1));
  await expect(page.locator('#set-ergebnis')).toContainText('Dateien erzeugt');
  expect(fehler).toEqual([]);
});

test('Barrierefreiheit (axe, WCAG 2.1 AA): Start, Guide, Formular, Prüfung', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'axe einmal genügt');
  await starte(page);
  const pruefe = async (ort: string) => {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(r.violations.map((v) => `${ort}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
  };
  await pruefe('start');
  await oeffne(page, fixtureDatei('a11y.aims.json'));
  await pruefe('uebersicht');
  for (const h of ['#/gefuehrt/E4/E4-systeme', '#/gefuehrt/E2/E2-themen', '#/formular/soa/A.2.2', '#/pruefung', '#/dokumente', '#/einstellungen']) {
    await page.evaluate((x) => (location.hash = x), h);
    await page.waitForTimeout(200);
    await pruefe(h);
  }
});

// V-11 (Designsystem AIMS Nachtblau, AF-157): Rückfragen im eigenen Dialog statt confirm()
test('V-11: Löschen fragt im eigenen Dialog (alertdialog, Fokus auf Abbrechen, Esc löscht nicht, Knopf nennt die Handlung)', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('v11.aims.json'));
  await page.evaluate(() => (location.hash = '#/formular/ziele/Z-001'));
  const knopf = page.locator('main').getByRole('button', { name: 'Eintrag entfernen', exact: true });
  await knopf.click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Wollen Sie diesen Eintrag wirklich entfernen?');
  await expect(dialog.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Eintrag entfernen' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/Z-001/);
  await expect(knopf).toBeVisible();
  await knopf.click();
  await dialog.getByRole('button', { name: 'Eintrag entfernen' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/Z-001/);
  expect(fehler).toEqual([]);
});

// V-08 (Designsystem AIMS Nachtblau): Pflicht steht als Wort neben der Beschriftung, sichtbar und im zugänglichen Namen
test('V-08: jedes Feld mit aria-required zeigt das Wort «Pflicht» und nennt es im zugänglichen Namen', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('v08.aims.json'));
  let geprueft = 0;
  for (const h of ['#/gefuehrt/E0/E0-firma', '#/gefuehrt/E4/E4-systeme', '#/gefuehrt/E8/E8-behandlung', '#/formular/inventar/KI-001', '#/formular/risiken/R-001']) {
    await page.evaluate((x) => (location.hash = x), h);
    await expect(page.locator('main h1').first()).toBeVisible();
    await page.waitForTimeout(150);
    const felder = page.locator('main [aria-required="true"]');
    const n = await felder.count();
    for (let i = 0; i < n; i++) {
      const f = felder.nth(i);
      if (!(await f.isVisible())) continue;
      await expect(f, `${h} Feld ${i}`).toHaveAccessibleName(/Pflicht/);
      const wort = f.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " feld ")][1]').locator('.pflicht').first();
      await expect(wort, `${h} Feld ${i}`).toBeVisible();
      await expect(wort).toHaveText('Pflicht');
      geprueft++;
    }
  }
  expect(geprueft).toBeGreaterThan(3);
  expect(fehler).toEqual([]);
});

// M3 (Designsystem AIMS Nachtblau): Guide E8 «Behandlung je Risiko». «Vermindern» ohne Control: «Weiter» fokussiert die
// Fehlerzusammenfassung, der Sprung führt zum Feld Controls; «Massnahme erfassen» legt M-xxx mit Bezug R-003 an, ohne die
// Seite zu verlassen; ein Vorschlag verknüpft ein Control mit einem Klick.
test('M3: E8 Behandlung je Risiko: Zusammenfassung mit Fokus, Sprung zu Controls, Massnahme direkt erfassen, Vorschlag verknüpfen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const { fehler } = await starte(page);
  const p = JSON.parse(readFileSync(join(REPO, 'src/beispiele/muster-maschinenbau.de.aims.json'), 'utf8')) as { risiken: { id: string; controls: string[] }[] };
  p.risiken.find((r) => r.id === 'R-003')!.controls = [];
  mkdirSync(ORDNER, { recursive: true });
  const datei = join(ORDNER, `${test.info().project.name}-m3.aims.json`);
  writeFileSync(datei, JSON.stringify(p));
  await oeffne(page, datei);
  await page.evaluate(() => (location.hash = '#/gefuehrt/E8/E8-behandlung?eintrag=R-003'));
  const karte = page.locator('#eintrag-R-003');
  await expect(karte).toBeVisible();
  await expect(page.locator('#controls-vorschlaege-R-003')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#massnahme-neu-R-003-knopf')).toBeInViewport({ ratio: 1 });
  // Durchsicht Referenzbild guide-e8-behandlung-1280: «Massnahme erfassen» in einer Zeile, nicht umbrochen
  expect((await page.locator('#massnahme-neu-R-003-knopf').boundingBox())!.height).toBeLessThanOrEqual(40);
  await expect(page.locator('#controls-vorschlaege-R-003 button').first()).toHaveText('A.4.3 verknüpfen');
  await page.locator('#kopf-weiter').click();
  const zf = page.locator('#fehler-zusammenfassung');
  await expect(zf).toBeFocused();
  await expect(zf).toContainText('R-003, Controls: «Vermindern» braucht mindestens ein verknüpftes Control.');
  // Laptop M3: Zusammenfassung, Vorschläge und «Massnahme erfassen» zugleich ohne Scrollen sichtbar
  await page.evaluate(() => scrollTo(0, 0));
  for (const sel of ['#fehler-zusammenfassung', '#controls-vorschlaege-R-003', '#massnahme-neu-R-003-knopf']) await expect(page.locator(sel), sel).toBeInViewport({ ratio: 1 });
  await expect(page).toHaveURL(/E8-behandlung/);
  await zf.getByRole('link', { name: 'Zum Feld Controls' }).click();
  await expect(page.locator('#f-E8-behandlung-R-003-controls')).toBeFocused();
  const url = page.url();
  await page.fill('#massnahme-neu-R-003', 'Berechtigungen in M365 bereinigen');
  await page.click('#massnahme-neu-R-003-knopf');
  await expect(page.locator('#meldung')).toContainText(/M-\d+ erfasst und mit R-003 verknüpft/);
  expect(page.url()).toBe(url);
  const neu = /M-\d+/.exec((await page.locator('#meldung').textContent()) ?? '')![0];
  await expect(karte.locator('[data-feld=massnahmen] .wahl-pille', { hasText: neu })).toBeVisible();
  await page.locator('#controls-vorschlaege-R-003 button').first().click();
  await expect(karte.locator('[data-feld=controls] .wahl-pille', { hasText: 'A.4.3' })).toBeVisible();
  // B16: die neue Massnahme trägt den Bezug R-003 im Feld (Herkunft Risiko, Bezug R-003), nicht nur in der Meldung
  await page.evaluate((id) => (location.hash = `#/gefuehrt/E8/E8-massnahmen?eintrag=${id}`), neu);
  await expect(page.locator(`#f-E8-massnahmen-${neu}-herkunft_ref`)).toHaveValue('R-003');
  await expect(page.locator(`#f-E8-massnahmen-${neu}-herkunft_art`)).toContainText('Risiko');
  expect(fehler).toEqual([]);
});
