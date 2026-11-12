// Runde 2: Weitere Nachprüfungen im Browser (C2-04, C2-11, C2-12, D-19, D-36).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test } from './app-hilfen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte } from './app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.skip(({ browserName }) => browserName !== 'chromium', 'Nur Chromium, Speichervorgabe der VM');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true });

const hash = (page: import('@playwright/test').Page, h: string) => page.evaluate((x) => (location.hash = x), h);

test('C2-11: Antwort «zertifiziert» steht danach auch in den Einstellungen', async ({ page }) => {
  await starte(page);
  await page.click('#start-neu');
  await page.locator('input[name=isms]').nth(0).check();
  await page.locator('input[name=modul]').nth(1).check();
  await page.click('#neu-anlegen');
  await hash(page, '#/einstellungen');
  await expect(page.locator('input[name=e-isms]').nth(0)).toBeChecked();
});

test('C2-04: Risiko aus dem Vorschlag trägt die Eigner/in des KI-Systems', async ({ page }) => {
  await starte(page);
  await oeffne(page, fixtureDatei('r2-c04.aims.json', false, (p) => {
    p.kiSysteme[0]!.generativ = true;
    p.kiSysteme[0]!.eigner = 'P-001';
    p.risiken = [];
  }));
  await hash(page, '#/gefuehrt/E6/E6-genai');
  await page.locator('[id^="vorschlag-"][id$="-uebernehmen"]').first().click();
  await expect(page.locator('#meldung')).toContainText('Eigner/in vom KI-System');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  const p = JSON.parse(readFileSync(await dl.path(), 'utf8')) as { risiken: { eigner?: string }[] };
  expect(p.risiken.at(-1)!.eigner).toBe('P-001');
});

test('C2-12: Leiste endet beim Wechsel über das Menü', async ({ page }) => {
  await starte(page);
  await oeffne(page, fixtureDatei('r2-c12.aims.json', false, (p) => {
    p.kiSysteme[0]!.eigner = '';
  }));
  await hash(page, '#/pruefung');
  await page.locator('.befunde li a.knopf').first().click();
  await expect(page.locator('#sprung-leiste')).toBeVisible();
  await hash(page, '#/einstellungen');
  await expect(page.locator('#sprung-leiste')).toHaveCount(0);
});

test('D-19: Tabellen haben Namen und Kopfzellen ihre Spaltenangabe', async ({ page }) => {
  await starte(page);
  await oeffne(page, join(REPO, 'src/beispiele/praezisionsteile.de.aims.json'));
  for (const h of ['#/gefuehrt/E2/E2-themen', '#/gefuehrt/E11/E11-kennzahlen', '#/wissen/leitfaden/03']) {
    await hash(page, h);
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => [...document.querySelectorAll('table')].filter((t) => t.getAttribute('role') !== 'presentation').map((t) => ({
      name: !!(t.getAttribute('aria-label') || t.getAttribute('aria-labelledby') || t.querySelector('caption')),
      ohneScope: t.querySelectorAll('th:not([scope])').length,
    })));
    expect(r.filter((x) => !x.name || x.ohneScope), h).toEqual([]);
  }
});

test('D-36: Suchliste bleibt bei 1280 x 720 im Bild', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await starte(page);
  await oeffne(page, join(REPO, 'src/beispiele/praezisionsteile.de.aims.json'));
  await hash(page, '#/gefuehrt/E4/E4-systeme');
  await page.locator('#suche').fill('ri');
  await expect(page.locator('#suche-liste')).toBeVisible();
  const unten = await page.locator('#suche-liste').evaluate((e) => e.getBoundingClientRect().bottom);
  expect(unten).toBeLessThanOrEqual(720);
});

// P14 Nacharbeit M1 (AF-104): F43 springt aus der Prüfung direkt ins Feld; Antrag, Entscheid, Entdeckung und Eindämmung
// sind im Guide erfassbar, danach ist F43 weg
test('P14: F43 PR-07 springt zu «Antrag am» im Inventar, nach der Eingabe ist der Befund weg', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('p14-pr07.aims.json', false, (p) => {
    p.kiSysteme[0]!.freigabe = { von: 'P-001', am: '2026-09-15' };
    p.kennzahlMessungen = [{ kennzahl: 'PR-07', datum: '2026-12-31', wert: '14 Tage', sollErreicht: 'nein' }];
  }));
  await hash(page, '#/pruefung');
  await page.locator('.befunde li[data-regel=F43] a.knopf').click();
  await expect(page).toHaveURL(/E4-ueberpruefung\?eintrag=KI-001&von=pruefung&feld=antragAm/);
  const antrag = page.locator('#f-E4-ueberpruefung-KI-001-antragAm');
  await expect(antrag).toBeFocused();
  await antrag.fill('2026-09-01');
  await page.locator('#f-E4-ueberpruefung-KI-001-entscheidAm').fill('2026-09-15');
  await hash(page, '#/pruefung');
  await expect(page.locator('.befunde li[data-regel=F43]')).toHaveCount(0);
  expect(fehler).toEqual([]);
});

test('P14: F43 PR-19 springt zur Eindämmung des Vorfalls; Zeitpunkte nur bei Vorfällen sichtbar', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('p14-pr19.aims.json', false, (p) => {
    p.feststellungen = [
      { id: 'F-001', quelle: 'vorfall', einstufung: 'nk-leicht', beschreibung: 'Falsche Antwort versendet', normbezug: 'A.8.4', korrektur: 'k', ursache: 'u', massnahmen: [], status: 'offen', datum: '2026-11-03', entdecktAm: '2026-11-03T09:40' },
      { id: 'F-002', quelle: 'audit', einstufung: 'beobachtung', beschreibung: 'Ablage uneinheitlich', normbezug: '7.5', korrektur: '', ursache: '', massnahmen: [], status: 'offen', datum: '2026-11-04' },
    ];
    p.kennzahlMessungen = [{ kennzahl: 'PR-19', datum: '2026-12-31', wert: '6 Stunden', sollErreicht: 'ja' }];
  }));
  await hash(page, '#/pruefung');
  await page.locator('.befunde li[data-regel=F43] a.knopf').click();
  await expect(page).toHaveURL(/E12-feststellungen\?eintrag=F-001&von=pruefung&feld=eingedaemmtAm/);
  const eindaemmung = page.locator('#f-E12-feststellungen-F-001-eingedaemmtAm');
  await expect(eindaemmung).toBeFocused();
  await expect(eindaemmung).toHaveAttribute('type', 'datetime-local');
  await expect(page.locator('#f-E12-feststellungen-F-001-entdecktAm')).toHaveValue('2026-11-03T09:40');
  await expect(page.locator('#f-E12-feststellungen-F-002-entdecktAm')).toHaveCount(0);
  await eindaemmung.fill('2026-11-03T15:10');
  await hash(page, '#/pruefung');
  await expect(page.locator('.befunde li[data-regel=F43]')).toHaveCount(0);
  expect(fehler).toEqual([]);
});

// V-09 (Designsystem AIMS Nachtblau, C4-07, C4-15): Fehlerzustand des Kontrollkästchens «kein Eintrag nötig». Fehlt der
// Pflichteintrag und ist der Haken nicht gesetzt, nennt die Meldung den Haken, das Kästchen ist ungültig markiert (aria-invalid,
// aria-describedby auf den Fehlertext) und trägt einen Rand von 2 px in der Statusfarbe kritisch.
test('V-09: «kein Eintrag nötig» leer: Kästchen mit aria-invalid, aria-describedby auf den Fehlertext und Rand 2 px', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('v09.aims.json', false, (p) => (p.risiken = p.risiken.filter((r) => r.art !== 'chance'))));
  await hash(page, '#/gefuehrt/E6/E6-chancen');
  const kaestchen = page.locator('#nicht-noetig');
  await expect(kaestchen).toBeVisible();
  await expect(kaestchen).not.toHaveAttribute('aria-invalid', 'true');
  await page.locator('.knoepfe').getByRole('button', { name: /^Weiter/ }).click();
  await expect(kaestchen).toHaveAttribute('aria-invalid', 'true');
  const beschrieben = await kaestchen.getAttribute('aria-describedby');
  expect(beschrieben).toBeTruthy();
  const text = page.locator(`[id="${beschrieben}"]`);
  await expect(text).toBeVisible();
  await expect(text).toContainText('kein Eintrag nötig');
  const rand = await page.locator('label.check:has(#nicht-noetig)').evaluate((l) => {
    const s = getComputedStyle(l);
    const probe = document.createElement('span');
    probe.style.color = 'var(--status-kritisch)';
    document.body.append(probe);
    const kritisch = getComputedStyle(probe).color;
    probe.remove();
    return { breite: s.borderTopWidth, farbe: s.borderTopColor, kritisch };
  });
  expect(rand.breite).toBe('2px');
  expect(rand.farbe).toBe(rand.kritisch);
  // Haken gesetzt: Fehlerzustand weg
  await kaestchen.check();
  await expect(kaestchen).not.toHaveAttribute('aria-invalid', 'true');
  expect(fehler).toEqual([]);
});
