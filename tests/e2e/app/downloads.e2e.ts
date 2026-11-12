// Dokumente und Downloads:
// jeder Weg, auf dem der AIMS-Manager eine Datei anbietet, mit Doppelklick ausgelöst. Geprüft werden Name, MIME-Typ, Inhalt
// (ZIP-Signatur, gültiges OOXML, unzip -t, keine leeren oder doppelten Dateien), offene Platzhalter und Kit-Bezug (G8) auch
// in docProps, Sprache und Pfad, genau eine Datei je Auslösung. In Chromium wandelt LibreOffice (lokal) jede DOCX und XLSX
// nach PDF. Drei Engines; die Sets der übrigen Varianten nur in Chromium (Laufzeit).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test, beantworteRueckfragen } from './app-hilfen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { waehle } from '../auswahl-hilfen.ts';
import { HTML, ORDNER, fixtureDatei, oeffne, starte } from './app-hilfen.ts';
import { leeresProjekt } from '../../../src/model/neu.ts';
import { LIBREOFFICE, MIME, blobsAufzeichnen, lade, libreOffice, pruefeName, pruefeOoxml, pruefeZip, type Geladen } from './download-pruefung.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1440, height: 900 }, acceptDownloads: true });

const MUSTER = join(REPO, 'src/beispiele/muster-maschinenbau.de.aims.json');
const PRAEZISION = join(REPO, 'src/beispiele/praezisionsteile.de.aims.json');
const ZIEL = join(ORDNER, 'downloads');
const geh = async (page: Page, hash: string) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await expect(page.locator('main h1').first()).toBeVisible();
};

function leer(mitIsms: boolean, name = ''): string {
  const p = leeresProjekt({ mitIsms });
  p.organisation.name = name;
  const datei = join(ORDNER, `${test.info().project.name}-${test.info().testId}-leer-${mitIsms}.aims.json`);
  writeFileSync(datei, JSON.stringify(p, null, 2));
  return datei;
}

async function mitProjekt(page: Page, datei: string): Promise<string[]> {
  await blobsAufzeichnen(page);
  await beantworteRueckfragen(page, true);
  const { fehler } = await starte(page);
  await oeffne(page, datei);
  return fehler;
}

/** Gesamtset prüfen: ZIP, Inhalt je OOXML, Pfad mit/ohne ISMS, Sprache über den Titel von D-01 */
async function setPruefen(page: Page, sprache: 'de' | 'en', mitIsms: boolean, mitLibreOffice: boolean): Promise<Geladen> {
  await geh(page, '#/dokumente');
  if (sprache === 'en') await waehle(page.locator('#dok-sprache'), 'en');
  const g = await lade(page, () => page.locator('#set-erzeugen').dblclick(), ZIEL, 180_000);
  pruefeName(g, 'zip');
  expect(g.name).toMatch(new RegExp(`_AIMS-${sprache.toUpperCase()}\\.zip$|^AIMS-${sprache.toUpperCase()}\\.zip$`));
  expect(g.typ).toBe(MIME['zip']);
  const z = pruefeZip(g);
  // SETS_ABLEGEN=<Ordner>: ZIP je Variante für die zweiten Prüfer (wordcraft-cli, gridcraft-cli) aufbewahren
  const ablage = process.env['SETS_ABLEGEN'];
  if (ablage) {
    mkdirSync(ablage, { recursive: true });
    writeFileSync(join(ablage, `${test.info().title.replace(/^Set /, '').replace(/:.*$/, '').replace(/[^\w-]+/g, '_')}.zip`), g.daten);
  }
  const office = z.namen.filter((n) => /\.(docx|xlsx)$/.test(n));
  expect(office.length).toBeGreaterThan(20);
  const titel: Record<string, string> = {};
  for (const n of office) titel[n] = pruefeOoxml(z.dateien[n]!, n).titel;
  // Pfad: mit ISMS die Ergänzungsblätter (-EB), ohne ISMS keine
  expect(z.namen.some((n) => /-EB[_.]/.test(n)), 'Ergänzungsblätter nur mit ISMS').toBe(mitIsms);
  // Sprache: Titel von D-01 im Dokument
  const d01 = office.find((n) => n.startsWith('D-01'))!;
  expect(titel[d01], 'Sprache D-01').toMatch(sprache === 'de' ? /Kontext/ : /Context/);
  expect(z.namen.filter((n) => n.endsWith('.drawio')).every((n) => !/kmu-cio/i.test(Buffer.from(z.dateien[n]!).toString('utf8')))).toBe(true);
  if (mitLibreOffice && LIBREOFFICE) expect(libreOffice(z.dateien, join(ZIEL, `lo-${test.info().testId}`)), 'LibreOffice ohne PDF').toEqual([]);
  // Ein zweiter Lauf liefert wieder eine ganze Datei derselben Art
  const g2 = await lade(page, () => page.locator('#set-erzeugen').click(), ZIEL, 180_000);
  expect(g2.name).toBe(g.name);
  expect(pruefeZip(g2).namen).toEqual(z.namen);
  return g;
}

test.describe('Gesamtset als ZIP', () => {
  const VARIANTEN: [string, () => string, 'de' | 'en', boolean, boolean][] = [
    ['Muster DE (mit ISMS)', () => MUSTER, 'de', true, true],
    ['leer ohne ISMS EN', () => leer(false), 'en', false, true],
    ['Muster EN (mit ISMS)', () => MUSTER, 'en', true, false],
    ['Präzisionsteile DE (ohne ISMS)', () => PRAEZISION, 'de', false, false],
    ['Präzisionsteile EN (ohne ISMS)', () => PRAEZISION, 'en', false, false],
    ['leer mit ISMS DE', () => leer(true), 'de', true, false],
  ];
  for (const [name, datei, sprache, mitIsms, alleEngines] of VARIANTEN) {
    test(`Set ${name}: ZIP, OOXML, Platzhalter, G8, Pfad, Sprache, LibreOffice`, async ({ page, browserName }) => {
      test.skip(!alleEngines && browserName !== 'chromium', 'weitere Varianten nur in Chromium');
      test.setTimeout(600_000);
      const fehler = await mitProjekt(page, datei());
      await setPruefen(page, sprache, mitIsms, browserName === 'chromium');
      expect(fehler).toEqual([]);
    });
  }

  test('Projekt ohne Namen: ZIP-Name ohne doppeltes «AIMS»', async ({ page }) => {
    const fehler = await mitProjekt(page, leer(false));
    await geh(page, '#/dokumente');
    const g = await lade(page, () => page.locator('#set-erzeugen').click(), ZIEL);
    expect(g.name).toBe('AIMS-DE.zip');
    expect(fehler).toEqual([]);
  });
});

test('Einzeldokumente aus «Dokumente»: DOCX und XLSX mit passendem MIME-Typ, Doppelklick ergibt eine Datei', async ({ page }) => {
  test.setTimeout(180_000);
  const fehler = await mitProjekt(page, fixtureDatei('dl-einzeln.aims.json'));
  await geh(page, '#/dokumente');
  for (const [zeile, endung] of [['D-01', 'docx'], ['D-07', 'xlsx']] as const) {
    const knopf = page.locator('tr', { has: page.locator('.marke-id', { hasText: new RegExp(`^${zeile}$`) }) }).getByRole('button', { name: /herunterladen/i });
    const g = await lade(page, () => knopf.dblclick(), ZIEL);
    pruefeName(g, endung);
    expect(g.typ, `${zeile} MIME`).toBe(MIME[endung]);
    pruefeOoxml(g.daten, g.name);
  }
  expect(fehler).toEqual([]);
});

test('Weitere Downloads: Projekt, Fragebogen, Prozessbeschreibung, draw.io, Gestaltung, Schriftlizenz', async ({ page }) => {
  test.setTimeout(240_000);
  const fehler = await mitProjekt(page, fixtureDatei('dl-weitere.aims.json', false, (p) => { p.organisation.gestaltung = { kurzname: 'MB' }; }));
  // Projekt speichern
  const projekt = await lade(page, () => page.locator('#speichern').dblclick(), ZIEL);
  pruefeName(projekt, 'aims.json');
  expect(projekt.typ).toBe(MIME['json']);
  expect((JSON.parse(projekt.daten.toString('utf8')) as { schemaVersion: number }).schemaVersion).toBeGreaterThan(0);
  // Fragebogen (Guide E4)
  await geh(page, '#/gefuehrt/E4/E4-fragebogen');
  const fb = await lade(page, () => page.locator('#fragebogen-export').dblclick(), ZIEL);
  pruefeName(fb, 'xlsx');
  expect(fb.typ).toBe(MIME['xlsx']);
  pruefeOoxml(fb.daten, fb.name);
  // Prozessbeschreibung und draw.io (Prozesse)
  await geh(page, '#/prozesse/PR-08');
  const pb = await lade(page, () => page.locator('#pz-PR-08-beschreibung-docx').dblclick(), ZIEL);
  pruefeName(pb, 'docx');
  expect(pb.typ).toBe(MIME['docx']);
  pruefeOoxml(pb.daten, pb.name);
  const dio = await lade(page, () => page.locator('#pz-PR-08-drawio-export').dblclick(), ZIEL);
  pruefeName(dio, 'drawio');
  expect(dio.typ).toBe(MIME['drawio']);
  expect(dio.daten.toString('utf8')).toMatch(/^<mxfile /);
  await geh(page, '#/prozesse');
  const alle = await lade(page, () => page.locator('#prozesse-drawio-export').dblclick(), ZIEL);
  pruefeName(alle, 'drawio');
  expect(alle.daten.toString('utf8')).not.toMatch(/kmu-cio/i);
  // Gestaltung: Muster Word und Excel
  await geh(page, '#/einstellungen/gestaltung');
  for (const [id, endung] of [['#gestaltung-muster-word', 'docx'], ['#gestaltung-muster-excel', 'xlsx']] as const) {
    const g = await lade(page, () => page.locator(id).dblclick(), ZIEL);
    pruefeName(g, endung);
    expect(g.typ).toBe(MIME[endung]);
    pruefeOoxml(g.daten, g.name);
  }
  // Gestaltungspaket (Nacharbeit N1)
  const paket = await lade(page, () => page.locator('#gestaltung-exportieren').dblclick(), ZIEL);
  pruefeName(paket, 'json');
  expect(paket.typ).toBe(MIME['json']);
  expect((JSON.parse(paket.daten.toString('utf8')) as { art: string }).art).toBe('aims-gestaltung');
  // Schriftlizenz (Über)
  await geh(page, '#/ueber');
  const lizenz = await lade(page, () => page.getByRole('button', { name: /Lizenz/ }).first().dblclick(), ZIEL);
  pruefeName(lizenz, 'txt');
  expect(lizenz.typ).toMatch(/^text\/plain/);
  expect(fehler).toEqual([]);
});

test('Bibliothek im Browserspeicher: Firmendokumente erzeugen, Version und Vorlage herunterladen, Sicherung als ZIP', async ({ page }) => {
  test.setTimeout(240_000);
  const fehler = await mitProjekt(page, fixtureDatei('dl-bib.aims.json'));
  await page.evaluate(() => (location.hash = '#/bibliothek/firma'));
  await page.click('#bib-browser');
  await expect(page.locator('#bib-verbindung')).toContainText(/Browserspeicher/);
  await page.click('#bib-erzeugen');
  await expect(page.locator('#meldung')).toContainText(/Neue Versionen/, { timeout: 120_000 });
  await page.locator('.bib-tabelle a[href$="/D-01"]').click();
  const v = await lade(page, () => page.locator('#bib-herunterladen').dblclick(), ZIEL);
  pruefeName(v, 'docx');
  expect(v.typ).toBe(MIME['docx']);
  pruefeOoxml(v.daten, v.name);
  await page.evaluate(() => (location.hash = '#/bibliothek/vorlagen'));
  await page.locator('.bib-tabelle a', { hasText: /Kontext/ }).first().click();
  const vorlage = await lade(page, () => page.locator('#bib-vorlage').dblclick(), ZIEL);
  pruefeName(vorlage, 'docx');
  expect(vorlage.typ).toBe(MIME['docx']);
  pruefeOoxml(vorlage.daten, vorlage.name, true);
  const sicherung = await lade(page, () => page.locator('#bib-sichern').dblclick(), ZIEL);
  pruefeName(sicherung, 'zip');
  expect(sicherung.typ).toBe(MIME['zip']);
  const z = pruefeZip(sicherung);
  expect(z.namen.some((n) => n.startsWith('Firmendokumente/'))).toBe(true);
  expect(fehler).toEqual([]);
});

// Druckansicht je Ansicht: nichts abgeschnitten, kein waagrechter Überlauf, alle Zeilen virtualisierter Listen, keine
// Bedienelemente, Tabellenzeilen ohne Umbruch mitten durch; in Chromium zusätzlich page.pdf mit Text.
test.describe('Druck je Ansicht', () => {
  test.use({ viewport: { width: 794, height: 1123 } });
  const ANSICHTEN = ['#/formular/risiken', '#/formular/inventar', '#/formular/massnahmen', '#/formular/soa', '#/formular/uebersicht', '#/pruefung', '#/bibliothek', '#/gefuehrt/E6/E6-register', '#/uebersicht/faellig', '#/wissen'];
  test('Druck: kein Überlauf, keine Bedienelemente, alle Zeilen, Zeilen nicht geteilt', async ({ page, browserName }) => {
    test.setTimeout(240_000);
    const fehler = await mitProjekt(page, MUSTER);
    const muster = JSON.parse(readFileSync(MUSTER, 'utf8')) as Record<string, unknown[]>;
    const falsch: string[] = [];
    for (const h of ANSICHTEN) {
      await page.emulateMedia({ media: 'screen' });
      await geh(page, h);
      await page.emulateMedia({ media: 'print' });
      await page.waitForTimeout(200);
      const b = await page.evaluate(() => {
        const sichtbar = (e: Element) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
        const breit = document.documentElement.clientWidth;
        const ueber = [...document.querySelectorAll('main *')].filter((e) => sichtbar(e) && e.getBoundingClientRect().right > breit + 1 && !e.closest('[data-rollbereich], .tabelle-feld')).map((e) => e.tagName + (e.id ? `#${e.id}` : '')).slice(0, 3);
        const bedien = [...document.querySelectorAll('main button:not(.glossar):not(.auswahl), main .knopf, main input:not([type=hidden]), main textarea')].filter(sichtbar).map((e) => e.id || e.textContent?.trim().slice(0, 20)).slice(0, 3);
        const zeilen = [...document.querySelectorAll('main tr, main .vliste .zeile')].filter((e) => sichtbar(e) && !['avoid', 'avoid-page'].includes(getComputedStyle(e).breakInside)).length;
        // eingeklappte Abschnitte als leere Zeile mit Pfeil; doppeltes Wort im Status («angenommen · angenommen von»)
        const zu = [...document.querySelectorAll('main details:not([open])')].filter(sichtbar).length;
        const doppelt = /angenommen · angenommen|accepted · accepted/.test(document.querySelector('main')?.textContent ?? '');
        return { ueber, bedien, zeilen, zu, doppelt, vliste: document.querySelectorAll('main .vliste .zeile').length, seite: document.documentElement.scrollWidth - breit };
      });
      if (b.seite > 1) falsch.push(`${h}: Seite ${b.seite} px breiter`);
      if (b.ueber.length) falsch.push(`${h}: Überlauf ${b.ueber.join(', ')}`);
      if (b.bedien.length) falsch.push(`${h}: Bedienelemente ${b.bedien.join(', ')}`);
      if (b.zeilen) falsch.push(`${h}: ${b.zeilen} Zeilen ohne break-inside: avoid`);
      if (b.zu) falsch.push(`${h}: ${b.zu} eingeklappte Abschnitte im Ausdruck`);
      if (b.doppelt) falsch.push(`${h}: Status mit doppeltem «angenommen»`);
      const liste = h === '#/formular/risiken' ? 'risiken' : h === '#/formular/inventar' ? 'kiSysteme' : h === '#/formular/massnahmen' ? 'massnahmen' : null;
      if (liste && b.vliste !== muster[liste]!.length) falsch.push(`${h}: ${b.vliste} von ${muster[liste]!.length} Zeilen`);
      if (browserName === 'chromium') {
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        if (pdf.length < 2000) falsch.push(`${h}: PDF leer`);
      }
    }
    expect(falsch).toEqual([]);
    expect(fehler).toEqual([]);
  });
});

// B12 (Prüfung Designsystem, V-14): Fuss des Stage-1-Berichts «Organisation · Stand» auf jeder Druckseite, auch in Firefox
// und WebKit (ohne @page-Randfelder: wiederholte Tabellenfusszeile), ohne Kit-Bezug (G8). Chromium: Randfelder mit Seitenzahl.
test('B12: Stage-1-Bericht druckt den Fuss in jeder Engine, ohne Kit-Bezug', async ({ page, browserName }) => {
  const fehler = await mitProjekt(page, MUSTER);
  await page.evaluate(() => { (window as unknown as { gedruckt: number }).gedruckt = 0; window.print = () => void ((window as unknown as { gedruckt: number }).gedruckt += 1); });
  await geh(page, '#/pruefung/stage1');
  await page.click('#stage1-drucken');
  expect(await page.evaluate(() => (window as unknown as { gedruckt: number }).gedruckt)).toBe(1);
  await page.emulateMedia({ media: 'print' });
  const regel = await page.evaluate(() => [...document.styleSheets].flatMap((s) => [...s.cssRules]).map((r) => r.cssText).find((t) => t.includes('@bottom-left')) ?? '');
  const fuss = page.locator('#druck-bericht #druck-fuss');
  if (regel) {
    expect(browserName).toBe('chromium');
    expect(regel).toContain('Muster Maschinenbau AG · Stand');
    expect(regel).toContain('counter(pages)');
    expect(regel).not.toMatch(/kmu-cio|Starter/i);
    await expect(fuss).toHaveCount(0);
  } else {
    await expect(fuss).toBeVisible();
    await expect(fuss).toHaveText(/^Muster Maschinenbau AG · Stand \d\d\.\d\d\.\d{4}$/);
    expect(await fuss.evaluate((e) => getComputedStyle(e.closest('tfoot')!).display)).toBe('table-footer-group');
  }
  await expect(page.locator('#druck-bericht .s1-bericht')).toBeVisible();
  await expect(page.locator('main')).toBeHidden();
  expect(fehler).toEqual([]);
});

// B13 (V-14): Druck in Schwarzweiss lesbar. Jeder Status im Ausdruck hat ein Wort und eine Form (Symbol vor dem Wort), und das
// Wort hält in Graustufen 4,5:1 auf dem Pillengrund und auf Weiss (falls der Drucker Hintergründe weglässt).
test('B13: Ausdruck in Schwarzweiss lesbar: Status mit Wort und Form, Kontrast in Graustufen', async ({ page }) => {
  const fehler = await mitProjekt(page, MUSTER);
  const falsch: string[] = [];
  for (const h of ['#/formular/risiken', '#/formular/massnahmen', '#/formular/soa', '#/pruefung', '#/uebersicht/faellig']) {
    await page.emulateMedia({ media: 'screen' });
    await geh(page, h);
    await page.emulateMedia({ media: 'print' });
    const r = await page.evaluate(() => {
      const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = (c: string) => { const [r, g, b] = rgb(c).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
      const kontrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x! + 0.05) / (y! + 0.05); };
      return [...document.querySelectorAll('main .pille')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => {
        const s = getComputedStyle(e);
        const vor = getComputedStyle(e, '::before');
        return { wort: (e.textContent ?? '').trim(), form: vor.content !== 'none' && parseFloat(vor.width) >= 6, grund: kontrast(s.color, s.backgroundColor), weiss: kontrast(s.color, 'rgb(255, 255, 255)') };
      });
    });
    if (!r.length && h === '#/formular/risiken') falsch.push(`${h}: keine Pillen`);
    for (const p of r) {
      if (!p.wort) falsch.push(`${h}: Pille ohne Wort`);
      if (!p.form) falsch.push(`${h}: «${p.wort}» ohne Form`);
      if (p.grund < 4.5 || p.weiss < 4.5) falsch.push(`${h}: «${p.wort}» ${p.grund.toFixed(2)} / ${p.weiss.toFixed(2)}`);
    }
  }
  expect([...new Set(falsch)]).toEqual([]);
  expect(fehler).toEqual([]);
});
