// Diagrammansicht (AIMS-Manager/Diagrammansicht.html): .drawio-Dateien offline über file:// in Chromium, Firefox und WebKit.
// Testdiagramm unkomprimiert und komprimiert (tests/fixtures/diagramme), Öffnen per Dateiauswahl und per Drag-and-drop,
// Seiten, Seitenlink, Zoom, Sprache, Dunkel; fremdes Diagramm mit Verweisen ins Internet und Skriptversuchen.
// Jeder Test verlangt: keine Netzwerkanfrage ausser file:, data:, blob:; keine CSP-Verletzung (Ereignis oder Konsole);
// kein Seitenfehler. Die Seite baut der Test selbst (scripts/diagrammansicht.mts), ein Kit-Build ist nicht nötig.
// Bildschirmfotos: DIAGRAMMANSICHT_BILDER=<ordner> (WebKit: Playwright fügt fürs Foto selbst einen Stil ein und meldet
// dafür einen CSP-Verstoss; darum wird das Protokoll vor dem Foto ausgewertet).
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { pruefeCsp } from '../../../scripts/csp.mts';
import { baueDiagrammansicht } from '../../../scripts/diagrammansicht.mts';
import { pruefeDiagrammansicht } from '../../../scripts/pruefen/links.mts';

const REPO = process.cwd();
const FIX = join(REPO, 'tests', 'fixtures', 'diagramme');
const BILDER = process.env['DIAGRAMMANSICHT_BILDER'];
let seite = '';
let html = '';

test.use({ viewport: { width: 1300, height: 900 }, locale: 'de-CH', colorScheme: 'light' });

test.beforeAll(() => {
  const ordner = mkdtempSync(join(tmpdir(), 'diagrammansicht-'));
  html = baueDiagrammansicht().html;
  seite = join(ordner, 'Diagrammansicht.html');
  writeFileSync(seite, html);
  if (BILDER) mkdirSync(BILDER, { recursive: true });
});

interface Protokoll { fremd: string[]; csp: string[]; fehler: string[] }

/** Netz, CSP-Meldungen (Konsole) und Seitenfehler mitschreiben; CSP-Ereignisse sammelt die Seite selbst. */
async function protokoll(page: Page): Promise<Protokoll> {
  const p: Protokoll = { fremd: [], csp: [], fehler: [] };
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) p.fremd.push(r.url()); });
  page.on('console', (m) => { if (/Content.Security.Policy|Refused to|Trusted Type/i.test(m.text())) p.csp.push(m.text()); });
  page.on('pageerror', (e) => p.fehler.push(e.message));
  page.on('popup', (w) => p.fremd.push(`popup ${w.url()}`));
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.effectiveDirective} ${e.blockedURI}`));
  });
  return p;
}

interface Zustand { viewer: boolean; seite: number | null; seiten: number; zoom: number | null; entfernt: number; bearbeitbar: boolean | null }
const zustand = (page: Page) => page.evaluate(() => (window as unknown as { diagrammansicht: { zustand(): Zustand } }).diagrammansicht.zustand());

async function sauber(page: Page, p: Protokoll, was: string): Promise<void> {
  const ereignisse = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(ereignisse, `${was}: CSP-Ereignisse`).toEqual([]);
  expect(p.csp, `${was}: CSP-Meldungen in der Konsole`).toEqual([]);
  expect(p.fremd, `${was}: Netzwerkanfragen`).toEqual([]);
  expect(p.fehler, `${was}: Seitenfehler`).toEqual([]);
}

async function foto(page: Page, name: string, engine: string): Promise<void> {
  if (BILDER) await page.screenshot({ path: join(BILDER, `${engine}-${name}.png`), fullPage: true });
}

test('Build: CSP eng, Viewer unverändert, Tor G7 ohne Befund', () => {
  expect(pruefeCsp(html, { styleAttrInline: true })).toEqual([]);
  expect(pruefeCsp(html)).toContain('unsafe-inline oder unsafe-eval in der CSP');
  expect(pruefeDiagrammansicht('Diagrammansicht.html', html)).toEqual([]);
  const policy = /content="([^"]*)"/.exec(html)![1]!;
  expect(policy).toContain("connect-src 'none'");
  expect(policy).not.toMatch(/unsafe-eval|https?:|\*/);
  expect(Buffer.byteLength(html)).toBeLessThan(1_600_000);
});

for (const [variante, datei] of [['unkomprimiert', 'testdiagramm.drawio'], ['komprimiert', 'testdiagramm-komprimiert.drawio']] as const) {
  test(`Testdiagramm ${variante}: Dateiauswahl, Anzeige, Seiten, Seitenlink, Zoom`, async ({ page, browserName }) => {
    const p = await protokoll(page);
    await page.goto(pathToFileURL(seite).href);
    await expect(page.locator('h1')).toHaveText('Diagramme ansehen');
    await page.setInputFiles('#datei', join(FIX, datei));
    await expect(page.locator('#status')).toHaveText(`«${datei}» geöffnet, 2 Seiten.`);
    const ansicht = page.locator('#ansicht');
    await expect(ansicht.getByText('identifizieren')).toBeVisible();
    await expect(ansicht.getByText('Behandlung freigeben')).toBeVisible();
    await expect(ansicht.getByText('Geschäftsleitung')).toBeVisible();
    // Formen gezeichnet: Ellipsen, Raute, Dokument, Kanten als SVG-Pfade
    expect(await ansicht.locator('svg ellipse, svg path').count()).toBeGreaterThan(8);
    expect(await zustand(page)).toMatchObject({ viewer: true, seite: 0, seiten: 2, zoom: 1, entfernt: 0 });
    await expect(page.locator('#seite option')).toHaveText(['Ablauf Testprozess', 'Anhang Register']);

    // Seiten: Schaltfläche und Seitenlink (Klick auf das Dokument führt zum Anhang, «Zurück» wieder zum Ablauf)
    await page.click('#seite-weiter');
    await expect(ansicht.getByText('Anhang: Risikoregister')).toBeVisible();
    expect((await zustand(page)).seite).toBe(1);
    await expect(page.locator('#seite')).toHaveValue('1');
    await ansicht.getByText('Zurück zum Ablauf').click();
    await expect(ansicht.getByText('identifizieren')).toBeVisible();
    expect((await zustand(page)).seite).toBe(0);
    await ansicht.getByText('Risikoregister (Ausmass').click();
    await expect(ansicht.getByText('Anhang: Risikoregister')).toBeVisible();
    await page.selectOption('#seite', '0');
    await expect(ansicht.getByText('identifizieren')).toBeVisible();

    // Zoom
    await page.click('#zoom-ein');
    expect((await zustand(page)).zoom).toBeGreaterThan(1);
    await expect(page.locator('#zoomwert')).not.toHaveText('100 %');
    await page.click('#zoom-original');
    await expect(page.locator('#zoomwert')).toHaveText('100 %');
    await page.click('#zoom-aus');
    expect((await zustand(page)).zoom).toBeLessThan(1);
    await page.click('#zoom-einpassen');
    expect((await zustand(page)).zoom).toBeGreaterThan(0.1);

    // Nur Ansicht: Graph nicht bearbeitbar
    expect((await zustand(page)).bearbeitbar).toBe(false);
    await sauber(page, p, `${browserName} ${variante}`);
    await page.selectOption('#seite', '0');
    await page.click('#zoom-original');
    await foto(page, `${variante}-seite1`, browserName);
  });
}

test('Drag-and-drop öffnet das komprimierte Testdiagramm', async ({ page, browserName }) => {
  const p = await protokoll(page);
  await page.goto(pathToFileURL(seite).href);
  const inhalt = readFileSync(join(FIX, 'testdiagramm-komprimiert.drawio'), 'utf8');
  const dt = await page.evaluateHandle((text) => {
    const d = new DataTransfer();
    d.items.add(new File([text], 'gezogen.drawio', { type: 'application/xml' }));
    return d;
  }, inhalt);
  await page.dispatchEvent('#ablage', 'dragenter', { dataTransfer: dt });
  await expect(page.locator('#ablage')).toHaveClass(/aktiv/);
  await page.dispatchEvent('#ablage', 'dragover', { dataTransfer: dt });
  await page.dispatchEvent('#ablage', 'drop', { dataTransfer: dt });
  await expect(page.locator('#status')).toHaveText('«gezogen.drawio» geöffnet, 2 Seiten.');
  await expect(page.locator('#ansicht').getByText('identifizieren')).toBeVisible();
  await expect(page.locator('#ablage')).not.toHaveClass(/aktiv/);
  await sauber(page, p, `${browserName} Drag-and-drop`);
});

test('Englisch und dunkel: Texte, Status und Diagramm folgen', async ({ page, browserName }) => {
  const p = await protokoll(page);
  await page.goto(pathToFileURL(seite).href);
  await page.setInputFiles('#datei', join(FIX, 'testdiagramm.drawio'));
  await expect(page.locator('#ansicht').getByText('identifizieren')).toBeVisible();
  await page.click('label[for="sprache-en"]');
  await expect(page.locator('h1')).toHaveText('View diagrams');
  await expect(page.locator('#status')).toHaveText('‘testdiagramm.drawio’ opened, 2 pages.');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
  await expect(page.locator('.fuss')).toContainText('draw.io is a registered trademark of draw.io Ltd.');
  await page.click('label[for="theme-dunkel"]');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#ansicht').getByText('identifizieren')).toBeVisible();
  await sauber(page, p, `${browserName} EN dunkel`);
  await foto(page, 'en-dunkel', browserName);
});

test('Fremdes Diagramm: nichts aus dem Internet, keine Skripte, Links bleiben zu', async ({ page, browserName }) => {
  const p = await protokoll(page);
  await page.goto(pathToFileURL(seite).href);
  await page.setInputFiles('#datei', join(FIX, 'fremd-mit-verweisen.drawio'));
  await expect(page.locator('#status')).toHaveText('«fremd-mit-verweisen.drawio» geöffnet, eine Seite.');
  await expect(page.locator('#status-zusatz')).toContainText('6 Verweise ins Internet');
  const ansicht = page.locator('#ansicht');
  await expect(ansicht.getByText('Link ins Internet')).toBeVisible();
  await ansicht.getByText('Link ins Internet').click();
  await expect(page.locator('#status')).toHaveText('Links auf Ziele ausserhalb der Datei öffnet die Ansicht nicht: https://example.org/');
  // javascript:-Link: draw.io entschärft ihn selbst zu einem relativen Ziel; die Ansicht öffnet auch das nicht
  await ansicht.getByText('Skript-Link').click();
  await expect(page.locator('#status')).toContainText('window.__xss=4');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss ?? null)).toBeNull();
  expect(page.url()).toBe(pathToFileURL(seite).href);
  await sauber(page, p, `${browserName} fremd`);
  await foto(page, 'fremd', browserName);
});

test('Keine Diagrammdatei: verständliche Meldung, Ansicht bleibt zu', async ({ page, browserName }) => {
  const p = await protokoll(page);
  await page.goto(pathToFileURL(seite).href);
  await page.setInputFiles('#datei', { name: 'notiz.drawio', mimeType: 'text/plain', buffer: Buffer.from('kein XML') });
  await expect(page.locator('#status')).toHaveText('«notiz.drawio» ist keine lesbare Diagrammdatei. Erwartet wird eine Datei im Format .drawio.');
  await expect(page.locator('#bereich')).toBeHidden();
  await sauber(page, p, `${browserName} Fehler`);
});
