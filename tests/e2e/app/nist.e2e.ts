// AIMS-Manager ab rc.2: Modul NIST AI RMF (Profil, Zusatz-Controls, Seiten im Guide, aus und ein ohne
// Datenverlust) und neue Kernfelder (Vorschläge GenAI-Sicherheit, handelnde KI, Sprung aus der Prüfung).
// Über file:// in Chromium, Firefox und WebKit.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test } from './app-hilfen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte, untermenueLink, waehleSprache } from './app-hilfen.ts';
import { waehle } from '../auswahl-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true });

const geh = (page: Page, hash: string) => page.evaluate((h) => (location.hash = h), hash);

test('Modul NIST AI RMF: Profil, Zusatz-Controls, Seiten im Guide, aus und ein ohne Datenverlust', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('nist.aims.json', false, (p) => (p.kiSysteme[0]!.generativ = true)));
  // Ausgeschaltet: kein Eintrag im Untermenü des Registers, Hinweis in der Ansicht, Seite im Guide mit Bedingung
  await geh(page, '#/formular/organisation');
  await expect(untermenueLink(page, 'Organisation')).toHaveAttribute('aria-current', 'page');
  await expect(untermenueLink(page, 'NIST AI RMF')).toHaveCount(0);
  await geh(page, '#/formular/nistrmf');
  await expect(page.locator('.ersatz')).toContainText('ausgeschaltet');
  await geh(page, '#/gefuehrt/E8/E8-rmf');
  await expect(page.locator('#nicht-zutreffend')).toContainText('Modul NIST AI RMF');
  // Einschalten
  await geh(page, '#/einstellungen');
  await page.check('#modul-nist');
  await geh(page, '#/formular/organisation');
  await expect(untermenueLink(page, 'NIST AI RMF')).toHaveCount(1);
  // Profil: Ist-Vorschlag übernehmen, Ziel setzen
  await geh(page, '#/formular/nistrmf');
  await page.click('#nist-vorschlaege');
  await expect(page.locator('#meldung')).toContainText('Ist-Vorschlag für 72 Subkategorien übernommen');
  await page.click('#nist-funktion-govern > summary');
  await waehle(page.locator('#nist-GV-1_1-ziel'), '3');
  await page.fill('#nist-GV-1_1-notiz', 'Kundenfragebogen USA');
  // Zusatz-Controls: RMF-01 übernehmen
  await page.click('#reiter-controls');
  await page.click('#rmf-uebernehmen-RMF-01');
  await expect(page.locator('#rmf-RMF-01 .pille')).toHaveText('in der SoA als anwendbar');
  await expect(page.locator('#rmf-RMF-G01')).toBeVisible();
  // Guide: E8-rmf zeigt die Vorschläge (G-Controls für generative KI siehe Reiter Zusatz-Controls)
  await geh(page, '#/gefuehrt/E8/E8-rmf');
  await expect(page.locator('#seitentitel')).toHaveText('Zusatz-Controls NIST AI RMF');
  await expect(page.locator('.vliste')).toContainText('RMF-01');
  await geh(page, '#/gefuehrt/E0/E0-fahrplan');
  await expect(page.locator('#fahrplan-nist')).toContainText('3 bis 5');
  // Ausschalten: Navigation, Seiten und RMF-Controls in der SoA verschwinden
  await geh(page, '#/einstellungen');
  await page.uncheck('#modul-nist');
  await geh(page, '#/formular/organisation');
  await expect(untermenueLink(page, 'Organisation')).toHaveAttribute('aria-current', 'page');
  await expect(untermenueLink(page, 'NIST AI RMF')).toHaveCount(0);
  await geh(page, '#/formular/soa');
  await expect(page.locator('.vliste')).not.toContainText('RMF-01');
  await geh(page, '#/gefuehrt/E12/E12-rmf-profil');
  await expect(page.locator('#nicht-zutreffend')).toBeVisible();
  // Wieder ein: Angaben sind erhalten
  await geh(page, '#/einstellungen');
  await page.check('#modul-nist');
  await geh(page, '#/formular/nistrmf');
  await page.click('#nist-funktion-govern > summary');
  await expect(page.locator('#nist-GV-1_1-ziel')).toHaveAttribute('data-wert', '3');
  await expect(page.locator('#nist-GV-1_1-notiz')).toHaveValue('Kundenfragebogen USA');
  await geh(page, '#/formular/nistrmf/controls');
  await expect(page.locator('#rmf-RMF-01 .pille')).toHaveText('in der SoA als anwendbar');
  // Gespeicherte Datei enthält Profil und Control
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#speichern')]);
  const gespeichert = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  expect(gespeichert.meta.modulNistRmf).toBe(true);
  expect(gespeichert.nistProfil['GV-1.1']).toMatchObject({ ziel: 3, notiz: 'Kundenfragebogen USA' });
  expect(Object.keys(gespeichert.nistProfil)).toHaveLength(72);
  expect(gespeichert.controls.find((c: { id: string }) => c.id === 'RMF-01')).toMatchObject({ rahmenwerk: 'NISTRMF', anwendbar: 'ja', vorschlag: 'nistrmf' });
  expect(fehler).toEqual([]);
});

test('Originaltexte NIST: Profil, Zusatz-Controls, E9-genai, E9-messkonzept und Hilfe mit Sprung ins PDF, DE und EN', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('nist.aims.json', false, (p) => {
    p.meta.modulNistRmf = true;
    p.kiSysteme[0]!.generativ = true;
  }));
  // Profil: Funktion und Subkategorie mit Originaltext (Englisch), Übersetzung und Vermerk, Quelle mit Seite im PDF
  await geh(page, '#/formular/nistrmf');
  await page.click('#nist-funktion-govern > summary');
  const zeile = page.locator('#nist-GV-1_1');
  await zeile.locator('details.nist-original > summary').click();
  await expect(zeile.locator('blockquote[lang="en"]')).toHaveText('Legal and regulatory requirements involving AI are understood, managed, and documented.');
  await expect(zeile.locator('.nist-uebersetzung')).toContainText('Übersetzung KMU-CIO, nicht amtlich');
  await expect(zeile.locator('.nist-vermerk')).toContainText('Republished courtesy of the National Institute of Standards and Technology.');
  await expect(zeile.locator('.nist-vermerk a')).toHaveAttribute('href', '../Rechtstexte_Legal-Texts/NIST-AI-RMF/NIST.AI.100-1_AI-RMF-1.0.pdf#page=27');
  await expect(page.locator('#nist-funktion-govern > details.nist-original blockquote')).toContainText('GOVERN is a cross-cutting function');
  // Zusatz-Controls: Subkategorien und Massnahmen aus 600-1 wörtlich
  await page.click('#reiter-controls');
  await page.click('#rmf-original-RMF-02 > summary');
  await expect(page.locator('#rmf-original-RMF-02 [data-zitat="ai-600-1:GV-1.7-002"] blockquote')).toContainText('Consider the following factors when decommissioning GAI systems');
  await expect(page.locator('#rmf-original-RMF-02 [data-zitat="ai-100-1:GV-1.7"] a')).toHaveAttribute('href', /NIST\.AI\.100-1_AI-RMF-1\.0\.pdf#page=28$/);
  // E9-genai: die zwölf Risiken mit Originaltitel und Beschreibung; Hilfe mit Sprung in AI 600-1
  await geh(page, '#/gefuehrt/E9/E9-genai');
  await page.click('#nist-original-risiken > summary');
  await expect(page.locator('#nist-original-risiken blockquote')).toHaveCount(12);
  await expect(page.locator('#nist-original-risiken [data-zitat="ai-600-1:gai-konfabulation"] blockquote')).toContainText('Confabulation: The production of confidently stated');
  await expect(page.locator('#nist-original-risiken .nist-vermerk')).toHaveCount(1);
  await expect(page.locator('aside.hilfe a', { hasText: 'NIST AI 600-1, S. 8' })).toHaveAttribute('href', '../Rechtstexte_Legal-Texts/NIST-AI-RMF/NIST.AI.600-1_GenAI-Profile.pdf#page=8');
  // E9-messkonzept: Vertrauensmerkmale und MEASURE 2
  await geh(page, '#/gefuehrt/E9/E9-messkonzept');
  await page.click('#nist-original-merkmale > summary');
  await expect(page.locator('#nist-original-merkmale blockquote')).toHaveCount(7);
  await expect(page.locator('#nist-original-messen blockquote')).toHaveCount(13);
  // Englische Oberfläche: Originaltext ohne Übersetzung
  await waehleSprache(page, 'en');
  await geh(page, '#/formular/nistrmf');
  await page.click('#nist-funktion-govern > summary');
  await page.locator('#nist-GV-1_1 details.nist-original > summary').click();
  await expect(page.locator('#nist-GV-1_1 blockquote[lang="en"]')).toBeVisible();
  await expect(page.locator('#nist-GV-1_1 .nist-uebersetzung')).toHaveCount(0);
  await expect(page.locator('#nist-GV-1_1 .nist-vermerk a')).toHaveText('NIST AI 100-1, p. 27');
  expect(fehler).toEqual([]);
});

test('Kernfelder ab rc.2: Vorschläge GenAI-Sicherheit, handelnde KI, Sprung aus der Prüfung', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('kern-rc2.aims.json', false, (p) => {
    p.kiSysteme[0]!.generativ = true;
    p.kiSysteme[0]!.handlungsbefugnis = 'handelt-mehrstufig';
  }));
  // Vorschlag GS-01 als Risiko übernehmen
  await geh(page, '#/gefuehrt/E6/E6-genai');
  await page.click('#vorschlag-GS-01-uebernehmen');
  await expect(page.locator('#vorschlag-GS-01 .hinweis')).toContainText('Übernommen als R-002');
  await geh(page, '#/formular/risiken/R-002');
  await expect(page.locator('#editor-risiken')).toContainText('R-002');
  // Prüfung: H28 (handelnde KI ohne Stoppmöglichkeit) führt im Guide auf E4-handlung
  await geh(page, '#/gefuehrt/E13/E13-pruefung');
  await page.locator('.befunde li', { hasText: 'H28' }).locator('a').first().click();
  await expect(page).toHaveURL(/#\/gefuehrt\/E4\/E4-handlung/);
  const feld = page.locator('#eintrag-KI-001 [data-feld=stoppmoeglichkeit] textarea');
  await feld.fill('Konnektor im Admin-Center deaktivieren');
  await geh(page, '#/formular/inventar/KI-001');
  await expect(page.locator('#editor-kiSysteme [data-feld=stoppmoeglichkeit] textarea')).toHaveValue('Konnektor im Admin-Center deaktivieren');
  expect(fehler).toEqual([]);
});

test('Barrierefreiheit der Ansichten des Moduls NIST AI RMF (axe, WCAG 2.1 AA)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'axe einmal genügt');
  await starte(page);
  await oeffne(page, fixtureDatei('a11y-nist.aims.json', false, (p) => {
    p.meta.modulNistRmf = true;
    p.kiSysteme[0]!.generativ = true;
  }));
  for (const h of ['#/formular/nistrmf', '#/formular/nistrmf/controls', '#/gefuehrt/E9/E9-messkonzept', '#/gefuehrt/E8/E8-rmf', '#/formular/nistrmf/stand', '#/gefuehrt/E12/E12-rmf-profil', '#/gefuehrt/E6/E6-genai', '#/gefuehrt/E9/E9-genai', '#/gefuehrt/E3/E3-entscheidungsrechte']) {
    await geh(page, h);
    await page.waitForTimeout(200);
    if (h.includes('rmf-profil') || h === '#/formular/nistrmf') {
      await page.click('#nist-funktion-govern > summary');
      await page.locator('#nist-GV-1_1 details.nist-original > summary').click();
    }
    // Originaltexte aufgeklappt prüfen (Kontrast, Sprache lang="en")
    for (const d of await page.locator('details.nist-original:not([open]) > summary').all()) if (await d.isVisible()) await d.click();
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(r.violations.map((v) => `${h}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
  }
});
