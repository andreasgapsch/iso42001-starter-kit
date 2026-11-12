// Abnahmetests: Designentscheide V-18 bis V-22 und Befunde A-07, A-10, A-13 bis A-19 aus dem Soll-Ist-Abgleich der
// Darstellung.
// Werte aus dem DOM, aus dem berechneten Stil und aus dem PDF-Text jeder Seite, nicht aus dem Code.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, ORDNER, beantworteRueckfragen, fixtureDatei, oeffne, starte, test } from './app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ locale: 'de-CH', acceptDownloads: true });

const MUSTER = join(REPO, 'src/beispiele/muster-maschinenbau.de.aims.json');
const geh = async (page: Page, hash: string) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await expect(page.locator('main h1').first()).toBeVisible();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};
type Kasten = { x: number; y: number; width: number; height: number };
const ueberlappt = (a: Kasten, b: Kasten) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Text je Seite eines PDF (pdftotext) */
function pdfSeiten(pdf: Buffer, name: string): string[] {
  const ordner = join(ORDNER, 'pdf-test8');
  mkdirSync(ordner, { recursive: true });
  const datei = join(ordner, `${test.info().testId}-${name}.pdf`);
  writeFileSync(datei, pdf);
  const n = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [datei], { encoding: 'utf8' }))?.[1] ?? 0);
  return Array.from({ length: n }, (_, i) => execFileSync('pdftotext', ['-f', String(i + 1), '-l', String(i + 1), '-layout', datei, '-'], { encoding: 'utf8' }));
}

// ------------------------------------------------------------------------------------------------ V-18 (A-12)
test.describe('V-18 (A-12): eine Dialogart, der Titel nennt die Handlung', () => {
  test('Löschen mit und ohne Verweise: Dialog Bestaetigen, Frage im Titel, Fokus auf Abbrechen, Esc löscht nichts', async ({ page }) => {
    const { fehler } = await starte(page);
    await oeffne(page, fixtureDatei('v18.aims.json', false, (p) => {
      p.risiken.push({ ...structuredClone(p.risiken[0]!), id: 'R-002', titel: 'Falsche Auskunft an Kunden' });
      p.kiSysteme.push({ ...structuredClone(p.kiSysteme[0]!), id: 'KI-002', name: 'Übersetzer' });
    }));
    await geh(page, '#/gefuehrt/E4/E4-systeme');
    const eintraege = page.locator('section.eintrag');
    await expect(eintraege).toHaveCount(2);
    const dialog = page.getByRole('alertdialog');
    // Mit Verweisen (KI-001 hat zwei Risiken)
    await eintraege.first().getByRole('button', { name: 'Eintrag entfernen' }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveId('bestaetigen');
    await expect(dialog).toHaveClass(/\bbestaetigen\b/);
    await expect(dialog.locator('h2')).toHaveText(/^KI-001 «.+» löschen\?$/);
    await expect(dialog).toHaveAccessibleName(/^KI-001 «.+» löschen\?$/);
    await expect(dialog.locator('li').filter({ hasText: 'R-002' })).toHaveCount(1);
    await expect(page.locator('#bestaetigen-nein')).toBeFocused();
    await expect(page.locator('#bestaetigen-ja')).toHaveText('Verweise entfernen und löschen');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(eintraege).toHaveCount(2);
    // Ohne Verweise (KI-002): derselbe Dialog, Frage mit Kennung und Name
    await eintraege.nth(1).getByRole('button', { name: 'Eintrag entfernen' }).click();
    await expect(dialog).toHaveId('bestaetigen');
    await expect(dialog.locator('h2')).toHaveText(/^KI-002 «Übersetzer» löschen\?$/);
    await expect(page.locator('#bestaetigen-nein')).toBeFocused();
    await page.locator('#bestaetigen-ja').click();
    await expect(eintraege).toHaveCount(1);
    expect(await page.locator('[role=alertdialog]:not(#bestaetigen), dialog:not(#bestaetigen)[open]').count()).toBe(0);
    expect(fehler).toEqual([]);
  });

  test('«Firmendokumente in die Bibliothek legen»: derselbe Dialog, Frage mit Zahl, Fokus auf der Handlung', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Bibliothek im Browserspeicher, Ablauf in Chromium');
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const { fehler } = await starte(page);
    await oeffne(page, MUSTER);
    await geh(page, '#/bibliothek/alle');
    await page.click('#bib-browser');
    await expect(page.locator('#bib-verbindung')).toContainText(/Browserspeicher/);
    await page.click('#bib-erzeugen');
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toHaveId('bestaetigen');
    await expect(dialog.locator('h2')).toHaveText(/^\d+ neue Entwürfe erzeugen\?$/);
    await expect(page.locator('#bestaetigen-ja')).toBeFocused();
    await expect(page.locator('#bestaetigen-ja')).not.toHaveText(/^(OK|Ja)$/);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(fehler).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------ V-19 (A-13)
test('V-19 (A-13): Hinweis zu Zwischenständen als einzeilige Leiste unter dem Kopf, Kopf bei y 0', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Masse in Chromium');
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  await geh(page, '#/formular/risiken');
  // Eine Änderung legt den ersten Zwischenstand ab
  await page.locator('.vliste .zeile').first().click();
  const feld = page.locator('main .editor input[type=text]').first();
  await feld.fill(`${await feld.inputValue()} `);
  const hinweis = page.locator('#hinweis-browserspeicher');
  await expect(hinweis).toBeVisible({ timeout: 15_000 });
  const falsch: string[] = [];
  for (const [b, h] of [[1440, 900], [1280, 720]] as const) {
    await page.setViewportSize({ width: b, height: h });
    for (const r of ['#/bibliothek', '#/formular/risiken', '#/pruefung']) {
      await geh(page, r);
      await page.evaluate(() => scrollTo(0, 0));
      const kopf = (await page.locator('main .seitenkopf').first().boundingBox())!;
      const h1 = (await page.locator('main .seitenkopf h1').first().boundingBox())!;
      const leiste = (await hinweis.boundingBox())!;
      if (Math.round(kopf.y) !== 0) falsch.push(`${b} ${r}: Kopf bei y ${Math.round(kopf.y)}`);
      if (Math.round(h1.y) !== 24) falsch.push(`${b} ${r}: H1 bei y ${Math.round(h1.y)}`);
      if (leiste.height > 48) falsch.push(`${b} ${r}: Leiste ${Math.round(leiste.height)} px hoch`);
      if (leiste.y < kopf.y + kopf.height) falsch.push(`${b} ${r}: Leiste bei y ${Math.round(leiste.y)} über dem Kopfende ${Math.round(kopf.y + kopf.height)}`);
      if (await page.locator('#hinweis-browserspeicher').count() !== 1) falsch.push(`${b} ${r}: Leiste nicht genau einmal`);
    }
  }
  expect(falsch).toEqual([]);
  await expect(hinweis).toHaveAttribute('role', 'region');
  await expect(hinweis).toHaveAccessibleName(/Zwischenstände/);
  await expect(hinweis.getByRole('button', { name: 'Verstanden' })).toBeVisible();
  await expect(hinweis.getByRole('link', { name: 'Zu den Einstellungen' })).toBeVisible();
  // «Verstanden» blendet sie dauerhaft aus (je Browserprofil): auch ein neues Projekt mit Zwischenstand zeigt sie nicht mehr
  await hinweis.getByRole('button', { name: 'Verstanden' }).click();
  await expect(hinweis).toHaveCount(0);
  await geh(page, '#/start');
  await page.reload();
  await page.waitForSelector('body[data-bedienbar]');
  await oeffne(page, fixtureDatei('v19.aims.json'));
  await geh(page, '#/formular/risiken');
  await page.locator('.vliste .zeile').first().click();
  const feld2 = page.locator('main .editor input[type=text]').first();
  await feld2.fill(`${await feld2.inputValue()} `);
  await expect(page.locator('#speicherzeit')).toContainText(/Zwischenstand/, { timeout: 10_000 });
  await expect(page.locator('#hinweis-browserspeicher')).toHaveCount(0);
  expect(fehler).toEqual([]);
});

// ------------------------------------------------------------------------------------------------ V-20 (A-15)
test.describe('V-20 (A-15): Stichtag sichtbar, Erklärung als Popover, Kopf einzeilig', () => {
  test('900 bis 1440 px: «Stichtag» sichtbar, Kopf höchstens 64 px, Suche unter 1280 px als Symbolknopf', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Masse in Chromium');
    test.setTimeout(120_000);
    const { fehler } = await starte(page);
    await oeffne(page, MUSTER);
    const falsch: string[] = [];
    for (const b of [1440, 1280, 1024, 900]) {
      await page.setViewportSize({ width: b, height: 800 });
      for (const r of ['#/formular/risiken', '#/formular/uebersicht', '#/bibliothek', '#/dokumente', '#/pruefung', '#/prozesse', '#/formular/inventar']) {
        await geh(page, r);
        const kopf = (await page.locator('main .seitenkopf').first().boundingBox())!;
        if (Math.round(kopf.height) > 64) falsch.push(`${b} ${r}: Kopf ${Math.round(kopf.height)} px`);
        const wort = page.locator('#kopf-stichtag .stichtag-wort');
        const w = await wort.boundingBox();
        if (!w || w.width < 30) falsch.push(`${b} ${r}: Wort «Stichtag» nicht sichtbar`);
        const suche = (await page.locator('main .seitenkopf .suche').boundingBox())!;
        if (b < 1280 && suche.width > 40) falsch.push(`${b} ${r}: Suche ${Math.round(suche.width)} px breit statt Symbolknopf`);
      }
    }
    expect(falsch).toEqual([]);
    // «/» öffnet die Suche auch als Symbolknopf; das Feld ist dann breit genug zum Tippen
    await page.setViewportSize({ width: 1024, height: 800 });
    await geh(page, '#/formular/risiken');
    await page.locator('main h1').click();
    await page.keyboard.press('/');
    await expect(page.locator('#suche')).toBeFocused();
    expect((await page.locator('#suche').boundingBox())!.width).toBeGreaterThanOrEqual(160);
    await page.keyboard.type('Risiko');
    await expect(page.locator('#suche-liste')).toBeVisible();
    expect(fehler).toEqual([]);
  });

  test('#kopf-stichtag ist ein Knopf: Enter und Fokus öffnen das Popover, Esc schliesst es, kein title', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const { fehler } = await starte(page);
    await oeffne(page, MUSTER);
    await geh(page, '#/formular/risiken');
    const knopf = page.locator('#kopf-stichtag');
    await expect(knopf).toBeVisible();
    expect(await knopf.evaluate((e) => e.tagName)).toBe('BUTTON');
    await expect(knopf).not.toHaveAttribute('title', /.*/);
    await expect(page.locator('[title*="Stichtag"], [title*="Datenstand"]')).toHaveCount(0);
    const pop = page.locator(`#${await knopf.getAttribute('aria-controls')}`);
    await expect(knopf).toHaveAttribute('aria-expanded', 'false');
    await expect(pop).toBeHidden();
    await knopf.focus();
    await expect(knopf).toHaveAttribute('aria-expanded', 'true');
    await expect(pop).toBeVisible();
    await expect(pop).toContainText(/Datenstand/);
    await page.keyboard.press('Escape');
    await expect(pop).toBeHidden();
    await expect(knopf).toHaveAttribute('aria-expanded', 'false');
    await expect(knopf).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(pop).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(pop).toBeHidden();
    // Klick öffnet, Klick daneben schliesst
    await page.locator('main h1').click();
    await knopf.click();
    await expect(pop).toBeVisible();
    await page.locator('main h1').click();
    await expect(pop).toBeHidden();
    expect(fehler).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------ V-21 (A-16, A-17)
test('V-21 (A-16, A-17): Lagebild im Druck 2 Seiten ohne Verkleinerung, Seite 2 beginnt mit den Controls, kein Titel allein am Seitenende', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'page.pdf nur in Chromium');
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  await geh(page, '#/formular/uebersicht');
  await page.emulateMedia({ media: 'print' });
  const zoom = await page.locator('.lagebild').evaluate((e) => getComputedStyle(e).zoom);
  expect(['1', 'normal']).toContain(zoom);
  // Kleinste Schrift: 12 px (9 pt) bei jedem sichtbaren Text des Lagebilds, ohne Verkleinerung
  const klein = await page.locator('.lagebild').evaluate((wurzel) => {
    const aus: string[] = [];
    for (const e of wurzel.querySelectorAll<HTMLElement>('*')) {
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue;
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      if (!r.width || s.visibility === 'hidden' || s.display === 'none') continue;
      let z = 1;
      for (let x: HTMLElement | null = e; x; x = x.parentElement) z *= Number(getComputedStyle(x).zoom) || 1;
      const px = parseFloat(s.fontSize) * z;
      if (px < 11.99) aus.push(`${e.tagName.toLowerCase()}.${e.className}: ${px.toFixed(2)} px «${e.textContent!.trim().slice(0, 30)}»`);
    }
    return aus;
  });
  expect(klein).toEqual([]);
  const seiten = pdfSeiten(await page.pdf({ format: 'A4', landscape: true, printBackground: true }), 'lagebild');
  expect(seiten.length).toBe(2);
  const inhalt = (s: string) => s.split('\n').map((z) => z.trim()).filter((z) => z && !/Muster Maschinenbau AG|^Stand \d|Seite \d+ \/ \d+/.test(z));
  expect(inhalt(seiten[1]!)[0]).toMatch(/^Umsetzung der Controls je Gruppe/);
  expect(seiten[0]).toContain('Für die Geschäftsleitung');
  expect(seiten[0]).toMatch(/Risiken vor und nach|Risikomatrix|vor Behandlung/);
  expect(seiten[1]).toContain('KI-Inventar');
  // A-17: kein Kartentitel als letzte Inhaltszeile einer Seite
  const titel = await page.locator('.lagebild .karte h2').allTextContents();
  seiten.forEach((s, i) => {
    const letzte = inhalt(s).at(-1) ?? '';
    expect(titel.some((x) => x.trim() && letzte.startsWith(x.trim())), `Seite ${i + 1} endet mit Titel «${letzte}»`).toBe(false);
  });
  expect(fehler).toEqual([]);
});

// ------------------------------------------------------------------------------------------------ V-22 (A-19)
test('V-22 (A-19): Drucktitel ohne «AIMS-Manager», Ersatzfuss ohne Seitenzahl in Firefox und WebKit', async ({ page, browserName }) => {
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  for (const [r, soll] of [['#/formular/uebersicht', 'Lagebild'], ['#/formular/risiken', ''], ['#/bibliothek', '']] as const) {
    await page.emulateMedia({ media: 'screen' });
    await geh(page, r);
    await expect(page).toHaveTitle(/AIMS-Manager/);
    // Name des Ausdrucks: Titel der Ansicht wie in der Registerkarte (Lagebild aus dem Befund A-19)
    const ausdruck = soll || (await page.title()).replace(/^• /, '').split(' · ')[0]!;
    const titel = await page.evaluate(() => {
      dispatchEvent(new Event('beforeprint'));
      const x = document.title;
      dispatchEvent(new Event('afterprint'));
      return x;
    });
    expect(titel).toMatch(new RegExp(`^${ausdruck} · Muster Maschinenbau AG · Stand \\d\\d\\.\\d\\d\\.\\d{4}$`));
    await expect(page).toHaveTitle(/AIMS-Manager/);
    if (browserName !== 'chromium') {
      await page.emulateMedia({ media: 'print' });
      const fuss = page.locator('.druck-fuss-fest');
      await expect(fuss).toBeVisible();
      await expect(fuss).toContainText(/Muster Maschinenbau AG · Stand \d\d\.\d\d\.\d{4}/);
      await expect(fuss).toContainText(ausdruck);
      await expect(fuss).not.toContainText(/Seite|\d+ \/ \d+/);
    }
  }
  expect(fehler).toEqual([]);
});

// ------------------------------------------------------------------------------------------------ A-07
test('A-07: Stage-1-Bericht mit Pillen für Ergebnis, Art der Regel, Stand der Etappen und Status der Dokumente', async ({ page }) => {
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  await geh(page, '#/pruefung/stage1');
  const bericht = page.locator('main .s1-bericht');
  await expect(bericht.locator('#s1-ergebnis .pille')).toHaveCount(1);
  const spalte = async (kopf: string) => bericht.locator('table').filter({ has: page.locator('thead th', { hasText: new RegExp(`^${kopf}$`) }) }).first().evaluate((t, k) => {
    const i = [...t.querySelectorAll('thead th')].findIndex((th) => th.textContent!.trim() === k);
    return [...t.querySelectorAll('tbody tr')].map((z) => z.children[i]?.querySelectorAll('.pille').length ?? 0);
  }, kopf);
  for (const k of ['Art', 'Stand', 'Status']) {
    const zellen = await spalte(k);
    expect(zellen.length, k).toBeGreaterThan(0);
    expect(zellen.filter((n) => n !== 1).length, `${k}: Zeilen ohne genau eine Pille`).toBe(0);
  }
  expect(fehler).toEqual([]);
});

// ------------------------------------------------------------------------------------------------ A-10
test('A-10: alle Abstände im Inhalt im 4-px-Raster (Listen, Guide, Inhalt, Matrix)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Masse in Chromium');
  test.setTimeout(120_000);
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  const falsch: string[] = [];
  for (const [b, h] of [[1440, 900], [1280, 720], [1024, 768]] as const) {
    await page.setViewportSize({ width: b, height: h });
    for (const r of ['#/start', '#/gefuehrt/E3/E3-risikobereitschaft', '#/gefuehrt/E4/E4-systeme', '#/formular/risiken', '#/formular/uebersicht', '#/bibliothek', '#/pruefung', '#/prozesse', '#/dokumente', '#/einstellungen']) {
      await geh(page, r);
      for (const x of await page.evaluate(() => {
        const aus: string[] = [];
        for (const e of document.querySelectorAll('main *')) {
          if (!e.getBoundingClientRect().width) continue;
          const s = getComputedStyle(e);
          for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'rowGap', 'columnGap'] as const) {
            const v = s[p];
            if (!v.endsWith('px') || Math.abs(parseFloat(v)) % 4 === 0) continue;
            aus.push(`${p} ${v} ${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 2).join('.')}`);
          }
        }
        return [...new Set(aus)];
      })) falsch.push(`${b} ${r}: ${x}`);
    }
  }
  expect(falsch).toEqual([]);
  expect(fehler).toEqual([]);
});

// ------------------------------------------------------------------------------------------------ A-14
for (const [b, h] of [[1440, 900], [1280, 720]] as const) test(`A-14 ${b}: Meldung nach «Zur Prüfung geben» und «Freigeben …» verdeckt kein Bedienelement`, async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Bibliothek im Browserspeicher, Ablauf in Chromium');
  test.setTimeout(120_000);
  await beantworteRueckfragen(page, true);
  await page.setViewportSize({ width: b, height: h });
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  await geh(page, '#/bibliothek/alle');
  await page.click('#bib-browser');
  await expect(page.locator('#bib-verbindung')).toContainText(/Browserspeicher/);
  await page.click('#bib-erzeugen');
  await expect(page.locator('.bib-tabelle tbody tr').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#bib-erzeugen')).toBeEnabled({ timeout: 60_000 });
  await geh(page, '#/bibliothek/alle/D-07');
  await expect(page.locator('#bib-detail')).toContainText('D-07');
  await page.click('#bib-status-in-pruefung');
  await expect(page.locator('#meldung')).toContainText('D-07');
  await page.click('#bib-status-freigegeben');
  await expect(page.locator('#bib-freigabe-ok')).toBeVisible();
  await expect(page.locator('#bib-gp-von')).toHaveAttribute('data-wert', /^P-\d{3}$/);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await expect(page.locator('#meldung')).toContainText('D-07');
  // Meldung und Bedienelemente im selben Augenblick messen
  const falsch = await page.evaluate(() => {
    const m = document.getElementById('meldung')!.getBoundingClientRect();
    if (!m.width) return ['Meldung nicht sichtbar'];
    return [...document.querySelectorAll<HTMLElement>('main button, main a[href], main input')].filter((e) => {
      const z = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return z.width > 0 && z.height > 0 && s.visibility !== 'hidden' && m.left < z.right && z.left < m.right && m.top < z.bottom && z.top < m.bottom;
    }).map((e) => `«${e.textContent?.trim() || e.id}» unter der Meldung`);
  });
  expect(falsch).toEqual([]);
  expect(fehler).toEqual([]);
});

// ------------------------------------------------------------------------------------------------ A-18
test('A-18: Zusatzzeile zum Status im Register ganz sichtbar (Name und Datum)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Masse in Chromium');
  const { fehler } = await starte(page);
  await oeffne(page, MUSTER);
  for (const [b, h] of [[1440, 900], [1280, 720]] as const) {
    await page.setViewportSize({ width: b, height: h });
    await geh(page, '#/formular/risiken');
    const zusatz = page.locator('.vliste .status-zusatz');
    await expect(zusatz.first()).toBeVisible();
    const gekuerzt = await page.locator('.vliste').evaluate((l) => [...l.querySelectorAll<HTMLElement>('.status-zusatz')].filter((z) => {
      const zelle = z.closest<HTMLElement>('.zelle')!;
      const r = z.getBoundingClientRect();
      return z.scrollWidth > z.clientWidth + 1 || r.bottom > zelle.getBoundingClientRect().bottom + 0.5 || zelle.scrollHeight > zelle.clientHeight + 1;
    }).map((z) => z.textContent));
    expect(gekuerzt, `${b}`).toEqual([]);
  }
  expect(fehler).toEqual([]);
});
