import { defineConfig } from 'vitest/config';

// Eigenes Vitest-Projekt für das Fuzz-Werkzeug (AF-024). Läuft nicht im Standardlauf (vitest.config.ts gehört P3):
//   scripts/werkzeug/begrenzt.sh 2G npx vitest run --config vitest.fuzz.config.ts
// Der Pflichtteil (50 Fälle je Ziel) startet je Ziel einen Arbeiter-Thread unter Aufsicht, siehe tests/fuzz/lauf.ts.
export default defineConfig({
  test: {
    name: 'fuzz',
    include: ['tests/fuzz/**/*.test.ts'],
    environment: 'node',
    testTimeout: 300_000,
    hookTimeout: 120_000,
    // Die Arbeiter sind selbst parallel; Testdateien nacheinander, damit die VM nicht überläuft
    fileParallelism: false,
  },
});
