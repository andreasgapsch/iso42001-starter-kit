// A-20 und A-17 Rest: Lagebild im Druck von Firefox als PDF.
// Playwright kann in Firefox kein page.pdf. Gewählt ist der stille Druck von Firefox selbst («Mozilla Save to PDF»,
// print.always_print_silent, Druck in eine Datei) über dieselbe Playwright-Firefox-Engine wie alle E2E. So entsteht das PDF aus
// dem Seitenaufbau von Firefox (Umbruch, @page, Tabellenkopf und -fuss), nicht aus einer Emulation; es braucht keine neue
// Abhängigkeit und läuft headless. Papier A4 quer, Kopf- und Fusszeilen des Browsers leer (wie mit ausgeschalteter Einstellung).
// Die Einstellungen gelten für die ganze Datei (eigener Worker); in Chromium und WebKit ist der Test übersprungen.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
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

const FF_PDF = join(ORDNER, 'firefox-druck', 'lagebild-firefox.pdf');
const ffPrefs: Record<string, string | number | boolean> = {
  'print.always_print_silent': true, 'print.show_print_progress': false, print_printer: 'Mozilla Save to PDF',
  'print.printer_Mozilla_Save_to_PDF.print_to_file': true, 'print.printer_Mozilla_Save_to_PDF.print_to_filename': FF_PDF,
  'print.print_to_file': true, 'print.print_to_filename': FF_PDF,
  'print.printer_Mozilla_Save_to_PDF.print_orientation': 1,
  'print.printer_Mozilla_Save_to_PDF.print_paper_id': 'iso_a4', 'print.printer_Mozilla_Save_to_PDF.print_paper_size_unit': 1,
  'print.printer_Mozilla_Save_to_PDF.print_paper_width': '210.0', 'print.printer_Mozilla_Save_to_PDF.print_paper_height': '297.0',
  'print.printer_Mozilla_Save_to_PDF.print_shrink_to_fit': false, 'print.printer_Mozilla_Save_to_PDF.print_scaling': '1.0',
  'print.printer_Mozilla_Save_to_PDF.print_bgcolor': true,
};
for (const k of ['headerleft', 'headercenter', 'headerright', 'footerleft', 'footercenter', 'footerright']) {
  ffPrefs[`print.print_${k}`] = '';
  ffPrefs[`print.printer_Mozilla_Save_to_PDF.print_${k}`] = '';
}

test.use({ launchOptions: { firefoxUserPrefs: ffPrefs } });

// Beide Projektdateien des Musters (DE und EN; Oberfläche Deutsch nach der Browsersprache de-CH)
for (const datei of [MUSTER, MUSTER.replace('.de.', '.en.')]) test(`A-20, A-17 ${datei.includes('.en.') ? 'EN' : 'DE'}: Lagebild im Firefox-Druck (PDF): 2 Seiten A4 quer, Seite 2 beginnt mit den Controls, kein Kartentitel am Seitenende, Ersatzfuss auf jeder Seite, kleinste Schrift 9 pt`, async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Druckausgabe von Firefox');
    test.setTimeout(120_000);
    mkdirSync(join(ORDNER, 'firefox-druck'), { recursive: true });
    rmSync(FF_PDF, { force: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    const { fehler } = await starte(page);
    await oeffne(page, datei);
    await geh(page, '#/formular/uebersicht');
    await page.evaluate(() => window.print());
    await expect.poll(() => existsSync(FF_PDF) && statSync(FF_PDF).size > 10_000, { timeout: 30_000 }).toBe(true);
    await page.waitForTimeout(1500);
    const seiten = seitenText(FF_PDF);
    const groesse = execFileSync('pdfinfo', [FF_PDF], { encoding: 'utf8' });
    expect(groesse, 'A4 quer').toMatch(/Page size:\s+84[12](\.\d+)? x 59[56]/);
    expect(seiten.length).toBe(2);
    // Firefox legt fette Schnitte der variablen Inter als Pfade ab (pdffonts: nur Inter-Regular), Kartentitel sind darum kein
    // Text im PDF. Geprüft wird über Text jeder Karte in normaler Stärke: Steht der erste und der letzte Text einer Karte auf
    // derselben Seite, ist die Karte nicht geteilt und ihr Titel nicht allein am Seitenende (A-17). Das KI-Inventar hat nur
    // fette Zahlen und Köpfe; es folgt im Anhang auf die Controls, bei 2 Seiten also auf Seite 2.
    const KARTEN: [string, RegExp, RegExp, number][] = [
      ['Risikomatrix', /Auswirkung|selten|rare/, /tief: bis \d+, angenommen/, 0],
      ['Massnahmen nach Fälligkeit', /erledigt\s+später/, /überfällig\s+ohne Termin/, 0],
      ['Für die Geschäftsleitung', /Stage-1.Audit der Zertifizierungsstelle/, /Freigabekalender/, 0],
      ['Umsetzung der Controls je Gruppe', /umgesetzt oder wirksam/, /67 %/, 1],
    ];
    for (const [karte, erster, letzter, soll] of KARTEN) {
      const a = seiten.findIndex((x) => erster.test(x));
      const b = seiten.findIndex((x) => letzter.test(x));
      expect([a, b], `${karte}: Seite des ersten und letzten Texts`).toEqual([soll, soll]);
    }
    const inhalt = (s: string) => s.split('\n').map((z) => z.trim()).filter((z) => z && !/^Muster Maschinenbau AG|^Stand \d/.test(z));
    // Seite 2 beginnt mit den Controls (erster Text: Legende der Karte «Umsetzung der Controls je Gruppe»)
    expect(inhalt(seiten[1]!)[0]).toMatch(/^umgesetzt oder wirksam/);
    seiten.forEach((s, i) => expect(s, `Seite ${i + 1}: Ersatzfuss`).toMatch(/Muster Maschinenbau AG · Stand \d\d\.\d\d\.\d{4}/));
    // Kleinste Schrift 9 pt: gemessen an der berechneten Schrift im Druckmodus (12 px = 9 pt)
    await page.emulateMedia({ media: 'print' });
    const klein = await page.locator('.lagebild').evaluate((w) => [...w.querySelectorAll<HTMLElement>('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && e.getBoundingClientRect().width > 0)
      .map((e) => parseFloat(getComputedStyle(e).fontSize)).reduce((a, b) => Math.min(a, b), 99));
    expect(klein).toBeGreaterThanOrEqual(12);
    expect(fehler).toEqual([]);
  });

// A-27: Im Firefox-PDF hat jedes Zeichen eine Textzuordnung (kein U+FFFD), auch
// Doppelpunkt und Bindestrich zwischen Ziffern oder Grossbuchstaben (Inter «calt»); Lagebild, Risikoregister, Stage-1-Bericht
for (const [name, route] of [['Lagebild', '#/formular/uebersicht'], ['Risikoregister', '#/formular/risiken'], ['Stage-1-Bericht', '#/pruefung/stage1']] as const) {
  test(`A-27 ${name}: Firefox-PDF ohne Zeichen ohne Textzuordnung (U+FFFD)`, async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Druckausgabe von Firefox');
    test.setTimeout(120_000);
    mkdirSync(join(ORDNER, 'firefox-druck'), { recursive: true });
    rmSync(FF_PDF, { force: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    const { fehler } = await starte(page);
    await oeffne(page, MUSTER);
    await geh(page, route);
    if (name === 'Stage-1-Bericht') await page.click('#stage1-drucken');
    else await page.evaluate(() => window.print());
    await expect.poll(() => existsSync(FF_PDF) && statSync(FF_PDF).size > 10_000, { timeout: 30_000 }).toBe(true);
    await page.waitForTimeout(1500);
    const text = seitenText(FF_PDF).join('\n');
    expect(text.length).toBeGreaterThan(200);
    expect([...text.matchAll(/.{0,15}\uFFFD.{0,15}/g)].map((m) => m[0])).toEqual([]);
    // Stellen mit Bindestrich zwischen Grossbuchstaben oder Ziffern, die vorher U+FFFD ergaben
    expect(text).toMatch(name === 'Lagebild' ? /KI-Inventar[\s\S]*Stage-1-Audit|Stage-1-Audit[\s\S]*KI-Inventar/ : name === 'Risikoregister' ? /KI-00\d/ : /Stage-1-Audit/);
    expect(fehler).toEqual([]);
  });
}
