// Hauptthread-Seite des Generator-Workers: lazy Start, Grunddaten je Sprache, Aufträge mit Fortschritt.
import { signal } from '@preact/signals';
import type { DocxDokument, XlsxMappe } from '../../generator/ir.ts';
import type { Projekt, Sprache } from '../../model/typen.ts';
import { appDaten } from '../daten.ts';
import { t } from '../i18n.ts';
import { normtexteFuerDokumente } from '../normtexte/zustand.ts';
import type { LogoAufgabe, LogoErgebnis } from './logo.ts';
import type { Antwort, Auftrag, BibliothekDatei, DateiFehler, DrawioVorschau } from './protokoll.ts';

export type { DrawioVorschau };
import { entpackeBlock, workerAusText } from './start.ts';
import { technikText } from '../speicher/technik.ts';
import { mimeVon } from '../../bibliothek/layout.ts';
import { GRENZEN } from '../../eingang/grenzen.ts';

export const generatorFortschritt = signal<{ fertig: number; gesamt: number; datei: string } | null>(null);

type Offen = { ok: (a: Antwort) => void; fehler: (e: Error) => void; ms: number; timer: ReturnType<typeof setTimeout> | undefined };

/** Zeitgrenze abgelaufen: Der Worker wurde beendet und startet beim nächsten Auftrag neu. */
export class ZeitFehler extends Error {
  constructor() {
    super(t('fehler.zeitgrenze'));
    this.name = 'ZeitFehler';
  }
}

/** Ein Auftrag «logo» trägt Bild, SVG-Logo und Word-Vorlage (logoAufgabe): die längste der drei Zeitgrenzen */
export const LOGO_ZEIT = Math.max(GRENZEN.bild.zeitMs, GRENZEN['svg-logo'].zeitMs, GRENZEN['word-vorlage'].zeitMs);
/**
 * Zeitgrenzen je Auftrag in Millisekunden. Lesen fremder Dateien darf nie den Worker blockieren; beim Erzeugen setzt jeder
 * Fortschritt die Uhr zurück, die Grenze gilt also für eine einzelne Datei.
 */
export const ZEITGRENZE: Partial<Record<Auftrag['art'], number>> = {
  // Fremde Eingaben: Zeitgrenzen aus der Konfiguration des Eingangsmoduls (AF-019)
  'zip-entpacken': GRENZEN.sicherung.zeitMs, 'zip-packen': 120_000, 'docx-text': 20_000, 'xlsx-lesen': GRENZEN.fragebogen.zeitMs, 'drawio-lesen': GRENZEN.drawio.zeitMs, logo: LOGO_ZEIT,
  set: 120_000, 'bibliothek-set': 120_000, 'bibliothek-freigabe': 60_000, ir: 60_000, render: 60_000, 'drawio-export': 60_000, fragebogen: 60_000, vorlage: 60_000, daten: 30_000,
};
const STANDARD_ZEIT = 60_000;
let worker: Worker | null = null;
const offen = new Map<number, Offen>();
const sprachenGeladen = new Set<Sprache>();
let nr = 0;

/** Worker beenden, alle offenen Aufträge mit Meldung abschliessen; der nächste Auftrag startet einen neuen Worker */
function workerAufgeben(f: Error): void {
  const w = worker;
  worker = null;
  sprachenGeladen.clear();
  for (const o of offen.values()) {
    clearTimeout(o.timer);
    o.fehler(f);
  }
  offen.clear();
  generatorFortschritt.value = null;
  w?.terminate();
}

function uhrStarten(n: number, o: Offen): void {
  clearTimeout(o.timer);
  o.timer = setTimeout(() => {
    if (offen.has(n)) workerAufgeben(new ZeitFehler());
  }, o.ms);
}

function starte(): Worker {
  if (worker) return worker;
  const code = entpackeBlock('code-generator');
  if (!code) throw new Error('Generator-Code fehlt im Werkzeug');
  const w = workerAusText(code);
  w.addEventListener('message', (e: MessageEvent<Antwort>) => {
    const a = e.data;
    if (a.art === 'fortschritt') {
      generatorFortschritt.value = { fertig: a.fertig, gesamt: a.gesamt, datei: a.datei };
      const f = offen.get(a.nr);
      if (f) uhrStarten(a.nr, f);
      return;
    }
    const o = offen.get(a.nr);
    if (!o) return;
    clearTimeout(o.timer);
    offen.delete(a.nr);
    if (a.art === 'fehler') o.fehler(new Error(a.meldung));
    else o.ok(a);
  });
  w.addEventListener('error', (e) => {
    workerAufgeben(new Error(technikText(e) || 'Generator-Worker konnte nicht starten'));
  });
  worker = w;
  return w;
}

type OhneNr<T> = T extends unknown ? Omit<T, 'nr'> : never;

function sende(a: OhneNr<Auftrag>): Promise<Antwort> {
  const w = starte();
  const n = ++nr;
  return new Promise((ok, fehler) => {
    const o: Offen = { ok, fehler, ms: ZEITGRENZE[a.art as Auftrag['art']] ?? STANDARD_ZEIT, timer: undefined };
    offen.set(n, o);
    uhrStarten(n, o);
    w.postMessage({ ...a, nr: n });
  });
}

async function vorbereiten(sprache: Sprache): Promise<void> {
  if (sprachenGeladen.has(sprache)) return;
  const d = appDaten();
  await sende({ art: 'daten', sprache, daten: { texte: d.texte[sprache], kataloge: d.kataloge, kitVersion: d.version } });
  sprachenGeladen.add(sprache);
}

export interface SetErgebnis {
  daten: Uint8Array;
  name: string;
  dateien: string[];
  fehler: { id: string; datei: string; meldung: string }[];
  ausgelassen: { id: string; grund: string }[];
  ms: number;
}

export async function erzeugeSet(projekt: Projekt, sprache: Sprache, o: { ids?: string[]; einzeln?: boolean; zipName?: string; prozessId?: string } = {}): Promise<SetErgebnis> {
  await vorbereiten(sprache);
  generatorFortschritt.value = { fertig: 0, gesamt: 0, datei: '' };
  try {
    // Normtexte der Firma nur nach der Bestätigung «Unsere Lizenz erlaubt die Übernahme in interne Dokumente»
    const normtexte = normtexteFuerDokumente();
    const a = await sende({ art: 'set', projekt, sprache, ...o, ...(normtexte ? { normtexte } : {}) });
    if (a.art !== 'set') throw new Error('Unerwartete Antwort');
    return a;
  } finally {
    generatorFortschritt.value = null;
  }
}

export async function erzeugeIr(projekt: Projekt, sprache: Sprache, id: string, kiSystemId?: string, prozessId?: string): Promise<{ ir: DocxDokument | XlsxMappe | null; fehler?: string }> {
  await vorbereiten(sprache);
  const normtexte = normtexteFuerDokumente();
  const a = await sende({ art: 'ir', projekt, sprache, id, kiSystemId, ...(prozessId ? { prozessId } : {}), ...(normtexte ? { normtexte } : {}) });
  if (a.art !== 'ir') throw new Error('Unerwartete Antwort');
  return { ir: a.ir, fehler: a.fehler };
}

/** Fragebogen für Fachbereiche (D-10) als XLSX-Bytes. */
export async function erzeugeFragebogen(projekt: Projekt, sprache: Sprache, fachbereich?: string): Promise<{ daten: Uint8Array; name: string }> {
  await vorbereiten(sprache);
  const a = await sende({ art: 'fragebogen', projekt, sprache, fachbereich });
  if (a.art !== 'datei') throw new Error('Unerwartete Antwort');
  return a;
}

/** Fertiges Zwischenformat im Worker als DOCX oder XLSX erzeugen (Musterdokument der Dokumentgestaltung). */
export async function rendereIr(ir: DocxDokument | XlsxMappe, name: string): Promise<{ daten: Uint8Array; name: string }> {
  const a = await sende({ art: 'render', ir, name });
  if (a.art !== 'datei') throw new Error('Unerwartete Antwort');
  return a;
}

/** Bildarbeit der Dokumentgestaltung im Worker (Pixel werden übertragen, nicht kopiert). */
export async function logoImWorker<A extends LogoAufgabe>(auftrag: A): Promise<Extract<LogoErgebnis, { aufgabe: A['aufgabe']; ok: true }> | Extract<LogoErgebnis, { ok: false }>> {
  const a = await sende({ art: 'logo', auftrag });
  if (a.art !== 'logo') throw new Error('Unerwartete Antwort');
  return a.ergebnis as Extract<LogoErgebnis, { aufgabe: A['aufgabe']; ok: true }> | Extract<LogoErgebnis, { ok: false }>;
}

/** XLSX-Datei im Worker lesen (Zellwerte je Blatt). */
export async function liesXlsx(daten: Uint8Array): Promise<{ name: string; zeilen: (string | number | boolean | null)[][] }[]> {
  const a = await sende({ art: 'xlsx-lesen', daten });
  if (a.art !== 'xlsx-gelesen') throw new Error('Unerwartete Antwort');
  return a.blaetter;
}

/** Prozesse als Datei für draw.io (Text, unkomprimiertes XML); ohne ids alle anwendbaren mit Landkarte */
export async function drawioExportieren(projekt: Projekt, sprache: Sprache, ids?: string[]): Promise<{ text: string; name: string }> {
  await vorbereiten(sprache);
  const a = await sende({ art: 'drawio-export', projekt, sprache, ...(ids ? { ids } : {}) });
  if (a.art !== 'drawio') throw new Error('Unerwartete Antwort');
  return { text: a.text, name: a.name };
}

/** Datei aus draw.io lesen (im Worker, eigener Parser ohne DOM): Vorschau je Seite */
export async function drawioLesen(projekt: Projekt, sprache: Sprache, daten: Uint8Array, datei: string, prozessId?: string): Promise<DrawioVorschau[]> {
  await vorbereiten(sprache);
  const a = await sende({ art: 'drawio-lesen', projekt, sprache, daten, datei, ...(prozessId ? { prozessId } : {}) });
  if (a.art !== 'drawio-gelesen') throw new Error('Unerwartete Antwort');
  return a.seiten;
}

// ---------- Bibliothek (ab rc.10) ----------

/** Firmendokumente für die Bibliothek: je Datei neue Version (Entwurf); unverändert = gleicher Inhalt wie die letzte erzeugte Version */
export async function bibliothekErzeugen(projekt: Projekt, sprache: Sprache, ids?: string[]): Promise<{ dateien: BibliothekDatei[]; unveraendert: string[]; fehler: DateiFehler[]; ausgelassen: { id: string; grund: string }[] }> {
  await vorbereiten(sprache);
  generatorFortschritt.value = { fertig: 0, gesamt: 0, datei: '' };
  try {
    const normtexte = normtexteFuerDokumente();
    const a = await sende({ art: 'bibliothek-set', projekt, sprache, ...(ids ? { ids } : {}), ...(normtexte ? { normtexte } : {}) });
    if (a.art !== 'bibliothek-set') throw new Error('Unerwartete Antwort');
    return a;
  } finally {
    generatorFortschritt.value = null;
  }
}

/** Datei eines freigegebenen Dokuments neu erzeugen; null: kein Dokument des Generators */
export async function bibliothekFreigabeDatei(projekt: Projekt, sprache: Sprache, id: string): Promise<{ daten: Uint8Array; basis: string; dateiname: string } | null> {
  await vorbereiten(sprache);
  const normtexte = normtexteFuerDokumente();
  const a = await sende({ art: 'bibliothek-freigabe', projekt, sprache, id, ...(normtexte ? { normtexte } : {}) });
  if (a.art !== 'bibliothek-freigabe') throw new Error('Unerwartete Antwort');
  return a.datei;
}

/** Leere Vorlage des Kits als Datei */
export async function vorlageErzeugen(id: string, sprache: Sprache): Promise<{ daten: Uint8Array; name: string }> {
  await vorbereiten(sprache);
  const a = await sende({ art: 'vorlage', id, sprache });
  if (a.art !== 'datei') throw new Error('Unerwartete Antwort');
  return a;
}

export async function zipPacken(dateien: { pfad: string; daten: Uint8Array }[], register: string): Promise<Uint8Array> {
  const a = await sende({ art: 'zip-packen', dateien, register });
  if (a.art !== 'datei') throw new Error('Unerwartete Antwort');
  return a.daten;
}

export async function zipEntpacken(daten: Uint8Array): Promise<{ register: string | null; dateien: { pfad: string; daten: Uint8Array }[] }> {
  const a = await sende({ art: 'zip-entpacken', daten });
  if (a.art !== 'zip-entpackt') throw new Error('Unerwartete Antwort');
  return a;
}

export async function docxTextLesen(daten: Uint8Array): Promise<{ text: string; ebene?: number; tabelle?: boolean }[]> {
  const a = await sende({ art: 'docx-text', daten });
  if (a.art !== 'docx-text') throw new Error('Unerwartete Antwort');
  return a.absaetze;
}

/** Datei als Download anbieten; ohne Typ gilt der MIME-Typ der Endung (Prüfung Dokumente und Download, D1). */
export function herunterladen(daten: Uint8Array | Blob | string, name: string, typ = mimeVon(name)): void {
  const url = URL.createObjectURL(new Blob([daten as BlobPart], { type: typ }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
