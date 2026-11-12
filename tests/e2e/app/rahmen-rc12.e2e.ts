// Rahmen ab rc.12 (Nutzertest rc.10, U-14, U-22, U-34): untere Leiste und Blatt «Mehr» auf dem Telefon, Kartenlisten,
// Seitenkopf je Ansicht mit H1, Suche und einer Hauptaktion, Speichern mit Ctrl/Cmd+S, eigene Auswahl statt <select>.
// Drei Engines; axe nur in Chromium.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test } from './app-hilfen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { liste, waehle } from '../auswahl-hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte } from './app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');

const MUSTER = join(REPO, 'src/beispiele/muster-maschinenbau.de.aims.json');
const TELEFON = { width: 390, height: 844 };
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function muster(page: Page): Promise<{ fehler: string[] }> {
  const r = await starte(page);
  await oeffne(page, MUSTER);
  return r;
}
const geh = async (page: Page, hash: string) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await expect(page.locator('main h1').first()).toBeVisible();
};
const leiste = (page: Page) => page.getByRole('navigation', { name: 'Hauptbereiche' });
const aktiv = (page: Page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute('data-bereich') || document.activeElement?.tagName);

test.describe('Telefon (U-14)', () => {
  test.use({ viewport: TELEFON, hasTouch: true, locale: 'de-CH' });

  test('untere Leiste: vier Hauptbereiche und «Mehr», Pfeiltasten, Pos1 und Ende, Abstand für die Gestensteuerung', async ({ page }) => {
    const { fehler } = await muster(page);
    const l = leiste(page);
    const box = (await l.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(TELEFON.height);
    expect(box.width).toBe(TELEFON.width);
    const sichtbar = l.locator('.lknopf:visible');
    await expect(sichtbar).toHaveCount(5);
    expect(await sichtbar.evaluateAll((k) => k.map((x) => x.getAttribute('data-bereich') ?? x.id))).toEqual(['start', 'guide', 'register', 'bibliothek', 'mehr-knopf']);
    // Beschriftung unter dem Symbol, Zielgrösse mindestens 44 px
    for (const k of await sichtbar.all()) {
      const b = (await k.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.width).toBeGreaterThanOrEqual(44);
    }
    await expect(l.getByRole('link', { name: 'Bibliothek' }).locator('.lname')).toHaveText('Bibliothek');
    // Tastatur wie in der Symbolleiste: Pfeile (waagrecht und senkrecht), Pos1, Ende, ringförmig
    await l.getByRole('link', { name: 'Start' }).focus();
    await page.keyboard.press('ArrowRight');
    expect(await aktiv(page)).toBe('guide');
    await page.keyboard.press('ArrowDown');
    expect(await aktiv(page)).toBe('register');
    await page.keyboard.press('End');
    expect(await aktiv(page)).toBe('mehr-knopf');
    await page.keyboard.press('ArrowRight');
    expect(await aktiv(page)).toBe('start');
    await page.keyboard.press('ArrowLeft');
    expect(await aktiv(page)).toBe('mehr-knopf');
    await page.keyboard.press('Home');
    expect(await aktiv(page)).toBe('start');
    // Inhalt endet über der Leiste; Safe-Area: Viewport mit viewport-fit=cover, Leiste und Blätter mit env(safe-area-inset-bottom)
    const pad = await page.locator('.rahmen-spalte').evaluate((e) => parseFloat(getComputedStyle(e).paddingBottom));
    expect(pad).toBeGreaterThanOrEqual(box.height - 1);
    expect(await page.locator('meta[name=viewport]').getAttribute('content')).toContain('viewport-fit=cover');
    expect(readFileSync(join(REPO, 'src/app/stil.css'), 'utf8')).toMatch(/--leiste-unten: calc\(var\(--masse-leiste\) \+ env\(safe-area-inset-bottom/);
    // Klick auf einen Bereich wechselt nur die Seite (kein Blatt), kein waagrechtes Rollen
    await l.getByRole('link', { name: 'Register' }).click();
    await expect(page).toHaveURL(/#\/formular\/organisation$/);
    await expect(page.locator('#untermenue')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    expect(fehler).toEqual([]);
  });

  test('Blatt «Mehr»: übrige Bereiche und Projekt, Fokusfalle, Escape, Fokus zurück, Rest inert', async ({ page, browserName }) => {
    const { fehler } = await muster(page);
    const mehr = page.locator('#mehr-knopf');
    await expect(mehr).toHaveAttribute('aria-expanded', 'false');
    await mehr.click();
    const blatt = page.getByRole('dialog', { name: 'Mehr' });
    await expect(blatt).toBeVisible();
    await expect(blatt).toHaveAttribute('aria-modal', 'true');
    await expect(mehr).toHaveAttribute('aria-expanded', 'true');
    await expect(blatt.getByRole('navigation', { name: 'Weitere Bereiche' }).getByRole('link')).toHaveText(['Übersicht', 'Prozesse', 'Wissen', /^Prüfung/, /^Hinweise/, 'Hilfe', 'Einstellungen']);
    // Projekt: Name, Speicherstand, Speichern, Speichern unter, Öffnen
    await expect(blatt.locator('.projektname')).toHaveText('Muster Maschinenbau AG');
    await expect(blatt.getByRole('button', { name: /^Speichern/ }).first()).toBeVisible();
    await expect(blatt.getByRole('button', { name: 'Speichern unter …' })).toBeVisible();
    // Fokus im Blatt; Tab und Shift+Tab bleiben im Blatt; der Rest ist inert
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('#mehr-blatt'))).toBe(true);
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('#mehr-blatt')), `Tab ${i}`).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('#mehr-blatt'))).toBe(true);
    expect(await page.locator('.rahmen-spalte').evaluate((e) => (e as HTMLElement).inert)).toBe(true);
    expect(await page.locator('nav.symbolleiste').evaluate((e) => (e as HTMLElement).inert)).toBe(true);
    if (browserName === 'chromium') {
      const r = await new AxeBuilder({ page }).include('#mehr-blatt').withTags(TAGS).analyze();
      expect(r.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
    // Escape schliesst, Fokus zurück auf «Mehr», nichts mehr inert
    await page.keyboard.press('Escape');
    await expect(blatt).toBeHidden();
    await expect(mehr).toBeFocused();
    expect(await page.locator('.rahmen-spalte').evaluate((e) => (e as HTMLElement).inert)).toBe(false);
    // Bereich aus dem Blatt: Seite wechselt, Blatt zu, «Mehr» zeigt den aktiven Bereich
    await mehr.click();
    await blatt.getByRole('link', { name: /^Prüfung/ }).click();
    await expect(page).toHaveURL(/#\/pruefung$/);
    await expect(blatt).toBeHidden();
    await expect(mehr).toHaveClass(/aktiv/);
    await expect(mehr).toHaveAttribute('aria-label', /aktuell Prüfung/);
    await expect(page.locator('main h1')).toBeFocused();
    // Abdeckung schliesst ebenfalls
    await mehr.click();
    await page.locator('.abdecken-mehr').click({ position: { x: 200, y: 30 } });
    await expect(blatt).toBeHidden();
    expect(fehler).toEqual([]);
  });

  test('Untermenü als Blatt: Fokusfalle, Escape, Fokus zurück auf den Menüknopf', async ({ page }) => {
    const { fehler } = await muster(page);
    await geh(page, '#/formular/risiken');
    await page.locator('#untermenue-knopf').click();
    const um = page.locator('#untermenue');
    await expect(um).toBeVisible();
    const b = (await um.boundingBox())!;
    expect(Math.round(b.y + b.height)).toBe(TELEFON.height);
    await expect(page.locator('#untermenue a[aria-current="page"]')).toBeFocused();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('#untermenue')), `Shift+Tab ${i}`).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(um).toBeHidden();
    await expect(page.locator('#untermenue-knopf')).toBeFocused();
    expect(fehler).toEqual([]);
  });

  test('Kartenlisten: Register, Bibliothek, Fällig und Prozesse je Zeile eine Karte; Desktop unverändert', async ({ page }) => {
    const { fehler } = await muster(page);
    // Register (virtualisierte Liste): Karte mit Titel, Unterzeile (ID, Hauptwerte) und Status
    await geh(page, '#/formular/risiken');
    const karte = page.locator('.vliste.karten .zeile').first();
    await expect(karte).toBeVisible();
    await expect(karte.locator('.k-titel')).not.toBeEmpty();
    await expect(karte.locator('.k-unter')).toContainText(/R-\d{3}/);
    await expect(karte.locator('.k-status')).not.toBeEmpty();
    await expect(page.locator('.vliste .kopfzeile')).toHaveCount(0);
    await karte.click();
    await expect(page).toHaveURL(/#\/formular\/risiken\/R-/);
    // Tabellen mit Klasse kartenliste
    for (const [h, tabelle] of [['#/bibliothek', '.bib-tabelle table'], ['#/start', "table[data-liste='faellig']"], ['#/prozesse', '#prozesse table.kartenliste']] as const) {
      await geh(page, h);
      const t = page.locator(tabelle).first();
      await expect(t).toBeVisible();
      const r = await t.evaluate((x) => {
        const tr = x.querySelector('tbody tr')!;
        const titel = tr.querySelector('.k-titel')!.getBoundingClientRect();
        const status = tr.querySelector('.k-status')!.getBoundingClientRect();
        return {
          anzeige: getComputedStyle(tr).display, kopf: getComputedStyle(x.querySelector('thead')!).display,
          beschriftung: getComputedStyle(tr.querySelector('[data-label]')!, '::before').content,
          statusUnterTitel: status.top >= titel.bottom - 1, breite: x.scrollWidth - x.clientWidth,
        };
      });
      expect(r.anzeige, h).toBe('flex');
      expect(r.kopf, h).toBe('none');
      expect(r.beschriftung, h).toMatch(/: /);
      expect(r.statusUnterTitel, h).toBe(true);
      expect(r.breite, h).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), h).toBeLessThanOrEqual(0);
    }
    // Desktop: wieder Tabelle und Spaltenköpfe
    await page.setViewportSize({ width: 1440, height: 900 });
    await geh(page, '#/bibliothek');
    expect(await page.locator('.bib-tabelle tbody tr').first().evaluate((x) => getComputedStyle(x).display)).toBe('table-row');
    await geh(page, '#/formular/risiken');
    await expect(page.locator('.vliste .kopfzeile')).toBeVisible();
    await expect(page.locator('.vliste.karten')).toHaveCount(0);
    expect(fehler).toEqual([]);
  });

  test('Auswahl auf dem Telefon als Blatt mit grossen Zeilen', async ({ page }) => {
    const { fehler } = await muster(page);
    await geh(page, '#/einstellungen/darstellung');
    await page.locator('#e-theme').click();
    const l = page.locator('#e-theme-liste');
    await expect(l).toBeVisible();
    const b = (await l.boundingBox())!;
    expect(Math.round(b.y + b.height)).toBe(TELEFON.height);
    expect(Math.round(b.width)).toBe(TELEFON.width);
    for (const o of await l.getByRole('option').all()) expect((await o.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await l.getByRole('option', { name: 'hell' }).click();
    await expect(l).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'hell');
    expect(fehler).toEqual([]);
  });
});

test.describe('Seitenkopf je Ansicht (U-34)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: 'de-CH' });

  const ANSICHTEN: [string, string | null][] = [
    ['#/start', 'KI-System erfassen'],
    ['#/formular/uebersicht', 'Lagebild drucken'],
    ['#/uebersicht/faellig', 'Drucken'],
    ['#/uebersicht/bereitschaft', 'Stage-1-Bericht'],
    // A-24 (test.9): der Pfeil ist ein Symbol (svg.sym) statt des Zeichens «→»
    ['#/gefuehrt', 'Weitermachen'],
    ['#/gefuehrt/E4/E4-systeme', null],
    ['#/formular/inventar', 'KI-System erfassen'],
    ['#/formular/risiken', 'Risiko erfassen'],
    ['#/formular/massnahmen', 'Massnahme erfassen'],
    ['#/formular/soa', 'Dokumente erzeugen'],
    ['#/formular/organisation', 'Drucken'],
    ['#/prozesse', 'Eigenen Prozess'],
    ['#/prozesse/PR-08', null],
    ['#/bibliothek', 'Datei hochladen'],
    ['#/dokumente', null],
    ['#/wissen', 'Drucken'],
    ['#/wissen/glossar', 'Drucken'],
    ['#/pruefung', 'Stage-1-Bericht'],
    ['#/pruefung/stage1', 'Stage-1-Bericht drucken'],
    ['#/hinweise', 'Drucken'],
    ['#/hilfe', 'Drucken'],
    ['#/hilfe/tasten', 'Drucken'],
    ['#/einstellungen', null],
    ['#/ueber', 'Drucken'],
  ];

  // V-10 (Designsystem AIMS Nachtblau, D-28): Seitenkopf in einer Zeile von 64 px; H1 oben, genau eine Hauptaktion je Ansicht
  for (const groesse of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
    test(`V-10: Seitenkopf bei ${groesse.width} × ${groesse.height}: H1-Oberkante unter 40 px und genau eine Hauptaktion`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(groesse);
      const { fehler } = await muster(page);
      const falsch: string[] = [];
      for (const [h] of ANSICHTEN) {
        await geh(page, h);
        // Erst den Kopf der neuen Ansicht abwarten (WebKit unter Last: Kopf noch nicht gezeichnet, boundingBox null; test.7)
        await expect(page.locator('main .seitenkopf h1').first()).toBeVisible();
        await page.evaluate(() => scrollTo(0, 0));
        const oben = (await page.locator('main .seitenkopf h1').first().boundingBox())?.y ?? 999;
        const primaer = await page.locator('main .seitenkopf .primaer').count();
        // B3: Einstellungen ohne ungespeicherte Änderungen (Muster unverändert) haben keine Hauptaktion; Speichern ist sekundär
        const soll = h === '#/einstellungen' ? 0 : 1;
        if (oben >= 40 || primaer !== soll) falsch.push(`${h}: H1 bei ${Math.round(oben)} px, ${primaer} Hauptaktionen`);
      }
      expect(falsch).toEqual([]);
      expect(fehler).toEqual([]);
    });
  }

  test('jede Ansicht: ein Seitenkopf mit H1, Suche und höchstens einer Hauptaktion; kein Kopfbalken', async ({ page }) => {
    test.setTimeout(90_000);
    const { fehler } = await muster(page);
    await expect(page.locator('header.rahmen-kopf')).toHaveCount(0);
    for (const [h, aktion] of ANSICHTEN) {
      await geh(page, h);
      const kopf = page.locator('main .seitenkopf');
      await expect(kopf, h).toHaveCount(1);
      await expect(kopf.locator('h1'), h).toHaveCount(1);
      await expect(page.locator('main h1'), h).toHaveCount(1);
      await expect(kopf.getByRole('search').locator('#suche'), h).toBeVisible();
      await expect(kopf.locator('#speichern'), h).toBeVisible();
      const aktionen = kopf.locator('.sk-aktion');
      expect(await aktionen.count(), h).toBeLessThanOrEqual(1);
      if (aktion) await expect(aktionen.locator('button, a'), h).toContainText(aktion);
      if (h === '#/gefuehrt') await expect(aktionen.locator('a svg.sym'), h).toHaveCount(1);
      // höchstens eine Primäraktion im Kopf
      expect(await kopf.locator('.primaer').count(), h).toBeLessThanOrEqual(1);
    }
    // Wie im Mockup: Titel, Suche und Hauptaktion in einer Zeile (Desktop)
    for (const h of ['#/formular/inventar', '#/bibliothek', '#/formular/risiken', '#/pruefung']) {
      await geh(page, h);
      const mitte = async (sel: string) => { const b = (await page.locator(`main .seitenkopf ${sel}`).first().boundingBox())!; return b.y + b.height / 2; };
      const h1 = await mitte('h1');
      expect(Math.abs((await mitte('#suche')) - h1), h).toBeLessThanOrEqual(12);
      expect(Math.abs((await mitte('.sk-aktion')) - h1), h).toBeLessThanOrEqual(12);
    }
    expect(fehler).toEqual([]);
  });

  // B4 (Prüfung Designsystem, V-10): genau eine Hauptaktion je Ansicht, nämlich im Seitenkopf. Sichtbar ist ausserhalb von
  // Dialogen höchstens ein Primärknopf; hat der Seitenkopf einen, ist im Inhalt keiner (je Zeile in AI Act und NIST,
  // Bibliothek, Start, KI-Import, Gestaltung). Dialoge sind eigene Ansichten und zählen nicht.
  const B4_ROUTEN = [
    ...ANSICHTEN.map(([h]) => h),
    '#/start/projekte', '#/einstellungen/projekt', '#/einstellungen/gestaltung', '#/einstellungen/normtexte', '#/einstellungen/speicher',
    '#/einstellungen/darstellung', '#/gefuehrt/E6', '#/gefuehrt/E8', '#/prozesse/PR-07',
    ...['uebersicht', 'organisation', 'inventar', 'risiken', 'folgen', 'soa', 'dokumente', 'nachweise', 'massnahmen', 'lieferanten', 'ziele',
      'kompetenz', 'audits', 'feststellungen', 'meldungen', 'generator', 'aiact', 'nistrmf', 'brucke27001', 'mitarbeitende'].map((m) => `#/formular/${m}`),
    '#/formular/aiact/systeme', '#/formular/aiact/pflichten', '#/formular/inventar/KI-001', '#/formular/risiken/R-003',
  ];
  const primaerZaehlen = (page: Page) => page.evaluate(() => {
    const sichtbar = (e: Element) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    const alle = [...document.querySelectorAll('.primaer')].filter((e) => !e.closest('dialog') && sichtbar(e));
    return { kopf: alle.filter((e) => e.closest('main .seitenkopf')).length, inhalt: alle.filter((e) => !e.closest('main .seitenkopf')).map((e) => e.id || e.textContent?.trim().slice(0, 30)) };
  });
  test('B4: höchstens ein sichtbarer Primärknopf je Ansicht, mit Hauptaktion im Kopf keiner im Inhalt', async ({ page }) => {
    test.setTimeout(180_000);
    const falsch: string[] = [];
    // ohne Projekt: Start ist die Wahl zwischen neu, öffnen und Beispiel
    const { fehler } = await starte(page);
    for (const h of ['#/start', '#/start/projekte']) {
      await geh(page, h);
      const z = await primaerZaehlen(page);
      if (z.kopf + z.inhalt.length > 1) falsch.push(`ohne Projekt ${h}: Kopf ${z.kopf}, Inhalt ${z.inhalt.join(', ')}`);
    }
    await oeffne(page, MUSTER);
    for (const h of B4_ROUTEN) {
      await geh(page, h);
      const z = await primaerZaehlen(page);
      if (z.kopf + z.inhalt.length > 1 || (z.kopf === 1 && z.inhalt.length)) falsch.push(`${h}: Kopf ${z.kopf}, Inhalt ${z.inhalt.join(', ')}`);
    }
    // offene Vorschläge je Zeile (AI Act, NIST) samt geöffnetem «Begründet ablehnen», KI-Import auf Start
    await geh(page, '#/start/projekte');
    await oeffne(page, fixtureDatei('b4.aims.json', false, (p) => { p.kiSysteme[0]!.generativ = true; p.meta.modulNistRmf = true; }));
    const zeilen: [string, string | null][] = [
      ['#/formular/aiact/vorschlaege', 'section[id^=vorschlag-EUAIA]'], ['#/formular/nistrmf/controls', 'section[id^=rmf-RMF]'], ['#/start/projekte', null], ['#/start', null],
    ];
    for (const [h, zeile] of zeilen) {
      await geh(page, h);
      if (zeile) {
        await expect(page.locator(zeile).first(), h).toBeVisible();
        await page.locator(zeile).first().getByRole('button', { name: 'Begründet ablehnen' }).click();
        await page.locator(zeile).first().locator('textarea').fill('Grund');
      } else {
        await page.click('#ki-import-start');
        await page.fill('#ki-import-text', '{}');
        // Formular «Neues Projekt» bei offenem Projekt (Nacharbeit N5)
        if (h === '#/start') {
          await page.click('#start-neu');
          await expect(page.locator('#neu-anlegen')).toBeVisible();
        }
      }
      const z = await primaerZaehlen(page);
      if (z.kopf + z.inhalt.length > 1 || (z.kopf === 1 && z.inhalt.length)) falsch.push(`${h} (offen): Kopf ${z.kopf}, Inhalt ${z.inhalt.join(', ')}`);
    }
    expect(falsch).toEqual([]);
    expect(fehler).toEqual([]);
  });

  // B3 (Entscheid Orchestrierung): in den Einstellungen ist der Speicherknopf nur bei ungespeicherten Änderungen Primärknopf,
  // sonst sekundär mit dem Zustand «Gespeichert».
  test('B3: Einstellungen: Speichern ist nur mit ungespeicherten Änderungen die Hauptaktion', async ({ page }) => {
    const { fehler } = await starte(page);
    await oeffne(page, fixtureDatei('b3-speichern.aims.json'));
    for (const h of ['#/einstellungen', '#/einstellungen/projekt', '#/einstellungen/gestaltung']) {
      await geh(page, h);
      await expect(page.locator('#speicherstatus'), h).toHaveText('Gespeichert');
      await expect(page.locator('#speichern'), h).not.toHaveClass(/primaer/);
    }
    await geh(page, '#/einstellungen/projekt');
    await page.locator('#modul-nist').click();
    await expect(page.locator('#speicherstatus')).toHaveText('Ungespeicherte Änderungen');
    await expect(page.locator('#speichern')).toHaveClass(/primaer/);
    expect((await primaerZaehlen(page)).kopf).toBe(1);
    // ausserhalb der Einstellungen bleibt der Speicherstand dezent
    await geh(page, '#/formular/inventar');
    await expect(page.locator('#speichern')).not.toHaveClass(/primaer/);
    await geh(page, '#/einstellungen/projekt');
    await Promise.all([page.waitForEvent('download'), page.locator('#speichern').click()]);
    await expect(page.locator('#speicherstatus')).toHaveText('Gespeichert');
    await expect(page.locator('#speichern')).not.toHaveClass(/primaer/);
    expect(fehler).toEqual([]);
  });

  test('Hauptaktionen wirken: KI-System erfassen, Risiko erfassen, Stage-1-Bericht', async ({ page }) => {
    const { fehler } = await starte(page);
    await oeffne(page, fixtureDatei('seitenkopf.aims.json'));
    await geh(page, '#/start');
    await page.getByRole('button', { name: 'KI-System erfassen' }).click();
    await expect(page).toHaveURL(/#\/formular\/inventar\/KI-002$/);
    await geh(page, '#/formular/risiken');
    await page.locator('main .seitenkopf').getByRole('button', { name: 'Risiko erfassen' }).click();
    await expect(page).toHaveURL(/#\/formular\/risiken\/R-\d{3}$/);
    await geh(page, '#/pruefung');
    await page.locator('main .seitenkopf').getByRole('link', { name: 'Stage-1-Bericht' }).click();
    await expect(page).toHaveURL(/#\/pruefung\/stage1$/);
    expect(fehler).toEqual([]);
  });

  test('Projekt-Kachel: Name, Speicherstand, Speichern; dezente Anzeige im Seitenkopf; Druck und Druckansicht ohne Kopf', async ({ page }) => {
    const { fehler } = await muster(page);
    await expect(page.locator('#projekt-kachel')).toHaveAttribute('aria-label', /Projekt Muster Maschinenbau AG/);
    await page.locator('#projekt-kachel').click();
    const menue = page.locator('#projekt-menue');
    await expect(menue.locator('.projektname')).toHaveText('Muster Maschinenbau AG');
    await expect(menue.getByRole('button', { name: /^Speichern/ }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menue).toBeHidden();
    await expect(page.locator('#projekt-kachel')).toBeFocused();
    await expect(page.locator('#speicherstatus')).toHaveText('Gespeichert');
    await expect(page.locator('#kopf-stichtag')).toBeVisible();
    // Druck: nur der Titel des Seitenkopfs
    await geh(page, '#/formular/inventar');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('main .seitenkopf h1')).toBeVisible();
    for (const sel of ['#suche', '#speichern', '.sk-aktion', '#untermenue-knopf']) await expect(page.locator(sel).first(), sel).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    // Druckansicht eines Dokuments: ohne Seitenkopf
    await geh(page, '#/dokumente');
    await page.getByRole('button', { name: 'Druckansicht' }).first().click();
    await expect(page.locator('main .seitenkopf')).toHaveCount(0);
    await expect(page.locator('main h1')).toHaveText(/Druckansicht/);
    expect(fehler).toEqual([]);
  });

  for (const [taste, name] of [['Control+s', 'Ctrl+S'], ['Meta+s', 'Cmd+S']] as const) {
    test(`${name} speichert (auch aus einem Eingabefeld), der Speicherstand folgt`, async ({ page }) => {
      const { fehler } = await starte(page);
      await oeffne(page, fixtureDatei('ctrl-s.aims.json'));
      await geh(page, '#/formular/inventar/KI-001');
      await page.fill('#editor-kiSysteme input[type=text] >> nth=0', 'Copilot Pro');
      await expect(page.locator('#speicherstatus')).toHaveText('Ungespeicherte Änderungen');
      await expect(page.locator('#speichern')).toHaveClass(/ungespeichert/);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press(taste)]);
      expect(JSON.parse(readFileSync(await dl.path(), 'utf8')).kiSysteme[0].name).toBe('Copilot Pro');
      await expect(page.locator('#speicherstatus')).toHaveText('Gespeichert');
      // Klick auf die Anzeige speichert ebenso
      await page.fill('#editor-kiSysteme input[type=text] >> nth=0', 'Copilot Pro 2');
      const [dl2] = await Promise.all([page.waitForEvent('download'), page.locator('#speichern').click()]);
      expect(JSON.parse(readFileSync(await dl2.path(), 'utf8')).kiSysteme[0].name).toBe('Copilot Pro 2');
      expect(fehler).toEqual([]);
    });
  }
});

test.describe('Auswahl statt <select> (U-22)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: 'de-CH' });

  test('ARIA «select-only combobox»: Rollen, Name aus dem Label, Tastatur, Tippsuche, Escape, Tab', async ({ page, browserName }) => {
    const { fehler } = await muster(page);
    await geh(page, '#/einstellungen/darstellung');
    const k = page.getByRole('combobox', { name: 'Hell oder dunkel' });
    await expect(k).toHaveAttribute('aria-expanded', 'false');
    await expect(k).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(k).toHaveText('dunkel');
    const l = await liste(k);
    // ↓ öffnet auf der gewählten Option, Fokus bleibt auf dem Knopf (aria-activedescendant)
    await k.focus();
    await page.keyboard.press('ArrowDown');
    await expect(k).toHaveAttribute('aria-expanded', 'true');
    await expect(l).toBeVisible();
    await expect(l).toHaveAttribute('aria-label', 'Hell oder dunkel');
    await expect(k).toBeFocused();
    const ad = () => k.getAttribute('aria-activedescendant').then((id) => page.locator(`[id="${id}"]`).textContent());
    expect(await ad()).toBe('dunkel');
    await expect(l.getByRole('option', { name: 'dunkel' })).toHaveAttribute('aria-selected', 'true');
    if (browserName === 'chromium') {
      const r = await new AxeBuilder({ page }).include('.einstellungen').withTags(TAGS).analyze();
      expect(r.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
    await page.keyboard.press('ArrowDown');
    expect(await ad()).toBe('hell');
    await page.keyboard.press('End');
    expect(await ad()).toBe('wie System');
    await page.keyboard.press('Home');
    expect(await ad()).toBe('dunkel');
    // Escape: schliesst ohne Änderung
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(l).toBeHidden();
    await expect(k).toHaveText('dunkel');
    await expect(k).toBeFocused();
    // Enter öffnet, ↓ und Enter übernehmen
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(k).toHaveText('hell');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'hell');
    // Tippsuche: «w» springt auf «wie System» (eine Leertaste kurz danach gehört zur Suche); nach einer Pause übernimmt die Leertaste
    await page.keyboard.press('w');
    await expect(l).toBeVisible();
    expect(await ad()).toBe('wie System');
    await page.waitForTimeout(600);
    await page.keyboard.press(' ');
    await expect(k).toHaveAttribute('data-wert', 'system');
    // Tab übernimmt die aktive Option und geht weiter
    await page.keyboard.press('Alt+ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Tab');
    await expect(k).toHaveAttribute('data-wert', 'hell');
    await expect(l).toBeHidden();
    // Tasten der App wirken nicht in der Auswahl («g» und «/»)
    await k.focus();
    await page.keyboard.press('g');
    await page.keyboard.press('Escape');
    await page.keyboard.press('/');
    await expect(page.locator('#suche')).not.toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/#\/einstellungen\/darstellung$/);
    // Maus: Klick ausserhalb schliesst
    await k.click();
    await expect(l).toBeVisible();
    await page.locator('main h1').click();
    await expect(l).toBeHidden();
    expect(fehler).toEqual([]);
  });

  test('Gruppen (optgroup) und Label um die Auswahl: Filter der Risiken', async ({ page }) => {
    const { fehler } = await muster(page);
    await geh(page, '#/formular/risiken');
    const k = page.locator('#risiken-status');
    await expect(k).toHaveAccessibleName(/Status/);
    await k.click();
    const l = await liste(k);
    await expect(l.getByRole('group')).toHaveCount(2);
    await l.getByRole('group').first().getByRole('option').first().click();
    await expect(l).toBeHidden();
    await expect(page).toHaveURL(/status=ueber/);
    await waehle(k, '');
    await expect(page).not.toHaveURL(/status=/);
    expect(fehler).toEqual([]);
  });

  test('keine <select> in der App, alle Auswahlen benannt (axe), auch im Guide und in Tabellen', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'axe einmal genügt');
    const { fehler } = await muster(page);
    const befunde: string[] = [];
    for (const h of ['#/gefuehrt/E4/E4-systeme', '#/formular/inventar/KI-001', '#/prozesse/PR-08', '#/bibliothek', '#/einstellungen/gestaltung', '#/formular/nistrmf', '#/formular/soa']) {
      await geh(page, h);
      await page.waitForTimeout(150);
      expect(await page.locator('select').count(), h).toBe(0);
      const n = await page.locator('button.auswahl').count();
      if (n) {
        const unbenannt = await page.locator('button.auswahl').evaluateAll((l) => l.filter((b) => !(b.getAttribute('aria-label') || (b as HTMLButtonElement).labels?.length || b.getAttribute('aria-labelledby'))).map((b) => b.id));
        expect(unbenannt, h).toEqual([]);
      }
      const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      befunde.push(...r.violations.map((v) => `${h}: ${v.id} ${v.nodes.map((x) => x.target.join(' ')).slice(0, 3).join(', ')}`));
    }
    expect(befunde).toEqual([]);
    expect(fehler).toEqual([]);
  });
});

// V-05 (Designsystem AIMS Nachtblau): lange Aktionen zeigen den Zustand Beschäftigt (Ladekreis, aria-busy) und lösen bei
// Doppelklick nur einmal aus
test.describe('V-05 Knopf beschäftigt', () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: 'de-CH' });

  test('V-05: «Set erzeugen» ist beschäftigt (aria-busy, disabled) bis zur Datei; Doppelklick ergibt genau einen Download', async ({ page }) => {
    test.setTimeout(150_000);
    const { fehler } = await starte(page);
    await oeffne(page, fixtureDatei('v05.aims.json'));
    await geh(page, '#/dokumente');
    const knopf = page.locator('#set-erzeugen');
    const dateien: string[] = [];
    page.on('download', (d) => dateien.push(d.suggestedFilename()));
    const erste = page.waitForEvent('download', { timeout: 120_000 });
    await knopf.dblclick();
    await expect(knopf).toHaveAttribute('aria-busy', 'true');
    await expect(knopf).toBeDisabled();
    await erste;
    await expect(knopf).not.toHaveAttribute('aria-busy', 'true');
    await expect(knopf).toBeEnabled();
    await page.waitForTimeout(1500);
    expect(dateien).toHaveLength(1);
    expect(fehler).toEqual([]);
  });
});

// V-15 (Designsystem AIMS Nachtblau, Nacharbeit 4): StatusPillen auf deckendem Grund, auch auf der gewählten Zeile und bei Hover
test.describe('V-15 Pillen im Register mit gewählter Zeile', () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: 'de-CH', colorScheme: 'dark' });
  test('V-15: axe color-contrast meldet im Register mit gewählter Zeile 0 Befunde (dunkel und hell)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'axe einmal genügt');
    const { fehler } = await muster(page);
    const befunde: string[] = [];
    for (const thema of ['dunkel', 'hell'] as const) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), thema);
      for (const h of ['#/formular/risiken/R-003', '#/formular/inventar/KI-001', '#/formular/massnahmen/M-010', '#/bibliothek']) {
        await geh(page, h);
        await page.waitForTimeout(150);
        const gewaehlt = page.locator('.vliste .zeile[aria-selected="true"], [aria-current="true"]').first();
        if (await gewaehlt.count()) await gewaehlt.hover().catch(() => undefined);
        const r = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
        befunde.push(...r.violations.flatMap((v) => v.nodes.map((n) => `${thema} ${h}: ${n.target.join(' ')} ${n.any[0]?.message ?? ''}`)));
      }
    }
    expect(befunde).toEqual([]);
    expect(fehler).toEqual([]);
  });
});

// V-16 (Designsystem AIMS Nachtblau, Laptop-Messung M3): Hilfe-Spalte unter 1366 px eingeklappt, Griff 44 px mit aria-expanded,
// Zustand gemerkt; bei 1440 px offen
test.describe('V-16 Hilfe-Spalte', () => {
  test.use({ locale: 'de-CH' });
  test('V-16: bei 1280 × 720 eingeklappt (Griff 44 px, aria-expanded), Wahl bleibt gemerkt; bei 1440 × 900 offen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const { fehler } = await muster(page);
    await geh(page, '#/gefuehrt/E8/E8-behandlung?eintrag=R-003');
    const griff = page.locator('#hilfe-umschalten');
    await expect(griff).toHaveAttribute('aria-expanded', 'false');
    expect(Math.round((await griff.boundingBox())!.width)).toBe(44);
    await expect(page.locator('#hilfe')).toBeHidden();
    // M3 bei 1280 × 720: Control-Vorschläge und «Massnahme erfassen» ohne Scrollen sichtbar
    await expect(page.locator('#controls-vorschlaege-R-003')).toBeInViewport();
    await expect(page.locator('#massnahme-neu-R-003-knopf')).toBeInViewport();
    await griff.click();
    await expect(griff).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#hilfe')).toBeVisible();
    await geh(page, '#/gefuehrt/E8/E8-soa');
    await expect(page.locator('#hilfe-umschalten')).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#hilfe-umschalten').click();
    await expect(page.locator('#hilfe-umschalten')).toHaveAttribute('aria-expanded', 'false');
    await page.evaluate(() => localStorage.clear());
    await page.setViewportSize({ width: 1440, height: 900 });
    await geh(page, '#/gefuehrt/E8/E8-behandlung');
    await expect(page.locator('#hilfe-umschalten')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#hilfe')).toBeVisible();
    expect(fehler).toEqual([]);
  });
});
