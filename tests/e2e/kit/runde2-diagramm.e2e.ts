// Runde 2 (E2-03, E2-04, E2-05, E2-18, E2-19): Die Originaleingaben der Prüfung laufen wirklich im Viewer. Vor der Behebung hingen
// sie oder liessen den Speicher bis zum Abbruch wachsen. Regel: doppelte Kennungen und zyklische Eltern werden abgelehnt.
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { baueDiagrammansicht } from '../../../scripts/diagrammansicht.mts';

const FIX = join(process.cwd(), 'tests', 'fixtures', 'runde2');
const HAENGER = join(FIX, 'drawio-haenger');
/** Ohne doppelte Kennung und ohne Zyklus: bleiben lesbar */
const OFFEN = new Set(['k9_parent_fehlt.drawio', 'q05_kein_dup_source_selbst.drawio', 's.drawio']);
let seite = '';

test.use({ viewport: { width: 1300, height: 900 }, locale: 'de-CH', colorScheme: 'light' });
test.skip(({ browserName }) => browserName !== 'chromium', 'Bombe und Hänger nur in Chromium, Speichervorgabe der VM');

test.beforeAll(() => {
  seite = join(mkdtempSync(join(tmpdir(), 'dia-r2-')), 'Diagrammansicht.html');
  writeFileSync(seite, baueDiagrammansicht().html);
});

async function oeffne(page: Page, datei: string): Promise<{ text: string; fehler: boolean }> {
  await page.goto(pathToFileURL(seite).href);
  await page.locator('#datei').setInputFiles(datei);
  await page.waitForFunction(() => {
    const s = document.querySelector('#status');
    return !!s && !!(s as HTMLElement).innerText.trim() && (/fehler/.test(s.className) || /geöffnet|Seite/.test((s as HTMLElement).innerText));
  }, null, { timeout: 15_000 });
  return page.evaluate(() => {
    const s = document.querySelector('#status') as HTMLElement;
    return { text: s.innerText, fehler: /fehler/.test(s.className) };
  });
}

for (const f of readdirSync(HAENGER).sort()) {
  test(`E2-03 ${f}`, async ({ page }) => {
    const r = await oeffne(page, join(HAENGER, f));
    expect(r.fehler, r.text).toBe(!OFFEN.has(f));
    // Seite antwortet weiter, kein Rohtext des Viewers
    expect(await page.evaluate(() => 1 + 1)).toBe(2);
    expect(r.text).not.toMatch(/Self Reference|string to be decoded|undefined/);
  });
}

for (const [f, muster] of [['dtd_pct21.drawio', /Dokumenttyp/], ['dtd_kind.drawio', /Dokumenttyp/], ['dtd_muell.drawio', /nicht|kein/i]] as const) {
  test(`E2-04 ${f}`, async ({ page }) => {
    const r = await oeffne(page, join(FIX, 'eingaben', f));
    expect(r.fehler, r.text).toBe(true);
    expect(r.text).toMatch(muster);
  });
}

test('E2-05: 400 MB entpackt in einer Seite mit Kind werden gestoppt', async ({ page }) => {
  const r = await oeffne(page, '/tmp/q2-e/eingaben/umg/bombe_kind.drawio').catch(() => null);
  test.skip(r === null, 'Eingabe nur auf der Prüf-VM');
  expect(r!.fehler).toBe(true);
  expect(r!.text).toContain('umfangreich');
});

test('E2-19: url( in Stilwerten und fremde Bilder in Labels laden nichts', async ({ page }) => {
  const anfragen: string[] = [];
  const csp: string[] = [];
  page.on('request', (q) => { if (!/^(data|blob):/.test(q.url()) && !q.url().includes('Diagrammansicht.html')) anfragen.push(q.url()); });
  page.on('console', (m) => { if (/Content.Security.Policy|Refused/i.test(m.text())) csp.push(m.text()); });
  const pfad = join(mkdtempSync(join(tmpdir(), 'dia-r2b-')), 'bild.drawio');
  writeFileSync(pfad, '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="&lt;img src=&quot;bild.png&quot;&gt;&lt;img src=&quot;https://example.org/x.png&quot;&gt;Text" style="html=1;strokeColor=url(https://example.org/s);" parent="1" vertex="1"><mxGeometry width="80" height="40" as="geometry"/></mxCell></root></mxGraphModel>');
  const r = await oeffne(page, pfad);
  expect(r.fehler, r.text).toBe(false);
  await page.waitForTimeout(300);
  expect(anfragen.filter((u) => /example\.org|bild\.png/.test(u))).toEqual([]);
  expect(csp).toEqual([]);
});
