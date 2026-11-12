// Soll-Ist-Abgleich der Darstellung gegen den Gestaltungsentwurf: Abnahmetests
// der Befunde A-01 bis A-06, A-08, A-09 und A-11 (hoch und mittel, dazu tiefe mit wenig Aufwand). Werte aus dem DOM bzw. aus
// dem PDF-Text jeder Seite, nicht aus dem Code.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, ORDNER, beantworteRueckfragen, oeffne, starte, test, waehleTheme } from './app-hilfen.ts';
import { waehle } from '../auswahl-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', acceptDownloads: true });

const MUSTER = join(REPO, 'src/beispiele/muster-maschinenbau.de.aims.json');
const geh = async (page: Page, hash: string) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await expect(page.locator('main h1').first()).toBeVisible();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};

/** Text je Seite eines PDF (pdftotext) */
function pdfSeiten(pdf: Buffer, name: string): string[] {
  const ordner = join(ORDNER, 'pdf-abgleich');
  mkdirSync(ordner, { recursive: true });
  const datei = join(ordner, `${test.info().testId}-${name}.pdf`);
  writeFileSync(datei, pdf);
  const n = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [datei], { encoding: 'utf8' }))?.[1] ?? 0);
  return Array.from({ length: n }, (_, i) => execFileSync('pdftotext', ['-f', String(i + 1), '-l', String(i + 1), '-layout', datei, '-'], { encoding: 'utf8' }));
}

const ROUTEN = ['#/start', '#/formular/uebersicht', '#/bibliothek', '#/pruefung', '#/formular/risiken', '#/formular/inventar', '#/uebersicht', '#/prozesse', '#/dokumente', '#/einstellungen'];

test.describe('A-01: Seitenkopf einzeilig', () => {
  for (const [breite, hoehe] of [[1440, 900], [1280, 720]] as const) {
    test(`${breite} × ${hoehe}: Kopf höchstens 64 px, Einleitung und Projektzeile darunter`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Masse in Chromium');
      await page.setViewportSize({ width: breite, height: hoehe });
      const { fehler } = await starte(page);
      await oeffne(page, MUSTER);
      const falsch: string[] = [];
      for (const r of ROUTEN) {
        await geh(page, r);
        const kopf = page.locator('main .seitenkopf').first();
        const h = Math.round((await kopf.boundingBox())!.height);
        if (h > 64) falsch.push(`${r}: ${h} px`);
        for (const sel of ['.start-projekt', '.bib-hochladen-hinweis', 'p.kontext', 'p.zweitext']) {
          if (await kopf.locator(sel).count()) falsch.push(`${r}: ${sel} im Kopf`);
        }
      }
      expect(falsch).toEqual([]);
      expect(fehler).toEqual([]);
    });
  }
});

test('A-02: Guide bei 1440 mit offener Hilfe: Kopf über die ganze Breite, «Weiter» in der Zeile der H1', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Masse in Chromium');
  await page.setViewportSize({ width: 1440, height: 900 });
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  const falsch: string[] = [];
  for (const thema of ['dunkel', 'hell'] as const) {
    await waehleTheme(page, thema);
    for (const r of ['#/gefuehrt/E4/E4-systeme', '#/gefuehrt/E8/E8-behandlung']) {
      await geh(page, r);
      await expect(page.locator('#hilfe-umschalten')).toHaveAttribute('aria-expanded', 'true');
      const kopf = (await page.locator('main .seitenkopf').boundingBox())!;
      const h1 = (await page.locator('main .seitenkopf h1').boundingBox())!;
      const weiter = (await page.locator('#kopf-weiter').boundingBox())!;
      const hilfe = (await page.locator('.hilfe-spalte').boundingBox())!;
      if (Math.round(kopf.height) > 64) falsch.push(`${thema} ${r}: Kopf ${Math.round(kopf.height)} px`);
      if (Math.abs(weiter.y - h1.y) > 16) falsch.push(`${thema} ${r}: «Weiter» ${Math.round(weiter.y - h1.y)} px von der H1`);
      if (hilfe.y < kopf.y + kopf.height) falsch.push(`${thema} ${r}: Hilfe beginnt bei ${Math.round(hilfe.y)}, Kopf endet bei ${Math.round(kopf.y + kopf.height)}`);
    }
  }
  expect(falsch).toEqual([]);
  expect(fehler).toEqual([]);
});

for (const sprache of ['de', 'en'] as const) test(`A-03 ${sprache}: Telefon-Kartenliste der Risiken ohne gekürzten Status und Wert, Pillen ganz sichtbar`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { fehler } = await starte(page);
  await oeffne(page, sprache === 'de' ? MUSTER : MUSTER.replace('.de.', '.en.'));
  await geh(page, '#/formular/risiken');
  const karten = page.locator('.vliste.karten .zeile');
  await expect(karten.first()).toBeVisible();
  const falsch = await page.evaluate(() => {
    const aus: string[] = [];
    for (const k of document.querySelectorAll<HTMLElement>('.vliste.karten .zeile')) {
      const rk = k.getBoundingClientRect();
      if (rk.bottom > (k.closest('.vliste')?.getBoundingClientRect().bottom ?? Infinity)) continue;
      for (const t of k.querySelectorAll<HTMLElement>('.k-unter, .k-status')) {
        if (t.scrollWidth > t.clientWidth + 1) aus.push(`${k.textContent?.slice(0, 20)}: ${t.className} gekürzt`);
        const r = t.getBoundingClientRect();
        if (r.bottom > rk.bottom + 0.5) aus.push(`${k.textContent?.slice(0, 20)}: ${t.className} unten abgeschnitten`);
      }
      // Titel nicht gestaucht: er endet über der Unterzeile
      const titel = k.querySelector<HTMLElement>('.k-titel')?.getBoundingClientRect();
      const unter = k.querySelector<HTMLElement>('.k-unter')?.getBoundingClientRect();
      if (titel && unter && titel.bottom > unter.top + 0.5) aus.push(`${k.textContent?.slice(0, 20)}: Titel überlappt die Unterzeile`);
      for (const p of k.querySelectorAll<HTMLElement>('.pille')) {
        const r = p.getBoundingClientRect();
        if (r.left < rk.left - 0.5 || r.right > rk.right + 0.5 || r.bottom > rk.bottom + 0.5) aus.push(`${k.textContent?.slice(0, 20)}: Pille «${p.textContent}» abgeschnitten`);
      }
    }
    return aus;
  });
  expect(falsch).toEqual([]);
  expect(fehler).toEqual([]);
});

test('A-04: Status im Risikoregister als StatusPille, Person und Datum in der Zeile darunter', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  await geh(page, '#/formular/risiken');
  const zeilen = page.locator('.vliste .zeile');
  await expect(zeilen.first()).toBeVisible();
  const n = await zeilen.count();
  for (let i = 0; i < n; i++) {
    const status = zeilen.nth(i).locator('.zelle').last();
    await expect(status.locator('.pille'), `Zeile ${i + 1}`).toHaveCount(1);
    await expect(status.locator('.pille')).not.toContainText(/von |·/);
  }
  await expect(page.locator('.vliste .status-zusatz').first()).toContainText(/von .+, \d\d\.\d\d\.\d{4}/);
  expect(fehler).toEqual([]);
});

test('A-05: Lagebild im Druck höchstens 2 Seiten A4 quer, ohne Hinweis «führt zum Modul»', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'page.pdf nur in Chromium');
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  await geh(page, '#/formular/uebersicht');
  await page.emulateMedia({ media: 'print' });
  const seiten = pdfSeiten(await page.pdf({ format: 'A4', landscape: true, printBackground: true }), 'lagebild');
  expect(seiten.length).toBeLessThanOrEqual(2);
  expect(seiten.join('\n')).not.toContain('führt zum Modul');
  expect(fehler).toEqual([]);
});

// A-06: Kopf und Fuss mit Organisation, Stand und Seite am erzeugten Ausdruck. Chromium: Text jeder PDF-Seite. Firefox und WebKit
// kennen keine Randfelder: dort die Druckansicht mit festem Kopf und Fuss (Organisation und Stand, ohne Seitenzahl).
test('A-06: Risikoregister, Lagebild und Stage-1-Bericht mit Kopf und Fuss, ohne Kit-Bezug', async ({ page, browserName }) => {
  test.setTimeout(120_000);
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  const falsch: string[] = [];
  const KIT = /AIMS-Manager|Starter-Kit|KMU-CIO/i;
  for (const [r, quer] of [['#/formular/risiken', false], ['#/formular/uebersicht', true], ['#/pruefung/stage1', false]] as const) {
    await page.emulateMedia({ media: 'screen' });
    await geh(page, r);
    if (r === '#/pruefung/stage1') {
      await page.evaluate(() => { window.print = () => undefined; });
      await page.click('#stage1-drucken');
    }
    await page.emulateMedia({ media: 'print' });
    if (browserName === 'chromium') {
      const pdf = await page.pdf({ format: 'A4', landscape: quer, printBackground: true });
      const seiten = pdfSeiten(pdf, r.replace(/\W/g, '_'));
      // A-07: Kopf und Fuss in Inter, keine Serifenschrift im Ausdruck
      const datei = join(ORDNER, 'pdf-abgleich', `${test.info().testId}-${r.replace(/\W/g, '_')}.pdf`);
      const schriften = execFileSync('pdffonts', [datei], { encoding: 'utf8' }).split('\n').slice(2).map((z) => z.split(/\s+/)[0] ?? '').filter(Boolean);
      const serif = schriften.filter((x) => /serif/i.test(x) && !/sans/i.test(x));
      if (serif.length) falsch.push(`${r}: Serifenschrift ${serif.join(', ')}`);
      seiten.forEach((s, i) => {
        if (!/Muster Maschinenbau AG · Stand \d\d\.\d\d\.\d{4}/.test(s)) falsch.push(`${r} Seite ${i + 1}: ohne «Organisation · Stand»`);
        if (!new RegExp(`Seite ${i + 1} / ${seiten.length}`).test(s)) falsch.push(`${r} Seite ${i + 1}: ohne «Seite ${i + 1} / ${seiten.length}»`);
        if (KIT.test(s)) falsch.push(`${r} Seite ${i + 1}: Kit-Bezug`);
      });
    } else {
      // V-22: der Ersatzfuss nennt links Organisation und Stand, rechts den Ausdruck (ohne Seitenzahl)
      const fuss = r === '#/pruefung/stage1' ? page.locator('#druck-bericht #druck-fuss') : page.locator('.druck-fuss-fest > span').first();
      await expect(fuss, r).toBeVisible();
      await expect(fuss, r).toHaveText(/^Muster Maschinenbau AG · Stand \d\d\.\d\d\.\d{4}$/);
      if (r !== '#/pruefung/stage1') {
        // Kopf und Fuss als Tabellenkopf und -fuss um die Ansicht: die Engines wiederholen sie je Seite und lassen Platz (N4)
        await expect(page.locator('.druck-kopf-fest'), r).toBeVisible();
        await expect(page.locator('.druck-kopf-fest'), r).toContainText(/^Muster Maschinenbau AG\s*Stand \d\d\.\d\d\.\d{4}$/);
        expect(await page.locator('.druck-rahmen-kopf').evaluate((e) => getComputedStyle(e).display), r).toBe('table-header-group');
        expect(await page.locator('.druck-rahmen-fuss').evaluate((e) => getComputedStyle(e).display), r).toBe('table-footer-group');
        expect(await page.locator('main .druck-rahmen-inhalt h1').count(), r).toBe(1);
      }
      const text = await page.evaluate(() => document.body.innerText);
      if (KIT.test(text.replace(/kmu-cio\.ch/gi, ''))) falsch.push(`${r}: Kit-Bezug in der Druckansicht`);
    }
    if (r === '#/pruefung/stage1') await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  }
  expect(falsch).toEqual([]);
  expect(fehler).toEqual([]);
});

test('A-08: Freigabe in der Bibliothek mit vorbelegten Personen in drei Schritten; gleiche Person zeigt den Fehler am Feld', async ({ page }) => {
  test.setTimeout(120_000);
  await beantworteRueckfragen(page, true);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  await geh(page, '#/bibliothek/alle');
  await page.click('#bib-browser');
  await expect(page.locator('#bib-verbindung')).toContainText(/Browserspeicher|browser storage/);
  await page.click('#bib-erzeugen');
  await expect(page.locator('.bib-tabelle tbody tr').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#bib-erzeugen')).toBeEnabled({ timeout: 60_000 });
  await geh(page, '#/bibliothek/alle/D-07');
  await expect(page.locator('#bib-detail')).toContainText('D-07');
  // Drei Klicks ab dem Detail: zur Prüfung, «Freigeben …», «Freigeben»
  await page.click('#bib-status-in-pruefung');
  await page.click('#bib-status-freigegeben');
  const gp = await page.locator('#bib-gp-von').getAttribute('data-wert');
  const fg = await page.locator('#bib-fg-von').getAttribute('data-wert');
  expect(gp, 'Geprüft durch vorbelegt').toMatch(/^P-\d{3}$/);
  expect(fg, 'Freigegeben durch vorbelegt').toMatch(/^P-\d{3}$/);
  expect(gp).not.toBe(fg);
  // Gleiche Person: Fehler am Feld, bevor freigegeben wird
  await waehle(page.locator('#bib-fg-von'), gp!);
  await expect(page.locator('#bib-fg-gleich')).toContainText(/zwei verschiedene Personen/);
  await expect(page.locator('#bib-fg-von')).toHaveAttribute('aria-invalid', 'true');
  await waehle(page.locator('#bib-fg-von'), fg!);
  await expect(page.locator('#bib-fg-gleich')).toHaveText('');
  await expect(page.locator('#bib-fg-von')).not.toHaveAttribute('aria-invalid', 'true');
  await page.click('#bib-freigabe-ok');
  await expect(page.locator('#bib-detail dl')).toContainText(/Freigegeben/);
  expect(fehler).toEqual([]);
});

test('A-09: Bibliothek mit offenem Detail: Spalte «Dokument» mindestens 240 px, Zeilen höchstens 72 px', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  await geh(page, '#/bibliothek');
  const erste = page.locator('.bib-tabelle a.bib-titel').first();
  await expect(erste).toBeVisible();
  await erste.click();
  await expect(page.locator('.bib-raster.mit-detail')).toBeVisible();
  const breite = (await page.locator('.bib-tabelle th').first().boundingBox())!.width;
  expect(breite).toBeGreaterThanOrEqual(240);
  const hoehen = await page.locator('.bib-tabelle tbody tr').evaluateAll((z) => z.map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(hoehen.filter((h) => h > 72)).toEqual([]);
  expect(fehler).toEqual([]);
});

test('A-11: Abdunklung hinter Dialogen wie --abdunkeln, in Dunkel und Hell', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  for (const [thema, soll] of [['dunkel', 'rgba(10, 12, 20, 0.6)'], ['hell', 'rgba(26, 31, 44, 0.45)']] as const) {
    await waehleTheme(page, thema);
    const wert = await page.evaluate(() => {
      const d = document.createElement('dialog');
      document.body.appendChild(d);
      d.showModal();
      const w = getComputedStyle(d, '::backdrop').backgroundColor;
      d.close();
      d.remove();
      return w;
    });
    expect(wert, thema).toBe(soll);
  }
  expect(fehler).toEqual([]);
});
