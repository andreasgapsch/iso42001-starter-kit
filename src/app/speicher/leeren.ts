// Browserspeicher leeren (AF-032): alle Zwischenstände (sie enthalten Projekt und Logo) und das Normpaket. Die Projektdatei auf
// dem Datenträger und die Dateien der Bibliothek im Browser (eigener Speicher, Einstellungen › Bibliothek) bleiben unberührt.
import { PRAEFIX } from './projekt-speicher.ts';
import type { ZwischenspeicherAdapter } from './typen.ts';

export interface LeerenZiele {
  /** Ablage der Zwischenstände (IndexedDB «aims-manager», localStorage oder Arbeitsspeicher) */
  zwischen: ZwischenspeicherAdapter;
  /** Ablage des Normpakets (IndexedDB «aims-normpaket»); null, wenn es keine gibt */
  normpaket?: ZwischenspeicherAdapter | null;
  /** Schlüssel eines Zwischenstands, der bleibt (z. B. das geöffnete Projekt); ohne Angabe fällt alles weg */
  behalte?: string;
}

export interface LeerenErgebnis {
  zwischenstaende: number;
  normpaket: number;
}

/** Löscht jeden Schlüssel der Ablage mit dem Präfix; Fehler einzelner Schlüssel brechen das Leeren nicht ab */
async function ablageLeeren(a: ZwischenspeicherAdapter, praefix: string, behalte?: string): Promise<number> {
  let n = 0;
  for (const k of await a.schluessel(praefix)) {
    if (behalte !== undefined && k === behalte) continue;
    await a.loeschen(k);
    n++;
  }
  return n;
}

/**
 * Entfernt alle Schlüssel des Browserspeichers dieser App: Zwischenstände mit Projekt und Logo 
 * und, falls angegeben, das Normpaket. Nicht erfasst sind die Dateien der Bibliothek im Browser (IndexedDB «aims-bibliothek», Nachweise, auch mit Personenbezug): Sie bleiben, bis sie dort gelöscht werden.
 */
export async function leereBrowserspeicher(z: LeerenZiele): Promise<LeerenErgebnis> {
  const zwischenstaende = await ablageLeeren(z.zwischen, PRAEFIX, z.behalte === undefined ? undefined : `${PRAEFIX}${z.behalte}`);
  const normpaket = z.normpaket ? await ablageLeeren(z.normpaket, '') : 0;
  return { zwischenstaende, normpaket };
}
