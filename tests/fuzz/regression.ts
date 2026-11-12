// Regressionsmodus: feste Dateien aus früheren Runden und die Fall-Dateien der bekannten Funde laufen durch das Ziel, nicht nur
// erzeugte Fälle. Eine gefundene Datei bleibt so ein Regressionsfall, auch wenn sich die Erzeugung ändert.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BEKANNTE_FUNDE } from './bekannte-funde.ts';
import type { ZielErgebnis } from './lauf.ts';
import type { Eingabeart } from './typen.ts';

export interface RegressionsDatei {
  art: Eingabeart;
  /** Pfad relativ zum Repository */
  datei: string;
  /** abgelehnt: muss mit Meldung abgelehnt werden; urteil: angenommen oder abgelehnt, nie Fehler; fund: bekannter Fund, muss weiter fehlschlagen */
  erwartung: 'abgelehnt' | 'urteil' | 'fund';
  /** Bei `fund` Teil der Meldung, sonst leer */
  meldung?: string;
}

const ENDUNG_ART: Record<string, Eingabeart> = { svg: 'svg-logo', drawio: 'drawio' };

function dateien(ordner: string): string[] {
  return readdirSync(join(process.cwd(), ordner)).sort().map((n) => `${ordner}/${n}`);
}

/** Alle Regressionsdateien: Runde 2 (Eingaben und Hänger) und die bekannten Funde */
export function regressionsDateien(): RegressionsDatei[] {
  const aus: RegressionsDatei[] = [];
  for (const d of dateien('tests/fixtures/runde2/eingaben')) {
    const art = ENDUNG_ART[d.split('.').pop()!];
    if (!art) throw new Error(`Keine Art für ${d}`);
    // Die DTD-Umgehungen der Runde 2 (E2-04) müssen abgelehnt werden; die SVG-Umgehungen dürfen bereinigt angenommen werden
    aus.push({ art, datei: d, erwartung: art === 'drawio' ? 'abgelehnt' : 'urteil' });
  }
  for (const d of dateien('tests/fixtures/runde2/drawio-haenger')) aus.push({ art: 'drawio', datei: d, erwartung: 'urteil' });
  // Behobene Funde des Werkzeugs: Die Fall-Dateien bleiben als Regression und müssen ein Urteil ohne Fehler ergeben (F1, P8)
  for (const d of dateien('tests/fixtures/fuzz').filter((n) => /\/normpaket-\d+-\d+\.json$/.test(n))) aus.push({ art: 'normpaket', datei: d, erwartung: 'urteil' });
  for (const f of BEKANNTE_FUNDE) aus.push({ art: f.art, datei: f.datei, erwartung: 'fund', meldung: f.meldung });
  return aus;
}

/** Bewertet das Ergebnis einer Regressionsdatei; liefert den Fehlertext oder undefined, wenn die Erwartung erfüllt ist */
export function bewerteRegression(r: RegressionsDatei, e: Pick<ZielErgebnis, 'angenommen' | 'abgelehnt' | 'fehler' | 'haenger' | 'fehlerFaelle'>): string | undefined {
  const meldung = e.fehlerFaelle[0]?.meldung ?? '';
  if (r.erwartung === 'fund') {
    if (e.fehler + e.haenger === 0) return `${r.datei}: bekannter Fund ist behoben, Eintrag aus bekannte-funde.ts entfernen`;
    if (!meldung.includes(r.meldung ?? '')) return `${r.datei}: schlägt aus anderem Grund fehl (${meldung.slice(0, 120)}), erwartet «${r.meldung}»`;
    return undefined;
  }
  if (e.fehler + e.haenger > 0) return `${r.datei}: ${e.fehlerFaelle[0]?.text ?? 'Fehler'}`;
  if (r.erwartung === 'abgelehnt' && e.abgelehnt !== 1) return `${r.datei}: muss abgelehnt werden, wurde angenommen`;
  return undefined;
}
