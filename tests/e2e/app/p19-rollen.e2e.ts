// P19 (Runde 4, AF-079, AF-138): Messung Q6 C4-01 und C4-02 im Browser. Im Beispiel Präzisionsteile fehlen die Zeilen
// «Risikomanagement» und «Datenschutz» der Zuständigkeiten; Andrea Baumann hat «Datenschutz» als Rolle im Projekt.
// C4-02: F37 nennt Risikomanagement, nicht Datenschutz. C4-01: Der Sprung aus F37 führt ins Register, «Rolle erfassen»
// legt eine Zeile mit Bereich, R, A und Stellvertretung an; nach Bereich und Person ist F37 weg. Im Guide (E3-raci)
// erscheint eine neue Zeile auf der Seite.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { REPO } from '../spikes/hilfen.ts';
import { AUSWAHL, waehle, wertVon } from '../auswahl-hilfen.ts';
import { HTML, ORDNER, oeffne, starte, test } from './app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.skip(({ browserName }) => browserName !== 'chromium', 'Nur Chromium, Speichervorgabe der VM');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 } });

const hash = (page: import('@playwright/test').Page, h: string) => page.evaluate((x) => (location.hash = x), h);

/** Beispiel Präzisionsteile ohne die Zeilen Risikomanagement und Datenschutz der Zuständigkeiten */
function beispielOhneZeilen(): string {
  mkdirSync(ORDNER, { recursive: true });
  const p = JSON.parse(readFileSync(join(REPO, 'src/beispiele/praezisionsteile.de.aims.json'), 'utf8')) as { rollen: { bereich: string }[]; personen: { name: string; aimsRollen: string[] }[] };
  p.rollen = p.rollen.filter((r) => r.bereich !== 'risikomanagement' && r.bereich !== 'datenschutz');
  expect(p.personen.find((x) => x.name === 'Andrea Baumann')?.aimsRollen).toContain('dsb');
  const datei = join(ORDNER, `${test.info().testId}-p19-rollen.aims.json`);
  writeFileSync(datei, JSON.stringify(p, null, 2));
  return datei;
}

test('C4-01, C4-02: F37 nennt nur die wirklich unbesetzte Rolle, Sprung ins Register, neue Zeile mit Feldern behebt F37', async ({ page }) => {
  await starte(page);
  await oeffne(page, beispielOhneZeilen());
  await hash(page, '#/pruefung');
  const f37 = page.locator('ul.befunde li[data-regel=F37]');
  await expect(f37).toHaveCount(1);
  await expect(f37.locator('strong')).toContainText('Risikomanagement');
  await expect(f37.locator('strong')).not.toContainText('Datenschutz');
  // Meldung nennt das vorhandene Feld und den Weg über «Rolle erfassen»
  await expect(f37.locator('.befund-erklaerung')).toContainText('«Rolle im Projekt»');
  await expect(f37.locator('.befund-erklaerung')).toContainText('«Rolle erfassen»');
  await f37.locator('a.knopf').click();
  await expect(page).toHaveURL(/#\/formular\/organisation\/rollen/);

  await page.click('#neu-rollen');
  const editor = page.locator('#editor-rollen');
  await expect(editor).toBeVisible();
  // Felder der Zeile: Bereich (vorbelegt mit einem freien Bereich), verantwortlich, Rechenschaft, Stellvertretung
  const knoepfe = editor.locator(AUSWAHL);
  await expect(knoepfe).toHaveCount(4);
  const bereich = knoepfe.nth(0);
  expect(await wertVon(bereich)).not.toBe('');
  await waehle(bereich, 'risikomanagement');
  // P19-Prüfung N1: Zeile mit Bereich, aber ohne verantwortliche Person besetzt die Bahn nicht, F37 bleibt
  const zurZeile = new URL(page.url()).hash;
  await hash(page, '#/pruefung');
  await expect(page.locator('ul.befunde li[data-regel=F37]')).toHaveCount(1);
  await hash(page, zurZeile);
  await expect(editor).toBeVisible();
  await waehle(editor.locator(AUSWAHL).nth(1), { label: /Andrea Baumann/ });
  await expect(editor).toContainText('Risikomanagement');

  await hash(page, '#/pruefung');
  await expect(page.locator('ul.befunde li[data-regel=F37]')).toHaveCount(0);
});

test('C4-01: «Eintrag erfassen» auf E3-raci legt eine sichtbare Zeile mit Bereich an', async ({ page }) => {
  await starte(page);
  await oeffne(page, beispielOhneZeilen());
  await hash(page, '#/gefuehrt/E3/E3-raci');
  const zeilen = page.locator('section.eintrag');
  await expect(zeilen.first()).toBeVisible();
  const ids = () => zeilen.evaluateAll((l) => l.map((e) => e.id));
  const vorher = await ids();
  await page.getByRole('button', { name: 'Eintrag erfassen', exact: true }).click();
  // Bis 12 Zeilen stehen alle als Karte da, darüber die gewählte (die neue); in beiden Fällen ist die neue Zeile sichtbar
  await expect.poll(async () => (await ids()).filter((x) => !vorher.includes(x)).length).toBe(1);
  const neuId = (await ids()).find((x) => !vorher.includes(x))!;
  const neu = page.locator(`section.eintrag[id="${neuId}"]`);
  await expect(neu).toBeVisible();
  expect(await wertVon(neu.locator(AUSWAHL).first())).toBe('risikomanagement');
  await expect(neu.locator(AUSWAHL)).toHaveCount(4);
});
