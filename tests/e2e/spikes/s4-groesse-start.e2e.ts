// Spike S4: Dateigrösse und Zeit bis bedienbar des Prototyps (Preact-Shell, Worker mit docx und exceljs, 1,5 MB Kataloge).
// Messung je Variante: 5 Läufe, Median. Chromium zusätzlich mit 4-facher CPU-Drosselung über CDP.
// Für verlässliche Zahlen allein laufen lassen: npx playwright test tests/e2e/spikes/s4-groesse-start.e2e.ts --workers=1
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { VARIANTEN } from '../../../spikes/s4/varianten.mts';
import { REPO, befund, dateiUrl, netzProtokoll } from './hilfen.ts';

const LAEUFE = 5;
const BUDGET_BYTES = 4 * 1024 * 1024;
// Budget aus AUFTRAG 13.1 auf dem Referenzrechner; geteilte CI-Runner sind deutlich langsamer (Faktor 3)
const BUDGET_MS = 1500 * (process.env['CI'] ? 3 : 1);

interface Lauf {
  bedienbarMs: number;
  katalogeMs: number;
  skriptStartMs: number;
  domInteractiveMs: number;
  extern: number;
}

const median = (w: number[]): number => {
  const s = [...w].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

/** Feste Rechenlast; das Verhältnis gedrosselt/ungedrosselt belegt, dass die Drosselung greift. */
async function rechenprobe(page: Page): Promise<number> {
  return page.evaluate(() => {
    const t = performance.now();
    let x = 0;
    for (let i = 0; i < 3e6; i++) x = (x + i * 7) % 1000003;
    return performance.now() - t + x * 0;
  });
}

async function einLauf(browser: Browser, url: string, drossel: number, mitGenerator: boolean) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const netz = netzProtokoll(ctx);
  const page = await ctx.newPage();
  const fehler: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') fehler.push(m.text().slice(0, 160));
  });
  page.on('pageerror', (e) => fehler.push(e.message.slice(0, 160)));
  if (drossel > 1) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: drossel });
  }
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  await page.locator('#weiter').click();
  await expect(page.locator('h1')).toContainText('Etappe 2');
  const extern = Date.now() - t0;
  await page.waitForFunction(() => document.body.dataset['bedienbar'] === '1');
  // Auswahlliste muss trotz CSP bedienbar sein (WebKit meldet beim Erzeugen von <select> eine style-src-attr-Verletzung).
  await page.locator('select').selectOption('Treuhand');
  const auswahlOk = (await page.locator('select').inputValue()) === 'Treuhand';
  const m = await page.evaluate(() => {
    const zeit = (n: string) => performance.getEntriesByName(n)[0]?.startTime ?? -1;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return {
      bedienbarMs: zeit('bedienbar'),
      katalogeMs: zeit('kataloge-geladen'),
      skriptStartMs: zeit('skript-start'),
      domInteractiveMs: nav?.domInteractive ?? -1,
    };
  });
  const probe = await rechenprobe(page);
  let generator: unknown = null;
  if (mitGenerator) {
    await page.locator('#erzeugen').click();
    await expect(page.locator('#status')).toContainText(/fertig|Fehler/, { timeout: 60_000 });
    generator = await page.evaluate(() => (window as unknown as { s4Generator?: unknown }).s4Generator ?? null);
  }
  await ctx.close();
  // Bekannte Meldung von WebKit (Linux) bei <select> unter style-src ohne 'unsafe-inline': trennen, nicht ignorieren.
  const webkitSelect = fehler.filter((f) => f.startsWith('Refused to apply a stylesheet because its hash'));
  const uebrige = fehler.filter((f) => !webkitSelect.includes(f));
  return { lauf: { ...m, extern } satisfies Lauf, probe, fremd: netz.fremd(), fehler: uebrige, webkitSelect: webkitSelect.length, auswahlOk, generator };
}

for (const variante of VARIANTEN) {
  test(`S4 Grösse und Start «${variante}»`, async ({ browser, browserName }) => {
    test.setTimeout(300_000);
    const datei = join(REPO, `spikes/s4/dist/s4-${variante}.html`);
    const bytes = statSync(datei).size;
    const url = dateiUrl(`spikes/s4/dist/s4-${variante}.html`);
    const stufen = browserName === 'chromium' ? [1, 4] : [1];
    const ergebnis: Record<string, unknown> = { bytes, mb: +(bytes / 1024 / 1024).toFixed(2) };
    for (const drossel of stufen) {
      const laeufe: Lauf[] = [];
      const proben: number[] = [];
      let generator: unknown = null;
      // Ein Aufwärmlauf (Dateicache, JIT-Caches des Browsers), danach die Messläufe.
      const kalt = await einLauf(browser, url, drossel, false);
      for (let i = 0; i < LAEUFE; i++) {
        const r = await einLauf(browser, url, drossel, i === 0);
        expect(r.fremd, 'keine Netzwerkanfragen').toEqual([]);
        expect(r.fehler, 'keine Konsolenfehler (auch keine CSP-Verletzungen)').toEqual([]);
        expect(r.auswahlOk, 'Auswahlliste bedienbar').toBe(true);
        if (browserName !== 'webkit') expect(r.webkitSelect).toBe(0);
        ergebnis['webkitSelectMeldungen'] = r.webkitSelect;
        laeufe.push(r.lauf);
        proben.push(r.probe);
        if (r.generator) generator = r.generator;
      }
      ergebnis[`drossel${drossel}x`] = {
        ersterLaufMs: Math.round(kalt.lauf.bedienbarMs),
        bedienbarMedianMs: Math.round(median(laeufe.map((l) => l.bedienbarMs))),
        bedienbarMaxMs: Math.round(Math.max(...laeufe.map((l) => l.bedienbarMs))),
        externMedianMs: median(laeufe.map((l) => l.extern)),
        domInteractiveMedianMs: Math.round(median(laeufe.map((l) => l.domInteractiveMs))),
        katalogeMedianMs: Math.round(median(laeufe.map((l) => l.katalogeMs - l.skriptStartMs))),
        rechenprobeMs: Math.round(median(proben)),
        generator,
      };
    }
    befund('s4', browserName, variante, ergebnis);
    expect(bytes).toBeLessThanOrEqual(BUDGET_BYTES);
    const gen = (ergebnis['drossel1x'] as { generator: { ok: boolean; docx: number; xlsx: number } }).generator;
    expect(gen, 'Generator im Worker unter CSP').toMatchObject({ ok: true });
    expect(gen.docx).toBeGreaterThan(1000);
    expect(gen.xlsx).toBeGreaterThan(1000);
    // Zeitbudget gilt für Chromium mit 4-facher Drosselung.
    if (browserName === 'chromium' && process.env['S4_BUDGET'] !== '0') {
      const d4 = ergebnis['drossel4x'] as { bedienbarMedianMs: number };
      expect.soft(d4.bedienbarMedianMs, `Budget ${BUDGET_MS} ms bei 4x`).toBeLessThanOrEqual(BUDGET_MS);
    }
  });
}

test('S4 Grössen aus dem Build', () => {
  const g = JSON.parse(readFileSync(join(REPO, 'spikes/s4/dist/groessen.json'), 'utf8')) as { bytes: number }[];
  for (const v of g) expect(v.bytes).toBeLessThanOrEqual(BUDGET_BYTES);
});
