// E2E über file:// in drei Engines; kein Webserver.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // Eigene Endung, damit Vitest die Dateien nicht aufgreift.
  testMatch: '**/*.e2e.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  outputDir: 'test-results',
  // Referenzbilder der visuellen Regression liegen im Repo neben den Tests
  snapshotPathTemplate: '{testDir}/{testFileDir}/__screenshots__/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' } },
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  workers: process.env['CI'] ? 2 : 3,
  reporter: [['list']],
  use: { headless: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
