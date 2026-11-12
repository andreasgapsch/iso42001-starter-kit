// Leistungsbudgets des AIMS-Managers (Chromium, file://): Start bei 4-facher CPU-Drosselung, grosses Projekt
// (200 KI-Systeme, 1000 Risiken, 500 Massnahmen) mit Öffnen, Ansichtswechsel, Eingabe, Speichern; Dokumentenset.
// Messwerte: test-results/leistung.json (Median aus mehreren Läufen, wo sinnvoll).
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test } from './app-hilfen.ts';
import { neuerEintrag } from '../../../src/app/logik/eintraege.ts';
import type { KiSystem, Massnahme, Risiko } from '../../../src/model/typen.ts';
import { kiSystem, vollstaendigesProjekt } from '../../fixtures/projekt.ts';
import { REPO, dateiUrl } from '../spikes/hilfen.ts';
import { HTML, ORDNER, oeffne, starte } from './app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true });

const messwerte: Record<string, number> = {};
const median = (x: number[]) => [...x].sort((a, b) => a - b)[Math.floor(x.length / 2)]!;

function grossesProjekt(): string {
  const p = vollstaendigesProjekt();
  p.organisation.name = 'Grossprojekt AG';
  p.kiSysteme = Array.from({ length: 200 }, (_, i) => kiSystem({ id: `KI-${String(i + 1).padStart(3, '0')}`, name: `System ${i + 1}` })) as KiSystem[];
  p.risiken = Array.from({ length: 1000 }, (_, i) => ({
    ...(neuerEintrag(p, 'risiken') as unknown as Risiko),
    id: `R-${String(i + 1).padStart(4, '0')}`,
    titel: `Risiko ${i + 1}`,
    kiSystem: `KI-${String((i % 200) + 1).padStart(3, '0')}`,
    quelle: 'daten',
    w: (i % 4) + 1,
    a: (i % 3) + 1,
  }));
  p.massnahmen = Array.from({ length: 500 }, (_, i) => ({ ...(neuerEintrag(p, 'massnahmen') as unknown as Massnahme), id: `M-${String(i + 1).padStart(3, '0')}`, titel: `Massnahme ${i + 1}`, verantwortlich: 'P-001', termin: '2027-03-31' }));
  mkdirSync(ORDNER, { recursive: true });
  const datei = join(ORDNER, `gross-${test.info().project.name}.aims.json`);
  writeFileSync(datei, JSON.stringify(p));
  return datei;
}

/** Zeit bis zum nächsten gezeichneten Bild nach einer Aktion im Browser. */
async function bisGezeichnet(page: Page, aktion: string): Promise<number> {
  return page.evaluate(async (a) => {
    const t0 = performance.now();
    if (a.startsWith('#/')) location.hash = a;
    await new Promise<void>((ok) => requestAnimationFrame(() => setTimeout(ok, 0)));
    return performance.now() - t0;
  }, aktion);
}

test.describe.configure({ mode: 'serial' });

/** Lokal gelten die Budgets aus AUFTRAG 13.1 unverändert, in CI mit Faktor 3 */
const CI_FAKTOR = process.env['CI'] ? 3 : 1;

/** Q8 Grösse: höchstens 10 MB (dezimal); dieselbe Grenze wie das Bauskript scripts/app-bauen.mts */
const GROESSE_MAX = 10_000_000;

test('Grösse des AIMS-Managers höchstens 10 MB (Q8)', () => {
  const bytes = statSync(join(REPO, HTML)).size;
  messwerte['bytes'] = bytes;
  expect(bytes).toBeLessThanOrEqual(GROESSE_MAX);
});

test('Start bei 4-facher CPU-Drosselung', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CPU-Drosselung nur über CDP');
  const cdp = await page.context().newCDPSession(page);
  const werte: number[] = [];
  const gedrosselt: number[] = [];
  for (let i = 0; i < 5; i++) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.goto(dateiUrl(HTML));
    await page.waitForSelector('body[data-bedienbar]');
    werte.push(await page.evaluate(() => performance.getEntriesByName('bedienbar')[0]!.startTime));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(dateiUrl(HTML));
    await page.waitForSelector('body[data-bedienbar]');
    gedrosselt.push(await page.evaluate(() => performance.getEntriesByName('bedienbar')[0]!.startTime));
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  messwerte['start_ms'] = Math.round(median(werte));
  messwerte['start_4x_ms'] = Math.round(median(gedrosselt));
  // Budget gilt auf dem Referenzrechner; geteilte CI-Runner sind deutlich langsamer (Faktor 3)
  expect(messwerte['start_4x_ms']).toBeLessThan(1500 * CI_FAKTOR);
});

test('Grosses Projekt 200/1000/500: Öffnen, Wechsel, Eingabe, Speichern', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Messung in Chromium');
  const { fehler } = await starte(page);
  const datei = grossesProjekt();
  const t0 = Date.now();
  await oeffne(page, datei);
  messwerte['gross_oeffnen_ms'] = Date.now() - t0;
  const wechsel: number[] = [];
  for (const h of ['#/formular/risiken', '#/formular/inventar', '#/formular/massnahmen', '#/formular/soa', '#/formular/uebersicht', '#/formular/aiact/pflichten', '#/formular/organisation']) {
    wechsel.push(await bisGezeichnet(page, h));
  }
  messwerte['gross_wechsel_median_ms'] = Math.round(median(wechsel));
  messwerte['gross_wechsel_max_ms'] = Math.round(Math.max(...wechsel));
  await page.evaluate(() => (location.hash = '#/formular/risiken/R-0500'));
  const feld = page.locator('#editor-risiken input[type=text]').first();
  await expect(feld).toBeVisible();
  const eingabe: number[] = [];
  for (let i = 0; i < 8; i++) {
    eingabe.push(
      await feld.evaluate(async (el: HTMLInputElement, n) => {
        const t0 = performance.now();
        el.value = `Risiko geändert ${n}`;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise<void>((ok) => requestAnimationFrame(() => setTimeout(ok, 0)));
        return performance.now() - t0;
      }, i),
    );
  }
  messwerte['gross_eingabe_median_ms'] = Math.round(median(eingabe));
  messwerte['gross_eingabe_max_ms'] = Math.round(Math.max(...eingabe));
  const t1 = Date.now();
  await Promise.all([page.waitForEvent('download'), page.click('#speichern')]);
  messwerte['gross_speichern_ms'] = Date.now() - t1;
  expect(messwerte['gross_eingabe_median_ms']).toBeLessThan(100 * CI_FAKTOR);
  expect(messwerte['gross_wechsel_median_ms']).toBeLessThan(200 * CI_FAKTOR);
  expect(messwerte['gross_speichern_ms']).toBeLessThan(500 * CI_FAKTOR);
  expect(fehler).toEqual([]);
});

test('Dokumentenset des Beispielprojekts mit ISMS und Modul', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Messung in Chromium');
  test.skip(!existsSync(join(REPO, 'src/beispiele/muster-maschinenbau.de.aims.json')), 'Beispielprojekt fehlt');
  await starte(page);
  await oeffne(page, join(REPO, 'src/beispiele/muster-maschinenbau.de.aims.json'));
  await page.evaluate(() => (location.hash = '#/dokumente'));
  const t0 = Date.now();
  await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.click('#set-erzeugen')]);
  messwerte['set_beispiel_ms'] = Date.now() - t0;
  expect(messwerte['set_beispiel_ms']).toBeLessThan(15_000 * CI_FAKTOR);
});

test.afterAll(() => {
  if (Object.keys(messwerte).length === 0) return;
  mkdirSync(join(REPO, 'test-results'), { recursive: true });
  writeFileSync(join(REPO, 'test-results', 'leistung.json'), `${JSON.stringify(messwerte, null, 2)}\n`);
  console.log(JSON.stringify(messwerte));
});
