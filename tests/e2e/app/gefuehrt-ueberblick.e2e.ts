// Guide: Überblick vor E0 (Einstieg beim Öffnen), Navigation in zwei Ebenen (Nutzertest rc.10, U-08): Etappen im
// Untermenü mit Stand (aria-current, erledigt mit Haken, läuft, offen), Seiten als Punktreihe im Kopf (Seite x von y),
// keine Etappenleiste und keine Seitenliste mehr; Kopf ohne Überlauf bei 1280, 1440 und 2000 px sowie Tablet (DE und EN),
// Untermenü ohne Umbruch mitten im Wort, breite Hilfe mit Griff (Tastatur, gemerkt), axe hell und dunkel, Tastatur.
// Über file:// in Chromium, Firefox und WebKit; axe nur Chromium.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test } from './app-hilfen.ts';
import { aktiveEtappen, aktiveSeiten } from '../../../src/app/logik/gefuehrt.ts';
import type { GefuehrtDaten, SeiteDef } from '../../../src/app/logik/gefuehrt-typen.ts';
import type { Projekt } from '../../../src/model/typen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { text } from '../abnahme/abnahme-hilfen.ts';
import { HTML, bereichLink, fixtureDatei, oeffne, starte, themaVorab, untermenueLink } from './app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');

const gefuehrt = JSON.parse(readFileSync(join(REPO, 'src/generiert/gefuehrt.json'), 'utf8')) as GefuehrtDaten;
const geh = (page: Page, hash: string) => page.evaluate((h) => (location.hash = h), hash);

function seiten(p: Projekt, etappe: string): string[] {
  const e = aktiveEtappen(gefuehrt, p).find((x) => x.id === etappe)!;
  return aktiveSeiten(gefuehrt, e, p).filter((s): s is SeiteDef => s.typ !== 'fehlt').map((s) => s.id);
}

/** E5 vollständig, E4 teilweise (eine Seite später), Stelle zum Weitermachen in E4, Zieltermin gesetzt. */
function stand(p: Projekt): void {
  const e4 = seiten(p, 'E4');
  p.meta.gefuehrt.etappen['E5'] = { status: 'in-arbeit', spaeter: [], besucht: seiten(p, 'E5') };
  p.meta.gefuehrt.etappen['E4'] = { status: 'in-arbeit', spaeter: [e4[1]!], besucht: [e4[0]!, e4[2]!, e4[3]!] };
  p.meta.gefuehrt.aktuelleEtappe = 'E4';
  p.meta.gefuehrt.aktuelleSeite = e4[4]!;
  p.organisation.zielterminStage1 = '2027-03-26';
}

async function oeffneMitStand(page: Page, name: string): Promise<{ fehler: string[] }> {
  const r = await starte(page);
  await oeffne(page, fixtureDatei(name, false, stand));
  return r;
}

test.describe('Überblick und Etappen im Untermenü', () => {
  test.use({ locale: 'de-CH', viewport: { width: 1440, height: 1000 } });

  test('Überblick beim Öffnen des Guides, Weitermachen per Tastatur', async ({ page }) => {
    const { fehler } = await oeffneMitStand(page, 'ueberblick.aims.json');
    await bereichLink(page, 'Guide').click();
    await expect(page).toHaveURL(/#\/gefuehrt$/);
    await expect(untermenueLink(page, 'Überblick')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#ueberblick h1')).toHaveText(text('de', 'app.ueberblick.titel'));
    await expect(page.locator('#ueberblick h1')).toBeFocused();
    // Keine zweite Navigationsebene neben dem Untermenü (U-08)
    await expect(page.locator('.etappen-huelle, #zum-ueberblick')).toHaveCount(0);
    // Etappen als Grafik: eine Zeile je aktive Etappe mit Status und Prozent
    const zeilen = page.locator('#ub-etappen-balken .g-balken__zeile');
    expect(await zeilen.count()).toBeGreaterThan(10);
    await expect(zeilen.filter({ hasText: 'E5 ' }).locator('.pille')).toHaveAttribute('data-zustand', 'erledigt');
    await expect(zeilen.filter({ hasText: 'E5 ' }).locator('.g-balken__summe')).toHaveText('100 %');
    await expect(zeilen.filter({ hasText: 'E4 ' }).locator('.pille')).toHaveAttribute('data-zustand', 'teilweise');
    // Kennzahlen, Zeitbezug, Später, Module
    await expect(page.locator('#ub-aktuell .g-kennzahl__wert')).toHaveText('E4');
    await expect(page.locator('#ub-zeit .g-kennzahl__wert')).toContainText(/KW \d+/);
    await expect(page.locator('#ub-verzug')).toHaveText(/im Plan|im Verzug/);
    await expect(page.locator('#ub-spaeter-liste li')).toHaveCount(1);
    await expect(page.locator('#ub-naechste-liste li').first()).toHaveAttribute('data-status', 'offen');
    await expect(page.locator('#ub-modul-aiact')).toHaveText(text('de', 'app.ueberblick.modul_ein'));
    await expect(page.locator('#ub-modul-nist')).toHaveText(text('de', 'app.ueberblick.modul_aus'));
    await expect(page.locator('#fahrplan-gantt')).toBeVisible();
    // Tastatur: vom Titel über Speicherstand und Suche zur Hauptaktion «Weitermachen» im Seitenkopf (U-34), Enter
    await page.keyboard.press('Tab');
    await expect(page.locator('#speichern')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#suche')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#ueberblick-weiter')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#ueberblick-drucken')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/gefuehrt\/E4\/E4-/);
    await expect(page.locator('h1#seitentitel')).toBeFocused();
    expect(fehler).toEqual([]);
  });

  test('aktuelle Etappe im Untermenü markiert, Stand als Form, Seitenpunkte im Kopf', async ({ page }) => {
    const { fehler } = await oeffneMitStand(page, 'leiste.aims.json');
    await geh(page, '#/gefuehrt/E4');
    await expect(page.locator('h1#seitentitel')).toBeVisible();
    const menue = page.locator('#untermenue');
    await expect(menue.locator('a[aria-current="page"]')).toHaveCount(1);
    const e4 = menue.locator('a[data-punkt="E4"]');
    await expect(e4).toHaveAttribute('aria-current', 'page');
    await expect(e4).toContainText(text('de', 'gefuehrt.etappen.E4.titel'));
    // Stand als Form, nicht nur Farbe: E4 läuft (Teilkreis), E5 erledigt (Haken), E6 offen (gestrichelt)
    await expect(e4.locator('.schritt')).toHaveClass(/laeuft/);
    await expect(menue.locator('a[data-punkt="E5"] .schritt')).toHaveClass(/erledigt/);
    await expect(menue.locator('a[data-punkt="E5"]')).toContainText(text('de', 'rahmen.guide.stand.erledigt'));
    await expect(menue.locator('a[data-punkt="E6"] .schritt')).toHaveClass(/offen/);
    // Seite x von y im Kopf, keine Etappenleiste, keine Liste «Seiten dieser Etappe» (U-08)
    await expect(page.locator('#seiten-ort')).toContainText(/Seite 1 von \d+/);
    await expect(page.locator('.etappen-huelle')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: text('de', 'app.gefuehrt.seiten_der_etappe') })).toHaveCount(0);
    // Punktreihe der Seiten: aktuelle Seite markiert, Status als Form
    const punkte = page.locator('#seitenpunkte li');
    await expect(punkte).toHaveCount(Number((await page.locator('#seiten-ort').textContent())!.match(/von (\d+)/)![1]));
    await expect(punkte.nth(0).locator('a')).toHaveAttribute('aria-current', 'page');
    await expect(punkte.nth(1)).toHaveAttribute('data-zustand', 'spaeter');
    await punkte.nth(2).locator('a').click();
    await expect(page.locator('#seiten-ort')).toContainText(/Seite 3 von/);
    await expect(page.locator('#seitenpunkte li').nth(2).locator('a')).toHaveAttribute('aria-current', 'page');
    expect(fehler).toEqual([]);
  });

  test('Hilfe breit (360 bis 440 px), Griff per Tastatur verstellbar und gemerkt; Tablet: Hilfe unter dem Inhalt', async ({ page }) => {
    const { fehler } = await oeffneMitStand(page, 'hilfe.aims.json');
    await geh(page, '#/gefuehrt/E4/E4-systeme');
    const hilfe = page.locator('aside.hilfe');
    const breite = async () => Math.round((await hilfe.boundingBox())!.width);
    const start = await breite();
    expect(start).toBeGreaterThanOrEqual(360);
    expect(start).toBeLessThanOrEqual(440);
    await page.locator('#hilfe-griff').focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect.poll(breite).toBe(start + 32);
    await expect(page.locator('#hilfe-griff')).toHaveAttribute('aria-valuenow', String(start + 32));
    await page.reload();
    await page.waitForSelector('body[data-bedienbar]');
    // Nach dem Neuladen ist kein Projekt offen; die Breite gilt trotzdem für die nächste Sitzung
    expect(await page.evaluate(() => localStorage.getItem('aims-manager:einstellung:hilfe-breite'))).toBe(String(start + 32));
    await oeffne(page, fixtureDatei('hilfe2.aims.json', false, stand));
    await geh(page, '#/gefuehrt/E4/E4-systeme');
    await expect.poll(breite).toBe(start + 32);
    // Enter stellt die Standardbreite wieder her
    await page.locator('#hilfe-griff').focus();
    await page.keyboard.press('Enter');
    await expect.poll(breite).toBe(start);
    // Tablet: eine Spalte, Hilfe unter dem Inhalt, kein Griff
    await page.setViewportSize({ width: 900, height: 1100 });
    await expect(page.locator('#hilfe-griff')).toBeHidden();
    const seite = (await page.locator('.gefuehrt > .seite').boundingBox())!;
    const h = (await hilfe.boundingBox())!;
    expect(h.y).toBeGreaterThanOrEqual(seite.y + seite.height - 1);
    expect(fehler).toEqual([]);
  });
});

/**
 * Kopf des Guides ohne Überlauf (Seitenpunkte, Ort, Fortschritt) und Einträge des Untermenüs ohne Umbruch mitten im Wort
 * (U-04): ein Zeilenwechsel innerhalb eines Eintrags nur nach Leerzeichen, Bindestrich oder weicher Trennstelle.
 */
async function kopfUndMenueBefunde(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const befunde: string[] = [];
    const kopf = document.querySelector<HTMLElement>('.gefuehrt-kopf');
    if (kopf) for (const el of [kopf, ...kopf.querySelectorAll<HTMLElement>('*')]) if (!el.closest('.nur-sr') && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') befunde.push(`Kopf läuft über: ${el.className || el.tagName}`);
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) befunde.push('Seite rollt waagrecht');
    for (const el of document.querySelectorAll<HTMLElement>('#untermenue .upunkt-text')) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      let vorTop: number | null = null;
      let vor = '';
      while ((n = walker.nextNode())) {
        if (n.parentElement?.closest('.nur-sr')) continue;
        const t = n.textContent ?? '';
        for (let i = 0; i < t.length; i++) {
          const r = document.createRange();
          r.setStart(n, i);
          r.setEnd(n, i + 1);
          const rect = [...r.getClientRects()].filter((x) => x.width > 0).at(-1);
          if (!rect) { vor = t[i]!; continue; }
          if (vorTop !== null && rect.top > vorTop + 3 && !/[\s\-\u00ad/]/.test(vor) && !/\s/.test(t[i]!)) befunde.push(`«${el.textContent?.replace(/\u00ad/g, '')}» bricht mitten im Wort`);
          vorTop = rect.top;
          vor = t[i]!;
        }
      }
    }
    return befunde;
  });
}

for (const sprache of ['de', 'en'] as const) {
  test.describe(`Kopf und Untermenü ohne Überlauf (${sprache})`, () => {
    test.use({ locale: sprache === 'de' ? 'de-CH' : 'en-GB' });
    for (const [breite, hoehe] of [[1280, 900], [1440, 900], [2000, 1100], [820, 1180]] as const) {
      test(`${breite} px`, async ({ page }) => {
        await page.setViewportSize({ width: breite, height: hoehe });
        const { fehler } = await oeffneMitStand(page, `ueberlappung-${sprache}-${breite}.aims.json`);
        for (const ort of ['#/gefuehrt/E4/E4-systeme', '#/gefuehrt/E8', '#/gefuehrt/E13', '#/gefuehrt']) {
          await geh(page, ort);
          await expect(page.locator('main h1').first()).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(100);
          expect(await kopfUndMenueBefunde(page), `${ort} bei ${breite} px`).toEqual([]);
        }
        expect(fehler).toEqual([]);
      });
    }
  });
}

for (const modus of ['hell', 'dunkel'] as const) {
  test(`axe ${modus}: Überblick, Seite mit Seitenpunkten, Abschluss`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'axe einmal genügt');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ colorScheme: modus === 'hell' ? 'light' : 'dark' });
    await themaVorab(page, modus);
    const { fehler } = await oeffneMitStand(page, `axe-${modus}.aims.json`);
    const befunde: string[] = [];
    for (const h of ['#/gefuehrt', '#/gefuehrt/E4/E4-systeme', '#/gefuehrt/E5/abschluss']) {
      await geh(page, h);
      await expect(page.locator('main h1').first()).toBeVisible();
      await page.waitForTimeout(150);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      // WCAG 2.2 Zielgrösse (24 px): Untermenü, Seitenpunkte, Griff, Überblick, Glossarbegriffe (U-19)
      const ziel = await new AxeBuilder({ page }).withRules(['target-size']).include('#untermenue').include('.gefuehrt-kopf').include('#ueberblick').include('.gefuehrt').analyze();
      befunde.push(...[...r.violations, ...ziel.violations].map((v) => `${h}: ${v.id} ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`));
    }
    expect(befunde).toEqual([]);
    expect(fehler).toEqual([]);
  });
}
