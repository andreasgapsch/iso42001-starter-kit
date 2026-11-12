// Abnahme 4: Sprachwechsel. Oberfläche auf EN: alle Hauptansichten (Start, Guide aller Etappen, Formularansicht
// aller Module und Reiter, Prüfung, Dokumente, Einstellungen) ohne deutsche Reste; umgekehrt DE ohne englische Reste.
// Heuristik auf sichtbarem Text und Beschriftungen (aria-label, title, placeholder). Projektdaten ausgenommen: leeres neues Projekt.
// Voraussetzung: npm run build:app. Testtiefe: Chromium.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test } from '../app/app-hilfen.ts';
import { MODULE, REITER } from '../../../src/app/logik/routen.ts';
import { REPO } from '../spikes/hilfen.ts';
import { HTML, starte, waehleSprache } from '../app/app-hilfen.ts';
import { ETAPPEN, neuesProjektAnlegen, text } from './abnahme-hilfen.ts';

test.skip(!existsSync(join(REPO, HTML)), 'Werkzeug nicht gebaut (npm run build:app)');
test.use({ viewport: { width: 1400, height: 950 }, actionTimeout: 15_000 });

// Typische deutsche Wörter (ganze Wörter) und Umlaute
const DEUTSCH = /[äöüÄÖÜ\u00DF]|\b(?:und|oder|nicht|mit|für|der|die|das|dem|des|ein|eine|einen|einem|ist|sind|wird|werden|Sie|Ihr|Ihre|Ihren|bitte|Seite|Weiter|Zurück|Speichern|Prüfung|Einstellungen|Projekt|Eintrag|Einträge|keine|noch|auch|nach|bei|zum|zur|vom|aus|Massnahmen?|Dokumente|erledigt|später|Hinweise?|Fehler|Ziele?|Rollen?|Lieferanten?|Neuer|Neue|bis|Anhang|Abschnitt|Bezeichnung|Beschreibung|Angaben?|wählen|anlegen|entfernen|Verantwortlich|Freigabe)\b/;
// Vorsichtig: nur Funktionswörter und typische Bedienwörter, die im Deutschen nicht als Fachbegriff vorkommen
const ENGLISCH = /\b(?:the|and|with|without|please|your|you|which|this|that|from|have|has|been|should|Save|Settings|Next|Back|Overview|Review|Documents|Guided|Entry|Entries|Measures|Suppliers?|Objectives?|Add|Remove|Select|Open|New|Done|Later)\b/;

// Eigennamen und feste Begriffe, die in beiden Sprachen gleich stehen
const AUSNAHMEN = [
  /Andreas Gapsch, KMU-CIO, kmu-cio\.ch/,
  /\bAIMS-Manager\b/,
  /^(DE|EN|Deutsch|English)$/,
  // Namen der Beispielfirmen (Projektdaten der Beispiele, Startseite)
  /^(Muster Maschinenbau AG|Beispiel Pr\u00E4zisionsteile GmbH) \((DE|EN)\)$/,
];

interface Fund {
  ort: string;
  text: string;
}

/** Sichtbarer Text und Beschriftungen der Seite (ohne Sprachwahl und Beispielnamen), je Element. */
async function texteDerSeite(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const raus = (el: Element | null) => !!el?.closest('script, style, #e-ui, #neu-sprache, [data-beispiele], .projektname');
    const r: string[] = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement;
      const t = n.textContent?.replace(/\s+/g, ' ').trim();
      if (!t || !el || raus(el)) continue;
      if (el.getClientRects().length === 0 && !el.closest('.nur-sr')) continue;
      r.push(t);
    }
    for (const el of document.body.querySelectorAll('[aria-label], [title], [placeholder], [alt]')) {
      if (raus(el)) continue;
      for (const a of ['aria-label', 'title', 'placeholder', 'alt']) {
        const v = el.getAttribute(a)?.trim();
        if (v) r.push(v);
      }
    }
    r.push(document.title);
    return r;
  });
}

async function geh(page: Page, hash: string): Promise<void> {
  await page.evaluate((h) => (location.hash = h), hash);
  await expect(page.locator('main h1').first()).toBeVisible();
}

/** Alle Hauptansichten durchgehen und Texte sammeln, die zur falschen Sprache passen. */
async function rundgang(page: Page, falsch: RegExp): Promise<Fund[]> {
  const funde: Fund[] = [];
  const pruefe = async (ort: string) => {
    for (const t of await texteDerSeite(page)) {
      if (AUSNAHMEN.some((a) => a.test(t))) continue;
      const m = falsch.exec(t);
      if (m) funde.push({ ort, text: `${t.slice(0, 160)} [${m[0]}]` });
    }
  };
  await geh(page, '#/start');
  await pruefe('start');
  // Guide: alle aktiven Seiten und der Abschluss jeder Etappe
  for (const e of ETAPPEN) {
    for (const s of e.seiten) {
      await page.evaluate((h) => (location.hash = h), `#/gefuehrt/${e.id}/${s}`);
      await expect(page.locator('h1').first()).toBeVisible();
      if (!page.url().endsWith(`/${s}`)) continue;
      await pruefe(`gefuehrt/${e.id}/${s}`);
    }
    await geh(page, `#/gefuehrt/${e.id}/abschluss`);
    await pruefe(`gefuehrt/${e.id}/abschluss`);
  }
  // Formularansicht: alle Module und Reiter; Listenmodule mit einem neuen (leeren) Eintrag, damit der Editor erscheint
  for (const m of MODULE) {
    const reiter = REITER[m] ?? [undefined];
    for (const r of reiter) {
      await geh(page, `#/formular/${m}${r ? `/${r}` : ''}`);
      await pruefe(`formular/${m}${r ? `/${r}` : ''}`);
      // Hauptaktion «… erfassen» im Seitenkopf oder in der Liste unter einem Reiter (id neu-<liste>)
      const neu = page.locator('main button[id^="neu-"]');
      if ((await neu.count()) === 1) {
        await neu.click();
        await page.waitForTimeout(100);
        await pruefe(`formular/${m}${r ? `/${r}` : ''} (Editor)`);
      }
    }
  }
  for (const h of ['#/pruefung', '#/dokumente', '#/einstellungen', '#/ueber']) {
    await geh(page, h);
    await pruefe(h);
  }
  return funde;
}

for (const sprache of ['en', 'de'] as const) {
  test(`Oberfläche ${sprache.toUpperCase()}: keine Texte der anderen Sprache in den Hauptansichten`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Testtiefe Chromium');
    test.setTimeout(300_000);
    const { fehler } = await starte(page);
    // Sprachwechsel über Einstellungen › Sprache und Darstellung (Start in der jeweils anderen Sprache)
    await waehleSprache(page, sprache === 'en' ? 'de' : 'en');
    await waehleSprache(page, sprache);
    await expect(page.locator('html')).toHaveAttribute('lang', sprache === 'de' ? 'de-CH' : 'en-GB');
    await expect(page.locator('main h1')).toHaveText(text(sprache, 'app.start.titel'));
    await neuesProjektAnlegen(page, { isms: 'vorhanden', modul: true });
    const funde = await rundgang(page, sprache === 'en' ? DEUTSCH : ENGLISCH);
    const bericht = [...new Set(funde.map((f) => `${f.ort}: ${f.text}`))];
    expect(bericht).toEqual([]);
    expect(fehler).toEqual([]);
  });
}
