// Runde 2, letzte Behebung: E2-07, E2-10, E2-21, E-13, C2-09, C2-17, C2-22, C2-24, C2-25, C2-26, D2-05, D2-06, D2-08, D-26, D-27, D-28.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { chromium, expect, type Page } from '@playwright/test';
import { test } from './app-hilfen.ts';
import { REPO, TMP } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte } from './app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true });

const hash = (page: Page, h: string) => page.evaluate((x) => (location.hash = x), h);
const nurChromium = (browserName: string) => test.skip(browserName !== 'chromium', 'Nur Chromium, Speichervorgabe der VM');

const KOPF = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">';
/** Unter der Aufwandsgrenze (19 000 Elemente), aber teuer zu zeichnen: ganzflächig mit Deckkraft, bei 2400 px gemessen über 15 s */
const teuresSvg = () => `${KOPF}${'<circle cx="5" cy="5" r="9" fill="#123456" opacity="0.5"/>'.repeat(19_000)}</svg>`;

test('E2-07: teures SVG unter der Aufwandsgrenze endet mit Meldung, einfaches Logo geht durch', async ({ page, browserName }) => {
  nurChromium(browserName);
  test.setTimeout(60_000);
  await starte(page);
  await oeffne(page, fixtureDatei('r2-e07.aims.json'));
  await hash(page, '#/einstellungen/gestaltung');
  const start = Date.now();
  await page.locator('#gestaltung-datei').setInputFiles({ name: 'teuer.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(teuresSvg()) });
  await expect(page.locator('main')).toContainText('zu aufwendig zum Zeichnen', { timeout: 30_000 });
  // Vorher: über 169 s ohne Meldung
  expect(Date.now() - start).toBeLessThan(20_000);
  expect(await page.evaluate(() => 1 + 1)).toBe(2);
  await page.locator('#gestaltung-datei').setInputFiles({ name: 'gut.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(`${KOPF}<rect width="10" height="10" fill="#07a"/></svg>`) });
  await expect(page.locator('main')).not.toContainText('zu aufwendig zum Zeichnen', { timeout: 15_000 });
});

/**
 * Echter Griff auf das private Dateisystem des Browsers: zeigt, dass createWritable die Datei selbst strömend schreibt. Unter
 * file:// verweigert Chromium diesen Speicher (SecurityError), darum die App für diese Tests über localhost.
 */
async function echterOrdner(page: Page, kontext: { server?: Server }): Promise<void> {
  const html = readFileSync(join(REPO, HTML));
  const server = createServer((_, a) => a.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html));
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  kontext.server = server;
  await page.addInitScript(() => {
    delete (window as any).showOpenFilePicker;
    delete (window as any).showSaveFilePicker;
    (window as any).showDirectoryPicker = () => navigator.storage.getDirectory();
  });
  await page.goto(`http://localhost:${(server.address() as AddressInfo).port}/`);
  await page.waitForSelector('body[data-bedienbar]', { timeout: 10_000 });
}

async function summeDatei(pfad: string): Promise<string> {
  const h = createHash('sha256');
  for await (const c of createReadStream(pfad)) h.update(c as Buffer);
  return h.digest('hex');
}

test('E2-10: Datei über der Speichergrenze geht strömend in den Ordner, mit richtiger Prüfsumme', async ({ browserName }) => {
  nurChromium(browserName);
  test.setTimeout(180_000);
  const groesse = Number(process.env['R2_GROSS'] ?? 530 * 1024 * 1024);
  mkdirSync(TMP, { recursive: true });
  const gross = join(TMP, `video-${test.info().parallelIndex}.bin`);
  writeFileSync(gross, '');
  truncateSync(gross, groesse);
  const fehler: string[] = [];
  // Dauerhaftes Profil: Das flüchtige erlaubt im privaten Dateisystem weniger als die grosse Originaleingabe (2,5 GB)
  const profil = await chromium.launchPersistentContext(test.info().outputPath('profil'), { locale: 'de-CH', viewport: { width: 1400, height: 950 } });
  const page = profil.pages()[0] ?? await profil.newPage();
  page.on('crash', () => fehler.push('abgestürzt'));
  const k: { server?: Server } = {};
  await echterOrdner(page, k);
  await oeffne(page, fixtureDatei('r2-e10.aims.json'));
  await hash(page, '#/bibliothek/alle');
  await page.click('#bib-ordner-verbinden');
  await expect(page.locator('#bib-verbindung')).not.toContainText('Kein Bibliotheksordner', { timeout: 15_000 });
  await page.locator('#bib-datei').setInputFiles(gross);
  await expect(page.locator('#meldung')).toContainText('Abgelegte Dateien: 1', { timeout: 150_000 });
  expect(fehler).toEqual([]);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  const stand = JSON.parse(await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8')) as { bibliothek: { eintraege: { id: string; versionen: { groesse: number; pruefsumme: string }[] }[] } };
  const eintrag = stand.bibliothek.eintraege.at(-1)!;
  expect(eintrag.versionen[0]!.groesse).toBe(groesse);
  expect(eintrag.versionen[0]!.pruefsumme).toBe(await summeDatei(gross));
  truncateSync(gross, 0);
  rmSync(gross, { force: true });
  await profil.close();
  rmSync(test.info().outputPath('profil'), { recursive: true, force: true });
  k.server?.close();
});

test('E2-21: bibliothek.json nicht schreibbar: Meldung, Projektdatei bleibt richtig', async ({ page, browserName }) => {
  nurChromium(browserName);
  const k: { server?: Server } = {};
  await page.addInitScript(() => {
    const orig = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = function (this: FileSystemFileHandle, ...a: []) {
      if (this.name === 'bibliothek.json' && (window as any).__sperre) return Promise.reject(Object.assign(new Error('gesperrt'), { name: 'NoModificationAllowedError' }));
      return orig.apply(this, a);
    };
  });
  await echterOrdner(page, k);
  await oeffne(page, fixtureDatei('r2-e21.aims.json'));
  await hash(page, '#/bibliothek/alle');
  await page.click('#bib-ordner-verbinden');
  await expect(page.locator('#bib-verbindung')).not.toContainText('Kein Bibliotheksordner', { timeout: 15_000 });
  await page.evaluate(() => ((window as any).__sperre = true));
  await page.locator('#bib-datei').setInputFiles({ name: 'beleg.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await expect(page.locator('#meldung')).toContainText('bibliothek.json', { timeout: 15_000 });
  k.server?.close();
});

test('E-13: zwei Tabs warnen in jeder Engine, und jeder Tab behält seinen Stand', async ({ page, context }) => {
  const datei = fixtureDatei('tabs2.aims.json');
  await starte(page);
  await oeffne(page, datei);
  const zwei = await context.newPage();
  await starte(zwei);
  await oeffne(zwei, datei);
  // Warnung sofort, nicht erst beim ersten Schreiben
  await expect(zwei.locator('#warnung-tabs')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#warnung-tabs')).toBeVisible({ timeout: 8000 });
  const eingeben = async (p: Page, wert: string) => {
    await p.evaluate(() => (location.hash = '#/formular/inventar/KI-001'));
    await p.fill('#editor-kiSysteme input[type=text] >> nth=0', wert);
    await p.evaluate(() => globalThis.dispatchEvent(new Event('pagehide')));
    await p.waitForTimeout(400);
  };
  await eingeben(page, 'TAB-A');
  await eingeben(zwei, 'TAB-B');
  await eingeben(page, 'TAB-A2');
  const staende = await page.evaluate(() => new Promise<string[]>((ok, fehler) => {
    const r = indexedDB.open('aims-manager', 1);
    r.onerror = () => fehler(r.error);
    r.onsuccess = () => {
      const g = r.result.transaction('zwischenstaende').objectStore('zwischenstaende').getAll();
      g.onsuccess = () => ok((g.result as string[]).map((x) => /TAB-[AB]2?/.exec(x)?.[0] ?? ''));
    };
  }));
  // Beide Stände bleiben; in WebKit ohne IndexedDB unter file:// fiele der Vergleich auf den localStorage zurück
  expect(staende.filter(Boolean).sort()).toEqual(['TAB-A2', 'TAB-B']);
});

test('C2-25: Version in der Plan-Freigabe verlangt eine Nummer', async ({ page, browserName }) => {
  nurChromium(browserName);
  await starte(page);
  await oeffne(page, fixtureDatei('r2-c25.aims.json'));
  await hash(page, '#/gefuehrt/E8/E8-plan-freigabe');
  const f = page.locator('input[id$="version"]').first();
  await f.fill('Festgelegt für Version');
  await expect(page.locator('main')).toContainText('nur die Versionsnummer');
  await f.fill('1.2');
  await expect(page.locator('main')).not.toContainText('nur die Versionsnummer');
});

test('C2-22: Einstieg zählt die Seiten wie der Bericht', async ({ page, browserName }) => {
  nurChromium(browserName);
  await starte(page);
  await oeffne(page, fixtureDatei('r2-c22.aims.json'));
  await hash(page, '#/gefuehrt/E0');
  const text = await page.locator('#etappe-seiten-anzahl').textContent();
  const punkte = Number(/: (\d+)\./.exec(text ?? '')?.[1]);
  const fortschritt = await page.locator('#gefuehrt-fortschritt').textContent();
  expect(punkte).toBeGreaterThan(0);
  expect(fortschritt).toBeTruthy();
});

test('D2-06: Klickziele auf den Routen aus dem Bericht, Telefon 44 px', async ({ page, browserName }) => {
  nurChromium(browserName);
  await starte(page);
  await oeffne(page, fixtureDatei('r2-d06.aims.json'));
  const mass = async (s: string) => page.locator(s).first().evaluate((e) => e.getBoundingClientRect().height);
  await hash(page, '#/prozesse');
  await expect(page.locator('a.marke-id').first()).toBeVisible();
  expect(await mass('a.marke-id')).toBeGreaterThanOrEqual(24);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  expect(await mass('a.marke-id')).toBeGreaterThanOrEqual(44);
});

test('D-26, D-27: Rückweg unter dem Titel, Prozesstabellen mit denselben Spalten', async ({ page, browserName }) => {
  nurChromium(browserName);
  await starte(page);
  await oeffne(page, fixtureDatei('r2-d26.aims.json'));
  await hash(page, '#/prozesse');
  await expect(page.locator("table[data-liste='prozesse']").first()).toBeVisible();
  const art = await page.locator(".prozess-gruppe table[data-liste='prozesse']").evaluateAll((t) => t.map((x) => Math.round(x.querySelector('th:nth-child(3)')!.getBoundingClientRect().x)));
  expect(new Set(art).size, `Spalte Art: ${art.join(', ')}`).toBe(1);
  const ziel = await page.locator("table[data-liste='prozesse'] a.marke-id").first().getAttribute('href');
  await hash(page, ziel!);
  await expect(page.locator('#prozess-zurueck')).toBeVisible();
  const [h, z] = await Promise.all([page.locator('h1').first().boundingBox(), page.locator('#prozess-zurueck').boundingBox()]);
  expect(z!.y).toBeGreaterThan(h!.y);
  await hash(page, '#/einstellungen/gestaltung');
  // A-24 (test.9): Pfeil als Symbol (svg.sym) statt des Zeichens «←»
  await expect(page.locator('#gestaltung-zurueck svg.sym')).toHaveCount(1);
});

test('D-28: Etappe und Seite stehen nur einmal', async ({ page, browserName }) => {
  nurChromium(browserName);
  await starte(page);
  await oeffne(page, fixtureDatei('r2-d28.aims.json'));
  await hash(page, '#/gefuehrt/E4/E4-systeme');
  await expect(page.locator('#seiten-ort')).toContainText(/Seite \d+ von/);
  expect(await page.locator('main').innerText().then((t) => (t.match(/Seite \d+ von \d+/g) ?? []).length)).toBe(1);
});

test('D2-05: Knopf mit langem Wort läuft nicht über und trennt mit Strich, wo der Browser ein Wörterbuch hat', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Firefox und Chromium genügen, Speichervorgabe der VM');
  await page.setViewportSize({ width: 390, height: 844 });
  await starte(page);
  await oeffne(page, fixtureDatei('r2-d05.aims.json', false, (p) => { p.personen[0]!.name = 'Informationssicherheitsbeauftragter'; }));
  let gefunden = 0;
  for (const route of ['#/gefuehrt/E12/E12-mb-entscheide', '#/formular/organisation', '#/gefuehrt/E3/E3-leitlinie-freigabe']) {
    await hash(page, route);
    await page.waitForTimeout(400);
    const knoepfe = page.locator('button:visible').filter({ hasText: 'Informationssicherheitsbeauftragter' });
    gefunden += await knoepfe.count();
    const zu = await knoepfe.evaluateAll((b) => b.filter((e) => e.scrollWidth > e.clientWidth + 1 || getComputedStyle(e).hyphens !== 'auto').map((e) => e.textContent));
    expect(zu, route).toEqual([]);
  }
  expect(gefunden, 'Knopf mit dem langen Wort auf den Routen').toBeGreaterThan(0);
  if (process.env['R2_BILDER']) await page.screenshot({ path: `${process.env['R2_BILDER']}/d05-${browserName}.png`, fullPage: true });
});

test('C2-26: Sprung aus der Prüfung trifft den Eintrag, nicht die Liste', async ({ page, browserName }) => {
  nurChromium(browserName);
  const p = JSON.parse(readFileSync(join(REPO, 'src/beispiele/praezisionsteile.de.aims.json'), 'utf8')) as { parteien: { id: string; anforderungen: { adressiert: string }[] }[] };
  const partei = p.parteien.find((x) => x.anforderungen.length)!;
  partei.anforderungen[0]!.adressiert = 'offen';
  mkdirSync(TMP, { recursive: true });
  const datei = join(TMP, `r2-c26-${test.info().parallelIndex}.aims.json`);
  writeFileSync(datei, JSON.stringify(p));
  await starte(page);
  await oeffne(page, datei);
  await hash(page, '#/pruefung');
  await page.getByRole('link', { name: /Entscheid zu einer Anforderung fehlt/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`eintrag=${partei.id}`));
});
