// Rahmen ab rc.10 (R2, R6, R8): Symbolleiste mit Hauptbereichen, Untermenü (Einklappen gemerkt, unter 900 px als
// Überlagerung), Abbildung der bisherigen Hash-Routen auf die Bereiche, Tastatur («/», Pfeiltasten, «g» dann Buchstabe),
// globale Suche (gruppiert, Tastatur), Darstellung (dunkel als Standard, bisherige Wahl bleibt) und axe hell und dunkel.
// Über file:// in Chromium, Firefox und WebKit.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test } from './app-hilfen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, bereichLink, fixtureDatei, oeffne, starte, untermenueLink, waehleTheme } from './app-hilfen.ts';

const MUSTER = join(REPO, 'src/beispiele/muster-maschinenbau.de.aims.json');
test.skip(!existsSync(join(REPO, HTML)) || !existsSync(MUSTER), 'Werkzeug nicht gebaut (npm run build:app) oder Beispiel fehlt');
test.use({ locale: 'de-CH', viewport: { width: 1440, height: 900 } });

const geh = async (page: Page, hash: string) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(120);
};

async function muster(page: Page): Promise<{ fehler: string[] }> {
  // Sprache aus der Browsersprache (locale de-CH)
  const r = await starte(page);
  await oeffne(page, MUSTER);
  return r;
}

async function axe(page: Page, ort: string): Promise<string[]> {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return r.violations.map((v) => `${ort}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`);
}

const hauptbereiche = (page: Page) => page.getByRole('navigation', { name: 'Hauptbereiche' });
const unterbereiche = (page: Page) => page.getByRole('navigation', { name: /^Unterbereiche:/ });

test('Hauptbereiche: Symbolleiste, Untermenü mit Titel und aktuellem Eintrag', async ({ page }) => {
  const { fehler } = await muster(page);
  const erwartet: [string, RegExp, string][] = [
    ['Start', /#\/start$/, 'Willkommen'],
    ['Übersicht', /#\/formular\/uebersicht$/, 'Lagebild'],
    ['Guide', /#\/gefuehrt$/, 'Überblick'],
    ['Register', /#\/formular\/organisation$/, 'Organisation'],
    ['Prozesse', /#\/prozesse$/, 'Alle Prozesse'],
    ['Wissen', /#\/wissen$/, '1 Was ein Minimal Viable AIMS'],
    ['Prüfung', /#\/pruefung$/, 'Prüfregeln'],
    ['Hinweise', /#\/hinweise$/, 'Alle Hinweise'],
    ['Hilfe', /#\/hilfe$/, 'Kurzanleitung'],
    ['Einstellungen', /#\/einstellungen$/, 'Alle Einstellungen'],
  ];
  for (const [bereich, url, punkt] of erwartet) {
    await bereichLink(page, bereich).click();
    await expect(page, bereich).toHaveURL(url);
    await expect(bereichLink(page, bereich)).toHaveAttribute('aria-current', 'true');
    await expect(hauptbereiche(page).locator('[aria-current]')).toHaveCount(1);
    await expect(unterbereiche(page)).toHaveAccessibleName(`Unterbereiche: ${bereich}`);
    await expect(page.locator('#untermenue-titel')).toHaveText(bereich);
    await expect(untermenueLink(page, punkt)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('main h1')).toBeVisible();
  }
  // Bibliothek als eigener Bereich (Ansicht der Bibliothek oder Platzhalter)
  await bereichLink(page, 'Bibliothek').click();
  await expect(page).toHaveURL(/#\/bibliothek/);
  await expect(bereichLink(page, 'Bibliothek')).toHaveAttribute('aria-current', 'true');
  await expect(unterbereiche(page)).toHaveAccessibleName('Unterbereiche: Bibliothek');
  await expect(untermenueLink(page, 'Dokumente erzeugen')).toBeVisible();
  // Register: Gruppen Grundlagen, Umsetzung, Bewertung, Module (Beispiel mit beiden Modulen und ISMS)
  await bereichLink(page, 'Register').click();
  await expect(unterbereiche(page).locator('.ugruppe-titel')).toHaveText(['Grundlagen', 'Umsetzung', 'Bewertung', 'Module']);
  await expect(untermenueLink(page, 'KI-Inventar')).toHaveAccessibleName(/^KI-Inventar\s*,\s*\d+$/);
  // Guide: Etappen 0 bis 13 mit Stand und der Jahreskalender
  await bereichLink(page, 'Guide').click();
  await expect(unterbereiche(page).locator('.schritt')).toHaveCount(14);
  await expect(untermenueLink(page, '4 KI-Inventar')).toHaveAccessibleName(/^4 KI-Inventar\s*,\s*(offen|läuft|erledigt)$/);
  await untermenueLink(page, '4 KI-Inventar').click();
  await expect(page).toHaveURL(/#\/gefuehrt\/E4$/);
  await expect(untermenueLink(page, '4 KI-Inventar')).toHaveAttribute('aria-current', 'page');
  await expect(untermenueLink(page, 'Jahreskalender')).toBeVisible();
  expect(fehler).toEqual([]);
});

test('Bisherige Hash-Routen bleiben gültig und gehören zum passenden Bereich', async ({ page }) => {
  const { fehler } = await muster(page);
  const routen: [string, string, string | null][] = [
    ['#/formular/risiken', 'Register', 'Risiken'],
    ['#/formular/inventar/KI-001', 'Register', 'KI-Inventar'],
    ['#/formular/soa/A.2.2', 'Register', 'Erklärung zur Anwendbarkeit'],
    ['#/formular/aiact/fristen', 'Register', 'EU AI Act'],
    ['#/formular/mitarbeitende', 'Register', 'Für Mitarbeitende'],
    ['#/formular/uebersicht', 'Übersicht', 'Lagebild'],
    ['#/gefuehrt/E4/E4-systeme', 'Guide', '4 KI-Inventar'],
    ['#/gefuehrt/J/J-kalender', 'Guide', 'Jahreskalender'],
    ['#/prozesse/PR-07', 'Prozesse', 'Alle Prozesse'],
    ['#/prozesse?ansicht=karte', 'Prozesse', 'Landkarte'],
    ['#/pruefung', 'Prüfung', 'Prüfregeln'],
    ['#/dokumente', 'Bibliothek', 'Dokumente erzeugen'],
    ['#/einstellungen/gestaltung', 'Einstellungen', 'Dokumentgestaltung'],
    ['#/ueber', 'Einstellungen', 'Über'],
  ];
  for (const [hash, bereich, punkt] of routen) {
    await geh(page, hash);
    await expect(bereichLink(page, bereich), hash).toHaveAttribute('aria-current', 'true');
    if (punkt) await expect(untermenueLink(page, punkt), hash).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('main h1'), hash).toBeVisible();
  }
  expect(fehler).toEqual([]);
});

/** Alle Arten von Routen mit offenem Projekt (AF-017): je eine Adresse pro Ansicht des Routers */
const ALLE_ROUTEN = [
  '#/start', '#/start/projekte', '#/gefuehrt', '#/gefuehrt/E4/E4-systeme', '#/gefuehrt/J/J-kalender', '#/formular/uebersicht', '#/formular/risiken',
  '#/formular/inventar/KI-001', '#/formular/soa/A.2.2', '#/formular/aiact/fristen', '#/formular/mitarbeitende', '#/uebersicht/faellig', '#/uebersicht/bereitschaft',
  '#/pruefung', '#/pruefung/stage1', '#/dokumente', '#/prozesse', '#/prozesse/PR-07', '#/bibliothek', '#/bibliothek/alle', '#/hinweise',
  '#/wissen', '#/wissen/glossar', '#/hilfe', '#/hilfe/tasten', '#/einstellungen', '#/einstellungen/projekt', '#/einstellungen/darstellung',
  '#/einstellungen/gestaltung', '#/einstellungen/normtexte', '#/einstellungen/speicher', '#/ueber',
];

test('AF-017: Speicherstand mit Zeit steht auf allen Routen (100 % der Routenliste)', async ({ page }) => {
  const { fehler } = await muster(page);
  const fehlt: string[] = [];
  const pruefe = async (zeit: RegExp | null) => {
    for (const hash of ALLE_ROUTEN) {
      await geh(page, hash);
      const status = page.locator('#speicherstatus');
      if ((await status.count()) === 0 || !(await status.first().isVisible())) fehlt.push(`${hash} (Stand)`);
      else if (zeit && !zeit.test((await page.locator('#speicherzeit').first().textContent().catch(() => null)) ?? '')) fehlt.push(`${hash} (Zeit)`);
    }
  };
  // Geöffnet und unverändert: gespeichert, noch ohne Zeit
  await pruefe(null);
  expect(fehlt, 'Routen ohne Speicherstand nach dem Öffnen').toEqual([]);
  // Nach dem Speichern: gespeichert um HH:MM
  await geh(page, '#/formular/uebersicht');
  await Promise.all([page.waitForEvent('download'), page.click('#speichern')]);
  await pruefe(/gespeichert um \d\d:\d\d/);
  expect(fehlt, 'Routen ohne Zeit nach dem Speichern').toEqual([]);
  // Mit offenen Änderungen: ungespeichert, mit der Zeit des letzten Zwischenstands
  await geh(page, '#/einstellungen/projekt');
  await page.locator('#modul-nist').click();
  await expect(page.locator('#speicherstatus')).toHaveText('Ungespeicherte Änderungen');
  await expect(page.locator('#speicherzeit')).toContainText(/Zwischenstand um \d\d:\d\d/, { timeout: 10_000 });
  await pruefe(/Zwischenstand um \d\d:\d\d/);
  expect(fehlt, 'Routen ohne Zeit bei offenen Änderungen').toEqual([]);
  expect(fehler).toEqual([]);
});

test('Untermenü einklappen: Zustand gemerkt, Knopf im Kopf öffnet wieder', async ({ page }) => {
  const { fehler } = await muster(page);
  await expect(page.locator('#untermenue')).toBeVisible();
  await expect(page.locator('#untermenue-knopf')).toBeHidden();
  await page.locator('#untermenue-zu').click();
  await expect(page.locator('#untermenue')).toBeHidden();
  await expect(page.locator('#untermenue-knopf')).toBeVisible();
  await expect(page.locator('#untermenue-knopf')).toBeFocused();
  await expect(page.locator('#untermenue-knopf')).toHaveAttribute('aria-expanded', 'false');
  // Inhalt nutzt die frei gewordene Breite
  const breit = await page.locator('main').evaluate((m) => m.getBoundingClientRect().left);
  expect(breit).toBeLessThanOrEqual(60);
  // Zustand gemerkt (localStorage); kurz warten, bis der Browser den Wert vor dem Neuladen festgeschrieben hat
  expect(await page.evaluate(() => localStorage.getItem('aims-manager:einstellung:untermenue'))).toBe('zu');
  await page.reload();
  await page.waitForSelector('body[data-bedienbar]');
  await expect(page.locator('#untermenue')).toBeHidden();
  await page.locator('#untermenue-knopf').click();
  await expect(page.locator('#untermenue')).toBeVisible();
  await expect(page.locator('#untermenue-knopf')).toBeHidden();
  expect(fehler).toEqual([]);
});

test('Tastatur: Pfeiltasten in der Symbolleiste, «/» öffnet die Suche, «g» dann Buchstabe wechselt den Bereich', async ({ page }) => {
  const { fehler } = await muster(page);
  await bereichLink(page, 'Start').focus();
  await page.keyboard.press('ArrowDown');
  await expect(bereichLink(page, 'Übersicht')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(bereichLink(page, 'Guide')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('navigation', { name: 'Hauptbereiche' }).getByRole('link').last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(bereichLink(page, 'Start')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/start$/);
  // «g» dann «r»: Register; «g» dann «w»: Wissen
  await page.locator('main h1').click();
  await page.keyboard.press('g');
  await page.keyboard.press('r');
  await expect(page).toHaveURL(/#\/formular\/organisation$/);
  await page.keyboard.press('g');
  await page.keyboard.press('w');
  await expect(page).toHaveURL(/#\/wissen$/);
  // Fokus auf dem Seitentitel der neuen Seite (Bildschirmleser); erst die neue Seite abwarten, sonst trifft «/» noch das
  // Suchfeld der vorigen Ansicht, das beim Zeichnen der neuen ersetzt wird (Zeitrennen im Test, Probe 10.11.2026)
  await expect(page.locator('main h1')).toHaveAttribute('id', /^lf-kapitel-/);
  await expect(page.locator('main h1')).toBeFocused();
  // «/» springt in die Suche, nicht aber aus einem Eingabefeld
  await page.keyboard.press('/');
  await expect(page.locator('#suche')).toBeFocused();
  await page.keyboard.type('Ris');
  await expect(page.locator('#suche')).toHaveValue('Ris');
  // Fokus sichtbar (Fokusrahmen in der Fokusfarbe)
  await bereichLink(page, 'Register').focus();
  await page.keyboard.press('ArrowDown');
  const rahmen = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(rahmen).toBe('solid');
  expect(fehler).toEqual([]);
});

test('Globale Suche: Treffer gruppiert, mit Pfeiltasten und Eingabe öffnen, Escape schliesst', async ({ page }) => {
  const { fehler } = await muster(page);
  const suche = page.getByRole('combobox', { name: 'Suchen' });
  await suche.click();
  await suche.fill('KI-001');
  const liste = page.getByRole('listbox', { name: 'Suchergebnisse' });
  await expect(liste).toBeVisible();
  await expect(suche).toHaveAttribute('aria-expanded', 'true');
  await expect(liste.getByRole('group', { name: 'KI-Inventar' })).toBeVisible();
  await expect(liste.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/formular\/inventar\/KI-001$/);
  await expect(liste).toBeHidden();
  // Erst die neue Ansicht abwarten: sonst trifft die Eingabe das Suchfeld der vorigen Ansicht, das beim Zeichnen ersetzt wird
  // (wie «/ öffnet die Suche»; im Volllauf 10.11.2026 einmal rot)
  await expect(page.locator('#editor-kiSysteme')).toContainText('KI-001');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // Gruppen aus Register, Prozesse und Wissen; Auswahl mit Pfeiltasten
  await suche.fill('Risiko');
  await expect(liste.getByRole('group')).not.toHaveCount(0);
  const gruppen = await liste.getByRole('group').evaluateAll((g) => g.map((x) => x.getAttribute('aria-labelledby') ?? ''));
  expect(gruppen.length).toBeGreaterThan(1);
  // T5: Preact setzt die Auswahl nach dem Zeichnen zurück (Effekt); erst danach die Pfeiltaste, sonst in WebKit unter Last verschluckt
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50))));
  await suche.press('ArrowDown');
  await expect(liste.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(suche).toHaveAttribute('aria-activedescendant', 'suche-t-1');
  // T5-O1: Eingabe und Pfeiltaste im selben Takt (vor dem nächsten Zeichnen): die Pfeiltaste geht nicht verloren
  await suche.evaluate((e: HTMLInputElement) => {
    e.value = 'Risik';
    e.dispatchEvent(new InputEvent('input', { bubbles: true }));
    e.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  });
  await expect(suche).toHaveValue('Risik');
  await expect(suche).toHaveAttribute('aria-activedescendant', 'suche-t-1');
  await expect(liste.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  await suche.press('Escape');
  await expect(liste).toBeHidden();
  // Wissen: Glossar und Leitfaden
  await suche.fill('Schatten-KI');
  await expect(liste.getByRole('group', { name: 'Glossar' })).toBeVisible();
  await liste.getByRole('group', { name: 'Glossar' }).getByRole('option').first().click();
  await expect(page).toHaveURL(/#\/wissen\/glossar\//);
  await expect(page.locator('main h1')).toHaveText('Glossar');
  await suche.fill('Zertifizierung');
  await expect(liste.getByRole('group', { name: 'Wissen' })).toBeVisible();
  await suche.fill('PR-07');
  await expect(liste.getByRole('group', { name: 'Prozesse' })).toBeVisible();
  await suche.fill('xyzxyz');
  await expect(page.locator('.suche-status')).toHaveText('Keine Treffer');
  expect(fehler).toEqual([]);
});

test('Darstellung: dunkel als Standard, hell und wie System wählbar', async ({ page }) => {
  const { fehler } = await starte(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dunkel');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(31, 36, 50)');
  await waehleTheme(page, 'hell');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'hell');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(246, 247, 251)');
  await page.reload();
  await page.waitForSelector('body[data-bedienbar]');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'hell');
  await waehleTheme(page, 'system');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(246, 247, 251)');
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(31, 36, 50)');
  // Druck bleibt hell
  await page.emulateMedia({ colorScheme: 'dark', media: 'print' });
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
  expect(fehler).toEqual([]);
});

test('Bisherige Wahl «hell» bleibt nach dem Update erhalten', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('aims-manager:einstellung:theme', 'hell'); } catch { /* egal */ }
  });
  const { fehler } = await starte(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'hell');
  expect(fehler).toEqual([]);
});

test.describe('Telefon 390 × 844 (U-14)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Untere Leiste, Blatt «Mehr» und Untermenü als Blatt: Bereich wählen, Eintrag wählen, Escape und Abdeckung schliessen', async ({ page }) => {
    const { fehler } = await muster(page);
    await expect(hauptbereiche(page)).toBeVisible();
    await expect(page.locator('#untermenue')).toBeHidden();
    // Wissen liegt unter «Mehr»: Blatt öffnen, Bereich wählen, Blatt schliesst
    await page.locator('#mehr-knopf').click();
    const blatt = page.getByRole('dialog', { name: 'Mehr' });
    await expect(blatt).toBeVisible();
    await blatt.getByRole('link', { name: /^Wissen/ }).click();
    await expect(page).toHaveURL(/#\/wissen$/);
    await expect(blatt).toBeHidden();
    await expect(page.locator('#mehr-knopf')).toHaveClass(/aktiv/);
    // Untermenü als Blatt über den Knopf im Seitenkopf
    await page.locator('#untermenue-knopf').click();
    await expect(page.locator('#untermenue')).toBeVisible();
    await untermenueLink(page, 'Glossar').click();
    await expect(page).toHaveURL(/#\/wissen\/glossar$/);
    await expect(page.locator('#untermenue')).toBeHidden();
    await page.locator('#untermenue-knopf').click();
    await expect(page.locator('#untermenue')).toBeVisible();
    await page.locator('.abdecken').click({ position: { x: 200, y: 40 } });
    await expect(page.locator('#untermenue')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    expect(fehler).toEqual([]);
  });
});

for (const modus of ['dunkel', 'hell'] as const) {
  test(`axe ${modus}: Start, Register, Guide, Wissen, Suche, Untermenü schmal`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript((m) => {
      try { localStorage.setItem('aims-manager:einstellung:theme', m); } catch { /* egal */ }
    }, modus);
    const { fehler } = await muster(page);
    const befunde: string[] = [];
    for (const h of ['#/start', '#/formular/risiken', '#/gefuehrt/E4', '#/wissen/leitfaden/03', '#/wissen/regelwerk/42001', '#/hinweise', '#/einstellungen/darstellung']) {
      await geh(page, h);
      befunde.push(...(await axe(page, h)));
    }
    await page.getByRole('combobox', { name: 'Suchen' }).fill('Risiko');
    await expect(page.getByRole('listbox', { name: 'Suchergebnisse' })).toBeVisible();
    befunde.push(...(await axe(page, 'Suche')));
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#untermenue-knopf').click();
    await expect(page.locator('#untermenue')).toBeVisible();
    befunde.push(...(await axe(page, 'Untermenü schmal')));
    expect(befunde).toEqual([]);
    expect(fehler).toEqual([]);
  });
}

// V-12 (Designsystem AIMS Nachtblau, C4-12, C2-05, C2-06): Die Prüfung erklärt die Bereitschaft wie bereitschaft.ts; jeder
// Befund nennt Warum und Ort und hat «Zur Stelle»; der Sprung zu einem Befund mit Feld fokussiert das Feld.
test('V-12: Bereitschaft erklärt, je Befund Warum, Ort und «Zur Stelle»; Sprung fokussiert das Feld', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('v12.aims.json', false, (p) => {
    p.kiSysteme[0]!.freigabe = { von: 'P-001', am: '2026-09-15' };
    p.kennzahlMessungen = [{ kennzahl: 'PR-07', datum: '2026-12-31', wert: '14 Tage', sollErreicht: 'nein' }];
    delete p.kiSysteme[0]!.eigner;
  }));
  await geh(page, '#/pruefung');
  await expect(page.locator('#bereitschaft-erklaerung')).toContainText('Bereit heisst: keine Fehler und keine Lücken');
  const befunde = page.locator('.befunde > li');
  const n = await befunde.count();
  expect(n).toBeGreaterThan(1);
  for (let i = 0; i < n; i++) {
    const b = befunde.nth(i);
    const stellen = await b.locator('.befund-stelle').count();
    await expect(b.getByRole('link', { name: /^Zur Stelle/ })).toHaveCount(Math.max(1, stellen));
    await expect(b.locator('.befund-warum').first()).toHaveText(/^Warum: \S/);
    await expect(b.locator('.befund-ort').first()).toHaveText(/\S/);
  }
  await page.locator('.befunde li[data-regel=F43]').getByRole('link', { name: /^Zur Stelle/ }).first().click();
  await expect(page.locator('#f-E4-ueberpruefung-KI-001-antragAm')).toBeFocused();
  expect(fehler).toEqual([]);
});

// V-17 (Designsystem AIMS Nachtblau): Fortschritt in Primärfarbe; Grün erst bei 100 % beziehungsweise «Bereit»
test('V-17: Spur in --primaer bei Teilstand (Erste Schritte, Prüfung «Noch nicht bereit»), --status-gut erst bei 100 %', async ({ page }) => {
  const farbe = (v: string) => page.evaluate((x) => {
    const p = document.createElement('span');
    p.style.backgroundColor = `var(${x})`;
    document.body.append(p);
    const c = getComputedStyle(p).backgroundColor;
    p.remove();
    return c;
  }, v);
  const spur = (sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).backgroundColor);
  const { fehler } = await starte(page);
  await oeffne(page, fixtureDatei('v17.aims.json'));
  await geh(page, '#/start');
  const primaer = await farbe('--primaer');
  const gut = await farbe('--status-gut');
  expect(primaer).not.toBe(gut);
  expect(await spur('#erste-schritte .balken > span')).toBe(primaer);
  await geh(page, '#/pruefung');
  await expect(page.locator('[data-bereitschaft]')).toHaveText('Noch nicht bereit');
  expect(await spur('#bereitschaft .balken > span')).toBe(primaer);
  // Lagebild (Projekt im Aufbau und Muster): Kapitel mit 100 % grün, alle übrigen in Primärfarbe
  let voll = 0;
  let teil = 0;
  const lagebild = async () => {
    await geh(page, '#/formular/uebersicht');
    const balken = page.locator('main .balken[role=progressbar]');
    const n = await balken.count();
    for (let i = 0; i < n; i++) {
      const b = balken.nth(i);
      const ganz = (await b.getAttribute('aria-valuenow')) === (await b.getAttribute('aria-valuemax'));
      expect(await b.locator('span').evaluate((e) => getComputedStyle(e).backgroundColor), `Balken ${i}`).toBe(ganz ? gut : primaer);
      if (ganz) voll++;
      else teil++;
    }
  };
  await lagebild();
  await geh(page, '#/start/projekte');
  await oeffne(page, MUSTER);
  await lagebild();
  expect(voll).toBeGreaterThan(0);
  expect(teil).toBeGreaterThan(0);
  expect(fehler).toEqual([]);
});

// B14 (Prüfung Designsystem, V-10): Kontextzeile im Guide. E0 heisst «Startinterview» ohne Nummer, der Jahreskalender J
// ebenso ohne Nummer; die übrigen Etappen «Etappe n von N» mit N = Anzahl der nummerierten Etappen im Katalog (E1 bis E13).
test('B14: Kontextzeile im Guide: Startinterview ohne Nummer, sonst «Etappe n von N» mit N aus dem Katalog', async ({ page }) => {
  const { readFileSync } = await import('node:fs');
  const ids = [...readFileSync(join(REPO, 'src/gefuehrt/etappen.yaml'), 'utf8').matchAll(/\{ id: (E\d+|J),/g)].map((m) => m[1]!);
  const n = ids.filter((i) => /^E[1-9]\d*$/.test(i)).length;
  expect(n).toBe(13);
  const { fehler } = await muster(page);
  const erwartet: [string, string][] = [
    ['#/gefuehrt/E0/E0-firma', 'Guide · Startinterview'],
    ['#/gefuehrt/E1/E1-team', `Guide · Etappe 1 von ${n}`],
    ['#/gefuehrt/E8/E8-behandlung', `Guide · Etappe 8 von ${n}`],
    ['#/gefuehrt/E13/E13-stelle', `Guide · Etappe 13 von ${n}`],
    ['#/gefuehrt/E8/abschluss', `Guide · Etappe 8 von ${n}`],
    ['#/gefuehrt/J/J-termine', 'Guide · Jahreskalender'],
  ];
  for (const [h, text] of erwartet) {
    await geh(page, h);
    await expect(page.locator('#sk-kontext'), h).toHaveText(text);
  }
  expect(fehler).toEqual([]);
});
