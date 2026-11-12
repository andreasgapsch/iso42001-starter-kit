// Mehrere erzeugte Dateien zu einem ZIP bündeln (fflate, isomorph).
import { zipSync, type Zippable } from 'fflate';

export interface ZipEintrag {
  /** Pfad im ZIP mit «/» als Trenner, z. B. "de/D-01 Leitlinie.docx" */
  pfad: string;
  inhalt: Uint8Array;
}

export interface ZipOptionen {
  /** Fester Zeitstempel für alle Einträge (reproduzierbare Builds) */
  zeitpunkt?: Date;
}

// DOCX und XLSX sind bereits komprimiert; erneutes Komprimieren bringt kaum etwas
const SCHON_KOMPRIMIERT = /\.(docx|xlsx|pptx|zip|png|jpe?g|pdf)$/i;

export function zipErstellen(eintraege: ZipEintrag[], optionen: ZipOptionen = {}): Uint8Array {
  const baum: Zippable = {};
  const gesehen = new Set<string>();
  for (const e of eintraege) {
    const pfad = e.pfad.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!pfad || pfad.split('/').some((t) => t === '..' || t === '')) {
      throw new Error(`Ungültiger Pfad im ZIP: «${e.pfad}»`);
    }
    if (gesehen.has(pfad.toLowerCase())) throw new Error(`Doppelter Pfad im ZIP: «${pfad}»`);
    gesehen.add(pfad.toLowerCase());
    // Flache Schlüssel mit «/» legt fflate als Verzeichnisstruktur ab
    baum[pfad] = [e.inhalt, { level: SCHON_KOMPRIMIERT.test(pfad) ? 0 : 6 }];
  }
  return zipSync(baum, { mtime: optionen.zeitpunkt ?? new Date() });
}
