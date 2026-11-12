// Spike S5: Blob-Worker unter strenger Meta-CSP über file://, Netzwerk muss still bleiben.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { pruefeCsp } from '../../../scripts/csp.mts';
import { REPO, befund, dateiUrl, netzProtokoll } from './hilfen.ts';

interface S5 {
  verletzungen: string[];
  worker: { summe: number; evalBlockiert?: boolean; fetchBlockiert?: boolean; ort?: string } | null;
  fehler: string | null;
  cssom?: string;
  attr?: string;
  evalBlockiertSeite?: boolean;
  trustedTypes?: boolean | string;
}

/** Summe der Primzahlen bis 20000 (Kontrollwert für den Worker). */
const PRIMSUMME = 21171191;

async function zustand(page: Page): Promise<S5 | null> {
  return page.evaluate(() => (window as unknown as { s5?: S5 }).s5 ?? null);
}

async function warteAufWorker(page: Page): Promise<S5 | null> {
  await page
    .waitForFunction(() => {
      const s = (window as unknown as { s5?: S5 }).s5;
      return s && (s.worker !== null || s.fehler !== null);
    }, undefined, { timeout: 5000 })
    .catch(() => undefined);
  // Verletzungsereignisse kommen asynchron.
  await page.waitForTimeout(200);
  return zustand(page);
}

for (const variante of ['trusted-types', 'streng'] as const) {
  test(`S5 Worker aus Blob-URL unter CSP «${variante}»`, async ({ page, context, browserName }) => {
    const netz = netzProtokoll(context);
    const konsole: string[] = [];
    page.on('console', (m) => konsole.push(`${m.type()}: ${m.text()}`.slice(0, 200)));
    await page.goto(dateiUrl(`spikes/s5/dist/${variante}.html`));
    const s = await warteAufWorker(page);
    const ergebnis = {
      laeuft: s?.worker?.summe === PRIMSUMME,
      worker: s?.worker ?? null,
      fehler: s?.fehler ?? null,
      verletzungen: s?.verletzungen ?? [],
      cssomErlaubt: s?.cssom === 'rgb(0, 128, 0)',
      styleAttributBlockiert: s?.attr !== 'rgb(255, 0, 0)',
      evalSeiteBlockiert: s?.evalBlockiertSeite ?? null,
      trustedTypes: s?.trustedTypes ?? false,
      fremdeAnfragen: netz.fremd(),
      anfragen: netz.alle.length,
      konsole: konsole.filter((k) => !k.startsWith('log')).slice(0, 5),
    };
    befund('s5', browserName, variante, ergebnis);
    expect(ergebnis.laeuft).toBe(true);
    expect(ergebnis.fremdeAnfragen).toEqual([]);
    // Die CSP gilt auch im Worker: eval und fetch sind dort blockiert.
    expect(s?.worker).toMatchObject({ evalBlockiert: true, fetchBlockiert: true });
    expect(ergebnis.cssomErlaubt).toBe(true);
    expect(ergebnis.styleAttributBlockiert).toBe(true);
  });
}

test('S5 Gegenprobe ohne worker-src: Worker wird blockiert', async ({ page, browserName }) => {
  await page.goto(dateiUrl('spikes/s5/dist/ohne-worker-src.html'));
  const s = await warteAufWorker(page);
  const ergebnis = { laeuft: s?.worker?.summe === PRIMSUMME, fehler: s?.fehler ?? null, verletzungen: s?.verletzungen ?? [] };
  befund('s5', browserName, 'ohne-worker-src', ergebnis);
  expect(ergebnis.laeuft).toBe(false);
});

test('S5 Gegenprobe falscher Hash: Inline-Skript läuft nicht', async ({ page, browserName }) => {
  await page.goto(dateiUrl('spikes/s5/dist/falscher-hash.html'));
  await page.waitForTimeout(500);
  const s = await zustand(page);
  befund('s5', browserName, 'falscher-hash', { skriptLief: s !== null });
  expect(s).toBeNull();
});

test('S5b Vite-Bundle mit Inline-Worker und nachträglichen Hashes', async ({ page, context, browserName }) => {
  const datei = join(REPO, 'spikes/s5/dist/vite/mit-csp.html');
  expect(pruefeCsp(readFileSync(datei, 'utf8'))).toEqual([]);
  const netz = netzProtokoll(context);
  await page.goto(dateiUrl('spikes/s5/dist/vite/mit-csp.html'));
  const s = await warteAufWorker(page);
  const farbe = await page.locator('#ergebnis').evaluate((e) => getComputedStyle(e).color);
  const ergebnis = {
    laeuft: s?.worker?.summe === 500500,
    stilAngewendet: farbe === 'rgb(0, 96, 48)',
    fehler: s?.fehler ?? null,
    verletzungen: s?.verletzungen ?? [],
    fremdeAnfragen: netz.fremd(),
  };
  befund('s5', browserName, 'vite', ergebnis);
  expect(ergebnis).toMatchObject({ laeuft: true, stilAngewendet: true, verletzungen: [], fremdeAnfragen: [] });
});
