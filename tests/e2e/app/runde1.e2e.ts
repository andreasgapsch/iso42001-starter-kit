// Regressionen der ersten Prüfrunde im Browser.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test, beantworteRueckfragen } from './app-hilfen.ts';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { REPO } from '../spikes/hilfen.ts';
import { waehle } from '../auswahl-hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte } from './app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true });

const neu = async (page: Page) => {
  await page.click('#start-neu');
  await page.locator('input[name=isms]').nth(2).check();
  await page.locator('input[name=modul]').nth(1).check();
  await page.click('#neu-anlegen');
  await expect(page.locator('h1')).toBeFocused();
};

test('E-16: kaputte Adresse zeigt die Startseite, keine weisse Seite und keinen Fehlerdialog', async ({ page }) => {
  const { fehler } = await starte(page);
  for (const h of ['#/%', '#/formular/%E0%A4%A', '#/gefuehrt/%', '#/formular/__proto__', '#/formular/toString']) {
    await page.evaluate((x) => (location.hash = x), h);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('#fehler-dialog')).toHaveCount(0);
  }
  expect(fehler).toEqual([]);
});

test('C-01: neues Projekt meldet nie «Bereit», Lücken stehen mit Weg in der Prüfung', async ({ page, browserName }) => {
  const { fehler } = await starte(page);
  await neu(page);
  await page.evaluate(() => (location.hash = '#/pruefung'));
  await expect(page.locator('[data-bereitschaft]')).not.toHaveText(/Bereit für Stage 1|Bereit mit Hinweisen/);
  await expect(page.locator('#pruefung-luecken')).toBeVisible();
  await expect(page.locator('#pruefung-luecken [data-luecke=etappe]').first()).toBeVisible();
  // Die Liste der Lücken erfüllt auch die Zielgrösse (WCAG 2.5.8)
  if (browserName === 'chromium') expect((await new AxeBuilder({ page }).include('#pruefung-luecken').withTags(['wcag22aa']).analyze()).violations).toEqual([]);
  await page.evaluate(() => (location.hash = '#/pruefung/stage1'));
  await expect(page.locator('#s1-ergebnis')).toContainText('Noch nicht bereit');
  await expect(page.locator('#s1-vor-audit')).toBeVisible();
  expect(fehler).toEqual([]);
});

test('C-01: vollständig bearbeitetes Beispiel meldet Bereit', async ({ page }) => {
  await starte(page);
  await page.locator('[data-beispiele] button', { hasText: 'Muster' }).first().click();
  await page.evaluate(() => (location.hash = '#/pruefung'));
  await expect(page.locator('[data-bereitschaft]')).toHaveText(/Bereit/);
  await expect(page.locator('[data-bereitschaft]')).not.toHaveText('Noch nicht bereit');
  await expect(page.locator('#pruefung-luecken')).toHaveCount(0);
});

test('D-08: Titel der Registerkarte folgt der Seite; D-09: Fokus auf dem Titel', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('titel.aims.json'));
  await page.evaluate(() => (location.hash = '#/formular/risiken'));
  await expect(page).toHaveTitle(/^Risik.*· .*AIMS-Manager$/);
  await page.evaluate(() => (location.hash = '#/formular/uebersicht'));
  await expect(page.locator('h1')).toBeFocused();
  await page.evaluate(() => (location.hash = '#/formular/meldungen'));
  await expect(page.locator('h1')).toBeFocused();
  expect(fehler).toEqual([]);
});

test.describe('Telefon', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('D-01: Suchergebnisse ganz im Fenster', async ({ page }) => {
    await starte(page);
    await oeffne(page, fixtureDatei('suche.aims.json'));
    for (const r of ['#/formular/uebersicht', '#/hinweise']) {
      await page.evaluate((x) => (location.hash = x), r);
      const feld = page.locator('.seitenkopf .suche input').first();
      await feld.fill('KI');
      const box = await page.locator('.suche-ergebnis').boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
      await feld.fill('');
    }
  });
});

test.describe('1280', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test('D-02: Seitentitel bricht nie mitten im Wort', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Testtiefe Chromium');
    await starte(page);
    await page.locator('[data-beispiele] button', { hasText: 'Muster' }).first().click();
    for (const r of ['#/prozesse/PR-01', '#/gefuehrt/E6/E6-skalen', '#/gefuehrt/E2/E2-grenzen']) {
      await page.evaluate((x) => (location.hash = x), r);
      await page.waitForTimeout(150);
      // Jedes Wort des Titels liegt auf einer Zeile, ausser es enthält eine Trennstelle
      const gebrochen = await page.locator('h1').first().evaluate((h) => {
        const n = document.createTreeWalker(h, NodeFilter.SHOW_TEXT).nextNode();
        if (!n?.textContent) return [] as string[];
        const aus: string[] = [];
        for (const m of n.textContent.matchAll(/[\p{L}\p{N}-]{4,}/gu)) {
          const b = document.createRange();
          b.setStart(n, m.index);
          b.setEnd(n, m.index + m[0].length);
          if (new Set([...b.getClientRects()].map((x) => Math.round(x.top))).size > 1 && getComputedStyle(h).hyphens !== 'auto') aus.push(m[0]);
        }
        return aus;
      });
      expect(gebrochen, r).toEqual([]);
    }
  });
});

test('E-12: voller Zwischenspeicher wird sichtbar, der Fehlerdialog verspricht nichts Falsches', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Testtiefe Chromium');
  await starte(page);
  await neu(page);
  await page.evaluate(() => {
    const voll = () => { throw new DOMException('voll', 'QuotaExceededError'); };
    IDBObjectStore.prototype.put = voll as never;
    Storage.prototype.setItem = voll as never;
    globalThis.dispatchEvent(new Event('pagehide'));
  });
  await expect(page.locator('#warnung-zwischenspeicher')).toBeVisible({ timeout: 8000 });
});

test('E-13: zweiter Tab mit demselben Projekt wird in beiden Tabs gemeldet', async ({ page, context }) => {
  const datei = fixtureDatei('tabs.aims.json');
  await starte(page);
  await oeffne(page, datei);
  const zwei = await context.newPage();
  await starte(zwei);
  await oeffne(zwei, datei);
  await expect(zwei.locator('#warnung-tabs')).toBeVisible();
  await expect(page.locator('#warnung-tabs')).toBeVisible();
  await zwei.close();
  await expect(page.locator('#warnung-tabs')).toHaveCount(0, { timeout: 5000 });
});

test('E-14: Beispiel über offene Änderungen fragt zurück, Absage lässt das Projekt offen', async ({ page }) => {
  await starte(page);
  await oeffne(page, fixtureDatei('wechsel.aims.json'));
  await page.evaluate(() => (location.hash = '#/formular/inventar/KI-001'));
  await page.fill('#editor-kiSysteme input[type=text] >> nth=0', 'Neue Eingabe');
  await page.evaluate(() => (location.hash = '#/start/projekte'));
  let frage = '';
  await beantworteRueckfragen(page, (text) => { frage = text; return false; }, { einmal: true });
  await page.locator('[data-beispiele] button').first().click();
  await expect.poll(() => frage).toContain('ungespeicherte');
  await page.evaluate(() => (location.hash = '#/formular/inventar/KI-001'));
  await expect(page.locator('#editor-kiSysteme input[type=text]').first()).toHaveValue('Neue Eingabe');
});

test('E-01, E-02: Sicherung mit ungültigem Register und langer Dateiname machen die Datei nicht unlesbar', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Testtiefe Chromium');
  await starte(page);
  await neu(page);
  await page.evaluate(() => (location.hash = '#/bibliothek'));
  await page.click('#bib-browser');
  // Langer Dateiname
  await page.setInputFiles('#bib-datei', { name: `${'L'.repeat(260)}.txt`, mimeType: 'text/plain', buffer: Buffer.from('x') });
  await expect(page.locator('.bib-tabelle')).toContainText('LLLL');
  // Sicherung: ein gültiger, ein ungültiger Eintrag
  const v = { version: '0.1', datei: 'Eigene/X-050_a/v0.1.txt', groesse: 1, pruefsumme: 'a'.repeat(64), datum: '2026-10-01T08:00:00Z' };
  const reg = { format: 'aims-bibliothek', version: 1, projektId: 'wird-gesetzt', organisation: 'X', geaendert: '2026-10-01', uebersicht: [], eintraege: [{ id: 'X-050', art: 'eigene', titel: 'Gut', versionen: [v] }, { id: 'X-051', art: 'eigene', boese: 1, versionen: [{ ...v, datei: 7 }] }] };
  await beantworteRueckfragen(page, true, { einmal: true });
  await page.setInputFiles('#bib-laden-datei', { name: 's.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync({ 'bibliothek.json': strToU8(JSON.stringify(reg)), 'Eigene/X-050_a/v0.1.txt': strToU8('x') })) });
  await expect(page.locator('#meldung')).toContainText('X-051');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#speichern')]);
  const text = readFileSync(await dl.path(), 'utf8');
  // Die gespeicherte Datei lässt sich wieder öffnen
  const datei = fixtureDatei('zurueck.aims.json');
  (await import('node:fs')).writeFileSync(datei, text);
  await page.reload();
  await page.waitForSelector('body[data-bedienbar]');
  await oeffne(page, datei);
  await expect(page.locator('#start-fehler')).toHaveCount(0);
});

test('C-02: Generator-Datei trägt nach der Freigabe Version und Freigabe im Kopf; eigene Datei behält ihre Bytes', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Testtiefe Chromium');
  test.setTimeout(180_000);
  await beantworteRueckfragen(page, true);
  await starte(page);
  await oeffne(page, fixtureDatei('freigabe.aims.json', false, (p) => {
    p.personen.push({ id: 'P-010', name: 'Hans Keller', funktion: 'CEO', aimsRollen: [] }, { id: 'P-011', name: 'Rita Graf', funktion: 'CIO', aimsRollen: [] });
    p.dokumente = p.dokumente.filter((d) => d.id !== 'D-12');
  }));
  await page.evaluate(() => (location.hash = '#/bibliothek/alle'));
  await page.click('#bib-browser');
  await page.click('#bib-erzeugen');
  await expect(page.locator('#meldung')).toContainText(/Neue Versionen|New versions/, { timeout: 120_000 });
  await page.evaluate(() => (location.hash = '#/bibliothek/alle/D-12'));
  await page.click('#bib-status-in-pruefung');
  await page.click('#bib-status-freigegeben');
  await waehle(page.locator('#bib-gp-von'), 'P-010');
  await waehle(page.locator('#bib-fg-von'), 'P-011');
  await page.click('#bib-freigabe-ok');
  await expect(page.locator('#meldung')).toContainText(/Kopf neu erzeugt|regenerated/, { timeout: 30_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bib-herunterladen')]);
  expect(dl.suggestedFilename()).toContain('v1.0');
  const xml = strFromU8(unzipSync(readFileSync(await dl.path()))['word/document.xml']!) + Object.entries(unzipSync(readFileSync(await dl.path()))).filter(([n]) => /word\/(header|footer)/.test(n)).map(([, b]) => strFromU8(b)).join('');
  const text = xml.replace(/<[^>]+>/g, '');
  expect(text).toContain('Rita Graf');
  expect(text).not.toMatch(/noch nicht freigegeben/);
  // Eigene Datei: Bytes bleiben, Hinweis im Formular
  await page.setInputFiles('#bib-datei', { name: 'Eigene Richtlinie.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('EIGEN') });
  await expect(page.locator('#bib-detail')).toContainText('X-001');
  await page.click('#bib-status-in-pruefung');
  await page.click('#bib-status-freigegeben');
  await expect(page.locator('#bib-freigabe-eigene')).toBeVisible();
});

test('axe: Kernseiten ohne Verstösse (Telefon und Desktop)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Testtiefe Chromium');
  test.setTimeout(120_000);
  await starte(page);
  await page.locator('[data-beispiele] button', { hasText: 'Muster' }).first().click();
  for (const breite of [1440, 390]) {
    await page.setViewportSize({ width: breite, height: 900 });
    for (const r of ['#/formular/uebersicht', '#/formular/risiken/R-027', '#/gefuehrt/E12/E12-audit', '#/gefuehrt/E5', '#/wissen/leitfaden/07', '#/prozesse/PR-21', '#/bibliothek/alle', '#/pruefung', '#/formular/nistrmf', '#/formular/aiact/fristen']) {
      await page.evaluate((x) => (location.hash = x), r);
      await page.waitForTimeout(250);
      const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
      expect(a.violations.map((v) => `${r} ${breite}: ${v.id} ${v.nodes[0]?.target}`), r).toEqual([]);
    }
  }
});

