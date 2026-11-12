// UI-Sprache (Voreinstellung Browsersprache, gemerkt) und Textzugriff mit ruhigem Rückfall.
// UI-Texte: src/i18n/<sprache>/app.yaml (Schlüssel app.*). Inhaltstexte (Guide, Kataloge) aus denselben Daten.
import { signal } from '@preact/signals';
import { ersetze, holePfad } from '../i18n/texte.ts';
import { grenzPlatzhalter } from '../eingang/grenzen.ts';
import type { Sprache } from '../model/typen.ts';
import { appDaten } from './daten.ts';
import { dokumentTitel } from '../vorlagen/kontext.ts';
import { lokalLesen, lokalSchreiben } from './lokal.ts';

function startSprache(): Sprache {
  const gemerkt = lokalLesen('ui-sprache');
  if (gemerkt === 'de' || gemerkt === 'en') return gemerkt;
  const nav = (globalThis.navigator?.languages?.[0] ?? globalThis.navigator?.language ?? 'de').toLowerCase();
  return nav.startsWith('de') ? 'de' : 'en';
}

export const uiSprache = signal<Sprache>(startSprache());

export function setzeUiSprache(s: Sprache): void {
  uiSprache.value = s;
  lokalSchreiben('ui-sprache', s);
  document.documentElement.lang = s === 'de' ? 'de-CH' : 'en-GB';
}

/** Grenzwerte aus der Konfiguration des Eingangsmoduls als Platzhalter {grenze_<art>} in jedem Text (AF-020) */
const grenzCache: Partial<Record<Sprache, Record<string, string>>> = {};
const grenzen = (s: Sprache): Record<string, string> => (grenzCache[s] ??= grenzPlatzhalter(s));

function suche(schluessel: string, sprache: Sprache): string | undefined {
  const w = holePfad(appDaten().texte[sprache], schluessel);
  if (typeof w === 'string') return w.trimEnd();
  if (typeof w === 'number') return String(w);
  return undefined;
}

// Normabschnitte und Rechtsverweise stehen in der Struktur (etappen.yaml, seiten/*.yaml, src/ai-act) auf Deutsch.
// Für die englische Oberfläche werden die wenigen Fachwörter darin übersetzt.
const FACHWOERTER_EN: [RegExp, string][] = [
  [/\bin der Fassung von\b/g, 'as amended by'],
  [/\bangefügt durch\b/g, 'added by'],
  [/\bVO \(EU\)/g, 'Regulation (EU)'],
  [/\bAnhang\b/g, 'Annex'],
  [/\bAbschnitt\b/g, 'Section'],
  [/\bNr\. ?/g, 'point '],
  [/\bSatz\b/g, 'sentence'],
  [/\bbis\b/g, 'to'],
  [/\bund\b/g, 'and'],
  [/Überblick/g, 'overview'],
  [/\bZertifizierung\b/g, 'certification'],
];

/** Normabschnitt oder Rechtsverweis in der Sprache der Oberfläche (z. B. «4 bis 10 (Überblick)» → «4 to 10 (overview)»). */
export function fachText(text: string): string {
  return uiSprache.value === 'en' ? FACHWOERTER_EN.reduce((a, [muster, ersatz]) => a.replace(muster, ersatz), text) : text;
}

/** UI-Text (app.<schluessel>). Fehlt er, Rückfall auf Deutsch, dann auf den Schlüssel. Platzhalter {abschnitt} über fachText. */
export function t(schluessel: string, werte?: Record<string, string | number>): string {
  const s = uiSprache.value;
  // Einzahl: bei anzahl = 1 gilt <schluessel>_eins, falls vorhanden («1 Eintrag» statt «1 Einträge»)
  const eins = werte?.['anzahl'] === 1 ? (suche(`app.${schluessel}_eins`, s) ?? suche(`app.${schluessel}_eins`, 'de')) : undefined;
  const text = eins ?? suche(`app.${schluessel}`, s) ?? suche(`app.${schluessel}`, 'de') ?? schluessel;
  const abschnitt = werte?.['abschnitt'];
  return ersetze(text, { ...grenzen(s), ...(typeof abschnitt === 'string' ? { ...werte, abschnitt: fachText(abschnitt) } : werte) });
}

/** Inhaltstext (vollständiger Schlüssel). Rückfall auf Deutsch; undefined, wenn er in keiner Sprache vorliegt. */
export function inhalt(schluessel: string, werte?: Record<string, string | number>): string | undefined {
  const s = uiSprache.value;
  // Einzahl wie in t() (A-07): bei anzahl = 1 gilt <schluessel>_eins, falls vorhanden
  const eins = werte?.['anzahl'] === 1 ? (suche(`${schluessel}_eins`, s) ?? (s !== 'de' ? suche(`${schluessel}_eins`, 'de') : undefined)) : undefined;
  const text = eins ?? suche(schluessel, s) ?? (s !== 'de' ? suche(schluessel, 'de') : undefined);
  return text === undefined ? undefined : ersetze(text, { ...grenzen(s), ...werte });
}

export function inhaltRoh(schluessel: string): unknown {
  return holePfad(appDaten().texte[uiSprache.value], schluessel) ?? holePfad(appDaten().texte.de, schluessel);
}

/** Beschriftung eines Optionswerts aus gefuehrt.optionen.<gruppe>.<wert>; Rückfall: der Wert selbst. */
export function optionText(gruppe: string | undefined, wert: string): string {
  if (!gruppe) return wert;
  return inhalt(`gefuehrt.optionen.${gruppe}.${wert}`) ?? wert;
}

/** Zeitpunkt (ISO mit Zeitzone, z. B. aus toISOString) in Ortszeit: Datum und Stunde:Minute */
export function zeitpunktText(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const z = (n: number) => String(n).padStart(2, '0');
  return `${datumText(`${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

export function datumText(iso: string | undefined): string {
  if (!iso) return '';
  const [j, m, d] = iso.slice(0, 10).split('-');
  return uiSprache.value === 'de' ? `${d}.${m}.${j}` : `${d}/${m}/${j}`;
}

/** Zahl in der Sprache der Oberfläche: Deutsch mit Dezimalkomma und Apostroph als Tausendertrenner (1’240,5), Englisch 1,240.5. */
export function zahlText(n: number, stellen = 1): string {
  const de = uiSprache.value === 'de';
  const s = n.toLocaleString(de ? 'de-CH' : 'en-GB', { maximumFractionDigits: stellen, minimumFractionDigits: 0 });
  return de ? s.replace(/\./g, ',') : s;
}

/** Titel eines Dokuments nach Register-ID in der Sprache der Oberfläche; dieselbe Quelle wie Dokumentkopf und Register (D-26). */
export function dokumentTitelUi(id: string): string {
  return dokumentTitel({ t: (s, w) => inhalt(s, w) ?? s, tOpt: (s, w) => inhalt(s, w) }, appDaten().kataloge, id);
}
