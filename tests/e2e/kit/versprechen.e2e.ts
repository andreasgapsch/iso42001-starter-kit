// Kit-Versprechen (AP8): das Release-ZIP frisch entpacken und wie eine Firma benutzen.
// START.html öffnen, Links prüfen, Beispiel im AIMS-Manager öffnen, Dokumentenset erzeugen,
// jede Datei mit LibreOffice öffnen. Kein einziger Netzwerkzugriff ausser file://.
// Voraussetzung: npx tsx scripts/build.mts (ZIP unter dist/). Läuft nur in Chromium (LibreOffice-Teil einmal genügt).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import AxeBuilder from '@axe-core/playwright';
import { pruefeCsp } from '../../../scripts/csp.mts';

const REPO = process.cwd();
const ZIP = readdirSync(join(REPO, 'dist')).find((n) => /^KMU-CIO_ISO42001-Starter-Kit_v.+\.zip$/.test(n));

test.skip(!ZIP, 'Release-ZIP fehlt (npx tsx scripts/build.mts)');

let ziel = '';
let wurzel = '';

test.beforeAll(() => {
  ziel = mkdtempSync(join(tmpdir(), 'kit-versprechen-'));
  const r = spawnSync('unzip', ['-q', join(REPO, 'dist', ZIP!), '-d', ziel]);
  expect(r.status, String(r.stderr)).toBe(0);
  wurzel = join(ziel, readdirSync(ziel)[0]!);
});
test.afterAll(() => { if (ziel) rmSync(ziel, { recursive: true, force: true }); });

/** Protokolliert jede Anfrage, die nicht file:, data: oder blob: ist */
function netzwerk(page: Page): string[] {
  const fremd: string[] = [];
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) fremd.push(r.url()); });
  return fremd;
}

test('START.html: beide Sprachen, alle lokalen Links erreichbar, kein Netzwerk', async ({ page, browserName }) => {
  const fremd = netzwerk(page);
  const fehler: string[] = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  await page.goto(pathToFileURL(join(wurzel, 'START.html')).href);
  await expect(page.locator('h1')).toBeVisible();
  const links = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  const lokal = links.filter((h) => !/^(#|https?:|mailto:)/.test(h));
  // Startkachel ab rc.10: AIMS-Manager, Kurzanleitung, Diagrammansicht, Leitfaden, Vorlagen, KI-Assistent, Rechtstexte, Lizenz
  expect(lokal.length).toBeGreaterThanOrEqual(12);
  // In CI fehlen die Rechtstexte (nie im Repo) und der Drittlizenz-Cache; lokal wird alles verlangt
  const nurCi = (h: string) => !!process.env['CI'] && /^(Rechtstexte_Legal-Texts\/|LIZENZ_LICENCE\/DRITTLIZENZEN)/.test(h);
  for (const h of lokal) if (!nurCi(h)) expect(existsSync(join(wurzel, decodeURIComponent(h.split('#')[0]!))), h).toBe(true);
  expect(fehler).toEqual([]);
  expect(fremd, `${browserName}: Netzwerkzugriffe`).toEqual([]);
});

test('START.html im Designpaket «AIMS Nachtblau»: CSP gültig, Schrift ohne Netz, Kontrast hell und dunkel', async ({ page, browserName }) => {
  const datei = join(wurzel, 'START.html');
  expect(pruefeCsp(readFileSync(datei, 'utf8'))).toEqual([]);
  const fremd = netzwerk(page);
  const csp: string[] = [];
  page.on('console', (m) => { if (/Content Security Policy|Refused/i.test(m.text())) csp.push(m.text()); });
  await page.goto(pathToFileURL(datei).href);
  await expect(page.locator('#aims-oeffnen')).toBeVisible();
  await expect(page.locator('#aims-oeffnen')).toHaveAttribute('href', 'AIMS-Manager/aims-manager.html');
  expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check("16px 'Inter Variable'"); })).toBe(true);
  if (browserName === 'chromium') {
    for (const theme of ['hell', 'dunkel'] as const) {
      await page.click(`label[for="theme-${theme}"]`);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${theme} ${v.id}`)).toEqual([]);
    }
  }
  expect(csp).toEqual([]);
  expect(fremd).toEqual([]);
  // Drittlizenzen nennen die eingebetteten Schriften
  const dritt = join(wurzel, 'LIZENZ_LICENCE', 'DRITTLIZENZEN_THIRD-PARTY.txt');
  if (existsSync(dritt)) for (const n of ['Inter', 'Archivo', 'Source Serif 4', 'SIL Open Font License']) expect(readFileSync(dritt, 'utf8'), n).toContain(n);
});

for (const sprache of ['de', 'en'] as const) {
  test(`AIMS-Manager aus dem Kit: Beispiel ${sprache.toUpperCase()} öffnen, Set erzeugen, LibreOffice öffnet alles`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'LibreOffice-Prüfung einmal genügt');
    test.setTimeout(600_000);
    const fremd = netzwerk(page);
    const fehler: string[] = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript((s) => {
      delete (window as unknown as Record<string, unknown>)['showOpenFilePicker'];
      delete (window as unknown as Record<string, unknown>)['showSaveFilePicker'];
      try { localStorage.setItem('aims-manager:einstellung:ui-sprache', s); } catch { /* egal */ }
    }, sprache);
    const html = join(wurzel, 'AIMS-Manager', 'aims-manager.html');
    expect(existsSync(html)).toBe(true);
    await page.goto(pathToFileURL(html).href);
    await page.waitForSelector('body[data-bedienbar]', { timeout: 10_000 });

    // Beispielprojekt aus dem Kit-Ordner öffnen (wie eine Firma: Datei öffnen)
    const projekt = join(wurzel, 'AIMS-Manager', 'Beispiele_Examples', `muster-maschinenbau.${sprache}.aims.json`);
    expect(existsSync(projekt), projekt).toBe(true);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#start-oeffnen')]);
    await fc.setFiles(projekt);
    await expect(page).toHaveURL(/#\/formular\/uebersicht/);

    await page.evaluate(() => (location.hash = '#/dokumente'));
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120_000 }), page.click('#set-erzeugen')]);
    const zip = unzipSync(new Uint8Array(readFileSync(await dl.path())));
    const dateien = Object.entries(zip).filter(([n]) => /\.(docx|xlsx)$/.test(n));
    expect(dateien.length).toBeGreaterThanOrEqual(40);

    // Firmendokumente ohne Kit-Absender (Inhalt und Eigenschaften)
    for (const [name, daten] of dateien) {
      const innen = unzipSync(daten);
      for (const [teil, inhalt] of Object.entries(innen)) {
        if (!/\.xml$/.test(teil)) continue;
        const text = new TextDecoder().decode(inhalt);
        expect(/KMU-CIO|kmu-cio\.ch|Starter-Kit/i.test(text), `${name}/${teil}`).toBe(false);
      }
    }

    // LibreOffice öffnet jede Datei (Umwandlung nach PDF ohne Fehler)
    const ordner = mkdtempSync(join(tmpdir(), `kit-set-${sprache}-`));
    const profil = mkdtempSync(join(tmpdir(), 'lo-profil-'));
    try {
      mkdirSync(join(ordner, 'pdf'));
      for (const [name, daten] of dateien) writeFileSync(join(ordner, name.split('/').pop()!), daten);
      const quellen = readdirSync(ordner).filter((n) => /\.(docx|xlsx)$/.test(n)).map((n) => join(ordner, n));
      const r = spawnSync('soffice', [`-env:UserInstallation=${pathToFileURL(profil).href}`, '--headless', '--convert-to', 'pdf', '--outdir', join(ordner, 'pdf'), ...quellen], { timeout: 540_000 });
      expect(r.status, String(r.stderr)).toBe(0);
      const pdfs = readdirSync(join(ordner, 'pdf'));
      expect(pdfs.length).toBe(quellen.length);
    } finally {
      rmSync(ordner, { recursive: true, force: true });
      rmSync(profil, { recursive: true, force: true });
    }

    expect(fehler).toEqual([]);
    expect(fremd, 'Netzwerkzugriffe').toEqual([]);
  });
}
