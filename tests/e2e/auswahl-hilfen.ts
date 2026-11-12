// Bedienung der Auswahl des AIMS-Managers (src/app/ui/Auswahl.tsx, U-22: Knopf mit role=combobox und Liste mit role=listbox
// statt <select>) in E2E-Tests wie eine Person: Knopf anklicken, Option anklicken. Der gewählte Wert steht in data-wert.
import { expect, type Locator } from '@playwright/test';

/** Selektor der Auswahlknöpfe */
export const AUSWAHL = 'button.auswahl[role=combobox]';

export type Wahl = string | { index: number } | { label: string | RegExp };

/** Liste (listbox) einer Auswahl */
export async function liste(k: Locator): Promise<Locator> {
  const id = await k.getAttribute('aria-controls');
  return k.page().locator(`[id="${id}"]`);
}

/** Option wählen: nach Wert (data-wert), Index oder Beschriftung */
export async function waehle(k: Locator, wahl: Wahl): Promise<void> {
  await k.scrollIntoViewIfNeeded();
  await k.click();
  const l = await liste(k);
  await expect(l).toBeVisible();
  const o = typeof wahl === 'string' ? l.locator(`[role=option][data-wert="${wahl.replace(/"/g, '\\"')}"]`)
    : 'index' in wahl ? l.getByRole('option').nth(wahl.index) : l.getByRole('option', { name: wahl.label });
  await o.click();
  await expect(l).toBeHidden();
}

/** Gewählter Wert (wie inputValue bei <select>) */
export async function wertVon(k: Locator): Promise<string> {
  return (await k.getAttribute('data-wert')) ?? '';
}

/** Anzahl der Optionen (öffnet und schliesst die Liste mit Escape) */
export async function optionenZahl(k: Locator): Promise<number> {
  await k.click();
  const l = await liste(k);
  await expect(l).toBeVisible();
  const n = await l.getByRole('option').count();
  await k.press('Escape');
  await expect(l).toBeHidden();
  return n;
}
