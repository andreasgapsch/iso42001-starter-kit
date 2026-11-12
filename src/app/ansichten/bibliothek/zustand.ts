// Zustand und Abläufe der Bibliothek im Browser: Verbindung (Ordner oder Browserspeicher), Hochladen, Einchecken,
// Herunterladen, Abgleich, bibliothek.json, Sicherung als ZIP, Firmendokumente aus dem Generator.
import { signal } from '@preact/signals';
import { abgleichen as abgleichLauf, gleicherAbgleich, zusammenfassen, type AbgleichBefund, type DateiStand } from '../../../bibliothek/abgleich.ts';
import { berechtigung, DateiZuGrossFehler, OrdnerAblage, registerLesen, SchluesselAblage, SPEICHER_MAX_BYTES, type BibliothekAblage, type OrdnerGriff } from '../../../bibliothek/ablage.ts';
import { ablageText, ablageVonBibliothek, aufraeumen, aussenAenderungUebernehmen, einrichten, naechsteKennung, versionHinzufuegen, zeitNachfuehren } from '../../../bibliothek/aenderungen.ts';
import { endungVon, mimeVon, nameBegrenzt, REGISTER_DATEI, titelAusName, versionPfad } from '../../../bibliothek/layout.ts';
import type { BibliothekArt, BibliothekVersion } from '../../../bibliothek/modell.ts';
import { sha256, sha256Datei } from '../../../bibliothek/pruefsumme.ts';
import { SICHERUNG_MAX_BYTES } from '../../../bibliothek/sicherung.ts';
import { registerDatei, registerParsen, registerUebernehmen, type RegisterDatei } from '../../../bibliothek/register-datei.ts';
import { registerProbe, registerPruefen } from '../../import/register-pruefen.ts';
import { freigabeStand, naechsteVersion, neuesteVersion, sichtEintraege, vergleicheVersion, type SichtEintrag, type SichtUmfeld } from '../../../bibliothek/sicht.ts';
import type { Projekt } from '../../../model/typen.ts';
import { appDaten } from '../../daten.ts';
import { datumText, dokumentTitelUi, inhalt, t, uiSprache } from '../../i18n.ts';
import { dokumentImModul } from '../../logik/nistrmf.ts';
import { bibliothekErzeugen, bibliothekFreigabeDatei, herunterladen, vorlageErzeugen, zipEntpacken, zipPacken } from '../../worker/client.ts';
import { fehlerVerstaendlich, KlartextFehler } from '../../worker/fehlertext.ts';
import { liesBegrenzt } from '../../../eingang/lesen.ts';
import { aendereMit, heute, melde, nurLesen, projekt } from '../../zustand/store.ts';
import { griffLesen, griffMerken, idbDateien } from './idb.ts';
import { bestaetigen } from '../../zustand/bestaetigen.ts';

/** Text der Bibliothek (bibliothek.* in src/i18n/<sprache>/bibliothek.yaml) */
export const bt = (k: string, w?: Record<string, string | number>): string => inhalt(`bibliothek.${k}`, w) ?? k;

export type Verbindung = 'keine' | 'ordner' | 'freigabe' | 'browser';
export const verbindung = signal<Verbindung>('keine');
export const ablage = signal<BibliothekAblage | null>(null);
export const befunde = signal<AbgleichBefund[]>([]);
/** Laufende Aktion (sperrt Knöpfe, Anzeige im Statusbereich) */
export const arbeit = signal<string | null>(null);
let wartend: OrdnerGriff | null = null;
let fuerProjekt: string | null = null;

interface FsaFenster {
  showDirectoryPicker?: (o?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<OrdnerGriff>;
}

/** Ordnerzugriff möglich (Edge, Chrome; sicherer Kontext, kein fremdes iframe) */
export function ordnerMoeglich(): boolean {
  const g = globalThis as unknown as FsaFenster & { isSecureContext?: boolean; top?: unknown; self?: unknown };
  return typeof g.showDirectoryPicker === 'function' && g.isSecureContext !== false && g.top === g.self;
}

// ---------- Sicht ----------

function rechtstexte(): SichtUmfeld['rechtstexte'] {
  const k = appDaten().kataloge as unknown as Record<string, unknown>;
  const ordner = k['kitOrdner'] as { rechtstexte?: string; rechtstexte_nist?: string } | undefined;
  const aiact = `../${ordner?.rechtstexte ?? 'Rechtstexte_Legal-Texts/EU-AI-Act'}`;
  const nist = `../${ordner?.rechtstexte_nist ?? 'Rechtstexte_Legal-Texts/NIST-AI-RMF'}`;
  const liste: { id: string; titel: string; pfad: string }[] = [];
  const quelle = (k['artikelSeiten'] as { quelle?: Record<string, string> } | undefined)?.quelle ?? {};
  const stand = (k['aiact_stand'] as { fassung?: { datum?: string; aenderungen?: { rechtsakt: string; kurzname?: string; datei?: Record<string, string> }[] } } | undefined)?.fassung;
  for (const s of ['de', 'en'] as const) if (quelle[s]) liste.push({ id: '', titel: bt('recht.aiact', { datum: datumText(stand?.datum), sprache: s.toUpperCase() }), pfad: `${aiact}/${quelle[s]}` });
  for (const a of stand?.aenderungen ?? []) for (const s of ['de', 'en'] as const) if (a.datei?.[s]) liste.push({ id: '', titel: `${a.rechtsakt}${a.kurzname ? `, ${a.kurzname}` : ''} (${s.toUpperCase()})`, pfad: `${aiact}/${a.datei[s]}` });
  const nistDateien = (k['nistrmf_stand'] as { pdf_pruefung?: { dateien?: { datei: string }[] } } | undefined)?.pdf_pruefung?.dateien ?? [];
  for (const d of nistDateien) liste.push({ id: '', titel: d.datei.replace(/\.pdf$/i, '').replace(/_/g, ' '), pfad: `${nist}/${d.datei}` });
  return liste.map((x, i) => ({ ...x, id: `RT-${String(i + 1).padStart(2, '0')}` }));
}

let umfeldCache: { sprache: string; umfeld: SichtUmfeld } | null = null;
export function umfeld(p: Projekt): SichtUmfeld {
  const sprache = uiSprache.value;
  if (!umfeldCache || umfeldCache.sprache !== sprache) {
    const katalog = appDaten().kataloge.dokumente.dokumente;
    umfeldCache = { sprache, umfeld: { katalog, titel: dokumentTitelUi, vorlageTitel: dokumentTitelUi, rechtstexte: rechtstexte() } };
  }
  const katalog = appDaten().kataloge.dokumente.dokumente;
  return { ...umfeldCache.umfeld, vorlageSichtbar: (id) => { const d = katalog.find((x) => x.id === id); return !!d && dokumentImModul(d, p) && (d.ordner !== 'integration' || p.meta.mitIsms); } };
}

export const sicht = (p: Projekt): SichtEintrag[] => sichtEintraege(p, umfeld(p));

// ---------- Verbindung ----------

function ordnerSetzen(g: OrdnerGriff): void {
  ablage.value = new OrdnerAblage(g);
  verbindung.value = 'ordner';
  wartend = null;
}

/** Beim Öffnen der Bibliothek und nach einem Projektwechsel: gemerkte Verbindung wiederherstellen */
export async function verbindungPruefen(p: Projekt): Promise<void> {
  if (fuerProjekt === p.meta.projektId) return;
  fuerProjekt = p.meta.projektId;
  ablage.value = null;
  verbindung.value = 'keine';
  befunde.value = [];
  wartend = null;
  const b = p.bibliothek;
  if (!b?.ablage) return;
  if (b.ablage === 'browser') {
    ablage.value = new SchluesselAblage(idbDateien, p.meta.projektId, bt('verbindung.browser_name'));
    verbindung.value = 'browser';
    // Anderer Browser oder geleerter Speicher: Die Dateien fehlen hier, das Register sagt das Gegenteil. Sofort melden (C2-10)
    void abgleichen(false);
    return;
  }
  if (!ordnerMoeglich()) return;
  const g = await griffLesen(p.meta.projektId);
  if (!g || fuerProjekt !== p.meta.projektId) return;
  try {
    if ((await berechtigung(g, false)) === 'granted') {
      ordnerSetzen(g);
      void abgleichen(false);
    } else {
      wartend = g;
      verbindung.value = 'freigabe';
    }
  } catch {
    /* Handle ungültig (Ordner gelöscht): neu verbinden */
  }
}

/**
 * Datei aus einer neueren Version nur lesend geöffnet (AF-005): Die Bibliothek schreibt nichts, weder Dateien in den Ordner oder
 * Browserspeicher noch bibliothek.json noch Ordner-Merker. Meldet das und liefert true; `still` unterdrückt die Meldung
 * (Nachführen des Registers im Hintergrund).
 */
export function schreibGesperrt(still = false): boolean {
  if (!nurLesen.value) return false;
  if (!still) melde(t('laden.nur_lesen_bibliothek'), 'info', 15_000);
  return true;
}

/** Wie laufen, aber nur, wenn gerade nichts läuft: ein Doppelklick auf einen Download ergibt eine Datei (Prüfung Dokumente und Download) */
async function laufenEinmal<T>(text: string, f: () => Promise<T>): Promise<T | undefined> {
  if (arbeit.value) return undefined;
  return laufen(text, f);
}

async function laufen<T>(text: string, f: () => Promise<T>): Promise<T | undefined> {
  arbeit.value = text;
  try {
    const r = await f();
    // Register im Ordner gleich nachführen, wenn die Aktion etwas geändert hat
    if (schreibenOffen) await registerSchreiben();
    return r;
  } catch (e) {
    if ((e as { name?: string }).name !== 'AbortError') melde(`${bt('fehler.allgemein')}: ${fehlerVerstaendlich(e)}`, 'fehler');
    return undefined;
  } finally {
    arbeit.value = null;
  }
}

/** Ordner wählen (Edge, Chrome), Register aus dem Ordner übernehmen, Dateien aus dem Browserspeicher mitnehmen */
export async function ordnerVerbinden(): Promise<void> {
  const p = projekt.value;
  const g = globalThis as unknown as FsaFenster;
  if (!p || !g.showDirectoryPicker || schreibGesperrt()) return;
  // Dialog direkt aus dem Klick öffnen (Benutzeraktivierung)
  let griff: OrdnerGriff;
  try {
    griff = await g.showDirectoryPicker({ id: 'aims-bibliothek', mode: 'readwrite' });
  } catch (e) {
    if ((e as { name?: string }).name !== 'AbortError') melde(`${bt('fehler.ordner')}: ${fehlerVerstaendlich(e)}`, 'fehler');
    return;
  }
  await laufen(bt('arbeit.verbinden'), async () => {
    if ((await berechtigung(griff, true)) !== 'granted') throw new KlartextFehler(bt('fehler.berechtigung'));
    const vorher = verbindung.value === 'browser' ? ablage.value : null;
    const neu = new OrdnerAblage(griff);
    // Dateien aus dem Browserspeicher in den Ordner übernehmen (gleiches Layout)
    // Nie überschreiben: Weicht die Datei im Ordner ab, bleibt sie, und der Stand aus dem Browser liegt als Kopie daneben
    let kopiert = 0;
    let abweichend = 0;
    if (vorher) for (const d of await vorher.liste()) {
      const daten = await vorher.lesen(d.pfad);
      const da = await bestandSumme(neu, d.pfad);
      if (da === null) await neu.schreiben(d.pfad, daten);
      else if (da !== (await sha256(daten))) {
        await neu.schreiben(await kopiePfad(neu, d.pfad, 'browser'), daten);
        abweichend++;
      }
      kopiert++;
    }
    // bibliothek.json kommt von aussen: gleiche Prüfung wie bei der Sicherung; ohne Zustimmung nichts aus einem fremden Projekt
    const register = await registerFuerUebernahme(p, registerParsen((await registerLesen(neu)) ?? ''));
    let uebernommen = 0;
    aendereMit((e) => {
      einrichten(e, 'ordner', griff.name);
      if (register) uebernommen = registerUebernehmen(e, register).versionen;
    });
    await griffMerken(p.meta.projektId, griff);
    ordnerSetzen(griff);
    fuerProjekt = p.meta.projektId;
    await registerSchreiben();
    if (abweichend) melde(`${bt('meldung.verbunden', { name: griff.name, kopiert, uebernommen })} ${bt('meldung.verbunden_abweichend', { anzahl: abweichend })}`, 'fehler', 30_000);
    else melde(bt('meldung.verbunden', { name: griff.name, kopiert, uebernommen }), 'ok');
    await abgleichen(false);
  });
}

/**
 * Register aus einem Ordner oder einer Sicherung prüfen. Ungültige Einträge werden gemeldet und nicht übernommen. Register
 * eines anderen Projekts nur nach Rückfrage. Null: nichts übernehmen.
 */
async function registerFuerUebernahme(p: Projekt, d: RegisterDatei | null): Promise<RegisterDatei | null> {
  if (!d) return null;
  const g = registerPruefen(p, d);
  if (g.fremdesProjekt && !(await bestaetigen({ text: bt('frage.fremdes_projekt', { name: d.organisation || bt('frage.unbenannt') }), titel: t('bestaetigen.titel_register_uebernehmen'), ja: t('bestaetigen.register_uebernehmen') }))) return null;
  if (g.abgelehnt.length) melde(bt('meldung.register_abgelehnt', { anzahl: g.abgelehnt.length, ids: g.abgelehnt.slice(0, 5).map((a) => a.id).join(', ') }), 'fehler');
  const probe = registerProbe(p, g.register);
  if (!probe.ok) throw new Error(`${bt('fehler.register_ungueltig')}\n${probe.details.join('\n')}`);
  return g.register;
}

/** Gemerkten Ordner nach dem Neuladen mit einem Klick wieder freigeben */
export async function ordnerFreigeben(): Promise<void> {
  const g = wartend;
  if (!g || schreibGesperrt()) return;
  await laufen(bt('arbeit.verbinden'), async () => {
    if ((await berechtigung(g, true)) !== 'granted') throw new KlartextFehler(bt('fehler.berechtigung'));
    ordnerSetzen(g);
    await abgleichen(false);
  });
}

export async function trennen(): Promise<void> {
  if (schreibGesperrt()) return;
  const p = projekt.value;
  if (p) await griffMerken(p.meta.projektId, null);
  ablage.value = null;
  verbindung.value = 'keine';
  befunde.value = [];
  wartend = null;
  melde(bt('meldung.getrennt'), 'info');
}

/** Firefox und Safari (oder auf Wunsch): Dateien im Browserspeicher */
export function browserNutzen(): void {
  const p = projekt.value;
  if (!p || schreibGesperrt()) return;
  aendereMit((e) => void einrichten(e, 'browser'));
  ablage.value = new SchluesselAblage(idbDateien, p.meta.projektId, bt('verbindung.browser_name'));
  verbindung.value = 'browser';
  fuerProjekt = p.meta.projektId;
  melde(bt('meldung.browser'), 'info');
}

// ---------- Register im Ordner ----------

let schreibTimer: ReturnType<typeof setTimeout> | undefined;
let schreibenOffen = false;
/** bibliothek.json im Ordner nachführen (nur Ordner; im Browserspeicher entsteht es mit der Sicherung) */
export async function registerSchreiben(sofort = true): Promise<void> {
  clearTimeout(schreibTimer);
  if (schreibGesperrt(true)) return;
  schreibenOffen = !sofort;
  const lauf = async () => {
    schreibenOffen = false;
    const a = ablage.value;
    const p = projekt.value;
    if (!a || a.art !== 'ordner' || !p) return;
    try {
      await a.schreiben(REGISTER_DATEI, new TextEncoder().encode(registerDatei(p, sicht(p), new Date().toISOString())));
    } catch {
      // Ordner nicht beschreibbar: Die Projektdatei bleibt die Quelle, aber das Register im Ordner ist dann alt
      melde(bt('fehler.register_schreiben'), 'fehler');
    }
  };
  if (sofort) await lauf();
  else schreibTimer = setTimeout(() => void lauf(), 800);
}

/** Änderung am Projekt und danach Register im Ordner (verzögert) */
export function aendern(f: (p: Projekt) => void): void {
  if (schreibGesperrt()) return;
  aendereMit((e) => {
    f(e);
    aufraeumen(e);
  });
  void registerSchreiben(false);
}

// ---------- Dateien ----------

/** Ganz in den Speicher laden: nur bis zur Grenze, grössere Dateien brächen die Seite ab */
async function bytes(f: File): Promise<Uint8Array> {
  if (f.size > SPEICHER_MAX_BYTES) throw new KlartextFehler(bt('fehler.datei_gross', { name: f.name, mb: Math.round(SPEICHER_MAX_BYTES / 1048576) }));
  return liesBegrenzt(f, 'bibliotheksdatei');
}

/** Inhalt zum Ablegen: Der Ordner schreibt strömend, ohne Grenze; der Browserspeicher braucht die Datei im Speicher (E2-10) */
async function quelleVon(a: BibliothekAblage | null, f: File): Promise<Uint8Array | Blob> {
  if (!a) throw new KlartextFehler(bt('fehler.keine_ablage'));
  return a.schreibenStrom ? f : bytes(f);
}

/** Datei ohne Laden, wo die Ablage das kann */
const inhaltVon = (a: BibliothekAblage, pfad: string): Promise<Uint8Array | Blob> => (a.blob ? a.blob(pfad) : a.lesen(pfad));

const summeVon = (d: Uint8Array | Blob): Promise<string> => (d instanceof Uint8Array ? sha256(d) : sha256Datei(d));

const groesseVon = (d: Uint8Array | Blob): number => (d instanceof Uint8Array ? d.byteLength : d.size);

async function schreibeInhalt(a: BibliothekAblage, pfad: string, d: Uint8Array | Blob): Promise<DateiStand> {
  if (d instanceof Uint8Array) return a.schreiben(pfad, d);
  if (!a.schreibenStrom) throw new KlartextFehler(bt('fehler.keine_ablage'));
  return a.schreibenStrom(pfad, d);
}

/** Prüfsumme einer vorhandenen Datei, null wenn sie fehlt */
async function bestandSumme(a: BibliothekAblage, pfad: string): Promise<string | null> {
  try {
    return await summeVon(await inhaltVon(a, pfad));
  } catch (e) {
    if ((e as { name?: string }).name === 'NotFoundError') return null;
    throw e;
  }
}

/** Pfad einer Sicherheitskopie neben der Datei, ohne Bestehendes zu treffen */
async function kopiePfad(a: BibliothekAblage, pfad: string, zusatz: string): Promise<string> {
  const punkt = pfad.lastIndexOf('.');
  const [basis, endung] = punkt > pfad.lastIndexOf('/') ? [pfad.slice(0, punkt), pfad.slice(punkt)] : [pfad, ''];
  for (let i = 1; ; i++) {
    const p = `${basis}.${zusatz}${i === 1 ? '' : `-${i}`}${endung}`;
    if ((await bestandSumme(a, p)) === null) return p;
  }
}

/** Datei als neue Version ablegen (schreibt die Datei, legt die Version im Projekt an) */
async function ablegen(id: string, art: BibliothekArt, titel: string, v: string, daten: Uint8Array | Blob, name: string, extra: Partial<BibliothekVersion> & { nachweisArt?: 'dokument' } = {}): Promise<void> {
  const a = ablage.value;
  if (!a) throw new KlartextFehler(bt('fehler.keine_ablage'));
  // Weitere Versionen im Ordner der ersten (Titel und Sprache der Oberfläche können sich ändern)
  const bisher = projekt.value?.bibliothek?.eintraege.find((x) => x.id === id);
  const erste = bisher?.versionen[0]?.datei;
  const pfad = erste ? `${erste.slice(0, erste.lastIndexOf('/'))}/v${v}.${endungVon(name)}` : versionPfad(art, id, titel, v, endungVon(name));
  const stand = await schreibeInhalt(a, pfad, daten);
  const version: BibliothekVersion = { version: v, datei: pfad, name: nameBegrenzt(name), groesse: stand.groesse, pruefsumme: await summeVon(daten), datum: new Date().toISOString(), geaendert: stand.geaendert, ...extra };
  // Titel von Firmendokumenten kommt aus dem Katalog (Sprache der Oberfläche); nur abweichende Titel speichern
  const eigenerTitel = art === 'firmendokument' && titel === dokumentTitelUi(id) ? undefined : titel;
  aendern((e) => void versionHinzufuegen(e, id, art, version, { ...(eigenerTitel ? { titel: eigenerTitel } : {}), heute: heute() }));
}

/** Hochladen (Dateiauswahl oder Drag-and-drop): je Datei ein neuer Eintrag (eigene Datei oder Nachweis) */
export async function hochladen(dateien: readonly File[], art: 'eigene' | 'nachweis'): Promise<string | undefined> {
  if (!dateien.length || schreibGesperrt()) return;
  return laufen(bt('arbeit.hochladen'), async () => {
    let letzte: string | undefined;
    for (const f of dateien) {
      const p = projekt.value!;
      const id = naechsteKennung(p, art === 'nachweis' ? 'N' : 'X');
      await ablegen(id, art, titelAusName(f.name), naechsteVersion(art, undefined, art === 'eigene'), await quelleVon(ablage.value, f), f.name, { quelle: 'hochgeladen' });
      letzte = id;
    }
    melde(bt('meldung.hochgeladen', { anzahl: dateien.length }), 'ok');
    return letzte;
  });
}

/** Neue Version einchecken (Datei gewählt) */
export async function einchecken(e: SichtEintrag, f: File, haupt: boolean): Promise<void> {
  if (schreibGesperrt()) return;
  await laufen(bt('arbeit.einchecken'), async () => {
    const kandidaten = [e.version, neuesteVersion(e.versionen)?.version].filter((x): x is string => !!x).sort(vergleicheVersion);
    const v = naechsteVersion(e.art, kandidaten.at(-1), haupt);
    await ablegen(e.id, e.art, e.titel, v, await quelleVon(ablage.value, f), f.name, { quelle: 'eingecheckt' });
    melde(bt('meldung.eingecheckt', { id: e.id, version: v }), 'ok');
  });
}

export function dateiname(e: SichtEintrag, v: { version: string; datei: string }): string {
  return `${e.id}_${e.titel.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-').slice(0, 60)}_v${v.version}.${endungVon(v.datei)}`;
}

export async function lesen(pfad: string): Promise<Uint8Array> {
  const a = ablage.value;
  if (!a) throw new KlartextFehler(bt('fehler.keine_ablage'));
  try {
    return await a.lesen(pfad);
  } catch (e) {
    if ((e as { name?: string }).name === 'NotFoundError') throw new KlartextFehler(bt(a.art === 'browser' ? 'fehler.datei_fehlt_browser' : 'fehler.datei_fehlt_ordner', { pfad }));
    if (e instanceof DateiZuGrossFehler) throw new KlartextFehler(bt('fehler.datei_gross_lesen', { name: pfad.split('/').at(-1)!, mb: Math.round(SPEICHER_MAX_BYTES / 1048576) }));
    throw e;
  }
}

export async function herunterladenVersion(e: SichtEintrag, v: { version: string; datei: string }): Promise<void> {
  await laufenEinmal(bt('arbeit.lesen'), async () => {
    const name = dateiname(e, v);
    const a = ablage.value;
    // Aus dem Ordner ohne Laden: auch grosse Dateien (E2-10)
    herunterladen(a?.blob ? await a.blob(v.datei) : await lesen(v.datei), name, mimeVon(name));
  });
}

export async function vorlageHerunterladen(katalogId: string): Promise<void> {
  await laufenEinmal(bt('arbeit.vorlage'), async () => {
    const r = await vorlageErzeugen(katalogId, uiSprache.value);
    herunterladen(r.daten, r.name, mimeVon(r.name));
  });
}

// ---------- Abgleich ----------

/** Ordner mit dem Register abgleichen; gleiche Prüfsumme bei neuer Zeit wird still nachgeführt */
export async function abgleichen(mitMeldung = true): Promise<void> {
  const a = ablage.value;
  const p = projekt.value;
  if (!a || !p?.bibliothek) return;
  await laufen(bt('arbeit.abgleich'), async () => {
    const r = await abgleichLauf(p.bibliothek!.eintraege, await a.liste(), async (pfad) => summeVon(await inhaltVon(a, pfad)));
    const zeit = r.filter((b) => b.art === 'zeit');
    const zusammen = zusammenfassen(r, new Date().toISOString());
    const alt = projekt.value?.bibliothek?.abgleich;
    if (zeit.length || !gleicherAbgleich(alt, zusammen)) {
      aendereMit((e) => {
        for (const b of zeit) zeitNachfuehren(e, b.pfad, b.geaendert!);
        if (e.bibliothek && !gleicherAbgleich(e.bibliothek.abgleich, zusammen)) e.bibliothek.abgleich = zusammen;
      });
    }
    befunde.value = r.filter((b) => b.art !== 'zeit');
    if (mitMeldung) melde(befunde.value.length ? bt('meldung.abgleich_befunde', { anzahl: befunde.value.length }) : bt('meldung.abgleich_ok'), befunde.value.length ? 'info' : 'ok');
  });
}

/** Ausserhalb geänderte Datei übernehmen: Entwurf direkt, sonst als neue Version */
export async function aussenUebernehmen(b: AbgleichBefund): Promise<void> {
  const a = ablage.value;
  const p = projekt.value;
  if (!a || !p || !b.id || schreibGesperrt()) return;
  await laufen(bt('arbeit.einchecken'), async () => {
    const daten = await inhaltVon(a, b.pfad);
    const stand = { pruefsumme: await summeVon(daten), groesse: groesseVon(daten), geaendert: b.geaendert ?? Date.now() };
    const e = sicht(p).find((x) => x.id === b.id)!;
    let ergebnis: string | null = null;
    aendern((x) => void (ergebnis = aussenAenderungUebernehmen(x, b.id!, b.pfad, stand)));
    if (!ergebnis) {
      const v = naechsteVersion(e.art, neuesteVersion(e.versionen)?.version ?? e.version);
      const pfad = `${b.pfad.slice(0, b.pfad.lastIndexOf('/'))}/v${v}.${endungVon(b.pfad)}`;
      const neu = await schreibeInhalt(a, pfad, daten);
      aendern((x) => void aussenAenderungUebernehmen(x, b.id!, b.pfad, stand, { version: v, datei: pfad, name: b.pfad.split('/').at(-1)!, groesse: neu.groesse, pruefsumme: stand.pruefsumme, datum: new Date().toISOString(), geaendert: neu.geaendert, quelle: 'ordner' }));
    }
    await abgleichen(false);
    melde(bt('meldung.uebernommen', { id: b.id! }), 'ok');
  });
}

/** Neue Datei im Ordner als Eintrag aufnehmen (an ihrem Ort, ohne Kopie) */
export async function neueAufnehmen(b: AbgleichBefund, art: 'eigene' | 'nachweis'): Promise<void> {
  const a = ablage.value;
  if (!a || schreibGesperrt()) return;
  await laufen(bt('arbeit.hochladen'), async () => {
    const daten = await inhaltVon(a, b.pfad);
    const p = projekt.value!;
    const id = naechsteKennung(p, art === 'nachweis' ? 'N' : 'X');
    const name = b.pfad.split('/').at(-1)!;
    const v: BibliothekVersion = { version: naechsteVersion(art, undefined, art === 'eigene'), datei: b.pfad, name: nameBegrenzt(name), groesse: groesseVon(daten), pruefsumme: await summeVon(daten), datum: new Date().toISOString(), geaendert: b.geaendert ?? 0, quelle: 'ordner' };
    aendern((e) => void versionHinzufuegen(e, id, art, v, { titel: titelAusName(name), heute: heute() }));
    befunde.value = befunde.value.filter((x) => x !== b);
    melde(bt('meldung.aufgenommen', { id }), 'ok');
  });
}

// ---------- Sicherung (Browserspeicher) ----------

export async function sichern(): Promise<void> {
  const a = ablage.value;
  const p = projekt.value;
  if (!a || !p) return;
  await laufenEinmal(bt('arbeit.sichern'), async () => {
    const dateien = [];
    const liste = await a.liste();
    // Die Sicherung entsteht im Speicher: Zu grosse Bestände vor dem Lesen melden, nicht erst beim Abbruch der Seite (E2-10)
    if (liste.reduce((s, d) => s + d.groesse, 0) > SICHERUNG_MAX_BYTES) throw new KlartextFehler(bt('fehler.sicherung_bestand_gross'));
    for (const d of liste) if (d.pfad !== REGISTER_DATEI) dateien.push({ pfad: d.pfad, daten: await a.lesen(d.pfad) });
    const zip = await zipPacken(dateien, registerDatei(p, sicht(p), new Date().toISOString()));
    const name = `Bibliothek_${(p.organisation.gestaltung?.kurzname || p.organisation.name || 'AIMS').replace(/[^\p{L}\p{N}-]+/gu, '-')}_${heute()}.zip`;
    herunterladen(zip, name, 'application/zip');
    aendereMit((e) => {
      if (e.bibliothek) e.bibliothek.gesichertAm = new Date().toISOString();
    });
    melde(bt('meldung.gesichert', { name, anzahl: dateien.length }), 'ok');
  });
}

/** Sicherung (ZIP) in die verbundene Ablage laden und Register übernehmen */
export async function wiederherstellen(f: File): Promise<void> {
  const a = ablage.value;
  if (!a || schreibGesperrt()) return;
  await laufen(bt('arbeit.wiederherstellen'), async () => {
    if (f.size > SICHERUNG_MAX_BYTES) throw new KlartextFehler(bt('fehler.sicherung_gross'));
    const r = await zipEntpacken(await liesBegrenzt(f, 'sicherung'));
    const roh = r.register ? registerParsen(r.register) : null;
    if (!roh) throw new KlartextFehler(bt('fehler.keine_sicherung'));
    const p = projekt.value;
    if (!p) return;
    // Vor dem ersten Schreiben prüfen: bei Absage oder ungültigem Register bleiben Ablage und Projekt unberührt
    const register = await registerFuerUebernahme(p, roh);
    if (!register) return;
    // Nur Dateien, die das Register kennt; was am selben Pfad anders aussieht, wird nur nach Rückfrage ersetzt und bleibt als Kopie
    const bekannt = new Set(register.eintraege.flatMap((x) => x.versionen.map((v) => v.datei)));
    const dateien = r.dateien.filter((d) => bekannt.has(d.pfad));
    const konflikte: { pfad: string; daten: Uint8Array }[] = [];
    for (const d of dateien) {
      const da = await bestandSumme(a, d.pfad);
      if (da !== null && da !== (await sha256(d.daten))) konflikte.push(d);
    }
    if (konflikte.length) {
      if (!(await bestaetigen({ text: bt('frage.sicherung_konflikt', { anzahl: konflikte.length, namen: konflikte.slice(0, 5).map((k) => k.pfad).join('\n') }), titel: t('bestaetigen.titel_sicherung_laden'), ja: t('bestaetigen.sicherung_laden') }))) return;
      for (const k of konflikte) await a.schreiben(await kopiePfad(a, k.pfad, 'vor-sicherung'), await a.lesen(k.pfad));
    }
    for (const d of dateien) await a.schreiben(d.pfad, d.daten);
    let n = 0;
    aendereMit((e) => void (n = registerUebernehmen(e, register).versionen));
    await abgleichen(false);
    const anzahlAbgelehnt = roh.eintraege.length - register.eintraege.length;
    const ausserhalb = r.dateien.length - dateien.length;
    if (!anzahlAbgelehnt) melde(`${bt('meldung.wiederhergestellt', { dateien: dateien.length, versionen: n })}${ausserhalb ? ` ${bt('meldung.sicherung_ausserhalb', { anzahl: ausserhalb })}` : ''}`, ausserhalb ? 'info' : 'ok', ausserhalb ? 15_000 : 6000);
  });
}

// ---------- Generator ----------

/** Firmendokumente erzeugen und als neue Versionen (Entwurf) in die Bibliothek legen */
/** Ab so vielen betroffenen freigegebenen Dokumenten fragt der Lauf zuerst */
export const LAUF_FRAGE_AB = 5;

async function laufBestaetigt(p: Projekt, ids: readonly string[]): Promise<boolean> {
  const frei = ids.filter((id) => freigabeStand(p, id).status === 'freigegeben').length;
  return frei < LAUF_FRAGE_AB || bestaetigen({ titel: t('bestaetigen.titel_entwuerfe_erzeugen', { anzahl: ids.length }), text: bt('frage.lauf_alle', { anzahl: ids.length, frei }), ja: t('bestaetigen.entwuerfe_erzeugen') });
}

export async function firmendokumenteAblegen(ids?: string[]): Promise<void> {
  const p = projekt.value;
  const a = ablage.value;
  if (!p || !a || schreibGesperrt()) return;
  await laufen(bt('arbeit.erzeugen'), async () => {
    const r = await bibliothekErzeugen(p, p.meta.dokumentSprache, ids);
    // Lauf über viele freigegebene Dokumente (z. B. nach einer Farbänderung): vorher sagen, was er auslöst (C2-09)
    if (!ids && !(await laufBestaetigt(p, r.dateien.map((d) => d.id)))) {
      melde(bt('meldung.lauf_abgebrochen'), 'info');
      return;
    }
    for (const d of r.dateien) {
      const titel = d.zusatz ? `${dokumentTitelUi(d.katalogId)} (${d.zusatz})` : dokumentTitelUi(d.id);
      const frei = d.freigegeben ? freigabeStand(p, d.id) : undefined;
      await ablegen(d.id, 'firmendokument', titel === d.id ? d.dateiname.replace(/\.[^.]+$/, '') : titel, d.version, d.daten, d.dateiname, { quelle: 'generator', basis: d.basis, status: d.freigegeben ? 'freigegeben' : 'entwurf', ...(frei?.freigabe ? { freigabe: frei.freigabe } : {}) });
    }
    await registerSchreiben();
    melde(bt('meldung.erzeugt', { neu: r.dateien.length, gleich: r.unveraendert.length, fehler: r.fehler.length }), r.fehler.length ? 'fehler' : 'ok');
  });
}

/**
 * Nach der Freigabe: Eine vom Generator erzeugte Datei trägt danach Version, Prüfung und Freigabe im Kopf (C-02). Sie wird neu
 * erzeugt und als Datei der freigegebenen Version abgelegt, der Entwurf entfällt. Eigene und eingecheckte Dateien bleiben Byte
 * für Byte, wie sie sind (Rückgabe «eigene»: die Angaben stehen nur im Register, die Oberfläche weist darauf hin).
 */
export async function freigabeDateiErneuern(id: string): Promise<'erneuert' | 'eigene' | 'ohne-ablage' | 'extern'> {
  if (schreibGesperrt()) return 'ohne-ablage';
  const a = ablage.value;
  const p = projekt.value;
  const v0 = p?.bibliothek?.eintraege.find((x) => x.id === id);
  const v = v0 ? neuesteVersion(v0.versionen) : undefined;
  if (!p || !v) return 'ohne-ablage';
  if (v.quelle !== 'generator') return 'eigene';
  if (!a) return 'ohne-ablage';
  // Datei im Ordner weicht vom Register ab (in Word oder Excel bearbeitet): nicht überschreiben, die Oberfläche bietet die Übernahme an
  const da = await bestandSumme(a, v.datei);
  if (da !== null && da !== v.pruefsumme) {
    await abgleichen(false);
    return 'extern';
  }
  const r = await bibliothekFreigabeDatei(p, p.meta.dokumentSprache, id);
  if (!r) return 'eigene';
  const pfad = `${v.datei.slice(0, v.datei.lastIndexOf('/'))}/v${v.version}.${endungVon(v.datei)}`;
  const stand = await a.schreiben(pfad, r.daten);
  const pruefsumme = await sha256(r.daten);
  const alt = v.datei;
  aendern((x) => {
    const e = x.bibliothek?.eintraege.find((y) => y.id === id);
    const n = e ? neuesteVersion(e.versionen) : undefined;
    if (!n || n.version !== v.version) return;
    n.datei = pfad;
    n.name = r.dateiname;
    n.groesse = stand.groesse;
    n.pruefsumme = pruefsumme;
    n.geaendert = stand.geaendert;
    n.basis = r.basis;
    const reg = x.dokumente.find((y) => y.id === id);
    if (reg && ablageVonBibliothek(reg.ablageort)) reg.ablageort = ablageText(pfad, x.meta.dokumentSprache);
  });
  if (alt !== pfad) await a.loeschen(alt).catch(() => undefined);
  await abgleichen(false);
  return 'erneuert';
}
