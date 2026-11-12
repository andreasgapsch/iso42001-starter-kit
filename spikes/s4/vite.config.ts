// Vite-Konfiguration des S4-Prototyps. Variante über S4_VARIANTE: naiv | roh | komprimiert | gemischt.
// Teil «worker»: S4_TEIL=worker baut nur den Generator-Worker als IIFE (für die Einbettung als Datenblock).
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { erzeugeKataloge } from './kataloge.mts';

const HIER = dirname(fileURLToPath(import.meta.url));
const variante = process.env['S4_VARIANTE'] ?? 'naiv';
const teil = process.env['S4_TEIL'] ?? 'app';

/** Stellt die Dummy-Kataloge als Modul bereit (nur Variante naiv). */
function kataloge(): Plugin {
  return {
    name: 's4-kataloge',
    resolveId: (id) => (id === 'virtual:kataloge' ? '\0virtual:kataloge' : null),
    // JSON.parse auf einem String-Literal ist schneller als ein grosses Objektliteral.
    load: (id) => (id === '\0virtual:kataloge' ? `export default JSON.parse(${JSON.stringify(erzeugeKataloge())});` : null),
  };
}

const einbettung = variante === 'naiv' ? 'naiv' : variante === 'roh' ? 'roh' : 'komprimiert';

export default defineConfig({
  root: HIER,
  logLevel: 'warn',
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  resolve: { alias: { '#einbettung': resolve(HIER, `src/einbettung-${einbettung}.ts`) } },
  worker: { format: 'iife' },
  plugins: teil === 'worker' ? [] : [kataloge(), viteSingleFile()],
  build:
    teil === 'worker'
      ? {
          outDir: resolve(HIER, 'dist/worker'),
          emptyOutDir: true,
          lib: { entry: resolve(HIER, 'src/worker.ts'), formats: ['iife'], name: 'S4Generator', fileName: () => 'worker.js' },
        }
      : {
          outDir: resolve(HIER, `dist/${variante}`),
          emptyOutDir: true,
          modulePreload: { polyfill: false },
          target: 'es2022',
        },
});
