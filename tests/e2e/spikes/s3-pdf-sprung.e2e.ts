// Spike S3: Öffnet ein relativer Link «datei.pdf#page=4» über file:// das PDF auf Seite 4?
// Prüfung doppelt: Seitenzahl im Viewer (Chromium-Viewer bzw. pdf.js) und Farbe der angezeigten Seite.
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { FARBEN } from '../../../spikes/s3/pdf-erzeugen.mts';
import { befund, dateiUrl } from './hilfen.ts';

interface Messung {
  url: string;
  download: string | null;
  farbSeite: number | null;
  viewerSeite: number | null;
  viewer: string;
}

/** Bildmitte als RGB, dekodiert im Browser selbst (keine PNG-Bibliothek nötig). */
async function farbeMitte(ctx: BrowserContext, png: Buffer): Promise<[number, number, number]> {
  const hilfe = await ctx.newPage();
  try {
    return await hilfe.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bild = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const c = new OffscreenCanvas(bild.width, bild.height);
      const g = c.getContext('2d')!;
      g.drawImage(bild, 0, 0);
      const d = g.getImageData(bild.width >> 1, bild.height >> 1, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!] as [number, number, number];
    }, png.toString('base64'));
  } finally {
    await hilfe.close();
  }
}

function seiteZuFarbe(rgb: [number, number, number]): number | null {
  const ziel = FARBEN.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const i = ziel.findIndex((z) => z.every((w, k) => Math.abs(w - rgb[k]!) < 24));
  return i === -1 ? null : i + 1;
}

async function viewerSeite(page: Page): Promise<{ seite: number | null; viewer: string }> {
  const ext = page.frames().find((f) => f.url().startsWith('chrome-extension://'));
  if (ext) {
    const n = await ext
      .evaluate(() => {
        const ps = document
          .querySelector('pdf-viewer')
          ?.shadowRoot?.querySelector('viewer-toolbar')
          ?.shadowRoot?.querySelector('viewer-page-selector') as unknown as { pageNo?: number } | null;
        return ps?.pageNo ?? null;
      })
      .catch(() => null);
    return { seite: n, viewer: 'Chromium-PDF-Viewer' };
  }
  const n = await page
    .evaluate(() => {
      const e = document.getElementById('pageNumber') as HTMLInputElement | null;
      return e ? Number(e.value) : null;
    })
    .catch(() => null);
  return { seite: n, viewer: n === null ? 'keiner' : 'pdf.js' };
}

async function messe(browser: Browser, linkId: string): Promise<Messung> {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1000, height: 700 } });
  try {
    const page = await ctx.newPage();
    let download: string | null = null;
    ctx.on('page', (p) => p.on('download', (d) => void (download = d.suggestedFilename())));
    page.on('download', (d) => void (download = d.suggestedFilename()));
    await page.goto(dateiUrl('spikes/s3/dist/links.html'));
    const neu = linkId.endsWith('-neu') ? ctx.waitForEvent('page') : null;
    await page.click(`#${linkId}`);
    const ziel = neu ? await neu : page;
    const url = (): string => ziel.url().replace(/^.*\/dist\//, '…/');
    // Der Viewer rendert asynchron; auf Seitenzahl warten, sonst nach Frist messen.
    let v = { seite: null as number | null, viewer: 'keiner' };
    let adresse = url();
    for (let i = 0; i < 15 && v.seite === null && !ziel.isClosed(); i++) {
      await new Promise((r) => setTimeout(r, 300));
      if (ziel.isClosed()) break;
      adresse = url();
      v = await viewerSeite(ziel);
    }
    await new Promise((r) => setTimeout(r, 800));
    // Neues Fenster mit Download schliesst sich selbst.
    if (ziel.isClosed()) return { url: adresse, download, farbSeite: null, viewerSeite: null, viewer: 'Fenster geschlossen' };
    const bild = await ziel.screenshot({ timeout: 10_000 }).catch(() => null);
    const farbSeite = bild ? seiteZuFarbe(await farbeMitte(ctx, bild)) : null;
    return { url: url(), download, farbSeite, viewerSeite: v.seite, viewer: bild ? v.viewer : `${v.viewer}, kein Bildschirmfoto` };
  } finally {
    await ctx.close();
  }
}

test('S3 PDF-Sprung mit #page=4 über file://', async ({ playwright, browserName }) => {
  // Der PDF-Viewer springt in den CI-Runnern nicht zuverlässig (Zeitverhalten headless); Nachweis lokal und auf der Prüfliste
  test.skip(!!process.env['CI'], 'PDF-Viewer in CI nicht verlässlich');
  test.setTimeout(240_000);
  const varianten: Record<string, () => Promise<Browser>> =
    browserName === 'chromium'
      ? {
          // «channel: chromium» = neuer Headless-Modus mit vollem Browser und PDF-Viewer.
          'chromium (neuer Headless-Modus)': () => playwright.chromium.launch({ channel: 'chromium' }),
          'chromium-headless-shell (Standard)': () => playwright.chromium.launch(),
        }
      : browserName === 'firefox'
        ? {
            // Playwright schaltet pdf.js ab; Release-Firefox hat es eingeschaltet.
            'firefox (pdf.js ein)': () => playwright.firefox.launch({ firefoxUserPrefs: { 'pdfjs.disabled': false } }),
            'firefox (Playwright-Standard)': () => playwright.firefox.launch(),
          }
        : { 'webkit (Linux)': () => playwright.webkit.launch() };

  const ergebnisse: Record<string, Record<string, Messung>> = {};
  for (const [name, starte] of Object.entries(varianten)) {
    const browser = await starte();
    try {
      ergebnisse[name] = {};
      for (const link of ['seite4', 'seite4-neu', 'seite4-pfad']) ergebnisse[name][link] = await messe(browser, link);
    } finally {
      await browser.close();
    }
  }
  befund('s3', browserName, 'pdfSprung', ergebnisse);

  const haupt = Object.values(ergebnisse)[0]!;
  if (browserName === 'webkit') {
    // Kein PDF-Viewer in WebKit unter Linux: nur dokumentieren (Safari: manuelle Prüfliste).
    expect(haupt).toBeDefined();
    return;
  }
  for (const m of Object.values(haupt)) {
    expect(m.farbSeite, JSON.stringify(m)).toBe(4);
    expect(m.viewerSeite, JSON.stringify(m)).toBe(4);
  }
});
