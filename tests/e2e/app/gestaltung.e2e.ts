// Dokumentgestaltung im Werkzeug (drei Engines, file://): Logo-Import in allen Formaten mit Umrechnung im Browser
// (Canvas), Bereinigung von Metadaten und SVG, Warnungen, Farben mit Korrektur, Vorschlag aus dem Logo, Live-Vorschau,
// Muster als Word und Excel, Gestaltungspaket, Startinterview und axe ohne Befund.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test, beantworteRueckfragen } from './app-hilfen.ts';
import { strFromU8, unzipSync } from 'fflate';
import { ausBase64, pngInfo, pngKodieren, pngTeile } from '../../../src/generator/png.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, ORDNER, fixtureDatei, oeffne, starte } from './app-hilfen.ts';
import { waehle } from '../auswahl-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');

const LOGOS = join(REPO, 'tests/fixtures/logos');

/** Testdatei im Ablageordner (je Engine eindeutig) */
function datei(name: string, inhalt: Uint8Array | string): string {
  mkdirSync(ORDNER, { recursive: true });
  const pfad = join(ORDNER, `${test.info().project.name}-${name}`);
  writeFileSync(pfad, inhalt);
  return pfad;
}

/** PNG 300 x 100 mit transparentem Rand, blau mit rotem Balken; optional tEXt «kmu-cio» */
function pngMitText(): Uint8Array {
  const w = 300;
  const h = 100;
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(x < 20 || x >= 280 || y < 10 || y >= 90 ? [0, 0, 0, 0] : y > 60 ? [200, 30, 40, 255] : [28, 93, 148, 255], (y * w + x) * 4);
  const png = pngKodieren({ breite: w, hoehe: h, daten: d });
  const text = new TextEncoder().encode('Software\u0000kmu-cio.ch');
  const teil = new Uint8Array(12 + text.length);
  new DataView(teil.buffer).setUint32(0, text.length);
  teil.set(new TextEncoder().encode('tEXt'), 4);
  teil.set(text, 8);
  return new Uint8Array([...png.subarray(0, 33), ...teil, ...png.subarray(33)]);
}

function weissAufTransparent(): Uint8Array {
  const w = 200;
  const h = 60;
  const d = new Uint8Array(w * h * 4);
  for (let y = 15; y < 45; y++) for (let x = 20; x < 180; x++) d.set([255, 255, 255, 255], (y * w + x) * 4);
  return pngKodieren({ breite: w, hoehe: h, daten: d });
}

const SVG_BOESE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" onload="window.boese=1">
<script>window.boese=2</script><foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>
<image href="https://example.org/a.png" width="10" height="10"/>
<rect x="10" y="10" width="220" height="60" fill="#1D3557"/><circle cx="120" cy="40" r="20" fill="#E9A23B"/></svg>`;

async function gestaltungOeffnen(page: Page): Promise<string[]> {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('gestaltung.aims.json'));
  await page.goto(`${page.url().split('#')[0]}#/einstellungen/gestaltung`);
  await expect(page.locator('h1')).toHaveText(/Dokumentgestaltung|Document design/);
  return fehler;
}

async function hochladen(page: Page, pfad: string): Promise<void> {
  await page.setInputFiles('#gestaltung-datei', pfad);
}

/** Gespeichertes Logo (PNG-Bytes) aus der Vorschau auf weissem Grund */
async function gespeichertesPng(page: Page): Promise<Uint8Array> {
  const src = await page.locator('#gestaltung-logo-bild').getAttribute('src');
  return ausBase64(src!.split(',')[1]!);
}

test('Logo in allen Formaten: Umrechnung im Browser, Metadaten weg, Ränder ab, SVG bereinigt, Warnungen', async ({ page }) => {
  const fehler = await gestaltungOeffnen(page);
  // PNG mit Transparenz und tEXt «kmu-cio»
  await hochladen(page, datei('logo-text.png', pngMitText()));
  await expect(page.locator('#gestaltung-logo-info')).toContainText('260 x 80 px');
  let png = await gespeichertesPng(page);
  expect(pngTeile(png).map((t) => t.typ)).not.toContain('tEXt');
  expect(Buffer.from(png).toString('latin1')).not.toMatch(/kmu-cio/i);
  await expect(page.locator('[data-hinweis="raender"]')).toBeVisible();
  // JPEG mit Kommentar, CMYK-JPEG, WebP, animiertes GIF
  for (const [name, masse] of [['foto.jpg', /^26\d x 6\d px/], ['cmyk.jpg', /^26\d x 6\d px/], ['logo.webp', /^22\d x 6\d px/], ['anim.gif', /^10\d x 10\d px/]] as const) {
    await hochladen(page, join(LOGOS, name));
    await expect(page.locator('#gestaltung-logo-info'), name).toContainText(masse);
    png = await gespeichertesPng(page);
    expect(Buffer.from(png).toString('latin1'), name).not.toMatch(/kmu-cio/i);
  }
  await expect(page.locator('[data-hinweis="erstes-bild"]')).toBeVisible();
  // SVG mit Skript, Ereignis, foreignObject und externem Bild: kein Skript läuft, Bild entsteht, SVG bereinigt gespeichert
  await hochladen(page, datei('boese.svg', SVG_BOESE));
  await expect(page.locator('[data-hinweis="svg-bereinigt"]')).toBeVisible();
  await expect(page.locator('#gestaltung-logo-info')).toContainText(/^14\d\d x 400 px/);
  expect(await page.evaluate(() => (window as unknown as { boese?: number }).boese)).toBeUndefined();
  // SVG nur mit viewBox (ohne width/height)
  await hochladen(page, datei('nur-viewbox.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><circle cx="25" cy="25" r="25" fill="#457B9D"/></svg>'));
  await expect(page.locator('#gestaltung-logo-info')).toContainText(/400 x 400 px.*(quadratisch|square)/);
  // Weiss auf transparent: Warnung «für dunklen Grund»
  await hochladen(page, datei('weiss.png', weissAufTransparent()));
  await expect(page.locator('[data-hinweis="dunkler-grund"]')).toBeVisible();
  // Kleines Logo
  await hochladen(page, datei('klein.png', pngKodieren({ breite: 20, hoehe: 20, daten: new Uint8Array(20 * 20 * 4).fill(200) })));
  await expect(page.locator('[data-hinweis="klein"]')).toBeVisible();
  // Grosses Bild (8000 x 2000) wird verkleinert
  await hochladen(page, datei('gross.png', pngKodieren({ breite: 8000, hoehe: 2000, daten: new Uint8Array(8000 * 2000 * 4).map((_, i) => (i % 4 === 3 ? 255 : (i >> 6) & 255)) })));
  await expect(page.locator('#gestaltung-logo-info')).toContainText('1600 x 400 px');
  png = await gespeichertesPng(page);
  expect(png.length).toBeLessThanOrEqual(200 * 1024);
  expect(pngInfo(png)).toMatchObject({ breite: 1600, hoehe: 400 });
  // PDF wird abgelehnt. Kleine, selbst erzeugte PDF im Test (alle *.pdf sind per .gitignore vom Repo ausgeschlossen)
  await hochladen(page, datei('logo.pdf', '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'));
  await expect(page.locator('#gestaltung-logo-fehler')).toContainText(/SVG|PNG/);
  expect(fehler).toEqual([]);
});

test('Farben: Korrektur, Vorschlag aus dem Logo, Vorschau, Muster als Word und Excel, Paket, axe', async ({ page }) => {
  const fehler = await gestaltungOeffnen(page);
  await hochladen(page, datei('logo.png', pngMitText()));
  await expect(page.locator('#gestaltung-logo-bild')).toBeVisible();
  // Vorschlag aus dem Logo: Blau und Rot
  await page.click('#gestaltung-vorschlagen');
  await expect(page.locator('#gestaltung-vorschlaege li')).toHaveCount(2);
  await page.locator('#gestaltung-vorschlaege li').first().locator('button').first().click();
  await expect(page.locator('#gestaltung-farbe-primaer')).toHaveValue(/^#1C5D9[0-9A-F]$/);
  // Zu helle Primärfarbe: Hinweis mit korrigierter Farbe, Vorschau übernimmt sie
  await page.fill('#gestaltung-farbe-primaer', '#FFB000');
  await page.press('#gestaltung-farbe-primaer', 'Tab');
  await expect(page.locator('#gestaltung-farb-hinweise [data-art="korrigiert"]').first()).toContainText('#FFB000');
  const titel = await page.locator('#gestaltung-muster .dokument-vorschau').evaluate((e) => getComputedStyle(e).getPropertyValue('--ir-titel').trim());
  expect(titel).not.toBe('#FFB000');
  expect(titel).toMatch(/^#[0-9A-F]{6}$/);
  await expect(page.locator('#gestaltung-muster .ir-kopfzeile img')).toBeVisible();
  // Ungültige Farbe: Fehlermeldung
  await page.fill('#gestaltung-farbe-sekundaer', 'blau');
  await page.press('#gestaltung-farbe-sekundaer', 'Tab');
  await expect(page.locator('#gestaltung-farbe-sekundaer-fehler')).toBeVisible();
  await page.fill('#gestaltung-farbe-sekundaer', '#457B9D');
  await page.press('#gestaltung-farbe-sekundaer', 'Tab');
  // Wasserzeichen in der Vorschau (Muster ist ein Entwurf), Ansicht bei Fehlsichtigkeit
  await expect(page.locator('#gestaltung-muster .ir-wasserzeichen')).toBeVisible();
  await waehle(page.locator('#gestaltung-fehlsicht'), 'deuteranopie');
  expect(await page.locator('#gestaltung-muster .dokument-vorschau').evaluate((e) => getComputedStyle(e).filter)).toContain('fehlsicht-deuteranopie');
  await waehle(page.locator('#gestaltung-titelseite'), 'alle');
  await expect(page.locator('#gestaltung-muster .ir-titelseite')).toBeVisible();
  // Muster als Word: Logo in der Kopfzeile, Wasserzeichen, Titelseite
  const [dw] = await Promise.all([page.waitForEvent('download'), page.click('#gestaltung-muster-word')]);
  const docx = unzipSync(new Uint8Array(readFileSync((await dw.path())!)));
  const koepfe = Object.entries(docx).filter(([p]) => /^word\/header\d+\.xml$/.test(p)).map(([, b]) => strFromU8(b)).join('');
  expect(koepfe).toContain('<w:drawing>');
  expect(koepfe).toContain('PowerPlusWaterMarkObject1');
  expect(strFromU8(docx['word/document.xml']!)).toContain('<w:titlePg/>');
  const [dx] = await Promise.all([page.waitForEvent('download'), page.click('#gestaltung-muster-excel')]);
  const xlsx = unzipSync(new Uint8Array(readFileSync((await dx.path())!)));
  expect(Object.keys(xlsx)).toContain('xl/media/kopflogo.png');
  // axe ohne Befund (Seite mit Logo, Hinweisen und Vorschau)
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
  // Paket exportieren, zurücksetzen, importieren
  const [dp] = await Promise.all([page.waitForEvent('download'), page.click('#gestaltung-exportieren')]);
  const paketPfad = (await dp.path())!;
  const paket = JSON.parse(readFileSync(paketPfad, 'utf8'));
  expect(paket).toMatchObject({ art: 'aims-gestaltung', version: 1, gestaltung: { farben: { primaer: 'FFB000', sekundaer: '457B9D' }, titelseite: 'alle' } });
  await beantworteRueckfragen(page, true, { einmal: true });
  await page.click('#gestaltung-zuruecksetzen');
  await expect(page.locator('#gestaltung-logo-bild')).toHaveCount(0);
  await page.setInputFiles('#gestaltung-paket-datei', datei('paket.json', readFileSync(paketPfad)));
  await expect(page.locator('#gestaltung-logo-bild')).toBeVisible();
  await expect(page.locator('#gestaltung-farbe-primaer')).toHaveValue('#FFB000');
  await page.setInputFiles('#gestaltung-paket-datei', datei('kein-paket.json', '{"art":"etwas"}'));
  await expect(page.locator('#gestaltung-paket-fehler')).toBeVisible();
  // Stand in Dokumente › Erzeugen, Druckansicht eines Firmendokuments gestaltet
  await page.goto(`${page.url().split('#')[0]}#/dokumente`);
  await expect(page.locator('#dok-gestaltung')).toContainText('#FFB000');
  expect(fehler).toEqual([]);
});

test('Startinterview: Seite E0-gestaltung mit Logo und Primärfarbe, überspringbar', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('gestaltung-e0.aims.json'));
  await page.goto(`${page.url().split('#')[0]}#/gefuehrt/E0/E0-gestaltung`);
  await expect(page.locator('#gestaltung-kurz')).toBeVisible();
  await page.setInputFiles('#gestaltung-datei', datei('e0.png', pngMitText()));
  await expect(page.locator('#gestaltung-logo-bild')).toBeVisible();
  await expect(page.locator('#gestaltung-vorschlaege button')).toHaveCount(2);
  await page.locator('#gestaltung-vorschlaege button').first().click();
  await expect(page.locator('#gestaltung-farbe-primaer')).toHaveValue(/^#1C5D9/);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
  await page.click('#gestaltung-alle');
  await expect(page).toHaveURL(/#\/einstellungen\/gestaltung$/);
  expect(fehler).toEqual([]);
});
