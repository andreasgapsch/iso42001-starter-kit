// Englische Fassung der Beispielprojekte: gleiche Logik, Struktur, IDs und Daten wie DE.
// Die Bau-Skripte erzeugen das Projekt einmal; aufEnglisch() ersetzt danach jeden Freitext über die Textpaare
// in texte-en-*.mts. Codes, IDs, Datumsfelder und Aufzählungswerte bleiben unverändert.
import type { Projekt } from '../../model/typen.ts';
import { TEXTE_MUSTER } from './texte-en-muster.mts';
import { TEXTE_PRAEZISION } from './texte-en-praezision.mts';
import { TEXTE_RC2 } from './texte-en-rc2.mts';
import { TEXTE_RC3 } from './texte-en-rc3.mts';
import { TEXTE_PROZESSE } from './texte-en-prozesse.mts';

/** Felder mit technischen Werten (Seiten-IDs, Zeitstempel, Version), nie übersetzt */
const TECHNISCH = new Set(['besucht', 'aktuelleSeite', 'projektId', 'erstellt', 'geaendert', 'kitVersion', 'dokumentSprache', 'png', 'svg', 'sha256', 'dateiname', 'fusszeileZusatz']);

/** Ist der Wert unter diesem Schlüssel ein Freitext (und nicht Code, ID, Datum oder E-Mail-Adresse)? */
export function istFreitext(schluessel: string, wert: string): boolean {
  if (TECHNISCH.has(schluessel)) return false;
  if (schluessel === 'bezeichnung' || schluessel === 'klassifikation') return true; // Skalenstufen wie «selten», «gering»; Klassifikation aus der Liste der Dokumentsprache
  if (!/[a-zäöü]/.test(wert)) return false; // IDs, Nummern, leere Werte
  if (/^[a-z0-9._-]+$/.test(wert)) return false; // Aufzählungswerte (Codes)
  if (/^\S+@\S+$/.test(wert)) return false;
  if (/^\d{4}-\d\d-\d\d/.test(wert)) return false;
  return true;
}

const woerterbuch = new Map<string, string>();
for (const [de, en] of [...TEXTE_MUSTER, ...TEXTE_PRAEZISION, ...TEXTE_RC2, ...TEXTE_RC3, ...TEXTE_PROZESSE]) {
  const alt = woerterbuch.get(de);
  const neu = en ?? de;
  if (alt !== undefined && alt !== neu) throw new Error(`Textpaar doppelt mit abweichender Übersetzung: ${de}`);
  woerterbuch.set(de, neu);
}

/** Englische Fassung eines Projekts. Fehlt für einen Freitext die Übersetzung, bricht der Bau mit der Liste ab. */
export function aufEnglisch(p: Projekt, projektId: string): Projekt {
  const fehlend = new Set<string>();
  const uebersetze = (wert: unknown, schluessel: string): unknown => {
    if (typeof wert === 'string') {
      // Messwerte wie «97,8 %» in englischer Schreibweise («97.8%»)
      if (/^\d+(,\d+)? %$/.test(wert)) return wert.replace(',', '.').replace(' %', '%');
      if (!istFreitext(schluessel, wert)) return wert;
      const en = woerterbuch.get(wert);
      if (en === undefined) fehlend.add(wert);
      return en ?? wert;
    }
    if (Array.isArray(wert)) return wert.map((w) => uebersetze(w, schluessel));
    if (wert && typeof wert === 'object') return Object.fromEntries(Object.entries(wert).map(([k, v]) => [k, uebersetze(v, k)]));
    return wert;
  };
  const en = uebersetze(p, '') as Projekt;
  if (fehlend.size) throw new Error(`Englische Texte fehlen (${fehlend.size}), in texte-en-*.mts ergänzen:\n${[...fehlend].map((t) => `  ${t}`).join('\n')}`);
  en.meta.projektId = projektId;
  en.meta.dokumentSprache = 'en';
  return en;
}

/** Textpaare, die in keinem der übergebenen Projekte mehr vorkommen (veraltete Einträge) */
export function unbenutzteTexte(...projekte: Projekt[]): string[] {
  const benutzt = new Set<string>();
  const sammle = (wert: unknown, schluessel: string): void => {
    if (typeof wert === 'string') { if (istFreitext(schluessel, wert)) benutzt.add(wert); }
    else if (Array.isArray(wert)) wert.forEach((w) => sammle(w, schluessel));
    else if (wert && typeof wert === 'object') for (const [k, v] of Object.entries(wert)) sammle(v, k);
  };
  for (const p of projekte) sammle(p, '');
  return [...woerterbuch.keys()].filter((de) => !benutzt.has(de));
}
