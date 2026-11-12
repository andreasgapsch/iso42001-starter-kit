// Abnahme 5: Hell und Dunkel. axe (WCAG 2.1 AA, inklusive color-contrast) auf Start, Guide, Formular, Prüfung,
// Dokumenten und Einstellungen im Hell- und im Dunkelmodus, sowohl über die Systemeinstellung als auch über die Auswahl in den Einstellungen;
// ebenso START.html aus dem gebauten Kit (dist/kit/<wurzel>/START.html). Farben nur über CSS-Variablen prüft
// tests/unit/pruefen-farben.test.ts (scripts/pruefen/farben.mts). Voraussetzung: npm run build:app, Kit gebaut. Testtiefe: Chromium.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test } from '../app/app-hilfen.ts';
import { kiSystem } from '../../fixtures/projekt.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte, waehleTheme } from '../app/app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, actionTimeout: 15_000 });

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const KIT = join(REPO, 'dist/kit');
const START = existsSync(KIT) ? readdirSync(KIT).map((d) => join(KIT, d, 'START.html')).find((p) => existsSync(p)) : undefined;

async function axe(page: Page, ort: string): Promise<string[]> {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((v) => `${ort}: ${v.id} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

const ANSICHTEN = [
  '#/formular/uebersicht', '#/gefuehrt/E0/E0-start', '#/gefuehrt/E4/E4-systeme', '#/gefuehrt/E2/E2-themen', '#/gefuehrt/E8/E8-soa', '#/gefuehrt/E6/abschluss',
  '#/gefuehrt/E13/E13-pruefung', '#/gefuehrt/J/J-kalender', '#/formular/inventar/KI-001', '#/formular/soa/A.2.2', '#/formular/organisation/kontext',
  '#/formular/aiact/pflichten', '#/formular/brucke27001', '#/pruefung', '#/dokumente', '#/einstellungen', '#/prozesse', '#/prozesse/PR-07',
];

for (const modus of ['hell', 'dunkel'] as const) {
  for (const weg of ['system', 'auswahl'] as const) {
    test(`axe ${modus} (${weg === 'system' ? 'Systemeinstellung' : 'Auswahl in den Einstellungen'}): Start, Guide, Formular, Prüfung`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'axe einmal genügt');
      test.setTimeout(180_000);
      // Auswahl in den Einstellungen gegen die Systemeinstellung: Dunkel bei hellem System und umgekehrt
      const system = weg === 'system' ? modus : modus === 'hell' ? 'dunkel' : 'hell';
      await page.emulateMedia({ colorScheme: system === 'hell' ? 'light' : 'dark' });
      const { fehler } = await starte(page);
      await waehleTheme(page, weg === 'system' ? 'system' : modus);
      const befunde: string[] = [];
      befunde.push(...(await axe(page, 'start')));
      // Projekt mit Befunden (Ampel, Fehler und Hinweise sichtbar), ISMS und Modul
      await oeffne(page, fixtureDatei(`kontrast-${modus}-${weg}.aims.json`, true, (p) => {
        delete p.organisation.leitlinie.freigabe;
        p.kiSysteme.push(kiSystem({ id: 'KI-002', name: 'Bildgenerator', typ: 'schatten', status: 'in-pruefung', erfasstAm: '2026-01-10' }));
      }));
      // Hintergrund folgt dem Modus (Stichprobe)
      const hg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const hell = (c: string) => (c.match(/\d+/g) ?? []).slice(0, 3).map(Number).reduce((a, b) => a + b, 0) > 3 * 128;
      expect(hell(hg), `Hintergrund ${hg}`).toBe(modus === 'hell');
      for (const h of ANSICHTEN) {
        await page.evaluate((x) => (location.hash = x), h);
        await expect(page.locator('main h1').first()).toBeVisible();
        await page.waitForTimeout(150);
        befunde.push(...(await axe(page, h)));
      }
      // Fehlermeldung bei Pflichtangaben (Warnfarbe) und geöffnete Hilfe
      await page.evaluate(() => (location.hash = '#/gefuehrt/E0/E0-firma'));
      await page.locator('#f-E0-firma-organisation_name').fill('');
      await page.locator('.seite .knoepfe button.weiter').click();
      await expect(page.locator('.seite [role=alert]')).toBeVisible();
      befunde.push(...(await axe(page, 'E0-firma mit Pflichtmeldung')));
      expect(befunde).toEqual([]);
      expect(fehler).toEqual([]);
    });
  }
}

for (const modus of ['hell', 'dunkel'] as const) {
  test(`axe START.html aus dem Kit, ${modus}`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'axe einmal genügt');
    test.skip(!START, 'Kit nicht gebaut (npx tsx scripts/build.mts --ohne-zip)');
    const befunde: string[] = [];
    const konsole: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') konsole.push(m.text()); });
    page.on('pageerror', (e) => konsole.push(e.message));
    // Über die Systemeinstellung (die Startkachel ist ab rc.10 dunkel voreingestellt; «System» folgt dem Betriebssystem)
    await page.emulateMedia({ colorScheme: modus === 'hell' ? 'light' : 'dark' });
    await page.goto(pathToFileURL(START!).href);
    await expect(page.locator('h1')).toBeVisible();
    await page.locator('label[for=theme-system]').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
    // Stile greifen (Hash in der CSP passt): Variablen gesetzt, Hintergrund folgt dem Modus
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text').trim())).not.toBe('');
    befunde.push(...(await axe(page, `START system ${modus}`)));
    // Über den Umschalter auf der Seite, gegen die Systemeinstellung
    await page.emulateMedia({ colorScheme: modus === 'hell' ? 'dark' : 'light' });
    await page.locator(`label[for=theme-${modus}]`).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', modus);
    befunde.push(...(await axe(page, `START Umschalter ${modus}`)));
    // Englisch
    const en = page.locator('label[for=sprache-en], label[for=lang-en], [data-sprache=en]').first();
    if (await en.count()) {
      await en.click();
      befunde.push(...(await axe(page, `START EN ${modus}`)));
    }
    expect(befunde).toEqual([]);
    expect(konsole, 'Konsolenfehler (z. B. CSP)').toEqual([]);
  });
}
