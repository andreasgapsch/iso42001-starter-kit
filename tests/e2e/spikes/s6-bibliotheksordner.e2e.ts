// Spike S6 Bibliotheksordner: was die Bibliothek unter file:// voraussetzt.
// Hält die Annahmen als Regressionstest fest: Ordnerdialog nur Chromium und in Playwright nicht bedienbar, OPFS unter
// file:// gesperrt, IndexedDB mit ArrayBuffer (WebKit ohne Blob), SHA-256 über Web Crypto.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { TMP, befund } from './hilfen.ts';

const SEITE = join(TMP, 's6', 'probe.html');

test.beforeAll(() => {
  mkdirSync(join(TMP, 's6'), { recursive: true });
  writeFileSync(SEITE, '<!doctype html><meta charset="utf-8"><title>S6</title><button id="b">Ordner</button>');
});

test('S6 Ordnerzugriff, OPFS, IndexedDB und Prüfsumme unter file://', async ({ page, browserName }) => {
  await page.goto(pathToFileURL(SEITE).href);
  const r = await page.evaluate(async () => {
    const aus: Record<string, unknown> = { sicher: isSecureContext, ordnerDialog: typeof (window as unknown as Record<string, unknown>)['showDirectoryPicker'], subtle: !!crypto.subtle };
    aus['opfs'] = await navigator.storage.getDirectory().then(() => 'ok', (e: Error) => e.name);
    const db = await new Promise<IDBDatabase>((ok, f) => {
      const q = indexedDB.open('s6-probe', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('d');
      q.onsuccess = () => ok(q.result);
      q.onerror = () => f(q.error);
    });
    const put = (v: unknown) => new Promise<string>((ok) => {
      const tx = db.transaction('d', 'readwrite');
      tx.objectStore('d').put(v, 'k');
      tx.oncomplete = () => ok('ok');
      tx.onerror = tx.onabort = () => ok('fehler');
    });
    const gross = new Uint8Array(20 * 1024 * 1024);
    aus['idbArrayBuffer'] = await put(gross.buffer);
    aus['idbBlob'] = await put(new Blob(['x']));
    const t0 = performance.now();
    await crypto.subtle.digest('SHA-256', gross);
    aus['sha256ms20mb'] = Math.round(performance.now() - t0);
    db.close();
    return aus;
  });
  befund('s6', browserName, 'faehigkeiten', r);
  expect(r['sicher']).toBe(true);
  expect(r['subtle']).toBe(true);
  expect(r['idbArrayBuffer']).toBe('ok');
  expect(r['ordnerDialog']).toBe(browserName === 'chromium' ? 'function' : 'undefined');
  if (browserName === 'chromium') expect(r['opfs']).toBe('SecurityError');
  if (browserName === 'webkit') expect(r['idbBlob']).toBe('fehler');
});

test('S6 Ordnerdialog lässt sich in Playwright nicht bedienen (Chromium)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Dialog nur in Chromium');
  await page.goto(pathToFileURL(SEITE).href);
  const ergebnis = page.evaluate(() => new Promise<string>((ok) => {
    document.getElementById('b')!.addEventListener('click', () => {
      (window as unknown as { showDirectoryPicker: () => Promise<unknown> }).showDirectoryPicker().then(() => ok('gewählt'), (e: Error) => ok(e.name));
    });
  }));
  await page.click('#b');
  const r = await ergebnis;
  befund('s6', browserName, 'ordnerDialog', r);
  expect(r).toBe('AbortError');
});
