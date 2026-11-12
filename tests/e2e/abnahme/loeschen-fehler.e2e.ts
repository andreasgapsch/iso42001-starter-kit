// P16: drei Fälle der Runde 3a. (1) AF-009: Löschen mit Abhängigkeiten im Guide, der Dialog nennt die Verweise, danach gibt es 0
// hängende Verweise. (2) P5, AF-015: Fehlerdialog mit Ursache im Klartext, Technikangaben eingeklappt, «Fehlerbericht kopieren».
// (3) AF-031: Der gemeinsame Haken zählt CSP-Verletzungen und Netzwerkanfragen (starte() in app-hilfen.ts).
// Voraussetzung: npm run build:app. Testtiefe: alle drei Engines (Kopieren nur in Chromium auslesbar).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test } from '../app/app-hilfen.ts';
import type { Projekt } from '../../../src/model/typen.ts';
import { haengendeVerweise } from '../../../src/model/verweise.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte, waehleSprache, zaehleHaken } from '../app/app-hilfen.ts';
import { text } from './abnahme-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true, actionTimeout: 15_000 });

test('AF-009: KI-System mit Risiken löschen: Dialog zeigt die Verweise, danach 0 hängende Verweise', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('loeschen.aims.json', false, (p) => {
    // Das System KI-001 hat zwei Risiken, einen Control-Eintrag und ein Ziel, die auf es verweisen
    p.risiken.push({ ...structuredClone(p.risiken[0]!), id: 'R-002', titel: 'Falsche Auskunft an Kunden' });
    p.controls[0]!.kiSysteme = ['KI-001'];
    p.ziele[0]!.kiSysteme = ['KI-001'];
    // Ein zweites System bleibt bestehen und verweist nicht
    p.kiSysteme.push({ ...structuredClone(p.kiSysteme[0]!), id: 'KI-002', name: 'Übersetzer' });
  }));
  await page.evaluate(() => (location.hash = '#/gefuehrt/E4/E4-systeme'));
  await expect(page.locator('h1#seitentitel')).toBeVisible();
  const eintraege = page.locator('section.eintrag');
  await expect(eintraege).toHaveCount(2);
  // Löschen des ersten Systems: der Dialog (V-18: die eine Dialogart #bestaetigen) nennt die abhängigen Einträge mit Kennung
  await eintraege.first().getByRole('button', { name: text('de', 'app.gefuehrt.eintrag_entfernen') }).click();
  const dialog = page.locator('dialog#bestaetigen');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('h2')).toContainText('KI-001');
  const liste = dialog.locator('li');
  await expect(liste.filter({ hasText: 'R-001' })).toHaveCount(1);
  await expect(liste.filter({ hasText: 'R-002' })).toHaveCount(1);
  await expect(liste.filter({ hasText: 'A.2.2' })).toHaveCount(1);
  await expect(liste.filter({ hasText: 'Z-001' })).toHaveCount(1);
  // «Abbrechen» löscht nichts
  await dialog.getByRole('button', { name: text('de', 'app.allgemein.abbrechen') }).click();
  await expect(dialog).toHaveCount(0);
  await expect(eintraege).toHaveCount(2);
  // «Verweise entfernen und löschen»
  await eintraege.first().getByRole('button', { name: text('de', 'app.gefuehrt.eintrag_entfernen') }).click();
  await page.locator('dialog#bestaetigen').getByRole('button', { name: text('de', 'app.loeschen.verweise_entfernen') }).click();
  await expect(page.locator('dialog#bestaetigen')).toHaveCount(0);
  await expect(eintraege).toHaveCount(1);
  // Projektdatei: KI-001 ist weg, die verweisenden Einträge bleiben, hängende Verweise 0
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#speichern')]);
  const p = JSON.parse(readFileSync(await dl.path(), 'utf8')) as Projekt;
  expect(p.kiSysteme.map((k) => k.id)).toEqual(['KI-002']);
  expect(p.risiken.map((r) => r.id)).toEqual(expect.arrayContaining(['R-001', 'R-002']));
  expect(p.controls[0]!.kiSysteme).toEqual([]);
  expect(p.ziele[0]!.kiSysteme ?? []).toEqual([]);
  expect(haengendeVerweise(p), 'hängende Verweise nach dem Löschen').toEqual([]);
  expect(fehler).toEqual([]);
});

test('AF-015: Fehlerdialog zeigt die Ursache im Klartext, Technikangaben sind eingeklappt, der Bericht lässt sich kopieren', async ({ page, context, browserName }) => {
  const { fehler } = await starte(page);
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // Ein unerwarteter Fehler mit technischem Rohtext, wie ihn ein Parser liefert
  const roh = 'Unexpected token < in JSON at position 0';
  await page.evaluate((m) => void Promise.reject(new SyntaxError(m)), roh);
  const dialog = page.locator('#fehler-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('h2')).toHaveText(text('de', 'app.fehler.titel'));
  // Ursache in Klartext (mit nächstem Schritt), ohne den Rohtext
  const ursache = dialog.locator('#fehler-ursache');
  await expect(ursache).toBeVisible();
  await expect(ursache).toContainText(text('de', 'app.fehler.ursache'));
  expect(((await ursache.textContent()) ?? '').includes(roh), 'Rohtext nicht in der Ursache').toBe(false);
  // Technikangaben stehen eingeklappt und erscheinen erst nach dem Aufklappen
  const technik = dialog.locator('#fehler-technik');
  await expect(technik).not.toHaveAttribute('open', '');
  await expect(dialog.locator('pre.fehlerbericht')).toBeHidden();
  expect(await dialog.evaluate((d) => (d as HTMLElement).innerText.includes('Unexpected token')), 'Rohtext nicht sichtbar').toBe(false);
  await technik.locator('summary').click();
  await expect(dialog.locator('pre.fehlerbericht')).toBeVisible();
  await expect(dialog.locator('pre.fehlerbericht')).toContainText(roh);
  // Kopieren: der Bericht enthält Version, Browser und Fehler, aber keine Projektdaten
  if (browserName === 'chromium') {
    await dialog.getByRole('button', { name: text('de', 'app.fehler.kopieren') }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain(roh);
    const kopiert = await page.evaluate(() => navigator.clipboard.readText());
    expect(kopiert).toMatch(/^AIMS-Manager /);
    expect(kopiert).toContain('Browser: ');
  } else {
    await expect(dialog.getByRole('button', { name: text('de', 'app.fehler.kopieren') })).toBeEnabled();
  }
  await dialog.getByRole('button', { name: text('de', 'app.fehler.schliessen') }).click();
  await expect(dialog).toHaveCount(0);
  // Der Fehler selbst ist erwartet; CSP-Verletzungen und Netzwerkanfragen gab es nicht
  expect(zaehleHaken(fehler)).toEqual({ csp: 0, netz: 0 });
});

test('AF-031: Der gemeinsame Haken zählt CSP-Verletzungen und Netzwerkanfragen', async ({ page }) => {
  // Dieser Test löst CSP-Verletzung und Anfrage absichtlich aus; der automatische Haken wertet ihn deshalb nicht aus
  test.info().annotations.push({ type: 'haken-aus', description: 'prüft den Haken mit absichtlicher Anfrage und Verletzung' });
  const { fehler } = await starte(page);
  expect(zaehleHaken(fehler), 'sauberer Start').toEqual({ csp: 0, netz: 0 });
  // Eine Anfrage der Seite ins Netz weist die CSP (connect-src 'none') ab: Der Haken zählt die Verletzung
  await page.evaluate(() => fetch('https://example.invalid/aims').catch(() => undefined));
  await expect.poll(() => zaehleHaken(fehler).csp).toBeGreaterThanOrEqual(1);
  expect(fehler.some((m) => /^CSP: connect-src https:\/\/example\.invalid\/aims/.test(m))).toBe(true);
  // Eine Anfrage, die die CSP nicht abfängt (Navigation der Seite), erscheint als Netzwerkanfrage
  await page.goto('https://example.invalid/aims').catch(() => undefined);
  expect(zaehleHaken(fehler).netz).toBeGreaterThanOrEqual(1);
  expect(fehler.some((m) => /^NETZ: GET https:\/\/example\.invalid\/aims/.test(m))).toBe(true);
});

test('AF-139: Seite mit Prüfbefund zeigt den Befund mit Sprung, der Status nennt ihn eigens (DE und EN)', async ({ page }) => {
  const { fehler } = await starte(page);
  // KI-001 hat einen Eigner, der nicht existiert (F33): Pflichtfeld gefüllt, aber die Prüfung beanstandet den Verweis
  await oeffne(page, fixtureDatei('befund.aims.json', false, (p) => {
    p.kiSysteme[0]!.eigner = 'P-099';
    p.meta.gefuehrt.etappen['E4'] = { status: 'in-arbeit', spaeter: [], besucht: ['E4-systeme'] };
    // Der Überblick beginnt die Liste «als Nächstes» bei der gemerkten Seite
    p.meta.gefuehrt.aktuelleEtappe = 'E4';
    p.meta.gefuehrt.aktuelleSeite = 'E4-systeme';
  }));
  for (const sprache of ['de', 'en'] as const) {
    if (sprache === 'en') await waehleSprache(page, 'en');
    await page.evaluate(() => (location.hash = '#/gefuehrt/E4/E4-systeme'));
    const block = page.locator('.seiten-befunde');
    await expect(block).toBeVisible();
    await expect(block.locator('h2')).toHaveText(text(sprache, 'app.gefuehrt.befund_titel'));
    const f33 = block.locator('li[data-regel=F33]');
    await expect(f33).toHaveCount(1);
    await expect(f33.locator('strong')).not.toBeEmpty();
    await expect(f33.locator('a.knopf')).toHaveText(text(sprache, 'app.gefuehrt.befund_springen'));
    // Nur der Befund hält die Seite offen: der Text sagt es so und nennt keine fehlenden Pflichtangaben
    await expect(page.locator('#seiten-befunde-text')).toHaveText(text(sprache, 'app.gefuehrt.befund_text'));
    // Punktreihe im Kopf: derselbe Statustext
    expect(await page.locator('#seitenpunkte').evaluate((e) => e.outerHTML)).toContain(text(sprache, 'app.gefuehrt.seitenstatus.befund'));
    // Überblick: Seitenliste «als Nächstes» mit demselben Statustext
    await page.evaluate(() => (location.hash = '#/gefuehrt'));
    const naechste = page.locator('#ub-naechste-liste li', { hasText: text(sprache, 'gefuehrt.E4.E4-systeme.titel') });
    await expect(naechste).toContainText(text(sprache, 'app.gefuehrt.seitenstatus.befund'));
    await page.evaluate(() => (location.hash = '#/gefuehrt/E4/E4-systeme'));
    // Abschlussseite der Etappe: eigener Statustext statt «Pflichtangaben fehlen»
    await page.evaluate(() => (location.hash = '#/gefuehrt/E4/abschluss'));
    const zeile = page.locator('ul.befunde li', { hasText: text(sprache, 'gefuehrt.E4.E4-systeme.titel') });
    await expect(zeile).toContainText(text(sprache, 'app.gefuehrt.seitenstatus.befund'));
    await expect(zeile).not.toContainText(text(sprache, 'app.gefuehrt.seitenstatus.unvollstaendig'));
  }
  expect(fehler).toEqual([]);
});

test('AF-139: fehlen zusätzlich Pflichtangaben, nennt der Text der Seite beides getrennt', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('befund-luecke.aims.json', false, (p) => {
    p.kiSysteme[0]!.eigner = 'P-099';
    p.kiSysteme[0]!.name = '';
    p.meta.gefuehrt.etappen['E4'] = { status: 'in-arbeit', spaeter: [], besucht: ['E4-systeme'] };
  }));
  await page.evaluate(() => (location.hash = '#/gefuehrt/E4/E4-systeme'));
  await expect(page.locator('#seiten-befunde-text')).toHaveText(text('de', 'app.gefuehrt.befund_text_luecken'));
  expect(fehler).toEqual([]);
});

test('AF-135: Der Glossar-Tooltip zeigt die Kurzerklärung, ohne Kurzerklärung die ausführliche Erklärung', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('tooltip.aims.json'));
  const tooltip = async (seite: string, begriff: string) => {
    await page.evaluate((h) => (location.hash = h), `#/gefuehrt/${seite}`);
    const marke = page.locator('.glossar', { hasText: begriff }).first();
    await marke.focus();
    const t = page.locator('[role=tooltip]');
    await expect(t).toBeVisible();
    return ((await t.textContent()) ?? '').trim();
  };
  // Stage 1 hat eine Kurzerklärung (höchstens 20 Wörter), die ausführliche Erklärung bleibt ungenutzt
  const kurz = await tooltip('E0/E0-termin', 'Stage 1');
  expect(kurz).toContain(text('de', 'glossar.stage-1.kurz'));
  expect(kurz).not.toContain(text('de', 'glossar.stage-1.erklaerung'));
  expect(text('de', 'glossar.stage-1.kurz').split(/\s+/).length).toBeLessThanOrEqual(20);
  // Das KI-Inventar hat keine: Rückfall auf die Erklärung
  const lang = await tooltip('E4/E4-einfuehrung', 'KI-Inventar');
  expect(lang).toContain(text('de', 'glossar.ki-inventar.erklaerung'));
  expect(fehler).toEqual([]);
});
