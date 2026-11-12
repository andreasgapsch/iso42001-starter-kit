// Visuelle Regression des AIMS-Managers (Rahmen ab rc.10): Start, Guide (Überblick und Seite), Prüfung, Übersicht in hell und dunkel, DE und EN,
// Desktop und Tablet. Nur Chromium (Schriftglättung der Engines weicht ab). Referenzbilder: tests/e2e/app/__screenshots__/.
// Neu erzeugen: npx playwright test tests/e2e/app/visuell.e2e.ts --project chromium --update-snapshots
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test } from './app-hilfen.ts';
import { kiSystem } from '../../fixtures/projekt.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte, themaVorab } from './app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');

const GERAETE = { desktop: { width: 1400, height: 950 }, tablet: { width: 820, height: 1180 } } as const;
const FESTE_ZEIT = new Date('2026-10-21T09:00:00Z');

for (const sprache of ['de', 'en'] as const) {
  for (const thema of ['hell', 'dunkel'] as const) {
    for (const geraet of ['desktop', 'tablet'] as const) {
      test.describe(`${sprache} ${thema} ${geraet}`, () => {
        test.use({
          locale: sprache === 'de' ? 'de-CH' : 'en-GB',
          colorScheme: thema === 'hell' ? 'light' : 'dark',
          viewport: GERAETE[geraet],
          hasTouch: geraet === 'tablet',
        });
        test(`Ansichten ${sprache}-${thema}-${geraet}`, async ({ page, browserName }) => {
          test.skip(browserName !== 'chromium', 'Referenzbilder nur für Chromium');
          await page.clock.setFixedTime(FESTE_ZEIT);
          await themaVorab(page, thema);
          const { fehler } = await starte(page);
          const name = (ansicht: string) => `${ansicht}-${sprache}-${thema}-${geraet}.png`;
          await expect(page).toHaveScreenshot(name('start'));
          await oeffne(page, fixtureDatei('visuell.aims.json', false, (p) => {
            p.organisation.name = 'Beispiel Werkzeugbau AG';
            delete p.kiSysteme[0]!.eigner;
            delete p.organisation.leitlinie.freigabe;
            p.kiSysteme.push(kiSystem({ id: 'KI-002', name: 'Bildgenerator Marketing', typ: 'schatten', status: 'in-pruefung', naechsteUeberpruefung: '2026-11-10' }));
          }));
          // Meldung «Projekt geöffnet» verschwindet nach 6 s; Bilder ohne Meldung
          await expect(page.locator('#meldung')).toHaveText('', { timeout: 10_000 });
          await expect(page).toHaveScreenshot(name('uebersicht'));
          await page.evaluate(() => (location.hash = '#/gefuehrt'));
          await expect(page.locator('#ueberblick h1')).toBeVisible();
          await expect(page).toHaveScreenshot(name('gefuehrt-ueberblick'), { fullPage: true });
          await page.evaluate(() => (location.hash = '#/gefuehrt/E4/E4-systeme'));
          await expect(page.locator('h1')).toBeVisible();
          await expect(page).toHaveScreenshot(name('gefuehrt'));
          await page.evaluate(() => (location.hash = '#/pruefung'));
          await expect(page.locator('[data-bereitschaft]')).toBeVisible();
          await expect(page).toHaveScreenshot(name('pruefung'));
          expect(fehler).toEqual([]);
        });
      });
    }
  }
}

// V-14 (Designsystem AIMS Nachtblau): Druck im Modus Papier. Auch aus dunkler Darstellung druckt die App mit den Papier-Werten
// aus tokens.json, ohne Leisten, Knöpfe, Meldungen und Schatten; Referenzbild «Druck Risikoregister» (A4 hoch, 794 × 1123 px).
test.describe('V-14 Druck', () => {
  test.use({ locale: 'de-CH', colorScheme: 'dark', viewport: { width: 794, height: 1123 } });
  test('V-14: Druck nutzt nur Papier-Werte, ohne Leisten, Knöpfe, Meldungen und Schatten; Referenzbild Risikoregister', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Referenzbilder nur für Chromium');
    await page.clock.setFixedTime(FESTE_ZEIT);
    await themaVorab(page, 'dunkel');
    const { fehler } = await starte(page);
    await oeffne(page, join(REPO, 'src/beispiele/muster-maschinenbau.de.aims.json'));
    await expect(page.locator('#meldung')).toHaveText('', { timeout: 10_000 });
    await page.evaluate(() => (location.hash = '#/formular/risiken'));
    await expect(page.locator('main h1').first()).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    const papier = (JSON.parse(readFileSync(join(REPO, 'docs/design-system/nachtblau/tokens.json'), 'utf8')) as { farben: { papier: Record<string, unknown> & { status: Record<string, string> } } }).farben.papier;
    const erwartet: Record<string, string> = {};
    for (const [k, w] of Object.entries(papier)) if (typeof w === 'string') erwartet[`--${k.replace(/_/g, '-')}`] = w;
    for (const [k, w] of Object.entries(papier.status)) erwartet[`--status-${k.replace(/_/g, '-')}`] = w;
    // Vergleich als berechnete Farbe (der Bau kürzt Schreibweisen wie #ffffff zu #fff)
    const abweichend = await page.evaluate((e) => {
      const farbe = (w: string) => {
        const p = document.createElement('span');
        p.style.color = w;
        document.body.append(p);
        const c = getComputedStyle(p).color;
        p.remove();
        return c;
      };
      return Object.entries(e).flatMap(([n, w]) => {
        const ist = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
        return farbe(ist) === farbe(w) ? [] : [`${n}: ${ist} statt ${w}`];
      });
    }, erwartet);
    expect(abweichend).toEqual([]);
    expect(await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body).color])).toEqual(['rgb(255, 255, 255)', 'rgb(18, 24, 33)']);
    for (const sel of ['.symbolleiste', '.untermenue', '#meldung', '.seitenkopf .suche']) await expect(page.locator(sel).first(), sel).toBeHidden();
    expect(await page.locator('main button:not(.glossar):not(.auswahl):visible, main .knopf:visible').count()).toBe(0);
    expect(await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).boxShadow !== 'none').map((e) => e.tagName + (e.id ? `#${e.id}` : '') + (e.className && typeof e.className === 'string' ? `.${e.className.split(' ')[0]}` : '')).slice(0, 10))).toEqual([]);
    // Ausdruck vollständig: alle Risiken der Liste, nicht nur die sichtbaren Zeilen der virtualisierten Liste
    const risiken = (JSON.parse(readFileSync(join(REPO, 'src/beispiele/muster-maschinenbau.de.aims.json'), 'utf8')) as { risiken: unknown[] }).risiken.length;
    await expect(page.locator('main .vliste .zeile')).toHaveCount(risiken);
    await expect(page).toHaveScreenshot('druck-risikoregister.png', { fullPage: true });
    expect(fehler).toEqual([]);
  });
});

// Neue Referenzbilder (VORSCHLAEGE.md): Rückfrage im eigenen Dialog (V-11) und Guide E8 «Behandlung je Risiko» (M3, 1280 × 720)
test.describe('V-11 und M3 Referenzbilder', () => {
  test.use({ locale: 'de-CH', colorScheme: 'light', viewport: { width: 1280, height: 720 } });
  test('V-11 Dialog und M3 Guide E8 bei 1280 × 720', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Referenzbilder nur für Chromium');
    await page.clock.setFixedTime(FESTE_ZEIT);
    await themaVorab(page, 'hell');
    const { fehler } = await starte(page);
    await oeffne(page, join(REPO, 'src/beispiele/muster-maschinenbau.de.aims.json'));
    await expect(page.locator('#meldung')).toHaveText('', { timeout: 10_000 });
    await page.evaluate(() => (location.hash = '#/gefuehrt/E8/E8-behandlung?eintrag=R-003'));
    await expect(page.locator('#eintrag-R-003')).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(page).toHaveScreenshot('guide-e8-behandlung-1280.png');
    await page.evaluate(() => (location.hash = '#/einstellungen/speicher'));
    await page.locator('main').getByRole('button', { name: 'Zwischenspeicher leeren' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page).toHaveScreenshot('dialog-bestaetigen.png');
    await page.keyboard.press('Escape');
    expect(fehler).toEqual([]);
  });
});
