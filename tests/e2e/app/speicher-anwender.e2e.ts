// P10 Speicher für Anwender, Bedienung im Browser (Chromium, Firefox, WebKit, file://): Zwischenstand wiederherstellen und der Zwischenstand
// über der Grenze (N5), Sicherung vor Migration (AF-004), nur lesend bei neuerer Version (AF-005), Hinweis beim ersten
// Zwischenstand, Schalter, Leeren und Beenden (AF-032). Die Einheitentests liegen in tests/unit/speicher-anwender.test.ts.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, starte, beantworteRueckfragen } from './app-hilfen.ts';
import { SCHEMA_VERSION } from '../../../src/model/typen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true });

const V1 = join(REPO, 'tests/fixtures/migration/v1.praezisionsteile.de.aims.json');
const V99 = join(REPO, 'tests/fixtures/migration/zu-neu.v99.aims.json');
const ZWISCHEN_DB = 'aims-manager';
const NORM_DB = 'aims-normpaket';

/** Neues Projekt über die Oberfläche; die Firma bekommt einen Namen, damit der Zwischenstand sich unterscheiden lässt. */
async function neuMitName(page: Page, name: string): Promise<void> {
  await page.click('#start-neu');
  await page.locator('input[name=isms]').nth(2).check();
  await page.locator('input[name=modul]').nth(1).check();
  await page.click('#neu-anlegen');
  await expect(page.locator('h1')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/E0-firma/);
  await page.fill('#f-E0-firma-organisation_name', name);
}

/** Schlüssel eines Objektspeichers der IndexedDB «name» (leer, wenn es sie nicht gibt) */
const idbSchluessel = (page: Page, db: string): Promise<string[]> =>
  page.evaluate(
    (name) =>
      new Promise<string[]>((ok, fehler) => {
        const r = indexedDB.open(name);
        r.onsuccess = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains('zwischenstaende')) {
            d.close();
            ok([]);
            return;
          }
          const q = d.transaction('zwischenstaende').objectStore('zwischenstaende').getAllKeys();
          q.onsuccess = () => {
            d.close();
            ok(q.result.map(String));
          };
          q.onerror = () => fehler(q.error);
        };
        r.onerror = () => fehler(r.error);
      }),
    db,
  );

/** Eintrag direkt in die IndexedDB schreiben (Vorbereitung: grosser Stand, Normpaket) */
const idbSchreiben = (page: Page, db: string, schluessel: string, wert: string): Promise<void> =>
  page.evaluate(
    ([name, k, w]) =>
      new Promise<void>((ok, fehler) => {
        const r = indexedDB.open(name, 1);
        r.onupgradeneeded = () => {
          if (!r.result.objectStoreNames.contains('zwischenstaende')) r.result.createObjectStore('zwischenstaende');
        };
        r.onsuccess = () => {
          const d = r.result;
          const tx = d.transaction('zwischenstaende', 'readwrite');
          tx.objectStore('zwischenstaende').put(w, k);
          tx.oncomplete = () => {
            d.close();
            ok();
          };
          tx.onerror = () => fehler(tx.error);
        };
        r.onerror = () => fehler(r.error);
      }),
    [db, schluessel, wert] as const,
  );

const neuLaden = async (page: Page) => {
  await page.reload();
  await page.waitForSelector('body[data-bedienbar]');
};

test('Zwischenstand wiederherstellen: nach dem Neuladen liegt er auf dem Start und bringt die Eingabe zurück', async ({ page }) => {
  const { fehler } = await starte(page);
  await neuMitName(page, 'Wiederherstellung AG');
  // Der Zwischenstand folgt nach zwei Sekunden; die Anzeige mit Zeit zeigt, dass er geschrieben ist
  await expect(page.locator('#speicherzeit')).toContainText(/Zwischenstand um \d\d:\d\d/, { timeout: 10_000 });
  expect(await idbSchluessel(page, ZWISCHEN_DB)).toHaveLength(1);

  await neuLaden(page);
  await page.evaluate(() => (location.hash = '#/start/projekte'));
  const abschnitt = page.locator('section[aria-labelledby=wh-titel]');
  await expect(abschnitt).toContainText('Wiederherstellung AG');
  await abschnitt.getByRole('button', { name: 'Weitermachen' }).click();
  // Das Projekt ist wieder da: ungespeichert, die Eingabe steht im Feld
  await expect(page).toHaveURL(/#\/gefuehrt\/E0/);
  await expect(page.locator('#f-E0-firma-organisation_name')).toHaveValue('Wiederherstellung AG');
  await expect(page.locator('#speicherstatus')).toHaveText('Ungespeicherte Änderungen');
  expect(fehler).toEqual([]);
});

test('Zwischenstand über der Grenze: Meldung mit Grenze, der Stand bleibt im Browser erhalten', async ({ page }) => {
  await starte(page);
  // 26 MB Inhalt: über der Grenze einer Projektdatei (25 MB), aber als Hülle lesbar
  const gross = JSON.stringify({ v: 1, schluessel: 'gross-1', dateiname: 'gross.aims.json', geaendertAm: new Date().toISOString(), inhalt: 'x'.repeat(26 * 1024 * 1024) });
  await idbSchreiben(page, ZWISCHEN_DB, 'aims-manager:zwischenstand:gross-1', gross);
  await neuLaden(page);
  await page.evaluate(() => (location.hash = '#/start/projekte'));
  const abschnitt = page.locator('section[aria-labelledby=wh-titel]');
  await expect(abschnitt).toContainText('gross.aims.json');
  await abschnitt.getByRole('button', { name: 'Weitermachen' }).click();
  const meldung = page.locator('#start-fehler');
  await expect(meldung).toBeVisible();
  await expect(meldung).toContainText('25 MB');
  await expect(meldung).toContainText('bleibt im Browser erhalten');
  // Nicht verworfen: Eintrag in der Ablage und in der Liste
  expect(await idbSchluessel(page, ZWISCHEN_DB)).toContain('aims-manager:zwischenstand:gross-1');
  await expect(abschnitt).toContainText('gross.aims.json');
  // Kein Projekt geöffnet, kein Dialog «unerwarteter Fehler»
  await expect(page.locator('#fehler-dialog')).toHaveCount(0);
});

test('AF-004: Datei der Version 1 wird gehoben, die Sicherung heisst <name>.vor-v1.aims.json und ist das unveränderte Original', async ({ page }) => {
  const { fehler } = await starte(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#start-oeffnen')]);
  await fc.setFiles(V1);
  await expect(page).toHaveURL(/#\/formular\/uebersicht/);
  const hinweis = page.locator('#hinweis-sicherung');
  await expect(hinweis).toBeVisible();
  await expect(hinweis).toContainText('Version 1');
  await expect(hinweis).toContainText(`Version ${SCHEMA_VERSION}`);
  await expect(hinweis).toContainText('v1.praezisionsteile.de.vor-v1.aims.json');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sicherung-ablegen')]);
  expect(dl.suggestedFilename()).toBe('v1.praezisionsteile.de.vor-v1.aims.json');
  expect(readFileSync(await dl.path(), 'utf8')).toBe(readFileSync(V1, 'utf8'));
  await expect(hinweis).toHaveCount(0);
  expect(fehler).toEqual([]);
});

test('AF-004: das Sicherungsangebot gehört zur geöffneten Datei und verschwindet mit dem Wechsel auf ein neues Projekt', async ({ page }) => {
  await starte(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#start-oeffnen')]);
  await fc.setFiles(V1);
  await expect(page.locator('#hinweis-sicherung')).toBeVisible();
  await page.evaluate(() => (location.hash = '#/start/projekte'));
  await beantworteRueckfragen(page, true);
  await neuMitName(page, 'Anderes Projekt');
  await expect(page.locator('#hinweis-sicherung')).toHaveCount(0);
});

test('AF-005: nur lesend geöffnet: Bibliothek legt nichts ab, aims-bibliothek bleibt leer', async ({ page }) => {
  await starte(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#start-oeffnen')]);
  await fc.setFiles(V99);
  await expect(page.locator('#hinweis-nur-lesen')).toBeVisible();
  await page.evaluate(() => (location.hash = '#/bibliothek'));
  await page.click('#bib-browser');
  await expect(page.locator('#meldung')).toContainText('Bibliothek bleibt unverändert');
  await page.setInputFiles('#bib-datei', { name: 'probe.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }).catch(() => undefined);
  await page.waitForTimeout(600);
  await expect(page.locator('#meldung')).not.toContainText('Abgelegte Dateien');
  const dateien = await page.evaluate(
    () =>
      new Promise<number>((ok) => {
        const r = indexedDB.open('aims-bibliothek');
        r.onupgradeneeded = () => undefined;
        r.onerror = () => ok(0);
        r.onsuccess = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains('dateien')) { d.close(); ok(0); return; }
          const q = d.transaction('dateien').objectStore('dateien').count();
          q.onsuccess = () => { d.close(); ok(q.result); };
        };
      }),
  );
  expect(dateien).toBe(0);
});

test('AF-005: nur lesend geöffnet: KI-Import übernimmt nichts in das offene Projekt, Meldung statt Erfolg', async ({ page }) => {
  await starte(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#start-oeffnen')]);
  await fc.setFiles(V99);
  await expect(page.locator('#hinweis-nur-lesen')).toBeVisible();
  await page.evaluate(() => (location.hash = '#/start/projekte'));
  await page.click('#ki-import-start');
  const auszug = { schemaVersion: 2, meta: { projektId: 'fixture-zu-neu-0001' }, organisation: { name: 'Von der KI geändert' } };
  await page.fill('#ki-import-text', JSON.stringify(auszug));
  await page.click('#ki-import-uebernehmen');
  await expect(page.locator('#meldung')).toContainText('Nichts übernommen');
  await expect(page.locator('#ki-teil-uebernehmen')).toHaveCount(0);
  await expect(page.locator('#speicherstatus')).toHaveText('Nur lesend');
  await page.evaluate(() => (location.hash = '#/einstellungen/projekt'));
  await expect(page.locator('#modul-aiact')).toBeVisible();
  await expect(page.locator('.start-projekt')).toHaveCount(0);
  await page.evaluate(() => (location.hash = '#/start'));
  await expect(page.locator('.start-projekt')).toContainText('Zukunft AG');
  await expect(page.locator('.start-projekt')).not.toContainText('Von der KI geändert');
});

test('AF-004: eine Datei der aktuellen Version braucht keine Sicherung', async ({ page }) => {
  await starte(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#start-oeffnen')]);
  await fc.setFiles(join(REPO, `tests/fixtures/migration/v${SCHEMA_VERSION}.praezisionsteile.de.aims.json`));
  await expect(page).toHaveURL(/#\/formular\/uebersicht/);
  await expect(page.locator('#hinweis-sicherung')).toHaveCount(0);
});

test('AF-005: Datei der Version 99 öffnet nur lesend, Speichern schreibt nichts', async ({ page }) => {
  const { fehler } = await starte(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#start-oeffnen')]);
  await fc.setFiles(V99);
  await expect(page).toHaveURL(/#\/formular\/uebersicht/);
  const hinweis = page.locator('#hinweis-nur-lesen');
  await expect(hinweis).toBeVisible();
  await expect(hinweis).toContainText('99');
  await expect(page.locator('#speicherstatus')).toHaveText('Nur lesend');
  // Schreibversuch über den Speicherstand und Ctrl+S: kein Download, Meldung
  let geladen = false;
  page.on('download', () => (geladen = true));
  await page.click('#speichern');
  await expect(page.locator('#meldung')).toContainText('Nichts gespeichert');
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(800);
  expect(geladen).toBe(false);
  // Nichts im Browserspeicher: weder Zwischenstand noch Hinweis darauf
  await page.waitForTimeout(2500);
  expect(await idbSchluessel(page, ZWISCHEN_DB)).toEqual([]);
  await expect(page.locator('#hinweis-browserspeicher')).toHaveCount(0);
  expect(fehler).toEqual([]);
});

test('AF-032: Hinweis beim ersten Zwischenstand, einmal bestätigt kommt er nicht wieder', async ({ page }) => {
  await starte(page);
  await neuMitName(page, 'Hinweis AG');
  const hinweis = page.locator('#hinweis-browserspeicher');
  await expect(hinweis).toBeVisible({ timeout: 10_000 });
  await expect(hinweis).toContainText('unverschlüsselt');
  // V-19: die Leiste ist einzeilig; die Frist von 30 Tagen steht in den Einstellungen, zu denen die Leiste führt
  await expect(page.locator('#speicher-hinweis-einstellungen')).toHaveAttribute('href', '#/einstellungen/speicher');
  await page.click('#speicher-hinweis-ok');
  await expect(hinweis).toHaveCount(0);
  await neuLaden(page);
  await neuMitName(page, 'Zweites Projekt');
  await expect(page.locator('#speicherzeit')).toContainText(/Zwischenstand um/, { timeout: 10_000 });
  await expect(page.locator('#hinweis-browserspeicher')).toHaveCount(0);
  await page.evaluate(() => (location.hash = '#/einstellungen/speicher'));
  await expect(page.locator('#einstellungen-speicher')).toContainText('30 Tagen');
});

test('AF-032: Schalter «keine Zwischenstände» legt nichts mehr ab', async ({ page }) => {
  await starte(page);
  await page.evaluate(() => (location.hash = '#/einstellungen/speicher'));
  await page.check('#zwischenspeicher-aus');
  await page.evaluate(() => (location.hash = '#/start'));
  await neuMitName(page, 'Ohne Zwischenstand AG');
  await page.waitForTimeout(3500);
  expect(await idbSchluessel(page, ZWISCHEN_DB)).toEqual([]);
  await expect(page.locator('#hinweis-browserspeicher')).toHaveCount(0);
});

test('AF-032: «Zwischenspeicher leeren» entfernt alle Schlüssel (Projekt, Logo, Normpaket)', async ({ page }) => {
  await starte(page);
  await neuMitName(page, 'Leeren AG');
  await expect(page.locator('#speicherzeit')).toContainText(/Zwischenstand um/, { timeout: 10_000 });
  // Normpaket und ein zweiter Stand mit Logo, wie sie nach längerer Arbeit im Browser liegen
  await idbSchreiben(page, NORM_DB, 'normpaket', JSON.stringify({ format: 'aims-normpaket', version: 1, teile: [], lizenz: { dokumente: false, lizenzgeber: 'x', lizenznummer: 'y' } }));
  const logo = 'data:image/png;base64,iVBORw0KGgo=';
  await idbSchreiben(page, ZWISCHEN_DB, 'aims-manager:zwischenstand:mit-logo', JSON.stringify({ v: 1, schluessel: 'mit-logo', dateiname: 'logo.aims.json', geaendertAm: new Date().toISOString(), inhalt: JSON.stringify({ organisation: { gestaltung: { logo: { png: logo } } } }) }));
  expect((await idbSchluessel(page, ZWISCHEN_DB)).length).toBeGreaterThanOrEqual(2);
  expect(await idbSchluessel(page, NORM_DB)).toEqual(['normpaket']);

  await beantworteRueckfragen(page, true, { einmal: true });
  await page.evaluate(() => (location.hash = '#/einstellungen/speicher'));
  await page.getByRole('button', { name: 'Zwischenspeicher leeren' }).click();
  await expect(page.locator('#meldung')).toContainText('Zwischenspeicher geleert');
  expect(await idbSchluessel(page, ZWISCHEN_DB)).toEqual([]);
  expect(await idbSchluessel(page, NORM_DB)).toEqual([]);
});

test('AF-032: Beenden schlägt das Leeren vor; mit OK ist nichts mehr im Browser, mit Abbrechen bleibt ein Zwischenstand', async ({ page }) => {
  await starte(page);
  await neuMitName(page, 'Beenden AG');
  await expect(page.locator('#speicherzeit')).toContainText(/Zwischenstand um/, { timeout: 10_000 });
  const fragen: string[] = [];
  // Ungespeicherte Änderungen: OK = beenden; Leeren: Abbrechen = Zwischenstand behalten
  await beantworteRueckfragen(page, (text) => {
    fragen.push(text);
    return fragen.length !== 2;
  });
  await page.click('#projekt-kachel');
  await page.click('#projekt-beenden');
  await expect(page).toHaveURL(/#\/start/);
  expect(fragen).toHaveLength(2);
  expect(fragen[1]).toContain('Zwischenspeicher dieses Browsers leeren');
  await expect(page.locator('#meldung')).toContainText('Zwischenstand bleibt im Browser');
  expect(await idbSchluessel(page, ZWISCHEN_DB)).toHaveLength(1);
  await page.evaluate(() => (location.hash = '#/start/projekte'));
  await expect(page.locator('section[aria-labelledby=wh-titel]')).toContainText('Beenden AG');

  // Zweiter Durchgang: Wiederherstellen und mit Leeren beenden
  await page.locator('section[aria-labelledby=wh-titel]').getByRole('button', { name: 'Weitermachen' }).click();
  await expect(page).toHaveURL(/#\/gefuehrt\/E0/);
  await beantworteRueckfragen(page, true);
  await page.click('#projekt-kachel');
  await page.click('#projekt-beenden');
  await expect(page.locator('#meldung')).toContainText('Zwischenspeicher ist geleert');
  expect(await idbSchluessel(page, ZWISCHEN_DB)).toEqual([]);
  await page.evaluate(() => (location.hash = '#/start/projekte'));
  await expect(page.locator('section[aria-labelledby=wh-titel]')).toHaveCount(0);
});
