// Store der App: Projekt (Signals), Speicher (Projektdatei + Zwischenspeicher), Route, Theme, Meldungen.
import { jsonAusVertrauen } from '../../eingang/lesen.ts';
import { computed, effect, signal } from '@preact/signals';
import { leeresProjekt } from '../../model/neu.ts';
import type { Projekt, Sprache } from '../../model/typen.ts';
import { ladeProjektLesend, ladeProjektText, projektReparieren, projektTextParsen, pruefeProjektDaten, schemaFehlerText, type LadeFehlerArt, type SchemaFehler } from '../import/laden.ts';
import { t } from '../i18n.ts';
import { speicherFehler } from '../Fehler.tsx';
import { aiActStand, appDaten, controlIds42001, euaiaControls, rmfControls } from '../daten.ts';
import type { Umfeld } from '../logik/gefuehrt.ts';
import { befundeJeSeite, pruefe } from '../logik/pruefung.ts';
import { bereitschaftBerechnen, type Bereitschaft } from '../logik/bereitschaft.ts';
import { ohneFreigabeIds } from '../ansichten/pruefung/stage1.ts';
import { fehlerDosiert, type FehlerDosiert } from '../logik/fehler-dosiert.ts';
import { parseRoute, routeZuHash, type Route } from '../logik/routen.ts';
import { lokalLesen, lokalSchreiben } from '../lokal.ts';
import { AUFBEWAHRUNG_TAGE, erstelleProjektSpeicher, leereBrowserspeicher, type LeerenErgebnis, type ProjektSpeicher, type Sicherung, type Status, type Zwischenstand } from '../speicher/index.ts';
import { leeresNormpaket } from '../../normtexte/typen.ts';
import { normAblage, normpaket } from '../normtexte/zustand.ts';
import { kanaeleVereint, speicherKanal, tabWache, type KanalLike, type TabWache } from '../speicher/zwei-tabs.ts';
import { erstelleZustand } from './kern.ts';
import { bestaetigen } from './bestaetigen.ts';

export class LadeFehler extends Error {
  constructor(readonly art: LadeFehlerArt, readonly details: string[], readonly schema?: SchemaFehler[], readonly text?: string) {
    super(`${art}: ${details.join('; ')}`);
  }
}

export function deserialisieren(text: string): Projekt {
  const r = ladeProjektText(text);
  // Rohtext nur bei Schemafehlern mitgeben: Grundlage des Reparaturwegs (Start)
  if (!r.ok) throw new LadeFehler(r.art, r.details, r.schema, r.art === 'schema' ? text : undefined);
  return r.projekt;
}

/**
 * Wie deserialisieren, aber für das Öffnen einer Datei: meldet die Migration (Grundlage der Sicherung, AF-004) und öffnet eine
 * Datei aus einer neueren Version nur lesend statt mit Fehler (AF-005).
 */
export function deserialisierenMitInfo(text: string): { projekt: Projekt; migration?: { von: number; nach: number }; nurLesen?: { version: number; bekannt: number } } {
  const r = ladeProjektText(text);
  if (r.ok) return { projekt: r.projekt, ...(r.vonVersion < r.projekt.schemaVersion ? { migration: { von: r.vonVersion, nach: r.projekt.schemaVersion } } : {}) };
  if (r.art === 'zu-neu') {
    const l = ladeProjektLesend(projektTextParsen(text));
    if (l.ok) return { projekt: l.projekt, nurLesen: { version: l.version, bekannt: l.bekannt } };
  }
  throw new LadeFehler(r.art, r.details, r.art === 'schema' ? r.schema : undefined, r.art === 'schema' ? text : undefined);
}

/**
 * Projekt verletzt die Prüfung vor dem Speichern. Die Datei bleibt unberührt, nichts wird still geändert: `reparatur` ist der
 * Vorschlag, den die Oberfläche zur Bestätigung zeigt (null: nicht reparierbar, Rohdaten gehen in die Rettungsdatei).
 */
export class SpeicherPruefFehler extends Error {
  constructor(readonly details: string[], readonly roh: string, readonly reparatur: { projekt: Projekt; aenderungen: string[] } | null = null) {
    super(details.join('; '));
    this.name = 'SpeicherPruefFehler';
  }
}

/** Prüfung vor jedem Speichern: Die App schreibt nie eine Datei, die sie selbst nicht mehr öffnen könnte, und ändert nie still. */
export function vorDemSpeichern(p: Projekt): Projekt {
  const roh = JSON.stringify(p);
  const daten = jsonAusVertrauen(roh, 'kopie');
  const r = pruefeProjektDaten(daten);
  if (r.ok) return p;
  throw new SpeicherPruefFehler(schemaFehlerText(r.fehler, 8, undefined, daten), roh, projektReparieren(daten));
}

let speicher: ProjektSpeicher<Projekt> | null = null;
export const speicherStatus = signal<Status | null>(null);
export const zwischenspeicherArt = signal<string>('');

/** Ein Beispiel ist geöffnet und noch nicht verändert: Kopf zeigt keinen Hinweis auf ungespeicherte Änderungen (RT-45) */
export const beispielUnveraendert = signal(false);
/** Datei aus einer neueren Version geöffnet: nur lesend, Änderungen sind gesperrt (AF-005) */
export const nurLesen = computed(() => speicherStatus.value?.nurLesen ?? null);
/** Ursprüngliche Datei vor der Migration, bis sie abgelegt oder verworfen ist (AF-004) */
export const migrationsSicherung = signal<Sicherung | null>(null);
/** Hinweis zum unverschlüsselten Browserspeicher, bis er bestätigt ist (AF-032) */
export const speicherHinweis = signal(false);
const HINWEIS_SCHLUESSEL = 'speicher-hinweis';

export const zustand = erstelleZustand({
  gesperrt: () => speicher?.status.nurLesen != null,
  beiAenderung: (p) => {
    beispielUnveraendert.value = false;
    speicher?.aendern(p);
  },
});
export const projekt = zustand.projekt;
export const ungespeichert = zustand.ungespeichert;
export const aendere = zustand.aendere;
export const aendereMit = zustand.aendereMit;

export async function speicherStarten(): Promise<void> {
  const r = await erstelleProjektSpeicher<Projekt>({
    schluesselVon: (p) => p.meta.projektId,
    dateinameVon: (p) => p.organisation.name || 'projekt',
    deserialisieren,
    deserialisierenMitInfo,
    vorDemSpeichern,
  });
  speicher = r.speicher;
  zwischenspeicherArt.value = r.faehigkeiten.zwischenspeicher;
  speicher.ohneZwischenspeicher = lokalLesen('zwischenspeicher') === 'aus';
  // Gesicherte Stände höchstens 30 Tage aufbewahren (Daten liegen sonst unbegrenzt im Browser)
  void speicher.aufraeumen(AUFBEWAHRUNG_TAGE).catch(() => undefined);
  tabsBeobachten();
  speicher.beiFremdemSchreiber = () => (andereTabs.value = Math.max(andereTabs.value, 1));
  speicher.beobachten((s) => {
    // Erster Zwischenstand im Browser: einmal darauf hinweisen, dass er unverschlüsselt und befristet liegt (AF-032)
    if (s.letzterZwischenstand && !speicherStatus.value?.letzterZwischenstand && lokalLesen(HINWEIS_SCHLUESSEL) !== 'ja') speicherHinweis.value = true;
    speicherStatus.value = s;
    speicherFehler.value = !!s.fehler?.startsWith('Zwischenspeicher');
    ungespeichert.value = s.ungespeichert && projekt.value !== null;
  });
}

/** Andere Tabs mit demselben Projekt (Warnung im Rahmen) */
export const andereTabs = signal(0);
let tabs: TabWache | null = null;

function tabsBeobachten(): void {
  if (tabs) return;
  const id = globalThis.crypto?.randomUUID?.() ?? `tab-${Date.now()}-${Math.random()}`;
  const kanaele: KanalLike[] = [];
  try {
    if (typeof BroadcastChannel === 'function') {
      kanaele.push(new BroadcastChannel('aims-manager-tabs') as unknown as KanalLike);
    }
  } catch {
    // Kein Kanal: bleibt der Weg über localStorage
  }
  try {
    const ls = globalThis.localStorage;
    if (ls) {
      kanaele.push(speicherKanal({
        setItem: (k, w) => ls.setItem(k, w),
        horchen: (f) => {
          const h = (e: StorageEvent) => f(e.key, e.newValue);
          globalThis.addEventListener('storage', h);
          return () => globalThis.removeEventListener('storage', h);
        },
      }));
    }
  } catch {
    // Zugriff auf localStorage gesperrt
  }
  tabs = tabWache(kanaele.length ? kanaeleVereint(kanaele) : null, id, (n) => (andereTabs.value = n));
  globalThis.addEventListener?.('pagehide', () => tabs?.setze(null));
  effect(() => tabs?.setze(projekt.value?.meta.projektId ?? null));
}

export function holeSpeicher(): ProjektSpeicher<Projekt> {
  if (!speicher) throw new Error('Speicher nicht bereit');
  return speicher;
}

/** Datenstand der zuletzt geöffneten Projektdatei (meta.geaendert beim Öffnen), Grundlage des Stichtags */
const datenstand = signal('');

/**
 * Rückfrage vor dem Ersetzen des offenen Projekts bei ungesicherten Änderungen. Der Zwischenstand wird in jedem Fall sofort
 * geschrieben (ProjektSpeicher.neu, oeffnen): Bei «OK» bleibt er auf der Startseite wiederherstellbar.
 */
export async function wechselErlaubt(): Promise<boolean> {
  if (!projekt.value || !ungespeichert.value || beispielUnveraendert.value) return true;
  return bestaetigen({ titel: t('bestaetigen.titel_wechseln', { name: projekt.value.organisation.name || t('kopf.ohne_name') }), text: t('start.wechsel_frage', { name: projekt.value.organisation.name || t('kopf.ohne_name') }), ja: t('bestaetigen.wechseln') });
}

export function neuesProjekt(o: { sprache: Sprache; mitIsms: boolean; modulAiAct: boolean; ismsAntwort?: string }): void {
  const p = leeresProjekt({ sprache: o.sprache, mitIsms: o.mitIsms, modulAiAct: o.modulAiAct });
  if (o.ismsAntwort) p.meta.gefuehrt.antworten['isms'] = o.ismsAntwort;
  // Eine Wahl, überall gleich: Einstellungen, E0 und Bericht lesen dieses Feld (C2-11)
  p.meta.ismsZertifiziert = o.ismsAntwort === 'zertifiziert';
  datenstand.value = '';
  migrationsSicherung.value = null;
  zustand.laden(p, true);
  holeSpeicher().neu(p);
  navigiere({ art: 'gefuehrt', etappe: 'E0' });
}

export function projektUebernehmen(p: Projekt, ungespeichertNeu: boolean): void {
  // Ein anderes Projekt wird übernommen: das Sicherungsangebot einer früheren Migration gehört nicht dazu (AF-004)
  migrationsSicherung.value = null;
  datenstand.value = p.meta.geaendert?.slice(0, 10) ?? '';
  zustand.laden(p, ungespeichertNeu);
}

/** Hinweis zum Browserspeicher gelesen: erscheint nicht wieder (AF-032) */
export function speicherHinweisBestaetigen(): void {
  lokalSchreiben(HINWEIS_SCHLUESSEL, 'ja');
  speicherHinweis.value = false;
}

/**
 * Browserspeicher leeren (AF-032): alle Zwischenstände mit Projekt und Logo und das Normpaket; `behalte` ist die Kennung eines
 * Projekts, dessen Zwischenstand bleibt. Die Projektdatei und die Dateien der Bibliothek im Browser bleiben unberührt.
 */
export async function browserspeicherLeeren(behalte?: string): Promise<LeerenErgebnis> {
  const r = await leereBrowserspeicher({ zwischen: holeSpeicher().zwischenspeicher, normpaket: await normAblage(), ...(behalte !== undefined ? { behalte } : {}) });
  normpaket.value = leeresNormpaket();
  return r;
}

export async function zwischenstaende(): Promise<Zwischenstand[]> {
  return speicher ? speicher.zwischenstaende() : [];
}

// ---------- Route ----------
export const route = signal<Route>(parseRoute(globalThis.location?.hash ?? ''));
export function navigiere(r: Route): void {
  const h = routeZuHash(r);
  if (globalThis.location.hash !== h) globalThis.location.hash = h;
  route.value = r;
}
globalThis.addEventListener?.('hashchange', () => {
  route.value = parseRoute(globalThis.location.hash);
});

// ---------- Theme ----------
// Ab rc.10 (Designpaket «AIMS Nachtblau») ist dunkel der Standard. Eine bisher gewählte Darstellung bleibt (Schlüssel «theme»:
// hell, dunkel oder system); ohne Wahl gilt dunkel.
export type Theme = 'hell' | 'dunkel' | 'system';
export function themeAusGemerkt(gemerkt: string | null): Theme {
  return gemerkt === 'hell' || gemerkt === 'dunkel' || gemerkt === 'system' ? gemerkt : 'dunkel';
}
export const theme = signal<Theme>(themeAusGemerkt(lokalLesen('theme')));
export function setzeTheme(t: Theme): void {
  theme.value = t;
  lokalSchreiben('theme', t);
  wendeThemeAn();
}
export function wendeThemeAn(): void {
  const el = document.documentElement;
  if (theme.value === 'system') delete el.dataset['theme'];
  else el.dataset['theme'] = theme.value;
}

// ---------- Meldungen (aria-live) ----------
export const meldung = signal<{ text: string; art: 'ok' | 'fehler' | 'info' } | null>(null);
let meldungsTimer: ReturnType<typeof setTimeout> | undefined;
let meldungSeit = 0;
export function melde(text: string, art: 'ok' | 'fehler' | 'info' = 'info', dauerMs = 6000): void {
  meldung.value = { text, art };
  meldungSeit = Date.now();
  clearTimeout(meldungsTimer);
  meldungsTimer = setTimeout(() => (meldung.value = null), dauerMs);
}
// Seitenwechsel blendet Meldungen aus (Fehler bleiben); ausser der Wechsel gehört zur Handlung, die gemeldet hat
globalThis.addEventListener?.('hashchange', () => {
  if (meldung.value && meldung.value.art !== 'fehler' && Date.now() - meldungSeit > 1000) {
    clearTimeout(meldungsTimer);
    meldung.value = null;
  }
});

// ---------- Abgeleitet ----------
// befundeJeSeite (AF-139): «erledigt» im Guide heisst, die Prüfung hat zur Seite nichts zu melden. Für ein anderes Projekt als das
// geöffnete (Vergleiche) wird die Prüfung eigens gerechnet.
export const umfeld = computed<Umfeld>(() => {
  const gefuehrt = appDaten().gefuehrt;
  return {
    gefuehrt, controlIds42001: controlIds42001(), euaia: euaiaControls(), rmf: rmfControls(), heute: (q) => (q === projekt.value ? stichtag.value : stichtagVon(q)),
    befundeJeSeite: (p) => befundeJeSeite(p === projekt.value ? befunde.value : pruefe(p, appDaten().regeln.regeln, controlIds42001(), aiActStand(), stichtagVon(p), appDaten().kataloge), p, gefuehrt),
  };
});
export const heute = () => new Date().toISOString().slice(0, 10);
/**
 * Stichtag des Lagebilds: heute; liegt der Stand der Projektdatei (meta.geaendert) in der Zukunft, wie bei den Beispielen
 * mit Datenstand vor Stage 1, dieser Stand. Sonst blieben Messwerte und Fälligkeiten des Beispiels unsichtbar.
 */
export const stichtagVon = (p: Pick<Projekt, 'meta'>): string => {
  const stand = p.meta.geaendert?.slice(0, 10) ?? '';
  const h = heute();
  return stand > h ? stand : h;
};
/**
 * Ein Stichtag für alle Ansichten (Nutzertest rc.10, U-01): Lagebild, Fällig, Prozesse, Guide-Überblick, Fahrplan,
 * Prüfregeln, Stage-1-Bericht und Bibliothek rechnen mit demselben Datum. Schreibende Aktionen (erfasst am, Version vom)
 * verwenden weiterhin heute().
 */
export const stichtag = computed(() => {
  const p = projekt.value;
  if (!p) return heute();
  // Datenstand beim Öffnen (projektUebernehmen): eine Änderung am Beispiel setzt meta.geaendert auf jetzt, der Stichtag bleibt
  const stand = datenstand.value || stichtagVon(p);
  const h = heute();
  return stand > h ? stand : h;
});
/** Stichtag weicht von heute ab (Beispiel mit Datenstand in der Zukunft): der Kopf zeigt ihn an */
export const stichtagAbweichend = computed(() => stichtag.value !== heute());
export const befunde = computed(() => (projekt.value ? pruefe(projekt.value, appDaten().regeln.regeln, controlIds42001(), aiActStand(), stichtag.value, appDaten().kataloge) : []));
/** Fehler jetzt und aus Etappen, die noch kommen (logik/fehler-dosiert.ts, U-07) */
/** Bereitschaft für Stage 1: alle Fehler und Lücken, ohne Dosierung (C-01); nur bei Bedarf berechnet */
export const bereitschaftStand = computed<Bereitschaft | null>(() => (projekt.value ? bereitschaftBerechnen(projekt.value, umfeld.value, befunde.value, ohneFreigabeIds(projekt.value, appDaten().kataloge, stichtag.value)) : null));
export const fehlerStand = computed<FehlerDosiert>(() => (projekt.value ? fehlerDosiert(projekt.value, umfeld.value, befunde.value) : { jetzt: [], spaeter: [], hinweise: [] }));
