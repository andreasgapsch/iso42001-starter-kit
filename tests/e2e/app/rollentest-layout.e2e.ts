// Befunde eines Rollentests zu Darstellung und Bedienung, angepasst an den Rahmen
// (Symbolleiste, Untermenü, Kopf mit Suche): mobiler Kopf mit Menüknopf und Untermenü als Überlagerung (RT-30), Seitenanfang und Fokus nach Seitenwechsel und «Weiter» (RT-30, RT-41), Fokus ins erste fehlende
// Pflichtfeld (RT-48), Tabellen als Karten (RT-31, RT-25, RT-43), Listen ohne Abschneiden (RT-32, RT-55), Lagebild (RT-42),
// Etappenleiste und Navigation (RT-46), Kontrollkästchen (RT-47), breiter Dialog (RT-52), Meldungen (RT-53),
// Fahrplan (RT-57) und Auswahlfelder in WebKit (RT-58). Über file:// in Chromium, Firefox und WebKit; axe nur Chromium.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test } from './app-hilfen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { text } from '../abnahme/abnahme-hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte, themaVorab, waehleTheme } from './app-hilfen.ts';
import { waehle } from '../auswahl-hilfen.ts';

const MUSTER = join(REPO, 'src/beispiele/muster-maschinenbau.de.aims.json');
test.skip(!existsSync(join(REPO, HTML)) || !existsSync(MUSTER), 'Werkzeug nicht gebaut (npm run build:app) oder Beispiel fehlt');

const HANDY = { width: 390, height: 844 };
const geh = async (page: Page, hash: string) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(150);
};
// Ab rc.12 gibt es keinen klebenden Kopf mehr (U-34): Titel und Reiter liegen nach dem Seitenwechsel nicht über dem oberen Rand
const kopfUnten = async (_page: Page) => 0;
const oben = (page: Page, selektor: string) => page.locator(selektor).first().evaluate((e) => e.getBoundingClientRect().top);

/** Sprache der Oberfläche vor dem Laden setzen (wie die anderen Tests der Abnahme). */
async function sprache(page: Page, s: 'de' | 'en'): Promise<void> {
  await page.addInitScript((x) => {
    try { localStorage.setItem('aims-manager:einstellung:ui-sprache', x); } catch { /* egal */ }
  }, s);
}

/** Muster öffnen; die Meldung «geöffnet» wartet nicht ab (siehe RT-53). */
async function muster(page: Page): Promise<{ fehler: string[] }> {
  const r = await starte(page);
  await oeffne(page, MUSTER);
  return r;
}

test.describe('Handy 390 × 844', () => {
  test.use({ viewport: HANDY, hasTouch: true });

  for (const s of ['de', 'en'] as const) {
    for (const schema of ['light', 'dark'] as const) {
      test(`RT-30 und U-14 Telefon: Seitenkopf, untere Leiste mit «Mehr», Untermenü als Blatt (${s}, ${schema})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: schema });
        await themaVorab(page, schema === 'light' ? 'hell' : 'dunkel');
        await sprache(page, s);
        const { fehler } = await muster(page);
        await geh(page, '#/gefuehrt/E0/E0-firma');
        // Seitenkopf der Ansicht: Menüknopf, Titel, Speicherstand und Suche innerhalb der Breite
        const kopf = page.locator('main .seitenkopf');
        for (const sel of ['#untermenue-knopf', 'h1', '#speichern', '#suche']) {
          await expect(kopf.locator(sel)).toBeVisible();
          const box = (await kopf.locator(sel).boundingBox())!;
          expect(box.x + box.width, sel).toBeLessThanOrEqual(HANDY.width);
        }
        // Untere Leiste: vier Hauptbereiche und «Mehr», am unteren Rand, auch beim Rollen
        const leiste = page.getByRole('navigation', { name: text(s, 'rahmen.navi.hauptbereiche') });
        await expect(leiste).toBeVisible();
        await expect(leiste.locator('.lknopf:visible')).toHaveCount(5);
        await page.evaluate(() => scrollTo(0, 700));
        await expect.poll(async () => Math.round((await leiste.boundingBox())!.y + (await leiste.boundingBox())!.height)).toBe(HANDY.height);
        await expect(page.locator('#untermenue')).toBeHidden();
        // Untermenü als Blatt: Fokus im Blatt, Namensnennung sichtbar (Tor G8), Escape schliesst und fokussiert den Knopf
        await page.locator('#untermenue-knopf').click();
        await expect(page.locator('#untermenue-knopf')).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('#untermenue')).toBeVisible();
        await expect(page.locator('#namensnennung')).toBeVisible();
        await expect(page.locator('#namensnennung')).toContainText(text(s, 'app.kopf.namensnennung'));
        await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('#untermenue'))).toBe(true);
        await page.keyboard.press('Escape');
        await expect(page.locator('#untermenue')).toBeHidden();
        await expect(page.locator('#untermenue-knopf')).toHaveAttribute('aria-expanded', 'false');
        await expect(page.locator('#untermenue-knopf')).toBeFocused();
        // Register über die untere Leiste, Risiken über das Blatt: Seitenanfang, Blatt geschlossen
        await leiste.getByRole('link', { name: text(s, 'rahmen.bereich.register') }).click();
        await expect(page).toHaveURL(/#\/formular\/organisation/);
        await page.locator('#untermenue-knopf').click();
        const link = page.locator('#untermenue a', { hasText: text(s, 'app.module.risiken') });
        await expect(link).toBeInViewport();
        await link.click();
        await expect(page).toHaveURL(/#\/formular\/risiken/);
        await expect(page.locator('#untermenue')).toBeHidden();
        await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
        // Sprache auch mobil umschaltbar (Einstellungen › Sprache und Darstellung)
        await geh(page, '#/einstellungen/darstellung');
        await waehle(page.locator('#e-ui'), s === 'de' ? 'en' : 'de');
        await expect(page.locator('html')).toHaveAttribute('lang', s === 'de' ? /^en/ : /^de/);
        expect(fehler).toEqual([]);
      });
    }
  }

  test('RT-30 Seitenwechsel: Titel, Kopf des Guides und aktiver Reiter nicht unter dem Kopf', async ({ page }) => {
    const { fehler } = await muster(page);
    await geh(page, '#/formular/aiact/systeme');
    await page.evaluate(() => scrollTo(0, 900));
    await page.locator('#reiter-pflichten').click();
    await expect(page.locator('#reiter-pflichten')).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    expect(await oben(page, '#reiter-pflichten')).toBeGreaterThanOrEqual(await kopfUnten(page));
    await geh(page, '#/gefuehrt/E4/E4-systeme');
    await page.evaluate(() => scrollTo(0, 900));
    await geh(page, '#/gefuehrt/E5');
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    expect(await oben(page, '.gefuehrt-kopf')).toBeGreaterThanOrEqual(await kopfUnten(page));
    expect(await oben(page, '#seitentitel')).toBeGreaterThanOrEqual(await kopfUnten(page));
    expect(fehler).toEqual([]);
  });

  test('RT-31 EU AI Act: Pflichten und Fristen als Karten, IDs ohne Umbruch', async ({ page }) => {
    const { fehler } = await muster(page);
    await geh(page, '#/formular/aiact/pflichten');
    await page.locator('details.abschnitt summary').first().click();
    for (const reiter of ['pflichten', 'fristen']) {
      if (reiter === 'fristen') await geh(page, '#/formular/aiact/fristen');
      const tabelle = page.locator('.tabelle-feld.karten-schmal').first();
      await expect(tabelle).toBeVisible();
      const r = await tabelle.evaluate((t) => ({
        scroll: t.scrollWidth - t.clientWidth,
        anzeige: getComputedStyle(t.querySelector('tbody tr')!).display,
        beschriftung: getComputedStyle(t.querySelector('td[data-label]')!, '::before').content,
        kopf: t.querySelector('thead')!.getBoundingClientRect().height,
      }));
      expect(r.scroll, reiter).toBeLessThanOrEqual(1);
      expect(r.anzeige).toBe('grid');
      expect(r.beschriftung).not.toBe('none');
      expect(r.kopf).toBeLessThanOrEqual(1);
    }
    await geh(page, '#/formular/aiact/pflichten');
    await page.locator('details.abschnitt summary').first().click();
    const ids = await page.locator('.tabelle-feld strong.ohne-umbruch').evaluateAll((l) => l.map((e) => e.getClientRects().length));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((n) => n === 1)).toBe(true);
    expect(fehler).toEqual([]);
  });

  test('RT-53 Meldung einzeilig über der unteren Leiste (U-14, U-15), nie im Druck', async ({ page }) => {
    const { fehler } = await muster(page);
    const m = page.locator('#meldung');
    await expect(m).toContainText('Muster Maschinenbau');
    const b = (await m.boundingBox())!;
    expect(b.height).toBeLessThanOrEqual(44);
    // Über der unteren Leiste (U-14), nicht über dem Seitenkopf
    const leiste = (await page.locator('nav.symbolleiste').boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(leiste.y + 1);
    expect(b.y).toBeGreaterThan(HANDY.height / 2);
    await page.emulateMedia({ media: 'print' });
    await expect(m).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    expect(fehler).toEqual([]);
  });

  test('RT-57 Fahrplan mobil: Beschriftungen innerhalb der Grafik', async ({ page }) => {
    const { fehler } = await muster(page);
    await geh(page, '#/gefuehrt/E0/E0-fahrplan');
    await expect(page.locator('#fahrplan-gantt svg')).toBeVisible();
    expect(await svgUeberstand(page)).toEqual([]);
    expect(fehler).toEqual([]);
  });

  test('axe mobil hell und dunkel: Kopf, Menü, Karten', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'axe einmal genügt');
    await muster(page);
    for (const schema of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: schema });
      await waehleTheme(page, schema === 'light' ? 'hell' : 'dunkel');
      for (const h of ['#/formular/aiact/fristen', '#/gefuehrt/E12/E12-meldungen', '#/formular/uebersicht']) {
        await geh(page, h);
        await page.waitForTimeout(200);
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(r.violations.map((v) => `${schema} ${h}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
      }
      await page.locator('#untermenue-knopf').click();
      await expect(page.locator('#untermenue')).toBeVisible();
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(r.violations.map((v) => `${schema} Menü: ${v.id}`)).toEqual([]);
      await page.keyboard.press('Escape');
    }
  });
});

/** Texte im Gantt, die über den Rand der Zeichnung hinausragen (getBBox gegen viewBox). */
function svgUeberstand(page: Page): Promise<string[]> {
  return page.locator('#fahrplan-gantt svg[role=img]').evaluate((svg) => {
    const breite = (svg as SVGSVGElement).viewBox.baseVal.width;
    return [...svg.querySelectorAll('text')]
      .map((t) => ({ t: t.textContent ?? '', b: (t as SVGTextElement).getBBox() }))
      .filter(({ b }) => b.x < -1 || b.x + b.width > breite + 1)
      .map(({ t, b }) => `${t}: ${Math.round(b.x)} + ${Math.round(b.width)} > ${breite}`);
  });
}

test.describe('Desktop', () => {
  test.use({ locale: 'de-CH', viewport: { width: 1440, height: 900 } });

  test('RT-30 Symbolleiste und Untermenü kleben bei langen Formularen', async ({ page }) => {
    const { fehler } = await muster(page);
    await geh(page, '#/gefuehrt/E12/E12-meldungen');
    await page.evaluate(() => scrollTo(0, 2500));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(2000);
    for (const sel of ['nav.symbolleiste', '#untermenue']) expect(await page.locator(sel).evaluate((n) => n.getBoundingClientRect().top), sel).toBe(0);
    await expect(page.getByRole('navigation', { name: 'Hauptbereiche' }).getByRole('link', { name: 'Start' })).toBeInViewport();
    await expect(page.locator('#untermenue a[aria-current="page"]')).toBeInViewport();
    expect(fehler).toEqual([]);
  });

  test('RT-41 Weiter: Seitenanfang und Fokus auf dem Seitentitel, in jeder Etappe', async ({ page }) => {
    const { fehler } = await muster(page);
    for (const start of ['#/gefuehrt/E0/E0-firma', '#/gefuehrt/E1', '#/gefuehrt/E4/E4-systeme', '#/gefuehrt/E12/E12-meldungen']) {
      await geh(page, start);
      const vorher = page.url();
      await page.evaluate(() => scrollTo(0, 400));
      await page.locator('.knoepfe button.weiter').click();
      await expect(page).not.toHaveURL(vorher);
      await expect(page.locator('#seitentitel')).toBeFocused();
      await expect.poll(() => page.evaluate(() => scrollY), start).toBe(0);
      expect(await oben(page, '.gefuehrt-kopf')).toBeGreaterThanOrEqual(await kopfUnten(page));
    }
    expect(fehler).toEqual([]);
  });

  test('RT-48 Pflichtfeldwarnung: Fokus in der Fehlerzusammenfassung (AF-158), ihr Sprung ins erste fehlende Feld', async ({ page }) => {
    const { fehler } = await starte(page);
    await oeffne(page, fixtureDatei('rt48.aims.json', false, (p) => (p.organisation.name = '')));
    await geh(page, '#/gefuehrt/E0/E0-firma');
    await page.locator('.knoepfe button.weiter').click();
    await expect(page.locator('[role=alert]')).toBeVisible();
    await expect(page.locator('#fehler-zusammenfassung')).toBeFocused();
    await page.locator('#fehler-zusammenfassung').getByRole('link', { name: /^Zum Feld/ }).first().click();
    await expect(page.locator('#f-E0-firma-organisation_name')).toBeFocused();
    expect(fehler).toEqual([]);
  });

  test('RT-25 und RT-43: Meldungen als Karten, Register der externen Dokumente lesbar', async ({ page }) => {
    const { fehler } = await muster(page);
    await geh(page, '#/gefuehrt/E12/E12-meldungen');
    const karten = page.locator('.tabelle-feld.karten');
    await expect(karten).toHaveCount(1);
    const r = await karten.evaluate((t) => ({
      scroll: t.scrollWidth - t.clientWidth,
      felder: [...t.querySelectorAll<HTMLElement>('tbody tr:first-child td[data-label] :is(input, button.auswahl, textarea)')].map((e) => Math.round(e.getBoundingClientRect().width)),
      beschriftungen: [...t.querySelectorAll('tbody tr:first-child td[data-label]')].map((td) => getComputedStyle(td, '::before').content),
    }));
    expect(r.scroll).toBeLessThanOrEqual(1);
    expect(r.felder.length).toBeGreaterThanOrEqual(12);
    expect(Math.min(...r.felder)).toBeGreaterThanOrEqual(150);
    expect(r.beschriftungen.every((b) => b.length > 2 && b !== 'none')).toBe(true);
    await expect(karten.locator('tbody tr').first().locator('input').first()).toHaveValue('ME-001');
    // Register externer Dokumente (6 Spalten): Mindestbreiten, die Tabelle scrollt in sich, nicht die Seite
    await geh(page, '#/formular/dokumente');
    const register = page.locator('.tabelle-eingabe', { has: page.locator('[data-label]') }).first();
    await expect(register).toBeVisible();
    const breiten = await register.locator('tbody tr:first-child input[type=text]').evaluateAll((l) => l.map((e) => e.getBoundingClientRect().width));
    expect(Math.min(...breiten)).toBeGreaterThanOrEqual(140);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    expect(fehler).toEqual([]);
  });

  test('RT-32 und RT-55: Listen ohne abgeschnittene Werte und Köpfe, Personenauswahl mit Tooltip', async ({ page }) => {
    const { fehler } = await muster(page);
    for (const [breite, modul] of [1440, 1280].flatMap((b) => ['inventar', 'risiken', 'soa', 'massnahmen', 'lieferanten'].map((m) => [b, m] as const))) {
      await page.setViewportSize({ width: breite, height: 900 });
      await geh(page, `#/formular/${modul}`);
      await expect(page.locator('.vliste .zeile').first()).toBeVisible();
      // Spaltenköpfe und kurze Werte (Status, Typ, ID) vollständig; lange Freitexte dürfen nach zwei Zeilen kürzen,
      // tragen dann aber den ganzen Text als title
      const gekappt = await page.locator('.vliste .zelle').evaluateAll((l) => l
        .filter((z) => z.scrollHeight > z.clientHeight + 1 || z.scrollWidth > z.clientWidth + 1)
        .filter((z) => (z.textContent ?? '').length <= 30 || !z.getAttribute('title')?.startsWith(z.textContent?.slice(0, 10) ?? ''))
        .map((z) => z.textContent));
      expect(gekappt, `${modul} ${breite}`).toEqual([]);
      expect(await page.locator('.vliste .zeile .zelle').first().getAttribute('title')).toBeTruthy();
      expect(await page.evaluate(() => { const v = document.querySelector('.vliste')!; return v.scrollWidth - v.clientWidth; }), `${modul} ${breite}`).toBeLessThanOrEqual(1);
    }
    await geh(page, '#/formular/inventar');
    await page.locator('.vliste .zeile').first().click();
    const wahl = page.locator('#editor-kiSysteme .person-wahl button.auswahl').first();
    await expect(wahl).toBeVisible();
    const gewaehlt = (await wahl.locator('.auswahl-wert').textContent()) ?? '';
    if (await wahl.getAttribute('data-wert')) expect(await wahl.getAttribute('title')).toBe(gewaehlt);
    expect(fehler).toEqual([]);
  });

  test('RT-46 und RT-47: Kurztitel ohne Trennung, Gruppentitel ohne Link-Optik, Kontrollkästchen ausgerichtet', async ({ page }) => {
    const { fehler } = await starte(page);
    await oeffne(page, fixtureDatei('rt47.aims.json', false, (p) => (p.parteien = [])));
    await geh(page, '#/gefuehrt/E1');
    // Einträge des Untermenüs trennen nur an weichen Trennstellen (U-04), nie automatisch
    const kurz = await page.locator('#untermenue .upunkt-text').evaluateAll((l) => l.map((e) => getComputedStyle(e).hyphens));
    expect(kurz.length).toBeGreaterThan(5);
    expect(new Set(kurz)).toEqual(new Set(['manual']));
    const gruppe = await page.locator('#untermenue .ugruppe-titel').first().evaluate((h) => ({
      knoten: getComputedStyle(h, '::before').content, farbe: getComputedStyle(h).color, cursor: getComputedStyle(h).cursor,
      link: getComputedStyle(document.querySelector('#untermenue a:not([aria-current])')!).color,
    }));
    expect(gruppe.farbe).not.toBe(gruppe.link);
    expect(['none', 'normal']).toContain(gruppe.knoten);
    expect(gruppe.cursor).toBe('default');
    // «kein Eintrag nötig» (sofern die Seite es anbietet) und Lizenz beim Normtext-Import: Abstand, mittig zur ersten Zeile
    const ausgerichtet = async (id: string) => {
      const m = await page.locator('label.check', { has: page.locator(id) }).evaluate((l) => {
        const box = l.querySelector('input')!.getBoundingClientRect();
        const r = document.createRange();
        r.selectNodeContents(l.querySelector('span')!);
        const zeile = r.getClientRects()[0]!;
        return { anzeige: getComputedStyle(l).display, abstand: zeile.left - box.right, mitte: Math.abs((box.top + box.bottom) / 2 - (zeile.top + zeile.bottom) / 2) };
      });
      expect(m.anzeige, id).toBe('flex');
      expect(m.abstand, id).toBeGreaterThanOrEqual(8);
      expect(m.mitte, id).toBeLessThanOrEqual(3);
    };
    await geh(page, '#/gefuehrt/E2/E2-parteien');
    if (await page.locator('#nicht-noetig').isVisible()) await ausgerichtet('#nicht-noetig');
    await geh(page, '#/einstellungen');
    await ausgerichtet('#normtexte-lizenz');
    expect(fehler).toEqual([]);
  });

  test('RT-52 breiter Dialog und RT-58 Auswahlfelder ohne Systemdarstellung', async ({ page }) => {
    const { fehler } = await starte(page);
    const breite = await page.evaluate(() => {
      const d = document.createElement('dialog');
      d.className = 'breit-dialog';
      d.textContent = 'x';
      document.body.append(d);
      d.showModal();
      const w = d.getBoundingClientRect().width;
      d.close();
      d.remove();
      return w;
    });
    expect(Math.round(breite)).toBe(960);
    await geh(page, '#/einstellungen/darstellung');
    for (const id of ['#e-ui', '#e-theme']) {
      const s = await page.locator(id).evaluate((e) => ({ a: getComputedStyle(e).appearance, r: parseFloat(getComputedStyle(e).borderTopLeftRadius) }));
      expect(s.a).toBe('none');
      expect(s.r).toBeGreaterThanOrEqual(6);
    }
    expect(fehler).toEqual([]);
  });

  test('RT-53 Meldung verschwindet beim Seitenwechsel, Fehler bleiben', async ({ page }) => {
    const { fehler } = await muster(page);
    const m = page.locator('#meldung');
    await expect(m).toContainText('Muster Maschinenbau');
    await page.waitForTimeout(1100);
    await geh(page, '#/formular/risiken');
    await expect(m).toHaveText('', { timeout: 500 });
    expect(fehler).toEqual([]);
  });

  for (const breite of [1440, 820]) {
    test(`RT-42 Lagebild ${breite} px: Inventar, Matrixköpfe, Achsentitel, Etappenkarte vollständig`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: 1000 });
      const { fehler } = await muster(page);
      await expect(page.locator('#lb-inventar-tabelle')).toBeVisible();
      const r = await page.evaluate(() => {
        const inventar = document.querySelector<HTMLElement>('#lb-inventar-tabelle')!.parentElement!;
        const namen = [...document.querySelectorAll<HTMLElement>('#lb-risiken .g-matrix__name')].map((n) => {
          const zeilen = new Set<number>();
          const t = n.firstChild as Text;
          for (let i = 0; i < t.length; i++) {
            const g = document.createRange();
            g.setStart(t, i);
            g.setEnd(t, i + 1);
            zeilen.add(Math.round(g.getBoundingClientRect().top));
          }
          return `${t.data}:${zeilen.size}`;
        });
        const achsen = [...document.querySelectorAll<HTMLElement>('#lb-risiken .g-matrix__achse-a')].map((a) => {
          const karte = a.closest('.karte')!.getBoundingClientRect();
          const k = a.getBoundingClientRect();
          return k.left >= karte.left && k.right <= karte.right && a.scrollHeight <= a.clientHeight + 1;
        });
        const bahn = document.querySelector<HTMLElement>('.lagebild .etappen-bahn')!;
        return { inventar: inventar.scrollWidth - inventar.clientWidth, namen, achsen, bahn: bahn.scrollWidth - bahn.clientWidth };
      });
      expect(r.inventar).toBeLessThanOrEqual(1);
      expect(r.namen.length).toBeGreaterThan(0);
      expect(r.namen.filter((n) => !n.endsWith(':1'))).toEqual([]);
      expect(r.achsen.every(Boolean)).toBe(true);
      expect(r.bahn).toBeLessThanOrEqual(1);
      expect(fehler).toEqual([]);
    });
  }

  test('RT-57 Fahrplan: letzte Meilenstein-Zahl und Wochen innerhalb der Grafik', async ({ page }) => {
    const { fehler } = await muster(page);
    await geh(page, '#/gefuehrt/E0/E0-fahrplan');
    await expect(page.locator('#fahrplan-gantt svg')).toBeVisible();
    expect(await svgUeberstand(page)).toEqual([]);
    expect(fehler).toEqual([]);
  });
});
