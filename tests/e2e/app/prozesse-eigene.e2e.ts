// Eigene Prozesse (PE-01 ff.), Prozesslandkarte nach Reife, Bahnen ohne Rolle nach draw.io zuordnen (H61 entfällt) und
// Prozesse im Umfang des internen Audits (D-20, H63) im AIMS-Manager (file://, Chromium, Firefox, WebKit), je mit axe.
// Bildschirmfotos (nur Chromium): /tmp/rc9-bilder/. Voraussetzung: npm run build:app
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test, beantworteRueckfragen } from './app-hilfen.ts';
import type { Projekt } from '../../../src/model/typen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, ORDNER, bereichLink, fixtureDatei, oeffne, starte, untermenueLink, waehleTheme } from './app-hilfen.ts';
import { waehle } from '../auswahl-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true });

const BILDER = '/tmp/rc9-bilder';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function axe(page: Page, ort: string): Promise<string[]> {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((v) => `${ort}: ${v.id} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

/** Bildschirmfoto nur in Chromium (WebKit meldet das Stilelement für Fotos als CSP-Verletzung) */
async function foto(page: Page, name: string): Promise<void> {
  if (test.info().project.name !== 'chromium') return;
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${name}.png`), fullPage: true });
}

const mitProzessen = (p: Projekt) => {
  p.prozesse = [
    { id: 'PR-07', reife: 2, letzteDurchfuehrung: '2026-09-01' },
    { id: 'PR-08', reife: 1, eigner: 'P-001' },
    { id: 'PR-25', reife: 3, eigner: 'P-001' },
    { id: 'PR-26', reife: 4, eigner: 'P-001' },
  ];
};

async function zuProzessen(page: Page, aendern: (p: Projekt) => void = mitProzessen): Promise<string[]> {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('prozesse-eigene.aims.json', false, aendern));
  await bereichLink(page, 'Prozesse').click();
  await expect(page).toHaveURL(/#\/prozesse$/);
  return fehler;
}

test('Eigener Prozess: anlegen, Ablauf ausbauen, Angaben ändern, in Liste und Landkarte, löschen', async ({ page }) => {
  const fehler = await zuProzessen(page);
  const befunde: string[] = [];
  await page.click('#prozesse-eigen-neu');
  const dialog = page.locator('#prozess-neu-dialog');
  await expect(dialog).toBeVisible();
  // Ohne Titel: Fehlermeldung, Dialog bleibt
  await page.click('#prozess-neu-anlegen');
  await expect(dialog.getByRole('alert')).toContainText('Titel');
  befunde.push(...(await axe(page, 'Dialog')));
  await page.fill('#prozess-neu-name', 'Kundenanfragen zu KI beantworten');
  await page.fill('#prozess-neu-zweck', 'Fragen von Kunden zu KI-Funktionen rasch beantworten.');
  await waehle(page.locator('#prozess-neu-gruppe'), 'unterstuetzung');
  await dialog.getByRole('checkbox', { name: 'Fachbereich' }).check();
  await foto(page, 'eigen-dialog');
  await page.click('#prozess-neu-anlegen');
  await expect(page).toHaveURL(/#\/prozesse\/PE-01$/);
  await expect(page.locator('main h1')).toHaveText('PE-01 Kundenanfragen zu KI beantworten');
  await expect(page.locator('.prozess-marken')).toContainText('Eigener Prozess');
  // Ablauf aus Start, erstem Schritt und Ende; Schritt einfügen und Text setzen
  await expect(page.locator('#schritte-PE-01 tbody tr')).toHaveCount(3);
  await page.click('#pz-PE-01-bearbeiten');
  await page.click('#schritt-neu-PE-01-2');
  await expect(page.locator('#schritte-PE-01 tbody tr')).toHaveCount(4);
  const feld = page.getByRole('textbox', { name: 'Schritt 3' });
  await feld.fill('Antwort mit Produktmanagement abstimmen');
  await feld.blur();
  await expect(page.locator('#ablauf-PE-01-figur svg [data-knoten]')).toHaveCount(4);
  await expect(page.locator('#ablauf-PE-01-figur svg')).toContainText('Produktmanagement');
  befunde.push(...(await axe(page, 'Detail bearbeiten')));
  await page.click('#pz-PE-01-bearbeiten');
  await expect(page.locator('#pz-PE-01-zuruecksetzen')).toHaveCount(0);
  // Angaben ändern: Gruppe Kern, Normbezug
  await waehle(page.locator('#pe-PE-01-gruppe'), 'kern');
  await page.fill('#pe-PE-01-norm', '8.1, A.8.3');
  await page.locator('#pe-PE-01-norm').blur();
  await expect(page.locator('.prozess-angaben')).toContainText('ISO/IEC 42001: 8.1, A.8.3');
  await waehle(page.locator('#pz-PE-01-eigner'), 'P-001');
  await foto(page, 'eigen-detail');
  // Liste: Zeile in der Gruppe Kern; Filter «Eigener Prozess»
  await page.click('#prozess-zurueck');
  await expect(page.locator('#prozesse-tabelle-kern tr[data-prozess="PE-01"]')).toContainText('Eigener Prozess');
  await waehle(page.locator('#prozesse-filter-pflicht'), 'eigen');
  await expect(page.locator('.prozess-gruppe tbody tr')).toHaveCount(1);
  await waehle(page.locator('#prozesse-filter-pflicht'), '');
  // Löschen mit Rückfrage
  await page.goto(`${page.url().split('#')[0]}#/prozesse/PE-01`);
  await beantworteRueckfragen(page, true, { einmal: true });
  await page.click('#pe-PE-01-loeschen');
  await expect(page).toHaveURL(/#\/prozesse$/);
  await expect(page.locator('tr[data-prozess="PE-01"]')).toHaveCount(0);
  expect(befunde).toEqual([]);
  expect(fehler).toEqual([]);
});

for (const modus of ['hell', 'dunkel'] as const) {
  test(`Prozesslandkarte ${modus}: Gruppen, Kacheln nach Reife mit Wort, Legende, Klick zur Detailseite, axe`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: modus === 'hell' ? 'light' : 'dark' });
    const fehler = await zuProzessen(page, (p) => {
      mitProzessen(p);
      p.eigeneProzesse = [{ id: 'PE-01', titel: 'Kundenanfragen zu KI beantworten', gruppe: 'kern', art: 'nur-aims' }];
      p.prozesse!.push({ id: 'PE-01', reife: 1, eigner: 'P-001' });
    });
    await waehleTheme(page, modus);
    // Landkarte über das Untermenü (ein Weg je Ansicht, U-12)
    await untermenueLink(page, 'Landkarte').click();
    await expect(page).toHaveURL(/ansicht=karte/);
    await expect(untermenueLink(page, 'Landkarte')).toHaveAttribute('aria-current', 'page');
    const karte = page.locator('#prozesse-landkarte');
    await expect(karte).toBeVisible();
    await expect(karte.locator('.prozess-karte-gruppe')).toHaveCount(4);
    await expect(karte.locator('#prozesse-landkarte-legende li')).toHaveText(['nicht begonnen', 'definiert', 'eingeführt', 'wirksam', 'überprüft']);
    // Reife als Farbe (data-reife) und als Wort
    for (const [id, r, wort] of [['PR-07', '2', 'eingeführt'], ['PR-25', '3', 'wirksam'], ['PR-26', '4', 'überprüft'], ['PE-01', '1', 'definiert'], ['PR-01', '0', 'nicht begonnen']] as const) {
      const k = karte.locator(`a[data-prozess="${id}"]`);
      await expect(k).toHaveAttribute('data-reife', r);
      await expect(k).toContainText(wort);
    }
    // Feste Skala: verschiedene Farben je Stufe, unabhängig von CI
    const farbe = (id: string) => karte.locator(`a[data-prozess="${id}"]`).evaluate((e) => getComputedStyle(e).borderLeftColor);
    expect(new Set([await farbe('PR-01'), await farbe('PE-01'), await farbe('PR-07'), await farbe('PR-25')]).size).toBe(4);
    const befunde = await axe(page, 'Landkarte');
    await foto(page, `landkarte-${modus}`);
    await karte.locator('a[data-prozess="PR-25"]').click();
    await expect(page).toHaveURL(/#\/prozesse\/PR-25$/);
    await expect(page.locator('main h1')).toHaveText(/^PR-25 /);
    // Zurück zur Liste über das Untermenü
    await page.goto(`${page.url().split('#')[0]}#/prozesse?ansicht=karte`);
    await untermenueLink(page, 'Alle Prozesse').click();
    await expect(page.locator('#prozesse-landkarte')).toHaveCount(0);
    expect(befunde).toEqual([]);
    expect(fehler).toEqual([]);
  });
}

test('draw.io: unbekanntes Diagramm als eigener Prozess, Bahn ohne Rolle zuordnen, danach kein H61', async ({ page }) => {
  const fehler = await zuProzessen(page);
  const xml =
    '<mxfile><diagram id="xyz" name="Kundenreklamation"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
    '<mxCell id="l1" value="Vertrieb" style="swimlane;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="200" height="400" as="geometry"/></mxCell>' +
    '<mxCell id="a" value="Reklamation geht ein" style="ellipse;" vertex="1" parent="l1"><mxGeometry x="20" y="40" width="120" height="40" as="geometry"/></mxCell>' +
    '<mxCell id="b" value="Reklamation prüfen" style="rounded=0;" vertex="1" parent="l1"><mxGeometry x="20" y="120" width="120" height="40" as="geometry"/></mxCell>' +
    '<mxCell id="c" value="Erledigt" style="ellipse;" vertex="1" parent="l1"><mxGeometry x="20" y="200" width="120" height="40" as="geometry"/></mxCell>' +
    '<mxCell id="k1" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>' +
    '<mxCell id="k2" edge="1" parent="1" source="b" target="c"><mxGeometry relative="1" as="geometry"/></mxCell>' +
    '</root></mxGraphModel></diagram></mxfile>';
  mkdirSync(ORDNER, { recursive: true });
  const pfad = join(ORDNER, `${test.info().project.name}-reklamation.drawio`);
  writeFileSync(pfad, xml);
  await page.setInputFiles('#drawio-datei', pfad);
  const dialog = page.locator('#drawio-import-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('neu als eigener Prozess PE-01');
  await expect(dialog).toContainText('Bahnen ohne Rolle');
  await expect(page.locator('#drawio-import-titel-0')).toHaveValue('Kundenreklamation');
  const befunde = await axe(page, 'Import-Dialog');
  await foto(page, 'import-eigen');
  await page.click('#drawio-import-uebernehmen');
  await expect(page).toHaveURL(/#\/prozesse\/PE-01$/);
  await expect(page.locator('main h1')).toHaveText('PE-01 Kundenreklamation');
  await expect(page.locator('#schritte-PE-01 tbody tr')).toHaveCount(3);
  // Prüfung meldet H61
  await bereichLink(page, 'Prüfung').click();
  const befund = page.getByRole('link', { name: /PE-01: Bahnen ohne Rolle/ });
  await expect(befund).toBeVisible();
  await befund.click();
  await expect(page).toHaveURL(/#\/prozesse\/PE-01$/);
  // Rolle aus den bestehenden Rollen wählen
  const zuordnung = page.locator('#pz-PE-01-bahnen-offen');
  await expect(zuordnung).toBeVisible();
  befunde.push(...(await axe(page, 'Bahnen zuordnen')));
  await foto(page, 'bahnen-zuordnen');
  await waehle(page.locator('#pz-PE-01-bahn-bahn-1'), 'fachbereich');
  await expect(zuordnung).toHaveCount(0);
  await expect(page.locator('#schritte-PE-01 tbody tr').first()).toContainText('Vertrieb');
  await bereichLink(page, 'Prüfung').click();
  await expect(page.locator('main')).not.toContainText('PE-01: Bahnen ohne Rolle');
  expect(befunde).toEqual([]);
  expect(fehler).toEqual([]);
});

test('Internes Audit: Prozesse im Umfang wählen, Hinweis H63 für Pflichtprozesse ausserhalb des Zyklus', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('audit-umfang.aims.json', false, mitProzessen));
  await page.goto(`${page.url().split('#')[0]}#/formular/audits/AU-001`);
  const umfang = page.locator('#ff-AU-001-umfangProzesse');
  await expect(umfang).toBeVisible();
  await umfang.getByRole('searchbox').fill('PR-25');
  await umfang.getByRole('checkbox', { name: /^PR-25 / }).check();
  await expect(umfang).toContainText('1 gewählt');
  const befunde = await axe(page, 'Audit');
  await foto(page, 'audit-umfang');
  await bereichLink(page, 'Prüfung').click();
  // Hinweise je Regel gruppiert (U-16): H63 nennt PR-01 als Stelle, PR-25 nicht
  const h63 = page.locator('.befunde > li[data-regel="H63"]');
  await expect(h63).toContainText('in keinem internen Audit des Zyklus');
  await expect(h63).toContainText('PR-01');
  await expect(h63).not.toContainText('PR-25');
  // Ohne Auswahl umfasst das Audit alle Prozesse: Hinweis verschwindet
  await page.goto(`${page.url().split('#')[0]}#/formular/audits/AU-001`);
  await page.locator('#ff-AU-001-umfangProzesse').getByRole('searchbox').fill('PR-25');
  await page.locator('#ff-AU-001-umfangProzesse').getByRole('checkbox', { name: /^PR-25 / }).uncheck();
  await bereichLink(page, 'Prüfung').click();
  await expect(page.locator('main')).not.toContainText('in keinem internen Audit des Zyklus');
  expect(befunde).toEqual([]);
  expect(fehler).toEqual([]);
});
