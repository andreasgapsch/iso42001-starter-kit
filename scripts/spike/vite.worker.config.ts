// Spike S2: Worker-Einstieg des Generators einzeln bündeln und die Grösse messen.
// Aufruf: npx vite build -c scripts/spike/vite.worker.config.ts
// Ausgabe nach $SPIKE_AUSGABE oder in einen temporären Ordner.
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { defineConfig } from 'vite';

const wurzel = resolve(import.meta.dirname, '../..');

export default defineConfig({
  root: wurzel,
  publicDir: false,
  logLevel: 'info',
  define: {
    // Bibliotheken fragen teils process.env.NODE_ENV ab; im Worker gibt es kein process
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: process.env.SPIKE_AUSGABE ?? join(tmpdir(), 'iso42001-spike-s2-worker'),
    emptyOutDir: true,
    target: 'es2022',
    minify: true,
    sourcemap: false,
    reportCompressedSize: true,
    // Klassisches Skript (IIFE): läuft als Blob-Worker auch dort, wo Modul-Worker fehlen
    lib: {
      entry: join(wurzel, 'src/generator/worker.ts'),
      formats: ['iife'],
      name: 'GeneratorWorker',
      fileName: () => 'generator-worker.js',
    },
  },
});
