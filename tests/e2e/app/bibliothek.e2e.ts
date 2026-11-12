// Bibliothek (R4) in drei Engines: Ordnerzugriff nur Chromium (Test-Doppel von showDirectoryPicker auf einem echten
// Ordner, weil Playwright den Auswahldialog unter file:// nicht bedienen kann),
// Browserspeicher mit Sicherung als ZIP in Firefox und WebKit (und Chromium ohne Ordner). Mit axe hell und dunkel.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test, beantworteRueckfragen } from './app-hilfen.ts';
import type { Projekt } from '../../../src/model/typen.ts';
import { ORDNER, fixtureDatei, oeffne, starte } from './app-hilfen.ts';
import { waehle } from '../auswahl-hilfen.ts';

const BILDER = '/tmp/rc10-bilder';

/** Test-Doppel: FileSystemDirectoryHandle im Browser, Dateien im echten Ordner `wurzel` (über exposeFunction) */
async function ordnerDoppel(page: Page, wurzel: string, berechtigungNachNeuladen: 'granted' | 'prompt' = 'granted'): Promise<void> {
  mkdirSync(wurzel, { recursive: true });
  // Berechtigung im Test-Prozess: nach dem ersten Laden der Seite gilt `berechtigungNachNeuladen`, bis requestPermission
  const stand = { ladungen: 0, erlaubt: 'granted' as string };
  await page.exposeFunction('__fsaOp', (op: string, pfad: string, b64?: string) => {
    if (op === 'ladung') {
      stand.ladungen++;
      if (stand.ladungen > 1) stand.erlaubt = berechtigungNachNeuladen;
      return null;
    }
    if (op === 'abfragen') return stand.erlaubt;
    if (op === 'erlauben') return (stand.erlaubt = 'granted');
    const p = join(wurzel, pfad);
    if (op === 'liste') return existsSync(p) ? readdirSync(p).map((n) => ({ name: n, ordner: statSync(join(p, n)).isDirectory() })) : null;
    if (op === 'stat') return existsSync(p) ? { ordner: statSync(p).isDirectory(), mtime: Math.floor(statSync(p).mtimeMs) } : null;
    if (op === 'mkdir') return void mkdirSync(p, { recursive: true });
    if (op === 'lesen') return existsSync(p) ? { b64: readFileSync(p).toString('base64'), mtime: Math.floor(statSync(p).mtimeMs) } : null;
    if (op === 'schreiben') {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, Buffer.from(b64 ?? '', 'base64'));
      return null;
    }
    if (op === 'loeschen') return void rmSync(p, { force: true });
    return null;
  });
  await page.addInitScript(() => {
    const op = (window as unknown as { __fsaOp: (o: string, p: string, b?: string) => Promise<unknown> }).__fsaOp;
    const nf = (n: string) => Object.assign(new Error(`fehlt: ${n}`), { name: 'NotFoundError' });
    const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
    void op('ladung', '');
    class FGriff {
      kind = 'file';
      constructor(public pfad: string, public name: string) {}
      async getFile() {
        const r = (await op('lesen', this.pfad)) as { b64: string; mtime: number } | null;
        if (!r) throw nf(this.pfad);
        const bin = atob(r.b64);
        const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return new File([u], this.name, { lastModified: r.mtime });
      }
      async createWritable() {
        const teile: Uint8Array[] = [];
        const pfad = this.pfad;
        return {
          async write(d: BufferSource | Blob) { teile.push(d instanceof Blob ? new Uint8Array(await d.arrayBuffer()) : new Uint8Array(ArrayBuffer.isView(d) ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : d)); },
          async close() { const n = teile.reduce((s, t) => s + t.length, 0); const u = new Uint8Array(n); let o = 0; for (const t of teile) { u.set(t, o); o += t.length; } await op('schreiben', pfad, b64(u)); },
        };
      }
    }
    class DGriff {
      kind = 'directory';
      constructor(public pfad: string, public name: string) {}
      private k(n: string) { return this.pfad ? `${this.pfad}/${n}` : n; }
      async getDirectoryHandle(n: string, o?: { create?: boolean }) {
        const s = (await op('stat', this.k(n))) as { ordner: boolean } | null;
        if (!s) { if (!o?.create) throw nf(n); await op('mkdir', this.k(n)); }
        return new DGriff(this.k(n), n);
      }
      async getFileHandle(n: string, o?: { create?: boolean }) {
        const s = (await op('stat', this.k(n))) as { ordner: boolean } | null;
        if (!s && !o?.create) throw nf(n);
        return new FGriff(this.k(n), n);
      }
      async removeEntry(n: string) { await op('loeschen', this.k(n)); }
      async *values() {
        const l = ((await op('liste', this.pfad)) as { name: string; ordner: boolean }[] | null) ?? [];
        for (const e of l) yield e.ordner ? new DGriff(this.k(e.name), e.name) : new FGriff(this.k(e.name), e.name);
      }
      async queryPermission() { return op('abfragen', ''); }
      async requestPermission() { return op('erlauben', ''); }
    }
    const w = window as unknown as Record<string, unknown>;
    w['showDirectoryPicker'] = async () => new DGriff('', 'AIMS-Bibliothek');
    w['__aimsOrdnerWiederbeleben'] = (roh: { pfad?: string; name?: string }) => (roh && typeof roh.pfad === 'string' ? new DGriff(roh.pfad, roh.name ?? 'AIMS-Bibliothek') : null);
  });
}

/** Kleinste gültige PDF mit einer Seite (Rechteck und Text), für die Vorschau mit pdf.js */
function kleinePdf(datei: string): string {
  const inhalt = 'q 0.2 0.3 0.8 rg 40 700 200 60 re f Q BT /F1 24 Tf 40 640 Td (Nachweis) Tj ET';
  const objekte = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${inhalt.length} >>\nstream\n${inhalt}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const lage: number[] = [];
  objekte.forEach((o, i) => {
    lage.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n${lage.map((l) => `${String(l).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  writeFileSync(datei, pdf, 'latin1');
  return datei;
}

function mitPersonen(p: Projekt): void {
  p.personen.push({ id: 'P-002', name: 'Beat Prüfer', funktion: 'Qualität', aimsRollen: [] }, { id: 'P-003', name: 'Clara Leitung', funktion: 'Geschäftsleitung', aimsRollen: [] });
  p.nachweise = [{ id: 'N-001', titel: 'Schulungsliste', art: 'schulung', ablageort: 'SharePoint', datum: '2026-09-01' }];
}

async function axe(page: Page, wo: string): Promise<void> {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => `${wo}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

async function bild(page: Page, name: string): Promise<void> {
  mkdirSync(BILDER, { recursive: true });
  // caret: 'initial', sonst setzt Playwright einen Stilblock ein, den die CSP (zu Recht) ablehnt
  await page.screenshot({ path: join(BILDER, `bibliothek-${name}.png`), fullPage: false, caret: 'initial' });
}

async function zurBibliothek(page: Page, unter = 'alle'): Promise<void> {
  await page.evaluate((u) => (location.hash = `#/bibliothek/${u}`), unter);
  await expect(page.locator('#bib-verbindung')).toBeVisible();
}

test.describe('Bibliothek', () => {
  test.beforeEach(async ({ page }) => {
    await beantworteRueckfragen(page, true);
  });

  test('Ordner verbinden, hochladen, Version einchecken, Freigabe nach D-26, Abgleich, Neuladen', async ({ page, browserName }, info) => {
    test.skip(browserName !== 'chromium', 'Ordnerzugriff (File System Access) gibt es nur in Chromium');
    const wurzel = join(ORDNER, `bib-${info.testId}`);
    rmSync(wurzel, { recursive: true, force: true });
    await ordnerDoppel(page, wurzel, 'prompt');
    const { fehler } = await starte(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await oeffne(page, fixtureDatei('bibliothek.aims.json', false, mitPersonen));
    await zurBibliothek(page);
    await page.click('#bib-ordner-verbinden');
    await expect(page.locator('#bib-verbindung')).toContainText('AIMS-Bibliothek');
    // Erwartung geändert (T5): Datei wird nach der Anzeige geschrieben, unter Last später; warten statt einmal lesen
    await expect.poll(() => existsSync(join(wurzel, 'bibliothek.json'))).toBe(true);

    // Hochladen (Dateiauswahl): eigene Datei mit Version 1.0 im Layout Eigene/<Kennung>_<Titel>/v1.0.ext
    const vertrag = join(ORDNER, 'Vertrag HR-SaaS.txt');
    writeFileSync(vertrag, 'Vertrag mit KI-Anhang, Fassung 1');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bib-hochladen')]);
    await fc.setFiles(vertrag);
    await expect(page.locator('#bib-detail')).toContainText('Vertrag HR-SaaS');
    expect(existsSync(join(wurzel, 'Eigene/X-001_Vertrag-HR-SaaS/v1.0.txt'))).toBe(true);
    await expect(page.locator('#bib-detail')).toContainText('X-001');

    // Vorschau (Text) und neue Version einchecken
    await page.click('#bib-vorschau');
    await expect(page.locator('#bib-vorschau-bereich')).toContainText('Fassung 1');
    writeFileSync(vertrag, 'Vertrag mit KI-Anhang, Fassung 2');
    const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bib-einchecken')]);
    await fc2.setFiles(vertrag);
    await expect(page.locator('#bib-detail .bib-versionen')).toContainText('v1.1');

    // Status nach D-26: zur Prüfung, Freigabe nur mit zweiter Person
    await page.click('#bib-status-in-pruefung');
    await page.click('#bib-status-freigegeben');
    await waehle(page.locator('#bib-gp-von'), 'P-002');
    await waehle(page.locator('#bib-fg-von'), 'P-002');
    await page.click('#bib-freigabe-ok');
    await expect(page.locator('#bib-freigabe [role=alert]')).toContainText(/zwei verschiedene Personen|two different people/);
    await waehle(page.locator('#bib-fg-von'), 'P-003');
    // Erste freigegebene Fassung: kein Feld «Was wurde geändert?» (U-24); das Formular ist im Blick
    await expect(page.locator('#bib-aenderung')).toHaveCount(0);
    await expect(page.locator('#bib-freigabe')).toBeInViewport();
    await page.click('#bib-freigabe-ok');
    await expect(page.locator('#bib-detail dl')).toContainText(/Freigegeben|Approved/);
    await expect(page.locator('#bib-detail')).toContainText('Clara Leitung');
    await bild(page, 'ordner-detail');
    await axe(page, 'Bibliothek mit Detail (dunkel)');

    // Datei ausserhalb ändern: Abgleich meldet sie und schlägt eine neue Version vor
    const v11 = join(wurzel, 'Eigene/X-001_Vertrag-HR-SaaS/v1.1.txt');
    writeFileSync(v11, 'Vertrag mit KI-Anhang, in Word geändert');
    utimesSync(v11, new Date(), new Date(Date.now() + 5000));
    await page.click('#bib-abgleichen');
    await expect(page.locator('#bib-abgleich')).toContainText('X-001');
    await bild(page, 'abgleich');
    await page.locator('#bib-abgleich button', { hasText: /neue Version|new version/ }).click();
    await expect(page.locator('#bib-abgleich')).toHaveCount(0);
    await expect(page.locator('#bib-detail .bib-versionen')).toContainText('v1.2');

    const versionenImOrdner = () => (JSON.parse(readFileSync(join(wurzel, 'bibliothek.json'), 'utf8')) as { eintraege: { id: string; versionen: unknown[] }[] }).eintraege.find((e) => e.id === 'X-001')?.versionen.length;
    await expect.poll(versionenImOrdner).toBe(3);

    // Projekt speichern, neu laden und wieder öffnen: der gemerkte Ordner braucht einen Klick («prompt»)
    const [pdl] = await Promise.all([page.waitForEvent('download'), page.click('#speichern')]);
    const projektDatei = join(ORDNER, `bib-${info.testId}-projekt.aims.json`);
    await pdl.saveAs(projektDatei);
    const gespeichert = JSON.parse(readFileSync(projektDatei, 'utf8')) as Projekt;
    expect(gespeichert.bibliothek?.eintraege.find((e) => e.id === 'X-001')?.versionen.map((v) => v.version)).toEqual(['1.0', '1.1', '1.2']);
    expect(JSON.stringify(gespeichert)).not.toContain('Fassung 2');
    // Marke setzen, damit sicher ist, dass wirklich neu geladen wurde (beforeunload kann das Neuladen sonst verzögern)
    await page.evaluate(() => ((window as unknown as Record<string, unknown>)['__alteSeite'] = 1));
    await page.reload({ waitUntil: 'load' });
    await expect.poll(() => page.evaluate(() => (window as unknown as Record<string, unknown>)['__alteSeite'] ?? 0)).toBe(0);
    await page.waitForSelector('body[data-bedienbar]');
    await oeffne(page, projektDatei);
    await zurBibliothek(page);
    await expect(page.locator('#bib-freigeben')).toBeVisible();
    await bild(page, 'freigabe-nach-neuladen');
    await page.click('#bib-freigeben');
    await expect(page.locator('#bib-verbindung')).toContainText('AIMS-Bibliothek');
    await expect(page.locator('.bib-tabelle')).toContainText('Vertrag HR-SaaS');
    expect(fehler).toEqual([]);
  });

  test('Firmendokumente aus dem Generator, D-26 aus der Bibliothek und Vorschau (Chromium, Ordner)', async ({ page, browserName }, info) => {
    test.skip(browserName !== 'chromium', 'Ordnerzugriff nur in Chromium');
    test.setTimeout(180_000);
    const wurzel = join(ORDNER, `bib-gen-${info.testId}`);
    rmSync(wurzel, { recursive: true, force: true });
    await ordnerDoppel(page, wurzel);
    const { fehler } = await starte(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await oeffne(page, fixtureDatei('bibliothek-gen.aims.json', false, mitPersonen));
    await zurBibliothek(page, 'firma');
    await page.click('#bib-ordner-verbinden');
    await expect(page.locator('#bib-verbindung')).toContainText('AIMS-Bibliothek');
    await page.click('#bib-erzeugen');
    await expect(page.locator('#meldung')).toContainText(/Neue Versionen|New versions/, { timeout: 120_000 });
    expect(existsSync(join(wurzel, 'Firmendokumente'))).toBe(true);
    const d07 = readdirSync(join(wurzel, 'Firmendokumente')).find((n) => n.startsWith('D-07_'))!;
    expect(readdirSync(join(wurzel, 'Firmendokumente', d07))).toEqual(['v1.1.xlsx']);
    // Zweiter Lauf ohne Änderung im Projekt: unveränderte Dokumente erhalten keine neue Version. Nur das Register zu D-26
    // ändert sich einmal, weil es jetzt die Entwürfe aus der Bibliothek nennt.
    await page.click('#bib-erzeugen');
    await expect(page.locator('#meldung')).toContainText(/Neue Versionen: [01],|New versions: [01],/, { timeout: 120_000 });
    expect(readdirSync(join(wurzel, 'Firmendokumente', d07))).toEqual(['v1.1.xlsx']);
    // Vorschau eines Excel-Registers
    await page.locator('.bib-tabelle a[href$="/D-07"]').click();
    await page.click('#bib-vorschau');
    await expect(page.locator('#bib-vorschau-bereich table')).toBeVisible({ timeout: 30_000 });
    await bild(page, 'firmendokumente');
    // Vorlage des Kits erzeugen und herunterladen
    await zurBibliothek(page, 'vorlagen');
    await page.locator('.bib-tabelle a', { hasText: /Kontext|Context/ }).first().click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bib-vorlage')]);
    expect(dl.suggestedFilename()).toMatch(/^D-01_.*\.docx$/);
    expect(fehler).toEqual([]);
  });

  test('Browserspeicher: hochladen, Hinweis, Sicherung als ZIP und Wiederherstellung, PDF-Vorschau', async ({ page, browserName }, info) => {
    test.setTimeout(120_000);
    const { fehler } = await starte(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await oeffne(page, fixtureDatei('bibliothek-browser.aims.json', false, mitPersonen));
    await zurBibliothek(page, 'nachweise');
    if (browserName !== 'chromium') await expect(page.locator('#bib-ordner-verbinden')).toHaveCount(0);
    await page.click('#bib-browser');
    await expect(page.locator('#bib-verbindung')).toContainText(/Browserspeicher|browser storage/);
    // Drag-and-drop ist im Test nicht nativ möglich; Dateiauswahl: PDF als Nachweis
    mkdirSync(ORDNER, { recursive: true });
    const pdf = kleinePdf(join(ORDNER, `Protokoll Workshop ${browserName}.pdf`));
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bib-hochladen')]);
    await fc.setFiles(pdf);
    await expect(page.locator('#bib-detail')).toContainText('N-002');
    await page.click('#bib-vorschau');
    await expect(page.locator('#bib-vorschau-bereich img')).toBeVisible({ timeout: 30_000 });
    // Bildschirmfoto nicht in WebKit: Playwright setzt dort beim Foto einen Stilblock ein, den die CSP ablehnt
    if (browserName !== 'webkit') await bild(page, `browser-${browserName}`);
    await axe(page, `Browserspeicher ${browserName}`);
    // Sicherung als ZIP
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bib-sichern')]);
    const zip = join(ORDNER, `${browserName}-${info.testId}-bibliothek.zip`);
    await dl.saveAs(zip);
    expect(statSync(zip).size).toBeGreaterThan(100);
    // Wiederherstellung in einem frischen Browserspeicher (anderes Projekt mit derselben Kennung simuliert Neuinstallation)
    await page.evaluate(() => new Promise<void>((ok) => { const r = indexedDB.deleteDatabase('aims-bibliothek'); r.onsuccess = r.onerror = r.onblocked = () => ok(); }));
    const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bib-laden')]);
    await fc2.setFiles(zip);
    await expect(page.locator('#meldung')).toContainText(/Sicherung geladen|Backup loaded/);
    await page.click('#bib-vorschau');
    await page.click('#bib-vorschau');
    await expect(page.locator('#bib-vorschau-bereich img')).toBeVisible({ timeout: 30_000 });
    // hell (nach dem Wechsel die Übergänge der Knöpfe abwarten, sonst misst axe Zwischenfarben)
    await page.evaluate(() => (document.documentElement.dataset['theme'] = 'hell'));
    await page.waitForTimeout(400);
    await axe(page, `Browserspeicher hell ${browserName}`);
    if (browserName === 'chromium') await bild(page, 'hell');
    // WebKit meldet beim Download über einen blob:-Link unter file:// «Cannot load blob:null/…», lädt die Datei aber herunter
    expect(fehler.filter((f) => !(browserName === 'webkit' && /^Cannot load blob:null\//.test(f)))).toEqual([]);
  });

  test('Schmale Ansicht und Arbeitsliste', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'einmal genügt');
    await starte(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await oeffne(page, fixtureDatei('bibliothek-schmal.aims.json', false, (p) => {
      mitPersonen(p);
      p.dokumente[0]!.naechsteUeberpruefung = '2026-01-01';
    }));
    await zurBibliothek(page, 'pruefen');
    await expect(page.locator('.bib-tabelle')).toContainText('D-07');
    const breite = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(breite).toBeLessThanOrEqual(392);
    await bild(page, 'schmal');
    await axe(page, 'Bibliothek schmal');
  });
});
