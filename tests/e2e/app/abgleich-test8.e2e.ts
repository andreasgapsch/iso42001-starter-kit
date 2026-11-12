// Abnahmetests zum Soll-Ist-Abgleich der Darstellung: A-17 Rest und A-20 (Firefox-Druck
// des Lagebilds als PDF), A-21 (Statuspille im Register), A-22 (Spaltenköpfe der Matrix im Druck), A-23 (Stichtag: Fokus und
// Enter öffnen, Esc schliesst).
//
// A-20 und A-17 Rest (Firefox-PDF): tests/e2e/app/firefox-druck.e2e.ts.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, ORDNER, oeffne, starte, test } from './app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH' });

const MUSTER = join(REPO, 'src/beispiele/muster-maschinenbau.de.aims.json');
const geh = async (page: Page, hash: string) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await expect(page.locator('main h1').first()).toBeVisible();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};
const seitenText = (datei: string) => {
  const n = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [datei], { encoding: 'utf8' }))?.[1] ?? 0);
  return Array.from({ length: n }, (_, i) => execFileSync('pdftotext', ['-f', String(i + 1), '-l', String(i + 1), '-layout', datei, '-'], { encoding: 'utf8' }));
};

for (const sprache of ['de', 'en'] as const) test(`A-21 ${sprache}: Statuspille im Register nie abgeschnitten (900, 1024, 1280, 1440 px)`, async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Masse in Chromium');
  const { fehler } = await starte(page);
  await oeffne(page, sprache === 'de' ? MUSTER : MUSTER.replace('.de.', '.en.'));
  const falsch: string[] = [];
  for (const b of [1440, 1280, 1024, 900]) {
    await page.setViewportSize({ width: b, height: 900 });
    await geh(page, '#/formular/risiken');
    await expect(page.locator('.vliste .zeile .pille').first()).toBeVisible();
    for (const x of await page.locator('.vliste').evaluate((l) => [...l.querySelectorAll<HTMLElement>('.zeile .zelle .pille')].flatMap((p) => {
      const z = p.closest<HTMLElement>('.zelle')!.getBoundingClientRect();
      const r = p.getBoundingClientRect();
      return r.right > z.right + 0.5 || r.left < z.left - 0.5 || r.bottom > z.bottom + 0.5 || p.scrollWidth > p.clientWidth + 1 ? [`${p.textContent} ${Math.round(r.right - z.right)} px`] : [];
    }))) falsch.push(`${b}: ${x}`);
  }
  expect(falsch).toEqual([]);
  expect(fehler).toEqual([]);
});

test('A-22: Spaltenköpfe der Risikomatrix überschneiden sich im Druck nicht', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Masse in Chromium');
  await page.setViewportSize({ width: 1032, height: 700 });
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  await geh(page, '#/formular/uebersicht');
  await page.emulateMedia({ media: 'print' });
  const ueber = await page.evaluate(() => {
    const aus: string[] = [];
    for (const t of document.querySelectorAll('.lagebild .g-matrix table')) {
      const boxen = [...t.querySelectorAll('thead th:not(.g-matrix__ecke)')].flatMap((th) => {
        const r = document.createRange();
        r.selectNodeContents(th);
        return [...r.getClientRects()].filter((x) => x.width > 0).map((x) => ({ th: th.textContent, x }));
      });
      for (let i = 0; i < boxen.length; i++) for (let j = i + 1; j < boxen.length; j++) {
        const a = boxen[i]!, b = boxen[j]!;
        if (a.th === b.th) continue;
        if (a.x.left < b.x.right - 0.5 && b.x.left < a.x.right - 0.5 && a.x.top < b.x.bottom - 0.5 && b.x.top < a.x.bottom - 0.5) aus.push(`${a.th} / ${b.th}`);
      }
    }
    return aus;
  });
  expect(ueber).toEqual([]);
  expect(fehler).toEqual([]);
});

test('A-23: Fokus und Enter öffnen das Stichtag-Popover, Enter schliesst es nicht, Esc schliesst', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  await geh(page, '#/formular/risiken');
  const knopf = page.locator('#kopf-stichtag');
  const pop = page.locator('#kopf-stichtag-erklaerung');
  await knopf.focus();
  await expect(pop).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(pop).toBeVisible();
  await expect(knopf).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(pop).toBeVisible();
  // Leertaste öffnet ebenfalls und schliesst nicht
  await page.keyboard.press('Escape');
  await page.keyboard.press(' ');
  await expect(pop).toBeVisible();
  await page.keyboard.press(' ');
  await expect(pop).toBeVisible();
  // Mausklick schaltet um: Klick daneben schliesst, Klick öffnet, zweiter Klick schliesst
  await page.locator('main h1').click();
  await expect(pop).toBeHidden();
  await knopf.click();
  await expect(pop).toBeVisible();
  await knopf.click();
  await expect(pop).toBeHidden();
  expect(fehler).toEqual([]);
});

test('A-24: Druck von Lagebild und Risikoregister nur mit Inter (keine Ersatzschrift für Pfeile)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'page.pdf nur in Chromium');
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  mkdirSync(join(ORDNER, 'pdf-test9'), { recursive: true });
  for (const [r, quer] of [['#/formular/uebersicht', true], ['#/formular/risiken', false]] as const) {
    await page.emulateMedia({ media: 'screen' });
    await geh(page, r);
    await page.emulateMedia({ media: 'print' });
    const datei = join(ORDNER, 'pdf-test9', `${test.info().testId}-${r.replace(/\W/g, '_')}.pdf`);
    writeFileSync(datei, await page.pdf({ format: 'A4', landscape: quer, printBackground: true }));
    const schriften = execFileSync('pdffonts', [datei], { encoding: 'utf8' }).split('\n').slice(2).map((z) => z.split(/\s+/)[0] ?? '').filter(Boolean);
    expect(schriften.filter((x) => !/Inter/i.test(x)), r).toEqual([]);
  }
  expect(fehler).toEqual([]);
});

// A-25: Register bei 900 bis 1023 px mit offenem Untermenü; kein Titel gekürzt.
// Die Liste ist virtualisiert: der Test scrollt durch alle Zeilen, bis jedes Risiko des Musters einmal gemessen ist (Prüfung test.10 N2).
for (const sprache of ['de', 'en'] as const) test(`A-25 ${sprache}: Bezeichnung im Risikoregister bei 900 und 1023 px ungekürzt, mindestens 160 px breit, alle Zeilen`, async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Masse in Chromium');
  const datei = sprache === 'de' ? MUSTER : MUSTER.replace('.de.', '.en.');
  const risiken = (JSON.parse(readFileSync(datei, 'utf8')) as { risiken: unknown[] }).risiken.length;
  const { fehler } = await starte(page);
  await oeffne(page, datei);
  const falsch: string[] = [];
  for (const b of [900, 1023]) {
    await page.setViewportSize({ width: b, height: 800 });
    await geh(page, '#/formular/risiken');
    await expect(page.locator('#untermenue')).toBeVisible();
    await expect(page.locator('.vliste .zeile').first()).toBeVisible();
    const gesehen = new Map<string, { breite: number; gekuerzt: boolean }>();
    for (let schritt = 0; schritt < 40 && gesehen.size < risiken; schritt++) {
      const r = await page.locator('.vliste').evaluate((l, s) => {
        l.scrollTop = s * l.clientHeight * 0.5;
        return new Promise<{ id: string; breite: number; gekuerzt: boolean }[]>((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok([...l.querySelectorAll<HTMLElement>('.zeile')].flatMap((z) => {
          const c = z.querySelectorAll<HTMLElement>('.zelle');
          const id = c[0]?.querySelector('.marke-id')?.textContent ?? '';
          return id && c[1] ? [{ id, breite: Math.round(c[1].getBoundingClientRect().width), gekuerzt: c[1].scrollHeight > c[1].clientHeight + 1 || c[1].scrollWidth > c[1].clientWidth + 1 }] : [];
        })))));
      }, schritt);
      for (const x of r) gesehen.set(x.id, x);
    }
    if (gesehen.size !== risiken) falsch.push(`${b}: ${gesehen.size} von ${risiken} Zeilen gemessen`);
    for (const [id, x] of gesehen) {
      if (x.breite < 160) falsch.push(`${b}: ${id} Bezeichnung ${x.breite} px`);
      if (x.gekuerzt) falsch.push(`${b}: ${id} gekürzt`);
    }
  }
  expect(falsch).toEqual([]);
  expect(fehler).toEqual([]);
});

// A-25 und A-03 (Prüfung test.10 N1): auf dem Telefon bleibt «KI-System: …» in der Unterzeile der Karte
test('A-25: Telefonkarten im Risikoregister nennen das KI-System mit Beschriftung', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Masse in Chromium');
  await page.setViewportSize({ width: 390, height: 844 });
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  await geh(page, '#/formular/risiken');
  await expect(page.locator('.vliste.karten .k-unter').first()).toBeVisible();
  const system = page.locator('.vliste.karten .k-unter').first().locator('.k-wert', { has: page.locator('.k-label', { hasText: /^KI-System:/ }) });
  await expect(system.locator('.k-label')).toBeVisible();
  await expect(system).toHaveText(/^KI-System:\s*KI-0\d\d$/);
  expect(fehler).toEqual([]);
});
