// Spike S1: Projektdatei und Zwischenspeicher über file:// (Chromium, Firefox, WebKit).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { TMP, befund, dateiUrl, netzProtokoll } from './hilfen.ts';

interface S1Fenster {
  s1: {
    faehigkeiten: Record<string, unknown>;
    verworfen: Record<string, string>;
    umgebung: Record<string, unknown>;
    dateiZugriff: string;
    idbSchreiben(k: string, v: string): Promise<string>;
    idbLesen(k: string): Promise<string | null>;
    lsSchreiben(k: string, v: string): string;
    lsLesen(k: string): string | null;
    fsaMitOpfs(p: unknown): Promise<unknown>;
    speicher: {
      neu(p: unknown): void;
      aendern(p: unknown): void;
      zwischenspeichern(): Promise<void>;
      zwischenstaende(): Promise<{ schluessel: string; inhalt: string }[]>;
      wiederherstellen(k: string): Promise<unknown>;
      status: { ungespeichert: boolean };
    };
  };
}
type W = Window & S1Fenster;

const SEITE_A = 'spikes/s1/dist/a/s1.html';
const SEITE_A2 = 'spikes/s1/dist/a/s1-zweit.html';
const SEITE_B = 'spikes/s1/dist/b/s1.html';

/** Projekt mit heiklen Zeichen, grossen Zahlen und Verschachtelung für den Roundtrip. */
const PROJEKT = {
  id: 'spike-s1-roundtrip',
  organisation: 'Präzisionsteile «Müller» & Söhne AG',
  werte: [0, -1, 1.5, 2 ** 53 - 1, 1e-7],
  text: 'Zeile 1\nZeile 2\t«Anführung» é́ \u{1F600} \\ "quote" </script>',
};

async function laden(page: Page, relativ: string, suche = ''): Promise<void> {
  await page.goto(dateiUrl(relativ, suche));
  await expect(page.locator('body[data-bereit="1"]')).toBeAttached({ timeout: 15_000 });
}

test.beforeEach(async ({ page }) => {
  // beforeunload-Warnung bei ungespeicherten Änderungen nicht blockieren lassen.
  page.on('dialog', (d) => void d.accept());
});

test('S1a Fähigkeiten unter file://', async ({ page, context, browserName }) => {
  const netz = netzProtokoll(context);
  await laden(page, SEITE_A);
  const r = await page.evaluate(() => {
    const s = (window as unknown as W).s1;
    return { faehigkeiten: s.faehigkeiten, verworfen: s.verworfen, umgebung: s.umgebung, dateiZugriff: s.dateiZugriff };
  });
  befund('s1', browserName, 'faehigkeiten', r);
  // Erwartete Lage (Regressionstest): FSA nur in Chromium.
  expect(r.faehigkeiten['fsaOeffnen']).toBe(browserName === 'chromium');
  expect(r.faehigkeiten['zwischenspeicher']).not.toBe('speicher');
  expect(netz.fremd()).toEqual([]);
});

test('S1b Zwischenspeicher überlebt Neuladen; Modul stellt wieder her', async ({ page, browserName }) => {
  await laden(page, SEITE_A);
  const wert = `wert-${Date.now()}`;
  const geschrieben = await page.evaluate(async (v) => {
    const s = (window as unknown as W).s1;
    return { idb: await s.idbSchreiben('neuladen', v), ls: s.lsSchreiben('neuladen', v) };
  }, wert);
  // Modul: Änderung, Zwischenstand nach 200 ms (Spike-Einstellung).
  await page.evaluate(async (p) => {
    const s = (window as unknown as W).s1.speicher;
    s.neu(p);
    s.aendern({ ...p, werte: [...p.werte, 42] });
    await s.zwischenspeichern();
  }, PROJEKT);
  await page.reload();
  await expect(page.locator('body[data-bereit="1"]')).toBeAttached();
  const gelesen = await page.evaluate(async () => {
    const s = (window as unknown as W).s1;
    const liste = await s.speicher.zwischenstaende();
    const treffer = liste.find((z) => z.schluessel === 'spike-s1-roundtrip');
    const wieder = treffer ? await s.speicher.wiederherstellen(treffer.schluessel) : null;
    return {
      idb: await s.idbLesen('neuladen'),
      ls: s.lsLesen('neuladen'),
      art: s.faehigkeiten['zwischenspeicher'],
      wieder,
      ungespeichert: s.speicher.status.ungespeichert,
    };
  });
  const ergebnis = {
    geschrieben,
    indexedDbNachNeuladen: gelesen.idb === wert,
    localStorageNachNeuladen: gelesen.ls === wert,
    modulArt: gelesen.art,
    modulWiederhergestellt: JSON.stringify(gelesen.wieder) === JSON.stringify({ ...PROJEKT, werte: [...PROJEKT.werte, 42] }),
    rohIdb: gelesen.idb,
  };
  befund('s1', browserName, 'neuladen', ergebnis);
  expect(ergebnis.indexedDbNachNeuladen || ergebnis.localStorageNachNeuladen).toBe(true);
  expect(ergebnis.modulWiederhergestellt).toBe(true);
  expect(gelesen.ungespeichert).toBe(true);
});

test('S1b Teilen verschiedene file://-Dateien den Speicher?', async ({ page, context, browserName }) => {
  await laden(page, SEITE_A);
  const wert = `geteilt-${Date.now()}`;
  await page.evaluate(async (v) => {
    const s = (window as unknown as W).s1;
    await s.idbSchreiben('geteilt', v);
    s.lsSchreiben('geteilt', v);
  }, wert);
  const lies = async (relativ: string): Promise<{ idb: boolean; ls: boolean }> => {
    const p = await context.newPage();
    await laden(p, relativ);
    const r = await p.evaluate(async () => {
      const s = (window as unknown as W).s1;
      return { idb: await s.idbLesen('geteilt'), ls: s.lsLesen('geteilt') };
    });
    await p.close();
    return { idb: r.idb === wert, ls: r.ls === wert };
  };
  const ergebnis = {
    gleicherOrdnerAndereDatei: await lies(SEITE_A2),
    andererOrdner: await lies(SEITE_B),
  };
  befund('s1', browserName, 'geteilt', ergebnis);
  // Nur Befund; Folgerung: Schlüssel je Projekt, nie je Datei.
  expect(ergebnis).toBeDefined();
});

test('S1b Neustart mit persistentem Profil', async ({ playwright, browserName }) => {
  const profil = join(TMP, `profil-${browserName}-${Date.now()}`);
  mkdirSync(profil, { recursive: true });
  const typ = playwright[browserName];
  const wert = `neustart-${Date.now()}`;
  try {
    const ctx1 = await typ.launchPersistentContext(profil, { headless: true });
    const p1 = ctx1.pages()[0] ?? (await ctx1.newPage());
    await laden(p1, SEITE_A);
    const geschrieben = await p1.evaluate(async (v) => {
      const s = (window as unknown as W).s1;
      return { idb: await s.idbSchreiben('neustart', v), ls: s.lsSchreiben('neustart', v) };
    }, wert);
    // Kurz warten, damit localStorage auf die Platte geschrieben wird (wie beim Schliessen des Fensters).
    await p1.waitForTimeout(500);
    await ctx1.close();
    const ctx2 = await typ.launchPersistentContext(profil, { headless: true });
    const p2 = ctx2.pages()[0] ?? (await ctx2.newPage());
    await laden(p2, SEITE_A);
    const gelesen = await p2.evaluate(async () => {
      const s = (window as unknown as W).s1;
      return { idb: await s.idbLesen('neustart'), ls: s.lsLesen('neustart') };
    });
    await ctx2.close();
    const ergebnis = {
      geschrieben,
      indexedDbNachNeustart: gelesen.idb === wert,
      localStorageNachNeustart: gelesen.ls === wert,
      roh: gelesen,
    };
    befund('s1', browserName, 'neustart', ergebnis);
    expect(ergebnis.indexedDbNachNeustart || ergebnis.localStorageNachNeustart).toBe(true);
  } finally {
    rmSync(profil, { recursive: true, force: true });
  }
});

test('S1c Öffnen per Dateiauswahl, Speichern per Download: Roundtrip verlustfrei', async ({ page, browserName }) => {
  mkdirSync(TMP, { recursive: true });
  const quelle = join(TMP, `s1-quelle-${browserName}.aims.json`);
  const inhalt = JSON.stringify(PROJEKT, null, 2);
  writeFileSync(quelle, inhalt);
  try {
    await laden(page, SEITE_A, '?zugriff=fallback');
    const auswahl = page.waitForEvent('filechooser');
    await page.click('#oeffnen');
    await (await auswahl).setFiles(quelle);
    await expect(page.locator('#ausgabe')).toContainText('"geoeffnet"');
    const geoeffnet = JSON.parse((await page.locator('#ausgabe').textContent()) ?? '{}') as { geoeffnet: unknown };
    const download = page.waitForEvent('download');
    await page.click('#speichern');
    const d = await download;
    const ziel = join(TMP, `s1-download-${browserName}.aims.json`);
    await d.saveAs(ziel);
    const zurueck = readFileSync(ziel, 'utf8');
    const ergebnis = {
      geoeffnetGleich: JSON.stringify(geoeffnet.geoeffnet) === JSON.stringify(PROJEKT),
      downloadName: d.suggestedFilename(),
      byteGleich: zurueck === inhalt,
      jsonGleich: JSON.stringify(JSON.parse(zurueck)) === JSON.stringify(PROJEKT),
    };
    befund('s1', browserName, 'roundtrip', ergebnis);
    expect(ergebnis).toMatchObject({ geoeffnetGleich: true, byteGleich: true, jsonGleich: true });
    expect(d.suggestedFilename()).toBe('s1-quelle-' + browserName + '.aims.json');
    rmSync(ziel, { force: true });
  } finally {
    rmSync(quelle, { force: true });
  }
});

test('S1a FSA-Schreibpfad mit Dateihandle (OPFS statt Dialog)', async ({ page, browserName }) => {
  await laden(page, SEITE_A);
  const r = await page.evaluate(async (p) => {
    try {
      return { ok: true, wert: await (window as unknown as W).s1.fsaMitOpfs(p) };
    } catch (e) {
      return { ok: false, fehler: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
    }
  }, PROJEKT);
  befund('s1', browserName, 'fsaHandle', r);
  // Chromium sperrt OPFS unter file:// (SecurityError), Firefox erlaubt es: dort ist der Handle-Pfad geprüft.
  if (browserName === 'firefox') {
    expect(r).toMatchObject({
      ok: true,
      wert: { r1: 'datei', r2: 'datei', direkt: true, projekt: { ...PROJEKT, werte: [...PROJEKT.werte, 99] } },
    });
  }
});

test('S1a FSA-Dialog in Chromium headless', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'FSA nur in Chromium');
  await laden(page, SEITE_A);
  expect(await page.evaluate(() => (window as unknown as W).s1.dateiZugriff)).toBe('fsa');
  await page.click('#oeffnen');
  // Headless gibt es keinen Dialog: showOpenFilePicker endet mit AbortError, das Modul meldet «abgebrochen».
  await expect(page.locator('#ausgabe')).toContainText('"geoeffnet": null');
  befund('s1', browserName, 'fsaDialogHeadless', 'showOpenFilePicker endet sofort mit AbortError (kein Dialog), Modul liefert null');
});
