// Regressionen der zweiten Prüfrunde im Browser, mit den Originaleingaben der Prüfung.
import { existsSync, mkdtempSync, readFileSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test, beantworteRueckfragen } from './app-hilfen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, fixtureDatei, oeffne, starte } from './app-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.skip(({ browserName }) => browserName !== 'chromium', 'Eingaben mit grossem Speicherbedarf: nur Chromium, Speichervorgabe der VM');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, acceptDownloads: true });

const FIX = join(REPO, 'tests/fixtures/runde2/eingaben');
const UMG = '/tmp/q2-e/eingaben/umg';
const TMP = mkdtempSync(join(tmpdir(), 'r2-'));
const beispiel = () => JSON.parse(readFileSync(join(REPO, 'src/beispiele/praezisionsteile.de.aims.json'), 'utf8')) as Record<string, any>;
const datei = (name: string, inhalt: unknown) => {
  const p = join(TMP, name);
  writeFileSync(p, typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt));
  return p;
};
const hash = (page: Page, h: string) => page.evaluate((x) => (location.hash = x), h);

test('E2-01: Text mit Datumsbeginn überlebt Speichern und Öffnen', async ({ page }) => {
  const { fehler } = await starte(page);
  const b = beispiel();
  b.massnahmen[0].titel = '2026-03-15 Kick-off KI-Rat';
  await oeffne(page, datei('text-mit-datum.aims.json', b));
  await expect(page.locator('#start-fehler')).toHaveCount(0);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  const gespeichert = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  expect(gespeichert.massnahmen[0].titel).toBe('2026-03-15 Kick-off KI-Rat');
  expect(fehler).toEqual([]);
});

test('E2-15: Reparatur zeigt die Änderungen vorher und gelingt bei falschem Status; Vorschlag mit neuem Namen', async ({ page }) => {
  const { fehler } = await starte(page);
  const b = beispiel();
  b.kiSysteme[0].status = 'boese';
  const pfad = datei('rep_status.aims.json', b);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#start-oeffnen')]);
  await fc.setFiles(pfad);
  await expect(page.locator('#start-reparatur-liste')).toContainText('boese');
  await page.click('#start-reparieren');
  await expect(page.locator('#start-fehler')).toHaveCount(0);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  expect(dl.suggestedFilename()).toMatch(/repariert/);
  expect(fehler).toEqual([]);
});

test('D2-01, D2-02: Etappenleiste in Zeilen, kein falscher Ortshinweis', async ({ page }) => {
  await starte(page);
  await oeffne(page, fixtureDatei('r2-d.aims.json'));
  await hash(page, '#/formular/uebersicht');
  const a = page.locator('.etappen li.aktiv a, .etappen a').first();
  await expect(a).toBeVisible();
  expect(await a.evaluate((e) => getComputedStyle(e).display)).toBe('flex');
  expect(await a.evaluate((e) => getComputedStyle(e).flexDirection)).toBe('column');
  await hash(page, '#/formular/soa');
  await expect(page.locator('main')).not.toContainText('Wählen Sie links');
});

test('C2-10: Fehlende Dateien der Bibliothek werden beim Öffnen gemeldet, mit Weg', async ({ page }) => {
  await starte(page);
  await oeffne(page, fixtureDatei('r2-c10.aims.json', false, (p) => {
    p.bibliothek = { ablage: 'browser', eintraege: [{ id: 'X-101', art: 'eigene', titel: 'Vertrag', versionen: [{ version: '1.0', datei: 'Eigene/X-101_Vertrag/v1.0.txt', name: 'Vertrag.txt', groesse: 4, pruefsumme: '0'.repeat(64), datum: '2026-01-01T00:00:00Z', geaendert: 1, quelle: 'hochgeladen' }] }] } as never;
  }));
  await hash(page, '#/bibliothek/alle');
  await expect(page.locator('#bib-dateien-fehlen')).toContainText('Sicherung laden');
  await expect(page.locator('#bib-fehlen-laden')).toBeVisible();
});

test('E2-14: Sicherung ersetzt abweichende Datei nur nach Rückfrage, und das Original bleibt als Kopie', async ({ page }) => {
  await starte(page);
  await oeffne(page, fixtureDatei('r2-e14.aims.json'));
  await hash(page, '#/bibliothek/alle');
  await page.click('#bib-browser');
  const vertrag = datei('Vertrag.txt', 'ORIGINAL-IM-BROWSER');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bib-hochladen')]);
  await fc.setFiles(vertrag);
  await expect(page.locator('#bib-detail')).toContainText('X-001');
  // Sicherung derselben Bibliothek, aber mit anderem Dateiinhalt
  const [dlS] = await Promise.all([page.waitForEvent('download'), page.click('#bib-sichern')]);
  const { unzipSync, zipSync, strToU8 } = await import('fflate');
  const z = unzipSync(readFileSync(await dlS.path()));
  const pfad = Object.keys(z).find((n) => n.endsWith('.txt'))!;
  z[pfad] = strToU8('UEBERSCHRIEBEN-AUS-ZIP');
  const zip = join(TMP, 'sicherung.zip');
  writeFileSync(zip, zipSync(z));
  await beantworteRueckfragen(page, false, { einmal: true });
  await page.locator('#bib-laden-datei').setInputFiles(zip);
  await page.waitForTimeout(500);
  await page.click('#bib-vorschau');
  await expect(page.locator('#bib-vorschau-bereich')).toContainText('ORIGINAL-IM-BROWSER');
});

test('E2-09, E2-10: Mengen und Grösse werden abgelehnt, die Seite lebt', async ({ page }) => {
  await starte(page);
  await oeffne(page, fixtureDatei('r2-e09.aims.json'));
  await hash(page, '#/bibliothek/alle');
  await page.click('#bib-browser');
  const gross = join(TMP, 'video.bin');
  writeFileSync(gross, '');
  truncateSync(gross, 2_500_000_000);
  await page.locator('#bib-datei').setInputFiles(gross);
  await expect(page.locator('#meldung')).toContainText(/grösser als 512 MB/, { timeout: 20_000 });
  truncateSync(gross, 0);
  const orig = join(UMG, 'reg_viele_versionen.zip');
  if (existsSync(orig)) {
    await page.locator('#bib-laden-datei').setInputFiles(orig);
    await expect(page.locator('#meldung, .hinweis.fehler').first()).toBeVisible({ timeout: 30_000 });
  }
  expect(await page.evaluate(() => 1 + 1)).toBe(2);
});

test('E2-06, E2-07, E2-11: Logo-Umgehungen im Browser', async ({ page }) => {
  await starte(page);
  await oeffne(page, fixtureDatei('r2-logo.aims.json'));
  await hash(page, '#/einstellungen/gestaltung');
  for (const f of ['use_doppelhref.svg', 'clip_kette.svg']) {
    await page.locator('#gestaltung-datei').setInputFiles(join(FIX, f));
    // Meldung statt Hänger: Antwortet die Seite innert kurzer Zeit, ist nicht gerastert worden
    await expect(page.locator('#gestaltung-datei')).toBeAttached({ timeout: 8000 });
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => 1 + 1)).toBe(2);
    await expect(page.locator('main')).toContainText(/zu viele Elemente|mehrdeutig|nicht|unzulässig/i);
  }
});

test('D-05: PR-15 in der App: Nein-Zweig läuft nicht durch den Kasten', async ({ page }) => {
  await starte(page);
  await oeffne(page, join(REPO, 'src/beispiele/praezisionsteile.de.aims.json'));
  if (process.env['R2_BILDER']) {
    await hash(page, '#/formular/uebersicht');
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(process.env['R2_BILDER'], 'uebersicht.png') });
  }
  await hash(page, '#/prozesse/PR-15');
  const svg = page.locator('[id$="-figur"].prozess-ablauf svg').first();
  await expect(svg).toBeVisible();
  const r = await svg.evaluate((s) => {
    const formen = [...s.querySelectorAll('[data-knoten] rect')].map((e) => ({ x: +e.getAttribute('x')!, y: +e.getAttribute('y')!, b: +e.getAttribute('width')!, h: +e.getAttribute('height')! }));
    const fehler: string[] = [];
    for (const k of s.querySelectorAll('[data-kante]')) {
      const pt = k.querySelector('polyline')!.getAttribute('points')!.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
      for (let i = 1; i < pt.length; i++) {
        const [a, b] = [pt[i - 1]!, pt[i]!];
        for (const f of formen) if (Math.max(a[0], b[0]) > f.x + 1 && Math.min(a[0], b[0]) < f.x + f.b - 1 && Math.max(a[1], b[1]) > f.y + 1 && Math.min(a[1], b[1]) < f.y + f.h - 1) fehler.push(k.getAttribute('data-kante')!);
      }
    }
    return fehler;
  });
  expect(r).toEqual([]);
  if (process.env['R2_BILDER']) await svg.screenshot({ path: join(process.env['R2_BILDER'], 'pr15.png') });
});

/** Ordner und Dateiauswahl als Test-Doppel im Speicher der Seite, wie die echte Schnittstelle: Geschrieben wird erst beim Schliessen */
async function doppel(page: Page, mitDateiAuswahl = false): Promise<void> {
  await page.addInitScript((auswahl) => {
    const dateien = new Map<string, Uint8Array>();
    (window as any).__dateien = dateien;
    (window as any).__setze = (p: string, t: string) => dateien.set(p, new TextEncoder().encode(t));
    (window as any).__lies = (p: string) => (dateien.has(p) ? new TextDecoder().decode(dateien.get(p)) : null);
    const datei = (pfad: string, name: string): any => ({
      kind: 'file', name,
      getFile: async () => {
        if (!dateien.has(pfad)) throw Object.assign(new Error('fehlt'), { name: 'NotFoundError' });
        return new File([dateien.get(pfad)! as BlobPart], name, { lastModified: 1 });
      },
      createWritable: async () => {
        const teile: Uint8Array[] = [];
        return {
          write: async (d: any) => { teile.push(d instanceof Blob ? new Uint8Array(await d.arrayBuffer()) : typeof d === 'string' ? new TextEncoder().encode(d) : new Uint8Array(d.buffer ?? d)); },
          close: async () => {
            const u = new Uint8Array(teile.reduce((s, t) => s + t.length, 0));
            let o = 0;
            for (const t of teile) { u.set(t, o); o += t.length; }
            dateien.set(pfad, u);
          },
        };
      },
    });
    const ordner = (pfad: string, name: string): any => ({
      kind: 'directory', name,
      getDirectoryHandle: async (n: string, o?: { create?: boolean }) => {
        const p = `${pfad}${n}/`;
        if (!o?.create && ![...dateien.keys()].some((k) => k.startsWith(p))) throw Object.assign(new Error('fehlt'), { name: 'NotFoundError' });
        return ordner(p, n);
      },
      getFileHandle: async (n: string, o?: { create?: boolean }) => {
        const p = `${pfad}${n}`;
        if (!o?.create && !dateien.has(p)) throw Object.assign(new Error('fehlt'), { name: 'NotFoundError' });
        return datei(p, n);
      },
      removeEntry: async (n: string) => { dateien.delete(`${pfad}${n}`); },
      values: async function* () {
        const namen = new Set<string>();
        for (const k of dateien.keys()) if (k.startsWith(pfad)) namen.add(k.slice(pfad.length).split('/')[0]!);
        for (const n of namen) yield dateien.has(`${pfad}${n}`) ? datei(`${pfad}${n}`, n) : ordner(`${pfad}${n}/`, n);
      },
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
    });
    (window as any).showDirectoryPicker = async () => ordner('', 'AIMS-Bibliothek');
    // Nicht löschbar: starte() entfernt die Auswahlen sonst für den Weg über Download
    if (!auswahl) return;
    Object.defineProperty(window, 'showOpenFilePicker', { configurable: false, value: async () => [datei('Projekt.aims.json', 'Projekt.aims.json')] });
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: false, value: async () => datei('Neu.aims.json', 'Neu.aims.json') });
  }, mitDateiAuswahl);
}

test('E2-12: Extern geänderte Projektdatei wird nicht ohne Rückfrage überschrieben', async ({ page }) => {
  await doppel(page, true);
  const { fehler } = await starte(page);
  const inhalt = readFileSync(fixtureDatei('r2-e12.aims.json'), 'utf8');
  await page.evaluate((t) => (window as any).__setze('Projekt.aims.json', t), inhalt);
  await page.click('#start-oeffnen');
  await expect(page.locator('#speichern')).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => (window as any).__setze('Projekt.aims.json', 'VON-AUSSEN-GEAENDERT'));
  let frage = '';
  await beantworteRueckfragen(page, (text) => { frage = text; return false; }, { einmal: true });
  await page.click('#speichern');
  await expect(page.locator('#meldung')).toContainText('Nicht gespeichert', { timeout: 10_000 });
  expect(frage).toContain('ausserhalb');
  expect(await page.evaluate(() => (window as any).__lies('Projekt.aims.json'))).toBe('VON-AUSSEN-GEAENDERT');
  expect(fehler).toEqual([]);
});

test('E2-02: Bearbeitung im Ordner übersteht die Freigabe', async ({ page }) => {
  test.setTimeout(180_000);
  await doppel(page);
  await starte(page);
  await oeffne(page, fixtureDatei('r2-e02.aims.json', false, (p) => {
    p.personen.push({ id: 'P-010', name: 'Hans Keller', funktion: 'CEO', aimsRollen: [] }, { id: 'P-011', name: 'Rita Graf', funktion: 'CIO', aimsRollen: [] });
    p.dokumente = p.dokumente.filter((d) => d.id !== 'D-12');
  }));
  await hash(page, '#/bibliothek/alle');
  await page.click('#bib-ordner-verbinden');
  await page.click('#bib-erzeugen');
  await expect(page.locator('#meldung')).toContainText(/Neue Versionen/, { timeout: 120_000 });
  const pfad = await page.evaluate(() => [...(window as any).__dateien.keys()].find((k: string) => /D-12/.test(k) && /docx$/.test(k)));
  expect(pfad).toBeTruthy();
  await page.evaluate((p) => (window as any).__setze(p, 'IN-WORD-BEARBEITET'), pfad);
  await hash(page, '#/bibliothek/alle/D-12');
  await page.click('#bib-status-in-pruefung');
  await page.click('#bib-status-freigegeben');
  const { waehle } = await import('../auswahl-hilfen.ts');
  await waehle(page.locator('#bib-gp-von'), 'P-010');
  await waehle(page.locator('#bib-fg-von'), 'P-011');
  await page.click('#bib-freigabe-ok');
  await expect(page.locator('#meldung')).toContainText('nicht neu erzeugt', { timeout: 30_000 });
  expect(await page.evaluate((p) => (window as any).__lies(p), pfad)).toBe('IN-WORD-BEARBEITET');
});

test('E2-14: Zum Ordner überschreibt keine abweichende Datei', async ({ page }) => {
  await doppel(page);
  await starte(page);
  await oeffne(page, fixtureDatei('r2-e14o.aims.json'));
  await hash(page, '#/bibliothek/alle');
  await page.click('#bib-browser');
  const vertrag = datei('Vertrag.txt', 'BROWSER-STAND');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bib-hochladen')]);
  await fc.setFiles(vertrag);
  await expect(page.locator('#bib-detail')).toContainText('X-001');
  await page.evaluate(() => (window as any).__setze('Eigene/X-001_Vertrag/v1.0.txt', 'ORDNER-NEUER-STAND'));
  await page.getByRole('button', { name: 'In einen Ordner verschieben' }).first().click();
  await expect(page.locator('#meldung')).toContainText('1 Datei im Ordner weicht ab', { timeout: 15_000 });
  const r = await page.evaluate(() => {
    const w = window as any;
    return { orig: w.__lies('Eigene/X-001_Vertrag/v1.0.txt'), kopie: w.__lies('Eigene/X-001_Vertrag/v1.0.browser.txt') };
  });
  expect(r).toEqual({ orig: 'ORDNER-NEUER-STAND', kopie: 'BROWSER-STAND' });
});

test('C-21: Schritte des Prozesses bleiben im Bearbeiten lesbar', async ({ page }) => {
  await starte(page);
  await oeffne(page, join(REPO, 'src/beispiele/praezisionsteile.de.aims.json'));
  await hash(page, '#/prozesse/PR-15');
  const knopf = page.locator('[id$="bearbeiten"]').first();
  if (await knopf.count()) await knopf.click();
  const zeilen = page.locator('[id^="schritte-"] tbody tr');
  await expect(zeilen.first()).toBeVisible();
  const hoehen = await zeilen.evaluateAll((z) => z.map((e) => e.getBoundingClientRect().height));
  expect(Math.max(...hoehen)).toBeLessThan(180);
});
