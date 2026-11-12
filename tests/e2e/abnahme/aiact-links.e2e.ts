// Abnahme 3: AI-Act-Links im Hilfebereich des Guides. Jeder Link zeigt relativ vom Kit-Ordner AIMS-Manager
// auf die beigelegte PDF-Datei in Rechtstexte_Legal-Texts/EU-AI-Act mit #page=N; N stimmt mit src/ai-act/artikel-seiten.json
// überein (DE und EN), und die Ziel-PDF liegt im gebauten Kit. Den Sprung selbst prüft Spike S3.
// Voraussetzung: npx tsx scripts/build.mts --ohne-zip (Kit unter dist/kit/<wurzel>/). Testtiefe: Chromium.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { REPO } from '../spikes/hilfen.ts';
import { ETAPPEN, SEITEN, seiteHatHilfe, text } from './abnahme-hilfen.ts';

const KIT = join(REPO, 'dist/kit');
const WURZEL = existsSync(KIT) ? readdirSync(KIT).map((d) => join(KIT, d)).find((d) => existsSync(join(d, 'AIMS-Manager', 'aims-manager.html'))) : undefined;

test.skip(!WURZEL, 'Kit nicht gebaut (npx tsx scripts/build.mts --ohne-zip)');
test.use({ locale: 'de-CH', viewport: { width: 1400, height: 950 }, actionTimeout: 15_000 });

const ARTIKEL = JSON.parse(readFileSync(join(REPO, 'src/ai-act/artikel-seiten.json'), 'utf8')) as {
  quelle: Record<'de' | 'en', string>;
  de: Record<string, number>;
  en: Record<string, number>;
};

for (const sprache of ['de', 'en'] as const) {
  test(`AI-Act-Links im Hilfebereich zeigen auf die beigelegte PDF mit der richtigen Seite (${sprache.toUpperCase()})`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Testtiefe Chromium');
    test.setTimeout(240_000);
    const fehler: string[] = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript((s) => {
      delete (window as unknown as Record<string, unknown>)['showOpenFilePicker'];
      try { localStorage.setItem('aims-manager:einstellung:ui-sprache', s); } catch { /* egal */ }
    }, sprache);
    const kitHtml = join(WURZEL!, 'AIMS-Manager', 'aims-manager.html');
    await page.goto(pathToFileURL(kitHtml).href);
    await page.waitForSelector('body[data-bedienbar]', { timeout: 10_000 });
    // Beispielprojekt mit Modul, Anbieter- und Betreiberrolle, Hochrisiko und Eigenbau: alle Seiten mit AI-Act-Bezug sind aktiv
    const projekt = join(WURZEL!, 'AIMS-Manager', 'Beispiele_Examples', `muster-maschinenbau.${sprache}.aims.json`);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#start-oeffnen')]);
    await fc.setFiles(projekt);
    await expect(page).toHaveURL(/#\/formular\/uebersicht/);

    const pdf = join(WURZEL!, 'Rechtstexte_Legal-Texts', 'EU-AI-Act', ARTIKEL.quelle[sprache]);
    // Die Rechtstexte liegen nie im Repo; in CI fehlen sie im Kit. Dort nur Linkform und Seitenzahl prüfen.
    const ohneRechtstexte = !!process.env['CI'] && !existsSync(pdf);
    if (!ohneRechtstexte) expect(existsSync(pdf), pdf).toBe(true);
    const abweichungen: string[] = [];
    let gepruefteLinks = 0;
    let seitenMitBezug = 0;
    for (const e of ETAPPEN) {
      for (const id of e.seiten) {
        const s = SEITEN.get(id)!;
        await page.evaluate((h) => (location.hash = h), `#/gefuehrt/${e.id}/${id}`);
        const titel = page.locator('h1#seitentitel');
        await expect(titel).toBeVisible();
        // Seiten, deren Bedingung im Beispiel nicht zutrifft, ersetzt das Werkzeug durch die erste Seite der Etappe
        if ((await titel.textContent())?.trim() !== text(sprache, `gefuehrt.${e.id}.${id}.titel`) || (await page.locator('aside.hilfe').count()) === 0) continue;
        // Nebenbei: Frage, Erklärung, Beispiel und Normabschnitt auch auf Seiten, die nur unter Bedingungen erscheinen
        const fehlt = await seiteHatHilfe(page, sprache, s);
        if (fehlt.length) abweichungen.push(`${id}: Hilfe unvollständig, fehlt ${fehlt.join(', ')}`);
        const links = await page.locator('aside.hilfe a').evaluateAll((as) =>
          as.map((a) => ({ roh: a.getAttribute('href') ?? '', abs: (a as HTMLAnchorElement).href, text: a.textContent ?? '' })).filter((l) => /Rechtstexte_Legal-Texts\/EU-AI-Act\//.test(l.roh)),
        );
        const erwartet = (s.aiact ?? []).map((k) => {
          const n = ARTIKEL[sprache][k];
          if (!n) abweichungen.push(`${id}: ${k} fehlt in artikel-seiten.json (${sprache})`);
          return `../Rechtstexte_Legal-Texts/EU-AI-Act/${ARTIKEL.quelle[sprache]}#page=${n}`;
        });
        if (erwartet.length) seitenMitBezug++;
        const ist = links.map((l) => l.roh);
        if (JSON.stringify(ist) !== JSON.stringify(erwartet)) abweichungen.push(`${id}: ${JSON.stringify(ist)} statt ${JSON.stringify(erwartet)}`);
        for (const [i, l] of links.entries()) {
          gepruefteLinks++;
          const ziel = fileURLToPath(l.abs.split('#')[0]!);
          if (!ohneRechtstexte && !existsSync(ziel)) abweichungen.push(`${id}: Ziel fehlt im Kit: ${ziel}`);
          const n = ARTIKEL[sprache][(s.aiact ?? [])[i] ?? ''];
          if (n && !l.text.includes(String(n))) abweichungen.push(`${id}: Linktext ohne Seitenzahl ${n}: ${l.text}`);
        }
      }
    }
    expect(abweichungen).toEqual([]);
    // Im Beispiel (Modul, Anbieter, Betreiber, Hochrisiko, Eigenbau) sind alle Seiten mit AI-Act-Bezug aktiv
    expect(seitenMitBezug).toBe([...SEITEN.values()].filter((s) => s.aiact?.length).length);
    expect(gepruefteLinks).toBeGreaterThanOrEqual(30);
    expect(fehler).toEqual([]);
  });
}
