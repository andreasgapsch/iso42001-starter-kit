// Öffentliche Schnittstelle des Speichermoduls.

import { FallbackDateiZugriff, FsaDateiZugriff, type DokumentUmgebung, type FsaGlobal } from './datei.ts';
import { erkenneFaehigkeiten, type FsaUmgebung } from './faehigkeiten.ts';
import { ProjektSpeicher, type ProjektSpeicherOptionen } from './projekt-speicher.ts';
import type { Faehigkeiten } from './typen.ts';
import type { Auswahl, Umgebung } from './zwischenspeicher.ts';

export * from './typen.ts';
export * from './datei.ts';
export * from './faehigkeiten.ts';
export * from './projekt-speicher.ts';
export * from './zwischenspeicher.ts';
export * from './leeren.ts';

export type BrowserUmgebung = FsaUmgebung & FsaGlobal & Umgebung & DokumentUmgebung;

/** Baut den ProjektSpeicher passend zum Browser: FSA wenn möglich, sonst Dateiauswahl und Download. */
export async function erstelleProjektSpeicher<T>(
  optionen: Omit<ProjektSpeicherOptionen<T>, 'datei' | 'zwischen'>,
  g: BrowserUmgebung = globalThis as unknown as BrowserUmgebung,
): Promise<{ speicher: ProjektSpeicher<T>; faehigkeiten: Faehigkeiten; auswahl: Auswahl }> {
  const { faehigkeiten, auswahl } = await erkenneFaehigkeiten(g);
  const datei =
    faehigkeiten.fsaOeffnen && faehigkeiten.fsaSpeichern ? new FsaDateiZugriff(g) : new FallbackDateiZugriff(g);
  const speicher = new ProjektSpeicher<T>({ ...optionen, datei, zwischen: auswahl.adapter });
  return { speicher, faehigkeiten, auswahl };
}
