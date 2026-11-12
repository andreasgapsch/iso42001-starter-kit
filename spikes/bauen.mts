// Baut alle Spike-Seiten für die E2E-Tests (tests/e2e/spikes). Aufruf: npx tsx spikes/bauen.mts [s1|s4|s5 ...]
// Ausgabe nach spikes/<spike>/dist (über .gitignore ausgeschlossen).

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { setzeCsp, STRENGE_CSP } from '../scripts/csp.mts';

const WURZEL = dirname(fileURLToPath(import.meta.url));

async function einzeldatei(ordner: string, extra: { minify?: boolean; outDir?: string } = {}): Promise<string> {
  const root = join(WURZEL, ordner);
  const outDir = extra.outDir ?? join(root, 'dist');
  await build({
    configFile: false,
    root,
    logLevel: 'warn',
    plugins: [viteSingleFile()],
    build: { outDir, emptyOutDir: true, minify: extra.minify ?? true, modulePreload: { polyfill: false } },
  });
  return join(outDir, 'index.html');
}

/** S1: dieselbe Seite dreifach, um geteilten Speicher je Ordner und Datei zu prüfen. */
async function s1(): Promise<void> {
  const datei = await einzeldatei('s1');
  const dist = dirname(datei);
  for (const ziel of ['a/s1.html', 'a/s1-zweit.html', 'b/s1.html']) {
    await mkdir(dirname(join(dist, ziel)), { recursive: true });
    await cp(datei, join(dist, ziel));
  }
}

/** CSP-Varianten für die handgeschriebene S5-Seite (strengste zuerst). */
export const S5_VARIANTEN: Record<string, string> = {
  'trusted-types': `${STRENGE_CSP}; require-trusted-types-for 'script'; trusted-types aims-worker`,
  streng: STRENGE_CSP,
  // Gegenprobe: ohne worker-src greift default-src 'none' und der Worker muss scheitern.
  'ohne-worker-src': STRENGE_CSP.replace('worker-src blob:; ', ''),
  // Gegenprobe: falscher Skript-Hash, das Inline-Skript darf nicht laufen.
  'falscher-hash': STRENGE_CSP.replace('{skripte}', "'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='"),
};

/** S5: handgeschriebene Seite je CSP-Variante; S5b: Vite-Bundle mit Inline-Worker, danach scripts/csp.mts. */
async function s5(): Promise<void> {
  const dist = join(WURZEL, 's5/dist');
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  const vorlage = await readFile(join(WURZEL, 's5/worker-seite.html'), 'utf8');
  const berichte: Record<string, unknown> = {};
  for (const [name, csp] of Object.entries(S5_VARIANTEN)) {
    const r = setzeCsp(vorlage, csp);
    await writeFile(join(dist, `${name}.html`), r.html);
    berichte[name] = r.bericht;
  }
  const datei = await einzeldatei('s5/vite', { outDir: join(dist, 'vite') });
  const r = setzeCsp(await readFile(datei, 'utf8'), STRENGE_CSP);
  await writeFile(join(dirname(datei), 'mit-csp.html'), r.html);
  berichte['vite'] = r.bericht;
  await writeFile(join(dist, 'csp.json'), JSON.stringify(berichte, null, 2));
}

/** S4: eigene Vite-Konfiguration je Variante, siehe spikes/s4/bauen.mts. */
async function s4(): Promise<void> {
  const { bauenS4 } = await import('./s4/bauen.mts');
  await bauenS4();
}

/** S3: Test-PDF (über Chromium page.pdf) und Linkseite. */
async function s3(): Promise<void> {
  const { erzeugeS3 } = await import('./s3/pdf-erzeugen.mts');
  await erzeugeS3();
}

const SPIKES: Record<string, () => Promise<void>> = { s1, s3, s4, s5 };

const gewuenscht = process.argv.slice(2);
const liste = gewuenscht.length ? gewuenscht : Object.keys(SPIKES);
for (const name of liste) {
  const f = SPIKES[name];
  if (!f) throw new Error(`Unbekannter Spike: ${name}`);
  const t = performance.now();
  await f();
  console.log(`Spike ${name} gebaut (${Math.round(performance.now() - t)} ms)`);
}
await rm(join(WURZEL, '.vite'), { recursive: true, force: true });
