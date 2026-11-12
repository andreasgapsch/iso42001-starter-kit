// Grafik im AIMS-Manager: Lagebild (Übersicht), Risikomatrix mit Filter und Tastatur, Vorschau auf E6, Fahrplan-Gantt,
// NIST-Hantel, Fristen als Zeitleiste; axe hell und dunkel; Druck hell; eingebettete Schriften; visuelle Regression
// (nur Chromium). Referenzbilder: tests/e2e/app/__screenshots__/grafik-*.png, neu erzeugen mit
//   npx playwright test tests/e2e/app/grafik.e2e.ts --project chromium --update-snapshots
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test } from './app-hilfen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, oeffne, starte, themaVorab } from './app-hilfen.ts';

const MUSTER = join(REPO, 'src/beispiele/muster-maschinenbau.de.aims.json');
test.skip(!existsSync(join(REPO, HTML)) || !existsSync(MUSTER), 'Werkzeug nicht gebaut (npm run build:app) oder Beispiel fehlt');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 } });

const FESTE_ZEIT = new Date('2026-10-21T09:00:00Z');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function lagebild(page: Page): Promise<string[]> {
  await page.clock.setFixedTime(FESTE_ZEIT);
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  await expect(page.locator('#lagebild h1')).toBeVisible();
  return fehler;
}

async function axe(page: Page, ort: string): Promise<string[]> {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((v) => `${ort}: ${v.id} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

test('Lagebild: Kennzahlen, Matrix vor und nach, SoA je Gruppe, Massnahmen, Inventar, Etappen', async ({ page }) => {
  const fehler = await lagebild(page);
  await expect(page.locator('#lagebild .g-kennzahlen').first().locator('.g-kennzahl')).toHaveCount(4);
  for (const stand of ['vor', 'nach']) {
    const m = page.locator(`#lb-matrix-${stand}`);
    await expect(m.locator('.g-matrix__feld tbody td')).toHaveCount(16);
    // Summe der Zellen = «bewertet: n» im Fuss
    const summe = await m.locator('.g-matrix__feld tbody td').evaluateAll((tds) => tds.reduce((a, td) => a + Number((td as HTMLElement).dataset['anzahl']), 0));
    await expect(m.locator('.g-matrix__fuss')).toContainText(`bewertet: ${summe}`);
    // Höchste Stufe schraffiert, jede Zelle mit Wert und Stufe als Wort
    await expect(m.locator('td.g-stufe-hoch').first()).toHaveCSS('background-image', /repeating-linear-gradient/);
    await expect(m.locator('.g-matrix__feld tbody td').first()).toContainText(/Wert \d+, Stufe (tief|mittel|hoch)/);
  }
  await expect(page.locator('#lb-soa .g-balken__zeile')).toHaveCount(9);
  await expect(page.locator('#lb-soa .g-balken__bahn').first()).toHaveAttribute('aria-label', /^A\.2 .*: umgesetzt oder wirksam \d+/);
  await expect(page.locator('#lb-massnahmen .g-balken__bahn')).toHaveAttribute('aria-label', /überfällig \d+/);
  await expect(page.locator('#lb-inventar-tabelle tbody tr')).not.toHaveCount(0);
  await expect(page.locator('#lagebild .etappen li.aktiv a')).toHaveAttribute('aria-current', 'step');
  // Schriften eingebettet und geladen (CSP font-src data:)
  expect(await page.evaluate(async () => {
    await document.fonts.ready;
    return [document.fonts.check('700 16px "Archivo Variable"'), document.fonts.check('16px "Source Serif 4 Variable"')];
  })).toEqual([true, true]);
  expect(fehler).toEqual([]);
});

test('Risikomatrix: Klick und Tastatur filtern die Risikoliste (w, a, stand)', async ({ page }) => {
  const fehler = await lagebild(page);
  const zelle = page.locator('#lb-matrix-vor td a').first();
  const anzahl = Number(await zelle.locator('xpath=..').getAttribute('data-anzahl'));
  const w = await zelle.getAttribute('data-w');
  const a = await zelle.getAttribute('data-a');
  await zelle.click();
  await expect(page).toHaveURL(new RegExp(`#/formular/risiken\\?w=${w}&a=${a}&stand=vor`));
  await expect(page.locator('.liste-kopf [aria-live]')).toHaveText(new RegExp(`^${anzahl}\\b`));
  await expect(page.locator(`#risiken-matrix-tabelle-vor td[data-w="${w}"][data-a="${a}"]`)).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('main .hinweis').first()).toContainText(`W ${w} und A ${a}`);
  // Tastatur: Fokus auf die erste belegte Zelle, Pfeiltasten springen zu belegten Zellen, Enter öffnet die Liste
  await page.evaluate(() => (location.hash = '#/formular/uebersicht'));
  const links = page.locator('#lb-matrix-vor td a');
  await links.first().focus();
  const start = await page.evaluate(() => [(document.activeElement as HTMLElement).dataset['w'], (document.activeElement as HTMLElement).dataset['a']]);
  await page.keyboard.press('End');
  const ende = await page.evaluate(() => [(document.activeElement as HTMLElement).dataset['w'], (document.activeElement as HTMLElement).dataset['a']]);
  expect(ende[1]).toBe(start[1]);
  expect(Number(ende[0])).toBeGreaterThanOrEqual(Number(start[0]));
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  const unten = await page.evaluate(() => [(document.activeElement as HTMLElement).dataset['w'], (document.activeElement as HTMLElement).dataset['a']]);
  expect(Number(unten[1])).toBeLessThan(Number(start[1]));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`w=${unten[0]}&a=${unten[1]}&stand=vor`));
  // Tab erreicht die Zellen in der Lesereihenfolge (Links, kein tabindex)
  expect(await links.evaluateAll((l) => l.every((x) => !x.hasAttribute('tabindex')))).toBe(true);
  expect(fehler).toEqual([]);
});

test('E6: Vorschau der Matrix folgt den Grenzen sofort; Bewertung zeigt die Risiken', async ({ page }) => {
  const fehler = await lagebild(page);
  await page.evaluate(() => (location.hash = '#/gefuehrt/E6/E6-akzeptanz'));
  const zelle = page.locator('#e6-vorschau td[data-w="2"][data-a="4"]');
  await expect(zelle).toHaveClass(/g-stufe-mittel/);
  const feld = page.locator('.seite input[type=number]').nth(1);
  await feld.fill('8');
  await expect(zelle).toHaveClass(/g-stufe-hoch/);
  await expect(page.locator('#e6-vorschau .g-legende')).toContainText('ab 8');
  await feld.fill('12');
  await expect(zelle).toHaveClass(/g-stufe-mittel/);
  await page.evaluate(() => (location.hash = '#/gefuehrt/E6/E6-bewertung'));
  await expect(page.locator('#e6-matrix-tabelle-vor .g-matrix__feld tbody td')).toHaveCount(16);
  expect(fehler).toEqual([]);
});

test('Fahrplan als Gantt, NIST-Hantel, Fristen als Zeitleiste', async ({ page }) => {
  const fehler = await lagebild(page);
  await page.evaluate(() => (location.hash = '#/gefuehrt/E0/E0-fahrplan'));
  const gantt = page.locator('#fahrplan-gantt svg[role=img]');
  await expect(gantt).toBeVisible();
  await expect(gantt.locator('rect[data-zustand]')).toHaveCount(10);
  await expect(gantt.locator('desc')).toContainText('Schritt 1');
  // Beschriftungen ganz, ohne «…» (lange Titel brechen um)
  expect((await gantt.locator('text').allTextContents()).filter((x) => x.includes('…'))).toEqual([]);
  await page.evaluate(() => (location.hash = '#/formular/nistrmf/profil'));
  const hantel = page.locator('#nist-hantel-grafik svg[role=img]');
  await expect(hantel).toBeVisible();
  await expect(hantel.locator('desc')).toContainText('GOVERN');
  await expect(page.locator('#nist-hantel-grafik table tbody tr')).toHaveCount(4);
  await page.evaluate(() => (location.hash = '#/formular/aiact/fristen'));
  const zeit = page.locator('#fristen-zeitleiste .g-zeitleiste');
  await expect(zeit.locator('.g-zeit--aktiv')).toHaveCount(1);
  // Ein Stichtag für alle Ansichten (U-01): das Beispiel rechnet mit seinem Datenstand
  await expect(zeit.locator('.g-zeit--heute')).toContainText('Stichtag 05.02.2027');
  expect(fehler).toEqual([]);
});

for (const modus of ['hell', 'dunkel'] as const) {
  test(`axe ${modus}: Lagebild, Risiken mit Matrix, E6, Fahrplan, NIST, Fristen`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'axe einmal genügt');
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: modus === 'hell' ? 'light' : 'dark' });
    await themaVorab(page, modus);
    const fehler = await lagebild(page);
    const befunde: string[] = [];
    for (const h of ['#/formular/uebersicht', '#/formular/risiken?w=3&a=4&stand=vor', '#/gefuehrt/E6/E6-akzeptanz', '#/gefuehrt/E6/E6-bewertung', '#/gefuehrt/E0/E0-fahrplan', '#/formular/nistrmf/profil', '#/formular/aiact/fristen', '#/ueber']) {
      await page.evaluate((x) => (location.hash = x), h);
      await expect(page.locator('main h1').first()).toBeVisible();
      await page.waitForTimeout(150);
      // Aufklapper öffnen, damit die Textalternativen mitgeprüft werden
      await page.locator('main details:not([open]) > summary').evaluateAll((s) => s.forEach((x) => (x as HTMLElement).click()));
      befunde.push(...(await axe(page, h)));
    }
    expect(befunde).toEqual([]);
    expect(fehler).toEqual([]);
  });
}

test('Druck immer hell, Bedienung ausgeblendet', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Druckmedium einmal genügt');
  await page.emulateMedia({ colorScheme: 'dark' });
  await lagebild(page);
  await page.emulateMedia({ colorScheme: 'dark', media: 'print' });
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
  await expect(page.locator('nav.symbolleiste')).toBeHidden();
  await expect(page.locator('#untermenue')).toBeHidden();
  // Seitenkopf im Druck nur mit dem Titel (U-34): Suche, Speicherstand und Hauptaktion ausgeblendet
  await expect(page.locator('main .seitenkopf h1')).toBeVisible();
  for (const sel of ['#suche', '#speichern', '#lagebild-drucken', '#untermenue-knopf']) await expect(page.locator(sel), sel).toBeHidden();
  await expect(page.locator('#lb-matrix-vor')).toBeVisible();
});

for (const thema of ['hell', 'dunkel'] as const) {
  test.describe(`Bilder ${thema}`, () => {
    test.use({ colorScheme: thema === 'hell' ? 'light' : 'dark' });
    test(`Lagebild und Risikomatrix ${thema}`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Referenzbilder nur für Chromium');
      await themaVorab(page, thema);
      await lagebild(page);
      await expect(page.locator('#meldung')).toHaveText('', { timeout: 10_000 });
      await page.evaluate(() => document.fonts.ready);
      // Maus weg von der Grafik (der Klick auf «Öffnen» liegt sonst über einer Zelle: Hover-Rahmen)
      await page.mouse.move(1, 1);
      await expect(page).toHaveScreenshot(`grafik-lagebild-${thema}.png`, { fullPage: true });
      await expect(page.locator('#lb-risiken')).toHaveScreenshot(`grafik-risikomatrix-${thema}.png`);
      await page.evaluate(() => (location.hash = '#/gefuehrt/E0/E0-fahrplan'));
      await expect(page.locator('#fahrplan-gantt svg')).toBeVisible();
      await expect(page.locator('#fahrplan-gantt')).toHaveScreenshot(`grafik-gantt-${thema}.png`);
    });
  });
}
