// Baut die optionale Diagrammansicht (im Kit: AIMS-Manager/Diagrammansicht.html): eine eigene HTML-Datei, die .drawio-Dateien
// offline mit dem unveränderten Viewer von draw.io (viewer-static.min.js) anzeigt. Getrennt vom AIMS-Manager, damit dessen
// Grösse und CSP unverändert bleiben.
//
// Ablauf: Viewer aus vendor/drawio-viewer/ lesen (nichts aus dem Netz), SHA-256 gegen VIEWER.sha256 prüfen, unverändert
// deflate-raw + Base64 als Datenblock einbetten (die Seite entpackt ihn mit DecompressionStream erst beim ersten Diagramm),
// Texte DE/EN aus src/i18n/<sprache>/diagrammansicht.yaml einsetzen, Schriften (latin) einbetten, CSP setzen.
//
// Aufruf: npx tsx scripts/diagrammansicht.mts [--aus <datei.html>]   (Standard: dist/diagrammansicht/Diagrammansicht.html)
//         npx tsx scripts/diagrammansicht.mts --stile-messen          (Stil-Hashes des Viewers in drei Engines messen)
//
// CSP der Diagrammansicht (DIAGRAMM_CSP) und ihre Lockerungen gegenüber dem AIMS-Manager, nur in dieser Datei:
//   - script-src: Hash des eigenen Skripts und Hash des Viewer-Codes (dynamisch eingefügtes Inline-Skript; alle drei Engines
//     prüfen es gegen die Hash-Liste). Kein 'unsafe-inline', kein 'unsafe-eval' (der Viewer braucht kein eval).
//   - style-src-elem: eigene Stil-Hashes und drei Stil-Elemente des Viewers (VIEWER.stilHashes: leeres Element, Animation
//     mxEdgeFlow, GraphViewer-CSS). Die Hashes hängen an der Viewer-Version und werden mit --stile-messen bestimmt.
//   - style-src-attr 'unsafe-inline': Lockerung. mxGraph setzt Grösse, Lage und Farbe jeder Form und jedes Labels über
//     style-Attribute (auch in foreignObject); ohne sie fehlen alle Formen. CSS-Injektion aus fremden Diagrammen bleibt
//     ohne Wirkung nach aussen: connect-src 'none', img-src data:, font-src data:, kein Netz.
//   - trusted-types diagrammansicht default dompurify: Lockerung. Der Viewer schreibt HTML über innerHTML und parst XML mit
//     DOMParser; ohne Default-Policy startet er nicht. Die Default-Policy schickt jede HTML-Zuweisung durch das mitgelieferte
//     DOMPurify (mit Haken gegen Verweise ins Internet), lässt DOMParser.parseFromString (inert) durch und lehnt Skripte und
//     Skript-URLs ab. «dompurify» ist die eigene Policy von DOMPurify; «diagrammansicht» erlaubt nur den Viewer-Code.
//   - connect-src 'none' ausdrücklich, sonst default-src 'none': keine Abrufe, Worker, Frames, Objekte; base-uri und
//     form-action 'none'.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { ladeTexte } from '../src/i18n/laden-node.ts';
import { KIT_VERSION } from '../src/model/neu.ts';
import { analysiere, setzeCsp } from './csp.mts';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Gepinnter Viewer: Version, Bezug und Prüfsumme (vendor/drawio-viewer/HERKUNFT.txt). */
export const VIEWER = {
  name: 'draw.io viewer-static',
  version: '32.4.1',
  tag: 'v32.4.1',
  datei: 'vendor/drawio-viewer/viewer-static.min.js',
  quelle: 'https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/js/viewer-static.min.js',
  sha256: 'bc7586cb62eec98018c13b78619078d3a7179cc7bfc711c566dda19527520a30',
  bytes: 4_360_162,
  /** Inhalte der Stil-Elemente, die der Viewer anlegt (gemessen mit --stile-messen, gleich in Chromium, Firefox, WebKit). */
  stilHashes: [
    "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='", // leeres Element (vor dem Füllen per innerHTML)
    "'sha256-QdGVqg2blBjK6VOH0IwFHd4uBDj3miWPXRlWkKpxrl0='", // .mxEdgeFlow (Editor.installAnimationStyles)
    "'sha256-72TeOXtKVq6Ty1xW4FqEK+evX/HnjVvzfKNbwVoXN7E='", // GraphViewer.getCss()
  ],
} as const;

/** Name der eigenen Trusted-Types-Policy (nur der Viewer-Code als Skript). */
export const TT_POLICIES = ['diagrammansicht', 'default', 'dompurify'] as const;

/** Policy-Vorlage; {skripte} und {stile} füllt setzeCsp mit den Hashes der Inline-Skripte und -Stile. */
export function diagrammCsp(viewerHash: string, stilHashes: readonly string[] = VIEWER.stilHashes): string {
  return [
    "default-src 'none'",
    `script-src {skripte} ${viewerHash}`,
    `style-src-elem {stile} ${stilHashes.join(' ')}`,
    "style-src-attr 'unsafe-inline'",
    'img-src data:',
    'font-src data:',
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "require-trusted-types-for 'script'",
    `trusted-types ${TT_POLICIES.join(' ')}`,
  ].join('; ');
}

export const VORLAGE = join(REPO, 'src', 'diagrammansicht', 'Diagrammansicht.html.tpl');
export const STANDARD_AUSGABE = join(REPO, 'dist', 'diagrammansicht', 'Diagrammansicht.html');

const UNICODE_LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
/** Nur die Teilmenge latin wie in START.html (scripts/start-vorlage.mts): DE und EN brauchen nichts darüber hinaus. */
const SCHRIFTEN = [
  { familie: 'Inter Variable', datei: 'inter-latin-wght-normal.woff2', achsen: 'font-weight: 400 700;' },
];

function schriftenStil(): string {
  const css = SCHRIFTEN.map((f) => {
    const daten = readFileSync(join(REPO, 'src', 'app', 'schriften', f.datei)).toString('base64');
    return `@font-face { font-family: '${f.familie}'; font-style: normal; font-display: swap; ${f.achsen} src: url(data:font/woff2;base64,${daten}) format('woff2'); unicode-range: ${UNICODE_LATIN}; }`;
  }).join('\n');
  return `<style id="schriften">\n${css}\n</style>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Liest den Viewer und prüft die Prüfsumme; bricht bei Abweichung ab. */
export function ladeViewer(repo = REPO): string {
  const roh = readFileSync(join(repo, VIEWER.datei));
  const summe = createHash('sha256').update(roh).digest('hex');
  if (summe !== VIEWER.sha256) {
    throw new Error(`${VIEWER.datei}: SHA-256 ${summe} statt ${VIEWER.sha256} (Viewer verändert oder falsche Version)`);
  }
  return roh.toString('utf8');
}

export function cspHash(text: string): string {
  return `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
}

type TexteDA = Record<string, string | string[]>;

function ladeSeitentexte(): { de: TexteDA; en: TexteDA } {
  const fuelle = (t: TexteDA): TexteDA =>
    Object.fromEntries(Object.entries(t).map(([k, v]) => [k, typeof v === 'string' ? v.trimEnd().replaceAll('{viewer_version}', VIEWER.version) : v.map((x) => String(x).trimEnd())]));
  const de = ladeTexte('de')['diagrammansicht'] as TexteDA | undefined;
  const en = ladeTexte('en')['diagrammansicht'] as TexteDA | undefined;
  if (!de || !en) throw new Error('Texte fehlen: src/i18n/<sprache>/diagrammansicht.yaml');
  return { de: fuelle(de), en: fuelle(en) };
}

export interface Ergebnis {
  html: string;
  bytes: number;
  /** Grösse des Viewer-Datenblocks (Base64) */
  viewerBlock: number;
  /** Schätzung der Grösse im Kit-ZIP (deflate Stufe 6 wie src/generator/zip.ts) */
  zipBytes: number;
  policy: string;
}

/** Baut die Seite als Zeichenkette. */
export function baueDiagrammansicht(stilHashes: readonly string[] = VIEWER.stilHashes, repo = REPO): Ergebnis {
  const viewer = ladeViewer(repo);
  const block = deflateRawSync(Buffer.from(viewer, 'utf8'), { level: 9 }).toString('base64');
  const texte = ladeSeitentexte();
  let html = readFileSync(VORLAGE, 'utf8').replace(/\r\n?/g, '\n');
  html = html.replace(/\{\{t:(\w+)\}\}/g, (_, k: string) => {
    const w = texte.de[k];
    if (w === undefined) throw new Error(`Text fehlt: diagrammansicht.${k}`);
    return typeof w === 'string' ? esc(w) : w.map((x) => `<li>${esc(x)}</li>`).join('');
  });
  // JSON im Datenblock: «<» maskieren, damit kein </script> entsteht
  const json = JSON.stringify(texte).replace(/</g, '\\u003c');
  html = html
    .replace('<!-- einsetzen:schriften -->', () => schriftenStil())
    .replace('{{texte}}', () => json)
    .replace('{{viewer}}', () => block)
    .replaceAll('{{kit_version}}', KIT_VERSION);
  if (/\{\{[^}]+\}\}/.test(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''))) throw new Error('Platzhalter nicht ersetzt');
  const { html: mitCsp, bericht } = setzeCsp(html, diagrammCsp(cspHash(viewer), stilHashes));
  if (bericht.probleme.length) throw new Error(`CSP-Probleme: ${bericht.probleme.join('; ')}`);
  const bytes = Buffer.byteLength(mitCsp, 'utf8');
  return { html: mitCsp, bytes, viewerBlock: block.length, zipBytes: deflateRawSync(Buffer.from(mitCsp, 'utf8'), { level: 6 }).length, policy: bericht.policy };
}

/** Diagramm für die Messung: ein paar Formen, Kante mit Fluss-Animation (die Seite entfernt sie), zwei Seiten. */
const MESS_DIAGRAMM = `<mxfile><diagram id="a" name="A"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="2" value="&lt;b&gt;Start&lt;/b&gt;" style="ellipse;html=1;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="80" height="40" as="geometry"/></mxCell>
<mxCell id="3" value="Raute" style="rhombus;html=1;" vertex="1" parent="1"><mxGeometry x="160" y="10" width="80" height="60" as="geometry"/></mxCell>
<mxCell id="4" style="edgeStyle=orthogonalEdgeStyle;flowAnimation=1;html=1;" edge="1" parent="1" source="2" target="3"><mxGeometry relative="1" as="geometry"/></mxCell>
</root></mxGraphModel></diagram><diagram id="b" name="B"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="5" value="Seite 2" style="shape=document;html=1;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="100" height="60" as="geometry"/></mxCell>
</root></mxGraphModel></diagram></mxfile>`;

/** Misst die Stil-Elemente des Viewers: Seite ohne Stil-Beschränkung bauen, Diagramm öffnen, Inhalte aller <style> hashen. */
async function stileMessen(): Promise<void> {
  const { chromium, firefox, webkit } = await import('playwright-core');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const ordner = mkdtempSync(join(tmpdir(), 'diagrammansicht-stile-'));
  const seite = join(ordner, 'seite.html');
  const eigen = new Set(analysiere(baueDiagrammansicht().html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')).stilHashes);
  writeFileSync(seite, baueDiagrammansicht(["'unsafe-inline'"]).html.replace(/style-src-elem [^;]*;/, "style-src-elem 'unsafe-inline';"));
  writeFileSync(join(ordner, 'mess.drawio'), MESS_DIAGRAMM);
  const funde = new Map<string, Set<string>>();
  for (const typ of [chromium, firefox, webkit]) {
    const b = await typ.launch();
    for (const theme of ['hell', 'dunkel']) {
      const p = await b.newPage();
      await p.goto(`file://${seite}`);
      await p.click(`label[for="theme-${theme}"]`);
      await p.setInputFiles('#datei', join(ordner, 'mess.drawio'));
      await p.waitForFunction(() => (window as unknown as { diagrammansicht: { zustand(): { viewer: boolean } } }).diagrammansicht.zustand().viewer);
      await p.click('#seite-weiter');
      await p.click('#zoom-ein');
      const stile = await p.evaluate(() => [...document.querySelectorAll('style')].map((s) => s.textContent ?? ''));
      for (const s of stile) {
        const h = cspHash(s);
        if (eigen.has(h)) continue;
        if (!funde.has(h)) funde.set(h, new Set([`Anfang ${JSON.stringify(s.slice(0, 40))}`]));
        funde.get(h)!.add(`${typ.name()}/${theme}`);
      }
      await p.close();
    }
    await b.close();
  }
  // Das leere Element zählt WebKit beim Einfügen vor dem Füllen; es ist immer dabei
  funde.set(cspHash(''), funde.get(cspHash('')) ?? new Set(['leer']));
  for (const [h, wo] of funde) console.log(`${h}  ${[...wo].join(', ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.includes('--stile-messen')) {
    await stileMessen();
  } else {
    const i = args.indexOf('--aus');
    const aus = resolve(i >= 0 && args[i + 1] ? args[i + 1]! : STANDARD_AUSGABE);
    const r = baueDiagrammansicht();
    mkdirSync(dirname(aus), { recursive: true });
    writeFileSync(aus, r.html);
    const kb = (n: number) => `${Math.round(n / 1024).toLocaleString('de-CH')} KB`;
    console.log(`Diagrammansicht: ${aus} (${kb(r.bytes)}, davon Viewer ${VIEWER.version} ${kb(r.viewerBlock)} Base64; im ZIP rund ${kb(r.zipBytes)})`);
  }
}
