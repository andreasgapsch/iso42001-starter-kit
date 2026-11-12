// Bildschirmfotos für README und Dokumentation (docs/bilder): aus dem gebauten Kit (dist/kit, file://), mit dem Beispiel
// «Muster Maschinenbau AG» (fiktive Daten). Aufruf: npm run bildschirmfotos (vorher npm run build:app und npm run build:kit).
// Browserläufe mit Speichergrenze: scripts/werkzeug/begrenzt.sh 3G npm run bildschirmfotos
// Optimiert mit oxipng oder pngquant, falls installiert; sonst bleibt die Playwright-Qualität.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

const REPO = process.cwd();
const AUS = join(REPO, 'docs', 'bilder');
const kitOrdner = (): string => {
  const wurzel = join(REPO, 'dist', 'kit');
  const name = readdirSync(wurzel).find((n) => n.startsWith('KMU-CIO_ISO42001-Starter-Kit_v'));
  if (!name) throw new Error('Kit nicht gebaut: zuerst npm run build:kit');
  return join(wurzel, name);
};
const KIT = kitOrdner();
const WERKZEUG = join(KIT, 'AIMS-Manager', 'aims-manager.html');
const START = join(KIT, 'START.html');
const lauf = mkdtempSync(join(process.env['TMPDIR'] ?? tmpdir(), 'bildschirmfotos-'));

type Sprache = 'de' | 'en';
type Groesse = { width: number; height: number };
const LOCALE: Record<Sprache, string> = { de: 'de-CH', en: 'en-GB' };
const BEISPIEL = (s: Sprache): string => join(KIT, 'AIMS-Manager', 'Beispiele_Examples', `muster-maschinenbau.${s}.aims.json`);
const DESKTOP: Groesse = { width: 1440, height: 900 };
const TELEFON: Groesse = { width: 390, height: 844 };

const url = (pfad: string): string => pathToFileURL(pfad).href;

async function neueSeite(browser: Browser, s: Sprache, viewport: Groesse, modus: 'dark' | 'light', telefon = false): Promise<Page> {
  const ctx = await browser.newContext({ viewport, locale: LOCALE[s], colorScheme: modus, deviceScaleFactor: 1, isMobile: telefon, hasTouch: telefon });
  const page = await ctx.newPage();
  await page.addInitScript((m) => {
    try {
      localStorage.setItem('aims-manager:einstellung:theme', m === 'light' ? 'hell' : 'dunkel');
    } catch {
      /* ohne Speicher gilt die Voreinstellung */
    }
    delete (window as unknown as Record<string, unknown>)['showOpenFilePicker'];
    delete (window as unknown as Record<string, unknown>)['showSaveFilePicker'];
  }, modus);
  return page;
}

async function beispielOeffnen(page: Page, s: Sprache): Promise<void> {
  await page.goto(url(WERKZEUG));
  await page.waitForSelector('body[data-bedienbar]', { timeout: 15_000 });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#start-oeffnen')]);
  await fc.setFiles(BEISPIEL(s));
  await page.waitForURL(/#\/formular\/uebersicht/);
  await page.getByRole('status').filter({ hasText: /«Muster Maschinenbau AG»/ }).waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(700);
}

async function gehe(page: Page, hash: string): Promise<void> {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(700);
}

async function foto(page: Page, name: string, zu?: string): Promise<void> {
  await page.evaluate((sel) => (sel ? document.querySelector(sel)?.scrollIntoView() : window.scrollTo(0, 0)), zu);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(AUS, name), animations: 'disabled', caret: 'initial' });
  console.log('Bild', name);
}

/** Dokument oder Tabelle des Kits mit LibreOffice (headless) als PDF, eine Seite als PNG */
function dokumentSeite(quelle: string, ziel: string, seite = 1): void {
  const pdfDir = mkdtempSync(join(lauf, 'pdf-'));
  execFileSync('soffice', ['--headless', `-env:UserInstallation=${pathToFileURL(join(lauf, 'lo-profil')).href}`, '--convert-to', 'pdf', '--outdir', pdfDir, quelle], { stdio: 'ignore', timeout: 180_000 });
  const pdf = join(pdfDir, readdirSync(pdfDir).find((n) => n.endsWith('.pdf'))!);
  const stamm = join(pdfDir, 'seite');
  execFileSync('pdftoppm', ['-png', '-r', '110', '-f', String(seite), '-l', String(seite), '-singlefile', pdf, stamm]);
  renameSync(`${stamm}.png`, join(AUS, ziel));
  console.log('Bild', ziel);
}

/** Excel-Datei des Kits mit LibreOffice (headless) als HTML, dann Blatt n in Chromium abgelichtet (Tabellenansicht) */
async function excelAnsicht(browser: Browser, quelle: string, ziel: string, blatt: number): Promise<void> {
  const htmlDir = mkdtempSync(join(lauf, 'html-'));
  execFileSync('soffice', ['--headless', `-env:UserInstallation=${pathToFileURL(join(lauf, 'lo-profil')).href}`, '--convert-to', 'html:HTML (StarCalc)', '--outdir', htmlDir, quelle], { stdio: 'ignore', timeout: 180_000 });
  const html = join(htmlDir, readdirSync(htmlDir).find((n) => n.endsWith('.html'))!);
  const page = await browser.newPage({ viewport: { width: 1440, height: 800 }, deviceScaleFactor: 1 });
  await page.goto(url(html));
  await page.addStyleTag({ content: 'body{zoom:1.1;background:#fff;margin:0;padding:8px} hr,center{display:none} h1{font-size:14pt;margin:4px 0} td,th{height:auto;vertical-align:top}' });
  await page.evaluate((n) => {
    document.querySelectorAll('tr, td, th').forEach((e) => e.removeAttribute('height'));
    const h = [...document.querySelectorAll('h1')].find((e) => new RegExp(`^(Sheet|Tabelle|Blatt) ${n}\\b`).test(e.textContent ?? ''));
    h?.scrollIntoView();
  }, blatt);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(AUS, ziel) });
  console.log('Bild', ziel);
  await page.close();
}

function optimiere(): void {
  const habe = (b: string): boolean => {
    try {
      execFileSync('which', [b], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  for (const n of readdirSync(AUS).filter((x) => x.endsWith('.png'))) {
    const p = join(AUS, n);
    if (habe('oxipng')) execFileSync('oxipng', ['-o', '4', '--strip', 'all', '-q', p]);
    else if (habe('pngquant')) execFileSync('pngquant', ['--force', '--skip-if-larger', '--quality=70-95', '--ext', '.png', p]);
  }
}

async function main(): Promise<void> {
  mkdirSync(AUS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const s of ['de', 'en'] as Sprache[]) {
      let page = await neueSeite(browser, s, DESKTOP, 'dark');
      await page.goto(url(START));
      await page.waitForTimeout(500);
      await foto(page, `${s}-01-start.png`);
      await page.context().close();

      page = await neueSeite(browser, s, DESKTOP, 'dark');
      await beispielOeffnen(page, s);
      await foto(page, `${s}-02-uebersicht-dunkel.png`);
      await gehe(page, '#/formular/inventar');
      await foto(page, `${s}-05-register-ki-systeme.png`);
      await gehe(page, '#/pruefung/stage1');
      await foto(page, `${s}-07-pruefung-stage1.png`);
      if (s === 'de') {
        await gehe(page, '#/gefuehrt');
        await foto(page, 'de-04-guide.png');
        await gehe(page, '#/formular/risiken');
        await page.locator('summary', { hasText: 'Risikomatrix' }).first().click();
        await page.waitForTimeout(500);
        await foto(page, 'de-06-risikomatrix.png');
        await gehe(page, '#/prozesse/PR-07');
        await foto(page, 'de-08-prozess-ablauf.png', '.prozess-ablauf');
        await gehe(page, '#/bibliothek');
        await foto(page, 'de-09-bibliothek.png');
      }
      await page.context().close();

      if (s === 'de') {
        page = await neueSeite(browser, s, DESKTOP, 'light');
        await beispielOeffnen(page, s);
        await foto(page, 'de-03-uebersicht-hell.png');
        await page.context().close();
      }
    }
    for (const [hash, name] of [['#/formular/uebersicht', 'de-12-telefon-uebersicht.png'], ['#/formular/inventar', 'de-13-telefon-register.png']] as const) {
      const page = await neueSeite(browser, 'de', TELEFON, 'dark', true);
      await beispielOeffnen(page, 'de');
      await gehe(page, hash);
      await foto(page, name);
      await page.context().close();
    }
    await excelAnsicht(browser, join(KIT, 'DE', '04_Beispiele', 'muster-maschinenbau', 'D-11_Erklaerung-Anwendbarkeit.xlsx'), 'de-11-excel-d11.png', 2);
  } finally {
    await browser.close();
  }
  const beispiele = (s: 'DE' | 'EN'): string => join(KIT, s, s === 'DE' ? '04_Beispiele' : '04_Examples', 'muster-maschinenbau');
  const waehle = (ordner: string, muster: RegExp): string => join(ordner, readdirSync(ordner).filter((n) => muster.test(n)).sort()[0]!);
  dokumentSeite(waehle(beispiele('DE'), /^D-09.*KI-001\.docx$/), 'de-10-dokument-d09.png');
  dokumentSeite(waehle(beispiele('EN'), /^D-09.*KI-001\.docx$/), 'en-10-document-d09.png');
  optimiere();
  rmSync(lauf, { recursive: true, force: true });
  for (const f of readdirSync(AUS).filter((x) => x.endsWith('.png'))) console.log(f, Math.round(statSync(join(AUS, f)).size / 1024), 'KB');
}

await main();
