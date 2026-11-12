import { defineConfig } from 'vitest/config';

// Zwei Projekte: schnelle Einheitentests und Dokumententests mit LibreOffice (langsam)
export default defineConfig({
  test: {
    // Abdeckung (AF-047): alle Quelldateien zählen, auch ungeladene (Wert 0). Generierter Code, Skripte und Tests zählen nicht.
    // Die Ratsche (scripts/pruefen/ratsche.mts, Basis tests/abdeckung-basis.json) vergleicht das Ergebnis mit dem Stand.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx,mts}'],
      exclude: ['src/generiert/**', 'src/**/*.d.ts', 'src/**/*.d.mts'],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: 'coverage',
    },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          // Einzelne Tests rendern alle Vorlagen beider Beispiele; CI-Runner sind langsamer als der Server
          testTimeout: 30_000,
        },
      },
      {
        test: {
          name: 'dokumente',
          include: ['tests/dokumente/**/*.test.ts'],
          environment: 'node',
          testTimeout: 180_000,
          hookTimeout: 180_000,
          // LibreOffice-Läufe nicht parallel starten
          fileParallelism: false,
        },
      },
    ],
  },
});
