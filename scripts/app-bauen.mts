// Baut den AIMS-Manager als eine HTML-Datei: dist/app/aims-manager.html (scripts/build.mts kopiert sie in den Kit-Ordner AIMS-Manager)
// 1. Generator-Worker (IIFE), PDF-Worker für Normtexte (IIFE, pdf.js) und App (Einzeldatei) mit vite.config.ts
// 2. Datenblöcke einsetzen (Spike S4 «gemischt»): Daten roh als JSON, Worker, PDF-Worker und Beispiele deflate + Base64
// 3. CSP setzt danach scripts/csp.mts (npm run build:app)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, strToU8 } from 'fflate';
import { build } from 'vite';
import { parse } from 'yaml';
import { KIT_VERSION, mitKitVersion } from '../src/model/neu.ts';
import { baueWissen } from './wissen.mts';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = join(REPO, 'dist/app/aims-manager.html');
const lies = (p: string) => readFileSync(join(REPO, p), 'utf8');
const json = (p: string) => JSON.parse(lies(p)) as unknown;

async function vite(teil: 'app' | 'worker' | 'normpdf'): Promise<void> {
  process.env['AIMS_TEIL'] = teil;
  await build({ configFile: join(REPO, 'vite.config.ts') });
}

const maskiereJson = (s: string) => s.replace(/</g, '\\u003c');
const b64 = (s: string) => Buffer.from(deflateSync(strToU8(s), { level: 9 })).toString('base64');

for (const d of ['src/generiert/texte.de.json', 'src/generiert/kataloge.json', 'src/generiert/gefuehrt.json', 'src/generiert/projekt-validator.mjs']) {
  if (!existsSync(join(REPO, d))) throw new Error(`${d} fehlt: zuerst npm run kataloge und tsx scripts/schema.mts`);
}

const t0 = Date.now();
await vite('worker');
const worker = lies('dist/.app-bau/worker/worker.js');
// PDF-Worker für die eigene Normausgabe (pdf.js), erst beim ersten Import gestartet
await vite('normpdf');
const normpdf = lies('dist/.app-bau/normpdf/normpdf.js');
await vite('app');
let html = lies('dist/.app-bau/app/index.html');

// Beispiele (falls vorhanden)
const beispielOrdner = join(REPO, 'src/beispiele');
const beispielDateien = existsSync(beispielOrdner) ? readdirSync(beispielOrdner).filter((d) => d.endsWith('.aims.json')).sort() : [];
const beispiele: Record<string, string> = {};
const beispielListe: { datei: string; titel: string }[] = [];
for (const d of beispielDateien) {
  // Projektdatei-Metadaten: kitVersion aus package.json (AF-177), nicht der Wert in der Quelldatei
  const text = mitKitVersion(readFileSync(join(beispielOrdner, d), 'utf8'));
  beispiele[d] = text;
  let titel = d;
  try {
    titel = (JSON.parse(text) as { organisation?: { name?: string } }).organisation?.name || d;
  } catch {
    /* Titel = Dateiname */
  }
  beispielListe.push({ datei: d, titel: `${titel} (${/\.en\./.test(d) ? 'EN' : 'DE'})` });
}

const leitfaden: Record<string, string> = {};
for (const s of ['de', 'en']) {
  const p = join(REPO, `src/leitfaden/${s}/leitfaden.yaml`);
  if (existsSync(p)) {
    const y = parse(readFileSync(p, 'utf8')) as { datei?: { leitfaden?: string } };
    if (y.datei?.leitfaden) leitfaden[s] = y.datei.leitfaden;
  }
}
const lizenzen = ['preact', '@preact/signals', 'docx', 'exceljs', 'fflate', 'pdfjs-dist'].map((n) => {
  const pj = json(`node_modules/${n}/package.json`) as { version: string; license?: string };
  return { name: n, version: pj.version, lizenz: pj.license ?? '' };
});

const daten = {
  texte: { de: json('src/generiert/texte.de.json'), en: json('src/generiert/texte.en.json') },
  kataloge: json('src/generiert/kataloge.json'),
  gefuehrt: json('src/generiert/gefuehrt.json'),
  regeln: json('src/generiert/regeln.json'),
  version: KIT_VERSION,
  gebaut: new Date().toISOString().slice(0, 10),
  beispiele: beispielListe,
  leitfaden,
  lizenzen,
  // Bereich Wissen (R5): Kapitelverzeichnis roh, Kapitel und Auszüge aus dem EU AI Act im Block daten-wissen
  wissen: baueWissen(),
};

// Grössenbudget: selten gebrauchte, grosse Teile als komprimierte Blöcke, entpackt beim ersten Zugriff (src/app/daten.ts):
// Prozesskatalog und Prozesstexte (Bereich Prozesse, Prüfregeln, Lagebild), die Texte der Vorlagen (Generator), die Inhalte
// des Bereichs Wissen (Leitfaden, Auszüge EU AI Act) und das Modul NIST AI RMF (Texte, Originalauszüge, Subkategorien)
const LAZY: Record<string, string[]> = {
  'daten-prozesse': ['kataloge.prozesse_katalog', 'kataloge.prozesse_reifeskala', 'texte.de.prozesse', 'texte.en.prozesse'],
  'daten-vorlagen': ['texte.de.vorlagen', 'texte.en.vorlagen', 'texte.de.ergaenzungsblaetter', 'texte.en.ergaenzungsblaetter'],
  'daten-wissen': ['wissen.leitfaden', 'wissen.aiact'],
  'daten-nist': ['texte.de.nist', 'texte.en.nist', 'kataloge.nistrmf_original1001', 'kataloge.nistrmf_original6001'],
  // Bibliothek (R4): Oberflächentexte, entpackt beim ersten Öffnen der Bibliothek oder ihres Untermenüs
  'daten-bibliothek': ['texte.de.bibliothek', 'texte.en.bibliothek'],
};
// Reserve unter dem Budget (Bericht D, D-33): Inhaltstexte der jeweils anderen Sprache liegen komprimiert; die Oberflächentexte
// (app) bleiben roh, damit der Start auf Englisch nichts entpacken muss. Der Block wird nur bei Englisch entpackt.
LAZY['daten-en'] = Object.keys((daten.texte as { en: Record<string, unknown> }).en)
  .filter((k) => k !== 'app' && !Object.values(LAZY).flat().includes(`texte.en.${k}`))
  .map((k) => `texte.en.${k}`);
const lazyBloecke: string[] = [];
const lazyListe: Record<string, string[]> = {};
for (const [id, pfade] of Object.entries(LAZY)) {
  const werte: Record<string, unknown> = {};
  for (const pfad of pfade) {
    const teile = pfad.split('.');
    let o = daten as unknown as Record<string, unknown>;
    for (const t of teile.slice(0, -1)) o = o[t] as Record<string, unknown>;
    const k = teile.at(-1)!;
    if (!(k in o)) throw new Error(`Datenteil ${pfad} fehlt`);
    werte[pfad] = o[k];
    delete o[k];
  }
  lazyListe[id] = pfade;
  lazyBloecke.push(`<script type="text/x-deflate-base64" id="${id}">${b64(JSON.stringify(werte))}</script>\n`);
}
(daten as Record<string, unknown>)['lazy'] = lazyListe;

const normpdfB64 = b64(normpdf);
const bloecke =
  `<script type="application/json" id="daten-app">${maskiereJson(JSON.stringify(daten))}</script>\n` +
  lazyBloecke.join('') +
  (beispielListe.length ? `<script type="text/x-deflate-base64" id="daten-beispiele">${b64(JSON.stringify(beispiele))}</script>\n` : '') +
  `<script type="text/x-deflate-base64" id="code-generator">${b64(worker)}</script>\n` +
  `<script type="text/x-deflate-base64" id="code-normpdf">${normpdfB64}</script>`;
if (!html.includes('<!--EINBETTUNG-->')) throw new Error('Platzhalter <!--EINBETTUNG--> fehlt');
html = html.replace('<!--EINBETTUNG-->', () => bloecke);
// Kein Hinweis auf externe Ressourcen
const extern = html.match(/(?:src|href)\s*=\s*["']https?:\/\/[^"']+/gi);
if (extern) throw new Error(`Externe Ressourcen im Werkzeug: ${extern.join(', ')}`);
// Grössenbudget des Werkzeugs (Q8): höchstens 10 MB (dezimal); die CSP kommt danach noch dazu
const BUDGET = 10_000_000;
const bytes = Buffer.byteLength(html);
if (bytes > BUDGET - 2_000) throw new Error(`AIMS-Manager mit ${bytes} Bytes über dem Budget von ${BUDGET} Bytes`);
// Warnschwelle: Reserve unter 100 KB ist das Signal, weitere Teile auszulagern, bevor die nächste Funktion das Budget reisst
if (bytes > BUDGET - 100_000) console.warn(`WARNUNG: AIMS-Manager mit ${bytes} Bytes, Reserve nur ${BUDGET - bytes} Bytes`);
mkdirSync(dirname(ZIEL), { recursive: true });
writeFileSync(ZIEL, html);
console.log(
  JSON.stringify({
    datei: ZIEL.replace(`${REPO}/`, ''),
    bytes: Buffer.byteLength(html),
    workerRoh: worker.length,
    normpdfRoh: normpdf.length,
    normpdfEingebettet: normpdfB64.length,
    datenRoh: JSON.stringify(daten).length,
    beispiele: beispielListe.length,
    sekunden: (Date.now() - t0) / 1000,
  }),
);
