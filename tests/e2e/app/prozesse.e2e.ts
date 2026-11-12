// Bereich «Prozesse» im AIMS-Manager (file://, Chromium, Firefox, WebKit): Menüpunkt, Liste nach Gruppen mit Filter nach
// Art und Verbindlichkeit, Status-Dashboard (auch im Lagebild), Detailseite mit Ablauf als eigenem SVG und Schritt-Tabelle,
// Stand bearbeiten, Massnahme zum Prozess, draw.io-Export und Import mit Unterschied-Dialog (Rundreise ohne Verlust),
// Pfad ohne ISMS (Mindestumfang) und mit ISMS (nur Verweis), axe hell und dunkel. Bildschirmfotos: /tmp/prozesse-bilder/.
// Voraussetzung: npm run build:app
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test } from './app-hilfen.ts';
import type { Projekt } from '../../../src/model/typen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, ORDNER, bereichLink, fixtureDatei, oeffne, starte, untermenueLink, waehleTheme } from './app-hilfen.ts';
import { waehle } from '../auswahl-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true });

const BILDER = '/tmp/prozesse-bilder';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function axe(page: Page, ort: string): Promise<string[]> {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((v) => `${ort}: ${v.id} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

/** Bildschirmfoto nur in Chromium: WebKit meldet das Stilelement, das Playwright für Fotos einsetzt, als CSP-Verletzung */
async function foto(page: Page, name: string): Promise<void> {
  if (test.info().project.name !== 'chromium') return;
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${name}.png`), fullPage: true });
}

/** Projekt mit Prozessstand: PR-07 eingeführt, PR-08 definiert, PR-12 überfällig */
const mitProzessen = (mitIsms = false) => (p: Projekt) => {
  p.meta.mitIsms = mitIsms;
  p.prozesse = [
    { id: 'PR-07', reife: 2, letzteDurchfuehrung: '2026-09-01' },
    { id: 'PR-08', reife: 1, eigner: 'P-001' },
    { id: 'PR-12', letzteDurchfuehrung: '2026-03-01', rhythmus: 'quartalsweise' },
  ];
};

async function zuProzessen(page: Page, mitIsms = false): Promise<string[]> {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('prozesse.aims.json', mitIsms, mitProzessen(mitIsms)));
  await bereichLink(page, 'Prozesse').click();
  await expect(page).toHaveURL(/#\/prozesse$/);
  await expect(page.locator('main h1')).toHaveText('Prozesse');
  return fehler;
}

test('Menü Prozesse: Liste nach Gruppen, Filter nach Art und Verbindlichkeit, Dashboard, ohne ISMS mit Mindestumfang', async ({ page }) => {
  const fehler = await zuProzessen(page);
  await expect(bereichLink(page, 'Prozesse')).toHaveAttribute('aria-current', 'true');
  await expect(untermenueLink(page, 'Alle Prozesse')).toHaveAttribute('aria-current', 'page');
  // Gruppen Führung, Kern, Unterstützung, Bewertung
  await expect(page.locator('.prozess-gruppe')).toHaveCount(4);
  await expect(page.locator('.prozess-gruppe h2')).toHaveText(['Führung', 'Kernprozesse KI', 'Unterstützung', 'Bewertung und Verbesserung']);
  // Dashboard nur unter «Status» (ein Weg je Ansicht, U-12): Reife, ohne Eigner, überfällig, Kennzahlen, Massnahmen
  await expect(page.locator('#prozesse-reife')).toHaveCount(0);
  await untermenueLink(page, 'Status').click();
  await expect(page).toHaveURL(/ansicht=status/);
  await expect(page.locator('#prozesse-reife [data-kategorie="2"]')).toHaveAttribute('data-wert', '1');
  await expect(page.locator('#prozesse-reife [data-kategorie="1"]')).toHaveAttribute('data-wert', '1');
  await expect(page.locator('#pz-ueberfaellig .g-kennzahl__wert, #pz-ueberfaellig').first()).toContainText('1');
  await untermenueLink(page, 'Alle Prozesse').click();
  await expect(page.locator('.prozess-gruppe')).toHaveCount(4);
  await expect(page.locator('tr[data-prozess="PR-12"]')).toContainText('überfällig');
  await expect(page.locator('tr[data-prozess="PR-07"]')).toContainText('eingeführt');
  // Ohne ISMS: Basisprozesse des Mindestumfangs in der Liste, die übrigen als Empfehlung
  await expect(page.locator('tr[data-prozess="PS-02"]').first()).toContainText('Mindestumfang');
  await expect(page.locator('#prozesse-empfohlen')).toBeVisible();
  await expect(page.locator('#prozesse-isms-bereich')).toHaveCount(0);
  // Filter Art: nur AIMS
  await waehle(page.locator('#prozesse-filter-art'), 'nur-aims');
  await expect(page).toHaveURL(/art=nur-aims/);
  await expect(page.locator('tr[data-prozess="PR-01"]')).toHaveCount(0);
  await expect(page.locator('tr[data-prozess="PR-07"]')).toBeVisible();
  for (const zelle of await page.locator('.prozess-gruppe tbody tr td:nth-child(3)').allTextContents()) expect(zelle).toBe('Nur AIMS');
  // Filter Verbindlichkeit: Pflicht (zusammen mit Art leer)
  await waehle(page.locator('#prozesse-filter-art'), '');
  await waehle(page.locator('#prozesse-filter-pflicht'), 'pflicht');
  await expect(page.locator('tr[data-prozess="PR-07"]')).toHaveCount(0);
  await expect(page.locator('tr[data-prozess="PR-08"]')).toBeVisible();
  await waehle(page.locator('#prozesse-filter-pflicht'), '');
  await foto(page, 'liste');
  expect(fehler).toEqual([]);
});

test('Mit ISMS: Basisprozesse nur als Verweis auf das ISMS, Hinweis H62 in der Prüfung', async ({ page }) => {
  const fehler = await zuProzessen(page, true);
  await expect(page.locator('#prozesse-isms-bereich')).toBeVisible();
  await expect(page.locator('#prozesse-isms-bereich tr[data-prozess="PS-04"]')).toContainText('kein Verweis');
  await expect(page.locator('#prozesse-empfohlen')).toHaveCount(0);
  await expect(page.locator('.prozess-gruppe tr[data-prozess^="PS-"]')).toHaveCount(0);
  // Verweis im Detail setzen
  await page.locator('#prozesse-isms-bereich a[href$="PS-04"]').first().click();
  await expect(page.locator('main h1')).toContainText('PS-04');
  await page.fill('#pz-PS-04-isms', 'ISMS-Handbuch, Prozess IS-04');
  await page.locator('#pz-PS-04-isms').blur();
  await page.click('#prozess-zurueck');
  await expect(page.locator('#prozesse-isms-bereich tr[data-prozess="PS-04"]')).toContainText('ISMS-Handbuch, Prozess IS-04');
  await bereichLink(page, 'Prüfung').click();
  await expect(page.locator('main')).toContainText('Verweis auf das ISMS fehlt');
  expect(fehler).toEqual([]);
});

test('Detailseite: Ablauf als SVG mit Bahnen und Schritt-Tabelle, Stand bearbeiten, Massnahme anlegen, Prüfung springt zum Prozess', async ({ page }) => {
  const fehler = await zuProzessen(page);
  await page.click('tr[data-prozess="PR-07"] th a');
  await expect(page).toHaveURL(/#\/prozesse\/PR-07$/);
  await expect(page.locator('main h1')).toHaveText(/^PR-07 /);
  await expect(page.locator('main h1')).toBeFocused();
  // Ablauf: eigenes SVG mit Titel und Beschreibung, eine Bahn je Rolle, Formen und Kanten; Tabelle als Textfassung
  const svg = page.locator('#ablauf-PR-07-figur svg');
  await expect(svg).toHaveAttribute('role', 'img');
  await expect(page.locator('#ablauf-PR-07-titel')).toHaveText(/Ablauf PR-07/);
  // Beispiel mit Zweig zur Geschäftsleitung (Entscheidungsrechte D-04): 5 Bahnen, 13 Schritte, 4 Entscheidungen
  await expect(svg.locator('[data-bahn]')).toHaveCount(5);
  await expect(svg.locator('[data-knoten]')).toHaveCount(13);
  await expect(svg.locator('[data-form="frage"]')).toHaveCount(4);
  await expect(page.locator('#schritte-PR-07 tbody tr')).toHaveCount(13);
  // Erwartung geändert (P20, M4-33, GR-06): Kriterienprüfung und Test vor der Frage; «keine vertiefte Prüfung» führt zur Freigabe durch die AIMS-Verantwortung (Schritt 8)
  await expect(page.locator('#schritte-PR-07 tr[data-schritt="PR-07.03"]')).toContainText('ja: 6; nein: 8');
  // Stand: Eigner, Reife, Rhythmus
  await waehle(page.locator('#pz-PR-07-eigner'), 'P-001');
  await waehle(page.locator('#pz-PR-07-reife'), '3');
  await waehle(page.locator('#pz-PR-07-rhythmus'), 'halbjaehrlich');
  await expect(page.locator('main .prozess-marken [data-reife="3"]')).toHaveText('wirksam');
  await expect(page.locator('#speicherstatus')).toHaveText('Ungespeicherte Änderungen');
  // Ablauf bearbeiten: Text eines Schritts ändern; Diagramm folgt, «Auf Katalog zurücksetzen» erscheint
  await page.click('#pz-PR-07-bearbeiten');
  const feld = page.getByRole('textbox', { name: 'Schritt 3' });
  await feld.fill('Kurzprüfung innert 10 Tagen');
  await feld.blur();
  await expect(svg.locator('[data-knoten="PR-07.02"]')).toContainText('innert 10');
  await page.click('#pz-PR-07-bearbeiten');
  await expect(page.locator('#pz-PR-07-zuruecksetzen')).toBeVisible();
  // Reife «wirksam» ohne Kennzahl: Hinweis H57 in der Prüfung mit Sprung zurück auf die Detailseite
  await bereichLink(page, 'Prüfung').click();
  const befund = page.getByRole('link', { name: /PR-07: Reife «wirksam» ohne aktuellen Messwert/ });
  await expect(befund).toBeVisible();
  await befund.click();
  await expect(page).toHaveURL(/#\/prozesse\/PR-07$/);
  // Massnahme zum Prozess
  await page.click('#pz-PR-07-massnahme-neu');
  await expect(page).toHaveURL(/#\/formular\/massnahmen\/M-\d{3}/);
  await page.goBack();
  await expect(page.locator('#pz-PR-07-massnahmen li')).toHaveCount(1);
  await foto(page, 'detail');
  expect(fehler).toEqual([]);
});

test('draw.io: Export, Änderung ausserhalb, Import mit Unterschied-Dialog, Rundreise behält fremde Formen', async ({ page }) => {
  const fehler = await zuProzessen(page);
  await page.goto(`${page.url().split('#')[0]}#/prozesse/PR-08`);
  await expect(page.locator('main h1')).toHaveText(/^PR-08 /);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pz-PR-08-drawio-export')]);
  expect(dl.suggestedFilename()).toBe('D-27_PR-08.drawio');
  const datei = await dl.path();
  const xml = readFileSync(datei!, 'utf8');
  expect(xml).toMatch(/^<mxfile /);
  expect(xml).toContain('<diagram id="PR-08"');
  expect(xml).not.toMatch(/kmu-cio|Starter/i);
  // In draw.io geändert: ein Schritt umbenannt, eine Notiz auf einer zweiten Ebene ergänzt
  const geaendert = xml
    .replace(/label="Wahrscheinlichkeit und Ausmass bewerten"/, 'label="Wahrscheinlichkeit und Ausmass nach D-06 bewerten"')
    .replace('</root>', '<mxCell id="ebene-2" value="Notizen" parent="0"/><mxCell id="notiz" value="Workshop mit Fachbereichen" style="text;html=1;" vertex="1" parent="ebene-2"><mxGeometry x="600" y="40" width="160" height="40" as="geometry"/></mxCell></root>');
  expect(geaendert).not.toBe(xml);
  mkdirSync(ORDNER, { recursive: true });
  const pfad = join(ORDNER, `${test.info().project.name}-PR-08.drawio`);
  writeFileSync(pfad, geaendert);
  await page.setInputFiles('#drawio-datei-PR-08', pfad);
  const dialog = page.locator('#drawio-import-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Geänderte Schritte: 1');
  await expect(dialog).toContainText('PR-08.03');
  await expect(dialog).toContainText('Neue Schritte: 0');
  const funde = await axe(page, 'Import-Dialog');
  await page.click('#drawio-import-uebernehmen');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#schritte-PR-08 tr[data-schritt="PR-08.03"]')).toContainText('nach D-06');
  await expect(page.locator('#pz-PR-08-drawio-stand')).toContainText('PR-08.drawio');
  // Export nach dem Import: Notiz und zweite Ebene bleiben erhalten (Einmischen statt Neuzeichnen)
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#pz-PR-08-drawio-export')]);
  const xml2 = readFileSync((await dl2.path())!, 'utf8');
  expect(xml2).toContain('Workshop mit Fachbereichen');
  expect(xml2).toContain('id="ebene-2"');
  expect(xml2).toContain('nach D-06 bewerten');
  // Datei mit Dokumenttypdefinition (Entitätsbombe): abgelehnt mit Meldung in der Sprache der Oberfläche
  const boese = join(ORDNER, `${test.info().project.name}-boese.drawio`);
  writeFileSync(boese, '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;">]><mxfile><diagram id="PR-08">&b;</diagram></mxfile>');
  await page.setInputFiles('#drawio-datei-PR-08', boese);
  await expect(page.locator('#meldung')).toContainText('Dokumenttypdefinition');
  await expect(dialog).toBeHidden();
  // Alle Prozesse als eine Datei mit Landkarte
  await page.click('#prozess-zurueck');
  const [dl3] = await Promise.all([page.waitForEvent('download'), page.click('#prozesse-drawio-export')]);
  expect(dl3.suggestedFilename()).toBe('D-27_Prozesse.drawio');
  const alle = readFileSync((await dl3.path())!, 'utf8');
  expect(alle).toContain('<diagram id="landkarte"');
  expect(alle).toContain('link="data:page/id,PR-08"');
  expect(funde).toEqual([]);
  expect(fehler).toEqual([]);
});

test('Prozessbeschreibung D-27 als Word für einen Prozess', async ({ page }) => {
  const fehler = await zuProzessen(page);
  await page.goto(`${page.url().split('#')[0]}#/prozesse/PR-07`);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.click('#pz-PR-07-beschreibung-docx')]);
  expect(dl.suggestedFilename()).toMatch(/^D-27_PR-07_.*\.docx$/);
  const bytes = readFileSync((await dl.path())!);
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
  expect(fehler).toEqual([]);
});

test('Lagebild: Karte Prozesse mit Reife und fälligen Durchführungen; ohne Prozessstand ein Hinweis', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('lagebild-prozesse.aims.json', false, mitProzessen()));
  const karte = page.locator('#lb-prozesse');
  await expect(karte).toBeVisible();
  await expect(karte.locator('#lb-prozesse-reife')).toBeVisible();
  await expect(karte.locator('#lb-prozesse-faellig li[data-ueberfaellig]')).toContainText('PR-12');
  await karte.getByRole('link', { name: /Zu den Prozessen/ }).click();
  await expect(page).toHaveURL(/#\/prozesse$/);
  await foto(page, 'lagebild-ziel');
  await page.goto(`${page.url().split('#')[0]}#/formular/uebersicht`);
  await page.locator('#lb-prozesse').scrollIntoViewIfNeeded();
  await foto(page, 'lagebild');
  // Projekt ohne Prozessstand
  await page.goto(`${page.url().split('#')[0]}#/start`);
  await oeffne(page, fixtureDatei('lagebild-ohne.aims.json'));
  await expect(page.locator('#lb-prozesse')).toContainText('Noch kein Prozessstand erfasst');
  expect(fehler).toEqual([]);
});

for (const modus of ['hell', 'dunkel'] as const) {
  test(`axe ${modus}: Liste, Detail und Lagebild der Prozesse`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: modus === 'hell' ? 'light' : 'dark' });
    const fehler = await zuProzessen(page);
    await waehleTheme(page, modus);
    const befunde: string[] = [];
    befunde.push(...(await axe(page, 'Liste')));
    await page.goto(`${page.url().split('#')[0]}#/prozesse/PR-07`);
    await expect(page.locator('main h1')).toHaveText(/^PR-07 /);
    befunde.push(...(await axe(page, 'Detail')));
    if (modus === 'dunkel') await foto(page, 'detail-dunkel');
    await page.goto(`${page.url().split('#')[0]}#/formular/uebersicht`);
    await expect(page.locator('#lb-prozesse')).toBeVisible();
    befunde.push(...(await axe(page, 'Lagebild')));
    expect(befunde).toEqual([]);
    expect(fehler).toEqual([]);
  });
}

// C4-03 (Q6-Messung): unbesetzte Rollen eines Ablaufs zeigt schon die Prozessseite, nicht erst die Prüfung (F37); die Hilfe
// zu PR-07 nennt die Stelle für Restrisiken aus der Faktenquelle (P20-Hinweis H4, Nacharbeit N8)
test('C4-03: Prozessseite nennt unbesetzte Rollen; PR-07 Hilfe mit Restrisiko vor Freigabe', async ({ page }) => {
  const { fehler } = await starte(page);
  const katalog = (JSON.parse(readFileSync(join(REPO, 'src/generiert/kataloge.json'), 'utf8')) as { prozesse_katalog: { prozesse: { id: string }[] } }).prozesse_katalog.prozesse;
  await oeffne(page, fixtureDatei('c4-03.aims.json', false, (p) => { p.prozesse = katalog.map((x) => ({ id: x.id, anwendbar: 'ja' as const })); p.rollen = []; }));
  const mitHinweis: string[] = [];
  for (const { id } of katalog) {
    await page.evaluate((h) => (location.hash = h), `#/prozesse/${id}`);
    await expect(page.locator('main h1')).toHaveText(new RegExp(`^${id} `));
    const h = page.locator(`#pz-${id}-rollen-offen`);
    if (await h.count()) {
      await expect(h).toContainText('Rollen in diesem Ablauf ohne Besetzung:');
      mitHinweis.push(id);
    }
  }
  expect(mitHinweis.length).toBeGreaterThan(0);
  await page.evaluate(() => (location.hash = '#/prozesse/PR-07'));
  await expect(page.locator('main')).toContainText('nimmt es zuerst die Geschäftsleitung nach PR-08 an');
  await expect(page.locator('main')).not.toContainText('{{');
  expect(fehler).toEqual([]);
});
