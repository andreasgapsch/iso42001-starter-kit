// Startseite, Textvorlagen, Lizenzdateien und Rechtstexte-LIESMICH.
// Teil 1 prüft die Quellen statisch; Teil 2 öffnet die gefüllte Startseite über file:// in Chromium,
// Firefox und WebKit (Konsole, Sprachwechsel, Theme-Wechsel, Druck, Tastatur, axe) und legt Bildschirmfotos ab.
// Ablage der Fotos: $START_FOTOS, sonst <TMPDIR>/start-test/fotos.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { type Browser, type BrowserType, type Page, chromium, firefox, webkit } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { pruefeCsp } from '../../scripts/csp.mts';
import { ERLAUBTE_LINKZIELE, findeLinks, istExtern, istNamensraum } from '../../scripts/pruefen/links.mts';
import { leseSummen } from '../../scripts/pruefen/pruefsummen.mts';
import { farbenInHtml } from '../../scripts/pruefen/farben.mts';
import { aktualisiereStart, START_SCHRIFT } from '../../scripts/start-vorlage.mts';
import { formatiere, schriftEintraege, urheberAusOfl } from '../../scripts/drittlizenzen.mts';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const lies = (rel: string): string => readFileSync(join(REPO, rel), 'utf8');

const START = 'src/start/START.html.tpl';
const NAMENSNENNUNG_DE = 'ISO/IEC 42001 Starter-Kit von Andreas Gapsch, KMU-CIO, kmu-cio.ch';
const NAMENSNENNUNG_EN = 'ISO/IEC 42001 Starter Kit by Andreas Gapsch, KMU-CIO, kmu-cio.ch';

/** Ziele der Startkachel (ab rc.10) aus dem ZIP-Aufbau (massgebend: src/kataloge/kit-ordner.yaml), relativ zu START.html. */
interface KitOrdner {
  sprachen: Record<'de' | 'en', Record<'ordner' | 'leitfaden' | 'vorlagen' | 'modul' | 'modul_nist' | 'integration' | 'beispiele', string>>;
  skill: string;
  werkzeug: string;
  rechtstexte: string;
  rechtstexte_nist: string;
  lizenz: string;
}
const KIT = parseYaml(lies('src/kataloge/kit-ordner.yaml')) as KitOrdner;
const ZIELE = [
  ...(['de', 'en'] as const).flatMap((s) => {
    const o = KIT.sprachen[s];
    return [o.leitfaden, o.vorlagen].map((u) => `${o.ordner}/${u}/`);
  }),
  `${KIT.skill}/`,
  `${KIT.werkzeug}/aims-manager.html`,
  `${KIT.werkzeug}/Diagrammansicht.html`,
  `${KIT.werkzeug}/Kurzanleitung_DE.html`,
  `${KIT.werkzeug}/Quick-Guide_EN.html`,
  `${KIT.rechtstexte}/`,
  `${KIT.rechtstexte_nist}/`,
  `${KIT.lizenz}/`,
  'LIESMICH.txt',
  'README.txt',
];

/** Eigene Texte (ohne die unverändert übernommenen Volltexte von CC und MIT). */
const EIGENE_TEXTE = [
  START,
  'src/start/LIESMICH.txt.tpl',
  'src/start/README.txt.tpl',
  'src/start/CHANGELOG.txt.tpl',
  'src/rechtstexte/LIESMICH_README.txt.tpl',
  'src/lizenz/LIZENZ.txt',
  'src/lizenz/LICENCE.txt',
  'src/lizenz/ZUSATZERLAUBNIS_DE.txt',
  'src/lizenz/ADDITIONAL-PERMISSION_EN.txt',
  'src/lizenz/CC-BY-4.0_legalcode_de.txt',
];

/** Textdateien für den Windows-Editor: UTF-8 mit BOM, CRLF. */
const WINDOWS_TEXTE = EIGENE_TEXTE.filter((p) => p !== START).concat('src/lizenz/MIT.txt');

const LIZENZDATEIEN = [
  'LIZENZ.txt',
  'LICENCE.txt',
  'ZUSATZERLAUBNIS_DE.txt',
  'ADDITIONAL-PERMISSION_EN.txt',
  'CC-BY-4.0_legalcode.txt',
  'CC-BY-4.0_legalcode_de.txt',
  'MIT.txt',
];

/** SHA-256 des offiziellen Texts https://creativecommons.org/licenses/by/4.0/legalcode.txt (abgerufen 19.10.2026). */
const CC_BY_SHA256 = '9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411';

const WERTE: Record<string, string> = {
  version: '1.0.0',
  datum: '13.11.2026',
  kurzlink: 'kmu-cio.ch/42001',
};

export function fuelle(vorlage: string, werte: Record<string, string>): string {
  return vorlage.replace(/\{\{(\w+)\}\}/g, (m, k: string) => werte[k] ?? m);
}

interface Texte {
  de: Record<string, unknown>;
  en: Record<string, unknown>;
}

function texteAus(html: string): Texte {
  const m = /<script type="application\/json" id="texte">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('Datenblock «texte» fehlt');
  return JSON.parse(m[1]!) as Texte;
}

describe('START-Vorlage (statisch)', () => {
  const vorlage = lies(START);
  const gefuellt = fuelle(vorlage, WERTE);

  it('enthält die Namensnennung DE und EN im Wortlaut', () => {
    expect(vorlage).toContain(NAMENSNENNUNG_DE);
    expect(vorlage).toContain(NAMENSNENNUNG_EN);
    const t = texteAus(vorlage);
    expect(t.de['fuss_namensnennung']).toBe(NAMENSNENNUNG_DE);
    expect(t.en['fuss_namensnennung']).toBe(NAMENSNENNUNG_EN);
  });

  it('Startkachel verlinkt AIMS-Manager, Kurzanleitung, Diagrammansicht, Leitfaden, Vorlagen und Lizenz relativ', () => {
    const hrefs = findeLinks(vorlage)
      .filter((l) => l.art === 'attribut' && l.quelle === 'href')
      .map((l) => l.url);
    for (const ziel of ZIELE) expect(hrefs, ziel).toContain(ziel);
    for (const h of hrefs) expect(h.startsWith('/') || /^file:/i.test(h), h).toBe(false);
  });

  it('lädt keine externen Ressourcen; externe Ziele nur als Anker auf kmu-cio.ch oder EUR-Lex', () => {
    const fremd = findeLinks(gefuellt).filter((l) => istExtern(l.url) && !istNamensraum(l.url));
    for (const l of fremd) {
      expect(l.art === 'attribut' && l.tag === 'a' && l.quelle === 'href', `${l.url} (${l.art} ${l.tag ?? ''})`).toBe(true);
      expect(ERLAUBTE_LINKZIELE.some((r) => r.test(l.url)), l.url).toBe(true);
    }
    expect(gefuellt).not.toMatch(/<script\b[^>]*\bsrc\s*=/i);
    expect(gefuellt).not.toMatch(/<link\b[^>]*rel\s*=\s*["']?stylesheet/i);
    expect(gefuellt).not.toMatch(/@import|url\(\s*["']?https?:/i);
    expect(gefuellt).not.toMatch(/\{\{\w+\}\}/);
  });

  it('hat eine gültige Content-Security-Policy ohne externe Quellen', () => {
    expect(pruefeCsp(gefuellt)).toEqual([]);
    const policy = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(gefuellt)?.[1] ?? '';
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("connect-src 'none'");
    expect(policy).not.toMatch(/https?:|\*/);
  });

  it('generierte Teile (Schrift, CSP-Hashes) sind aktuell (npx tsx scripts/start-vorlage.mts)', () => {
    expect(aktualisiereStart(vorlage) === vorlage).toBe(true);
  });

  it('Designpaket «AIMS Nachtblau»: Inter eingebettet (latin), Tokens dunkel und hell, dunkel als Standard, Farben nur über Variablen', () => {
    const b64 = readFileSync(join(REPO, 'src/app/schriften', START_SCHRIFT)).toString('base64');
    expect(vorlage.includes(b64)).toBe(true);
    expect(vorlage).not.toContain(readFileSync(join(REPO, 'src/app/schriften/inter-latin-ext-wght-normal.woff2')).toString('base64'));
    expect(vorlage).toMatch(/font-family: 'Inter Variable';/);
    expect(vorlage).not.toMatch(/Archivo|Source Serif/);
    expect(vorlage).toContain('font-src data:');
    expect(vorlage).toContain('--grund: #1f2432;');
    expect(vorlage).toContain('--grund: #f6f7fb;');
    expect(vorlage).toContain("if (THEMES.indexOf(theme) < 0) theme = 'dunkel';");
    expect(farbenInHtml(START, vorlage)).toEqual([]);
  });

  it('Hinweis auf Edge oder Chrome für den Bibliotheksordner, Diagrammansicht und Lizenz in beiden Sprachen', () => {
    const t = texteAus(vorlage);
    expect(String(t.de['browser_hinweis'])).toMatch(/Edge oder Chrome/);
    expect(String(t.en['browser_hinweis'])).toMatch(/Edge or Chrome/);
    for (const k of ['diagramm_t', 'lizenz_t', 'aims_oeffnen']) {
      expect(t.de[k], k).toBeTruthy();
      expect(t.en[k], k).toBeTruthy();
    }
  });

  it('hat DE und EN mit denselben Schlüsseln, und jedes data-t ist belegt', () => {
    const t = texteAus(vorlage);
    expect(Object.keys(t.en).sort()).toEqual(Object.keys(t.de).sort());
    const schluessel = [...vorlage.matchAll(/data-t(?:-aria)?="([^"]+)"/g)].map((m) => m[1]!);
    for (const s of schluessel) {
      expect(t.de[s], `de.${s}`).toBeDefined();
      expect(t.en[s], `en.${s}`).toBeDefined();
    }
  });
});

describe('Textvorlagen und Lizenzdateien', () => {
  it('eigene Texte ohne Eszett und ohne Gedankenstriche', () => {
    for (const datei of EIGENE_TEXTE) {
      const text = lies(datei);
      expect(text, datei).not.toMatch(/[\u00DF\u1E9E]/);
      expect(text, datei).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it('Textdateien für Windows: UTF-8 mit BOM und CRLF', () => {
    for (const datei of WINDOWS_TEXTE) {
      const roh = readFileSync(join(REPO, datei));
      expect([...roh.subarray(0, 3)], datei).toEqual([0xef, 0xbb, 0xbf]);
      const text = roh.toString('utf8');
      expect(text, datei).toContain('\r\n');
      expect(text.replace(/\r\n/g, ''), datei).not.toMatch(/[\r\n]/);
    }
  });

  it('LIESMICH, README und CHANGELOG nennen Version, Kurzlink und Namensnennung', () => {
    const liesmich = lies('src/start/LIESMICH.txt.tpl');
    const readme = lies('src/start/README.txt.tpl');
    const changelog = lies('src/start/CHANGELOG.txt.tpl');
    for (const t of [liesmich, readme]) {
      expect(t).toContain('{{version}}');
      expect(t).toContain('{{kurzlink}}');
    }
    expect(liesmich).toContain(NAMENSNENNUNG_DE);
    expect(liesmich).toContain('«Bearbeitung aktivieren»');
    expect(liesmich).toContain('LibreOffice');
    expect(readme).toContain(NAMENSNENNUNG_EN);
    expect(readme).toContain('‘Enable Editing’');
    // AF-177: Version aus package.json über {{version}}, nicht von Hand
    expect(changelog).toMatch(/^\{\{version\}\} \(\{\{datum\}\}\)/m);
  });

  it('Drittlizenzen nennen die Schriften Inter, Archivo und Source Serif 4 (SIL OFL 1.1, Urheber laut Lizenzdatei)', () => {
    const e = schriftEintraege();
    expect(e.map((x) => x.lizenz)).toEqual(['OFL-1.1', 'OFL-1.1', 'OFL-1.1']);
    const text = formatiere(e);
    expect(urheberAusOfl(lies('src/app/schriften/OFL-Inter.txt'))).toBe('Copyright 2016 The Inter Project Authors (github.com/rsms/inter)');
    expect(text).toMatch(/Inter \(Schrift \/ font\)[\s\S]*AIMS-Manager, START\.html und Diagrammansicht/);
    for (const [name, datei] of [['Inter', 'OFL-Inter.txt'], ['Archivo', 'OFL-Archivo.txt'], ['Source Serif 4', 'OFL-Source-Serif-4.txt']] as const) {
      const ofl = lies(`src/app/schriften/${datei}`);
      expect(text).toContain(name);
      expect(text).toContain(urheberAusOfl(ofl));
      expect(text).toContain('SIL Open Font License, Version 1.1');
    }
    expect(urheberAusOfl(lies('src/app/schriften/OFL-Archivo.txt'))).toBe('Copyright 2020 The Archivo Project Authors (github.com/Omnibus-Type/Archivo)');
    // Source Serif 4 stammt von Adobe (adobe-fonts/source-serif, LICENSE.md), nicht von Google
    const serif = urheberAusOfl(lies('src/app/schriften/OFL-Source-Serif-4.txt'));
    expect(serif).toMatch(/^Copyright 2014 - 2023 Adobe .*Reserved Font Name ‘Source’/);
    expect(serif).not.toMatch(/Google/);
  });

  it('alle Lizenzdateien sind vorhanden und nicht leer', () => {
    for (const name of LIZENZDATEIEN) {
      const pfad = join(REPO, 'src/lizenz', name);
      expect(existsSync(pfad), name).toBe(true);
      expect(readFileSync(pfad, 'utf8').replace(/^\uFEFF/, '').trim().length, name).toBeGreaterThan(200);
    }
  });

  it('CC BY 4.0: offizieller englischer Volltext, vollständig und unverändert', () => {
    const roh = readFileSync(join(REPO, 'src/lizenz/CC-BY-4.0_legalcode.txt'));
    expect(createHash('sha256').update(roh).digest('hex')).toBe(CC_BY_SHA256);
    const text = roh.toString('utf8');
    expect(text.startsWith('Attribution 4.0 International')).toBe(true);
    for (let n = 1; n <= 8; n++) expect(text).toMatch(new RegExp(`^Section ${n} -- `, 'm'));
    expect(text.trimEnd().endsWith('Creative Commons may be contacted at creativecommons.org.')).toBe(true);
    expect(lies('src/lizenz/CC-BY-4.0_legalcode_de.txt')).toContain('https://creativecommons.org/licenses/by/4.0/legalcode.de');
  });

  it('MIT mit Copyright-Vermerk; Lizenzübersicht mit allen Pflichtteilen', () => {
    expect(lies('src/lizenz/MIT.txt')).toContain('Copyright (c) 2026 Andreas Gapsch, KMU-CIO');
    const de = lies('src/lizenz/LIZENZ.txt');
    const en = lies('src/lizenz/LICENCE.txt');
    for (const t of ['ÜBERSICHT', 'CC BY 4.0', 'MIT', 'ZUSATZERLAUBNIS', 'NAME UND MARKE', 'DRITTLIZENZEN', 'SO NENNEN SIE UNS KORREKT', 'Weitergabe im Unternehmen', 'Schulung', 'Beratungsmandat', 'angepassten Fassung', NAMENSNENNUNG_DE]) {
      expect(de, t).toContain(t);
    }
    for (const t of ['OVERVIEW', 'CC BY 4.0', 'MIT', 'ADDITIONAL PERMISSION', 'NAME AND BRAND', 'THIRD-PARTY', 'HOW TO ATTRIBUTE US CORRECTLY', 'within your company', 'training', 'consulting engagement', 'adapted version', NAMENSNENNUNG_EN]) {
      expect(en, t).toContain(t);
    }
  });

  it('Rechtstexte-LIESMICH: Quellen, Weiterverwendung, Abrufdatum und Prüfsummen', () => {
    const t = lies('src/rechtstexte/LIESMICH_README.txt.tpl');
    for (const s of ['CELEX 32024R1689', 'http://data.europa.eu/eli/reg/2026/1744/oj', '2011/833/EU', '19.10.2026', 'Berichtigung C2', 'Rechtsverbindlich', 'legally binding']) expect(t, s).toContain(s);
    for (const s of ['NIST AI RMF', 'https://doi.org/10.6028/NIST.AI.100-1', 'https://doi.org/10.6028/NIST.AI.600-1', '17 U.S.C. § 105', 'gemeinfrei', 'public domain', 'freiwilliges Rahmenwerk', 'voluntary framework']) expect(t, s).toContain(s);
    const block = [...t.matchAll(/^([0-9a-f]{64}) \*(\S+\.pdf)\r?$/gm)].map((m) => [m[2]!, m[1]!] as const);
    // AI Act 6 und NIST 3 PDFs, je im deutschen und im englischen Teil
    expect(block.filter(([n]) => !n.startsWith('NIST')).length).toBe(12);
    expect(block.filter(([n]) => n.startsWith('NIST')).length).toBe(6);
    const quellen = join(process.env['QUELLEN_DIR'] ?? join(homedir(), 'work', 'iso42001-quellen'));
    for (const [ordner, anzahl] of [['eu-ai-act', 6], ['nist', 3]] as const) {
      const quelle = join(quellen, ordner, 'SHA256SUMS.txt');
      if (!existsSync(quelle)) continue;
      const summen = leseSummen(readFileSync(quelle, 'utf8'));
      expect(summen.size).toBe(anzahl);
      for (const [name, hash] of block) if (summen.has(name)) expect(summen.get(name), name).toBe(hash);
      for (const name of summen.keys()) expect(block.filter(([n]) => n === name).length, name).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Teil 2: Browser

const TMP = join(tmpdir(), 'start-test');
const FOTOS = process.env['START_FOTOS'] ?? join(TMP, 'fotos');
const BG_HELL = 'rgb(246, 247, 251)';
const BG_DUNKEL = 'rgb(31, 36, 50)';

const ENGINES: [string, BrowserType][] = [
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
];

let url = '';

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
  const datei = join(TMP, 'START.html');
  writeFileSync(datei, fuelle(lies(START), WERTE));
  url = pathToFileURL(datei).href;
});

interface Protokoll {
  fehler: string[];
  fremd: string[];
}

async function oeffne(browser: Browser, locale: string): Promise<{ page: Page; log: Protokoll; schliessen: () => Promise<void> }> {
  const ctx = await browser.newContext({ locale, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const log: Protokoll = { fehler: [], fremd: [] };
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') log.fehler.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => log.fehler.push(`pageerror: ${e.message}`));
  ctx.on('request', (r) => {
    if (!/^(file|data|blob|about):/.test(r.url())) log.fremd.push(r.url());
  });
  await page.goto(url);
  await page.waitForFunction(() => document.title.includes('42001') && document.title.includes(':'));
  return { page, log, schliessen: () => ctx.close() };
}

const bg = (page: Page): Promise<string> => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

for (const [name, engine] of ENGINES) {
  const vorhanden = existsSync(engine.executablePath());
  describe.skipIf(!vorhanden)(`Startseite in ${name}`, () => {
    let browser: Browser;
    beforeAll(async () => {
      browser = await engine.launch({ headless: true });
    }, 60_000);
    afterAll(async () => {
      await browser?.close();
    });

    it('startet ohne Konsolenfehler in der Browsersprache und wechselt die Sprache', async () => {
      const { page, log, schliessen } = await oeffne(browser, 'de-CH');
      expect(await page.getAttribute('html', 'lang')).toBe('de');
      expect(await page.textContent('h1')).toContain('KI-Managementsystem');
      expect(await page.title()).toBe('ISO/IEC 42001 Starter-Kit: Startseite');
      expect(await page.textContent('footer')).toContain(NAMENSNENNUNG_DE);
      expect(await page.textContent('.stand')).toContain('1.0.0');
      expect(await page.isVisible('a[href="AIMS-Manager/Kurzanleitung_DE.html"]')).toBe(true);
      expect(await page.isVisible('a[href="AIMS-Manager/Quick-Guide_EN.html"]')).toBe(false);
      expect(await page.isVisible('#aims-oeffnen')).toBe(true);
      // Schrift aus der Seite geladen (keine Netzwerkanfrage, data:-URL)
      expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check("16px 'Inter Variable'"); })).toBe(true);
      await page.click('label[for="sprache-en"]');
      expect(await page.getAttribute('html', 'lang')).toBe('en');
      expect(await page.textContent('h1')).toContain('AI management system');
      expect(await page.title()).toBe('ISO/IEC 42001 Starter Kit: start page');
      expect(await page.textContent('footer')).toContain(NAMENSNENNUNG_EN);
      expect(await page.isVisible('a[href="AIMS-Manager/Quick-Guide_EN.html"]')).toBe(true);
      expect(await page.isVisible('a[href="AIMS-Manager/Kurzanleitung_DE.html"]')).toBe(false);
      // Wahl bleibt nach dem Neuladen erhalten, sofern der Browser localStorage für file:// erlaubt
      const speicher = await page.evaluate(() => {
        try {
          return window.localStorage.getItem('iso42001-starter-kit.start.sprache');
        } catch {
          return 'kein-speicher';
        }
      });
      await page.reload();
      await page.waitForFunction(() => document.title.includes('42001') && document.title.includes(':'));
      if (speicher === 'en') expect(await page.getAttribute('html', 'lang')).toBe('en');
      expect(log.fehler).toEqual([]);
      expect(log.fremd).toEqual([]);
      await schliessen();
    }, 60_000);

    it('wählt Englisch bei englischer Browsersprache und ist per Tastatur bedienbar', async () => {
      const { page, log, schliessen } = await oeffne(browser, 'en-GB');
      expect(await page.getAttribute('html', 'lang')).toBe('en');
      await page.focus('#sprache-en');
      await page.keyboard.press('ArrowLeft');
      expect(await page.getAttribute('html', 'lang')).toBe('de');
      expect(await page.isChecked('#sprache-de')).toBe(true);
      // Dunkel ist die Voreinstellung; Pfeiltaste nach links von «System» wählt «Hell»
      expect(await page.getAttribute('html', 'data-theme')).toBe('dunkel');
      await page.focus('#theme-system');
      await page.keyboard.press('ArrowLeft');
      expect(await page.getAttribute('html', 'data-theme')).toBe('hell');
      expect(log.fehler).toEqual([]);
      await schliessen();
    }, 60_000);

    it('wechselt Dunkel, Hell und System; Druck bleibt hell', async () => {
      const { page, log, schliessen } = await oeffne(browser, 'de-CH');
      expect(await page.getAttribute('html', 'data-theme')).toBe('dunkel');
      expect(await bg(page)).toBe(BG_DUNKEL);
      await page.emulateMedia({ media: 'print' });
      expect(await bg(page)).toBe('rgb(255, 255, 255)');
      await page.emulateMedia({ media: 'screen' });
      await page.click('label[for="theme-hell"]');
      expect(await page.getAttribute('html', 'data-theme')).toBe('hell');
      expect(await bg(page)).toBe(BG_HELL);
      await page.click('label[for="theme-system"]');
      expect(await page.getAttribute('html', 'data-theme')).toBeNull();
      await page.emulateMedia({ colorScheme: 'light' });
      expect(await bg(page)).toBe(BG_HELL);
      await page.emulateMedia({ colorScheme: 'dark' });
      expect(await bg(page)).toBe(BG_DUNKEL);
      await page.click('label[for="theme-dunkel"]');
      expect(await page.getAttribute('html', 'data-theme')).toBe('dunkel');
      expect(log.fehler).toEqual([]);
      await schliessen();
    }, 60_000);

    if (name === 'chromium') {
      it('axe ohne schwere Befunde (hell und dunkel, DE und EN)', async () => {
        const { page, schliessen } = await oeffne(browser, 'de-CH');
        for (const [sprache, theme] of [['de', 'hell'], ['de', 'dunkel'], ['en', 'hell'], ['en', 'dunkel']] as const) {
          await page.click(`label[for="sprache-${sprache}"]`);
          await page.click(`label[for="theme-${theme}"]`);
          const ergebnis = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          const schwer = ergebnis.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
          expect(schwer.map((v) => `${sprache}/${theme} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
        }
        await schliessen();
      }, 120_000);

      it('Kontrast (axe color-contrast, alle Stufen) hell und dunkel', async () => {
        const { page, schliessen } = await oeffne(browser, 'de-CH');
        for (const theme of ['hell', 'dunkel'] as const) {
          await page.click(`label[for="theme-${theme}"]`);
          await page.mouse.move(0, 0);
          const ergebnis = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
          expect(ergebnis.violations.flatMap((v) => v.nodes.map((n) => `${theme} ${n.target.join(' ')}: ${n.failureSummary ?? ''}`))).toEqual([]);
          expect(ergebnis.passes.length + ergebnis.incomplete.length).toBeGreaterThan(0);
        }
        await schliessen();
      }, 120_000);

      it('Bildschirmfotos Hell/Dunkel, DE/EN', async () => {
        mkdirSync(FOTOS, { recursive: true });
        const { page, log, schliessen } = await oeffne(browser, 'de-CH');
        for (const sprache of ['de', 'en'] as const) {
          for (const theme of ['hell', 'dunkel'] as const) {
            await page.click(`label[for="sprache-${sprache}"]`);
            await page.click(`label[for="theme-${theme}"]`);
            await page.mouse.move(0, 0);
            const pfad = join(FOTOS, `start-${theme}-${sprache}.png`);
            await page.screenshot({ path: pfad, fullPage: true });
            expect(existsSync(pfad)).toBe(true);
          }
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.click('label[for="sprache-de"]');
        await page.click('label[for="theme-hell"]');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await page.screenshot({ path: join(FOTOS, 'start-mobil-hell-de.png'), fullPage: true });
        expect(log.fehler).toEqual([]);
        await schliessen();
      }, 120_000);
    }
  });
}
