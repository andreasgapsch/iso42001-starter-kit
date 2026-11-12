// Abnahme 2: Unterbrechen und Weitermachen. Mitten in einer Etappe speichern (Download), neue Seite, Datei öffnen:
// gleicher Stand und gleiche Seite im Guide. Voraussetzung: npm run build:app. Testtiefe: Chromium.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test } from '../app/app-hilfen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, ORDNER, bereichLink, starte } from '../app/app-hilfen.ts';
import { neuesProjektAnlegen, ortAusUrl, seiteBearbeiten, text, type Durchlauf } from './abnahme-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true, actionTimeout: 15_000 });

const ohneZeit = (p: Record<string, unknown>) => {
  const k = structuredClone(p) as { meta: Record<string, unknown> };
  delete k.meta['geaendert'];
  return k;
};

test('Mitten in E2 speichern, in neuer Seite öffnen, gleiche Seite und gleicher Stand', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Testtiefe Chromium');
  test.setTimeout(180_000);
  const { fehler } = await starte(page);
  await neuesProjektAnlegen(page, { isms: 'nein', modul: false });
  const d: Durchlauf = {
    sprache: 'de', beispielUebernehmen: false, befunde: [], besucht: [],
    vorgaben: { 'E0-firma:organisation.name': 'Unterbruch AG', 'E0-isms:meta.gefuehrt.antworten.isms': 'nein', 'E0-modul:meta.modulAiAct': false, 'E0-verantwortung:organisation.aimsVerantwortlich': { person: 'neu' } },
  };
  // E0 und E1 durchgehen, in E2 bis zur Seite E2-klima
  for (let i = 0; i < 60 && ortAusUrl(page.url()).seite !== 'E2-klima'; i++) {
    if (ortAusUrl(page.url()).seite === 'abschluss') await page.locator('.seite > .karte .knoepfe button.weiter').click();
    else await seiteBearbeiten(page, d);
  }
  await expect(page).toHaveURL(/#\/gefuehrt\/E2\/E2-klima$/);
  // Halb ausgefüllt: Begründung eingetragen, Auswahl noch offen, nicht «Weiter»
  const begruendung = page.locator('.feld[data-feld="organisation.kontext.klimawandelBegruendung"] textarea');
  await begruendung.fill('Klimawandel betrifft unsere Lieferketten, nicht aber den KI-Einsatz.');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#speichern')]);
  await expect(page.locator('#speicherstatus')).toHaveText(text('de', 'app.kopf.gespeichert'));
  const datei = join(ORDNER, `weitermachen-${test.info().project.name}.aims.json`);
  writeFileSync(datei, readFileSync(await dl.path()));
  const gespeichert = JSON.parse(readFileSync(datei, 'utf8')) as Record<string, unknown>;
  expect((gespeichert as { meta: { gefuehrt: { aktuelleSeite?: string } } }).meta.gefuehrt.aktuelleSeite).toBe('E2-klima');

  // Neue Seite, Datei öffnen
  const neu = await context.newPage();
  const zweiter = await starte(neu);
  const [fc] = await Promise.all([neu.waitForEvent('filechooser'), neu.click('#start-oeffnen')]);
  await fc.setFiles(datei);
  await expect(neu).toHaveURL(/#\/formular\/uebersicht/);
  await expect(neu.locator('#projekt-kachel')).toHaveAttribute('aria-label', /Projekt Unterbruch AG/);
  // «Weitermachen» in der Übersicht und im Überblick des Guides führen auf dieselbe Seite
  await neu.getByRole('link', { name: text('de', 'app.uebersicht.weitermachen') }).click();
  await expect(neu).toHaveURL(/#\/gefuehrt\/E2\/E2-klima$/);
  await expect(neu.locator('h1#seitentitel')).toHaveText(text('de', 'gefuehrt.E2.E2-klima.titel'));
  await expect(neu.locator('.feld[data-feld="organisation.kontext.klimawandelBegruendung"] textarea')).toHaveValue('Klimawandel betrifft unsere Lieferketten, nicht aber den KI-Einsatz.');
  await neu.evaluate(() => (location.hash = '#/start'));
  // Der Bereich «Guide» in der Symbolleiste öffnet den Überblick; «Weitermachen» führt auf dieselbe Seite
  await bereichLink(neu, 'Guide').click();
  await expect(neu.locator('#ueberblick h1')).toHaveText(text('de', 'app.ueberblick.titel'));
  await neu.locator('#ueberblick-weiter').click();
  await expect(neu.locator('h1#seitentitel')).toHaveText(text('de', 'gefuehrt.E2.E2-klima.titel'));
  // Fortschritt wie vor dem Unterbruch
  const fortschritt = (s: typeof page) => s.locator('#gefuehrt-fortschritt').textContent();
  expect(await fortschritt(neu)).toBe(await fortschritt(page));

  // Gleicher Stand: erneut speichern ergibt dieselben Daten
  const [dl2] = await Promise.all([neu.waitForEvent('download'), neu.click('#speichern')]);
  const wieder = JSON.parse(readFileSync(await dl2.path(), 'utf8')) as Record<string, unknown>;
  expect(ohneZeit(wieder)).toEqual(ohneZeit(gespeichert));
  expect(fehler).toEqual([]);
  expect(zweiter.fehler).toEqual([]);
});
