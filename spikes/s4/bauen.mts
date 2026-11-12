// Baut alle S4-Varianten mit spikes/s4/vite.config.ts, bettet Daten ein, setzt die CSP und misst die Grössen.
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, strToU8 } from 'fflate';
import { build } from 'vite';
import { setzeCsp, STRENGE_CSP } from '../../scripts/csp.mts';
import { erzeugeKataloge } from './kataloge.mts';

const HIER = dirname(fileURLToPath(import.meta.url));
export const CSP_MIT_TT = `${STRENGE_CSP}; require-trusted-types-for 'script'; trusted-types aims-worker`;
import { VARIANTEN } from './varianten.mts';

async function vite(variante: string, teil: 'app' | 'worker'): Promise<void> {
  process.env['S4_VARIANTE'] = variante;
  process.env['S4_TEIL'] = teil;
  await build({ configFile: join(HIER, 'vite.config.ts') });
}

/** Text so maskieren, dass er in einem <script>-Block nicht vorzeitig endet (gültig für JS und JSON). */
function maskiereJs(code: string): string {
  return code.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
}
function maskiereJson(json: string): string {
  return json.replace(/</g, '\\u003c');
}
const b64 = (s: string): string => Buffer.from(deflateSync(strToU8(s), { level: 9 })).toString('base64');

export interface S4Groesse {
  variante: string;
  bytes: number;
  workerRoh: number;
  katalogeRoh: number;
  csp: string;
}

export async function bauenS4(): Promise<S4Groesse[]> {
  await vite('naiv', 'worker');
  const worker = await readFile(join(HIER, 'dist/worker/worker.js'), 'utf8');
  const kat = erzeugeKataloge();
  const groessen: S4Groesse[] = [];
  for (const v of VARIANTEN) {
    await vite(v, 'app');
    const pfad = join(HIER, `dist/${v}/index.html`);
    let html = await readFile(pfad, 'utf8');
    let bloecke = '';
    if (v === 'roh') {
      bloecke =
        `<script type="application/json" id="daten-kataloge">${maskiereJson(kat)}</script>\n` +
        `<script type="text/plain" id="code-generator">${maskiereJs(worker)}</script>`;
    } else if (v === 'gemischt') {
      bloecke =
        `<script type="application/json" id="daten-kataloge">${maskiereJson(kat)}</script>\n` +
        `<script type="text/x-deflate-base64" id="code-generator">${b64(worker)}</script>`;
    } else if (v === 'komprimiert') {
      bloecke =
        `<script type="text/x-deflate-base64" id="daten-kataloge">${b64(kat)}</script>\n` +
        `<script type="text/x-deflate-base64" id="code-generator">${b64(worker)}</script>`;
    }
    // Ersatz als Funktion: $-Muster im Code dürfen nicht als Ersetzungsmuster wirken.
    html = html.replace('<!--EINBETTUNG-->', () => bloecke);
    // Eigener Worker-Start erlaubt Trusted Types; Vites ?worker&inline (naiv) übergibt eine rohe URL und braucht die Basis-CSP.
    const r = setzeCsp(html, v === 'naiv' ? STRENGE_CSP : CSP_MIT_TT);
    if (r.bericht.probleme.length) throw new Error(`CSP-Probleme ${v}: ${r.bericht.probleme.join('; ')}`);
    const ziel = join(HIER, `dist/s4-${v}.html`);
    await writeFile(ziel, r.html);
    await rm(dirname(pfad), { recursive: true, force: true });
    groessen.push({ variante: v, bytes: Buffer.byteLength(r.html), workerRoh: worker.length, katalogeRoh: kat.length, csp: r.bericht.policy.replace(/'sha256-[^']+'/g, "'sha256-…'") });
  }
  await writeFile(join(HIER, 'dist/groessen.json'), JSON.stringify(groessen, null, 2));
  return groessen;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.table(await bauenS4());
