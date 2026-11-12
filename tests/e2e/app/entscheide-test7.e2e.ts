// Fachliche Entscheide zum Guide, drei Engines:
// C4-05 sensible Nutzung aus der Folgenabschätzung nur mit Knopf «Ins Inventar übernehmen», nie automatisch;
// C4-06 Kurzprüfung in E7 mit Vorschlägen aus dem Inventar, gesetzt erst mit «Vorschlag übernehmen»;
// C4-04 Rest: mit ISMS bietet E8 «Behandlung je Risiko» passende ISO-27001-Controls aus der Zuordnung 42001 zu 27001 an.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import type { Folgenabschaetzung, Projekt } from '../../../src/model/typen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte, test } from './app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', viewport: { width: 1440, height: 900 }, acceptDownloads: true });

const geh = (page: Page, hash: string) => page.evaluate((h) => (location.hash = h), hash);

/** Projekt über «Speichern» herunterladen und lesen: was wirklich in der Datei steht */
async function gespeichert(page: Page): Promise<Projekt> {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#speichern')]);
  return JSON.parse(readFileSync((await dl.path())!, 'utf8')) as Projekt;
}

function abschaetzung(teil: Partial<Folgenabschaetzung>): Folgenabschaetzung {
  return {
    id: 'IA-001', kiSystem: 'KI-001',
    triage: { rechtspositionOderChancen: true, gesundheitOderSicherheit: false, verletzlicheGruppen: false, besondereDaten: false, automatisierteEntscheidung: false, grosseReichweite: false, ergebnis: 'voll', begruendung: 'Wirkt auf Chancen von Bewerbenden.' },
    systembeschreibung: '', verwendungen: '', fehlanwendungen: '', daten: '', einsatzumfeld: '', betroffene: [], nutzenSchaden: {},
    ausfaelle: '', massnahmen: '', sensibleNutzung: true, eingeschraenkteNutzung: false, ergebnis: 'Einsatz mit Auflagen.',
    naechsteUeberpruefung: '2027-10-01',
    ...teil,
  };
}

test('C4-05: Widerspruch zum Inventar sichtbar, erst «Ins Inventar übernehmen» ändert das Inventar', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('c4-05.aims.json', false, (p) => {
    p.kiSysteme[0]!.sensibleNutzung = false;
    p.folgenabschaetzungen = [abschaetzung({})];
  }));
  await geh(page, '#/gefuehrt/E7/E7-ergebnis');
  const hinweis = page.locator('#sensibel-abgleich-KI-001');
  await expect(hinweis).toBeVisible();
  await expect(hinweis).toContainText('KI-001');
  await expect(hinweis).toContainText('Sensible Nutzung: Nein');
  // Anzeigen allein ändert nichts
  expect((await gespeichert(page)).kiSysteme[0]!.sensibleNutzung).toBe(false);
  await hinweis.getByRole('button', { name: 'Ins Inventar übernehmen' }).click();
  await expect(hinweis).toBeHidden();
  await expect(page.locator('#meldung')).toContainText('KI-001');
  const p = await gespeichert(page);
  expect(p.kiSysteme[0]!.sensibleNutzung).toBe(true);
  // Die Abschätzung selbst bleibt, wie sie war
  expect(p.folgenabschaetzungen[0]!.sensibleNutzung).toBe(true);
  expect(fehler).toEqual([]);
});

test('C4-05: kein Hinweis, wenn Inventar und Abschätzung übereinstimmen', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('c4-05-gleich.aims.json', false, (p) => {
    p.kiSysteme[0]!.sensibleNutzung = true;
    p.folgenabschaetzungen = [abschaetzung({})];
  }));
  await geh(page, '#/gefuehrt/E7/E7-ergebnis');
  await expect(page.locator('h1#seitentitel')).toHaveText('Ergebnis');
  await expect(page.locator('[id^=sensibel-abgleich-]')).toHaveCount(0);
  expect(fehler).toEqual([]);
});

// Prüfung test.7 N3: zwei Abschätzungen je System. Der Guide zeigt die erste, massgebend ist die jüngste (wie F47)
test('C4-05: mit zwei Abschätzungen zählt die jüngste, auch wenn der Guide die ältere zeigt', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('c4-05-zwei.aims.json', false, (p) => {
    p.kiSysteme[0]!.sensibleNutzung = false;
    p.folgenabschaetzungen = [
      abschaetzung({ sensibleNutzung: false, freigabe: { von: 'P-001', am: '2026-01-15' } }),
      abschaetzung({ id: 'IA-002', sensibleNutzung: true, freigabe: { von: 'P-001', am: '2026-10-05' } }),
    ];
  }));
  await geh(page, '#/gefuehrt/E7/E7-ergebnis');
  const hinweis = page.locator('#sensibel-abgleich-KI-001');
  await expect(hinweis).toContainText('IA-002');
  await hinweis.getByRole('button', { name: 'Ins Inventar übernehmen' }).click();
  await expect(hinweis).toBeHidden();
  // Fokus auf der Antwort «Sensible Nutzung» statt auf body (N8)
  expect(await page.evaluate(() => document.activeElement?.closest('.feld')?.getAttribute('data-feld'))).toBe('sensibleNutzung');
  expect((await gespeichert(page)).kiSysteme[0]!.sensibleNutzung).toBe(true);
  expect(fehler).toEqual([]);
});

test('C4-06: Kurzprüfung zeigt Antworten aus dem Inventar als Vorschlag, gesetzt erst mit «Vorschlag übernehmen»', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('c4-06.aims.json', false, (p) => {
    p.kiSysteme[0]!.besondereDaten = true;
    p.kiSysteme[0]!.automatisierung = 'vollautomatisiert';
    p.folgenabschaetzungen = [];
  }));
  await geh(page, '#/gefuehrt/E7/E7-triage');
  const daten = page.locator('#inventar-vorschlag-KI-001-triage_besondereDaten');
  const auto = page.locator('#inventar-vorschlag-KI-001-triage_automatisierteEntscheidung');
  await expect(daten).toContainText('Vorschlag aus dem KI-Inventar: Ja');
  await expect(auto).toContainText('Vorschlag aus dem KI-Inventar: Ja');
  // Für Fragen ohne Angabe im Inventar gibt es keinen Vorschlag
  await expect(page.locator('[id^=inventar-vorschlag-]')).toHaveCount(2);
  // Nicht still vorbelegt: keine Antwort gewählt, nichts in der Datei
  const feld = page.locator('section.eintrag .feld[data-feld="triage.besondereDaten"]');
  await expect(feld.locator('input[type=radio]:checked')).toHaveCount(0);
  expect((await gespeichert(page)).folgenabschaetzungen).toEqual([]);
  await daten.getByRole('button', { name: 'Vorschlag übernehmen' }).click();
  await expect(daten).toBeHidden();
  await expect(feld.locator('input[type=radio]').first()).toBeChecked();
  // N8: Fokus auf der gesetzten Antwort, Meldung für Bildschirmleser
  await expect(feld.locator('input[type=radio]').first()).toBeFocused();
  await expect(page.locator('#meldung')).toContainText('übernommen');
  await expect(auto).toBeVisible();
  const t = (await gespeichert(page)).folgenabschaetzungen[0]!.triage;
  expect(t.besondereDaten).toBe(true);
  // Die zweite Frage bleibt offen, bis die Person sie beantwortet
  expect(t.automatisierteEntscheidung).toBeUndefined();
  expect(fehler).toEqual([]);
});

test('C4-04: mit ISMS schlägt E8 passende ISO-27001-Controls vor; ein Klick verknüpft sie beim 42001-Control', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('c4-04.aims.json', true));
  await geh(page, '#/gefuehrt/E8/E8-behandlung');
  const box = page.locator('#controls27001-vorschlaege-R-001');
  await expect(box).toBeVisible();
  // A.9.2: 27001 5.10 (hoch), 6.3 und 8.12 (mittel) nach src/kataloge/mapping-42001-27001.yaml
  for (const nr of ['5.10', '6.3', '8.12']) await expect(box.getByRole('button', { name: `ISO/IEC 27001 ${nr} verknüpfen` })).toBeVisible();
  await box.getByRole('button', { name: 'ISO/IEC 27001 5.10 verknüpfen' }).click();
  await expect(box.getByRole('button', { name: 'ISO/IEC 27001 5.10 verknüpfen' })).toHaveCount(0);
  await expect(box.getByRole('button', { name: 'ISO/IEC 27001 6.3 verknüpfen' })).toBeFocused();
  await expect(page.locator('#meldung')).toContainText('27001 5.10');
  const p = await gespeichert(page);
  expect(p.controls.find((c) => c.id === 'A.9.2')!.iso27001).toEqual(['27001-5.10']);
  // Die Controls des Risikos selbst bleiben unverändert
  expect(p.risiken[0]!.controls).toEqual(['A.9.2']);
  expect(fehler).toEqual([]);
});

test('C4-04: ohne ISMS keine Vorschläge aus der ISO/IEC 27001', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('c4-04-ohne.aims.json', false));
  await geh(page, '#/gefuehrt/E8/E8-behandlung');
  await expect(page.locator('#eintrag-R-001')).toBeVisible();
  await expect(page.locator('[id^=controls27001-vorschlaege-]')).toHaveCount(0);
  expect(fehler).toEqual([]);
});

// Wackler «Prüfseite im Guide» (test.6, Chromium unter Last): Die Freigabe schrieb das Datum mit dem Stand der letzten Zeichnung
// zusammen. Folgt das Datum der Person, bevor neu gezeichnet ist, ging die Person verloren und «Weiter» meldete das Feld als
// offen. Hier beide Eingaben in derselben Aufgabe des Browsers, also sicher vor dem nächsten Zeichnen.
test('Freigabe: Person und Datum in schneller Folge bleiben beide erhalten', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('freigabe-schnell.aims.json', false, (p) => { delete p.organisation.geltungsbereich.freigabe; }));
  await geh(page, '#/gefuehrt/E2/E2-freigabe');
  const feld = page.locator('.feld[data-feld="organisation.geltungsbereich.freigabe"]');
  await expect(feld.locator('button.auswahl[role=combobox]')).toHaveAttribute('data-wert', '');
  await feld.locator('button.auswahl[role=combobox]').click();
  await expect(page.locator('[role=listbox]:visible [role=option]').nth(1)).toBeVisible();
  await page.evaluate(() => {
    const option = document.querySelectorAll<HTMLElement>('[role=listbox]:not([hidden]) [role=option]')[1]!;
    option.click();
    const datum = document.querySelector<HTMLInputElement>('.feld[data-feld="organisation.geltungsbereich.freigabe"] input[type=date]')!;
    datum.value = '2026-10-05';
    datum.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(feld.locator('button.auswahl[role=combobox]')).toHaveAttribute('data-wert', 'P-001');
  await expect(feld.locator('input[type=date]')).toHaveValue('2026-10-05');
  expect((await gespeichert(page)).organisation.geltungsbereich.freigabe).toEqual({ von: 'P-001', am: '2026-10-05' });
  expect(fehler).toEqual([]);
});
