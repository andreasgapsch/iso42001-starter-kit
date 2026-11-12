// Eingebettete Daten des Werkzeugs. Der Build (scripts/app-bauen.mts) legt sie als Datenblöcke ins HTML:
//   #daten-app        application/json: Texte DE/EN, Kataloge, Guide, Prüfregeln, Version
//   #daten-prozesse   deflate + Base64: Prozesskatalog, Reifeskala und Prozesstexte DE/EN, erst beim ersten Zugriff entpackt
//   #daten-vorlagen   deflate + Base64: Texte der Vorlagen DE/EN (vor allem für den Generator), erst beim ersten Zugriff
//   #daten-beispiele  deflate + Base64: Beispielprojekte (src/beispiele/*.aims.json), erst bei Bedarf entpackt
//   #code-generator   deflate + Base64: Generator-Worker
import { jsonAusVertrauen } from '../eingang/lesen.ts';
import type { Texte } from '../i18n/texte.ts';
import type { Kataloge } from '../kataloge/typen.ts';
import type { GefuehrtDaten } from './logik/gefuehrt-typen.ts';
import type { Regel } from './logik/pruefung.ts';
import type { EuaiaControl, RmfControlVorschlag } from './logik/vorschlaege.ts';
import { entpackeBlock } from './worker/start.ts';

export interface AppDaten {
  texte: { de: Texte; en: Texte };
  kataloge: Kataloge;
  gefuehrt: GefuehrtDaten;
  regeln: { regeln: Regel[] };
  version: string;
  gebaut: string;
  beispiele: { datei: string; titel: string }[];
  /** Dateistamm des Leitfadens je Sprache (src/leitfaden/<sprache>/leitfaden.yaml) */
  leitfaden?: Partial<Record<'de' | 'en', string>>;
  /** Drittlizenzen der eingebetteten Bibliotheken */
  lizenzen?: { name: string; version: string; lizenz: string }[];
  /**
   * Teile, die in komprimierten Blöcken liegen: Block-ID zu Pfaden in diesen Daten (z. B. «texte.de.vorlagen»). Der Block
   * enthält ein Objekt Pfad zu Wert und wird beim ersten Zugriff auf einen seiner Pfade entpackt (Grössenbudget).
   */
  lazy?: Record<string, string[]>;
}

let daten: AppDaten | null = null;

/**
 * Legt für jeden Pfad eines komprimierten Blocks eine Eigenschaft mit Getter an. Der erste Zugriff entpackt den Block und
 * ersetzt alle seine Getter durch die Werte. Auch structuredClone (Daten an den Worker) liest über den Getter.
 */
export function lazyBloecke(d: AppDaten, entpacke: (id: string) => string | null): void {
  for (const [id, pfade] of Object.entries(d.lazy ?? {})) {
    let werte: Record<string, unknown> | null = null;
    const ziel = (pfad: string): [Record<string, unknown>, string] => {
      const teile = pfad.split('.');
      let o = d as unknown as Record<string, unknown>;
      for (const t of teile.slice(0, -1)) o = (o[t] ??= {}) as Record<string, unknown>;
      return [o, teile.at(-1)!];
    };
    const laden = (): Record<string, unknown> => {
      if (werte) return werte;
      const roh = entpacke(id);
      werte = roh ? (jsonAusVertrauen(roh, 'app-daten') as Record<string, unknown>) : {};
      for (const pfad of pfade) {
        const [o, k] = ziel(pfad);
        Object.defineProperty(o, k, { value: werte[pfad], enumerable: true, configurable: true, writable: true });
      }
      return werte;
    };
    for (const pfad of pfade) {
      const [o, k] = ziel(pfad);
      Object.defineProperty(o, k, { get: () => laden()[pfad], enumerable: true, configurable: true });
    }
  }
}

export function appDaten(): AppDaten {
  if (daten) return daten;
  const el = document.getElementById('daten-app');
  if (!el?.textContent) throw new Error('Datenblock daten-app fehlt');
  daten = jsonAusVertrauen(el.textContent, 'app-daten') as AppDaten;
  lazyBloecke(daten, (id) => (document.getElementById(id) ? entpackeBlock(id) : null));
  return daten;
}

/** Für Tests und Werkzeuge ausserhalb des Browsers. */
export function setzeAppDaten(d: AppDaten): void {
  daten = d;
}

export function controlIds42001(): string[] {
  return appDaten().kataloge.controls42001.gruppen.flatMap((g) => g.controls.map((c) => c.id));
}

export function euaiaControls(): EuaiaControl[] {
  return ((appDaten().kataloge['aiact_euaiaControls'] as { controls?: EuaiaControl[] } | undefined)?.controls ?? []);
}

/** Zusatz-Controls des Moduls NIST AI RMF (RMF-xx, RMF-Gxx) */
export function rmfControls(): RmfControlVorschlag[] {
  return appDaten().kataloge.nistrmf_rmfControls?.controls ?? [];
}

export function aiActStand(): string {
  return ((appDaten().kataloge['aiact_stand'] as { fassung?: { datum?: string } } | undefined)?.fassung?.datum) ?? '2026-07-27';
}

let beispielCache: Record<string, string> | null = null;

/** Text eines Beispielprojekts (Dateiname wie in src/beispiele). */
export function beispielText(datei: string): string | null {
  if (!beispielCache) {
    const roh = document.getElementById('daten-beispiele') ? entpackeBlock('daten-beispiele') : null;
    beispielCache = roh ? (jsonAusVertrauen(roh, 'app-daten') as Record<string, string>) : {};
  }
  return beispielCache[datei] ?? null;
}

/** Beispielprojekt Muster Maschinenbau AG für «Beispielantwort» (DE oder EN, sonst irgendeines). */
const muster: Partial<Record<string, Record<string, unknown> | null>> = {};
/**
 * Beispielprojekt für die Beispielantworten: im Pfad mit ISMS die Muster Maschinenbau AG, ohne ISMS die Präzisionsteile
 * GmbH (Rollentest RT-11); fehlt das passende, das andere.
 */
export function musterProjekt(sprache: 'de' | 'en', mitIsms = true): Record<string, unknown> | null {
  const schluessel = `${sprache}-${mitIsms ? 'isms' : 'ohne'}`;
  if (muster[schluessel] !== undefined) return muster[schluessel];
  const liste = appDaten().beispiele;
  const name = mitIsms ? 'muster' : 'praezision';
  const wahl =
    liste.find((b) => b.datei.includes(name) && b.datei.includes(`.${sprache}.`)) ??
    liste.find((b) => b.datei.includes('muster') && b.datei.includes(`.${sprache}.`)) ??
    liste.find((b) => b.datei.includes('muster')) ??
    null;
  const text = wahl ? beispielText(wahl.datei) : null;
  try {
    muster[schluessel] = text ? (jsonAusVertrauen(text, 'app-daten') as Record<string, unknown>) : null;
  } catch {
    muster[schluessel] = null;
  }
  return muster[schluessel];
}
