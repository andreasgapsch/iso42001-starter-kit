// Befunde aus einem Rollentest als Regressionstests.
// Über file:// in Chromium, Firefox und WebKit.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test } from './app-hilfen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, bereichLink, fixtureDatei, oeffne, starte, untermenueLink } from './app-hilfen.ts';
import { waehle } from '../auswahl-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1440, height: 1000 } });

const geh = (page: Page, hash: string) => page.evaluate((h) => (location.hash = h), hash);

test.describe('RT-01 Druckansicht und Live-Vorschau mit KI-Systemen', () => {
  for (const isms of [false, true]) {
    test(`Druckansicht ${isms ? 'mit' : 'ohne'} ISMS: D-03, D-11, D-15 und D-09`, async ({ page }) => {
      const { fehler } = await starte(page);
      await oeffne(page, fixtureDatei(`druck-${isms}.aims.json`, isms));
      for (const id of ['D-03', 'D-11', 'D-15', 'D-09']) {
        await geh(page, '#/dokumente');
        const zeile = page.locator('tr', { has: page.locator('.marke-id', { hasText: new RegExp(`^${id}(-EB)?$`) }) }).first();
        await zeile.getByRole('button', { name: /Druckansicht/ }).click();
        await expect(page.locator('.karte .ir-vorschau, .karte table, .karte h1, .karte h2').first(), id).toBeVisible();
        await expect(page.getByText('Für dieses Dokument ist noch keine Vorschau verfügbar.'), id).toHaveCount(0);
        await page.getByRole('button', { name: 'Zurück' }).click();
      }
      expect(fehler).toEqual([]);
    });
  }

  test('Live-Vorschau im Guide zeigt das Dokument', async ({ page }) => {
    await starte(page);
    await oeffne(page, fixtureDatei('live.aims.json', true));
    await geh(page, '#/gefuehrt/E9/E9-nutzungsregeln');
    const vorschau = page.locator('details', { hasText: /Vorschau/ }).first();
    await vorschau.locator('summary').click();
    await expect(vorschau.locator('.vorschau')).toBeVisible({ timeout: 10_000 });
    await expect(vorschau.getByText(/keine Vorschau verfügbar/)).toHaveCount(0);
  });
});

test('RT-02 Externe Audits in der Formularansicht mit Feldern (Stage 1, Überwachung)', async ({ page }) => {
  await starte(page);
  await oeffne(page, fixtureDatei('audits.aims.json', false, (p) => {
    p.audits.push({ id: 'AU-002', art: 'extern-stage1', kombiniertMitIsms: false, geplant: '2027-03-02', auditor: 'Zertifizierungsstelle X', umfang: 'ganzes AIMS', kriterien: '42001', unabhaengigkeit: 'extern', ergebnis: '' } as never);
    p.audits.push({ id: 'AU-003', art: 'ueberwachung', kombiniertMitIsms: false, geplant: '2028-03-01', auditor: 'Zertifizierungsstelle X', umfang: 'AIMS', kriterien: '42001', unabhaengigkeit: 'extern', ergebnis: '' } as never);
  }));
  for (const id of ['AU-002', 'AU-003']) {
    await geh(page, `#/formular/audits/${id}`);
    const editor = page.locator('#editor-audits');
    await expect(editor.locator('input[type=date]').first(), id).toHaveValue(id === 'AU-002' ? '2027-03-02' : '2028-03-01');
    expect(await editor.locator('input').evaluateAll((es) => es.map((e) => (e as HTMLInputElement).value)), id).toContain('Zertifizierungsstelle X');
  }
});

test.describe('Rollentest: neue Sichten und Bedienung', () => {
  test('RT-35 Für Mitarbeitende: erlaubte Werkzeuge, beantragen, melden; Navigation', async ({ page }) => {
    const { fehler } = await starte(page);
    await oeffne(page, fixtureDatei('ma.aims.json', true));
    await bereichLink(page, 'Register').click();
    await untermenueLink(page, 'Für Mitarbeitende').click();
    await expect(page.locator('#mitarbeitende h1')).toHaveText('Für Mitarbeitende');
    for (const id of ['#ma-erlaubt', '#ma-beantragen', '#ma-melden']) await expect(page.locator(id)).toBeVisible();
    expect(fehler).toEqual([]);
  });

  test('RT-38 Generator nur einmal in der Navigation; RT-24 Register in der Formularansicht', async ({ page }) => {
    await starte(page);
    await oeffne(page, fixtureDatei('navi.aims.json', true));
    // Dokumente erzeugen gehört zur Bibliothek (Gruppe «Erzeugen»), der Generator steht nicht doppelt im Menü
    await bereichLink(page, 'Bibliothek').click();
    await expect(page.locator('nav a', { hasText: 'Dokumentengenerator' })).toHaveCount(0);
    await expect(untermenueLink(page, 'Dokumente erzeugen')).toHaveCount(1);
    await bereichLink(page, 'Register').click();
    await expect(page.locator('nav a', { hasText: 'Dokumentengenerator' })).toHaveCount(0);
    for (const [text, modul] of [['Nachweise', 'nachweise'], ['Feststellungen und Vorfälle', 'feststellungen'], ['Meldungen und Einsprüche', 'meldungen']] as const) {
      await untermenueLink(page, text).click();
      await expect(page).toHaveURL(new RegExp(`#/formular/${modul}`));
      await expect(page.locator('h1')).toHaveText(text);
    }
    await geh(page, '#/formular/audits');
    await expect(page.getByRole('heading', { name: /Auditprogramm/ })).toBeVisible();
  });

  test('RT-16 SoA: Spalte Umsetzung und Filter nach Status und KI-System; Suche über Angaben', async ({ page }) => {
    await starte(page);
    await oeffne(page, fixtureDatei('soa.aims.json', true));
    await geh(page, '#/formular/soa');
    const alle = Number((await page.locator('.liste-kopf .zweitext').textContent())!.match(/\d+/)![0]);
    await waehle(page.locator('#soa-filter button.auswahl').first(), 'umgesetzt');
    await expect(page.locator('.hinweis', { hasText: 'Gefiltert:' })).toBeVisible();
    const gefiltert = Number((await page.locator('.liste-kopf .zweitext').textContent())!.match(/\d+/)![0]);
    expect(gefiltert).toBeLessThan(alle);
    await geh(page, '#/formular/risiken');
    await page.locator('.liste-kopf input[type=search]').fill('KI-001');
    await expect(page.locator('.liste-kopf .zweitext')).not.toHaveText(/^0 /);
  });

  test('RT-14 Lagebild: Karte für die Geschäftsleitung', async ({ page }) => {
    await starte(page);
    await oeffne(page, fixtureDatei('gl.aims.json', true));
    await expect(page.locator('#lb-gl')).toBeVisible();
    await expect(page.locator('#lb-gl-stage1')).toBeVisible();
  });

  test('RT-04 Anlegen: ISMS und Modul ohne Vorbelegung; RT-08 Werkzeuge aus E0 im Inventar vorgeschlagen', async ({ page }) => {
    await starte(page);
    await page.click('#start-neu');
    await expect(page.locator('input[name=isms]:checked')).toHaveCount(0);
    await expect(page.locator('input[name=modul]:checked')).toHaveCount(0);
    await page.locator('input[name=isms]').nth(1).check();
    await page.locator('input[name=modul]').nth(0).check();
    await page.click('#neu-anlegen');
    await expect(page).toHaveURL(/#\/gefuehrt\/E0/);
    await geh(page, '#/gefuehrt/E0/E0-eu');
    await expect(page.locator('main input[type=radio]:checked')).toHaveCount(0);
    await geh(page, '#/gefuehrt/E0/E0-ki');
    const feld = page.locator('[id$="bekannteKiWerkzeuge"]');
    await feld.locator(':scope > button.klein').click();
    await feld.locator('input[type=text]').first().fill('ChatGPT Team');
    await geh(page, '#/gefuehrt/E4/E4-systeme');
    await expect(page.locator('#bekannte-werkzeuge')).toContainText('ChatGPT Team');
    await page.locator('#bekannte-werkzeuge button').click();
    await expect(page.locator('#bekannte-werkzeuge')).toHaveCount(0);
    await expect(page.locator('.eintrag h3', { hasText: 'ChatGPT Team' })).toHaveCount(1);
  });
});
