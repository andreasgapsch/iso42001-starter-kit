// Arbeiter des Fuzz-Werkzeugs (eigener Prozess): führt die Fälle eines Ziels nacheinander aus und meldet Anfang und Ende jedes Falls.
// Der Wächter in lauf.ts beendet den Prozess, wenn ein Fall das Zeitlimit überschreitet (Hänger); reisst der Speicher, stirbt nur dieser
// Prozess, nicht der Lauf (ein Thread würde bei Speichermangel gelegentlich den ganzen Prozess mitnehmen).
import { fallAusDatei, fuehreAus, fuehreFallAus } from './kern.ts';
import type { ZielName } from './typen.ts';

interface Auftrag {
  art: ZielName;
  seed: number;
  von: number;
  bis: number;
  zeitlimitMs: number;
  /** Regressionsmodus: eine feste Datei statt erzeugter Fälle */
  datei?: string;
}

const a = JSON.parse(process.argv[2]!) as Auftrag;
const senden = (m: unknown): void => void process.send!(m);

// Aufwärmen (Grundlagen laden, Module importieren): zählt nicht zum Zeitlimit eines Falls
await fuehreAus(a.art, 1, 1, Infinity).catch(() => undefined);
senden({ t: 'bereit' });

for (let i = a.von; i <= a.bis; i++) {
  senden({ t: 'start', i });
  const e = a.datei !== undefined ? await fuehreFallAus(a.art, () => fallAusDatei(a.art, a.datei!), i, a.zeitlimitMs) : await fuehreAus(a.art, a.seed, i, a.zeitlimitMs);
  senden({ t: 'ende', e });
}
process.send!({ t: 'fertig' }, () => process.exit(0));
