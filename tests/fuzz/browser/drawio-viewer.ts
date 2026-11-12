// Browser-Ziel «draw.io in der Diagrammansicht» (Viewer mit Vorprüfung in src/diagrammansicht/Diagrammansicht.html.tpl).
// VORBEREITET, NICHT AUSGEFÜHRT: Lauf im Browser in P18 (AF-026). Dieses Paket startet keinen Browser. Hier steht nur,
// was P18 braucht: dieselben deterministischen Fälle wie das Ziel «drawio» und die 30 Hänger-Dateien aus Runde 2, dazu
// das Urteil, das im Browser aus der sichtbaren Meldung gebildet wird (Hänger sind Fehler, Zeit bis Meldung höchstens 20 s).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { erzeugeFall } from '../kern.ts';
import { HAENGER_ORDNER, haengerDatei } from '../ziele/drawio.ts';

export const AUSFUEHRUNG = 'Lauf im Browser in P18';

export interface ViewerFall {
  name: string;
  /** Inhalt der Datei, die in die Diagrammansicht geladen wird */
  daten: string;
  /** Herkunft: erzeugt (Seed, Nummer) oder feste Datei aus Runde 2 */
  herkunft: string;
}

/** Urteil im Browser: geöffnet oder Meldung sichtbar; kein Ergebnis innerhalb des Limits ist ein Hänger und ein Fehler */
export const VIEWER_URTEIL = { geoeffnet: 'angenommen', meldung: 'abgelehnt', nichts: 'haenger', maxSekundenBisMeldung: 20 } as const;

/** Die festen Hänger-Dateien (30 in `tests/fixtures/runde2/drawio-haenger/`) */
export function haengerFaelle(): ViewerFall[] {
  return readdirSync(join(process.cwd(), HAENGER_ORDNER))
    .filter((n) => /\.(drawio|xml)$/.test(n))
    .sort()
    .map((n) => ({ name: n, daten: haengerDatei(n), herkunft: `${HAENGER_ORDNER}/${n}` }));
}

/** Erzeugte Fälle: dieselben wie das Node-Ziel «drawio», nur Text-Fälle (die Ansicht nimmt Text) */
export function erzeugteFaelle(seed: number, anzahl: number): ViewerFall[] {
  const aus: ViewerFall[] = [];
  for (let i = 1; i <= anzahl; i++) {
    const f = erzeugeFall('drawio', seed, i);
    if (typeof f.daten === 'string') aus.push({ name: f.name, daten: f.daten, herkunft: `drawio Seed ${seed} Fall ${i}` });
  }
  return aus;
}
