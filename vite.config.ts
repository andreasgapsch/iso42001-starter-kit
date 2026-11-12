// Vite-Konfiguration des AIMS-Managers (src/app). Zwei Teile, gesteuert über AIMS_TEIL:
//   app     Einzeldatei mit vite-plugin-singlefile (Daten und Worker setzt scripts/app-bauen.mts danach ein)
//   worker  Generator-Worker als IIFE (wird deflate-komprimiert eingebettet, Spike S4 Variante «gemischt»)
//   normpdf PDF-Worker für die eigene Normausgabe (pdf.js, Legacy-Build), IIFE, ebenso komprimiert eingebettet
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const HIER = dirname(fileURLToPath(import.meta.url));
const teil = process.env['AIMS_TEIL'] ?? 'app';
const AUS = resolve(HIER, 'dist/.app-bau');
// Version des Kits aus package.json (AF-177). Das Plugin ersetzt src/model/version.ts im Bündel durch die Konstante,
// damit App und Worker nicht die ganze package.json einbetten; Node, tsx und Vitest lesen die Datei selbst.
const KIT_VERSION = (JSON.parse(readFileSync(resolve(HIER, 'package.json'), 'utf8')) as { version: string }).version;
const VERSION_MODUL = resolve(HIER, 'src/model/version.ts');
const kitVersion: Plugin = {
  name: 'kit-version',
  enforce: 'pre',
  load: (id) => (id.split('?')[0] === VERSION_MODUL ? `export const KIT_VERSION = ${JSON.stringify(KIT_VERSION)};\n` : null),
};

export default defineConfig({
  root: resolve(HIER, 'src/app'),
  logLevel: 'warn',
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  plugins: teil === 'app' ? [kitVersion, viteSingleFile()] : [kitVersion],
  build:
    teil === 'normpdf'
      ? {
          outDir: resolve(AUS, 'normpdf'),
          emptyOutDir: true,
          target: 'es2022',
          minify: true,
          // pdf.js nutzt import.meta.url nur für Node und Wasm-Bilddecoder (hier nicht gebraucht): leer ersetzen
          rolldownOptions: { transform: { define: { 'import.meta': '{}' } } },
          lib: { entry: resolve(HIER, 'src/normtexte/pdf-worker.ts'), formats: ['iife'], name: 'AimsNormPdf', fileName: () => 'normpdf.js' },
        }
      : teil === 'worker'
      ? {
          outDir: resolve(AUS, 'worker'),
          emptyOutDir: true,
          target: 'es2022',
          lib: { entry: resolve(HIER, 'src/app/worker/einstieg.ts'), formats: ['iife'], name: 'AimsGenerator', fileName: () => 'worker.js' },
        }
      : {
          outDir: resolve(AUS, 'app'),
          emptyOutDir: true,
          target: 'es2022',
          modulePreload: { polyfill: false },
          reportCompressedSize: false,
        },
});
